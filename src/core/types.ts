import type { ChatTurn, PatientContext, PatientFields, PipelineRequest } from "./schemas";
import type { Trace } from "./pipeline/events";

export type { ChatTurn, PatientContext, PatientFields, PipelineRequest };

export const KNOWN_ROLES = ["physician", "nurse", "front_desk"] as const;
export type Role = (typeof KNOWN_ROLES)[number];

// Field names Retrieval can release: structured fields plus the free-text description.
export type PatientFieldKey = keyof PatientFields | "description";

export const PHI_TYPES = [
  "PATIENT",
  "PERSON",
  "AGE",
  "DATE",
  "MRN",
  "SSN",
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "ZIP",
] as const;
export type PhiType = (typeof PHI_TYPES)[number];

export type Severity = "low" | "medium" | "high" | "critical";

/** Half-open character range [start, end) into the text being analyzed. */
export interface Span {
  start: number;
  end: number;
}

export interface Finding extends Span {
  ruleId: string;
  category: "phi" | "injection";
  severity: Severity;
  phiType?: PhiType;
  confidence?: number;
}

/**
 * Type and offsets only. The matched value is never copied out of the text.
 * `field` names the record field a match came from (not its value), so the
 * tokenizer can store the record's canonical spelling, e.g. "MARIA LOPEZ" → "Maria Lopez".
 */
export interface PhiLabel extends Span {
  type: PhiType;
  confidence: number;
  source: "record" | "pattern" | "dictionary";
  field?: "name" | "mrn" | "address";
}

export type DecisionAction = "block" | "flag" | "allow";

export interface Decision {
  action: DecisionAction;
  score: number;
  reasons: string[];
  /** What pushed the score up, largest first. Drives the risk breakdown. */
  contributions: { source: string; score: number }[];
}

export interface PatientSummary {
  id: string;
  name: string;
  summary: string;
}

/** PHI-free by construction: counts, IDs and timings only. */
export interface AuditEvent {
  requestId: string;
  role: string;
  timestamp: string;
  outcome: "answered" | "blocked";
  decision: DecisionAction;
  score: number;
  ruleIds: string[];
  phiCounts: Partial<Record<PhiType, number>>;
  tokensCreated: number;
  tokensRehydrated: number;
  contextQuarantined: number;
  output: { leaks: number; unknownTokens: number; ungrounded: number };
  stageTimingsMs: Record<string, number>;
  provider: string | null;
}

export interface PipelineResult {
  requestId: string;
  outcome: "answered" | "blocked";
  response: string;
  trace: Trace;
  audit: AuditEvent;
}
