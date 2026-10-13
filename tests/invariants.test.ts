import { describe, expect, it } from "vitest";
import type { LLMProvider, Prompt } from "@/core/providers/LLMProvider";
import { MockProvider } from "./support/MockProvider";
import type { PatientContext } from "@/core/types";
import { CASES } from "./adversarial/cases";
import { DEMO_IDS, patient, pipeline, request } from "./helpers";

/**
 * Every identifying value on the record plus whatever the tokenizer put in the vault.
 * Full values match case-insensitively; single name parts match as capitalized words,
 * since "will" the verb is not Will Marsh.
 */
function phiPatterns(p: PatientContext, tokenMap: unknown): RegExp[] {
  const { name, dob, mrn, phone, address } = p.fields;
  const fromVault = ((tokenMap as { map?: { value: string }[] })?.map ?? []).map((t) => t.value);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const full = [name, dob, mrn, phone, address, ...fromVault].filter((v): v is string => !!v && v.length > 3);
  return [
    ...full.map((v) => new RegExp(escape(v), "i")),
    ...name.split(" ").map((part) => new RegExp(`\\b${escape(part)}\\b`)),
  ];
}

const MESSAGES = (p: PatientContext) => [
  `Summarize ${p.fields.name}'s recent visit.`,
  `${p.fields.name.toUpperCase()} (${p.fields.mrn}, DOB ${p.fields.dob}) called from ${p.fields.phone ?? "home"}. Next steps?`,
  ...CASES.map((c) => c.message),
];

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
