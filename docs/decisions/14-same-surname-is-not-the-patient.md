# 14 · Someone with the patient's surname is not the patient

> "Dr. Chen" and "Suman Chen" used to become `[PATIENT_1]` because they share the patient's surname. Now a clinician title or a different given name marks the mention as another person: still masked as `[PERSON_n]`, never restored as the patient's name.

**Status:** accepted (extends [02](02-typed-request-scoped-tokens.md) and [13](13-find-identifiers-the-detector-was-not-told-about.md))
**Branch:** `fix/same-surname-not-patient`

## The problem

Every standalone occurrence of a patient name part was labeled PATIENT, and so was any title followed by the surname (`Dr|Mr|Mrs|Ms|Miss|Mx`). We ran the detector with Robert Chen (`pt-007`) selected:

| Sent by the clinician | Detected | Sent to the model | Restored in the answer |
|---|---|---|---|
| `Referred by Dr. Chen.` | PATIENT `Dr. Chen` | `Referred by [PATIENT_1].` | `Referred by Robert Chen.` |
| `Suman Chen will drive him home.` | PATIENT `Chen` | `Suman [PATIENT_1] will drive…` | `Suman Robert Chen will drive…` |
| `Pt's brother Suman Chen is the caregiver.` | PERSON `Suman Chen` | `[PERSON_1]` | correct |

Three things go wrong:

1. **The model merges people.** The doctor and the brother become the patient, and an answer about "who drives him home" or "who referred him" is wrong. That is a clinical-safety bug, not only a privacy one.
2. **Restore puts the patient's name in the wrong place.** [tokenize.ts](../../src/core/tokens/tokenize.ts) stores any label with `field: "name"` under the record's spelling, so `[PATIENT_1]` always comes back as "Robert Chen".
3. **A given name leaks.** With no cue word around it, `Suman` matched nothing and reached the model in the clear.

The causes, in [classify.ts](../../src/core/phi/classify.ts):
- `titledSurname` treats `Dr` like `Mr`. It ties with `TITLED_PERSON` on span length, and [labels.ts](../../src/core/phi/labels.ts) breaks ties in favor of the record, so PATIENT wins.
- The name-part loop labels the bare surname PATIENT. Only the context cues from [13](13-find-identifiers-the-detector-was-not-told-about.md) ("brother …", "… said") could produce a longer PERSON span to beat it, and a sentence that opens with the name has none.

## What we decided

Two rules, appended to `classifyPhi`. No existing rule, type, ranking or test changes. Both emit PERSON without `field`, so restore puts back the text as written.

### 1. A clinician title before the surname is a clinician
`Dr`, `Drs` or `Doctor` followed by the patient's surname (or one part of a hyphenated surname) is labeled PERSON at confidence 0.95, source `record`. It has the same span and source as the titled-surname PATIENT match at 0.9, so it wins on confidence. `Mr`, `Mrs`, `Ms`, `Miss` and `Mx` stay PATIENT.

- **Why:** the published systems that had to choose between DOCTOR and PATIENT for the same span chose DOCTOR when a clinician cue was present. Both i2b2 de-identification guidelines keep doctors and patients in separate name categories, and the top i2b2 2014 system used "Dr." and "MD" as DOCTOR triggers. Mr/Mrs/Ms are the opposite: an i2b2/VA coreference system used them as patient cues, so we leave them alone. The record has no sex field, so a gender check on Mrs/Ms isn't possible either.
- **Sources:**
  - Dehghan et al. 2015, Manchester's i2b2 2014 system: "A frequent example were confusions between Doctor and Patient … Doctor was 'preferred' over Patient … multiple categories assigned to a span were sorted by priority and the one with the highest priority was chosen."
  - Yang & Garibaldi 2015, ranked first in i2b2 2014: "trigger words that indicate the occurrence of a particular PHI category, e.g., 'Dr.', 'MD' for DOCTOR". They also report the confusion we hit: "17 PATIENT names are wrongly identified as DOCTOR whereas 8 DOCTOR names are labeled as PATIENT."
  - Xu et al. 2012, the top system for persons in the i2b2/VA 2011 coreference challenge: "Preceded by non-patient (e.g., 'Dr XXX')" is a feature of their patient classifier (F = 0.996), with "Mr, mrs, ms, miss" as patient cues, and "coreference only occurs between mentions with the same attribute" (patient, relative, hospital personnel).
  - Uzuner, Luo & Szolovits 2007 (i2b2 2006) and Stubbs & Uzuner 2015 (i2b2 2014): separate PATIENT and DOCTOR categories. "DOCTOR is used as an umbrella term for all hospital staff."
  - Neamatullah et al. 2008, PhysioNet `deid`: the source treats words after `Dr`, `DRS` and `Mrs` as names ("strict titles").

