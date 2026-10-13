# ScrubX architecture

ScrubX sits between a clinician's chat input and an LLM. It catches prompt injection, swaps patient identifiers for tokens before anything leaves the pipeline, checks what the model sends back, and restores the real values at the very end. Every stage records a span, so each request can be inspected step by step.

It is one module of a larger system. The host owns authentication, roles and the API gateway, and hands ScrubX an already-trusted request carrying a `requestId` and a `role`.

![System architecture](./ScrubX.png)

## Request flow

```
POST /api/pipeline { patientId, role, message, history }
  │  zod validation · patient resolved server-side · x-request-id honored
  ▼
Receive ─► InputNormalizer ─┬─► RegexRules ────┐
                            ├─► SemanticScan ──┼─► RiskEngine ─┬─► Block ─────────────────────────────────┐
                            └─► PhiClassifier ─┘               │                                         │
                                                               └─► Tokenizer ─► Retrieval ─► LlmStage    │
                                                                                               │         │
                                                         Rehydrator ◄─ OutputAnalysis ◄────────┘         │
                                                               │                                         │
                                                               └────────────► AuditLogger ◄──────────────┘
  ▲
  └─ NDJSON stream: one span event per stage as it closes, then the PipelineResult
```

| Step (UI) | Stages | What happens |
|---|---|---|
| 1 Receive | `Receive` | Records request ID and role; snapshots the raw input. No auth: the host already did it. |
| 2 Normalize | `InputNormalizer` | NFKC, removes zero-width/bidi/control characters, folds homoglyphs in mixed-script words, strips tags and markdown, decodes entities. Hidden comments are unwrapped, not deleted, so detectors still see them. Case is never changed. |
| 3 Detect | `RegexRules`, `SemanticScan`, `PhiClassifier` (parallel) | Rule packs (PHI shapes, known injections), a heuristic injection scorer with five signal families, and a record-aware PHI classifier. Labels carry type and offsets, never values. |
| 4 Decide | `RiskEngine`, `Block` | `score = max(semantic, noisy-OR of distinct rules)`; any critical rule blocks. Thresholds come from config. PHI is never risk on its own. |
| 5 Tokenize | `Tokenizer` | Typed, numbered tokens (`[PATIENT_1]`, `[DATE_2]`) from a request-scoped vault. Same value, same token. |
| 6 Model | `Retrieval`, `LlmStage`, `OutputAnalysis` | Role-filtered record and client-held history are sanitized like the message (normalize, quarantine instructions, tokenize with the same vault), then sent to the model. The answer is checked: mangled tokens repaired, unknown tokens stripped, raw PHI redacted, ungrounded numbers and medications flagged. |
| 7 Restore | `Rehydrator`, `AuditLogger` | Known tokens swapped back to real values. One PHI-free JSON audit line per request, blocked ones included. |

## Code layout

```
src/core/      framework-free pipeline: no next/react, relative imports only (ESLint-enforced)
  pipeline/    Stage base class, TraceRecorder, Pipeline (run + stream), step summaries
  stages/      one thin class per stage; logic lives in the domain modules below
  text/ rules/ phi/ injection/ tokens/ providers/ data/
src/server/    server-only wiring: env → config → repository + provider + Pipeline
src/lib/       NDJSON helpers, pipeline client, in-memory store, trace-view (pure view logic)
src/app/       Chat View (/), Dev View (/dev), API routes
```

Every stage extends `Stage<I, O>` and implements `process()`. Timing, snapshots, span creation and error capture live in `Stage.run()`. Adding a stage takes one class and one line in `Pipeline`.

## Trust boundaries and PHI handling

- **Host → ScrubX:** the host authenticates the user and vouches for `role`. ScrubX uses `role` for one thing, the field policy in Retrieval. Unknown roles get only the fields every known role shares.
- **Browser → API:** the client sends a `patientId`, never a record. Records are loaded server-side through `PatientRepository`.
- **ScrubX → LLM:** only tokenized text leaves. The record and history are untrusted input too (indirect injection), so they get the same sanitization as the message. A test asserts no record or vault value appears in any prompt, across every demo patient and every adversarial case.
- **LLM → clinician:** the answer is analyzed while still tokenized. Raw PHI there can only be invented or leaked, so it is redacted before restoration.
- **Audit:** counts, rule IDs and timings only. A test asserts no PHI in any audit line.
- **Vault:** private fields; `toJSON` throws and the inspect hook prints a redacted summary.
- **Trace payloads:** snapshots contain PHI. They are on by default only for the synthetic demo source and off for any real source. With payloads off, every panel degrades to metadata, and step captions are built from attributes so they still read correctly.

## Patient data

`PatientRepository` has two implementations behind `PATIENT_SOURCE`:

- **demo:** `data/patients.demo.json`, imported into the bundle, so there is no I/O.
- **supabase:** read-only PostgREST queries with the service-role key. The table (`supabase/migrations/0001_patients.sql`) has row-level security on and no policies, so browsers using the public anon key can read nothing. `npm run db:seed` upserts the same synthetic JSON.

Pages load only the summary list. A full record is fetched by ID when needed, and patient reads sit behind `<Suspense>` so they stream per request and are never cached.

## Observability

1. **In-app trace:** OpenTelemetry-shaped spans (`spanId`, `parentSpanId`, timings, attributes). The three detectors share the normalizer as parent.
2. **Structured log:** one `scrubx.audit` JSON line per request on stdout (Vercel logs). Failures log `scrubx.error` with the request ID; the client only gets a generic message.
3. **Dev View:** stage card with playback gated by real stream events, pipeline graph, inspector with diffs, data lens, risk breakdown, audit line with an in-browser PHI check, timing waterfall, PHI mask.

## Configuration

All variables are optional; the demo runs with none. See `.env.example`.

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `mock` | `mock` or `gemini` |
| `GEMINI_API_KEY` | | Required for `gemini`; server-side only, sent as a header |
| `LLM_MODEL` | `gemini-3.8-flash` | |
| `LLM_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Used for the last retry; `none` disables |
| `MOCK_LATENCY_MS` | `500` | Makes the streamed trace visible with the mock |
| `PATIENT_SOURCE` | `demo` | `demo` (bundled synthetic JSON) or `supabase` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | | Required for `supabase`; server-side only |
| `SCRUBX_TRACE_PAYLOADS` | on for `demo`, off otherwise | An explicit value always wins |
| `RISK_FLAG_THRESHOLD` / `RISK_BLOCK_THRESHOLD` | `0.4` / `0.8` | Flag must be below block |

## Testing

`npm run check` runs typecheck, lint and Vitest. The suites are:

- one file per stage
- end-to-end runs for every demo patient
- a labeled adversarial set: direct, unicode, markup, probe, persona and encoded attacks, plus benign look-alikes
- misbehaving-model scenarios (leaks, invented tokens, ungrounded claims)
- invariants: no PHI in audit lines or prompts, blocked requests never reach the model, round-trip restoration
- golden traces with timings stripped
- API route tests against real `Request` objects

UI changes are also verified by driving the production build in a headless browser.

Decisions and their trade-offs are recorded in [`adr/`](./adr).
