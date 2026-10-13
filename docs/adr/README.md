# Architecture decision records

One file per decision: the context, what was decided, and what it costs. New decisions get the next number; superseded ones stay and link forward.

| # | Decision |
|---|---|
| [0001](0001-framework-free-core.md) | Framework-free core with a Stage base class |
| [0002](0002-typed-request-scoped-tokens.md) | Typed, request-scoped tokens with record-canonical values |
| [0003](0003-risk-scoring.md) | Risk score is the stronger detector, and critical rules block |
| [0004](0004-sanitize-everything-bound-for-the-model.md) | Sanitize everything bound for the model, not just the message |
| [0005](0005-trace-payloads-follow-the-data.md) | Trace payloads follow the data source |
| [0006](0006-stateless-server-client-held-history.md) | Stateless server, client-held history, in-memory client state |
| [0007](0007-patient-resolved-server-side.md) | Patients are resolved server-side; the core never fetches |
| [0008](0008-gemini-over-rest.md) | Gemini over REST with retries and a fallback model |
