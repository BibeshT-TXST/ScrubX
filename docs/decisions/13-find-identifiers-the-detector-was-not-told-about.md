# 13 · Find identifiers the detector wasn't told about, and test against values the test knows

> "The model never sees an identifier" used to be tested only against identifiers ScrubX already knew. Now the detector finds names, dates and numbers by shape and context in any script, and the test plants its own identifiers, so a miss fails the build.

**Status:** accepted (extends [02](02-typed-request-scoped-tokens.md) and [04](04-sanitize-everything-bound-for-the-model.md))
**Branch:** `fix/id-slip-past-invariant-test`

## The problem

A review found identifiers reaching the model unchanged. We reproduced every one against the real pipeline:

| Sent by the clinician | What the model received |
|---|---|
| `maria said her chest hurts.` / `MARIA said…` / `lopez reports…` | unchanged |
| `March 14`, `14 March 2026`, `03-14-2026`, `2026/04/01`, `9 Feb 1968` | unchanged |
| `5125550147`, `SSN 123456789`, `ZIP 78745` | unchanged |
| `Tyrone Jackson`, `Anjali`, `Suman Thapa` | unchanged |
| `José is better` (patient José Núñez), `Elena Núñez`, `Kevin O'Neil` | unchanged |
| `Dr. Nguyễn` | `[PERSON_1]ễn`, part of the name leaked |
| employer, town, insurance ID, portal URL | unchanged |

The causes:

1. **Name parts were case-sensitive.** The rule that keeps "marsh trail" from becoming Will Marsh applied to every name part, so `maria`, `MARIA` and `lopez` went through.
2. **`\b` and `[A-Z][a-z]+` are ASCII-only in JavaScript.** `é` is not a word character, so `\bJosé\b` never matches, and `[A-Z][a-z]+` can't match Núñez or Nguyễn. Non-Western names were hit hardest.
3. **People outside a 120-name dictionary were invisible.** Other people were only found as a dictionary first name plus a capitalized word, or after a title.
4. **Each rule knew one format.** Dates needed `m/d/y`, zero-padded ISO or `Month d, yyyy`. Phones and SSNs needed separators. A ZIP was only found after a state code.
5. **Towns, employers, account numbers and URLs had no type at all.**

The invariant test couldn't notice any of this. Its list of values to look for was the record fields plus the vault, and the vault holds what the detector already found. It also checked name parts case-sensitively and the DOB only in ISO form, the same blind spots as the detector. With prompts containing `maria`, `Tyrone Jackson` or `born 9 Feb 1968`, it passed.

## What we decided

Each change, why we made it, and where the reasoning came from.

### 1. Unicode-aware name matching
New [patterns.ts](../../src/core/phi/patterns.ts) holds `START`/`END` lookarounds over `\p{L}\p{M}\p{N}` in place of `\b`, and a `NAME_WORD` built from `\p{Lu}`/`\p{Ll}` that covers Núñez, Nguyễn, O'Neil, McDonald and Smith-Jones. Every name pattern now uses the `u` flag.

- **Why:** JavaScript's `\b` only treats `A–Z a–z 0–9 _` as word characters, even with the `u` flag. `\p{…}` property escapes match letters in any script, but only in Unicode-aware mode.
- **Sources:** MDN, [word boundary assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion) and [Unicode character class escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape).

One subtlety: under `iu`, `\p{Lu}` also matches lowercase letters. Context patterns that depend on the capital spell their cue words with `anyCase("son")` → `[Ss]on` instead of using `i`.

### 2. Patient name parts in any case
In [classify.ts](../../src/core/phi/classify.ts), a name part matches case-insensitively unless it is in `COMMON_WORD_NAMES`. Hyphenated surnames also count part by part. The full name also matches across `-`, `_` and `.` (`maria-lopez` in a URL, `maria_lopez` in a handle).

