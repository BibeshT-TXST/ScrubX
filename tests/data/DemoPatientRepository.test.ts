import { describe, expect, it } from "vitest";
import { DemoPatientRepository } from "@/core/data/DemoPatientRepository";
import demoPatients from "../../data/patients.demo.json";

describe("DemoPatientRepository", () => {
  const repo = new DemoPatientRepository();

  it("lists every demo patient with two identifiers but without the full record", async () => {
    const list = await repo.list();
    expect(list).toHaveLength(demoPatients.length);
    expect(list[0]).toEqual({
      id: "pt-001",
      name: "Maria Lopez",
      dob: "1968-02-09",
      mrn: "MRN-100231",
      summary: "58F, type 2 diabetes, rising HbA1c",
    });
    expect(list[0]).not.toHaveProperty("fields");
  });

  it("gets a full patient context by id, without the summary", async () => {
    const p = await repo.get("pt-001");
    expect(p?.fields.mrn).toBe("MRN-100231");
    expect(p).not.toHaveProperty("summary");
  });

  it("returns null for an unknown id", async () => {
    expect(await repo.get("nope")).toBeNull();
  });

  it("rejects malformed records", () => {
    expect(() => new DemoPatientRepository([{ id: "x" }])).toThrow();
  });

  it("rejects duplicate ids", () => {
    const one = demoPatients[0];
    expect(() => new DemoPatientRepository([one, one])).toThrow(/Duplicate/);
  });

  // The plan calls for these adversarial fixtures; keep them from silently disappearing.
  it("includes the deliberately tricky fixtures", () => {
    const text = demoPatients.map((p) => p.description).join("\n");
    expect(text).toMatch(/ignore all previous instructions/i);
    expect(text).toContain("​");
    expect(text).toMatch(/<!--/);
    expect(text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).toMatch(/[A-Z][a-z]+ \d{1,2}, \d{4}/);
  });
});
