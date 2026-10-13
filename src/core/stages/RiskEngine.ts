import { noisyOr, type InjectionScan } from "../injection/scanner";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import { INJECTION_RULES } from "../rules/injection.rules";
import type { Decision, DecisionAction, Finding, PhiLabel, Severity } from "../types";
import { plural } from "./format";

export interface RiskInput {
  findings: Finding[];
  scan: InjectionScan;
  labels: PhiLabel[];
}

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 1, high: 0.6, medium: 0.3, low: 0.1 };

const RULE_DESCRIPTION = new Map(INJECTION_RULES.map((r) => [r.id, r.description]));
const VERB: Record<DecisionAction, string> = { block: "blocks", flag: "flags", allow: "allows" };
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Step 4. Combines regex injection hits and the semantic score into one
 * decision. PHI is expected in clinical chat, so it is never risk on its own:
 * it gets tokenized, not blocked.
 */
export class RiskEngine extends Stage<RiskInput, Decision> {
  readonly name = "RiskEngine" as const;
  readonly step = "decide" as const;

  protected async process({ findings, scan }: RiskInput, ctx: StageContext): Promise<Decision> {
    const { blockThreshold, flagThreshold } = ctx.config.risk;

    // One contribution per rule, however many times it matched.
    const rules = new Map<string, Severity>();
    for (const f of findings) if (f.category === "injection") rules.set(f.ruleId, f.severity);

    const contributions = [
      ...[...rules].map(([id, sev]) => ({ source: `rule:${id}`, score: SEVERITY_WEIGHT[sev] })),
      ...Object.entries(scan.signals)
        .filter(([, s]) => s > 0)
        .map(([name, s]) => ({ source: `signal:${name}`, score: s })),
    ].sort((a, b) => b.score - a.score);

    // Regex and semantic scan often fire on the same phrase, so they are not
    // independent evidence: take the stronger detector instead of combining them.
    const ruleScore = noisyOr([...rules.values()].map((s) => SEVERITY_WEIGHT[s]));
    const score = round(Math.max(scan.score, ruleScore));
    const critical = [...rules].filter(([, sev]) => sev === "critical").map(([id]) => id);

    const action: DecisionAction =
      critical.length || score >= blockThreshold ? "block" : score >= flagThreshold ? "flag" : "allow";

    const reasons = critical.map((id) => `Critical rule ${id} matched: ${RULE_DESCRIPTION.get(id) ?? id}`);
    if (action === "block" && !critical.length) reasons.push(`Risk score ${score} is at or above the block threshold (${blockThreshold})`);
    if (action === "flag") reasons.push(`Risk score ${score} is between the flag (${flagThreshold}) and block (${blockThreshold}) thresholds`);
    if (action === "allow") {
      reasons.push(contributions.length ? `Risk score ${score} is below the flag threshold (${flagThreshold})` : "No injection signals detected");
    }

    return { action, score, reasons, contributions };
  }

  protected override snapshotOutput(decision: Decision) {
    return { data: decision };
  }

  protected override describe({ labels }: RiskInput, d: Decision, ctx: StageContext): SpanDetails {
    const signals = d.contributions.length ? plural(d.contributions.length, "injection signal") : "no injection signals";
    return {
      caption: `Risk engine sees ${signals} and ${VERB[d.action]} it.`,
      status: d.action === "block" ? "blocked" : "ok",
      attributes: {
        action: d.action,
        score: d.score,
        signals: d.contributions.length,
        phiFields: labels.length,
        flagThreshold: ctx.config.risk.flagThreshold,
        blockThreshold: ctx.config.risk.blockThreshold,
      },
    };
  }
}
