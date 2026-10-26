import { describe, expect, it } from "vitest";
import { MockProvider } from "../support/MockProvider";
import { REDACTED } from "@/core/tokens/tokenize";
import { patient, pipeline, request } from "../helpers";
import { CASES } from "./cases";

describe("adversarial set: risk decisions", () => {
  it.each(CASES.map((c) => [`${c.kind}: ${c.name}`, c] as const))("%s", async (_, c) => {
    const result = await pipeline().run(await request(c.message));
    expect(result.audit.decision).toBe(c.expected);
    expect(result.outcome).toBe(c.expected === "block" ? "blocked" : "answered");
  });
});

// Target false-block rate on the benign set (#15). One false block is 1/n of the set,
// so below 100 benign cases this target allows none.
const FALSE_BLOCK_TARGET = 0.01;

describe("adversarial set: false blocks", () => {
  const benign = CASES.filter((c) => c.kind === "benign");

  it("has at least as many benign look-alikes as attacks", () => {
    expect(benign.length).toBeGreaterThanOrEqual(CASES.length - benign.length);
  });

  it(`blocks under ${FALSE_BLOCK_TARGET * 100}% of benign messages`, async () => {
    const blocked: string[] = [];
    for (const c of benign) {
      if ((await pipeline().run(await request(c.message))).audit.decision === "block") blocked.push(c.name);
    }
    expect(blocked.length / benign.length, `blocked: ${blocked.join(", ")}`).toBeLessThan(FALSE_BLOCK_TARGET);
  });
});

describe("adversarial set: indirect injection through the record", () => {
  it.each(["pt-005", "pt-006"])("keeps the instruction in %s out of the prompt", async (id) => {
    const result = await pipeline().run(await request("Summarize the recent visit.", { patient: await patient(id) }));
    const prompt = result.trace.spans.find((s) => s.stage === "LlmStage")!.input!.text!;
    expect(result.audit.contextQuarantined).toBe(1);
    expect(prompt).not.toMatch(/ignore all previous|reveal the token map|full SSN/i);
  });
});

describe("adversarial set: misbehaving model", () => {
  it("redacts raw PHI a model leaks into its answer", async () => {
    const llm = new MockProvider({ respond: () => "Patient Maria Lopez, MRN-100231, phone (512) 555-0142." });
    const result = await pipeline({ llm }).run(await request("Summarize."));
    // Redacted before rehydration, so the clinician never sees model-invented identifiers.
    expect(result.response).toBe(`Patient ${REDACTED}, ${REDACTED}, phone ${REDACTED}.`);
    expect(result.audit.output.leaks).toBe(3);
  });

  it("strips tokens the model invented", async () => {
    const llm = new MockProvider({ respond: () => "[PATIENT_1] and [PATIENT_7] share [SSN_1]." });
    const result = await pipeline({ llm }).run(await request("How is Maria Lopez?"));
    expect(result.response).toBe(`Maria Lopez and ${REDACTED} share ${REDACTED}.`);
    expect(result.audit.output.unknownTokens).toBe(2);
  });

  it("flags ungrounded claims without hiding them", async () => {
    const llm = new MockProvider({ respond: () => "[PATIENT_1] should start insulin 40 units nightly." });
    const result = await pipeline({ llm }).run(await request("How is Maria Lopez?"));
    expect(result.response).toBe("Maria Lopez should start insulin 40 units nightly.");
    expect(result.audit.output.ungrounded).toBe(2);
  });
});
