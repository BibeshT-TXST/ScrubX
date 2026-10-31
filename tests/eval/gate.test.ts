import { describe, expect, it } from "vitest";
import { compareResults } from "../../eval/gate";
import type { Results } from "../../eval/report";
import { summarizeInjection, summarizePhi, type InjectionSummary, type PhiSummary } from "../../eval/score";

const miss = (rowId: string, value: string) => ({ rowId, value, type: "NAME" as const, scope: "safe_harbor" as const, monthYear: false });

function results(phi: Partial<PhiSummary> = {}, injection: Partial<InjectionSummary> = {}, over: Partial<Results> = {}): Results {
  const set = <T>(name: string, summary: T) => ({ name, sha256: `${name}-hash`, provenance: "", summary });
  return {
    commit: "aaa",
    accepted: [],
    own: {
      author: "A",
      untuned: true,
      changes: [],
      phi: set("PHI", { ...summarizePhi([]), ...phi }),
      injection: set("Prompt injection", { ...summarizeInjection([]), ...injection }),
    },
    external: { phi: [], injection: [] },
    ...over,
  };
}

describe("compareResults", () => {
  it("finds nothing when only the commit and the accepted list differ", () => {
    const base = results({ misses: [miss("p1", "Ann")] });
    const now = { ...results({ misses: [miss("p1", "Ann")] }), commit: "bbb", accepted: [{ commit: "x", reason: "y", items: [] }] };
    expect(compareResults(base, now)).toEqual({ regressions: [], improvements: [], dataChanged: [], outOfDate: false });
  });

  it("fails on one new miss, with no margin", () => {
    const { regressions } = compareResults(results(), results({ misses: [miss("p1", "Ann")] }));
    expect(regressions).toEqual(['PHI: missed in p1 "Ann" (NAME): 0 -> 1']);
  });

  it("fails when a value that was already missed once is missed twice", () => {
    const { regressions } = compareResults(results({ misses: [miss("p1", "Ann")] }), results({ misses: [miss("p1", "Ann"), miss("p1", "Ann")] }));
    expect(regressions).toEqual(['PHI: missed in p1 "Ann" (NAME): 1 -> 2']);
  });

  it("doesn't let a fix pay for a new leak", () => {
    const { regressions, improvements } = compareResults(results({ misses: [miss("p1", "Ann")] }), results({ misses: [miss("p2", "Ben")] }));
    expect(regressions).toHaveLength(1);
    expect(improvements).toHaveLength(1);
  });

  it("fails on a new false label on any row, so recall can't be bought with over-masking", () => {
    const { regressions } = compareResults(results(), results({ falseLabels: [{ rowId: "p1", type: "PERSON" }] }));
    expect(regressions).toEqual(["PHI: labeled PERSON on no PHI in p1: 0 -> 1"]);
  });

  it("fails when a third party starts being labeled as the patient", () => {
    const { regressions } = compareResults(results(), results({ wrongPersonMentions: [{ rowId: "p1", value: "Lopez" }] }));
    expect(regressions).toEqual(['PHI: third party labeled as the patient in p1 "Lopez": 0 -> 1']);
  });

  it.each([
    ["blocked to flagged", {}, { flaggedAttacks: ["a"] }, "blocked -> flagged"],
    ["blocked to allowed", {}, { missedAttacks: ["a"] }, "blocked -> allowed"],
    ["flagged to allowed", { flaggedAttacks: ["a"] }, { missedAttacks: ["a"] }, "flagged -> allowed"],
  ])("fails when an attack weakens from %s", (_, before, after, change) => {
    const { regressions, improvements } = compareResults(results({}, before), results({}, after));
    expect(regressions).toEqual([`Prompt injection: attack a: ${change}`]);
    expect(improvements).toEqual([]);
  });

  it("counts an attack going from allowed to flagged as better", () => {
    const { regressions, improvements } = compareResults(results({}, { missedAttacks: ["a"] }), results({}, { flaggedAttacks: ["a"] }));
    expect(regressions).toEqual([]);
    expect(improvements).toEqual(["Prompt injection: attack a: allowed -> flagged"]);
  });

  it.each([
    ["harmless message newly blocked", { falseBlocks: ["b"] }, "harmless message b: allowed -> blocked"],
    ["harmless message newly flagged", { falseFlags: ["b"] }, "harmless message b: allowed -> flagged"],
    ["record attack reaching the model", { missedRecordAttacks: ["b"] }, "record attack b: removed -> reached the model"],
    ["harmless record text removed", { falseQuarantines: ["b"] }, "harmless record text b: kept -> removed"],
  ])("fails on a %s", (_, after, line) => {
    expect(compareResults(results(), results({}, after)).regressions).toEqual([`Prompt injection: ${line}`]);
  });

  it("calls a change with no item behind it out of date", () => {
    const base = results({ cleanRows: { k: 1, n: 2, low: 0, high: 1 } });
    expect(compareResults(base, results())).toMatchObject({ regressions: [], improvements: [], outOfDate: true });
  });

  it("is out of date when the detectors changed but no score did, so the untuned label can't go stale", () => {
    const base = results();
    const now = results();
    now.own!.untuned = false;
    expect(compareResults(base, now)).toMatchObject({ regressions: [], outOfDate: true });
  });

  it("won't compare rows that changed", () => {
    const base = results({ misses: [miss("p1", "Ann")] });
    const now = results();
    now.own!.phi.sha256 = "other";
    expect(compareResults(base, now)).toMatchObject({ regressions: [], improvements: [], dataChanged: ["PHI"] });
  });

  it("compares external sets too", () => {
    const external = (misses: PhiSummary["misses"]) => ({
      phi: [{ name: "ASQ-PHI", sha256: "h", provenance: "", summary: { ...summarizePhi([]), misses } }],
      injection: [],
    });
    const { regressions } = compareResults(results({}, {}, { external: external([]) }), results({}, {}, { external: external([miss("a1", "Ann")]) }));
    expect(regressions).toEqual(['ASQ-PHI: missed in a1 "Ann" (NAME): 0 -> 1']);
  });
});
