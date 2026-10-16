import { describe, expect, it } from "vitest";
import type { LLMProvider, Prompt } from "@/core/providers/LLMProvider";
import { MockProvider } from "./support/MockProvider";
import type { PatientContext } from "@/core/types";
import { CASES } from "./adversarial/cases";
import { DEMO_IDS, patient, pipeline, request } from "./helpers";
import { COMMON_WORD_NAMES } from "@/core/phi/dictionaries";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Unicode-aware word edges: JS `\b` has no boundary after "é".
const word = (s: string, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escape(s)}(?![\\p{L}\\p{M}\\p{N}])`, flags);

/** The record's DOB written the ways people write dates. Derived from the record, not the detector. */
function dobForms(dob: string): string[] {
  const [y, m, d] = dob.split("-");
  const month = MONTHS[Number(m) - 1]!;
  return [dob, `${m}/${d}/${y}`, `${+m!}/${+d!}/${y}`, `${m}-${d}-${y}`, `${month} ${+d!}, ${y}`, `${+d!} ${month} ${y}`];
}

/** The record's phone as digits, with any separators between the groups. */
const phoneDigits = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return new RegExp(`${d.slice(0, 3)}\\D{0,2}${d.slice(3, 6)}\\D?${d.slice(6)}`);
};


/**
 * Every identifying value on the record, in every case and the usual formats.
 * Built from the record alone, so a value the detector misses still fails the test.
 * Name parts that are ordinary words ("will", "marsh") only count when capitalized,
 * since "he will return" is allowed through. Vault values are an extra check, not the oracle.
 */
function phiPatterns(p: PatientContext, tokenMap: unknown): RegExp[] {
  const { name, dob, mrn, phone, address } = p.fields;
  const fromVault = ((tokenMap as { map?: { value: string }[] })?.map ?? []).map((t) => t.value);
  const full = [name, mrn, address, ...dobForms(dob), ...fromVault].filter((v): v is string => !!v && v.length > 3);
  return [
    ...full.map((v) => word(v)),
    ...(phone ? [phoneDigits(phone)] : []),
    ...name.split(/[\s-]+/).map((part) => word(part, COMMON_WORD_NAMES.has(part.toLowerCase()) ? "u" : "iu")),
  ];
}

const MESSAGES = (p: PatientContext) => {
  const { name, mrn, dob, phone } = p.fields;
  const [first, ...rest] = name.split(" ");
  const last = rest.at(-1)!;
  return [
    `Summarize ${name}'s recent visit.`,
    `${name.toUpperCase()} (${mrn}, DOB ${dob}) called from ${phone ?? "home"}. Next steps?`,
    // The same identifiers in the forms clinicians actually type.
    `${first!.toLowerCase()} ${last.toLowerCase()} was born ${dobForms(dob)[4]}; callback ${phone?.replace(/\D/g, "") ?? "none"}.`,
    `${last.toUpperCase()} again, DOB ${dobForms(dob)[1]}, also wrote ${dobForms(dob)[5]}.`,
    ...CASES.map((c) => c.message),
  ];
};

class SpyProvider implements LLMProvider {
  readonly name = "spy";
  readonly prompts: Prompt[] = [];
  private readonly inner = new MockProvider();
  complete(prompt: Prompt) {
    this.prompts.push(prompt);
    return this.inner.complete(prompt);
  }
}

describe("invariants across every demo patient and every adversarial message", () => {
  it.each(DEMO_IDS)("%s: audit lines contain no PHI, and the LLM never sees PHI", async (id) => {
    const p = await patient(id);
    for (const message of MESSAGES(p)) {
      const lines: string[] = [];
      const spy = new SpyProvider();
      const result = await pipeline({ auditSink: (l) => lines.push(l), llm: spy }).run(await request(message, { patient: p }));
      const tokenMap = result.trace.spans.find((s) => s.stage === "Tokenizer")?.output?.data;

      const audit = lines.join("\n");
      const sent = JSON.stringify(spy.prompts);
      for (const re of phiPatterns(p, tokenMap)) {
        expect(audit, `audit leaked ${re}`).not.toMatch(re);
        expect(sent, `prompt leaked ${re}`).not.toMatch(re);
      }
    }
  });

  it("blocked requests never reach the LLM", async () => {
    for (const c of CASES.filter((c) => c.expected === "block")) {
      const spy = new SpyProvider();
      const result = await pipeline({ llm: spy }).run(await request(c.message));
      expect(result.outcome).toBe("blocked");
      expect(spy.prompts).toHaveLength(0);
    }
  });

  it("rehydrate(tokenize(x)) restores every token the model echoes back", async () => {
    for (const id of DEMO_IDS) {
      const p = await patient(id);
      const echo = new MockProvider({ respond: (prompt) => prompt.messages.at(-1)!.content });
      const message = `${p.fields.name} (${p.fields.mrn}) was seen ${p.fields.dob}; call ${p.fields.phone ?? "n/a"}.`;
      const result = await pipeline({ llm: echo }).run(await request(message, { patient: p }));
      expect(result.response).toBe(message);
      expect(result.audit.tokensRehydrated).toBeGreaterThanOrEqual(3);
    }
  });
});
