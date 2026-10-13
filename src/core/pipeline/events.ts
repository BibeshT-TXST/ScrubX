import type { Finding, PipelineResult } from "../types";

/** The 7 top-level steps of the UI (matches the site animation). */
export const STEPS = [
  "receive",
  "normalize",
  "detect",
  "decide",
  "tokenize",
  "model",
  "restore",
] as const;
export type Step = (typeof STEPS)[number];

export type StageName =
  | "Receive"
  | "InputNormalizer"
  | "RegexRules"
  | "SemanticScan"
  | "PhiClassifier"
  | "RiskEngine"
  | "Block"
  | "Tokenizer"
  | "AuditLogger"
  | "Retrieval"
  | "LlmStage"
  | "OutputAnalysis"
  | "Rehydrator";

export type SpanStatus = "ok" | "skipped" | "blocked" | "error";

/** What a stage received or produced. Omitted entirely when trace payloads are off. */
export interface StageSnapshot {
  text?: string;
  /** Must be JSON-serializable: it travels to the Dev View as NDJSON. */
  data?: unknown;
}

export type SpanAttributes = Record<string, string | number | boolean>;

// Shaped like an OpenTelemetry span so it can be exported later without a rewrite.
export interface StageSpan {
  spanId: string;
  parentSpanId?: string;
  stage: StageName;
  step: Step;
  caption?: string;
  status: SpanStatus;
  startMs: number;
  durationMs: number;
  input?: StageSnapshot;
  output?: StageSnapshot;
  attributes: SpanAttributes;
  findings?: Finding[];
  error?: string;
}

export interface Trace {
  traceId: string;
  startedAt: string;
  durationMs: number;
  spans: StageSpan[];
}

/** One NDJSON line on the streaming endpoint. */
export type StageEvent =
  | { type: "span"; span: StageSpan }
  | { type: "result"; result: PipelineResult };
