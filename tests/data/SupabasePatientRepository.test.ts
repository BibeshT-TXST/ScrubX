import { describe, expect, it } from "vitest";
import {
  RepositoryError,
  supabaseAuthHeaders,
  supabaseBaseUrl,
  SupabasePatientRepository,
} from "@/core/data/SupabasePatientRepository";
import demoPatients from "../../data/patients.demo.json";

// What PostgREST returns for a row of the migration's `patients` table.
const ROW = {
  id: "pt-002",
  summary: "71M, COPD with recent exacerbation",
  description: "James Okafor, 71, has moderate COPD.",
  name: "James Okafor",
  dob: "1955-07-21",
  mrn: "MRN-100458",
  phone: "(512) 555-0177",
  address: null,
  medications: ["tiotropium 18 mcg"],
  conditions: [],
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const repo = (impl: typeof fetch) =>
  new SupabasePatientRepository({ url: "https://abc.supabase.co/", serviceRoleKey: "service-key", fetch: impl });

describe("SupabasePatientRepository", () => {
  it("lists summaries with one read-only query, authenticated server-side", async () => {
    const summary = { id: "pt-002", name: "James Okafor", dob: ROW.dob, mrn: ROW.mrn, summary: ROW.summary };
    const { impl, calls } = fakeFetch(200, [summary]);
    expect(await repo(impl).list()).toEqual([summary]);

    const { url, init } = calls[0]!;
    expect(url).toBe("https://abc.supabase.co/rest/v1/patients?select=id,name,dob,mrn,summary&order=id.asc");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({ apikey: "service-key", authorization: "Bearer service-key" });
  });

  it("sends new secret keys in apikey only, and legacy JWT keys as Bearer too", async () => {
    expect(supabaseAuthHeaders("sb_secret_abc")).toEqual({ apikey: "sb_secret_abc" });
    expect(supabaseAuthHeaders("eyJhbGciOi.legacy.jwt")).toEqual({ apikey: "eyJhbGciOi.legacy.jwt", authorization: "Bearer eyJhbGciOi.legacy.jwt" });

    const { impl, calls } = fakeFetch(200, []);
    await new SupabasePatientRepository({ url: "https://abc.supabase.co", serviceRoleKey: "sb_secret_abc", fetch: impl }).list();
    expect(calls[0]!.init.headers).not.toHaveProperty("authorization");
  });

  it("accepts the project URL with or without the REST path", () => {
    for (const url of ["https://abc.supabase.co", "https://abc.supabase.co/", "https://abc.supabase.co/rest/v1", "https://abc.supabase.co/rest/v1/"]) {
      expect(supabaseBaseUrl(url)).toBe("https://abc.supabase.co");
    }
  });

  it("maps a row to a PatientContext, dropping empty optional fields", async () => {
    const { impl, calls } = fakeFetch(200, [ROW]);
    expect(await repo(impl).get("pt-002")).toEqual({
      id: "pt-002",
      description: ROW.description,
      fields: { name: "James Okafor", dob: "1955-07-21", mrn: "MRN-100458", phone: "(512) 555-0177", medications: ["tiotropium 18 mcg"] },
    });
    expect(calls[0]!.url).toContain("select=*&id=eq.pt-002&limit=1");
  });

  it("returns null for an unknown id and encodes ids into the filter", async () => {
    const { impl, calls } = fakeFetch(200, []);
    expect(await repo(impl).get("x&id=neq.none")).toBeNull();
    expect(calls[0]!.url).toContain("id=eq.x%26id%3Dneq.none&limit=1");
  });

  it("rejects malformed rows instead of passing them to the pipeline", async () => {
    const { impl } = fakeFetch(200, [{ ...ROW, dob: "not a date" }]);
    await expect(repo(impl).get("pt-002")).rejects.toThrow();
  });

  it("surfaces PostgREST errors without the key", async () => {
    const { impl } = fakeFetch(404, { message: 'relation "public.patients" does not exist' });
    const call = repo(impl).list();
    await expect(call).rejects.toThrow(RepositoryError);
    await expect(call).rejects.toThrow('Supabase query failed (404): relation "public.patients" does not exist');
    await expect(call).rejects.not.toThrow(/service-key/);
  });

  it("reads every seeded demo patient back into the same shape the demo repository serves", async () => {
    // Rows exactly as scripts/seed-supabase.mjs writes them.
    const rows = demoPatients.map(({ id, summary, description, fields }) => ({
      id, summary, description, name: fields.name, dob: fields.dob, mrn: fields.mrn,
      phone: fields.phone ?? null, address: "address" in fields ? fields.address : null,
      medications: fields.medications ?? [], conditions: fields.conditions ?? [],
    }));
    for (const [i, row] of rows.entries()) {
      const { impl } = fakeFetch(200, [row]);
      const { summary: _, ...expected } = demoPatients[i]!;
      expect(await repo(impl).get(row.id)).toEqual(expected);
    }
  });
});
