import { PHI_RULES } from "../rules/phi.rules";
import { matchRules } from "../rules/types";
import type { PatientContext, PhiLabel } from "../types";
import { CLINICAL, NOT_NAMES, contextPersons } from "./context";
import { CLINICIAN_TITLES, COMMON_WORD_NAMES, FIRST_NAMES, TITLES } from "./dictionaries";
import { findingsToLabels, resolveLabels } from "./labels";
import { END, isSentenceStart, NAME_WORD, START } from "./patterns";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const flexible = (s: string) => s.trim().split(/\s+/).map(escape).join("\\s+");
// Names also show up joined by punctuation: "maria-lopez" in a URL, "maria_lopez" in a handle.
const flexibleName = (s: string) => s.trim().split(/[\s._-]+/).map(escape).join("[\\s._-]+");

const DICTIONARY_PERSON = new RegExp(`${START}(?:${FIRST_NAMES.join("|")})\\s+${NAME_WORD}${END}`, "gu");
const TITLED_PERSON = new RegExp(`${START}${TITLES}\\s+${NAME_WORD}${END}`, "gu");

// Capitalized words that can sit right before a surname without being a given name.
const NOT_GIVEN = new Set([
  "dr", "drs", "doctor", "mr", "mrs", "ms", "miss", "mx", "prof", "professor",
  "per", "saw", "seen", "called", "told", "asked", "paged", "notified", "contacted", "informed", "dear",
  "and", "with", "for", "by",
  ...NOT_NAMES, ...CLINICAL,
]);

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

  const surname = name.trim().split(/\s+/).at(-1)!;
  // Hyphenated surnames also count part by part: "Okafor" alone is still Aisha O'Brien-Okafor.
  const parts = name.trim().split(/[\s-]+/);
  const fullName = new RegExp(`${START}(?:${TITLES}\\s+)?${flexibleName(name)}${END}`, "giu");
  const titledSurname = new RegExp(`${START}${TITLES}\\s+${escape(surname)}${END}`, "giu");

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

  // Name parts that are ordinary words stay case-sensitive so "marsh trail" isn't Will Marsh.
  // Every other part matches in any case: "maria" and "MARIA" are still Maria.
  for (const part of parts) {
    if (part.length < 2) continue;
    const flags = COMMON_WORD_NAMES.has(part.toLowerCase()) ? "gu" : "giu";
    for (const m of matches(text, new RegExp(`${START}${escape(part)}${END}`, flags))) {
      if (ambiguousCommonWord(text, m.start, part)) continue;
      add({ type: "PATIENT", start: m.start, end: m.end, confidence: 0.8, field: "name" });
    }
  }

  // Someone else with the patient's surname is someone else: "Dr. Chen" is the clinician,
  // "Suman Chen" a relative. PERSON is still masked, but never restored as the patient's name.
  const own = new Set(parts.map((p) => p.toLowerCase()));
  for (const sn of new Set([surname, ...surname.split("-")])) {
    if (sn.length < 2) continue;
    // Same span and source as the titled-surname PATIENT match; the higher confidence wins.
    for (const m of matches(text, new RegExp(`${START}${CLINICIAN_TITLES}\\s+${escape(sn)}${END}`, "giu"))) {
      labels.push({ type: "PERSON", start: m.start, end: m.end, confidence: 0.95, source: "record" });
    }
    // A given name that isn't the patient's makes a longer span than the bare surname, so it wins.
    for (const m of matches(text, new RegExp(`${START}${NAME_WORD}\\s+${escape(sn)}${END}`, "gu"))) {
      const given = m.text.split(/\s+/)[0]!;
      if (own.has(given.toLowerCase()) || NOT_GIVEN.has(given.toLowerCase())) continue;
      if (ambiguousCommonWord(text, m.start, given)) continue;
      labels.push({ type: "PERSON", start: m.start, end: m.end, confidence: 0.85, source: "record" });
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
    // The patient's own ZIP, even with no state in front of it ("moved within 78745").
    const zip = /\b(\d{5})(?:-\d{4})?\s*$/.exec(address)?.[1];
    if (zip) {
      for (const m of matches(text, new RegExp(`\\b${zip}(?:-\\d{4})?\\b`, "g"))) {
        add({ type: "ZIP", start: m.start, end: m.end, confidence: 0.95 });
      }
    }
  }

  for (const re of [DICTIONARY_PERSON, TITLED_PERSON]) {
    for (const m of matches(text, re)) {
      if (ambiguousCommonWord(text, m.start, m.text.split(/\s/)[0]!)) continue;
      labels.push({ type: "PERSON", start: m.start, end: m.end, confidence: 0.7, source: "dictionary" });
    }
  }
  
  labels.push(...contextPersons(text));

  return labels;
}

/** Full PHI detection on one text: record + dictionary + regex patterns, resolved. */
export function detectPhi(text: string, patient: PatientContext, now: Date): PhiLabel[] {
  return resolveLabels([...classifyPhi(text, patient, now), ...findingsToLabels(matchRules(text, PHI_RULES))]);
}
