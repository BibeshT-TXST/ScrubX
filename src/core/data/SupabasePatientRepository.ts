import { z } from "zod";
import type { PatientContext, PatientSummary } from "../types";
import type { PatientRepository } from "./PatientRepository";

export interface SupabaseOptions {
  url: string;
  /**
   * Server-side only. A secret key (sb_secret_…) or the legacy service_role JWT.
   * Bypasses RLS, which denies every other role (see supabase/migrations).
   */
  serviceRoleKey: string;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

const TABLE = "patients";

/**
 * New-style keys (sb_secret_…) are not JWTs and must go in the apikey header only;
 * sent as a Bearer token they fail JWT verification. Legacy JWT keys get both headers.
 */
export function supabaseAuthHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_") ? { apikey: key } : { apikey: key, authorization: `Bearer ${key}` };
}

/** Accepts the project URL with or without the REST path the dashboard also shows ("…/rest/v1/"). */
export function supabaseBaseUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
}

// Rows are validated like any other input: a malformed record never reaches the pipeline.
const RowSchema = z.object({
  id: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  name: z.string().min(1),
  dob: z.iso.date(),
  mrn: z.string().min(1),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  medications: z.array(z.string()).nullable(),
  conditions: z.array(z.string()).nullable(),
});
type Row = z.infer<typeof RowSchema>;

const SummarySchema = RowSchema.pick({ id: true, name: true, summary: true });

function toPatient(row: Row): PatientContext {
  const { id, description, name, dob, mrn, phone, address, medications, conditions } = row;
  return {
    id,
    description,
    fields: {
      name,
      dob,
      mrn,
      ...(phone && { phone }),
      ...(address && { address }),
      ...(medications?.length && { medications }),
      ...(conditions?.length && { conditions }),
    },
  };
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

/**
 * Read-only patient source over Supabase's PostgREST API. Plain fetch, no SDK,
 * and only GET requests: this class cannot write. Same interface as the demo
 * repository, so swapping sources is a config change.
 */
export class SupabasePatientRepository implements PatientRepository {
  private readonly base: string;

  constructor(private readonly opts: SupabaseOptions) {
    this.base = `${supabaseBaseUrl(opts.url)}/rest/v1/${TABLE}`;
  }

  private async query(params: string): Promise<unknown> {
    const res = await (this.opts.fetch ?? fetch)(`${this.base}?${params}`, {
      method: "GET",
      headers: { ...supabaseAuthHeaders(this.opts.serviceRoleKey), accept: "application/json" },
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      // PostgREST errors carry a message but never the key; still, keep it short.
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new RepositoryError(`Supabase query failed (${res.status}): ${body.message ?? res.statusText}`, res.status);
    }
    return res.json();
  }

  async list(): Promise<PatientSummary[]> {
    const rows = await this.query("select=id,name,summary&order=id.asc");
    return z.array(SummarySchema).parse(rows);
  }

  async get(id: string): Promise<PatientContext | null> {
    const rows = z.array(RowSchema).parse(await this.query(`select=*&id=eq.${encodeURIComponent(id)}&limit=1`));
    return rows[0] ? toPatient(rows[0]) : null;
  }
}
