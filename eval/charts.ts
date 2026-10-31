import type { Results } from "./report";
import { rate, type ActionCounts, type PhiSummary, type Rate } from "./score";

// Hand-written SVG, in the style of PipelineGraph.tsx: three chart forms don't justify a chart
// library in dev dependencies, and GitHub renders the files as they are.

type ThemeName = "light" | "dark";

interface Theme {
  surface: string;
  primary: string;
  secondary: string;
  muted: string;
  grid: string;
  axis: string;
  own: string;
  external: string;
  /** Ordered by how hard the pipeline intervened, so "allowed" stays a neutral gray. */
  blocked: string;
  flagged: string;
  allowed: string;
}

const THEMES: Record<ThemeName, Theme> = {
  light: {
    surface: "#fcfcfb",
    primary: "#0b0b0b",
    secondary: "#52514e",
    muted: "#6f6e69",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    own: "#2a78d6",
    external: "#eb6834",
    blocked: "#1c5cab",
    flagged: "#86b6ef",
    allowed: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    primary: "#f0efec",
    secondary: "#c3c2b7",
    muted: "#a3a29a",
    grid: "#2c2c2a",
    axis: "#383835",
    own: "#3987e5",
    external: "#d95926",
    blocked: "#86b6ef",
    flagged: "#256abf",
    allowed: "#5c5b56",
  },
};

const WIDTH = 860;
const PAD = 24;
const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif";
// The report's rule: under 20 items a rate says more than the data does, so nothing is plotted.
const MIN_N_TO_PLOT = 20;
const SOLID_N = 50;
const MIN_PART_WIDTH = 3;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const missed = ({ k, n }: Rate) => n - k;

interface TextOpts {
  size?: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  tabular?: boolean;
}

function text(x: number, y: number, value: string, { size = 14, fill, weight, anchor, tabular }: TextOpts): string {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${size}"`,
    `fill="${fill}"`,
    weight ? `font-weight="${weight}"` : "",
    anchor ? `text-anchor="${anchor}"` : "",
    tabular ? `style="font-variant-numeric:tabular-nums"` : "",
  ];
  return `<text ${attrs.filter(Boolean).join(" ")}>${esc(value)}</text>`;
}

/** SVG has no text wrapping, so lines are broken by a character budget for the font size. */
export function wrap(value: string, size: number, width = WIDTH - PAD * 2): string[] {
  const budget = Math.floor(width / (size * 0.52));
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    if (line && `${line} ${word}`.length > budget) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return line ? [...lines, line] : lines;
}

function block(lines: readonly string[], y: number, opts: TextOpts, lineHeight: number): { svg: string; y: number } {
  return {
    svg: lines.map((line, i) => text(PAD, y + i * lineHeight, line, opts)).join(""),
    y: y + lines.length * lineHeight,
  };
}

function frame(id: string, title: string, description: string, height: number, theme: Theme, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img" aria-labelledby="${id}-title ${id}-desc" font-family="${FONT}">`,
    `<title id="${id}-title">${esc(title)}</title>`,
    `<desc id="${id}-desc">${esc(description)}</desc>`,
    `<rect width="${WIDTH}" height="${height}" rx="8" fill="${theme.surface}"/>`,
    body,
    `</svg>`,
    "",
  ].join("\n");
}

type SeriesKey = "own" | "external";

