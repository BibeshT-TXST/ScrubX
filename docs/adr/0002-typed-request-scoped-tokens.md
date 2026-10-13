# 0002 · Typed, request-scoped tokens with record-canonical values

**Status:** accepted

**Context.** The model must reason about the text ("[PATIENT_1] is 58") without seeing identifiers, and the answer must be restorable. The site animation shows `MARIA LOPEZ` becoming `Maria Lopez`.

**Decision.** Identifiers become typed, numbered tokens (`[PATIENT_1]`, `[DATE_2]`) from a vault that lives for one request. Same value → same token; phones, MRNs and SSNs are keyed by digits. Record-matched spans store the record's spelling, so `MARIA LOPEZ`, `Ms. Lopez` and `Maria` all become `[PATIENT_1]` and restore to `Maria Lopez`. Letter case in the message is never changed. Conditions stay in plain text. Per-type policy is `tokenize | keep | bucket` (ages in decades, 90+ per Safe Harbor).

**Consequences.** Consistent references for the model, and text in record spelling round-trips exactly. Partial mentions restore to the full name. The vault never serializes; the Dev View's token map is a payload-gated snapshot.
