import type { InjectionScan, InjectionScanner, SignalName } from "../injection/scanner";
import { Stage, type SpanDetails } from "../pipeline/Stage";
import type { NormalizedText } from "../text/normalize";

/** Step 3b. Scores injection intent 0–1 across signal families. */
export class SemanticScan extends Stage<NormalizedText, InjectionScan> {
  readonly name = "SemanticScan" as const;
  readonly step = "detect" as const;

  constructor(private readonly scanner: InjectionScanner) {
    super();
  }

  protected async process(input: NormalizedText): Promise<InjectionScan> {
    return this.scanner.scan(input);
  }

  protected override snapshotOutput(scan: InjectionScan) {
    return { data: scan };
  }

  protected override describe(_in: NormalizedText, scan: InjectionScan): SpanDetails {
    const [top, topScore] = (Object.entries(scan.signals) as [SignalName, number][]).sort((a, b) => b[1] - a[1])[0]!;
    return {
      caption: topScore
        ? `Semantic scan scored ${scan.score} (strongest signal: ${top.replaceAll("_", " ")} ${topScore}).`
        : "Semantic scan found no injection signals.",
      attributes: { scanner: this.scanner.name, score: scan.score, ...scan.signals },
    };
  }
}