function marker(series: SeriesKey, cx: number, cy: number, hollow: boolean, theme: Theme): string {
  const color = theme[series];
  const fill = hollow ? theme.surface : color;
  const stroke = hollow ? color : theme.surface;
  // Circle and diamond, so the two sets stay apart with no color at all.
  return series === "own"
    ? `<circle cx="${cx}" cy="${cy}" r="5" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
    : `<path d="M${cx} ${cy - 6.5}L${cx + 6.5} ${cy}L${cx} ${cy + 6.5}L${cx - 6.5} ${cy}Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

interface Lane {
  series: SeriesKey;
  rate: Rate;
  /** Printed when the set has no items in this row. */
  absent?: string;
}

interface DotRow {
  label: string;
  lanes: Lane[];
}

interface DotChart {
  id: string;
  title: string;
  subtitle: string;
  legend: { series: SeriesKey; label: string }[];
  rows: DotRow[];
  /** Rows above this index are summaries, set apart by a rule. */
  summaryRows: number;
  footnotes: string[];
}

function dotChart(chart: DotChart, theme: Theme): string {
  const x0 = 214;
  const x1 = 700;
  const columnX = WIDTH - PAD;
  const laneH = 22;
  const rowGap = 12;
  const xAt = (share: number) => x0 + share * (x1 - x0);

  const title = block(wrap(chart.title, 20), 38, { size: 20, weight: 600, fill: theme.primary }, 26);
  const subtitle = block(wrap(chart.subtitle, 14), title.y - 2, { size: 14, fill: theme.secondary }, 20);

  // Legend: identity first, then what a hollow marker means.
  let legendX = PAD;
  const legendY = subtitle.y + 8;
  const legendItems: string[] = [];
  for (const { series, label } of chart.legend) {
    legendItems.push(marker(series, legendX + 7, legendY - 4, false, theme), text(legendX + 20, legendY, label, { size: 13, fill: theme.secondary }));
    legendX += 20 + label.length * 7 + 22;
  }
  const hollowSeries = chart.legend[0]?.series ?? "own";
  legendItems.push(
    marker(hollowSeries, legendX + 7, legendY - 4, true, theme),
    text(legendX + 20, legendY, "Hollow: 20 to 49 items, so read it loosely", { size: 13, fill: theme.secondary }),
  );

  const axisTop = legendY + 34;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1];
  const header = [
    text(x0, axisTop - 10, "Share of identifiers missed, with 95% interval", { size: 12, fill: theme.muted }),
    text(columnX, axisTop - 10, "missed / total", { size: 12, fill: theme.muted, anchor: "end" }),
  ];

  let y = axisTop + 4;
  const rowsSvg: string[] = [];
  chart.rows.forEach((row, i) => {
    const height = row.lanes.length * laneH;
    rowsSvg.push(text(PAD, y + height / 2 + 5, row.label, { size: 14, fill: theme.primary, weight: i < chart.summaryRows ? 600 : undefined }));
    row.lanes.forEach((lane, j) => {
      const cy = y + laneH * j + laneH / 2;
      const { rate: r } = lane;
      if (r.n >= MIN_N_TO_PLOT) {
        const low = xAt(1 - r.high!);
        const high = xAt(1 - r.low!);
        rowsSvg.push(
          `<line x1="${low.toFixed(1)}" x2="${high.toFixed(1)}" y1="${cy}" y2="${cy}" stroke="${theme[lane.series]}" stroke-width="2" stroke-linecap="round"/>`,
          marker(lane.series, Number(xAt(missed(r) / r.n).toFixed(1)), cy, r.n < SOLID_N, theme),
        );
      } else {
        // No marker: there is no estimate to place, and a hollow one already means 20 to 49 items.
        const who = chart.legend.find((l) => l.series === lane.series)?.label;
        const why = r.n ? "too few items to plot" : (lane.absent ?? "not in this set");
        rowsSvg.push(text(x0 + 8, cy + 4, who ? `${who}: ${why}` : why, { size: 12, fill: theme.muted }));
      }
      rowsSvg.push(text(columnX, cy + 4, r.n ? `${missed(r)} / ${r.n}` : "–", { size: 13, fill: theme.secondary, anchor: "end", tabular: true }));
    });
    y += height + rowGap;
    if (i === chart.summaryRows - 1) {
      rowsSvg.push(`<line x1="${PAD}" x2="${WIDTH - PAD}" y1="${y - rowGap / 2}" y2="${y - rowGap / 2}" stroke="${theme.grid}"/>`);
    }
  });

  const axisBottom = y - rowGap + 4;
  const grid = axisLabels.map((t) => {
    const x = xAt(t);
    return [
      `<line x1="${x}" x2="${x}" y1="${axisTop}" y2="${axisBottom}" stroke="${t === 0 ? theme.axis : theme.grid}"/>`,
      text(x, axisBottom + 16, pct(t), { size: 12, fill: theme.muted, anchor: "middle", tabular: true }),
    ].join("");
  });

  const notes = block(chart.footnotes.flatMap((note) => wrap(note, 12)), axisBottom + 44, { size: 12, fill: theme.secondary }, 17);
  const description = chart.rows
    .flatMap((row) => row.lanes.map((lane) => `${row.label}, ${lane.series === "own" ? "our set" : "external set"}: ${missed(lane.rate)} of ${lane.rate.n} missed.`))
    .join(" ");

  return frame(
    chart.id,
    chart.title,
    description,
    Math.round(notes.y + 8),
    theme,
    [title.svg, subtitle.svg, ...legendItems, ...header, ...grid, ...rowsSvg, notes.svg].join("\n"),
  );
}

