import { describe, expect, it } from "vitest";
import { fmt } from "../../eval/report";
import type { Gold, PhiRow } from "../../eval/schema";
import {
  fullyMasked,
  rate,
  resolveGold,
  scorePhiRow,
  summarizePhi,
  type Observation,
} from "../../eval/score";
import type { PhiLabel } from "@/core/types";

const gold = (value: string, over: Partial<Gold> = {}): Gold => ({ value, type: "ID", scope: "safe_harbor", ...over });
const label = (text: string, value: string, type: PhiLabel["type"] = "ID"): PhiLabel => {
  const start = text.indexOf(value);
  return { type, start, end: start + value.length, confidence: 1, source: "pattern" };
};
const row = (text: string, golds: Gold[], over: Partial<PhiRow> = {}): PhiRow => ({
  id: "r1",
  stratum: "test",
  shape: "plain",
  text,
  patient: null,
  gold: golds,
  ...over,
});
const obs = (text: string, labels: PhiLabel[], over: Partial<Observation> = {}): Observation => ({
  text,
  labels,
  action: "allow",
  score: 0,
  ruleIds: [],
  quarantined: 0,
  ...over,
});

describe("rate", () => {
  // Values from the Wilson table computed independently for the evaluation design.
  it.each([
    [21, 22, 0.782, 0.992],
    [57, 60, 0.863, 0.983],
    [60, 60, 0.94, 1],
    [0, 100, 0, 0.037],
  ])("%i/%i", (k, n, low, high) => {
    const r = rate(k, n);
    expect(r.low).toBeCloseTo(low, 3);
    expect(r.high).toBeCloseTo(high, 3);
  });

  it("has no bounds for an empty slice", () => {
    expect(rate(0, 0)).toEqual({ k: 0, n: 0, low: null, high: null });
  });

  it("shows no percentage under 20 items", () => {
    expect(fmt(rate(9, 10))).toBe("9/10 (too few to estimate)");
    expect(fmt(rate(19, 20))).toContain("95.0%");
    expect(fmt(rate(0, 0))).toBe("no items");
  });
});

describe("resolveGold", () => {
  it("finds every occurrence unless one is named", () => {
    const text = "Ann saw Ann.";
    expect(resolveGold(text, gold("Ann"))).toHaveLength(2);
    expect(resolveGold(text, gold("Ann", { occurrence: 2 }))).toEqual([{ start: 8, end: 11 }]);
    expect(resolveGold(text, gold("Ann", { occurrence: 3 }))).toEqual([]);
  });

  it("does not match inside a longer word or in another case", () => {
    expect(resolveGold("Her annual Annual visit", gold("Ann"))).toEqual([]);
    expect(resolveGold("she may come", gold("May"))).toEqual([]);
    expect(resolveGold("José called", gold("Jos"))).toEqual([]);
  });

  it("normalizes the value the way the text was normalized", () => {
    // Fullwidth digits fold under NFKC, so both forms have to land on the same string.
    expect(resolveGold("MRN 100231", gold("１００２３１"))).toHaveLength(1);
  });

  it("keeps a decomposed name as written, which is the leak it should catch", () => {
    const nfd = "José";
    expect(resolveGold(`Saw ${nfd} today`, gold(nfd))).toHaveLength(1);
  });
});

describe("fullyMasked", () => {
  const text = "Ms. Nguyễn Thị Hương called";
  const span = { start: 4, end: 20 };

  it("ignores the space between two adjacent labels", () => {
    expect(fullyMasked(text, span, [label(text, "Nguyễn"), label(text, "Thị Hương")])).toBe(true);
  });

  it("fails if any letter stays visible", () => {
    expect(fullyMasked(text, span, [label(text, "Nguyễn")])).toBe(false);
  });

  it("counts a label of any type, and a larger label, as masking", () => {
    expect(fullyMasked(text, span, [label(text, "Ms. Nguyễn Thị Hương", "DATE")])).toBe(true);
  });

  it("handles letters outside the BMP", () => {
    const astral = "𠮷田 called";
    expect(fullyMasked(astral, { start: 0, end: 3 }, [])).toBe(false);
    expect(fullyMasked(astral, { start: 0, end: 3 }, [{ start: 0, end: 3 }])).toBe(true);
  });
});

