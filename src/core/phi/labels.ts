import type { Finding, PhiLabel, PhiType } from "../types";

const SOURCE_RANK: Record<PhiLabel["source"], number> = { record: 0, pattern: 1, dictionary: 2, context: 3 };

export function findingsToLabels(findings: readonly Finding[]): PhiLabel[] {
  return findings.flatMap((f) =>
    f.category === "phi" && f.phiType
      ? [{ type: f.phiType, start: f.start, end: f.end, confidence: f.confidence ?? 0.7, source: "pattern" as const }]
      : [],
  );
}

/**
 * Picks a non-overlapping set of labels: longest span first ("April 3, 2026"
 * beats the name "April"), then record matches over patterns over dictionary.
 */
export function resolveLabels(labels: readonly PhiLabel[]): PhiLabel[] {
  const ranked = [...labels].sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source] ||
      b.confidence - a.confidence,
  );
  const kept: PhiLabel[] = [];
  for (const l of ranked) {
    if (kept.every((k) => l.end <= k.start || l.start >= k.end)) kept.push(l);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function countByType(labels: readonly { type: PhiType }[]): Partial<Record<PhiType, number>> {
  const counts: Partial<Record<PhiType, number>> = {};
  for (const { type } of labels) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
}
