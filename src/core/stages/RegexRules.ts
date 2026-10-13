import { Stage, type SpanDetails } from "../pipeline/Stage";
import { INJECTION_RULES } from "../rules/injection.rules";
import { PHI_RULES } from "../rules/phi.rules";
import { matchRules, type Rule } from "../rules/types";
import type { NormalizedText } from "../text/normalize";
import type { Finding } from "../types";
import { plural } from "./format";

/** Step 3a. Known PHI shapes and known injection strings. Rules are data. */
export class RegexRules extends Stage<NormalizedText, Finding[]> {
  readonly name = "RegexRules" as const;
  readonly step = "detect" as const;

  constructor(private readonly rules: readonly Rule[] = [...PHI_RULES, ...INJECTION_RULES]) {
    super();
  }

  protected async process(input: NormalizedText): Promise<Finding[]> {
    return matchRules(input.text, this.rules);
  }

  protected override describe(_in: NormalizedText, findings: Finding[]): SpanDetails {
    const phi = findings.filter((f) => f.category === "phi").length;
    const injection = findings.length - phi;
    return {
      caption: `Regex rules matched ${plural(phi, "PHI pattern")} and ${plural(injection, "injection rule")}.`,
      findings,
      attributes: { phiFindings: phi, injectionFindings: injection, rulesFired: [...new Set(findings.map((f) => f.ruleId))].join(",") },
    };
  }
}
