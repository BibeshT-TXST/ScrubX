import { Stage, type SpanDetails } from "../pipeline/Stage";
import type { Decision } from "../types";

// Deliberately generic: the clinician sees that it was blocked, not which rule fired.
export const REFUSAL =
  "This request was blocked by ScrubX because it looks like an attempt to override the assistant's instructions or extract protected data. Please rephrase it as a clinical question about this patient.";

/** Step 4, block branch. The pipeline stops here; the model is never called. */
export class Block extends Stage<Decision, string> {
  readonly name = "Block" as const;
  readonly step = "decide" as const;

  protected async process(): Promise<string> {
    return REFUSAL;
  }

  protected override snapshotOutput(refusal: string) {
    return { text: refusal };
  }

  protected override describe(decision: Decision): SpanDetails {
    return {
      caption: "Request blocked. The model is never called.",
      status: "blocked",
      attributes: { score: decision.score, reasons: decision.reasons.length },
    };
  }
}
