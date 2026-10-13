import { countByType } from "../phi/labels";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import type { AuditEvent, Decision, Finding, PhiLabel } from "../types";

export interface AuditInput {
  outcome: AuditEvent["outcome"];
  decision: Decision;
  findings: Finding[];
  labels: PhiLabel[];
  provider: string | null;
  tokensCreated: number;
  tokensRehydrated: number;
  contextQuarantined: number;
  output: AuditEvent["output"];
}

export type AuditSink = (line: string) => void;

/**
 * Runs for every request, blocked ones included. Builds the event from
 * counts, rule IDs and timings only, then writes one JSON line (stdout by
 * default, which lands in Vercel's logs). No values, no raw text.
 */
export class AuditLogger extends Stage<AuditInput, AuditEvent> {
  readonly name = "AuditLogger" as const;
  readonly step = "restore" as const;

  constructor(private readonly sink: AuditSink = (line) => console.log(line)) {
    super();
  }

  protected async process(input: AuditInput, ctx: StageContext): Promise<AuditEvent> {
    const event: AuditEvent = {
      requestId: ctx.requestId,
      role: ctx.role,
      timestamp: ctx.now.toISOString(),
      outcome: input.outcome,
      decision: input.decision.action,
      score: input.decision.score,
      ruleIds: [...new Set(input.findings.map((f) => f.ruleId))],
      phiCounts: countByType(input.labels),
      tokensCreated: input.tokensCreated,
      tokensRehydrated: input.tokensRehydrated,
      contextQuarantined: input.contextQuarantined,
      output: input.output,
      stageTimingsMs: ctx.trace.timings(),
      provider: input.provider,
    };
    this.sink(JSON.stringify({ type: "scrubx.audit", ...event }));
    return event;
  }

  protected override describe(_in: AuditInput, event: AuditEvent): SpanDetails {
    return {
      caption: "Audit line written: counts and rule IDs only, no PHI.",
      attributes: { decision: event.decision, ruleIds: event.ruleIds.join(","), tokensCreated: event.tokensCreated },
    };
  }
}
