# 16 · A cue word is not part of the name

> `Pharmacist Siobhán O'Connell flagged an interaction` reached the model unchanged, `Yesterday Nurse Tendai` lost the word "Nurse", and `Who is her caregiver` turned "Who" into a person. Now a role or an opening word stays in the text, only the name after it is tokenized, and a question word is never a name.

**Status:** accepted (extends [13](13-find-identifiers-the-detector-was-not-told-about.md) and [14](14-same-surname-is-not-the-patient.md))
**Issue:** [#12](https://github.com/BibeshT-TXST/ScrubX/issues/12)

## The problem

Three bugs in [context.ts](../../src/core/phi/context.ts), all found in live traces. Reproduced against the real pipeline on `b89eab9`:

| Input | Model received | Problem |
|---|---|---|
| `Pharmacist Siobhán O'Connell flagged an interaction.` | unchanged | The full name reaches the model |
| `Yesterday Nurse Tendai called back.` | `[PERSON_1] called back.` | The model no longer knows this person is a nurse |
| `Who is her caregiver now?` | `[PERSON_1] is her caregiver now?` | Broken question |
| Model writes `Who is her caregiver: [PERSON_1].` | Clinician reads `[REDACTED] is her caregiver: Elena Lopez.` | Answer damaged (live trace `req_758ce74c`) |

The causes:
- **Missed name.** The capitalized-pair cue matched `Pharmacist Siobhán O'Connell` as one span and rejected it, because the span opens a sentence and contains a `NOT_NAMES` word. `matchAll` resumed after the rejected span, so `Siobhán O'Connell` was never tried alone. `flagged` was not an action verb either.
- **Swallowed role word.** The action cue's name group took up to three capitalized words, so `Yesterday Nurse Tendai` became the name.
- **"Who".** The action cue `X is her caregiver` accepted any capitalized word as X, and `who` was not in `NOT_NAMES`.

While fixing these we found three more cases of the same bugs:
- `When Tyrone Jackson called` → `[PERSON_1] called`
- `Nurse Tendai Moyo documented the wound` leaked
- With Robert Chen selected, `His nurse Chen called back.` became `His nurse [PATIENT_1]` and was restored as "His nurse Robert Chen", the error [14](14-same-surname-is-not-the-patient.md) fixed for `Dr. Chen`

## What we decided

Six changes, one per fix commit on this branch. Change 1's code and tests are in two commits. Every commit passes the full suite, the typecheck and eslint on its own.

### 1. Question words and pronouns are not names
`who`, `whom`, `whose`, `what`, `which`, `where`, `when`, `why`, `how`, `someone`, `somebody`, `anyone`, `anybody`, `him`, `them`, `me`, `us`, `your` and `its` join `NOT_NAMES`. A span made only of these words is dropped.

- **Why:** these are closed-class words. No name list will ever need them.
- **Source:** the issue's live traces. No outside source.

### 2. A care team role cues the name after it
New `ROLES`: nurse, RN, LPN, NP, PA, aide, pharmacist, therapist, physician, provider, doctor, counselor, social worker, case manager, dietitian, plus hospitalist and caretaker, which we added beyond the issue's list. A role followed by a name labels the name at 0.7, the same way `RELATION` does: `nurse Anjali` → `nurse [PERSON_1]`.

The cue matches roles **only as written in the list**: `nurse`, `RN`, `case manager`. We first matched `Nurse` too. In the precision run (below) that tokenized 12 Title Case phrases, and 3 of them would have been redacted from model answers: `Your Nurse [REDACTED]`, `Pharmacist [REDACTED]: hold NSAIDs`. A capitalized role is usually part of a phrase like `Nurse Visit` or `Pharmacist Consult`. Capitalized roles are handled by change 4 instead.

- **Why:** a role is a cue for the person after it. The i2b2 2014 guidelines treat all staff as one name category: "DOCTOR is used as an umbrella term for all hospital staff, including nurses, pharmacists, receptionists, and so on." PhysioNet `deid` keeps a list of "titles that precede last names" that includes `NURSE`, `PRACTITIONER` and `CAREGIVER`, plus name prefixes `physician` and `provider`.
- **Sources:** Stubbs & Uzuner 2015; Neamatullah et al. 2008, `deid.pl` v1.1 (`@titles`, `@name_pre`).

### 3. A role before the patient's surname marks a clinician
This extends rule 1 of [14](14-same-surname-is-not-the-patient.md) from `Dr` to roles. A role followed by the patient's surname labels **the surname** PERSON at 0.95, source `record`. That is the same span as the bare-surname PATIENT match (0.8), so PERSON wins on confidence. The role word stays in the text, and restore puts back "Chen", not "Robert Chen". Role words also join `NOT_GIVEN`, so `Therapist Chen` isn't read as a given name plus the surname.

- **Why:** without it, change 4 would have broken `Nurse Chen called back.` Before, the action cue masked the whole span as PERSON. With the role cut off, the span is just `Chen`, which ties with PATIENT on length and loses to it on source.
- **Sources:** as in [14](14-same-surname-is-not-the-patient.md) (Dehghan et al. 2015; Yang & Garibaldi 2015; Xu et al. 2012).

### 4. The name starts after the role and after the words that open the span
Before labeling, `contextPersons` moves the start of each cue's span:
- **past the last role inside it, in any case.** `Yesterday Nurse Tendai` → `Tendai`. A two-word role can start before the span, as in `Social Worker Amara Okoye`, so the role is searched for in the text up to the span's end.
- **past the `NOT_NAMES` words that open it.** `When Tyrone Jackson` → `Tyrone Jackson`.

A `NOT_NAMES` word further into the span stays. `RELATIONS` are in `NOT_NAMES`, and "Son" is also a name: cutting at any `NOT_NAMES` word would have stopped tokenizing `Minh Son said…`. The pair cue skips the second step and keeps [13](13-find-identifiers-the-detector-was-not-told-about.md)'s rule that a pair containing a `NOT_NAMES` word is not a name. Without that, `The Joint Commission requires…` and `The Beers Criteria flag…` became new tokens.

- **Why:** de-identification standards mark the name, not the title before it. The i2b2 2014 guidelines: "Titles (Dr., Mr., Ms., etc.) do not have to be annotated" and "Information such as 'M.D.', 'R.N.' do not have to be annotated". `deid` marks the word after a title, not the title. Keeping the role also keeps clinical meaning: the model knows `[PERSON_1]` is a nurse. Xiao et al. found name-dependent gaps in de-identification. Losing `Minh Son` would be one of those.
- **Sources:** Stubbs & Uzuner 2015; Neamatullah et al. 2008; Xiao et al. 2023.

### 5. A rejected pair is retried from its next word
The cue loop now uses `exec` instead of `matchAll`. If every word of a rejected pair after the first is fine, and the first word isn't in `NOT_NAMES`, the search restarts one word later. This catches `Yesterday Siobhán O'Connell rang…` and `on Monday Siobhán O'Connell rang…`. A `NOT_NAMES` first word still rules the pair out, so `The Joint Commission` stays plain.

- **Why:** `matchAll` can't be steered. MDN: it copies the regex, so "changing `lastIndex` while iterating over `matchAll` does not affect the iteration", and `exec()` is for when "you need to manually adjust `lastIndex`".
- **Source:** MDN, `RegExp.prototype.exec()`.

### 6. Note verbs count only with an object
New `NOTE_ACTION`: `flagged`, `noted`, `recommended`, `refilled`, `prescribed` or `documented`, followed by an object word (`a`, `an`, `the`, `that`, `this`, `her`, `his`, `their`). A capitalized pair followed by one may open a sentence. It stays at the pair's 0.45.

The issue asked for these verbs in `ACTION`. We measured that first. It tokenized 16 findings and orders at 0.7 (`Edema noted`, `Metformin refilled`, `Blood Pressure noted`), and 2 of them would have been redacted from answers. Notes use these verbs without a subject: `Edema noted in both ankles` means the edema *was* noted. The verbs only say someone did something when an object follows, as in `flagged an interaction`. Requiring two capitalized words keeps out one-word subjects like `Ultrasound noted a cyst`. The pair's `CLINICAL` check keeps out `Physical Therapy recommended a walker`.

- **Source:** our precision run. We found no published study of this construction that we could read and cite.

## How it plays out in ScrubX

```
in   Pharmacist Siobhán O'Connell flagged an interaction.   out  Pharmacist [PERSON_1] flagged an interaction.
in   Yesterday Nurse Tendai called back.                    out  Yesterday Nurse [PERSON_1] called back.
in   Who is her caregiver now?                              out  Who is her caregiver now?
model  Who is her caregiver: [PERSON_1].                    clinician reads  Who is her caregiver: Elena Lopez.
in   His neighbor Tyrone Jackson and nurse Anjali checked on him.   out  His neighbor [PERSON_1] and nurse [PERSON_2] checked on him.
in   Nurse Chen called back.   (Robert Chen selected)       out  Nurse [PERSON_1] called back.
in   Edema noted in both ankles.                            out  (unchanged)
```

`nurse Anjali` was the lone-first-name leak in [13](13-find-identifiers-the-detector-was-not-told-about.md)'s end-to-end prompt.

How we checked it:
- **Full suite:** 322 pass (315 before, plus 7 new). Golden traces and the invariant test are unchanged. Each fix test fails against the source before its fix. The guard tests (`Minh Son`, `The Joint Commission`, `Edema noted`) pass on both, by design.
- **End to end:** the four rows of the problem table, plus `Referred by Dr. Chen.`, `Suman Chen will drive him home.`, `Nurse Chen called back.`, `Therapist Chen said…`, `His nurse Chen called back.` and `Robert Chen and Mr. Chen`, all with Robert Chen selected. The clinician and relative are PERSON, and the patient stays PATIENT.
- **Precision:** [13](13-find-identifiers-the-detector-was-not-told-about.md)'s 24 sentences are not in the repository, so we couldn't rerun them. Instead we ran the detector over:
  - the 20 benign adversarial cases
  - the 8 demo patient notes
  - 64 sentences written around the new cue words: findings and orders before note verbs, Title Case role phrases, question words, capitalized pairs at sentence start, services before note verbs, model answer lines, and the two added roles

  PERSON hits went from 11 to 9. Five false hits are gone (`Who` ×3, `How`, `Physician Assistant`), and three are new (see trade-offs). The repository texts have no new hits.
- **Recall:** 27 planted names. Before, 11 were tokenized with the cue word left in the text. Now 25 are.

## Where it lives

- [src/core/phi/context.ts](../../src/core/phi/context.ts): `NOT_NAMES` additions, `ROLES`, `ROLE_CUE`, `ROLE`, `ROLE_WORDS`, `NOTE_ACTION`, `afterRole`, `afterNotNames`, and the retry in `contextPersons`
- [src/core/phi/classify.ts](../../src/core/phi/classify.ts): a role before the patient's surname, and role words in `NOT_GIVEN`
- [tests/stages/Tokenizer.test.ts](../../tests/stages/Tokenizer.test.ts): what the model receives for changes 1, 4, 5 and 6
- [tests/pipeline/Pipeline.test.ts](../../tests/pipeline/Pipeline.test.ts): the `req_758ce74c` answer, end to end

## Trade-offs

- **Changes 2 and 3 have no unit tests yet.** They were checked end to end (above) and by the precision and recall runs. They still need cases in [Tokenizer.test.ts](../../tests/stages/Tokenizer.test.ts) and [PhiClassifier.test.ts](../../tests/stages/PhiClassifier.test.ts): `nurse Anjali`, `Nurse Visit`, `Nurse Chen`, and restoring `His nurse Lopez`.
- **A lowercase role before a Title Case word.** `The caretaker Program covers meals.` tokenizes `Program` at 0.7, which also redacts it from an answer. It was the one 0.7 hit in the precision run, and it came from a sentence written to probe the added roles.
- **A capitalized role before a lone name.** `She spoke with Nurse Tendai today.` still leaks `Tendai`, as before. Matching `Nurse` costs more Title Case phrases than it catches (change 2). Two names (`Nurse Tendai Moyo`), a lowercase role, or an action verb are all caught.
- **A lone name before a note verb.** `Tendai noted that…` still leaks. A single capitalized word at the start of a sentence looks the same as `Ultrasound noted a…`. This is [13](13-find-identifiers-the-detector-was-not-told-about.md)'s open lone-first-name gap.
- **A note verb with no object word after it.** `Siobhán O'Connell prescribed amoxicillin.` at the start of a sentence still leaks.
- **Brand and company names shaped like a name.** `Today Lantus Solostar was refilled.` and `Express Scripts refilled her metformin.` are now tokenized at 0.45. Mid-sentence they already were ([13](13-find-identifiers-the-detector-was-not-told-about.md)). Both are below the output check's bar, so answers only change in strict mode.
- **An opening word can be masked with the name.** In `Yesterday Siobhán O'Connell flagged an interaction.`, the note verb confirms there is a name but not where it starts, so `Yesterday` is masked too. This errs toward masking, as the action cue already does.
- **Not changed (outside #12):**
  - [tests/leakage.ts](../../tests/leakage.test.ts) was not picked up by Vitest, which only runs `*.test.ts` ([18](18-an-honest-evaluation-set.md) renamed it). Run under a test name, it passes before and after this change (44 pass, 3 expected failures).

## Sources

- Stubbs A, Uzuner Ö. [*Annotating longitudinal clinical narratives for de-identification: the 2014 i2b2/UTHealth corpus*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170/). J Biomed Inform 58(S), 2015. doi:10.1016/j.jbi.2015.07.020. Changes 2 and 4.
- Neamatullah I, et al. [*Automated de-identification of free-text medical records*](https://pmc.ncbi.nlm.nih.gov/articles/PMC2526997/). BMC Med Inform Decis Mak 8:32, 2008, and the [`deid.pl` v1.1 source](https://physionet.org/files/deid/1.1/deid.pl) (`@titles`, `@name_pre`). Changes 2 and 4.
- Xiao Y, Lim S, Pollard TJ, Ghassemi M. [*In the Name of Fairness: Assessing the Bias in Clinical Record De-identification*](https://arxiv.org/abs/2305.11348v2). FAccT 2023. Change 4.
- MDN Web Docs, [`RegExp.prototype.exec()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec). Change 5.
- Sources of change 3 as listed in [14](14-same-surname-is-not-the-patient.md).
