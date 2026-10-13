@AGENTS.md

# ScrubX

Secure inference pipeline between a clinician's chat input and an LLM: normalize → detect (regex / semantic / PHI, in parallel) → decide (block | flag | allow) → tokenize PHI → LLM → output analysis → rehydrate. Every stage records a span so the Dev View can show exactly what happened to the data.

This repo is **one module** of a larger project. The host handles auth, roles and the API gateway, and passes `requestId` + `role` in. ScrubX is stateless.

The full build plan lives in `ScrubX-plan.md` at the repo root. It is **gitignored on purpose** (local only). Read it before starting a phase. Its section numbers are referenced below.

## Commands

```bash
npm run dev         # Next dev server
npm test            # Vitest, single run
npm run test:watch
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint (also enforces core/ boundaries)
npm run check       # typecheck + lint + test: run before every phase commit
npm run build       # production build (what Vercel runs)
```

Node >= 22. Next.js 16 / React 19 / Tailwind 4 / shadcn (base-nova) / zod 4 / Vitest 5.

## Layout

```
src/core/         framework-free pipeline. Importable by the host without Next.js
  pipeline/       Stage base, TraceRecorder, Pipeline orchestrator (+ stream), trace/event types
  stages/         one thin class per stage; logic lives in the domain modules below
  text/           normalizeText (NFKC, invisible chars, markup, homoglyphs)
  rules/          regex rule packs as data + matchRules
  phi/            record-aware + dictionary classifier, label resolution, dictionaries
  injection/      InjectionScanner interface + HeuristicScanner
  tokens/         TokenVault (request-scoped, unserializable), tokenize / rehydrate, entity policy
  providers/      LLMProvider, MockProvider, prompt template (OpenRouter in Phase 4)
  data/           PatientRepository + DemoPatientRepository (used at the API boundary)
  config.ts       zod-validated env → ScrubXConfig
  schemas.ts      zod schemas for the host boundary; types are inferred from these
  types.ts        domain types (PHI labels, findings, decisions, audit, results)
src/server/       server-only wiring: env → config → repository + provider + Pipeline (built once)
src/lib/          client/server shared: NDJSON stream helpers, pipeline client, in-memory chat store
src/app/          Next.js App Router: Chat View `/`, Dev View `/dev`, `api/pipeline`, `api/patients[/id]`
src/components/   ui/ (shadcn), chat/, dev/
data/             patients.demo.json: synthetic only
tests/            stages/ (one file per stage), pipeline/, adversarial/ (labeled cases),
                  fixtures/ (golden traces), invariants.test.ts
```

API: `POST /api/pipeline` takes `{ patientId, role?, message, history? }` (zod), resolves the patient server-side and streams NDJSON: one `{type:"span"}` line per stage, then `{type:"result"}`, or `{type:"error"}` with a generic message if the run fails (details go to server logs). Honors a well-formed `x-request-id` from a host gateway.

Stage order: Receive → InputNormalizer → [RegexRules ‖ SemanticScan ‖ PhiClassifier] → RiskEngine → (Block | Tokenizer → Retrieval → LlmStage → OutputAnalysis → Rehydrator) → AuditLogger.

## Architecture rules (non-negotiable)

- **`src/core` is framework-free.** No `next`, `react` or `@/` imports inside it; use relative imports. ESLint enforces this. The host must be able to import `core/` as-is.
- **Every stage extends `Stage<I, O>`** and implements `process()`. Timing, snapshots, span creation and error capture live in `Stage.run()`. Never re-implement them in a stage. Adding a stage = one class + one line in `Pipeline`.
- **Zod at the boundary, types inferred.** Host input and env are validated once with zod. Don't hand-write a type that duplicates a schema.
- **PHI never leaves via side channels.** Audit events hold counts and IDs only, never values or raw text, and a test enforces it. The token vault is request-scoped, never serialized, never logged, never sent to the client.
- **Trace payloads are opt-in.** `SCRUBX_TRACE_PAYLOADS` defaults to `false`; only the demo turns it on. `TraceRecorder` strips snapshots when it's off.
- **Unknown roles get the most restrictive field policy** (the fields every known role shares).
- **The core never fetches patients.** `PipelineRequest.patient` is the record; the API route resolves `patientId` server-side through `PatientRepository`, so the client never sends a record.
- **Everything bound for the LLM is sanitized**, not just the message: Retrieval normalizes the role-filtered record and client-held history, quarantines sentences that carry instructions, and tokenizes them with the same vault.
- **Synthetic data only**, in fixtures and in tests. No real patient data, ever.
- **Stateless.** No filesystem writes, no module-level mutable state across requests (the `scrubx()` singleton is immutable wiring). Route handlers use Next 16's default Node runtime; don't add `runtime = "edge"` (deprecated).
- **Server-only code imports `server-only`** (`src/server/*`), so the repository and pipeline wiring can never be bundled into the client.
- **Client chat state is in memory only** (`src/lib/chat-store.ts`): it survives navigation between Chat and Dev View but not a refresh. No PHI in localStorage or sessionStorage.
- Captions shown in the UI are generated from trace data, never hardcoded per request.

## Code style

- TypeScript `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- Keep it lean: no speculative abstractions, no dead code, no comments that restate the code. Comment the *why* when it isn't obvious (security choices, HIPAA reasoning, ordering constraints).
- Prefer pure functions and dependency injection (clock, provider, repository) so stages test deterministically.
- Rules and thresholds are data/config, not branches in code.
- React effects use block bodies. Returning a value from an effect makes React call it as cleanup (newer browsers return a Promise from `scrollIntoView`).
- Every stage gets its own test file in `tests/stages/`. Bug fixes come with a test.
- Golden traces live in `tests/fixtures/__snapshots__`. A diff there means a stage changed its output: review it, then `npx vitest -u`.
- New attack patterns go into `tests/adversarial/cases.ts` with an expected decision; add benign look-alikes too.

## Version control

- Work happens on a feature branch (currently `feature/implementation`), never directly on `main`.
- **One commit per phase.** Each phase from the plan (§10) lands as a single, detailed commit once `npm run check` and `npm run build` pass. No WIP commits in between unless asked.
- Commit message format:

  ```
  feat(phase-N): <short summary, imperative, ≤ 72 chars>

  <1–2 paragraph overview: what this phase delivers and why>

  Added:
  - <file/area>: <what and why>

  Changed:
  - ...

  Decisions:
  - <non-obvious choices and the trade-off taken>

  Verification:
  - <commands run and their result, e.g. "npm run check: 24 tests passed">

  Follow-ups:
  - <anything deferred to a later phase>
  ```
- Don't push or open PRs unless asked.

## Phase status

- [x] Phase 0: Skeleton (Vercel deploy is done by the user from the dashboard)
- [x] Phase 1: Core pipeline, no UI
- [x] Phase 2: API + Chat View
- [ ] Phase 3: Dev View
- [ ] Phase 4: Real model + polish
- [ ] Phase 5: Supabase

Update this list in the same commit that completes a phase.