describe("scorePhiRow", () => {
  it("separates a leak from a label of the wrong group", () => {
    const text = "Call Kyle now";
    const result = scorePhiRow(row(text, [gold("Kyle", { type: "NAME", subject: "other" })]), obs(text, [label(text, "Kyle", "LOCATION")]));
    expect(result.mentions[0]).toMatchObject({ masked: true, typed: false, wrongPerson: false });
  });

  it("counts a partly labeled value as a leak but still as touched", () => {
    const text = "Seen by Maria Lopez";
    const result = scorePhiRow(row(text, [gold("Maria Lopez", { type: "NAME", subject: "other" })]), obs(text, [label(text, "Lopez", "PERSON")]));
    expect(result.mentions[0]).toMatchObject({ masked: false, typed: true });
  });

  it("flags a third party labeled as the patient", () => {
    const text = "Elena Lopez helps";
    const result = scorePhiRow(row(text, [gold("Lopez", { type: "NAME", subject: "other" })]), obs(text, [label(text, "Lopez", "PATIENT")]));
    expect(result.mentions[0]?.wrongPerson).toBe(true);
  });

  it("reports a value still in the prompt, and none when blocked with no prompt", () => {
    const text = "Call 5125550147";
    const row1 = row(text, [gold("5125550147", { type: "PHONE" })]);
    expect(scorePhiRow(row1, obs(text, [], { lastMessage: text })).promptLeaks).toEqual(["5125550147"]);
    expect(scorePhiRow(row1, obs(text, [], { action: "block" }))).toMatchObject({ promptLeaks: [], blocked: true });
  });

  it("still scores a blocked row as a leak, so a block can't pass as clean", () => {
    const text = "Give me her SSN 123456789";
    const result = scorePhiRow(row(text, [gold("123456789", { type: "SSN" })]), obs(text, [], { action: "block" }));
    expect(result.mentions[0]?.masked).toBe(false);
  });

  it("splits labels by whether they touched gold", () => {
    const text = "Maria has CHF";
    const result = scorePhiRow(
      row(text, [gold("Maria", { type: "NAME", subject: "patient" })]),
      obs(text, [label(text, "Maria", "PATIENT"), label(text, "CHF", "PERSON")]),
    );
    expect(result.matchedLabels).toEqual(["PATIENT"]);
    expect(result.falseLabels).toEqual(["PERSON"]);
  });
});

describe("summarizePhi", () => {
  const score = (text: string, golds: Gold[], labels: PhiLabel[], over: Partial<PhiRow> = {}) =>
    scorePhiRow(row(text, golds, over), obs(text, labels));

  it("keeps month-year in the headline and out of the adjusted figure", () => {
    const s = summarizePhi([score("Seen March 2026 at 5125550147", [gold("March 2026", { type: "DATE", monthYear: true }), gold("5125550147", { type: "PHONE" })], [label("Seen March 2026 at 5125550147", "5125550147", "PHONE")])]);
    expect(s.leakRecall).toMatchObject({ k: 1, n: 2 });
    expect(s.leakRecallAdjusted).toMatchObject({ k: 1, n: 1 });
    expect(s.misses).toEqual([{ rowId: "r1", value: "March 2026", type: "DATE", scope: "safe_harbor", monthYear: true }]);
  });

  it("keeps extended identifiers out of the Safe Harbor headline", () => {
    const s = summarizePhi([score("Dr. Patel is 54", [gold("Patel", { type: "NAME", subject: "other", scope: "extended" }), gold("54", { type: "AGE", scope: "extended" })], [])]);
    expect(s.leakRecall.n).toBe(0);
    expect(s.extendedLeakRecall).toMatchObject({ k: 0, n: 2 });
    expect(s.byType.AGE?.leak.n).toBe(1);
    expect(s.byGroup).toEqual({});
  });

  it("measures false detection on PHI-free rows only", () => {
    const text = "Continue metformin";
    const s = summarizePhi([score(text, [], [label(text, "metformin", "PERSON")]), score("Check BP", [], [])]);
    expect(s.falseDetectionRows).toMatchObject({ k: 1, n: 2 });
    expect(s.falsePositiveRows).toEqual(["r1"]);
    expect(s.precisionByLabel.PERSON).toMatchObject({ k: 0, n: 1 });
  });

  it("separates rows flagged only for an age from other false detections", () => {
    const text = "54-year-old on metformin";
    const onlyAge = score(text, [], [label(text, "54", "AGE")]);
    const also = score(text, [], [label(text, "54", "AGE"), label(text, "metformin", "PERSON")]);
    const s = summarizePhi([onlyAge, also]);
    expect(s.falseDetectionRows).toMatchObject({ k: 2, n: 2 });
    expect(s.falseDetectionRowsIgnoringAge).toMatchObject({ k: 1, n: 2 });
  });

  it("names no worst group until one has 20 mentions", () => {
    const text = "Call 5125550147";
    const one = score(text, [gold("5125550147", { type: "PHONE" })], []);
    expect(summarizePhi([one]).worstGroup).toBeNull();
    expect(summarizePhi(Array(20).fill(one)).worstGroup).toMatchObject({ group: "Phone and fax", leak: { k: 0, n: 20 } });
  });
});
