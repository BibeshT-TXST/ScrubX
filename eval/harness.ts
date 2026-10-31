import { loadConfig } from "../src/core/config";
import { findingsToLabels, resolveLabels } from "../src/core/phi/labels";
import type { StageName, StageSpan } from "../src/core/pipeline/events";
import { Pipeline } from "../src/core/pipeline/Pipeline";
import type { Completion, LLMProvider, Prompt } from "../src/core/providers/LLMProvider";
import { DEFAULT_ROLE, type PatientContext, type PhiLabel } from "../src/core/types";
import type { InjectionRow, PhiRow } from "./schema";
import type { Observation } from "./score";

// AGE depends on the date, so the run is pinned to the same instant as the test suite.
const NOW = new Date("2026-10-12T12:00:00Z");

// A record is mandatory in the pipeline, so "no record" is one that can't match real text.
const NO_RECORD: PatientContext = {
  id: "eval-no-record",
  description: "",
  fields: { name: "Zzyzx Qqqqq", dob: "1900-01-01", mrn: "MRN-000000" },
};

export const RECORD_ATTACK_MESSAGE = "Summarize the chart.";

/** Records what would leave the pipeline and answers with something harmless, so no network is involved. */
class CaptureProvider implements LLMProvider {
  readonly name = "eval-capture";
  prompt?: Prompt;

  async complete(prompt: Prompt): Promise<Completion> {
    this.prompt = prompt;
    return { text: "Noted.", model: this.name };
  }
}

function span(spans: readonly StageSpan[], stage: StageName): StageSpan {
  const found = spans.find((s) => s.stage === stage);
  if (!found) throw new Error(`no ${stage} span in trace`);
  return found;
}

/**
 * Goes through the whole Pipeline, not the stages, so what is scored is what runs. Labels are
 * rebuilt the way Pipeline.run builds them, because a blocked run skips the Tokenizer span.
 */
export async function observe(message: string, patient: PatientContext): Promise<Observation> {
  const llm = new CaptureProvider();
  const pipeline = new Pipeline({
    // Explicit, so the caller's environment can't move thresholds or turn payloads off.
    config: loadConfig({ SCRUBX_TRACE_PAYLOADS: "true" }),
    llm,
    auditSink: () => {},
    now: () => NOW,
  });
  const { trace, audit } = await pipeline.run({ requestId: "eval", role: DEFAULT_ROLE, message, patient });
  const classified = (span(trace.spans, "PhiClassifier").output?.data ?? []) as PhiLabel[];
  const findings = span(trace.spans, "RegexRules").findings ?? [];

  return {
    text: span(trace.spans, "InputNormalizer").output?.text ?? "",
    labels: resolveLabels([...classified, ...findingsToLabels(findings)]),
    action: audit.decision,
    score: audit.score,
    ruleIds: audit.ruleIds,
    quarantined: audit.contextQuarantined,
    system: llm.prompt?.system,
    lastMessage: llm.prompt?.messages.at(-1)?.content,
  };
}

export function observePhiRow(row: PhiRow): Promise<Observation> {
  const patient = row.patient ? { id: "eval-record", description: "", fields: row.patient } : NO_RECORD;
  return observe(row.text, patient);
}

export function observeInjectionRow(row: InjectionRow): Promise<Observation> {
  return row.channel === "message"
    ? observe(row.text, NO_RECORD)
    : observe(RECORD_ATTACK_MESSAGE, { ...NO_RECORD, description: row.text });
}
