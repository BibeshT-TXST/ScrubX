# 18 · Measure on rows nobody tuned on, and publish the first score

> Detection quality was judged by hand, on cases written by the person who wrote the rules. Now `npm run eval` scores the real pipeline against labeled sets, refuses to run until the rows are committed, and says in its own report whether the detectors have changed since.

**Status:** accepted
**Issue:** [#14](https://github.com/BibeshT-TXST/ScrubX/issues/14)

## The problem

Every number we had came from cases tuned against the detector, and some could not be rerun:

- [tests/leakage.test.ts](../../tests/leakage.test.ts) was named `tests/leakage.ts`, so Vitest never ran it.
- The 24 sentences behind [13](13-find-identifiers-the-detector-was-not-told-about.md)'s precision check and the 64 behind [16](16-a-cue-word-is-not-part-of-the-name.md)'s were never committed.
- `tests/adversarial/cases.ts` holds 37 cases that all pass, because each was added alongside the rule that handles it.

A rule could help or just move the misses around, and nothing would show which. The aim here is numbers that are honest. They don't have to be impressive or perfect.

## What we decided

### 1. The first score can't be recovered, so the code protects it
The first run on untouched detectors is the only score no tuning can have influenced. `--freeze` records the rows' hashes and the git tree of `src/core`. Scoring refuses to run until the rows and hashes are committed, so `git log` shows the rows came first. After that the report compares trees and labels itself: "untuned scores" or "development scores".

### 2. Someone else writes the rows
The rows come from a chat with no access to this repo, working from [AUTHORING_PROMPT.md](../../eval/AUTHORING_PROMPT.md). The author reviews labels against the written rules, doesn't drop rows for being hard, and logs every correction.

A fresh model isn't a truly independent author, and no independent human checked the labels. The report states both.

### 3. Gold comes from the regulation, not the detector
- **Month-year.** [13](13-find-identifiers-the-detector-was-not-told-about.md) leaves `March 2026` visible on purpose, and Safe Harbor covers it. These mentions are gold, marked `monthYear`. The headline counts them, and a second figure leaves them out, so the cost of that choice is visible. Whether 13 should change is a separate decision.
- **Missing rules.** `IP` and `BIOMETRIC` are gold types with no ScrubX label. A missing rule shows up as a miss, not a smaller denominator.
- **Outside the 18 categories.** Clinician names, ages under 90 and facilities are `extended` and reported on their own, so masking them never counts against precision.

### 4. Leak recall leads
A gold value is caught only if every letter and digit is masked, by a label of any type. A partly masked name is a leak. This is not a recognized standard: [Ferrández et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3445850/) and [Carrell et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7647331) are the nearest precedents. The worst group is printed next to it, so high recall on dates can't hide low recall on names.

Rows the risk engine blocks are still scored from their labels. A block produces no prompt, and counting that as "no leak" would flatter the score.

### 5. Gold is a value, not an offset
The normalizer changes string length and keeps no offset map, and every detector reports offsets on normalized text. Rows store the value, and the scorer finds it in the normalized text. Adding an offset map would have changed detector code before the baseline. For our own rows, a value that can't be found stops the run.

### 6. Numbers carry their counts, and the caveats are generated
Every rate prints `k/n` and a 95% Wilson interval. Under 20 items it prints no percentage. The limits (synthetic data, a fixed test, no HIPAA claim) are written by the report generator next to the numbers, so a copy of the table keeps them.

### 7. Attacks in record text get their own numbers
They never reach block/flag/allow, so a block rate would always read 0%. An attack counts as caught only if its own sentence was removed from what the model received.

### 8. External sets, unchanged, as the correction
[ASQ-PHI](https://pmc.ncbi.nlm.nih.gov/articles/PMC12926592/) and [NotInject](https://arxiv.org/abs/2410.22770) are vendored at pinned revisions and reported separately, never pooled. Both are MIT licensed; see [eval/README.md](../../eval/README.md). Rules don't get tuned against them before a first published score.

## The example from this project

The first run of ASQ-PHI on `9f12eaf`, with no detector change, gave leak recall of 50.6%. Sampling the misses found a scorer problem: its gold keeps titles and field words, so `Dr. Robert Miles` counted `Dr` as a leak. Stripping them across every row gave **1527/2975, 51.3% (95% CI 49.5–53.1)**.

Most of the remaining misses are real and were unknown until this run:

| Group | Leak recall | What's being missed |
|---|---|---|
| Names | 305/814, 37.5% | Mostly first name plus initial: `Anna S.`, `Peter M.` |
| Places and employers | 143/828, 17.3% | Mostly facilities: `Methodist Hospital`, `UCSF`. ASQ-PHI counts them, ScrubX doesn't try to mask them |
| Medical record numbers | 104/305, 34.1% | `MRN: HLT-234567` and `MRN: 112-45-789`, even with the label right there |
| Dates | 774/806, 96.0% | |

The authors' published baseline for Amazon Comprehend Medical on the same set reports entity recall of 88.1–98.6%, depending on threshold. The matching rules may differ, so it isn't a like-for-like comparison, but the gap is too large to be only that.

The set also has no patient record, so ScrubX runs without its record lookup. A production request always has one, so this measures what happens to identifiers the record doesn't hold.

## Where it lives

- [eval/run.ts](../../eval/run.ts): the CLI, the freeze and the guards
- [eval/score.ts](../../eval/score.ts): scoring as pure functions
- [eval/harness.ts](../../eval/harness.ts): runs each row through the real `Pipeline` with a provider that only captures the prompt
- [eval/report.ts](../../eval/report.ts): the report and its caveats
- [eval/AUTHORING_PROMPT.md](../../eval/AUTHORING_PROMPT.md): the labeling rules and the plan for the rows
- [scripts/eval-fetch-external.mjs](../../scripts/eval-fetch-external.mjs): downloads and converts the external sets
- [tests/eval/](../../tests/eval/): includes a check that the scorer reproduces the 44 of 47 planted cases

## The trade-off

- **Rows get used up.** Once we tune on these rows they're seen, and a later score on them says nothing about unseen text. Showing a real gain takes a new set written the same way.
- **The intervals are wide.** With about 40 items in a group, even 40 of 40 only supports "at least 91%", and the intervals are optimistic because rows share an author.
- **The guards don't stop someone determined.** They make the honest order the easy one, and the history shows what happened.
- **No CI yet.** The gate that fails on a regression comes right after the first baseline, because it compares against that baseline. Until then #14 stays open.
- **Message path only.** PHI in record text isn't scored here, though `Retrieval` handles it.
- **`jiti` is a new dev dependency.** It was already in the lockfile through other tools. Plain Node 22 can't run `src/core`, and running the CLI inside Vitest would make writing results a side effect of a test.

## Sources

- Weatherhead J, Golovko G, McCaffrey P. [*ASQ-PHI: An adversarial synthetic data benchmark for clinical de-identification and search utility*](https://pmc.ncbi.nlm.nih.gov/articles/PMC12926592/). Data in Brief 65, 112586, 2026, and its [repository](https://github.com/JamesWeatherhead/asq-phi).
- Li H, et al. [*InjecGuard*](https://arxiv.org/abs/2410.22770), 2024.
- Ferrández O, et al. [*Evaluating current automatic de-identification methods with Veteran's health administration clinical documents*](https://pmc.ncbi.nlm.nih.gov/articles/PMC3445850/). BMC Med Res Methodol 12:109, 2012.
- Carrell DS, et al. [*Resilience of clinical text de-identified with "hiding in plain sight" to hostile reidentification attacks by human readers*](https://pmc.ncbi.nlm.nih.gov/articles/PMC7647331). JAMIA 27(9), 2020.
- Stubbs A, Uzuner Ö. [*Annotating longitudinal clinical narratives for de-identification*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170/). J Biomed Inform 58(S), 2015. Boundary rules.
