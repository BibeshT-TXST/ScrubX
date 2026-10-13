import { Stage, type SpanDetails } from "../pipeline/Stage";
import { normalizeText, type ChangeKind, type NormalizedText } from "../text/normalize";
import { plural } from "./format";

const LABELS: Record<ChangeKind, [string, string]> = {
  comment: ["hidden comment unwrapped", "hidden comments unwrapped"],
  markup: ["markup tag stripped", "markup tags stripped"],
  entity: ["HTML entity decoded", "HTML entities decoded"],
  nfkc: ["character normalized", "characters normalized"],
  invisible: ["invisible character removed", "invisible characters removed"],
  homoglyph: ["lookalike letter replaced", "lookalike letters replaced"],
  markdown: ["markdown mark removed", "markdown marks removed"],
  whitespace: ["whitespace collapsed", "whitespace collapsed"],
};

/** Step 2. Unicode NFKC, invisible/bidi removal, markup stripping, whitespace. */
export class InputNormalizer extends Stage<string, NormalizedText> {
  readonly name = "InputNormalizer" as const;
  readonly step = "normalize" as const;

  protected async process(raw: string): Promise<NormalizedText> {
    return normalizeText(raw);
  }

  protected override snapshotInput(raw: string) {
    return { text: raw };
  }

  protected override snapshotOutput(out: NormalizedText) {
    return { text: out.text, data: { changes: out.changes } };
  }

  protected override describe(raw: string, out: NormalizedText): SpanDetails {
    const entries = Object.entries(out.changes) as [ChangeKind, number][];
    const caption = entries.length
      ? `Unicode cleaned up and markup stripped: ${entries
          .map(([k, n]) => (k === "whitespace" ? LABELS[k][0] : plural(n, ...LABELS[k])))
          .join(", ")}.`
      : "Text was already clean; nothing changed.";
    return { caption, attributes: { ...out.changes, charsRemoved: raw.length - out.text.length } };
  }
}
