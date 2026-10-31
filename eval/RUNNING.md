# Running the evaluation

The maintainer's guide. For what the test is and why, start with [the overview](README.md).

## Commands

```bash
npm run eval                  # score everything, print the report
npm run eval -- --external    # score the public sets only
npm run eval -- --validate    # check our rows, run no detector
npm run eval -- --freeze --author "..."   # hash our rows
npm run eval -- --freeze --reason "..."   # re-hash after a change, which the report then prints
npm run eval -- --write       # also write results.json, RESULTS.md, the charts and the CSV
npm run eval -- --charts      # redraw the charts and the CSV from results.json, scoring nothing
npm run eval -- --check       # the CI gate: fail if anything differs from what is committed
npm run eval -- --write --accept "why"   # record a regression on purpose
node scripts/eval-fetch-external.mjs      # re-download the public sets (needs network)
```

## What fails CI

`npm run eval -- --check` runs in [CI](../.github/workflows/ci.yml) and compares every item to the committed `results.json`.

| What happened | CI |
|---|---|
| A missed value, a false label on any row, or a third party labeled as the patient is new | Fails, and lists each item |
| An attack weakened (blocked to flagged to allowed), or a harmless message got stricter | Fails, and lists each item |
| An attack in record text reached the model, or harmless record text was removed | Fails, and lists each item |
| Something got better, or anything else in the results changed | Fails until you run `--write` and commit, so the results stay true |
| `src/core` changed but no score did | Fails until you run `--write`, because the "untuned" label would otherwise be wrong |
| `RESULTS.md`, a chart or the CSV doesn't match `results.json` | Fails. They are generated, so don't edit them |
| The rows don't match the lock | Fails |

`--write` refuses a regression too. To accept one, pass `--accept "why"`, and the items and the reason are printed at the top of `RESULTS.md` from then on.

## Order of work

This is how the rows were written and first scored. Nothing in `src/core` changes until step 6 is committed, because that first score is the only one no tuning can have influenced.

1. Paste `AUTHORING_PROMPT.md` into a chat with no access to this repo. Save the rows as `eval/phi.jsonl` and `eval/injection.jsonl`.
2. `npm run eval -- --validate`. This checks the rows and runs no detector.
3. Read the labels and correct only those that break the written rules. Don't drop a row because it looks hard, and list every correction under "Label corrections" below.
4. `npm run eval -- --freeze --author "who wrote the rows"`.
5. Commit the rows and `dataset.lock.json`. Scoring refuses to run until they are committed, so `git log` proves the rows came before the score.
6. `npm run eval -- --write`, then commit `results.json` and `RESULTS.md`, whatever they say.

## After the first run

- `RESULTS.md` says on its own when `src/core` has changed since the freeze. From then on these rows have been seen, so the report calls the scores development scores, and they say nothing about unseen text.
- Showing a real gain after tuning needs rows nobody has tuned on: write a small new set the same way.
- A change to a label after scoring needs `--reason`, and the reason is printed in the report. Fix labels by rule across all rows, not only on the failures, because fixing failures alone can only raise a score.

## Files

| File | What it is |
|---|---|
| `AUTHORING_PROMPT.md` | The written plan and labeling rules, handed to whoever writes the rows |
| `phi.jsonl`, `injection.jsonl` | Our own labeled sets |
| `dataset.lock.json` | Their hashes, the author, and the detector code they were frozen against |
| `external/` | Public sets, converted and pinned. Converted by `scripts/eval-fetch-external.mjs` |
| `results.json`, `RESULTS.md` | The latest committed run. Generated, never edited |
| `../docs/eval/` | Charts, in light and dark, and `eval-results.csv` for Excel. Generated from `results.json`, never edited |

## Label corrections

Made before the first scored run. Types and scopes did not change.

| Row | Was | Now | Why |
|---|---|---|---|
| `phi-089` | `4471` | `x4471` | The text reads `x4471`, and a gold value has to match a whole token |
| `phi-124` | `2026-10-29` | `2026-10-29T14:32` | The text reads `2026-10-29T14:32`, and a gold value has to match a whole token |
