import { describe, expect, it } from "vitest";
import { GeminiProvider } from "@/core/providers/GeminiProvider";
import { ProviderError } from "@/core/providers/LLMProvider";
import { buildPrompt } from "@/core/providers/prompt";

const prompt = buildPrompt({
  context: "Name: [PATIENT_1]",
  history: [
    { role: "user", content: "How is [PATIENT_1]?" },
    { role: "assistant", content: "Stable." },
  ],
  message: "Any medication changes?",
});

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ok = (parts: { text: string; thought?: boolean }[], extra = {}) => ({
  candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30 },
  modelVersion: "gemini-3.8-flash-001",
  ...extra,
});

describe("GeminiProvider", () => {
  it("sends the tokenized prompt to generateContent with the key in a header", async () => {
    const { impl, calls } = fakeFetch(200, ok([{ text: "Hi" }]));
    await new GeminiProvider({ apiKey: "secret-key", fetch: impl }).complete(prompt);

    const { url, init } = calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");

    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe(prompt.system);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "How is [PATIENT_1]?" }] },
      { role: "model", parts: [{ text: "Stable." }] },
      { role: "user", parts: [{ text: "Any medication changes?" }] },
    ]);
    expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "low" } });
  });

  it("honors a model override", async () => {
    const { impl, calls } = fakeFetch(200, ok([{ text: "Hi" }]));
    await new GeminiProvider({ apiKey: "k", model: "gemini-3.5-flash-lite", fetch: impl }).complete(prompt);
    expect(calls[0]!.url).toContain("/models/gemini-3.5-flash-lite:generateContent");
  });

  it("returns the answer text without thought parts, plus usage and model version", async () => {
    const { impl } = fakeFetch(200, ok([{ text: "reasoning…", thought: true }, { text: "[PATIENT_1] " }, { text: "is stable." }]));
    expect(await new GeminiProvider({ apiKey: "k", fetch: impl }).complete(prompt)).toEqual({
      text: "[PATIENT_1] is stable.",
      model: "gemini-3.8-flash-001",
      usage: { inputTokens: 120, outputTokens: 30 },
    });
  });

  it("surfaces API errors with status, without echoing the key", async () => {
    const { impl } = fakeFetch(400, { error: { status: "INVALID_ARGUMENT", message: "API key not valid." } });
    const call = new GeminiProvider({ apiKey: "secret-key", fetch: impl }).complete(prompt);
    await expect(call).rejects.toThrow(ProviderError);
    await expect(call).rejects.toThrow("Gemini request failed (400 INVALID_ARGUMENT): API key not valid.");
    await expect(call).rejects.not.toThrow(/secret-key/);
  });

  it("reports a blocked prompt and an empty answer distinctly", async () => {
    const blocked = fakeFetch(200, { promptFeedback: { blockReason: "SAFETY" } });
    await expect(new GeminiProvider({ apiKey: "k", fetch: blocked.impl }).complete(prompt)).rejects.toThrow(
      "Gemini blocked the prompt (SAFETY)",
    );
    const empty = fakeFetch(200, { candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] });
    await expect(new GeminiProvider({ apiKey: "k", fetch: empty.impl }).complete(prompt)).rejects.toThrow(
      "Gemini returned no text (finishReason: MAX_TOKENS)",
    );
  });

  it("aborts when the caller's signal fires", async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    const controller = new AbortController();
    const call = new GeminiProvider({ apiKey: "k", fetch: hanging }).complete(prompt, { signal: controller.signal });
    controller.abort(new Error("client went away"));
    await expect(call).rejects.toThrow("client went away");
  });

  it("times out instead of hanging the request", async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    await expect(new GeminiProvider({ apiKey: "k", fetch: hanging, timeoutMs: 20, retries: 0 }).complete(prompt)).rejects.toThrow(/timed? ?out/i);
  });
});

describe("GeminiProvider retries", () => {
  // Replays a script of statuses; each call records the model it targeted.
  function scripted(statuses: number[]) {
    const models: string[] = [];
    const impl = (async (url: string) => {
      models.push(url.split("/models/")[1]!.split(":")[0]!);
      const status = statuses[models.length - 1] ?? 200;
      const body = status === 200 ? ok([{ text: "fine" }]) : { error: { status: "UNAVAILABLE", message: "high demand" } };
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { impl, models };
  }
  const provider = (impl: typeof fetch, extra = {}) => new GeminiProvider({ apiKey: "k", fetch: impl, retryDelayMs: 1, ...extra });

  it("retries a transient 503 on the same model", async () => {
    const { impl, models } = scripted([503, 200]);
    expect((await provider(impl).complete(prompt)).text).toBe("fine");
    expect(models).toEqual(["gemini-3.8-flash", "gemini-3.8-flash"]);
  });

  it("makes the last attempt on the lighter fallback model", async () => {
    const { impl, models } = scripted([503, 429, 200]);
    await provider(impl).complete(prompt);
    expect(models).toEqual(["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]);
  });

  it("gives up after the last attempt with the last error", async () => {
    const { impl, models } = scripted([503, 503, 503]);
    await expect(provider(impl, { fallbackModel: null }).complete(prompt)).rejects.toThrow("Gemini request failed (503 UNAVAILABLE): high demand");
    expect(models).toEqual(["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash"]);
  });

  it("never retries caller errors such as a bad key", async () => {
    const { impl, models } = scripted([400]);
    await expect(provider(impl).complete(prompt)).rejects.toThrow(/400/);
    expect(models).toHaveLength(1);
  });

  it("retries per-attempt timeouts but stops at the overall deadline", async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
    const started = Date.now();
    await expect(provider(hanging, { timeoutMs: 30, deadlineMs: 80 }).complete(prompt)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(500);
  });
});
