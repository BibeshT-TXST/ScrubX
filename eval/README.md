# Evaluation

`npm run eval` runs labeled sets through the real pipeline and reports what it caught. It runs offline in a few seconds. The reasoning is in [decision 18](../docs/decisions/18-an-honest-evaluation-set.md).

| File | What it is |
|---|---|
| `AUTHORING_PROMPT.md` | The written plan and labeling rules, handed to whoever writes the rows |
| `phi.jsonl`, `injection.jsonl` | Our own labeled sets |
| `dataset.lock.json` | Their hashes, the author, and the detector code they were frozen against |
| `external/` | Public sets, converted and pinned. Converted by `scripts/eval-fetch-external.mjs` |
| `results.json`, `RESULTS.md` | The latest committed run. Generated, never edited |
| `../docs/eval/` | Charts for the README, in light and dark, and `eval-results.csv` for Excel. Generated from `results.json`, never edited |

## Order of work

Nothing in `src/core` changes until step 6 is committed. That first score is the only one no tuning can have influenced.

1. Paste `AUTHORING_PROMPT.md` into a chat with no access to this repo. Save the rows as `eval/phi.jsonl` and `eval/injection.jsonl`.
2. `npm run eval -- --validate`. This checks the rows and runs no detector.
3. Read the labels and correct only those that break the written rules. Don't drop a row because it looks hard, and list every correction under "Label corrections" below.
4. `npm run eval -- --freeze --author "who wrote the rows"`.
5. Commit the rows and `dataset.lock.json`. Scoring refuses to run until they are committed, so `git log` proves the rows came before the score.
6. `npm run eval -- --write`, then commit `results.json` and `RESULTS.md`, whatever they say.

## Commands

```bash
npm run eval                  # score everything, print the report
npm run eval -- --external    # score the public sets only
npm run eval -- --validate    # check our rows, run no detector
npm run eval -- --freeze --author "..."   # hash our rows
npm run eval -- --freeze --reason "..."   # re-hash after a change, which the report then prints
npm run eval -- --write       # also write results.json, RESULTS.md, the charts and the CSV
npm run eval -- --charts      # redraw the charts and the CSV from results.json, scoring nothing
node scripts/eval-fetch-external.mjs      # re-download the public sets (needs network)
```

## After the first run

- `RESULTS.md` says on its own when `src/core` has changed since the freeze. From then on these rows have been seen, so the report calls the scores development scores, and they say nothing about unseen text.
- Showing a real gain after tuning needs rows nobody has tuned on: write a small new set the same way.
- A change to a label after scoring needs `--reason`, and the reason is printed in the report. Fix labels by rule across all rows, not only on the failures, because fixing failures alone can only raise a score.

## External sets

| Set | Rows | Licence | Source |
|---|---|---|---|
| ASQ-PHI | 1,051 | MIT, © 2025 James Weatherhead | [github.com/JamesWeatherhead/asq-phi](https://github.com/JamesWeatherhead/asq-phi), paper: Weatherhead, Golovko & McCaffrey (2026), *Data in Brief* 65, 112586 |
| NotInject | 339 | MIT, © 2024 Hao Li | [huggingface.co/datasets/leolee99/NotInject](https://huggingface.co/datasets/leolee99/NotInject), code: [InjecGuard](https://github.com/SaFoLab-WISC/InjecGuard) |

The MIT notice applies to the files in `external/`, which are converted copies of these sets:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Conversion changes to ASQ-PHI, made to every row:

- Its types are mapped to ours.
- A title or field word in front of a gold value is removed. Scoring "Dr" as a leak was wrong, and it was found after the first run: leak recall moved from 50.6% to 51.3%.
- A month with no day is marked `monthYear`.

## Label corrections

Made before the first scored run. Types and scopes did not change.

| Row | Was | Now | Why |
|---|---|---|---|
| `phi-089` | `4471` | `x4471` | The text reads `x4471`, and a gold value has to match a whole token |
| `phi-124` | `2026-10-29` | `2026-10-29T14:32` | The text reads `2026-10-29T14:32`, and a gold value has to match a whole token |