### 2. A different given name before the surname is a different person
A capitalized word plus the patient's surname is labeled as one PERSON span at confidence 0.85, unless the first word is:
- one of the patient's own name parts (`Robert Chen`)
- a title, a cue word, or a verb that can start a note (`Ms`, `Patient`, `Pt`, `Called`, `Per`…): the new `NOT_GIVEN` set, which reuses `NOT_NAMES` and `CLINICAL` from [context.ts](../../src/core/phi/context.ts)
- a common-word name that reads as an ordinary word (`Will Chen need insulin?`), via the existing `ambiguousCommonWord`

The span is longer than the bare surname, so it wins the existing longest-span-first resolution.

- **Why:** precise coreference systems never link two names on a shared head word alone. A mention can't add a proper noun the other one lacks. "Suman Chen" fails that test against "Robert Chen". Older scrubbers resolve overlapping detectors the same way: the match with more parts wins.
- **Sources:**
  - Raghunathan et al. 2010, multi-pass sieve: head match needs "word inclusion" (91% pairwise precision for the strict pass).
  - Lee et al. 2013: "all the non-stop words in the current entity … are included in the set of non-stop words in the antecedent entity", and "the modifiers of two mentions cannot contain … other proper nouns."
  - Sweeney 1996, Scrub: "The more constituents an entity has, the higher its precedence."
  - Norgeot et al. 2020, Philter: "patient family member names frequently appear within notes."

