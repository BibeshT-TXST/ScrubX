# 07 · Patients are resolved server-side; the core never fetches

> The browser sends only a patient ID. The record the model is grounded on always comes from the server's own source, so it can't be swapped or tampered with in transit.

**Status:** accepted

## The problem

The original plan had both a `patient` field on the pipeline request and a Retrieval stage that loads patients itself. That leaves two sources of truth. Worse, a client could send a doctored record and have the model reason over it.

## What we decided

- `PipelineRequest.patient` **is** the record. The core only filters it by role and never does I/O for it.
- The API route takes `patientId`, loads the record through `PatientRepository` on the server, and ignores any record in the request body.

## How it plays out in ScrubX

Chat sends `{ "patientId": "pt-001", "message": "…", "history": [...] }`. The route validates it with zod, calls `patients.get("pt-001")`, and hands the record to the pipeline. An unknown ID gets a 404 before anything runs. Swapping the bundled demo data for Supabase ([09](09-supabase-over-postgrest.md)) changed only which repository the server builds.

## Where it lives

- [src/app/api/pipeline/route.ts](../../src/app/api/pipeline/route.ts): validates the body, resolves `patientId`, streams the result
- [src/core/data/PatientRepository.ts](../../src/core/data/PatientRepository.ts): the interface (`list`, `get`)
- [src/core/schemas.ts](../../src/core/schemas.ts): `PipelineRequestSchema`, with the record as a field
- [src/server/scrubx.ts](../../src/server/scrubx.ts): picks the repository from config

## Trade-offs

The browser never sends or alters a record. The core has no I/O besides the LLM provider, so it's easy to test and to host elsewhere.
