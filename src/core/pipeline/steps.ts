import { plural } from "../stages/format";
import { STEPS, type StageName, type StageSpan, type Step } from "./events";

export type StepStatus = "pending" | "ok" | "blocked" | "skipped" | "error";

export interface StepSummary {
  step: Step;
  index: number;
  status: StepStatus;
  caption: string;
  spans: StageSpan[];
}

type Spans = Map<StageName, StageSpan>;

const num = (s: StageSpan | undefined, key: string) => {
  const v = s?.attributes[key];
  return typeof v === "number" ? v : 0;
};
const list = (s: StageSpan | undefined, key: string) => String(s?.attributes[key] ?? "").split(",").filter(Boolean);

const SKIPPED = "Skipped: the request was blocked.";

// One caption per UI step, composed from span attributes (never payloads), so
// it reads the same with trace payloads off and changes with every request.
const CAPTIONS: Record<Step, (s: Spans) => string> = {
  receive: (s) => s.get("Receive")?.caption ?? "",
  normalize: (s) => s.get("InputNormalizer")?.caption ?? "",
  detect: (s) => {
    const risk = s.get("RiskEngine");
    // Before the risk engine reports the merged count, fall back to the detectors' own numbers.
    const fields = risk ? num(risk, "phiFields") : num(s.get("PhiClassifier"), "labels") + num(s.get("RegexRules"), "phiFindings");
    const signals = risk ? num(risk, "signals") : num(s.get("RegexRules"), "injectionFindings");
    const injection = signals ? ` and ${plural(signals, "injection signal")}` : "";
    return `Regex rules, a semantic scan and a PHI classifier flag ${plural(fields, "field")}${injection}.`;
  },
  decide: (s) => {
    const block = s.get("Block");
    return [s.get("RiskEngine")?.caption, block?.caption].filter(Boolean).join(" ");
  },
  tokenize: (s) => (s.get("Tokenizer")?.status === "skipped" ? SKIPPED : (s.get("Tokenizer")?.caption ?? "")),
  model: (s) => {
    const retrieval = s.get("Retrieval");
    if (retrieval?.status === "skipped") return SKIPPED;
    const output = s.get("OutputAnalysis");
    const withheld = list(retrieval, "withheld").length;
    const quarantined = num(retrieval, "quarantined");
    const scope = [
      withheld && `${plural(withheld, "field")} withheld`,
      quarantined && `${plural(quarantined, "instruction")} removed`,
    ].filter(Boolean);
    const issues = [
      num(output, "leaks") && `${plural(num(output, "leaks"), "leak")} redacted`,
      num(output, "unknownTokens") && `${plural(num(output, "unknownTokens"), "unknown token")} stripped`,
      num(output, "ungrounded") && `${plural(num(output, "ungrounded"), "ungrounded claim")} flagged`,
    ].filter(Boolean);
    const around = (parts: unknown[]) => (parts.length ? ` (${parts.join(", ")})` : "");
    return `Retrieval is filtered by role${around(scope)} and the answer is checked for leaks${around(issues)}.`;
  },
  restore: (s) =>
    s.get("Rehydrator")?.status === "skipped"
      ? "Nothing to restore. The audit log still records the decision, with no PHI."
      : (s.get("Rehydrator")?.caption ?? ""),
};

function statusOf(spans: StageSpan[]): StepStatus {
  if (!spans.length) return "pending";
  if (spans.some((s) => s.status === "error")) return "error";
  if (spans.some((s) => s.status === "blocked")) return "blocked";
  if (spans.some((s) => s.status === "skipped")) return "skipped";
  return "ok";
}

/** Rolls spans up into the 7 UI steps with a status and a generated caption each. */
export function summarizeSteps(spans: readonly StageSpan[]): StepSummary[] {
  const byStage: Spans = new Map(spans.map((s) => [s.stage, s]));
  return STEPS.map((step, index) => {
    const own = spans.filter((s) => s.step === step);
    return { step, index, spans: own, status: statusOf(own), caption: own.length ? CAPTIONS[step](byStage) : "" };
  });
}
