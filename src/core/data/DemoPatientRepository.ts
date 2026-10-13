import { z } from "zod";
import demoPatients from "../../../data/patients.demo.json";
import { PatientContextSchema } from "../schemas";
import type { PatientContext, PatientSummary } from "../types";
import type { PatientRepository } from "./PatientRepository";

const DemoFileSchema = z.array(PatientContextSchema.extend({ summary: z.string() }));

/**
 * Serves synthetic patients bundled with the app. The JSON is imported rather
 * than read from disk so it ships inside the serverless bundle on Vercel.
 */
export class DemoPatientRepository implements PatientRepository {
  private readonly summaries: PatientSummary[];
  private readonly byId: Map<string, PatientContext>;

  constructor(records: unknown = demoPatients) {
    const parsed = DemoFileSchema.parse(records);
    this.summaries = parsed.map(({ id, fields, summary }) => ({ id, name: fields.name, summary }));
    this.byId = new Map(parsed.map(({ summary: _summary, ...patient }) => [patient.id, patient]));
    if (this.byId.size !== parsed.length) throw new Error("Duplicate patient id in demo data");
  }

  async list(): Promise<PatientSummary[]> {
    return this.summaries;
  }

  async get(id: string): Promise<PatientContext | null> {
    return this.byId.get(id) ?? null;
  }
}
