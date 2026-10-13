# 0007 · Patients are resolved server-side; the core never fetches

**Status:** accepted

**Context.** The plan had both a `patient` field on `PipelineRequest` and a Retrieval stage that loads from `PatientRepository`.

**Decision.** `PipelineRequest.patient` is the record, and the core only filters it. The API route resolves `patientId` through `PatientRepository` on the server and ignores any record in the request body.

**Consequences.** The browser never sends or alters a record. The core has no I/O besides the LLM provider, which keeps it easy to test and to host elsewhere. Swapping demo data for Supabase changes only the repository.
