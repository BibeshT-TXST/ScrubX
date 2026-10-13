# 0001 · Framework-free core with a Stage base class

**Status:** accepted

**Context.** ScrubX is one module of a larger system. The host may call it over HTTP or import it directly, and each stage has to be observable in the same way.

**Decision.** All pipeline logic lives in `src/core` with no `next`, `react` or path-alias imports, enforced by ESLint. Every stage extends `Stage<I, O>`, whose `run()` owns timing, snapshots, span creation and error capture; subclasses implement `process()` plus optional snapshot and describe hooks. Pure logic lives in domain modules (`text/`, `rules/`, `phi/`, `injection/`, `tokens/`), so stages stay thin and Retrieval and OutputAnalysis can reuse the detectors.

**Consequences.** The host imports `src/core` as-is. Adding a stage takes one class and one line in `Pipeline`. Relative imports are slightly noisier than aliases.