interface OutcomeRow {
  label: string;
  counts: ActionCounts;
}

interface OutcomeSection {
  heading: string;
  rows: OutcomeRow[];
}

function outcomeChart(id: string, heading: string, subtitle: string, sections: OutcomeSection[], footnotes: string[], theme: Theme): string {
  const x0 = 300;
  const x1 = 590;
  const columns = [
    { x: 652, label: "Stopped" },
    { x: 712, label: "Flagged" },
    { x: 776, label: "Allowed" },
    { x: WIDTH - PAD, label: "Total" },
  ];
  const rowH = 26;
  const barH = 14;
  const gap = 2;

  const title = block(wrap(heading, 20), 38, { size: 20, weight: 600, fill: theme.primary }, 26);
  const sub = block(wrap(subtitle, 14), title.y - 2, { size: 14, fill: theme.secondary }, 20);

  const legendY = sub.y + 8;
  const keys: [string, string][] = [
    [theme.blocked, "Stopped: blocked, or removed from the record"],
    [theme.flagged, "Flagged: answered under stricter checks"],
    [theme.allowed, "Allowed"],
  ];
  let legendX = PAD;
  const legend = keys.flatMap(([fill, label]) => {
    const item = [
      `<rect x="${legendX}" y="${legendY - 11}" width="12" height="12" rx="3" fill="${fill}"/>`,
      text(legendX + 18, legendY, label, { size: 13, fill: theme.secondary }),
    ];
    legendX += 18 + label.length * 6.4 + 20;
    return item;
  });

  let y = legendY + 34;
  const body: string[] = [];
  for (const section of sections) {
    body.push(text(PAD, y, section.heading, { size: 14, weight: 600, fill: theme.primary }));
    for (const column of columns) body.push(text(column.x, y, column.label, { size: 12, fill: theme.muted, anchor: "end" }));
    y += 8;
    body.push(`<line x1="${PAD}" x2="${WIDTH - PAD}" y1="${y}" y2="${y}" stroke="${theme.grid}"/>`);
    y += 4;
    for (const { label, counts } of section.rows) {
      const total = counts.block + counts.flag + counts.allow;
      const cy = y + rowH / 2;
      body.push(text(PAD, cy + 5, label, { size: 14, fill: theme.primary }));
      const parts = [
        { n: counts.block, fill: theme.blocked },
        { n: counts.flag, fill: theme.flagged },
        { n: counts.allow, fill: theme.allowed },
      ].filter((p) => p.n > 0);
      const usable = x1 - x0 - gap * (parts.length - 1);
      // A sliver must still be visible: one blocked message in sixty is a real event.
      // The width it borrows comes off the largest part, so every bar still ends at the same place.
      const widths = parts.map(({ n }) => Math.max(MIN_PART_WIDTH, (n / total) * usable));
      const excess = widths.reduce((a, b) => a + b, 0) - usable;
      widths[widths.indexOf(Math.max(...widths))]! -= excess;
      let x = x0;
      parts.forEach(({ fill }, i) => {
        const w = widths[i]!;
        body.push(`<rect x="${x.toFixed(1)}" y="${cy - barH / 2}" width="${w.toFixed(1)}" height="${barH}" rx="3" fill="${fill}"/>`);
        x += w + gap;
      });
      [counts.block, counts.flag, counts.allow, total].forEach((n, i) => {
        body.push(text(columns[i]!.x, cy + 4, String(n), { size: 13, fill: i === 3 ? theme.muted : theme.secondary, anchor: "end", tabular: true }));
      });
      y += rowH;
    }
    y += 20;
  }

  const notes = block(footnotes.flatMap((note) => wrap(note, 12)), y + 2, { size: 12, fill: theme.secondary }, 17);
  const description = sections
    .flatMap((s) => s.rows.map((r) => `${s.heading}, ${r.label}: ${r.counts.block} stopped, ${r.counts.flag} flagged, ${r.counts.allow} allowed.`))
    .join(" ");
  return frame(id, heading, description, Math.round(notes.y + 8), theme, [title.svg, sub.svg, ...legend, ...body, notes.svg].join("\n"));
}

