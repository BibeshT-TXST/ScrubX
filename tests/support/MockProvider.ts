import type { Completion, LLMProvider, Prompt } from "@/core/providers/LLMProvider";
import { CONTEXT_CLOSE, CONTEXT_OPEN, QUARANTINED, renderPrompt } from "@/core/providers/prompt";

export interface MockProviderOptions {
  /** Override the reply, e.g. to simulate a model that leaks PHI or invents tokens. */
  respond?: (prompt: Prompt) => string;
  /** Simulated latency so the Dev View animation has something to show. */
  latencyMs?: number;
}

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const FIELD_LINE = /^(Name|DOB|MRN|Phone|Address|Conditions|Medications|Description):\s*(.*)$/;

function contextFields(prompt: Prompt): Map<string, string> {
  const start = prompt.system.indexOf(CONTEXT_OPEN);
  const end = prompt.system.indexOf(CONTEXT_CLOSE);
  const block = start >= 0 && end > start ? prompt.system.slice(start + CONTEXT_OPEN.length, end) : "";
  const fields = new Map<string, string>();
  let current: string | undefined;
  for (const line of block.split("\n")) {
    const m = FIELD_LINE.exec(line.trim());
    if (m) fields.set((current = m[1]!.toLowerCase()), m[2]!);
    else if (current && line.trim()) fields.set(current, `${fields.get(current)} ${line.trim()}`.trim());
  }
  return fields;
}

/**
 * Test double, not shipped in the app (which always calls a real model).
 * Deterministic stand-in for a real model. Builds a clinical-style summary
 * from the (tokenized) context it was given, so tokens round-trip through
 * the whole pipeline and every claim is grounded.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  constructor(private readonly opts: MockProviderOptions = {}) {}

  async complete(prompt: Prompt): Promise<Completion> {
    if (this.opts.latencyMs) await new Promise((r) => setTimeout(r, this.opts.latencyMs));
    const text = this.opts.respond?.(prompt) ?? this.summarize(prompt);
    return {
      text,
      model: "mock-clinical-v1",
      usage: { inputTokens: estimateTokens(renderPrompt(prompt)), outputTokens: estimateTokens(text) },
    };
  }

  private summarize(prompt: Prompt): string {
    const f = contextFields(prompt);
    const question = prompt.messages.at(-1)?.content ?? "";
    const who = f.get("name") ?? "this patient";
    const header = f.has("mrn") ? `Summary for ${who} (${f.get("mrn")}):` : `Summary for ${who}:`;

    const lines = [header];
    if (f.has("conditions")) lines.push(`- Conditions: ${f.get("conditions")}`);
    if (f.has("medications")) lines.push(`- Medications: ${f.get("medications")}`);
    const note = f
      .get("description")
      ?.replaceAll(QUARANTINED, "")
      .split(/(?<=\.)\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    if (note) lines.push(`- Recent notes: ${note}`);
    if (lines.length === 1) lines.push("- No clinical fields are available for your role.");

    return [
      lines.join("\n"),
      `Regarding "${question}": based on the record above, review these findings with ${who} and confirm the current plan before making changes.`,
      "(Mock model: deterministic response, no external LLM was called.)",
    ].join("\n\n");
  }
}
