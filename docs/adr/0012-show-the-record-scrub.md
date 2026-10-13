# 0012 · Show how the record is scrubbed; keep the audit line out of the UI

**Status:** accepted (extends 0004 and 0005)

**Context.** The record is sanitized like the message: it is role-filtered, normalized, its instructions are quarantined and it is tokenized (ADR 0004). But the trace only kept the result. The Security Division showed a before/after for the message and only a count for the record, which is the part most exposed to indirect injection. The bottom of the page also showed a timing waterfall that repeated the per-stage durations, and the raw audit line. The audit line is a log record. It belongs in the log store, not on a screen.

**Decision.**
- `Retrieval` snapshots its input: the role-filtered record as stored, plus the client-held history. Withheld fields (the address) are never in it. `Stage.snapshotInput` now receives the `StageContext`, because the role decides which fields that is.
- The Model step shows the record twice, side by side: as stored, with markup and hidden characters marked, and as sent, with tokens and quarantined sentences marked. It also lists the withheld fields by name. The inspector's word diff groups one-character glue into the change (`readableDiff`), so a quarantined sentence reads as one replacement.
- `AuditLogger` no longer snapshots the audit event. The line goes to the log sink only. The span keeps its caption and attributes (decision, rule IDs, token count), so the trace still shows that it was written.
- The audit and timing panels are removed. Risk sits under the pipeline graph, which is shorter to make room.

**Consequences.** Like every snapshot, the record snapshot follows the data (ADR 0005). It is recorded for the synthetic demo source and stripped by `TraceRecorder` for any real source, where the view falls back to "payload snapshots are off" and the counts. Golden traces gained the Retrieval input and lost the AuditLogger output.
