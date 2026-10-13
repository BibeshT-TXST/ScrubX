import { ProviderError, type Completion, type LLMProvider, type Prompt } from "./LLMProvider";

export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
/** Used for the last retry: a lighter model is usually available when the main one is overloaded. */
export const GEMINI_DEFAULT_FALLBACK = "gemini-3.5-flash-lite";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Transient per Google's guidance: retry with backoff. Other 4xx are caller errors.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  /** Model for the final retry; null disables the fallback. */
  fallbackModel?: string | null;
  thinkingLevel?: ThinkingLevel;
  temperature?: number;
  /** Counts thinking tokens too, so leave headroom. */
  maxOutputTokens?: number;
  /** Retries after the first attempt, for transient failures only. */
  retries?: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Budget for all attempts together; keep below the route's maxDuration. */
  deadlineMs?: number;
  /** Base backoff; doubles per retry, plus jitter. */
  retryDelayMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
  error?: { message?: string; status?: string };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/**
 * Google Gemini over the REST generateContent endpoint. Plain fetch, no SDK,
 * so the core stays dependency-free. The key travels in a header, never the
 * URL, so it can't end up in logs or error messages. Transient failures are
 * retried with exponential backoff, the last attempt on a lighter model.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly models: string[];

  constructor(private readonly opts: GeminiProviderOptions) {
    const primary = opts.model ?? GEMINI_DEFAULT_MODEL;
    const fallback = opts.fallbackModel === undefined ? GEMINI_DEFAULT_FALLBACK : opts.fallbackModel;
    const attempts = 1 + (opts.retries ?? 2);
    this.models = Array.from({ length: attempts }, (_, i) =>
      i === attempts - 1 && attempts > 1 && fallback && fallback !== primary ? fallback : primary,
    );
  }

  async complete(prompt: Prompt, { signal }: { signal?: AbortSignal } = {}): Promise<Completion> {
    const deadline = AbortSignal.timeout(this.opts.deadlineMs ?? 50_000);
    const outer = signal ? AbortSignal.any([signal, deadline]) : deadline;
    let lastError: unknown;

    for (const [attempt, model] of this.models.entries()) {
      if (attempt > 0) {
        const base = (this.opts.retryDelayMs ?? 1000) * 2 ** (attempt - 1);
        await sleep(base + Math.random() * base * 0.25, outer);
      }
      try {
        return await this.attempt(model, prompt, AbortSignal.any([outer, AbortSignal.timeout(this.opts.timeoutMs ?? 20_000)]));
      } catch (err) {
        lastError = err;
        // The caller left or the overall budget ran out: stop. Only transient errors earn a retry.
        if (outer.aborted) throw outer.reason ?? err;
        const transient = err instanceof ProviderError ? err.retryable : err instanceof Error && err.name === "TimeoutError";
        if (!transient) throw err;
      }
    }
    throw lastError;
  }

  private async attempt(model: string, prompt: Prompt, signal: AbortSignal): Promise<Completion> {
    const res = await (this.opts.fetch ?? fetch)(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.opts.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: prompt.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: this.opts.temperature ?? 0.2,
          maxOutputTokens: this.opts.maxOutputTokens ?? 2048,
          thinkingConfig: { thinkingLevel: this.opts.thinkingLevel ?? "low" },
        },
      }),
      signal,
    });

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      throw new ProviderError(
        `Gemini request failed (${res.status} ${body.error?.status ?? ""}): ${body.error?.message ?? "no details"}`.replace(" )", ")"),
        RETRYABLE.has(res.status),
        res.status,
      );
    }
    if (body.promptFeedback?.blockReason) {
      throw new ProviderError(`Gemini blocked the prompt (${body.promptFeedback.blockReason})`);
    }

    const candidate = body.candidates?.[0];
    // Thinking models may return thought parts; only the answer goes through output analysis.
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("");
    if (!text) throw new ProviderError(`Gemini returned no text (finishReason: ${candidate?.finishReason ?? "none"})`);

    return {
      text,
      model: body.modelVersion ?? model,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
