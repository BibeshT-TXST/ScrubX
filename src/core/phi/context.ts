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

const ROLES = [
  "nurse", "RN", "LPN", "NP", "PA", "aide", "pharmacist", "therapist", "physician", "provider", "doctor",
  "counselor", "social worker", "case manager", "dietitian", "hospitalist", "caretaker"
];

const ROLE_CUE = `(?:${ROLES.map((r) => r.replace(" ", "\\s+")).join("|")})`;
// Words that only make a role, never a given name: "Therapist Chen", "Social Worker Chen".
export const ROLE = `(?:${ROLES.map((r) => r.split(" ").map(anyCase).join("\\s+")).join("|")})`;
export const ROLE_WORDS = ROLES.flatMap((r) => r.toLowerCase().split(" "));
const THROUGH_LAST_ROLE = new RegExp(`^.*${START}${ROLE}\\s+`, "su"); 
const RELATION = `(?:${RELATIONS.map(anyCase).join("|")})`;
const NAME = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;

// Verbs a person does in a note: "Tyrone Jackson brought her in"
const ACTION =
  `(?:said|says|called|calls|asked|asks|brought|brings|drove|drives|visited|visits|texted|emailed|phoned|` +
  `reported|reports|stated|states|is (?:her|his|their|the patient's) ${RELATION})`;

// Verbs a note also uses for findings and orders ("Edema noted", "Statin recommended").
// Only with an object after them do they say someone did something: "flagged an interaction".
const NOTE_ACTION = `(?:flagged|noted|recommended|refilled|prescribed|documented)\\s+(?:a|an|the|that|this|her|his|their)`;

// [pattern, confidence]. The name is the `v` group.
const CUES: [RegExp, number][] = [
  [new RegExp(`${START}${RELATION}(?:,|\\s+(?:is|was|named|called))?\\s+(?<v>${NAME})${END}`, "dgu"), 0.7],
  [new RegExp(`${START}${ROLE_CUE}\\s+(?<v>${NAME})${END}`, "dgu"), 0.7],
  [new RegExp(`${START}(?<v>${NAME})\\s+${ACTION}${END}`, "dgu"), 0.7],
  // Below the output check's 0.5 bar: tokenized on the way in, but a model's own
  // Title Case ("Blood Pressure Goals") is only redacted in strict mode.
  // Followed by a note action, a pair can open a sentence: "Siobhán O'Connell flagged an interaction".
  [new RegExp(`${START}(?<v>${NAME_WORD}(?:\\s+${NAME_WORD}){1,2})(?<acted>\\s+${NOTE_ACTION})?${END}`, "dgu"), 0.45],
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
const notInPair = (w: string) => NOT_NAMES.has(w) || CLINICAL.has(w);

/** Moves a span's start past a role that ends inside it: "Social Worker Amara Okoye" → "Amara Okoye". */
function afterRole(text: string, start: number, end: number): number {
  const role = THROUGH_LAST_ROLE.exec(text.slice(0, end));
  return Math.max(start, role?.[0].length ?? 0);
}

/**
 * Moves a span's start past the NOT_NAMES words that open it: "When Tyrone Jackson" → "Tyrone Jackson".
 * One further in stays, since "Son" is also a name ("Minh Son"). Returns `end` if nothing is left.
 */
function afterNotNames(text: string, start: number, end: number): number {
  for (const [word] of text.slice(start, end).matchAll(/\S+\s*/g)) {
    if (!NOT_NAMES.has(word.trimEnd().toLowerCase())) break;
    start += word.length;
  }
  return start;
}

/**
 * People named in free text who aren't the patient and aren't in the name dictionary.
 * Found by what surrounds them, not by a name list, so it works for any name.
 */
export function contextPersons(text: string): PhiLabel[] {
  const labels: PhiLabel[] = [];
  for (const [re, confidence] of CUES) {
    const pair = confidence < 0.5;
    re.lastIndex = 0;
    for (let m; (m = re.exec(text)); ) {
      const [spanStart, end] = m.indices!.groups!.v!;
      const named = afterRole(text, spanStart, end);
      // A pair that includes a NOT_NAMES word is still not a name: "The Joint Commission".
      const start = pair ? named : afterNotNames(text, named, end);
      if (start === end) continue;
      const ws = words(text.slice(start, end));
      const opensSentence = isSentenceStart(text, start) && !m.groups!.acted;
      if (pair && (ws.length < 2 || opensSentence || ws.some(notInPair))) {
        // Only the first word was in the way ("Yesterday Siobhán O'Connell", "Monday Siobhán O'Connell"):
        // search again from the next word instead of after the whole span.
        if (!NOT_NAMES.has(ws[0]!) && !ws.slice(1).some(notInPair)) re.lastIndex = start + 1;
        continue;
      }
      labels.push({ type: "PERSON", start, end, confidence, source: "context" });
    }
  }
  return labels;
}
