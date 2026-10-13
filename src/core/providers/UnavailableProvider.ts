import { ProviderError, type Completion, type LLMProvider } from "./LLMProvider";

/**
 * Stands in when no model is configured. Every call fails the same way a down
 * model would, so the pipeline reports "couldn't connect" instead of crashing.
 */
export class UnavailableProvider implements LLMProvider {
  readonly name = "none";

  constructor(private readonly reason: string) {}

  async complete(): Promise<Completion> {
    throw new ProviderError(this.reason);
  }
}
