import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { detectPhi } from "@/core/phi/classify";
import { Rehydrator } from "@/core/stages/Rehydrator";
import { Tokenizer } from "@/core/stages/Tokenizer";
import { TokenVault } from "@/core/tokens/TokenVault";
import { DEFAULT_ENTITY_POLICY, rehydrateText, repairTokens, tokenizeText } from "@/core/tokens/tokenize";
import { ctx, NOW, patient } from "../helpers";

async function tokenize(text: string, policy = DEFAULT_ENTITY_POLICY) {
  const p = await patient();
  const vault = new TokenVault();
  return { ...tokenizeText(text, detectPhi(text, p, NOW), vault, p, policy), vault };
}

describe("TokenVault", () => {
  it("gives the same value the same token and numbers per type", () => {
    const v = new TokenVault();
    expect(v.tokenFor("DATE", "03/14/2026")).toBe("[DATE_1]");
    expect(v.tokenFor("DATE", "2026-09-02")).toBe("[DATE_2]");
    expect(v.tokenFor("DATE", "03/14/2026")).toBe("[DATE_1]");
    expect(v.tokenFor("PATIENT", "Maria Lopez")).toBe("[PATIENT_1]");
    expect(v.size).toBe(3);
  });

  it("keys phone numbers and MRNs by digits", () => {
    const v = new TokenVault();
    expect(v.tokenFor("PHONE", "(512) 555-0142")).toBe(v.tokenFor("PHONE", "512-555-0142"));
  });

  it("refuses to serialize or print its values", () => {
    const v = new TokenVault();
    v.tokenFor("PATIENT", "Maria Lopez");
    expect(() => JSON.stringify({ v })).toThrow(/never be serialized/);
    expect(inspect(v)).toBe("TokenVault(1 tokens, values redacted)");
    expect(Object.keys(v)).toEqual([]);
  });
});

describe("tokenizeText", () => {
  it("produces the tokens from the site animation", async () => {
    const { text } = await tokenize("Patient Maria Lopez, age 58, seen 03/14/2026. MRN-100231.");
    expect(text).toBe("Patient [PATIENT_1], age [AGE_1], seen [DATE_1]. [MRN_1].");
  });

  it("stores the record's spelling for record-matched names", async () => {
    const { text, vault } = await tokenize("MARIA LOPEZ and Maria");
    expect(text).toBe("[PATIENT_1] and [PATIENT_1]");
    expect(vault.resolve("[PATIENT_1]")).toBe("Maria Lopez");
  });

  it("leaves conditions in plain text", async () => {
    expect((await tokenize("Maria Lopez has type 2 diabetes")).text).toBe("[PATIENT_1] has type 2 diabetes");
  });

  it("honors keep and bucket policies (ages 90+ collapse to one bucket)", async () => {
    const policy = { ...DEFAULT_ENTITY_POLICY, AGE: "bucket" as const, DATE: "keep" as const };
    expect((await tokenize("a 58-year-old seen 03/14/2026", policy)).text).toBe("a 50-59-year-old seen 03/14/2026");
    expect((await tokenize("a 93-year-old", policy)).text).toBe("a 90+-year-old");
  });
});

describe("rehydrateText", () => {
  it("round-trips text whose PHI is already in record spelling", async () => {
    const original = "Maria Lopez, a 58-year-old seen 03/14/2026 (MRN-100231), call (512) 555-0142. Daughter Elena Lopez.";
    const { text, vault } = await tokenize(original);
    expect(text).not.toMatch(/Maria|Elena|58|2026|100231|555/);
    expect(rehydrateText(text, vault)).toEqual({ text: original, count: 6 });
  });

  it("leaves unknown tokens alone", () => {
    expect(rehydrateText("[PATIENT_9]", new TokenVault())).toEqual({ text: "[PATIENT_9]", count: 0 });
  });
});

describe("Tokenizer and Rehydrator stages", () => {
  it("never puts the vault itself into a snapshot", async () => {
    const p = await patient();
    const text = "Maria Lopez";
    const { output, span } = await new Tokenizer().run({ text, labels: detectPhi(text, p, NOW), patient: p }, ctx());
    expect(() => JSON.stringify(span)).not.toThrow();
    expect(span.output?.data).toEqual({ map: [{ token: "[PATIENT_1]", type: "PATIENT", value: "Maria Lopez" }] });
    expect(span.caption).toBe("Patient details are swapped for 1 token (1 patient).");

    const restored = await new Rehydrator().run({ text: output.text, vault: output.vault }, ctx());
    expect(restored.output.text).toBe("Maria Lopez");
  });
});

describe("repairTokens", () => {
  const vault = () => {
    const v = new TokenVault();
    v.tokenFor("PATIENT", "Maria Lopez");
    v.tokenFor("DATE", "03/14/2026");
    return v;
  };

  it("restores mangled placeholders to tokens the vault issued", () => {
    expect(repairTokens("[PATIENT 1] on [date_1], [ PATIENT-1 ] and PATIENT_1 and [PATIENT_1", vault())).toEqual({
      text: "[PATIENT_1] on [DATE_1], [PATIENT_1] and [PATIENT_1] and [PATIENT_1]",
      repaired: 5,
    });
  });

  it("leaves canonical tokens, unknown tokens and ordinary words alone", () => {
    const text = "[PATIENT_1] saw [PATIENT 9]; date 2 of therapy, age 58, Patient_1 notes.";
    expect(repairTokens(text, vault())).toEqual({ text, repaired: 0 });
  });
});
