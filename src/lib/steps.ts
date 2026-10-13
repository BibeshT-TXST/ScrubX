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
  allow: "allowed",
  flag: "flagged",
  block: "blocked",
};

export const ROLE_LABEL = "Medical Practitioner";

/** What a finished request shows: the outcome wins over the risk decision when the model was unreachable. */
export function outcomeLabel(outcome: PipelineOutcome | undefined, decision: DecisionAction | undefined) {
  if (outcome === "unavailable") return "couldn't connect";
  return decision ? DECISION_LABEL[decision] : undefined;
}
