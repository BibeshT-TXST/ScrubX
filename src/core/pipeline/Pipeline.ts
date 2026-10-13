import type { ScrubXConfig } from "../config";
import { HeuristicScanner, type InjectionScanner } from "../injection/scanner";
import { findingsToLabels, resolveLabels } from "../phi/labels";
import { MODEL_UNAVAILABLE, type Completion, type LLMProvider } from "../providers/LLMProvider";
import { buildPrompt } from "../providers/prompt";
import { AuditLogger, type AuditInput, type AuditSink } from "../stages/AuditLogger";
import { Block } from "../stages/Block";
import { InputNormalizer } from "../stages/InputNormalizer";
import { LlmStage } from "../stages/LlmStage";
import { OutputAnalysis } from "../stages/OutputAnalysis";
import { PhiClassifier } from "../stages/PhiClassifier";
import { Receive } from "../stages/Receive";
import { RegexRules } from "../stages/RegexRules";
import { Rehydrator } from "../stages/Rehydrator";
import { Retrieval } from "../stages/Retrieval";
import { RiskEngine } from "../stages/RiskEngine";
import { SemanticScan } from "../stages/SemanticScan";
import { Tokenizer } from "../stages/Tokenizer";
import type { PipelineRequest, PipelineResult } from "../types";
import type { StageEvent, StageName, StageSpan, Step } from "./events";
import type { StageContext } from "./Stage";
import { TraceRecorder, type Clock } from "./TraceRecorder";

export interface PipelineDeps {
  config: ScrubXConfig;
  llm: LLMProvider;
  scanner?: InjectionScanner;
  auditSink?: AuditSink;
  /** Injectable for deterministic tests. */
  clock?: Clock;
  now?: () => Date;
}

const SKIPPED_ON_BLOCK: [StageName, Step][] = [
  ["Tokenizer", "tokenize"],
  ["Retrieval", "model"],
  ["LlmStage", "model"],
  ["OutputAnalysis", "model"],
  ["Rehydrator", "restore"],
];

const SKIPPED_ON_UNAVAILABLE: [StageName, Step][] = [
  ["OutputAnalysis", "model"],
  ["Rehydrator", "restore"],
];

/**
 * Orchestrator. Runs the stages in diagram order, the three detectors in
 * parallel, and branches on the Risk Engine's decision. Stateless: every
 * request gets its own trace, vault and context. Stage instances hold no
 * per-request state, so one Pipeline can serve many requests.
 */
export class Pipeline {
  private readonly receive = new Receive();
  private readonly normalizer = new InputNormalizer();
  private readonly regexRules = new RegexRules();
  private readonly semanticScan: SemanticScan;
  private readonly phiClassifier = new PhiClassifier();
  private readonly riskEngine = new RiskEngine();
  private readonly block = new Block();
  private readonly tokenizer = new Tokenizer();
  private readonly retrieval: Retrieval;
  private readonly llm: LlmStage;
  private readonly outputAnalysis = new OutputAnalysis();
  private readonly rehydrator = new Rehydrator();
  private readonly auditLogger: AuditLogger;

  constructor(private readonly deps: PipelineDeps) {
    const scanner = deps.scanner ?? new HeuristicScanner();
    this.semanticScan = new SemanticScan(scanner);
    this.retrieval = new Retrieval(scanner);
    this.llm = new LlmStage(deps.llm);
    this.auditLogger = new AuditLogger(deps.auditSink);
  }

