# Public test sets

Our own rows share an author with the detectors, so ScrubX is also scored on two public sets. Each is reported separately, because each defines an attack and an identifier differently. See the [results](../RESULTS.md#external-sets).

| Set | Rows | Licence | Source |
|---|---|---|---|
| ASQ-PHI | 1,051 | MIT, © 2025 James Weatherhead | [github.com/JamesWeatherhead/asq-phi](https://github.com/JamesWeatherhead/asq-phi), paper: Weatherhead, Golovko & McCaffrey (2026), *Data in Brief* 65, 112586 |
| NotInject | 339 | MIT, © 2024 Hao Li | [huggingface.co/datasets/leolee99/NotInject](https://huggingface.co/datasets/leolee99/NotInject), code: [InjecGuard](https://github.com/SaFoLab-WISC/InjecGuard) |

The files here are converted copies, pinned to a revision by [`sources.json`](sources.json). To download and convert them again, run `node scripts/eval-fetch-external.mjs`, which needs network.

## What the conversion changes

Made to every ASQ-PHI row:

- Its types are mapped to ours.
- A title or field word in front of a gold value is removed. Scoring "Dr" as a leak was wrong, and it was found after the first run: leak recall moved from 50.6% to 51.3%.
- A month with no day is marked `monthYear`.

## Licence

The MIT notice applies to the files in this folder, which are converted copies of these sets:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
