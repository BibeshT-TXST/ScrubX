import type { Step } from "@/core/pipeline/events";
import type { DecisionAction, PipelineOutcome } from "@/core/types";

export const STEP_LABEL: Record<Step, string> = {
  receive: "Receive",
  normalize: "Normalize",
  detect: "Detect",
  decide: "Decide",
  tokenize: "Tokenize",
  model: "Model",
  restore: "Restore",
};

export const DECISION_LABEL: Record<DecisionAction, string> = {
  allow: "Allowed",
  flag: "Flagged",
  block: "Blocked",
};

export const ROLE_LABEL = "Medical Practitioner";

export type OutcomeTone = DecisionAction | "unavailable";

/** What a finished request shows: the outcome wins over the risk decision when the model was unreachable. */
export function outcomeTone(outcome: PipelineOutcome | undefined, decision: DecisionAction | undefined): OutcomeTone | undefined {
  return outcome === "unavailable" ? "unavailable" : decision;
}

export function outcomeLabel(outcome: PipelineOutcome | undefined, decision: DecisionAction | undefined) {
  const tone = outcomeTone(outcome, decision);
  return tone === "unavailable" ? "Couldn't connect" : tone && DECISION_LABEL[tone];
}
