import type { Finding, PhiType, Severity } from "../types";

/**
 * A detection rule. If the pattern has a named group `v` (and the `d` flag),
 * the finding covers only that group, e.g. the number in "58-year-old".
 */
export interface Rule {
  id: string;
  category: "phi" | "injection";
  severity: Severity;
  description: string;
  pattern: RegExp;
  phiType?: PhiType;
  /** PHI rules only: how sure a match is real PHI. */
  confidence?: number;
}

export function matchRules(text: string, rules: readonly Rule[]): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.pattern)) {
      const [start, end] = m.indices?.groups?.v ?? [m.index, m.index + m[0].length];
      if (end === start) continue;
      findings.push({
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        start,
        end,
        ...(rule.phiType && { phiType: rule.phiType, confidence: rule.confidence ?? 0.7 }),
      });
    }
  }
  return findings.sort((a, b) => a.start - b.start || b.end - a.end);
}