- **Why:** the "will"/"marsh" exception from [02](02-typed-request-scoped-tokens.md) is about ordinary words. It never needed to cover `maria`.
- **Source:** the code review finding. No outside source.

### 3. People found by context, not by a name list
New [context.ts](../../src/core/phi/context.ts) labels a person when:
- a relation word comes first: `her neighbor Tyrone Jackson`
- an action comes after: `Tyrone Jackson brought her in`, `Suman Thapa is her caregiver`
- (at lower confidence) two or three capitalized words appear mid-sentence and none of them is a clinical word, month or pronoun

Labels from this file carry a new `source: "context"`, ranked below the dictionary.

- **Why:** a bigger dictionary is still a dictionary. Xiao et al. tested nine de-identification methods on names varied by race, gender and popularity and found statistically significant gaps along most of those lines. Context cues work for any name.
- **Sources:** Xiao, Lim, Pollard & Ghassemi, [*In the Name of Fairness: Assessing the Bias in Clinical Record De-identification*](https://arxiv.org/abs/2305.11348v2), FAccT 2023.
- **Alternatives considered:**
  - Philter's allowlist removes every word not known to be safe. It reached 99.5% recall at about 78% precision ([Norgeot et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7156708/)). That much over-redaction would cost answer quality.
  - An NER model ([Presidio](https://python.langchain.com/docs/guides/privacy/presidio_data_anonymization/multi_language) on spaCy or transformers) would put a model outside the plain-TypeScript core ([01](01-framework-free-core.md)).

  Either can come later behind the same label.

### 4. More date, phone, SSN and ZIP formats
In [phi.rules.ts](../../src/core/rules/phi.rules.ts):
- **Dates:** day-first dates (`14 March 2026`, `14th of March`), dates without a year (`March 14`), all-caps months, `m-d-yyyy`, `m.d.yyyy`, `d/m/yyyy`, and year-first dates with `/` or `.`.
- **Phones:** with or without separators, and with a leading `+1`.
- **SSNs:** any separator after an SSN label.
- **ZIPs:** after a `zip` label. [classify.ts](../../src/core/phi/classify.ts) also matches the patient's own ZIP anywhere.

- **Why:** Safe Harbor covers "all elements of dates (except year)" and geographic units smaller than a state, including ZIP codes. We tokenize day-level dates. Month and year (`March 2026`) and a bare month (`in March`) stay in plain text, because they carry clinical timing and collide with the names April, May and June.
- **Source:** [45 CFR 164.514(b)(2)(i)(B)–(C)](https://www.law.cornell.edu/cfr/text/45/164.514).

### 5. New types: LOCATION, ORG, ID, URL
- **New PHI types:** `LOCATION`, `ORG`, `ID` and `URL` join `PHI_TYPES`.
- **New rules:**
  - towns after "lives in", "moved to", "town of", or "works … in"
  - employers after "works at", "employed by", or "Employer:"
  - account, plan and license numbers after their label, or by shape (capitals with 5+ digits, or 9+ digits in a row)
  - every `http(s)://` or `www.` address
- **No other code changes needed:** `TOKEN_PATTERN`, token repair and the trace UI all read `PHI_TYPES`.

- **Why:** Safe Harbor lists these identifiers "of the individual or of relatives, employers, or household members": towns (B), health plan beneficiary numbers (I), account numbers (J), certificate and license numbers (K), URLs (N) and "any other unique identifying number" (R). Typed tokens like `[ORG_1]` keep the model's sentence readable, where `[REDACTED]` would not ([02](02-typed-request-scoped-tokens.md)).
- **Source:** [45 CFR 164.514(b)(2)(i)](https://www.law.cornell.edu/cfr/text/45/164.514).

[OutputAnalysis.ts](../../src/core/stages/OutputAnalysis.ts) leaves `URL` labels out of the leak check. Links in an answer keep their existing policy, removed in strict mode, instead of every link suddenly being redacted.

### 6. The tests know the answer independently
- **[invariants.test.ts](../../tests/invariants.test.ts) builds its oracle from the record alone:**
  - name parts in any case, except the common-word ones
  - the DOB in six written forms
  - the phone as bare digits

  Each patient also gets messages in those forms. Vault values are an extra check, no longer the source of truth.
- **New [leakage.test.ts](../../tests/leakage.test.ts) plants identifiers and lists them.** Its first names are deliberately not in `FIRST_NAMES`, so the test doesn't share the detector's dictionary. Synthetic patients José Núñez and Aisha O'Brien-Okafor cover non-ASCII and punctuated record names.
- **Known gaps are `it.fails` cases.** They stay visible, and the suite fails the moment one starts passing, so whoever fixes a gap has to move it into the main list.

- **Why:** a test whose expected values come from the code under test can't find what that code misses. De-identification is measured against a gold standard of identifiers someone placed and knows about. We used the same approach on a small scale.
- **Sources:**
  - Stubbs & Uzuner, [the i2b2/UTHealth 2014 de-identification corpus](https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170)
  - Xiao et al. (above), who recommend diverse names in evaluation
  - Vitest, [`test.fails`](https://vitest.dev/api/#test-fails)

## How it plays out in ScrubX

```
in   Her neighbor Tyrone Jackson brought her in.        out  Her neighbor [PERSON_1] brought her in.
in   She works at H-E-B in Kyle, member ID XYZ123456789  out  She works at [ORG_1] in [LOCATION_1], member ID [ID_1]
in   maria said her chest hurts. SSN 123456789          out  [PATIENT_1] said her chest hurts. SSN [SSN_1]
in   Seen March 14, follow-up 14 March 2026.            out  Seen [DATE_1], follow-up [DATE_2].
in   Portal: https://portal.example.org/patients/maria-lopez/chart   out  Portal: [URL_1]
```

Will Marsh still works as before: "He **will** return" and "the **marsh** trail" stay plain words.

How we checked it:
- **Planted cases before the fix:** 29 of 30 leaked.
- **Full suite after the fix:** 318 pass, plus 3 expected failures for the known gaps. Golden traces are unchanged.
- **New invariant test against the old detector:** fails for all 8 demo patients.
- **Precision check:** 24 ordinary clinical sentences went through with two hits, `Lantus Solostar` and a cdc.gov link (see trade-offs).

## Where it lives

- [src/core/phi/patterns.ts](../../src/core/phi/patterns.ts): Unicode-aware edges, `NAME_WORD`, `PLACE`, `anyCase`
- [src/core/phi/context.ts](../../src/core/phi/context.ts): people found by relation and action cues
- [src/core/phi/classify.ts](../../src/core/phi/classify.ts): any-case name parts, punctuation-joined names, the patient's own ZIP
- [src/core/rules/phi.rules.ts](../../src/core/rules/phi.rules.ts): date, phone, SSN, ZIP, URL, ID, ORG and LOCATION rules
- [src/core/types.ts](../../src/core/types.ts) and [src/core/phi/labels.ts](../../src/core/phi/labels.ts): the four new types and the `context` source
- [src/core/stages/OutputAnalysis.ts](../../src/core/stages/OutputAnalysis.ts): links in answers keep the link policy
- [tests/invariants.test.ts](../../tests/invariants.test.ts), [tests/leakage.test.ts](../../tests/leakage.test.ts): the record-derived oracle and the planted identifiers

## Trade-offs

- **Over-redaction from the capitalized-pair cue.** A Title Case brand name or eponym mid-sentence (`Lantus Solostar`, `History of Hodgkin Lymphoma`) is tokenized as a person, and the model loses the term. These labels sit at 0.45 confidence, so model answers are only redacted for them in strict mode.
- **Every URL is tokenized,** including public ones like cdc.gov. The model can't browse, so it loses little.
- **ZIPs are tokenized in full.** Safe Harbor allows keeping the first three digits where that area has more than 20,000 people. The `bucket` policy could do that later.
- **Lowercase common-word names still pass,** on purpose (`will`, `marsh`, `grace`).
- **Still open, tracked by `it.fails`:** a name with no cue (`Anjali from the pharmacy called`), a lone first name (`Ama stopped by`), a town with no cue (`the Kyle clinic`). Closing these needs the allowlist or NER approach.
- **Out of scope, noted:** in normal mode a model can write a URL with a token in it (`https://x/?q=[PATIENT_1]`), and restore puts the real name into it.

## Result: one prompt, before and after

We also checked the fix end to end in the app. One prompt packs every identifier from the review together with the words that must stay plain. We sent it with Will Marsh selected and read what reached the model in the trace's Model step.

```
will marsh said his chest hurts, so marsh may skip warfarin tonight. He was seen March 14, again on 14 March 2026, then 03-14-2026; recheck 2026/04/01. His daughter called from 5125550147. SSN 123456789, ZIP 78602. His neighbor Tyrone Jackson and nurse Anjali checked on him. He works at Hays High School in Kyle. Insurance ID BCBS-88812345, portal https://mychart.example.org/u/will.marsh1949. He will return in two weeks. Will the INR stay near 2.4 on warfarin 5 mg? May we keep the dose? He walks the marsh trail daily. Any concerns?
```

| Identifier | Count | Before (`25e04ca`) | After |
|---|---|---|---|
| Full name in lowercase (`will marsh`) | 1 | caught | caught, `[PATIENT_1]` |
| Surname alone in lowercase (`marsh`) | 1 | leaked | leaked, on purpose (common-word name) |
| Dates in four formats | 4 | leaked | caught, `[DATE_1]`–`[DATE_4]` |
| Phone, SSN, ZIP without separators | 3 | leaked | caught, `[PHONE_1]` `[SSN_1]` `[ZIP_1]` |
| `Tyrone Jackson` | 1 | leaked | caught, `[PERSON_1]` |
| `Anjali` | 1 | leaked | leaked, known gap (lone first name) |
| Employer, town, insurance ID, URL | 4 | leaked | caught, `[ORG_1]` `[LOCATION_1]` `[ID_1]` `[URL_1]` |
| **Total** | **16** | **1 caught** | **14 caught** |

The second half of the prompt reached the model exactly as written. `will`, `Will`, `May`, `marsh trail`, `2.4` and `5 mg` stayed plain text, so the new rules didn't eat clinical words or numbers. The risk engine allowed the request, so the new detectors didn't raise false injection alarms. Restore put the patient's name back into the answer with one replacement.

The two leaks match the trade-offs above. `marsh` passes on purpose, and `Anjali` is the lone-first-name case already tracked by `it.fails`.

## Sources

- U.S. Code of Federal Regulations, [45 CFR § 164.514(b)(2): HIPAA Safe Harbor de-identification](https://www.law.cornell.edu/cfr/text/45/164.514). Changes 4 and 5.
- Xiao, Lim, Pollard & Ghassemi, [*In the Name of Fairness: Assessing the Bias in Clinical Record De-identification*](https://arxiv.org/abs/2305.11348v2), FAccT 2023. Changes 3 and 6.
- Norgeot et al., [*Protected Health Information filter (Philter)*](https://pmc.ncbi.nlm.nih.gov/articles/PMC7156708/), npj Digital Medicine, 2020. The alternative considered in change 3.
- Stubbs & Uzuner, [*Annotating longitudinal clinical narratives for de-identification: the 2014 i2b2/UTHealth corpus*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4978170), J Biomed Inform, 2015. Change 6.
- MDN, [word boundary assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion) and [Unicode character class escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape). Change 1.
- [Presidio data anonymization guide](https://python.langchain.com/docs/guides/privacy/presidio_data_anonymization/multi_language) (LangChain). The NER alternative in change 3.
- Vitest, [`test.fails`](https://vitest.dev/api/#test-fails). Change 6.
