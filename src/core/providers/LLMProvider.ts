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

export interface LLMProvider {
  readonly name: string;
  complete(prompt: Prompt, opts?: { signal?: AbortSignal }): Promise<Completion>;
}
