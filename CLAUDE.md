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
  pipeline/       Stage base class, TraceRecorder, Pipeline orchestrator, trace/event types
  stages/         one class per stage (Phase 1)
  rules/          regex rule packs as data (Phase 1)
  providers/      LLMProvider + Mock / OpenRouter (Phase 1 / 4)
  data/           PatientRepository + DemoPatientRepository
  config.ts       zod-validated env → ScrubXConfig
  schemas.ts      zod schemas for the host boundary; types are inferred from these
  types.ts        domain types (PHI labels, findings, decisions, audit, results)
src/app/          Next.js App Router (Chat View `/`, Dev View `/dev`, API routes)
src/components/   ui/ (shadcn), chat/, dev/
data/             patients.demo.json: synthetic only
tests/            mirrors src/core; adversarial/ and fixtures/ for golden runs
```

## Architecture rules (non-negotiable)

- **`src/core` is framework-free.** No `next`, `react` or `@/` imports inside it; use relative imports. ESLint enforces this. The host must be able to import `core/` as-is.
- **Every stage extends `Stage<I, O>`** and implements `process()`. Timing, snapshots, span creation and error capture live in `Stage.run()`. Never re-implement them in a stage. Adding a stage = one class + one line in `Pipeline`.
- **Zod at the boundary, types inferred.** Host input and env are validated once with zod. Don't hand-write a type that duplicates a schema.
- **PHI never leaves via side channels.** Audit events hold counts and IDs only, never values or raw text, and a test enforces it. The token vault is request-scoped, never serialized, never logged, never sent to the client.
- **Trace payloads are opt-in.** `SCRUBX_TRACE_PAYLOADS` defaults to `false`; only the demo turns it on. `TraceRecorder` strips snapshots when it's off.
- **Unknown roles get the most restrictive field policy.**
- **Synthetic data only**, in fixtures and in tests. No real patient data, ever.
- **Stateless.** No filesystem writes, no module-level mutable state across requests. Route handlers run on the Node.js runtime.
- Captions shown in the UI are generated from trace data, never hardcoded per request.

## Code style

- TypeScript `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- Keep it lean: no speculative abstractions, no dead code, no comments that restate the code. Comment the *why* when it isn't obvious (security choices, HIPAA reasoning, ordering constraints).
- Prefer pure functions and dependency injection (clock, provider, repository) so stages test deterministically.
- Rules and thresholds are data/config, not branches in code.
- Every stage gets its own test file in `tests/`. Bug fixes come with a test.

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
- [ ] Phase 1: Core pipeline, no UI
- [ ] Phase 2: API + Chat View
- [ ] Phase 3: Dev View
- [ ] Phase 4: Real model + polish
- [ ] Phase 5: Supabase

Update this list in the same commit that completes a phase.
