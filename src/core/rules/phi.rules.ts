import type { Rule } from "./types";

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const STREET_SUFFIX = "(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Hwy)";

// Known PHI shapes (HIPAA Safe Harbor identifiers). All `g` so matchAll works;
// `d` where a named group narrows the span.
export const PHI_RULES: readonly Rule[] = [
  { id: "PHI-SSN", category: "phi", severity: "high", phiType: "SSN", confidence: 0.95,
    description: "Social Security number", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { id: "PHI-MRN", category: "phi", severity: "high", phiType: "MRN", confidence: 0.9,
    description: "Medical record number", pattern: /\bMRN[-:#\s]*\d{5,10}\b/gi },
  { id: "PHI-PHONE", category: "phi", severity: "medium", phiType: "PHONE", confidence: 0.85,
    description: "US phone number", pattern: /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g },
  { id: "PHI-EMAIL", category: "phi", severity: "medium", phiType: "EMAIL", confidence: 0.95,
    description: "Email address", pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { id: "PHI-DATE-NUMERIC", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Numeric date (m/d/y)", pattern: /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:\d{4}|\d{2})\b/g },
  { id: "PHI-DATE-ISO", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "ISO date", pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g },
  { id: "PHI-DATE-LONG", category: "phi", severity: "medium", phiType: "DATE", confidence: 0.85,
    description: "Written date", pattern: new RegExp(`\\b${MONTH}\\.? \\d{1,2}(?:st|nd|rd|th)?,? \\d{4}\\b`, "g") },
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
];
