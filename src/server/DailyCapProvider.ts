import "server-only";
import { ProviderError, type Completion, type LLMProvider, type Prompt } from "@/core";
import { hit, type Counter } from "./rate-limit";

const DAY_MS = 86_400_000;

/**
 * Stops calling the model once a day's cap is spent, however many addresses the calls came
 * from. It fails the way a down model does, so the clinician sees "couldn't connect" and the
 * trace and audit line are still written. One call here can be up to 3 attempts at the model.
 */
export class DailyCapProvider implements LLMProvider {
  constructor(
    private readonly inner: LLMProvider,
    private readonly cap: number,
    private readonly counter: Counter = hit,
  ) {}

  get name(): string {
    return this.inner.name;
  }

  async complete(prompt: Prompt, opts?: { signal?: AbortSignal }): Promise<Completion> {
    const { count } = await this.counter("model-calls", DAY_MS);
    if (count > this.cap) throw new ProviderError("The daily model call cap was reached");
    return this.inner.complete(prompt, opts);
  }
}
