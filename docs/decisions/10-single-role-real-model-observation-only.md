# 10 · One role, always a real model, observation-only Security Division

> What runs in the app is what would run in production: one clinical role with least privilege, a real model (or an honest "couldn't connect"), and a security view that can watch but never act.

**Status:** accepted (revises the UI parts of earlier phases)

## The problem

Product review asked for four changes:
- one clinical role instead of physician, nurse and front desk
- no mock model in the product
- a visible "couldn't connect" state when no model answers
- the developer view turned into a strictly observational screen for a security team

## What we decided

- **Roles.** `KNOWN_ROLES = ["medical_practitioner"]`, which gets every clinical field but never the address. Unknown roles get name and date of birth only. That fallback is pinned explicitly, because deriving it as "fields every known role shares" would, with one role, grant everything.
- **Model.** The app always wires `GeminiProvider`. Without a key it wires `UnavailableProvider`, which fails like a down model. Any LLM failure becomes the `unavailable` outcome: the LLM span keeps the error, OutputAnalysis and Rehydrator are skipped, the audit line is still written, and the reply is a fixed "we couldn't connect" message. The mock lives only in `tests/support/`.
- **Security Division.** `/security` can't send requests. It lists the patients and requests from this browser session and opens any request's trace.

## How it plays out in ScrubX

For the practitioner role, Maria Lopez's record releases name, DOB, MRN, phone, conditions, medications and notes, and withholds her address. The record pane tags it "Not sent to AI". An unknown role such as `contractor` gets two fields: `Name: Maria Lopez` and `DOB: 1968-02-09`. Without a Gemini key, "Summarize Maria's recent visit" still runs every check and ends with "We couldn't connect to the AI model" in Chat, and an LLM span marked Error in the trace.

## Where it lives

- [src/core/stages/Retrieval.ts](../../src/core/stages/Retrieval.ts): `FIELD_POLICY`, `RESTRICTED_FIELDS`, `fieldsForRole()`
- [src/core/types.ts](../../src/core/types.ts): `KNOWN_ROLES`, `DEFAULT_ROLE`
- [src/core/providers/UnavailableProvider.ts](../../src/core/providers/UnavailableProvider.ts) and [src/server/scrubx.ts](../../src/server/scrubx.ts): wiring with and without a key
- [src/core/pipeline/Pipeline.ts](../../src/core/pipeline/Pipeline.ts): the `unavailable` outcome
- [tests/support/MockProvider.ts](../../tests/support/MockProvider.ts): the test double, never imported by the app
- [src/components/security/SecurityView.tsx](../../src/components/security/SecurityView.tsx): read-only, with no request code

## Trade-offs

The app is honest about outages: a missing key doesn't fail the build, it shows up in every chat. The Security Division only sees the requests made in its own browser session, because the server is stateless ([06](06-stateless-server-client-held-history.md)).
