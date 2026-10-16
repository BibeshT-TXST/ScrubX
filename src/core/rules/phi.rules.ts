import { anyCase, PLACE } from "../phi/patterns";
import type { Rule } from "./types";

const MONTH_NAME =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

// Title case or all caps ("MARCH 14"), never lowercase, so the verb "may" stays a word.
const MONTH = `(?:${MONTH_NAME}|${MONTH_NAME.toUpperCase()})`;
const MM = "(?:0?[1-9]|1[0-2])";
const DD = "(?:0?[1-9]|[12]\\d|3[01])";

// Days that can't be a month, so 14/03/2026 reads as day first.
const DD_ONLY = "(?:1[3-9]|2\\d|3[01])";
const ORDINAL = "(?:st|nd|rd|th)?";

const STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const STREET_SUFFIX = "(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Hwy)";

const words = (list: string) => `(?:${list.split(" ").map(anyCase).join("|")})`;
const WEEKDAY = "(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day";
// A place, but never a month or weekday: "moved in March" is a date, not a town.
const TOWN = `(?!${MONTH_NAME}\\b|${WEEKDAY}\\b)${PLACE}`;
// An organization name: capitalized words, with the punctuation names carry (H-E-B, AT&T, St. David's).
const ORG_WORD = "\\p{Lu}[\\p{L}\\p{M}\\d&'’-]*";
const ORG = `${ORG_WORD}(?:\\s+(?:(?:of|the|and|for|de)\\s+)?${ORG_WORD}){0,4}`;
const WORKS = words("works worked working work employed job retired");
const ID_LABEL =
  "(?:member|subscriber|policy|group|account|acct|insurance|plan|beneficiary|medicaid|medicare|MBI|" +
  "license|licence|certificate|cert|DL|passport|NPI|DEA|ID)";

