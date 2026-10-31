import { describe, expect, it } from "vitest";
import type { LLMProvider, Prompt } from "@/core/providers/LLMProvider";
import { MockProvider } from "./support/MockProvider";
import { OPEN_GAPS, PLANTS, type Plant } from "./support/plants";
import { patient, pipeline, request } from "./helpers";

class SpyProvider implements LLMProvider {
  readonly name = "spy";
  readonly prompts: Prompt[] = [];
  private readonly inner = new MockProvider();
  complete(prompt: Prompt) {
    this.prompts.push(prompt);
    return this.inner.complete(prompt);
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Unicode-aware edges: "José" must be found even though JS `\b` treats "é" as a non-word character.
const plantedRe = (v: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escape(v)}(?![\\p{L}\\p{M}\\p{N}])`, "iu");

async function sentToModel(plant: Plant): Promise<string> {
  const p = typeof plant.patient === "object" ? plant.patient : await patient(plant.patient);
  const spy = new SpyProvider();
  const result = await pipeline({ llm: spy }).run(await request(plant.message, { patient: p }));
  expect(result.outcome, "a planted message should be answered, not blocked").toBe("answered");
  return spy.prompts.flatMap((pr) => pr.messages.map((m) => m.content)).join("\n");
}

async function expectNoLeak(plant: Plant) {
  const sent = await sentToModel(plant);
  for (const v of plant.planted) expect(sent, `leaked ${JSON.stringify(v)}`).not.toMatch(plantedRe(v));
}

describe("planted identifiers never reach the model", () => {
  for (const [category, plants] of Object.entries(PLANTS)) {
    describe(category, () => {
      it.each(plants.map((p) => [p.message, p] as const))("%s", (_, plant) => expectNoLeak(plant));
    });
  }

  describe("known gaps (expected to leak until fixed)", () => {
    for (const plant of OPEN_GAPS) it.fails(plant.message, () => expectNoLeak(plant));
  });
});
