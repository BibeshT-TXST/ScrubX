import { describe, expect, it, vi } from "vitest";
import { ProviderError, type LLMProvider } from "@/core";
import { DailyCapProvider } from "@/server/DailycapProvider";
import { createCounter } from "@/server/rate-limit";

const PROMPT = { system: "s", messages: [] };

function capped(cap: number) {
  const complete = vi.fn(async () => ({ text: "answer", model: "m" }));
  const inner: LLMProvider = { name: "gemini", complete };
  return { complete, provider: new DailyCapProvider(inner, cap, createCounter()) };
}

describe("DailyCapProvider", () => {
  it("passes calls through under the cap and keeps the real provider's name", async () => {
    const { provider, complete } = capped(2);
    expect(provider.name).toBe("gemini");
    expect(await provider.complete(PROMPT)).toMatchObject({ text: "answer" });
    expect(complete).toHaveBeenCalledWith(PROMPT, undefined);
  });

  it("fails like a down model past the cap, without calling the model", async () => {
    const { provider, complete } = capped(2);
    await provider.complete(PROMPT);
    await provider.complete(PROMPT);
    await expect(provider.complete(PROMPT)).rejects.toBeInstanceOf(ProviderError);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