  async run(req: PipelineRequest, onSpan?: (span: StageSpan) => void): Promise<PipelineResult> {
    const { config } = this.deps;
    const now = this.deps.now?.() ?? new Date();
    const trace = new TraceRecorder({
      traceId: req.requestId,
      payloads: config.tracePayloads,
      clock: this.deps.clock,
      now: () => now,
      onSpan,
    });
    const ctx: StageContext = { requestId: req.requestId, role: req.role, config, trace, now };

    const { output: received } = await this.receive.run(req, ctx);
    const { patient } = received;
    const { output: normalized, span: normSpan } = await this.normalizer.run(received.message, ctx);

    const detectCtx = { ...ctx, parentSpanId: normSpan.spanId };
    const [{ output: findings }, { output: scan }, { output: classified }] = await Promise.all([
      this.regexRules.run(normalized, detectCtx),
      this.semanticScan.run(normalized, detectCtx),
      this.phiClassifier.run({ text: normalized.text, patient }, detectCtx),
    ]);
    const labels = resolveLabels([...classified, ...findingsToLabels(findings)]);

    const { output: decision } = await this.riskEngine.run({ findings, scan, labels }, ctx);
    const audit = (input: Omit<AuditInput, "decision" | "findings" | "labels">) =>
      this.auditLogger.run({ ...input, decision, findings, labels }, ctx).then((r) => r.output);

    if (decision.action === "block") {
      const { output: refusal } = await this.block.run(decision, ctx);
      for (const [stage, step] of SKIPPED_ON_BLOCK) trace.skip(stage, step, "Skipped: request blocked.");
      const auditEvent = await audit({
        outcome: "blocked",
        provider: null,
        tokensCreated: 0,
        tokensRehydrated: 0,
        contextQuarantined: 0,
        output: { leaks: 0, unknownTokens: 0, ungrounded: 0 },
      });
      return { requestId: req.requestId, outcome: "blocked", response: refusal, trace: trace.finish(), audit: auditEvent };
    }

    const { output: tokenized } = await this.tokenizer.run({ text: normalized.text, labels, patient }, ctx);
    const { vault } = tokenized;
    const { output: retrieved } = await this.retrieval.run({ patient, history: received.history, vault }, ctx);
    const prompt = buildPrompt({ context: retrieved.context, history: retrieved.history, message: tokenized.text });
    let completion: Completion;
    try {
      ({ output: completion } = await this.llm.run(prompt, ctx));
    } catch {
      // The model is down, overloaded or not configured. That is an outcome, not a crash:
      // the LLM span already records the error, the rest is skipped, and the audit is still written.
      for (const [stage, step] of SKIPPED_ON_UNAVAILABLE) trace.skip(stage, step, "Skipped: the model could not be reached.");
      const auditEvent = await audit({
        outcome: "unavailable",
        provider: this.llm.providerName,
        tokensCreated: vault.size,
        tokensRehydrated: 0,
        contextQuarantined: retrieved.quarantined,
        output: { leaks: 0, unknownTokens: 0, ungrounded: 0 },
      });
      return { requestId: req.requestId, outcome: "unavailable", response: MODEL_UNAVAILABLE, trace: trace.finish(), audit: auditEvent };
    }
    const { output: verdict } = await this.outputAnalysis.run(
      {
        completion: completion.text,
        vault,
        patient,
        sources: [retrieved.context, ...retrieved.history.map((t) => t.content), tokenized.text].join("\n"),
        strict: decision.action === "flag" || retrieved.quarantined > 0,
      },
      ctx,
    );
    const { output: restored } = await this.rehydrator.run({ text: verdict.text, vault }, ctx);

    const auditEvent = await audit({
      outcome: "answered",
      provider: this.llm.providerName,
      tokensCreated: vault.size,
      tokensRehydrated: restored.count,
      contextQuarantined: retrieved.quarantined,
      output: { leaks: verdict.leaks.length, unknownTokens: verdict.unknownTokens.length, ungrounded: verdict.ungrounded.length },
    });
    return { requestId: req.requestId, outcome: "answered", response: restored.text, trace: trace.finish(), audit: auditEvent };
  }

  /** Same run, emitted as events: one per span as it closes, then the result. Drives the NDJSON stream. */
  async *stream(req: PipelineRequest): AsyncGenerator<StageEvent> {
    const queue: StageEvent[] = [];
    let wake: (() => void) | undefined;
    let settled = false;
    let failure: { error: unknown } | undefined;

    const push = (e: StageEvent) => {
      queue.push(e);
      wake?.();
    };
    this.run(req, (span) => push({ type: "span", span })).then(
      (result) => push({ type: "result", result }),
      (error: unknown) => (failure = { error }),
    ).finally(() => {
      settled = true;
      wake?.();
    });

    while (true) {
      while (queue.length) yield queue.shift()!;
      if (failure) throw failure.error;
      if (settled) return;
      await new Promise<void>((r) => (wake = r));
      wake = undefined;
    }
  }
}

export const runPipeline = (req: PipelineRequest, deps: PipelineDeps) => new Pipeline(deps).run(req);
export const runPipelineStream = (req: PipelineRequest, deps: PipelineDeps) => new Pipeline(deps).stream(req);
