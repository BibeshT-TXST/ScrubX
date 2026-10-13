import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatDate,
  formatDose,
  formatMs,
  formatNumber,
  formatRelative,
  formatStamp,
  formatTime,
  sexFromSummary,
  splitDose,
  tallMan,
} from "@/lib/clinical-format";

const at = (h: number, m: number, s = 0) => new Date(2026, 9, 12, h, m, s).getTime();

describe("dates and times", () => {
  it("formats dates as DD-Mmm-YYYY, ISO dates without a time-zone shift", () => {
    expect(formatDate("1968-02-09")).toBe("09-Feb-1968");
    expect(formatDate("2026-12-31")).toBe("31-Dec-2026");
    expect(formatDate(at(9, 5))).toBe("12-Oct-2026");
    expect(formatDate("not a date")).toBe("not a date");
  });

  it("uses 24-hour time", () => {
    expect(formatTime(at(14, 20))).toBe("14:20");
    expect(formatTime(at(9, 5, 7), true)).toBe("09:05:07");
  });

  it("shows absolute and relative time together, with the date only when it isn't today", () => {
    expect(formatStamp(at(14, 20), at(17, 25))).toBe("14:20 · 3 h ago");
    expect(formatStamp(at(14, 20, 5), at(14, 20, 50), true)).toBe("14:20:05 · 45 s ago");
    expect(formatStamp(new Date(2026, 9, 11, 8, 0).getTime(), at(9, 0))).toBe("11-Oct-2026 08:00 · 1 d ago");
  });

  it("rounds relative time down to the unit a clinician reads", () => {
    expect(formatRelative(at(10, 0), at(10, 0, 4))).toBe("just now");
    expect(formatRelative(at(10, 0), at(10, 12, 59))).toBe("12 min ago");
    expect(formatRelative(at(10, 0), at(9, 0))).toBe("just now");
  });
});

describe("demographics", () => {
  const today = new Date(2026, 9, 12);

  it("computes age in years, or months under 2", () => {
    expect(formatAge("1968-02-09", today)).toBe("58 y");
    expect(formatAge("1968-10-13", today)).toBe("57 y");
    expect(formatAge("2019-03-08", today)).toBe("7 y");
    expect(formatAge("2025-04-20", today)).toBe("17 mo");
    expect(formatAge("2030-01-01", today)).toBe("Age unknown");
  });

  it("reads sex from the summary prefix and never guesses", () => {
    expect(sexFromSummary("58F, type 2 diabetes")).toBe("Female");
    expect(sexFromSummary("71M, COPD")).toBe("Male");
    expect(sexFromSummary("Follow-up for migraine")).toBeUndefined();
  });
});

describe("numbers and doses", () => {
  it("keeps the leading zero and drops trailing zeros", () => {
    expect(formatNumber(0.5)).toBe("0.5");
    expect(formatNumber(5.0)).toBe("5");
    expect(formatNumber(0.125, 2)).toBe("0.13");
    expect(formatNumber(-0.0001)).toBe("0");
  });

  it("formats durations with the unit attached", () => {
    expect(formatMs(5)).toBe("5 ms");
    expect(formatMs(0.42)).toBe("0.42 ms");
    expect(formatMs(12.34)).toBe("12.3 ms");
    expect(formatMs(1520.4)).toBe("1520 ms");
    expect(formatMs(0.001)).toBe("< 0.01 ms");
  });

  it("splits a medication into drug and a safe-to-read dose", () => {
    expect(splitDose("metformin 1000 mg")).toEqual({ drug: "metformin", dose: "1000 mg" });
    expect(splitDose("albuterol 90 mcg")).toEqual({ drug: "albuterol", dose: "90 mcg" });
    expect(splitDose("insulin glargine 10 U")).toEqual({ drug: "insulin glargine", dose: "10 units" });
    expect(splitDose("vitamin D")).toEqual({ drug: "vitamin D" });
  });

  it("rewrites trailing zeros, naked decimals and Do-Not-Use units", () => {
    expect(formatDose("5.0 mg")).toBe("5 mg");
    expect(formatDose(".5 mg")).toBe("0.5 mg");
    expect(formatDose("2.50 mg")).toBe("2.5 mg");
    expect(formatDose("10.05 mg")).toBe("10.05 mg");
    expect(formatDose("1000 IU")).toBe("1000 units");
  });

  it("applies Tall Man lettering to look-alike drug names only", () => {
    expect(tallMan("sumatriptan")).toBe("SUMAtriptan");
    expect(tallMan("Hydroxyzine and hydralazine")).toBe("hydrOXYzine and hydrALAZINE");
    expect(tallMan("metformin")).toBe("metformin");
  });
});
