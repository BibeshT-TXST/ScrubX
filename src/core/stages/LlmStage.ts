import { Stage, type SpanDetails } from "../pipeline/Stage";
import type { Completion, LLMProvider, Prompt } from "../providers/LLMProvider";
import { renderPrompt } from "../providers/prompt";

/** Step 6b. The only stage that talks to the outside world. Receives a fully tokenized prompt. */
export class LlmStage extends Stage<Prompt, Completion> {
  readonly name = "LlmStage" as const;
  readonly step = "model" as const;

  constructor(private readonly provider: LLMProvider) {
    super();
  }

  get providerName(): string {
    return this.provider.name;
  }

  protected async process(prompt: Prompt): Promise<Completion> {
    return this.provider.complete(prompt);
  }

  protected override snapshotInput(prompt: Prompt) {
    return { text: renderPrompt(prompt) };
  }

  protected override snapshotOutput(c: Completion) {
    return { text: c.text };
  }

  protected override describe(_p: Prompt, c: Completion): SpanDetails {
    return {
      caption: `The ${this.provider.name} model answered using tokens only.`,
      attributes: {
        provider: this.provider.name,
        model: c.model,
        inputTokens: c.usage?.inputTokens ?? 0,
        outputTokens: c.usage?.outputTokens ?? 0,
      },
    };
  }
}
