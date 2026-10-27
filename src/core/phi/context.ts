import type { PhiLabel } from "../types";
import { MEDICATIONS } from "./dictionaries";
import { anyCase, END, isSentenceStart, NAME_WORD, START } from "./patterns";

// Words that put a person's name right after them: "her neighbor Tyrone Jackson".
const RELATIONS = [
  "son", "daughter", "wife", "husband", "partner", "spouse", "mother", "mom", "father", "dad",
  "brother", "sister", "grandson", "granddaughter", "grandmother", "grandfather", "grandma", "grandpa",
  "stepson", "stepdaughter", "stepmother", "stepfather", "aunt", "uncle", "niece", "nephew", "cousin",
  "neighbor", "neighbour", "friend", "roommate", "caregiver", "guardian", "boyfriend", "girlfriend",
  "fiancé", "fiancée", "coworker", "colleague", "boss", "landlord", "sponsor",
];
const RELATION = `(?:${RELATIONS.map(anyCase).join("|")})`;
const NAME = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;

// Verbs a person does in a note: "Tyrone Jackson brought her in"
const ACTION =
  `(?:said|says|called|calls|asked|asks|brought|brings|drove|drives|visited|visits|texted|emailed|phoned|` +
  `reported|reports|stated|states|is (?:her|his|their|the patient's) ${RELATION})`;

// [pattern, confidence]. The name is the `v` group.
const CUES: [RegExp, number][] = [
  [new RegExp(`${START}${RELATION}(?:,|\\s+(?:is|was|named|called))?\\s+(?<v>${NAME})${END}`, "dgu"), 0.7],
  [new RegExp(`${START}(?<v>${NAME})\\s+${ACTION}${END}`, "dgu"), 0.7],
  // Below the output check's 0.5 bar: tokenized on the way in, but a model's own
  // Title Case ("Blood Pressure Goals") is only redacted in strict mode.
  [new RegExp(`${START}(?<v>${NAME_WORD}(?:\\s+${NAME_WORD}){1,2})${END}`, "dgu"), 0.45],
];

// Capitalized words that are not names on their own. Any match made only of these is dropped,
// and a capitalized pair that includes one is not treated as a name.
export const NOT_NAMES = new Set([
  "i", "he", "she", "they", "we", "you", "it", "her", "his", "their", "our", "my", "the", "this", "that",
  "him", "them", "me", "us", "your", "its",
  "who", "whom", "whose", "what", "which", "where", "when", "why", "how",
  "a", "an", "someone", "somebody", "anyone", "anybody", "nobody", "everyone",
  "patient", "pt", "doctor", "nurse", "provider", "pharmacy",
  "pharmacist", "clinic", "hospital", "office", "team", "staff", "family", "insurance", "lab", "labs",
  "cardiology", "radiology", "nephrology", "oncology", "neurology", "endocrinology", "pulmonology",
  ...RELATIONS,
]);

export const CLINICAL = new Set([
  "disease", "syndrome", "disorder", "failure", "chronic", "acute", "type", "stage", "blood", "pressure",
  "heart", "kidney", "renal", "liver", "lung", "diabetes", "therapy", "physical", "occupational", "emergency",
  "department", "room", "unit", "care", "center", "centre", "medical", "health", "medicine", "internal",
  "primary", "urgent", "intensive", "general", "practice", "medicare", "medicaid", "social", "security",
  "test", "panel", "plan", "goals", "summary", "assessment", "history", "visit", "follow", "up",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
  "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  ...MEDICATIONS,
]);

const words = (s: string) => s.toLowerCase().split(/\s+/);

/**
 * People named in free text who aren't the patient and aren't in the name dictionary.
 * Found by what surrounds them, not by a name list, so it works for any name.
 */
export function contextPersons(text: string): PhiLabel[] {
  const labels: PhiLabel[] = [];
  for (const [re, confidence] of CUES) {
    const pair = confidence < 0.5;
    for (const m of text.matchAll(re)) {
      const [start, end] = m.indices!.groups!.v!;
      const ws = words(m.groups!.v!);
      if (ws.every((w) => NOT_NAMES.has(w))) continue;
      if (pair && (isSentenceStart(text, start) || ws.some((w) => NOT_NAMES.has(w) || CLINICAL.has(w)))) continue;
      labels.push({ type: "PERSON", start, end, confidence, source: "context" });
    }
  }
  return labels;
}
