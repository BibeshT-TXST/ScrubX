# 0005 · Trace payloads follow the data source

**Status:** accepted (revised in Phase 3)

**Context.** Trace snapshots contain PHI by design, so the Dev View can show transformations. Defaulting them off left a zero-config demo deploy with an empty Dev View.

**Decision.** When `SCRUBX_TRACE_PAYLOADS` is unset, payloads are on for `PATIENT_SOURCE=demo` (synthetic data) and off for any other source. An explicit value always wins. `TraceRecorder` strips snapshots when payloads are off, step captions are built from span attributes, and every panel degrades to metadata.

**Consequences.** The demo works with no configuration, and a real data source is safe by default. Anyone enabling payloads on real data is making an explicit choice.
