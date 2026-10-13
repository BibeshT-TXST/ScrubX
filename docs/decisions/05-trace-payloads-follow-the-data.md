# 05 · Trace payloads follow the data source

> The Security Division shows the actual text at each stage only when the patients are synthetic. Point it at real patients and the trace drops to counts and captions automatically.

**Status:** accepted

## The problem

Trace snapshots contain PHI by design. They exist to show what happened to the data ("Maria Lopez" → `[PATIENT_1]`). Turning them off by default left a zero-configuration demo with an empty Security Division. Turning them on by default would put real PHI into every trace the moment someone connected a real database.

## What we decided

- When `SCRUBX_TRACE_PAYLOADS` is unset, payloads are **on** for `PATIENT_SOURCE=demo` (synthetic) and **off** for any other source. An explicit value always wins.
- `TraceRecorder` strips every input/output snapshot when payloads are off, in one place, so no stage can forget to.
- Step captions are built from span attributes (counts and IDs), never from payloads, so they still read correctly with payloads off.
- Every Security Division panel has a metadata-only fallback.

## How it plays out in ScrubX

With payloads off, the Tokenizer span for "Patient Maria Lopez, age 58." keeps only:

```
caption     Patient details are swapped for 2 tokens (1 patient, 1 age).
attributes  { tokens: 2, mentions: 2, PATIENT: 1, AGE: 1 }
input/output  (stripped)
```

The Model step's record scrub view ([12](12-show-the-record-scrub.md)) shows "Payload snapshots are off" in place of the two record versions, but still says "1 instruction quarantined · Withheld for this role: Address".

## Where it lives

- [src/core/config.ts](../../src/core/config.ts): the default (`tracePayloads`) and its override
- [src/core/pipeline/TraceRecorder.ts](../../src/core/pipeline/TraceRecorder.ts): strips snapshots when off
- [src/core/pipeline/steps.ts](../../src/core/pipeline/steps.ts): captions from attributes only
- [src/lib/trace-view.ts](../../src/lib/trace-view.ts): the "payload snapshots are off" fallback for each step body

## Trade-offs

The demo works with no configuration, and a real data source is safe by default. Enabling payloads on real data has to be an explicit choice.
