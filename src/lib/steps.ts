import type { Step } from "@/core/pipeline/events";
import type { DecisionAction } from "@/core/types";

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
