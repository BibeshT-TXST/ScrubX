export interface PromptMessage {
  role: "user" | "assistant";
  content: string;
}

/** Exactly what leaves the pipeline. Everything in it is already tokenized. */
export interface Prompt {
  system: string;
  messages: PromptMessage[];
}

export interface Completion {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** What the clinician sees when the model could not be reached. */
export const MODEL_UNAVAILABLE =
  "We couldn't connect to the model, so this message wasn't answered. Please try again in a moment.";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface LLMProvider {
  readonly name: string;
  complete(prompt: Prompt, opts?: { signal?: AbortSignal }): Promise<Completion>;
}