### Privacy does not go down
Both rules change the type of a span that is already masked. The new span equals or contains the old one, so nothing is unmasked. Rule 2 also masks the given name that used to leak. Relatives still must be masked: Safe Harbor covers identifiers "of the individual or of relatives, employers, or household members" ([45 CFR 164.514(b)(2)(i)](https://www.law.cornell.edu/cfr/text/45/164.514)). The i2b2 2014 organizers note that a patient/doctor type swap doesn't affect removal: "a system that incorrectly identifies patient names as doctor names will still successfully remove the identified names" (Stubbs, Kotfila & Uzuner 2015). For ScrubX the type matters for a different reason, because it decides what restore puts back.

## How it plays out in ScrubX

With Robert Chen selected:

```
in   Referred by Dr. Chen.                      out  Referred by [PERSON_1].                         restored  Referred by Dr. Chen.
in   Suman Chen will drive him home.            out  [PERSON_1] will drive him home.                 restored  Suman Chen will drive him home.
in   Robert Chen and Mr. Chen and Mrs. Chen     out  [PATIENT_1] and [PATIENT_1] and [PATIENT_1]     (unchanged)
in   Will Chen need insulin?                    out  Will [PATIENT_1] need insulin?                  (unchanged)
```

How we checked it:
- **Full suite:** 279 pass (274 before, plus 5 new). Golden traces, the invariant test and the leakage test are unchanged.
- **Kept as before:** `Ms Lopez`, `Mrs. Chen`, `Patient Lopez`, `Pt Lopez`, `Called Lopez`, `Dr. Maria Lopez` (full-name match), and `Daughter Elena Lopez and Dr. Smith`.

## Where it lives

- [src/core/phi/classify.ts](../../src/core/phi/classify.ts): `NOT_GIVEN` and the two same-surname rules
- [src/core/phi/dictionaries.ts](../../src/core/phi/dictionaries.ts): `CLINICIAN_TITLES`
- [src/core/phi/context.ts](../../src/core/phi/context.ts): `NOT_NAMES` and `CLINICAL` exported for reuse
- [tests/stages/PhiClassifier.test.ts](../../tests/stages/PhiClassifier.test.ts), [tests/stages/Tokenizer.test.ts](../../tests/stages/Tokenizer.test.ts): same-surname cases and the restore round-trip

## Trade-offs

- **A patient who is a physician.** If the chart calls the patient "Dr. Chen", it becomes PERSON. It stays masked, but the model sees a separate person. Philter tells annotators to mark an unclear name as the patient's. We accept the opposite here because for ScrubX the label decides what restore puts back, and the wrong patient name in an answer is the worse error.
- **Nicknames.** "Bob Chen" for Robert Chen becomes PERSON. Still masked.
- **Not covered:** a middle initial (`Suman K. Chen`), a lowercase given name (`suman chen`), and a relation word right before a bare surname or title (`daughter Chen`, `Mrs. Chen (wife)`). These stay PATIENT.
- **i2b2 2006 files relatives under PATIENT.** We use PERSON, as ScrubX already did for `Daughter Elena Lopez`, because our PATIENT token is tied to the record name.
- **No published system evaluates same-surname cases directly.** Rule 2 comes from general-domain coreference, not from a clinical evaluation.

## Sources

- Dehghan A, et al. [*Combining knowledge- and data-driven methods for de-identification of clinical narratives*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4976126/). J Biomed Inform, 2015. doi:10.1016/j.jbi.2015.06.029. Change 1.
- Yang H, Garibaldi JM. [*Automatic detection of protected health information from clinic narratives*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989090/). J Biomed Inform, 2015. doi:10.1016/j.jbi.2015.06.015. Change 1.
- Xu Y, et al. [*A classification approach to coreference in discharge summaries: 2011 i2b2 challenge*](https://pmc.ncbi.nlm.nih.gov/articles/PMC3422828/). JAMIA 19(5):897–905, 2012. Change 1.
- Uzuner Ö, Luo Y, Szolovits P. [*Evaluating the state-of-the-art in automatic de-identification*](https://pmc.ncbi.nlm.nih.gov/articles/PMC1975792/). JAMIA 14(5), 2007. doi:10.1197/jamia.M2444. Change 1.
- Stubbs A, Uzuner Ö. [*Annotating longitudinal clinical narratives for de-identification: the 2014 i2b2/UTHealth corpus*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170/). J Biomed Inform 58(S), 2015. doi:10.1016/j.jbi.2015.07.020. Change 1.
- Stubbs A, Kotfila C, Uzuner Ö. [*Automated systems for the de-identification of longitudinal clinical narratives: Overview of 2014 i2b2/UTHealth shared task Track 1*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989908/). J Biomed Inform 58(S), 2015. doi:10.1016/j.jbi.2015.06.007. Privacy section.
- Neamatullah I, et al. [*Automated de-identification of free-text medical records*](https://pmc.ncbi.nlm.nih.gov/articles/PMC2526997/). BMC Med Inform Decis Mak 8:32, 2008, and the [`deid.pl` v1.1 source](https://physionet.org/files/deid/1.1/deid.pl). Change 1.
- Raghunathan K, et al. [*A multi-pass sieve for coreference resolution*](https://aclanthology.org/D10-1048.pdf). EMNLP 2010. Change 2.
- Lee H, et al. [*Deterministic coreference resolution based on entity-centric, precision-ranked rules*](https://aclanthology.org/J13-4004.pdf). Computational Linguistics 39(4), 2013. Change 2.
- Sweeney L. [*Replacing personally-identifying information in medical records, the Scrub system*](https://dataprivacylab.org/projects/scrub/paper1.pdf). Proc AMIA Annu Fall Symp, 1996:333–337. Change 2.
- Norgeot B, et al. [*Protected Health Information filter (Philter)*](https://pmc.ncbi.nlm.nih.gov/articles/PMC7156708/). npj Digital Medicine 3:57, 2020. Change 2 and trade-offs.
- U.S. Code of Federal Regulations, [45 CFR § 164.514(b)(2)](https://www.law.cornell.edu/cfr/text/45/164.514). Privacy section.
