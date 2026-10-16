# Decisions

Why ScrubX is built the way it is. One file per decision, each covering:
- the problem
- what was decided
- a real example from this project
- the files where it lives
- the trade-off

New decisions take the next number. A superseded decision stays in place and links forward.

| # | Decision | In one line |
|---|---|---|
| [01](01-framework-free-core.md) | Framework-free core with a Stage base class | Any host can import the pipeline, and no stage can skip the trace |
| [02](02-typed-request-scoped-tokens.md) | Typed, request-scoped tokens | The model sees `[PATIENT_1]`, never Maria Lopez |
| [03](03-risk-scoring.md) | Risk score and critical rules | Known attacks block; clinical wording isn't punished twice |
| [04](04-sanitize-everything-bound-for-the-model.md) | Sanitize everything bound for the model | A poisoned record loses its instruction, and the clinician still gets an answer |
| [05](05-trace-payloads-follow-the-data.md) | Trace payloads follow the data source | Full text for synthetic patients, counts only for real ones |
| [06](06-stateless-server-client-held-history.md) | Stateless server, in-memory client | Nothing with PHI is kept on the server or written to disk |
| [07](07-patient-resolved-server-side.md) | Patients resolved server-side | The browser sends an ID, never a record |
| [08](08-gemini-over-rest.md) | Gemini over REST with retries and a fallback | A busy model means a slower answer, not a failed one |
| [09](09-supabase-over-postgrest.md) | Supabase, read-only, deny-all RLS | Only this server can read patients; the app can't write |
| [10](10-single-role-real-model-observation-only.md) | One role, real model, observation-only security view | What runs is what would run in production |
| [11](11-clinical-ui.md) | Clinical UI rules | The right patient is unmistakable and numbers can't be misread |
| [12](12-show-the-record-scrub.md) | Show the record scrub; audit line stays in the log | You see exactly what the model received |
| [13](13-find-identifiers-the-detector-was-not-told-about.md) | Find identifiers the detector wasn't told about | Names in any case or script, more formats, new types, and a test that plants its own identifiers |