const LIMITS = "All data is synthetic, and these results don't predict performance on real clinical text. Not a HIPAA compliance claim.";

function provenance(r: Results, own: NonNullable<Results["own"]>): string {
  const state = own.untuned ? "Detectors unchanged since the set was frozen" : "Detectors changed after the set was frozen, so these rows have been seen";
  return `Our set written by ${own.author}. ${state}. Commit ${r.commit}. Intervals are 95% Wilson and treat items as independent, which is optimistic.`;
}

const missRank = ({ n, k }: Rate) => (n < MIN_N_TO_PLOT ? -1 : (n - k) / n);

function phiByGroup(r: Results, own: NonNullable<Results["own"]>, theme: Theme): string {
  const ours = own.phi.summary;
  const external: PhiSummary | undefined = r.external.phi[0]?.summary;
  const name = r.external.phi[0]?.name ?? "External set";
  const groups = Object.keys({ ...ours.byGroup, ...external?.byGroup }).sort(
    (a, b) => missRank(ours.byGroup[b]?.leak ?? rate(0, 0)) - missRank(ours.byGroup[a]?.leak ?? rate(0, 0)),
  );
  const lanes = (own: Rate | undefined, ext: Rate | undefined): Lane[] => [
    { series: "own", rate: own ?? rate(0, 0) },
    ...(external ? [{ series: "external" as const, rate: ext ?? rate(0, 0), absent: "not labeled in this set" }] : []),
  ];
  const share = (x: Rate) => pct(missed(x) / x.n);

  return dotChart(
    {
      id: "phi-by-group",
      title: external
        ? `ScrubX missed ${share(ours.leakRecall)} of identifiers on our test set and ${share(external.leakRecall)} on ${name}`
        : `ScrubX missed ${share(ours.leakRecall)} of identifiers on our test set`,
      subtitle: "A miss means at least one letter or digit of the identifier was left unmasked.",
      legend: [
        { series: "own", label: "Our set" },
        ...(external ? [{ series: "external" as const, label: name }] : []),
      ],
      rows: [
        { label: "All identifiers", lanes: lanes(ours.leakRecall, external?.leakRecall) },
        ...groups.map((group) => ({ label: group, lanes: lanes(ours.byGroup[group]?.leak, external?.byGroup[group]?.leak) })),
      ],
      summaryRows: 1,
      footnotes: [
        `Counts Safe Harbor identifiers only, including month-only dates, which ScrubX leaves visible on purpose. ${name} counts hospitals as places, which ScrubX doesn't try to mask, and has no patient record, so its run tests identifiers ScrubX wasn't told about.`,
        provenance(r, own),
        LIMITS,
      ],
    },
    theme,
  );
}

