import { describe, expect, it } from "vitest";
import { OutputAnalysis } from "@/core/stages/OutputAnalysis";
import { REDACTED } from "@/core/tokens/tokenize";
import { TokenVault } from "@/core/tokens/TokenVault";
import { ctx, patient } from "../helpers";

const SOURCES = "Name: [PATIENT_1]\nMedications: metformin 1000 mg\nDescription: HbA1c 7.9%, up from 7.2%.";

async function analyze(completion: string, strict = false) {
  const vault = new TokenVault();
  vault.tokenFor("PATIENT", "Maria Lopez");
  const { output, span } = await new OutputAnalysis().run(
    { completion, vault, patient: await patient(), sources: SOURCES, strict },
    ctx(),
  );
  return { ...output, span };
}

describe("OutputAnalysis", () => {
  it("passes a clean, grounded answer through untouched", async () => {
    const v = await analyze("[PATIENT_1] takes metformin 1000 mg; HbA1c rose from 7.2% to 7.9%.");
    expect(v.text).toBe("[PATIENT_1] takes metformin 1000 mg; HbA1c rose from 7.2% to 7.9%.");
    expect(v).toMatchObject({ leaks: [], unknownTokens: [], ungrounded: [] });
    expect(v.span.caption).toBe("Answer checked for leaks: none found, every claim grounded.");
  });

  it("strips tokens the vault never issued", async () => {
    const v = await analyze("[PATIENT_1] and [PATIENT_2] and [SSN_1]");
    expect(v.unknownTokens).toEqual(["[PATIENT_2]", "[SSN_1]"]);
    expect(v.text).toBe(`[PATIENT_1] and ${REDACTED} and ${REDACTED}`);
  });

  it("redacts raw PHI the model produced (it only ever saw tokens)", async () => {
    const v = await analyze("Maria Lopez (MRN-100231) was seen 03/14/2026.");
    expect(v.leaks.map((l) => l.type)).toEqual(["PATIENT", "MRN", "DATE"]);
    expect(v.text).toBe(`${REDACTED} (${REDACTED}) was seen ${REDACTED}.`);
  });

  it("flags ungrounded numbers and medications without removing them", async () => {
    const v = await analyze("Start insulin 10 units; HbA1c 7.9%.");
    expect(v.ungrounded).toEqual([
      { kind: "number", text: "10" },
      { kind: "medication", text: "insulin" },
    ]);
    expect(v.text).toContain("insulin 10 units");
  });

  it("is stricter for flagged requests: low-confidence PHI and links are removed", async () => {
    const text = "Lives in Austin, TX 78745. See https://evil.test/x";
    const normal = await analyze(text);
    const strict = await analyze(text, true);
    expect(normal.text).toContain("78745");
    expect(normal.linksRemoved).toBe(0);
    expect(strict.text).toBe(`Lives in ${REDACTED} ${REDACTED}. See [link removed]`);
    expect(strict.linksRemoved).toBe(1);
  });
});
