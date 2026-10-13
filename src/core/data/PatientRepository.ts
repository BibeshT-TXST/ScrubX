import type { PatientContext, PatientSummary } from "../types";

/** Read-only patient source. Demo fixtures now, Supabase later, same interface. */
export interface PatientRepository {
  list(): Promise<PatientSummary[]>;
  get(id: string): Promise<PatientContext | null>;
}