function phiByShape(r: Results, own: NonNullable<Results["own"]>, theme: Theme): string {
  const shapes = own.phi.summary.byShape;
  const LABELS: Record<string, string> = {
    allcaps: "ALL CAPS",
    lowercase: "all lowercase",
    plain: "Normal text",
    messy: "Pasted, with markup",
  };
  const ranked = Object.entries(shapes).sort(([, a], [, b]) => missRank(b) - missRank(a));
  const [worstKey, worst] = ranked[0]!;
  const plain = shapes.plain;
  return dotChart(
    {
      id: "phi-by-shape",
      title: `${pct(missed(worst) / worst.n)} of identifiers were missed in ${LABELS[worstKey] ?? worstKey} text${plain ? `, ${pct(missed(plain) / plain.n)} in normal text` : ""}`,
      subtitle: "Our set only. The public set has no case or formatting variants.",
      legend: [],
      rows: ranked.map(([shape, value]) => ({ label: LABELS[shape] ?? shape, lanes: [{ series: "own" as const, rate: value }] })),
      summaryRows: 0,
      footnotes: [
        "Each row holds a different mix of identifier types, so this shows where misses cluster and is not a controlled comparison.",
        provenance(r, own),
        LIMITS,
      ],
    },
    theme,
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  override_direct: "Override, plain wording",
  override_paraphrase: "Override, paraphrased",
  other_language: "Other languages",
  obfuscated: "Encoded or disguised",
  role_persona: "Role or persona",
  exfiltration: "Data extraction",
  clinical_trigger_words: "Clinical text with trigger words",
  clinical_plain: "Plain clinical text",
};

function outcomeRows(slices: Record<string, ActionCounts>, label: "attack" | "benign"): OutcomeRow[] {
  const prefix = `${label}: `;
  return Object.entries(slices)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, counts]) => {
      const category = key.slice(prefix.length);
      return { label: CATEGORY_LABELS[category] ?? category, counts };
    });
}

const allowShare = ({ block, flag, allow }: ActionCounts) => allow / (block + flag + allow);

function injectionOutcomes(r: Results, own: NonNullable<Results["own"]>, theme: Theme): string {
  const s = own.injection.summary;
  const notInject = r.external.injection[0];
  const attackTotal = s.missRate.n;
  const attacks = [
    ...outcomeRows(s.byCategory, "attack"),
    {
      label: "Hidden in record text",
      counts: { block: s.recordAttacksRemoved.k, flag: 0, allow: s.recordAttacksRemoved.n - s.recordAttacksRemoved.k },
    },
  ].sort((a, b) => allowShare(b.counts) - allowShare(a.counts));
  const harmless = [
    ...outcomeRows(s.byCategory, "benign"),
    {
      label: "Chart notes in the record",
      counts: { block: s.recordBenignQuarantined.k, flag: 0, allow: s.recordBenignQuarantined.n - s.recordBenignQuarantined.k },
    },
    ...(notInject
      ? [{ label: `${notInject.name} (public, not clinical)`, counts: notInject.summary.benign }]
      : []),
  ];

  return outcomeChart(
    "injection-outcomes",
    `${s.missRate.k} of ${attackTotal} attack messages got through, while ${s.falseBlockRate.k} of ${s.falseBlockRate.n} harmless clinical messages ${s.falseBlockRate.k === 1 ? "was" : "were"} blocked`,
    "One row per kind of message, worst first among the attacks. Most rows are small, so read the counts.",
    [
      { heading: "Attacks: these should be stopped", rows: attacks },
      { heading: "Harmless: these should be allowed", rows: harmless },
    ],
    [
      "Each bar shows the split within its own row, so the bars for 5 messages and for 339 are the same length.",
      "This is a fixed test, not a security claim. An attacker who sees the rules and adapts will do better than any attack here.",
      provenance(r, own).replace(/ Intervals.*$/, ""),
      "All data is synthetic, and these results don't predict performance on real clinical text.",
    ],
    theme,
  );
}

/** Filename to contents. Every chart comes in both themes, because GitHub picks by the viewer's. */
export function chartFiles(r: Results): Record<string, string> {
  const own = r.own;
  if (!own) throw new Error("charts need a full run, not an external-only one");
  const files: Record<string, string> = { "eval-results.csv": resultsCsv(r) };
  for (const name of ["light", "dark"] as const) {
    const theme = THEMES[name];
    files[`phi-by-group-${name}.svg`] = phiByGroup(r, own, theme);
    files[`phi-by-shape-${name}.svg`] = phiByShape(r, own, theme);
    files[`injection-outcomes-${name}.svg`] = injectionOutcomes(r, own, theme);
  }
  return files;
}

