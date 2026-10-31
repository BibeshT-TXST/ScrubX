import type { ActionCounts, InjectionSummary, PhiSummary, Rate } from "./score";

export interface SetResult<T> {
  name: string;
  sha256: string;
  provenance: string;
  summary: T;
}

export interface Results {
  commit: string;
  /** Null when only the external sets were scored. */
  own: {
    author: string;
    /** True while src/core is the tree the set was frozen against. */
    untuned: boolean;
    changes: string[];
    phi: SetResult<PhiSummary>;
    injection: SetResult<InjectionSummary>;
  } | null;
  external: {
    phi: SetResult<PhiSummary>[];
    injection: SetResult<InjectionSummary>[];
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// Reporting rule: under 20 items a percentage says more than the data does.
export function fmt({ k, n, low, high }: Rate): string {
  if (n === 0) return "no items";
  if (n < 20) return `${k}/${n} (too few to estimate)`;
  return `${k}/${n} (${pct(k / n)}, 95% CI ${pct(low!)}–${pct(high!)})`;
}

const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

const actionRows = (slices: Record<string, ActionCounts>) =>
  Object.entries(slices).map(([k, a]) => [k, String(a.block), String(a.flag), String(a.allow)]);

const list = (title: string, ids: readonly string[]) => (ids.length ? [`**${title} (${ids.length}):** ${ids.join(", ")}`, ""] : []);

function phiSection(set: SetResult<PhiSummary>, showFailures: boolean): string[] {
  const s = set.summary;
  const misses = (test: (m: PhiSummary["misses"][number]) => boolean) => s.misses.filter(test);
  return [
    `### ${set.name}`,
    "",
    `${set.provenance} SHA-256 \`${set.sha256.slice(0, 16)}\`. ${s.rows} rows, ${s.phiFreeRows} with no PHI.`,
    "",
    table(["Measure", "Result"], [
      ["**Leak recall, Safe Harbor read literally**", fmt(s.leakRecall)],
      ["Worst group (n ≥ 20)", s.worstGroup ? `${s.worstGroup.group}: ${fmt(s.worstGroup.leak)}` : "no group reaches n = 20"],
      ["Leak recall, without month-year mentions (decision 13)", fmt(s.leakRecallAdjusted)],
      ["Leak recall, identifiers outside Safe Harbor", fmt(s.extendedLeakRecall)],
      ["Rows with every Safe Harbor mention masked", fmt(s.cleanRows)],
      ["Rows with no PHI where something was labeled", fmt(s.falseDetectionRows)],
      ["The same, ignoring age labels (ScrubX masks every age by design)", fmt(s.falseDetectionRowsIgnoringAge)],
      ["Third-party names labeled as the patient", fmt(s.wrongPerson)],
      ["Gold values still in the message sent to the model", String(s.promptLeaks)],
      ["Rows blocked before any prompt (scored from labels)", String(s.blockedRows)],
      ["Gold values not found in the text (dropped)", String(s.unresolved)],
    ]),
    "",
    table(
      ["Safe Harbor group", "Leak recall", "Recall (right group)"],
      Object.entries(s.byGroup).map(([g, r]) => [g, fmt(r.leak), fmt(r.typed)]),
    ),
    "",
    table(
      ["Gold type, all scopes", "Leak recall", "Recall (right group)"],
      Object.entries(s.byType).map(([t, r]) => [t, fmt(r.leak), fmt(r.typed)]),
    ),
    "",
    table(["Text shape", "Leak recall"], Object.entries(s.byShape).map(([k, r]) => [k, fmt(r)])),
    "",
    table(["Name belongs to", "Leak recall"], Object.entries(s.byNameSubject).map(([k, r]) => [k, fmt(r)])),
    "",
    table(["ScrubX label", "Precision on this set"], Object.entries(s.precisionByLabel).map(([k, r]) => [k, fmt(r)])),
    "",
    ...(showFailures
      ? [
          ...list("Missed, Safe Harbor", misses((m) => m.scope === "safe_harbor" && !m.monthYear).map((m) => `${m.rowId} \`${m.value}\``)),
          ...list("Missed on purpose, month-year (decision 13)", misses((m) => m.monthYear).map((m) => `${m.rowId} \`${m.value}\``)),
          ...list("Missed, outside Safe Harbor", misses((m) => m.scope === "extended").map((m) => `${m.rowId} \`${m.value}\``)),
          ...list("Labeled something in a PHI-free row", s.falsePositiveRows),
        ]
      : [`${s.misses.length} missed mentions are listed in \`eval/results.json\`.`, ""]),
  ];
}

function injectionSection(set: SetResult<InjectionSummary>, showFailures: boolean): string[] {
  const s = set.summary;
  const hasAttacks = s.missRate.n > 0;
  const hasBenign = s.falseBlockRate.n > 0;
  return [
    `### ${set.name}`,
    "",
    `${set.provenance} SHA-256 \`${set.sha256.slice(0, 16)}\`.`,
    "",
    table(["Measure", "Result"], [
      ...(hasAttacks
        ? [
            ["**Attacks that got through (allow)**", fmt(s.missRate)],
            ["Attacks blocked", fmt(s.blockRate)],
            ["Attacks blocked or flagged", fmt(s.detectionRate)],
          ]
        : []),
      ...(hasBenign
        ? [
            ["Benign messages blocked", fmt(s.falseBlockRate)],
            ["Benign messages flagged", fmt(s.falseFlagRate)],
          ]
        : []),
      ...(s.recordAttacksRemoved.n ? [["Attacks in record text removed", fmt(s.recordAttacksRemoved)]] : []),
      ...(s.recordBenignQuarantined.n ? [["Benign record text removed", fmt(s.recordBenignQuarantined)]] : []),
    ]),
    "",
    table(["Category", "Block", "Flag", "Allow"], actionRows(s.byCategory)),
    "",
    table(["Language", "Block", "Flag", "Allow"], actionRows(s.byLanguage)),
    "",
    ...(showFailures
      ? [
          ...list("Attacks allowed", s.missedAttacks),
          ...list("Benign messages blocked", s.falseBlocks),
          ...list("Benign messages flagged", s.falseFlags),
          ...list("Record attacks that reached the model", s.missedRecordAttacks),
          ...list("Benign record text removed", s.falseQuarantines),
        ]
      : [`Row-level failures are listed in \`eval/results.json\`.`, ""]),
  ];
}

/** Generated from results.json. The caveats live here, next to the numbers, so no copy can drop them. */
export function renderResults(r: Results): string {
  const status = r.own
    ? r.own.untuned
      ? "**The detectors have not changed since this set was frozen, so these are untuned scores.**"
      : "**The detectors changed after this set was frozen. Its rows have been seen, so read these as development scores, not as an estimate of anything unseen.**"
    : "**External sets only. The project's own set was not scored in this run.**";

  return [
    "# ScrubX evaluation results",
    "",
    "Generated by `npm run eval -- --write`. Do not edit by hand.",
    "",
    `Commit \`${r.commit}\`. ${status}`,
    "",
    "## How to read these numbers",
    "",
    "- All data is synthetic. These results describe these test sets and do not predict performance on real clinical text.",
    "- This is a fixed test. An attacker who sees the rules and adapts will do better than any attack here, so these are not security claims.",
    "- This is not a HIPAA compliance claim, and detection recall does not establish de-identification under Safe Harbor or Expert Determination.",
    "- Intervals are two-sided 95% Wilson, unadjusted across the many rows in each table. They treat items as independent, which is optimistic, because rows share an author and mentions share sentences.",
    "- PHI is scored on the message path only. Record text is scored for embedded instructions, not for PHI.",
    "- A leak means any letter or digit of a gold value stayed unmasked. Over-masking is measured separately by the false-detection and precision rows.",
    "",
    ...(r.own
      ? [
          "## Our own set",
          "",
          `Written by: ${r.own.author}. No independent human agreement on the labels was measured.`,
          "",
          ...(r.own.changes.length ? ["Changes after the first freeze:", ...r.own.changes.map((c) => `- ${c}`), ""] : []),
          ...phiSection(r.own.phi, true),
          ...injectionSection(r.own.injection, true),
        ]
      : []),
    "## External sets",
    "",
    "Each set is reported separately because each defines an attack and an identifier differently. The rules were not tuned on these rows before the first published score.",
    "",
    ...r.external.phi.flatMap((s) => phiSection(s, false)),
    ...r.external.injection.flatMap((s) => injectionSection(s, false)),
  ].join("\n");
}
