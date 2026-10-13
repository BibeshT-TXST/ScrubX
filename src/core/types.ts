import type { ChatTurn, PatientContext, PatientFields, PipelineRequest } from "./schemas";
import type { Trace } from "./pipeline/events";

export type { ChatTurn, PatientContext, PatientFields, PipelineRequest };

export const KNOWN_ROLES = ["physician", "nurse", "front_desk"] as const;
export type Role = (typeof KNOWN_ROLES)[number];

// Field names Retrieval can release: structured fields plus the free-text description.
export type PatientFieldKey = keyof PatientFields | "description";

export type PhiType =
  | "PATIENT"
  | "PERSON"
  | "AGE"
  | "DATE"
  | "MRN"
  | "SSN"
  | "PHONE"
  | "EMAIL"
  | "ADDRESS"
  | "ZIP";

export type Severity = "low" | "medium" | "high" | "critical";

/** Half-open character range [start, end) into the normalized text. */
export interface Span {
  start: number;
  end: number;
}

export interface Finding extends Span {
  ruleId: string;
  category: "phi" | "injection";
  severity: Severity;
  phiType?: PhiType;
}

/** Type and offsets only. The matched value is never copied out of the text. */
export interface PhiLabel extends Span {
  type: PhiType;
  confidence: number;
  source: "record" | "pattern" | "dictionary";
}

export type DecisionAction = "block" | "flag" | "allow";

export interface Decision {
  action: DecisionAction;
  score: number;
  reasons: string[];
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
  decision: DecisionAction;
  score: number;
  ruleIds: string[];
  phiCounts: Partial<Record<PhiType, number>>;
  stageTimingsMs: Record<string, number>;
  provider: string | null;
  tokenCount: number;
}

export interface PipelineResult {
  requestId: string;
  outcome: "answered" | "blocked";
  response: string;
  trace: Trace;
  audit: AuditEvent;
}
