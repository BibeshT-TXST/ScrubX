import { describe, expect, it } from "vitest";
import { chartFiles, resultsCsv, wrap } from "../../eval/charts";
import type { Results } from "../../eval/report";
import { rate, summarizeInjection, summarizePhi, type PhiSummary } from "../../eval/score";

const set = <T>(name: string, summary: T) => ({ name, sha256: "abc", provenance: "From somewhere.", summary });

function results(phi: Partial<PhiSummary> = {}, untuned = true): Results {
  return {
    commit: "abc1234",
    accepted: [],
    own: {
      author: "A <writer>",
      untuned,
      changes: [],
      phi: set("PHI", {
        ...summarizePhi([]),
        leakRecall: rate(50, 100),
        byShape: { plain: rate(80, 100), lowercase: rate(5, 30) },
        byGroup: { Names: { leak: rate(30, 60), typed: rate(30, 60) }, Ages: { leak: rate(1, 12), typed: rate(1, 12) } },
        ...phi,
      }),
      injection: set("Prompt injection", {
        ...summarizeInjection([]),
        missRate: rate(7, 10),
        falseBlockRate: rate(1, 75),
        byCategory: {
          "attack: exfiltration": { block: 2, flag: 1, allow: 7 },
          "benign: clinical_plain": { block: 1, flag: 0, allow: 299 },
        },
      }),
    },
    external: {
      phi: [set("ASQ-PHI", { ...summarizePhi([]), leakRecall: rate(60, 100), byGroup: { Names: { leak: rate(90, 100), typed: rate(90, 100) } } })],
      injection: [set("NotInject", { ...summarizeInjection([]), benign: { block: 0, flag: 12, allow: 327 } })],
    },
  };
}

const files = chartFiles(results());
const group = files["phi-by-group-light.svg"]!;

describe("chartFiles", () => {
  it("writes every chart in both themes, and the CSV", () => {
    expect(Object.keys(files).sort()).toEqual([
      "eval-results.csv",
      "injection-outcomes-dark.svg",
      "injection-outcomes-light.svg",
      "phi-by-group-dark.svg",
      "phi-by-group-light.svg",
      "phi-by-shape-dark.svg",
      "phi-by-shape-light.svg",
    ]);
  });

  it("carries the limits inside every image, so a copied chart keeps them", () => {
    for (const [name, svg] of Object.entries(files)) {
      if (!name.endsWith(".svg")) continue;
      expect(svg, name).toContain("synthetic");
      expect(svg, name).toContain("Commit abc1234");
      expect(svg, name).not.toMatch(/NaN|undefined/);
    }
  });

  it("flips recall into misses, in the title and the counts", () => {
    expect(group).toContain("ScrubX missed 50% of identifiers on our test set and 40% on ASQ-PHI");
    expect(group).toContain("30 / 60");
    expect(group).toContain("10 / 100");
  });

  it("plots nothing under 20 items, but still prints the count", () => {
    const ages = group.slice(group.indexOf(">Ages<"));
    expect(ages).toContain("Our set: too few items to plot");
    expect(ages).toContain("11 / 12");
    expect(ages).toContain("ASQ-PHI: not labeled in this set");
    // One whisker per plotted lane: both "All identifiers", both "Names". None for Ages.
    expect(group.match(/stroke-linecap="round"/g)).toHaveLength(4);
  });

  it("draws a hollow marker under 50 items and a solid one above", () => {
    const hollow = chartFiles(results({ byGroup: { Names: { leak: rate(30, 49), typed: rate(30, 49) } } }))["phi-by-group-light.svg"]!;
    const solid = chartFiles(results({ byGroup: { Names: { leak: rate(30, 50), typed: rate(30, 50) } } }))["phi-by-group-light.svg"]!;
    const hollowMarkers = (svg: string) => svg.match(/<circle [^>]*fill="#fcfcfb"/g)?.length ?? 0;
    expect(hollowMarkers(hollow)).toBe(hollowMarkers(solid) + 1);
  });

  it("sorts the plain and the worst shape into the title", () => {
    expect(files["phi-by-shape-light.svg"]).toContain("83% of identifiers were missed in all lowercase text, 20% in normal text");
  });

  it("keeps a one-in-three-hundred outcome visible without making its bar longer", () => {
    const svg = files["injection-outcomes-light.svg"]!;
    const row = svg.slice(svg.indexOf(">Plain clinical text<"));
    const rects = [...row.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].slice(0, 2);
    const [sliver, rest] = rects.map((m) => ({ x: Number(m[1]), w: Number(m[2]) }));
    expect(sliver!.w).toBeGreaterThanOrEqual(3);
    expect(rest!.x + rest!.w).toBeCloseTo(590, 0);
  });

  it("says when the detectors changed after the freeze", () => {
    expect(chartFiles(results({}, false))["phi-by-group-light.svg"]).toContain("Detectors changed after the set was frozen");
  });

  it("escapes values that came from the data", () => {
    expect(group).toContain("A &lt;writer&gt;");
    expect(group).not.toContain("<writer>");
  });

  it("refuses an external-only run", () => {
    expect(() => chartFiles({ ...results(), own: null })).toThrow(/full run/);
  });
});

describe("resultsCsv", () => {
  const csv = resultsCsv(results());

  it("gives a percent and interval from 20 items up", () => {
    expect(csv).toContain('Our set: PHI,Leak recall,"Safe Harbor, read literally",50,100,50.0,40.4,59.6,');
  });

  it("leaves the percent blank under 20 items and says why", () => {
    expect(csv).toContain("Our set: PHI,Leak recall by group,Ages,1,12,,,,too few to estimate");
  });

  it("expands outcomes into counts", () => {
    expect(csv).toContain("Our set: injection,Outcome by category,attack: exfiltration: allow,7,10,,,,too few to estimate");
  });
});

describe("wrap", () => {
  it("breaks on spaces within the budget, keeping every word", () => {
    const lines = wrap("one two three four five six seven", 20, 100);
    expect(lines.join(" ")).toBe("one two three four five six seven");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(Math.floor(100 / (20 * 0.52)));
  });
});
