# 02 · Typed, request-scoped tokens with record-canonical values

> The model reasons about `[PATIENT_1]`, never about Maria Lopez. The real name exists only inside one request's vault and comes back in the answer.

**Status:** accepted

## The problem

The model has to understand the question ("is this patient's metformin dose still right?") without ever seeing who the patient is, and the answer has to read naturally once it's back with the clinician. Blank redaction (`[REDACTED]`) breaks both. The model can't tell two people apart, and the answer can't be restored.

## What we decided

- Identifiers become typed, numbered tokens: `[PATIENT_1]`, `[DATE_2]`, `[MRN_1]`, `[PHONE_1]`, `[PERSON_1]`, `[AGE_1]`. Towns, employers, account numbers and URLs became `[LOCATION_1]`, `[ORG_1]`, `[ID_1]` and `[URL_1]` in [13](13-find-identifiers-the-detector-was-not-told-about.md).
- The vault lives for one request, never serializes (`toJSON` throws), and never leaves the server.
- Same value, same token. Phones, MRNs and SSNs are keyed by their digits, so `(512) 555-0142` and `512.555.0142` share one token.
- Values that match the record are stored in the record's spelling. `MARIA LOPEZ`, `Ms. Lopez` and `Maria` all become `[PATIENT_1]` and restore as `Maria Lopez`. The message's letter case is never changed.
- Clinical terms (conditions, drugs, doses) stay in plain text, because the model needs them.
- Each PHI type has a policy: `tokenize`, `keep`, or `bucket`. Ages go into decades, with 90+ grouped per HIPAA Safe Harbor.

## How it plays out in ScrubX

The demo's first request:

```
in   Patient MARIA LOPEZ, age 58, seen 03/14/2026. MRN-100231. Should we adjust metformin?
out  Patient [PATIENT_1], age [AGE_1], seen [DATE_1]. [MRN_1]. Should we adjust metformin?
```

Will Marsh is the trap case, because his name is two common words. "When is Will's next INR check?" becomes `When is [PATIENT_1]'s next INR check?`, while his notes keep "He **will** return in two weeks" and "lives near the **marsh** trail" as plain words. His wife, Grace Marsh, becomes `[PERSON_1]`.

## Where it lives

- [src/core/tokens/TokenVault.ts](../../src/core/tokens/TokenVault.ts): the request-scoped vault (unserializable)
- [src/core/tokens/tokenize.ts](../../src/core/tokens/tokenize.ts): tokenize, rehydrate, `DEFAULT_ENTITY_POLICY`
- [src/core/stages/Tokenizer.ts](../../src/core/stages/Tokenizer.ts) and [Rehydrator.ts](../../src/core/stages/Rehydrator.ts): the two ends of the round trip
- [src/core/phi/classify.ts](../../src/core/phi/classify.ts): the record-aware matching that keeps "will" a verb

## Trade-offs

The model gets consistent references, and record spellings round-trip exactly. A partial mention ("Maria") restores to the full name ("Maria Lopez"). The token map is visible in the Security Division only as a snapshot, under the payload rule in [05](05-trace-payloads-follow-the-data.md).
