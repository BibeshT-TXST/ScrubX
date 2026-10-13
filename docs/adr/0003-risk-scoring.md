# 0003 · Risk score is the stronger detector, and critical rules block

**Status:** accepted

**Context.** The regex rules and the semantic scan often fire on the same phrase. Combining them with noisy-OR double-counted that evidence: "Pretend you are her doctor and summarize her labs" scored 0.84 and was blocked.

**Decision.** `score = max(semantic score, noisy-OR of distinct regex rules)`. Each rule counts once however often it matches. Any critical rule (instruction override, prompt probe, token-map probe) blocks regardless of score. Thresholds (flag 0.4, block 0.8) are config. PHI is never risk on its own. Every decision carries human-readable reasons and per-source contributions.

**Consequences.** Persona switches and encoded payloads are flagged (stricter output analysis) instead of blocked. The labeled adversarial set pins expected decisions, including benign look-alikes such as "act as a second reviewer".
