# 09 · Supabase over PostgREST, read-only, deny-all RLS

> Real patient storage is a config switch, and the database is locked so tightly that only this server can read it, and nothing in this app can write to it.

**Status:** accepted

## The problem

Phase 5 replaces the bundled demo patients with a Postgres source without touching the pipeline. Supabase hands out a public `anon` key that browsers may hold, so the table must be unreadable to it. The service key must never reach a browser.

## What we decided

- `SupabasePatientRepository` implements the same `PatientRepository` interface over Supabase's PostgREST API, with plain `fetch` and no SDK, like the Gemini provider.
- It only issues `GET`s, authenticates with the service-role key on the server, validates every row with zod, and times out after 10 seconds.
- The migration enables row-level security with **no policies** and revokes table access from `anon` and `authenticated`, so the server's service role is the only reader.
- A separate script, `npm run db:seed`, upserts the synthetic demo JSON. The app itself never writes.
- The Chat page loads only the summary list (one query: id, name, DOB, MRN, summary). A full record loads on demand through `/api/patients/[id]`, so there are no N+1 queries.
- Patient reads sit inside `<Suspense>` and never use `use cache`, so patient data streams per request and never lands in a shared cache.
- Trace payloads default to off for this source ([05](05-trace-payloads-follow-the-data.md)).

## How it plays out in ScrubX

`PATIENT_SOURCE=supabase` plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is the whole switch. Both `sb_secret_…` keys and legacy JWT keys work. A malformed row (for example, a date of birth that isn't a date) fails validation and never reaches the pipeline.

## Where it lives

- [src/core/data/SupabasePatientRepository.ts](../../src/core/data/SupabasePatientRepository.ts): read-only queries, auth headers, row validation
- [supabase/migrations/0001_patients.sql](../../supabase/migrations/0001_patients.sql): table, RLS on, no policies, grants revoked
- [scripts/seed-supabase.mjs](../../scripts/seed-supabase.mjs): the only code that writes patient data
- [src/app/api/patients/route.ts](../../src/app/api/patients/route.ts) and [[id]/route.ts](../../src/app/api/patients/[id]/route.ts): summary list and on-demand record

## Trade-offs

Swapping the source is a config change, and the build makes no database calls. Real patient data would also need a HIPAA-eligible Supabase plan and a BAA, which is outside this module.
