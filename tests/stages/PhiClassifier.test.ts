import { describe, expect, it } from "vitest";
import { ageAt, classifyPhi, detectPhi } from "@/core/phi/classify";
import { resolveLabels } from "@/core/phi/labels";
import { PhiClassifier } from "@/core/stages/PhiClassifier";
import type { PhiLabel } from "@/core/types";
import { ctx, NOW, patient } from "../helpers";

const show = (text: string, labels: PhiLabel[]) => labels.map((l) => [l.type, text.slice(l.start, l.end)]);

async function detect(text: string, id = "pt-001") {
  return show(text, detectPhi(text, await patient(id), NOW));
}

describe("record-aware PHI detection", () => {
  it("matches the patient's name in any case and with a title", async () => {
    expect(await detect("MARIA LOPEZ and Ms. Lopez and Maria")).toEqual([
      ["PATIENT", "MARIA LOPEZ"],
      ["PATIENT", "Ms. Lopez"],
      ["PATIENT", "Maria"],
    ]);
  });

  it("tags the record field on name matches, never the value", async () => {
    const labels = classifyPhi("MARIA LOPEZ", await patient(), NOW);
    expect(labels[0]).toMatchObject({ type: "PATIENT", field: "name", source: "record" });
    expect(JSON.stringify(labels)).not.toMatch(/maria/i);
  });

  it("finds the age right after the name when it matches the DOB", async () => {
    expect(await detect("James Okafor, 71, has COPD", "pt-002")).toEqual([
      ["PATIENT", "James Okafor"],
      ["AGE", "71"],
    ]);
  });

  it("matches the record MRN with or without its prefix", async () => {
    expect(await detect("MRN-100231 / 100231")).toEqual([
      ["MRN", "MRN-100231"],
      ["MRN", "100231"],
    ]);
  });

  it("prefers the full record address over pattern fragments", async () => {
    expect(await detect("Lives at 418 Cedar Hollow Ln, Austin, TX 78745.")).toEqual([
      ["ADDRESS", "418 Cedar Hollow Ln, Austin, TX 78745"],
    ]);
  });

  it("labels other people as PERSON, even when they share the patient's surname", async () => {
    expect(await detect("Daughter Elena Lopez and Dr. Smith")).toEqual([
      ["PERSON", "Elena Lopez"],
      ["PERSON", "Dr. Smith"],
    ]);
  });
});

describe("names that are common words", () => {
  it("does not treat the verb 'will' or a sentence-initial 'Will' as Will Marsh", async () => {
    expect(await detect("He will return. Will warfarin need adjusting? Will is stable.", "pt-004")).toEqual([
      ["PATIENT", "Will"],
    ]);
  });

  it("does not treat 'marsh trail' as the patient", async () => {
    expect(await detect("Lives near the marsh trail.", "pt-004")).toEqual([]);
  });

  it("reads 'April 3, 2026' as a date, not April Moss", async () => {
    expect(await detect("April Moss was seen April 3, 2026.", "pt-003")).toEqual([
      ["PATIENT", "April Moss"],
      ["DATE", "April 3, 2026"],
    ]);
  });
});

describe("resolveLabels", () => {
  it("keeps the longest span, then prefers record over pattern over dictionary", () => {
    const labels: PhiLabel[] = [
      { type: "PATIENT", start: 0, end: 5, confidence: 0.8, source: "record" },
      { type: "DATE", start: 0, end: 13, confidence: 0.85, source: "pattern" },
      { type: "PERSON", start: 20, end: 30, confidence: 0.7, source: "dictionary" },
      { type: "PATIENT", start: 20, end: 30, confidence: 0.97, source: "record" },
    ];
    expect(resolveLabels(labels).map((l) => [l.type, l.source])).toEqual([
      ["DATE", "pattern"],
      ["PATIENT", "record"],
    ]);
  });
});

describe("ageAt", () => {
  it("accounts for whether the birthday has passed", () => {
    expect(ageAt("1968-02-09", new Date("2026-02-08T00:00:00Z"))).toBe(57);
    expect(ageAt("1968-02-09", new Date("2026-02-09T00:00:00Z"))).toBe(58);
  });
});

describe("PhiClassifier stage", () => {
  it("emits labels and counts by type", async () => {
    const { output, span } = await new PhiClassifier().run({ text: "Maria Lopez, 58", patient: await patient() }, ctx());
    expect(output.map((l) => l.type)).toEqual(["PATIENT", "AGE"]);
    expect(span.attributes).toMatchObject({ labels: 2, PATIENT: 1, AGE: 1 });
  });
});


describe("other people who share the patient's surname", () => {
  it("labels a clinician with the patient's surname as PERSON, not the patient", async () => {
    expect(await detect("Referred by Dr. Chen. Dr Chen and Doctor Chen agree.", "pt-007")).toEqual([
      ["PERSON", "Dr. Chen"],
      ["PERSON", "Dr Chen"],
      ["PERSON", "Doctor Chen"],
    ]);
  });

  it("labels a different given name before the surname as one PERSON, with nothing left in the clear", async () => {
    expect(await detect("Suman Chen will drive him home.", "pt-007")).toEqual([["PERSON", "Suman Chen"]]);
    expect(await detect("Pt's brother Suman Chen is the caregiver.", "pt-007")).toEqual([["PERSON", "Suman Chen"]]);
  });

  it("still labels the patient as PATIENT", async () => {
    expect(await detect("Robert Chen and Mr. Chen and Mrs. Chen and Chen", "pt-007")).toEqual([
      ["PATIENT", "Robert Chen"],
      ["PATIENT", "Mr. Chen"],
      ["PATIENT", "Mrs. Chen"],
      ["PATIENT", "Chen"],
    ]);
    expect(await detect("Dr. Maria Lopez, Ms Lopez, Patient Lopez, Pt Lopez. Called Lopez today.")).toEqual([
      ["PATIENT", "Dr. Maria Lopez"],
      ["PATIENT", "Ms Lopez"],
      ["PATIENT", "Lopez"],
      ["PATIENT", "Lopez"],
      ["PATIENT", "Lopez"],
    ]);
  });

  it("does not read a sentence-initial 'Will' as a given name", async () => {
    expect(await detect("Will Chen need insulin?", "pt-007")).toEqual([["PATIENT", "Chen"]]);
  });
});
