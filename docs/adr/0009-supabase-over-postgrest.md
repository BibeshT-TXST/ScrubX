# 0009 · Supabase over PostgREST, read-only, deny-all RLS

**Status:** accepted

**Context.** Phase 5 swaps the bundled demo patients for a Postgres source without changing the pipeline, and the service key must never reach a browser.

**Decision.** `SupabasePatientRepository` implements the existing `PatientRepository` interface over Supabase's PostgREST API with plain `fetch` (no SDK, same as the Gemini provider). It only issues `GET`s, authenticates with the service-role key, validates every row with zod, and has a 10-second timeout. The migration enables row-level security with no policies and revokes table access from `anon` and `authenticated`, so the only reader is the server's service role. A separate script (`npm run db:seed`) upserts the synthetic demo JSON. The app never writes.

The Chat page loads only the summary list (one query). Full records load on demand through `/api/patients/[id]`, so there are no N+1 queries. Pages read patients inside `<Suspense>`, never `use cache`, so patient data streams per request and never lands in a shared cache. Trace payloads default off for this source (see [0005](0005-trace-payloads-follow-the-data.md)).

**Consequences.** `PATIENT_SOURCE=supabase` is a config change. The build makes no database calls (`/` and `/dev` become partial prerenders). Real patient data would also require a HIPAA-eligible Supabase plan and a BAA, which is outside this module.
