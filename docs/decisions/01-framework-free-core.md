# 01 · Framework-free core with a Stage base class

> The whole pipeline is plain TypeScript that any host can import, and every stage reports what it did the same way, so nothing it does to the data goes unrecorded.

**Status:** accepted

## The problem

ScrubX is one module in a larger hospital system. The host might call it over HTTP or import it directly into its own backend, which may not run Next.js. The Security Division also needs to show every stage the same way: how long it took, what went in, what came out, and why. If each stage timed and logged itself, one forgotten line would be a blind spot in the audit trail.

## What we decided

- All pipeline logic lives in `src/core`, with no `next`, `react` or `@/` imports. ESLint fails the build if one appears.
- Every stage extends `Stage<I, O>` and implements only `process()`. The base class `run()` owns timing, input/output snapshots, span creation and error capture.
- Stages are thin. The real logic sits in domain modules (`text/`, `rules/`, `phi/`, `injection/`, `tokens/`), so Retrieval and OutputAnalysis reuse the same detectors as the message path.

## How it plays out in ScrubX

`Retrieval` contains no timing or logging code. It returns the scrubbed record from `process()` and declares two snapshot hooks. `Stage.run()` turns that into the span the Security Division draws: `Retrieval · Ran · 0.76 ms`, with the record as stored and as sent. When the model is down, `Stage.run()` records the error on the `LlmStage` span before rethrowing, so a failed request still has a complete trace.

Adding a stage takes one class and one line in `Pipeline`.

## Where it lives

- [src/core/pipeline/Stage.ts](../../src/core/pipeline/Stage.ts): the base class and `run()`
- [src/core/pipeline/Pipeline.ts](../../src/core/pipeline/Pipeline.ts): stage order, and the fan-out of the three detectors
- [src/core/stages/](../../src/core/stages): one thin class per stage
- [src/core/index.ts](../../src/core/index.ts): the public surface the host imports
- [eslint.config.mjs](../../eslint.config.mjs): the `src/core/**` import ban

## Trade-offs

The host imports `src/core` as-is, with no framework to drag along. Relative imports inside the core are noisier than aliases.
