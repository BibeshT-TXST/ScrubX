import { describe, expect, it } from "vitest";
import { matchesPatient } from "@/lib/patient-search";

const will = { id: "pt-004", name: "Will Marsh", dob: "1949-11-03", mrn: "MRN-100689", summary: "76M, atrial fibrillation" };

describe("matchesPatient", () => {
  it("matches name, MRN digits and date of birth in either format", () => {
    for (const q of ["will", "MARSH", "100689", "mrn-100689", "1949-11-03", "03-nov-1949", "nov 1949"]) {
      expect(matchesPatient(will, q)).toBe(true);
    }
  });

  it("needs every word to match, and an empty query matches all", () => {
    expect(matchesPatient(will, "will lopez")).toBe(false);
    expect(matchesPatient(will, "   ")).toBe(true);
  });

  it("doesn't search the clinical summary", () => {
    expect(matchesPatient(will, "fibrillation")).toBe(false);
  });
});