const csvCell = (value: string | number) => {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csvRow(set: string, measure: string, item: string, r: Rate): (string | number)[] {
  const estimable = r.n >= MIN_N_TO_PLOT;
  const percent = (x: number | null) => (estimable && x !== null ? (x * 100).toFixed(1) : "");
  return [set, measure, item, r.k, r.n, estimable ? ((r.k / r.n) * 100).toFixed(1) : "", percent(r.low), percent(r.high), estimable ? "" : "too few to estimate"];
}

const actionRows = (set: string, measure: string, slices: Record<string, ActionCounts>) =>
  Object.entries(slices).flatMap(([key, counts]) => {
    const n = counts.block + counts.flag + counts.allow;
    return (["block", "flag", "allow"] as const).map((action) => csvRow(set, measure, `${key}: ${action}`, rate(counts[action], n)));
  });

/** One long table, so it can be pivoted in Excel. The same numbers as RESULTS.md, under the same rule for small n. */
export function resultsCsv(r: Results): string {
  const phi = (set: string, s: PhiSummary) => [
    csvRow(set, "Leak recall", "Safe Harbor, read literally", s.leakRecall),
    csvRow(set, "Leak recall", "Safe Harbor, without month-year", s.leakRecallAdjusted),
    csvRow(set, "Leak recall", "Outside Safe Harbor", s.extendedLeakRecall),
    csvRow(set, "Rows fully masked", "Safe Harbor", s.cleanRows),
    csvRow(set, "False detection", "PHI-free rows with any label", s.falseDetectionRows),
    csvRow(set, "False detection", "PHI-free rows, ignoring age labels", s.falseDetectionRowsIgnoringAge),
    csvRow(set, "Wrong person", "Third-party names labeled as the patient", s.wrongPerson),
    ...Object.entries(s.byGroup).flatMap(([k, v]) => [csvRow(set, "Leak recall by group", k, v.leak), csvRow(set, "Recall by group, right group", k, v.typed)]),
    ...Object.entries(s.byType).flatMap(([k, v]) => [csvRow(set, "Leak recall by type", k, v.leak), csvRow(set, "Recall by type, right group", k, v.typed)]),
    ...Object.entries(s.byShape).map(([k, v]) => csvRow(set, "Leak recall by text shape", k, v)),
    ...Object.entries(s.byNameSubject).map(([k, v]) => csvRow(set, "Leak recall by name owner", k, v)),
    ...Object.entries(s.precisionByLabel).map(([k, v]) => csvRow(set, "Precision by ScrubX label", k, v)),
  ];
  const injection = (set: string, s: Results["external"]["injection"][number]["summary"]) => [
    csvRow(set, "Attacks", "Allowed (got through)", s.missRate),
    csvRow(set, "Attacks", "Blocked", s.blockRate),
    csvRow(set, "Attacks", "Blocked or flagged", s.detectionRate),
    csvRow(set, "Harmless messages", "Blocked", s.falseBlockRate),
    csvRow(set, "Harmless messages", "Flagged", s.falseFlagRate),
    csvRow(set, "Record text", "Attacks removed", s.recordAttacksRemoved),
    csvRow(set, "Record text", "Benign text removed", s.recordBenignQuarantined),
    ...actionRows(set, "Outcome by category", s.byCategory),
    ...actionRows(set, "Outcome by language", s.byLanguage),
  ];
  const rows = [
    ["set", "measure", "item", "count", "total", "percent", "ci_low_percent", "ci_high_percent", "note"],
    ...(r.own ? [...phi("Our set: PHI", r.own.phi.summary), ...injection("Our set: injection", r.own.injection.summary)] : []),
    ...r.external.phi.flatMap((s) => phi(s.name, s.summary)),
    ...r.external.injection.flatMap((s) => injection(s.name, s.summary)),
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
