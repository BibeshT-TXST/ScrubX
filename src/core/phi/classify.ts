import { PHI_RULES } from "../rules/phi.rules";
import { matchRules } from "../rules/types";
import type { PatientContext, PhiLabel } from "../types";
import { COMMON_WORD_NAMES, FIRST_NAMES, TITLES } from "./dictionaries";
import { findingsToLabels, resolveLabels } from "./labels";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const flexible = (s: string) => s.trim().split(/\s+/).map(escape).join("\\s+");

const DICTIONARY_PERSON = new RegExp(`\\b(?:${FIRST_NAMES.join("|")})\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`, "g");
const TITLED_PERSON = new RegExp(`\\b${TITLES}\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`, "g");

function isSentenceStart(text: string, index: number): boolean {
  return /(?:^|[.!?]\s+|\n\s*)$/.test(text.slice(0, index));
}

// After a sentence-initial "Will", these mean the word is the subject (a name), not the verb.
const SUBJECT_VERB = /^(?:'s|\s+(?:is|was|has|had|reports|presents|denies|says|states|remains)\b)/;

/** "Will" opening a question is the verb, and "April 3" is a date, not the patient. */
function ambiguousCommonWord(text: string, index: number, word: string): boolean {
  if (!COMMON_WORD_NAMES.has(word.toLowerCase())) return false;
  const after = text.slice(index + word.length);
  if (/^\s+\d/.test(after)) return true;
  return isSentenceStart(text, index) && !SUBJECT_VERB.test(after);
}

export function ageAt(dob: string, now: Date): number {
  const [y = 0, m = 1, d = 1] = dob.split("-").map(Number);
  const beforeBirthday = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  return now.getUTCFullYear() - y - (beforeBirthday ? 1 : 0);
}

function* matches(text: string, re: RegExp) {
  for (const m of text.matchAll(re)) yield { start: m.index, end: m.index + m[0].length, text: m[0] };
}

/**
 * Record-aware and dictionary PHI detection. Knows the current patient, so it
 * finds their name, MRN, address and age in free text with high precision.
 * Pattern-shaped PHI (dates, phones, SSNs) comes from the regex rule pack.
 */
export function classifyPhi(text: string, patient: PatientContext, now: Date): PhiLabel[] {
  const { name, mrn, address, dob } = patient.fields;
  const labels: PhiLabel[] = [];
  const add = (l: Omit<PhiLabel, "source">) => labels.push({ ...l, source: "record" });

  const parts = name.trim().split(/\s+/);
  const surname = parts.at(-1)!;
  const fullName = new RegExp(`\\b(?:${TITLES}\\s+)?${flexible(name)}\\b`, "gi");
  const titledSurname = new RegExp(`\\b${TITLES}\\s+${escape(surname)}\\b`, "gi");

  const age = ageAt(dob, now);
  const ageAfterName = /^(?:\s*,\s*|\s*\(\s*|\s+is\s+(?:a\s+)?|\s+aged?\s+)(\d{1,3})\b/;

  for (const m of matches(text, fullName)) {
    add({ type: "PATIENT", start: m.start, end: m.end, confidence: 0.97, field: "name" });
    const after = ageAfterName.exec(text.slice(m.end));
    if (after && Number(after[1]) === age) {
      const start = m.end + after[0].length - after[1]!.length;
      add({ type: "AGE", start, end: start + after[1]!.length, confidence: 0.9 });
    }
  }
  for (const m of matches(text, titledSurname)) {
    add({ type: "PATIENT", start: m.start, end: m.end, confidence: 0.9, field: "name" });
  }
  // Single name parts are matched case-sensitively so "marsh trail" isn't Will Marsh.
  for (const part of parts) {
    if (part.length < 2) continue;
    for (const m of matches(text, new RegExp(`\\b${escape(part)}\\b`, "g"))) {
      if (ambiguousCommonWord(text, m.start, part)) continue;
      add({ type: "PATIENT", start: m.start, end: m.end, confidence: 0.8, field: "name" });
    }
  }

  const mrnDigits = mrn.replace(/\D/g, "");
  for (const re of [new RegExp(`\\b${escape(mrn)}\\b`, "gi"), mrnDigits && new RegExp(`\\b${mrnDigits}\\b`, "g")]) {
    if (re) for (const m of matches(text, re)) add({ type: "MRN", start: m.start, end: m.end, confidence: 0.97, field: "mrn" });
  }

  if (address) {
    for (const m of matches(text, new RegExp(flexible(address), "gi"))) {
      add({ type: "ADDRESS", start: m.start, end: m.end, confidence: 0.97, field: "address" });
    }
    const street = address.split(",")[0]!;
    for (const m of matches(text, new RegExp(`\\b${flexible(street)}\\b`, "gi"))) {
      add({ type: "ADDRESS", start: m.start, end: m.end, confidence: 0.95 });
    }
  }

  for (const re of [DICTIONARY_PERSON, TITLED_PERSON]) {
    for (const m of matches(text, re)) {
      if (ambiguousCommonWord(text, m.start, m.text.split(/\s/)[0]!)) continue;
      labels.push({ type: "PERSON", start: m.start, end: m.end, confidence: 0.7, source: "dictionary" });
    }
  }

  return labels;
}

/** Full PHI detection on one text: record + dictionary + regex patterns, resolved. */
export function detectPhi(text: string, patient: PatientContext, now: Date): PhiLabel[] {
  return resolveLabels([...classifyPhi(text, patient, now), ...findingsToLabels(matchRules(text, PHI_RULES))]);
}
