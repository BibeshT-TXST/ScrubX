import type { Rule } from "./types";

export const INSTRUCTIONS = String.raw`(?:instructions?|prompts?|rules|directions)\b`;

// "previous", "prior", "any previous and following" (Perez & Ribeiro 2022[Research Based]).
const PRIOR = String.raw`(?:previous|prior|above|earlier|preceding|system|original)(?:\s+(?:and|or)\s+\w+)?`;

// The verb is a command with no subject: it opens a sentence or clause, follows "and", or
// is addressed to "you". "She may forget" and "tends to ignore" describe the patient instead.
export const COMMAND = String.raw`(?<=(?:^|[.!?;:,>\]\n]|\band|\byou(?:\s+(?:must|should|will|need to|have to))?)\s*(?:(?:please|now|just|so)\s+)?)`;

/**
 * An instruction override aimed at the assistant (Issue #15). Either the target names the
 * assistant's instructions ("all previous instructions", "your prior rules", "the above
 * instructions", "the system prompt"), or the verb is a command ("Forget prior rules.").
 * "She may forget prior instructions" and "ignore her prior instructions" are about the patient.
 */
export const INSTRUCTION_OVERRIDE = new RegExp(
  String.raw`\b(?:ignore|disregard|forget|override)\b(?:\s+\w+){0,2}?\s+(?:(?:your|all|any)\s+${PRIOR}|the\s+(?:above|system))\s+${INSTRUCTIONS}` +
    String.raw`|${COMMAND}\b(?:ignore|disregard|forget|override)\s+(?:(?:my|your|the|all|any)\s+)?${PRIOR}\s+${INSTRUCTIONS}`,
  "gi",
);

/**
 * A role marker opening a line. "System:" is also a clinical section header ("System:
 * cardiovascular review of systems negative"), so it counts only when what follows reads
 * like an instruction: "you", or a verb the rules below already treat as one.
 */
export const ROLE_LINE = String.raw`(?:^|\n)\s*(?:(?:assistant|developer)\s*:|system\s*:(?=\s*(?:please\s+)?(?:you|your|from now on|pretend|ignore|disregard|forget|override|bypass|reveal|show|print|display|output|repeat|leak|dump|tell|include|give|list|send)\b))`;

// Known injection strings. Critical rules block on their own (see RiskEngine).
export const INJECTION_RULES: readonly Rule[] = [
  { id: "INJ-OVERRIDE", category: "injection", severity: "critical",
    description: "Instruction override",
    pattern: INSTRUCTION_OVERRIDE },
  { id: "INJ-PROMPT-PROBE", category: "injection", severity: "critical",
    description: "System prompt probe",
    pattern: /\b(?:reveal|show|print|display|output|repeat|leak|dump|tell me)\b(?:\s+\w+){0,4}?\s+(?:system prompt|hidden (?:instructions|prompt)|initial (?:instructions|prompt)|(?:your|the) instructions)/gi },
  { id: "INJ-TOKEN-MAP", category: "injection", severity: "critical",
    description: "Token map / de-identification probe",
    pattern: /\b(?:token map|token mapping|placeholder mapping|vault|de-?tokeni[sz]e|unmask|re-?identify|real (?:name|values?|identit(?:y|ies)) (?:behind|for) )/gi },
  { id: "INJ-ROLE-MARKER", category: "injection", severity: "high",
    description: "Fake role marker",
    pattern: new RegExp(String.raw`${ROLE_LINE}|\b(?:system|assistant|developer)\s+(?:note|message|override)\s*:|\[\/?(?:system|inst)\]|<\|im_(?:start|end)\|>`, "gi") },
  { id: "INJ-PERSONA", category: "injection", severity: "high",
    description: "Persona switch / jailbreak mode",
    pattern: /\b(?:you are now|from now on,? you|pretend (?:to be|you are)|developer mode|jailbreak|do anything now|DAN mode)\b/gi },
  { id: "INJ-SSN-REQUEST", category: "injection", severity: "high",
    description: "Request for SSN",
    pattern: /\b(?:include|give|list|send|tell|print|show)\b.{0,40}\b(?:ssn|social security(?: number)?)\b/gi },
  { id: "INJ-CROSS-PATIENT", category: "injection", severity: "medium",
    description: "Request for other patients' data",
    pattern: /\b(?:all|every|other) patients?\b|\bpatient list\b/gi },
  { id: "INJ-ENCODED", category: "injection", severity: "medium",
    description: "Encoded payload", pattern: /[A-Za-z0-9+/]{40,}={0,2}/g },
  { id: "INJ-IMAGE-EXFIL", category: "injection", severity: "medium",
    description: "Markdown image to external URL", pattern: /!\[[^\]]*\]\(https?:\/\/|\(https?:\/\/[^)\s]*[?&][^)\s]*=/gi },
];
