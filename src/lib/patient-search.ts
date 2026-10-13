import type { PatientSummary } from "@/core/types";
import { formatDate } from "./clinical-format";

/**
 * Worklist filter: every word of the query must match the name, the MRN (with or
 * without its prefix) or the date of birth (ISO or as displayed, e.g. "03-Nov").
 */
export function matchesPatient(p: PatientSummary, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [p.name, p.mrn, p.mrn.replace(/\D/g, ""), p.dob, formatDate(p.dob)].join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}