// Known PHI shapes (HIPAA Safe Harbor identifiers). All `g` so matchAll works;
// `d` where a named group narrows the span.
export const PHI_RULES: readonly Rule[] = [
  { id: "PHI-SSN", category: "phi", severity: "high", phiType: "SSN", confidence: 0.95,
    description: "Social Security number (dashed, or any separator after an SSN label)",
    pattern: /\b\d{3}-\d{2}-\d{4}\b|(?<=\b(?:SSN|SS#|social security(?: number| no\.?| #)?)[\s:#.]*)\d{3}[-\s.]?\d{2}[-\s.]?\d{4}\b/gi },
  { id: "PHI-MRN", category: "phi", severity: "high", phiType: "MRN", confidence: 0.9,
    description: "Medical record number", pattern: /\bMRN[-:#\s]*\d{5,10}\b/gi },
  { id: "PHI-PHONE", category: "phi", severity: "medium", phiType: "PHONE", confidence: 0.85,
    description: "US phone number, with or without separators or +1",
    pattern: /(?<!\d)(?:\+?1[-.\s]?)?(?:\(\d{3}\)\s?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}(?!\d)/g },
  { id: "PHI-EMAIL", category: "phi", severity: "medium", phiType: "EMAIL", confidence: 0.95,
    description: "Email address", pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { id: "PHI-DATE-NUMERIC", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Numeric date (m/d/y, m-d-yyyy, m.d.yyyy, d/m/yyyy)",
    // Dashes and dots need a 4-digit year so dose ranges like "5-10-15" stay numbers.
    pattern: new RegExp(`\\b(?:${MM}\\/${DD}\\/(?:\\d{4}|\\d{2})|${MM}([.-])${DD}\\1\\d{4}|${DD_ONLY}([/.-])${MM}\\2\\d{4})\\b`, "g") },
  { id: "PHI-DATE-ISO", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Year-first date (2026-04-01, 2026/04/01, 2026.4.1)",
    pattern: new RegExp(`\\b(?:19|20)\\d{2}([/.-])${MM}\\1${DD}\\b`, "g") },
  { id: "PHI-DATE-LONG", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Written date, year optional (March 14, Mar 14th, 2026)",
    pattern: new RegExp(`\\b${MONTH}\\.? \\d{1,2}${ORDINAL}\\b(?:,? \\d{4}\\b)?`, "g") },
  { id: "PHI-DATE-DAY-FIRST", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Day-first written date (14 March 2026, 14th of March)",
    pattern: new RegExp(`\\b\\d{1,2}${ORDINAL}(?: of)? ${MONTH}\\b\\.?(?:,? \\d{4}\\b)?`, "g") },
  { id: "PHI-AGE", category: "phi", severity: "low", phiType: "AGE", confidence: 0.8,
    description: "Stated age (58-year-old, 58 yo)",
    pattern: /\b(?<v>\d{1,3})(?:[- ]?(?:years?|yrs?)[- ]old|\s?(?:y\/o|yo))\b/dgi },
  { id: "PHI-AGE-PREFIX", category: "phi", severity: "low", phiType: "AGE", confidence: 0.8,
    description: "Stated age (age 58)", pattern: /\bage[d]?:?\s+(?<v>\d{1,3})\b/dgi },
  { id: "PHI-ADDRESS", category: "phi", severity: "medium", phiType: "ADDRESS", confidence: 0.8,
    description: "Street address",
    pattern: new RegExp(`\\b\\d{1,6}(?: [A-Z][a-z]+){1,3} ${STREET_SUFFIX}\\b\\.?(?: (?:Apt|Unit|Suite|#) ?\\w+)?`, "g") },
  { id: "PHI-CITY-STATE", category: "phi", severity: "low", phiType: "ADDRESS", confidence: 0.6,
    description: "City and state", pattern: new RegExp(`\\b[A-Z][a-z]+(?: [A-Z][a-z]+)?, (?:${STATES})\\b`, "g") },
  { id: "PHI-ZIP", category: "phi", severity: "low", phiType: "ZIP", confidence: 0.4,
    description: "ZIP code", pattern: new RegExp(`(?<=\\b(?:${STATES}) )\\d{5}(?:-\\d{4})?\\b|\\b\\d{5}-\\d{4}\\b`, "g") },
  { id: "PHI-ZIP-LABELED", category: "phi", severity: "low", phiType: "ZIP", confidence: 0.9,
    description: "ZIP code after a ZIP label", pattern: /\bzip(?:\s?code)?[\s:#]*(?<v>\d{5}(?:-\d{4})?)\b/dgi },
  { id: "PHI-URL", category: "phi", severity: "medium", phiType: "URL", confidence: 0.95,
    description: "Web address", pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]*[^\s<>"'`)\].,;:!?]/gi },
  { id: "PHI-ID-LABELED", category: "phi", severity: "medium", phiType: "ID", confidence: 0.9,
    description: "Account, plan, license or certificate number after its label",
    pattern: new RegExp(`\\b${ID_LABEL}(?:\\s+(?:ID|number|no\\.?|#))?[\\s:#.]*(?<v>(?=[A-Z0-9-]*\\d)[A-Z0-9][A-Z0-9-]{4,}[A-Z0-9])\\b`, "dgi") },
  { id: "PHI-ID-SHAPE", category: "phi", severity: "low", phiType: "ID", confidence: 0.6,
    description: "Long identifier: capitals with 5+ digits, or 9+ digits in a row",
    pattern: /\b(?=[A-Z\d]*[A-Z])(?=(?:[A-Z]*\d){5})[A-Z\d]{8,}\b|(?<![\d.])\d{9,}(?![\d.])/g },
  { id: "PHI-ORG-EMPLOYER", category: "phi", severity: "low", phiType: "ORG", confidence: 0.7,
    description: "Employer after 'works at', 'employed by'",
    pattern: new RegExp(`(?<![\\p{L}])${WORKS}\\s+(?:at|for|by|with)\\s+(?:the\\s+)?(?<v>${ORG})`, "dgu") },
  { id: "PHI-ORG-LABELED", category: "phi", severity: "low", phiType: "ORG", confidence: 0.7,
    description: "Employer after an 'employer' label",
    pattern: new RegExp(`(?<![\\p{L}])${words("employer")}(?:\\s+is|\\s*[:-])?\\s*(?<v>${ORG})`, "dgu") },
  { id: "PHI-LOCATION-HOME", category: "phi", severity: "low", phiType: "LOCATION", confidence: 0.7,
    description: "Town after 'lives in', 'moved to', 'born in'",
    pattern: new RegExp(
      `(?<![\\p{L}])${words("lives living lived live moved moving resides residing relocated born grew")}` +
      `(?:\\s+\\p{Ll}+){0,3}?\\s+(?:in|to|near|outside|from)\\s+(?<v>${TOWN})`, "dgu") },
  { id: "PHI-LOCATION-WORK", category: "phi", severity: "low", phiType: "LOCATION", confidence: 0.7,
    description: "Town where someone works ('works at H-E-B in Kyle')",
    pattern: new RegExp(`(?<![\\p{L}])${WORKS}\\b[^.\\n]{0,40}?\\s(?:in|near)\\s+(?<v>${TOWN})`, "dgu") },
  { id: "PHI-LOCATION-NAMED", category: "phi", severity: "low", phiType: "LOCATION", confidence: 0.7,
    description: "Town after 'town of', 'city of'", pattern: new RegExp(`(?<![\\p{L}])${words("town city village county township")}\\s+of\\s+(?<v>${TOWN})`, "dgu") },
];
