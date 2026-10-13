# 0010 · One role, always a real model, observation-only Security Division

**Status:** accepted (revises the UI parts of earlier phases)

**Context.** Product review asked for:
- a single clinical role instead of physician / nurse / front desk
- no mock model in the product
- a visible "couldn't connect" state on every chat when no model answers
- the developer view repositioned as a strictly observational screen for a security team

**Decision.**
- **Roles.** `KNOWN_ROLES = ["medical_practitioner"]`, which gets every clinical field but never the address. The fallback for unknown roles is pinned to name and date of birth. It used to be derived as "fields every known role shares", which with one role would grant everything.
- **Model.** The app always wires `GeminiProvider`. Without a key it wires `UnavailableProvider`, which fails like a down model. `Pipeline` treats any LLM failure as the `unavailable` outcome: the LLM span keeps the error, OutputAnalysis and Rehydrator are skipped, the audit line is written, and the response is a fixed "we couldn't connect" message. The mock moved to `tests/support/` as a test double.
- **UI.**
  - Chat is a patient list, then two halves: the patient's record and the conversation.
  - The Dev View is renamed the Security Division (`/security`). It cannot send requests. It shows patient tabs and each patient's chat log, and opens any request's trace. The data lens is removed; the graph and inspector cover it.
  - Loading states show the current step and elapsed time while waiting on the model.

**Consequences.** The app is honest about outages: a missing key no longer fails the build, it shows up in every chat. The Security Division can only observe what was asked in the same browser session, because the server stays stateless (ADR 0006). A shared, cross-user view would need a server-side trace store.
