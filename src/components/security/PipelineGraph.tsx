"use client";

import { STEPS, type StageName, type StageSpan } from "@/core/pipeline/events";
import { cn } from "@/lib/utils";

type NodeId = StageName | "Response";

interface Node {
  id: NodeId;
  label: string;
  x: number;
  y: number;
}

// Mirrors the architecture diagram, top to bottom. Retrieval sits between
// tokenization and the model (it is the animation's "filtered by role").
const NODES: Node[] = [
  { id: "Receive", label: "Chat input", x: 180, y: 28 },
  { id: "InputNormalizer", label: "Input normalizer", x: 180, y: 88 },
  { id: "RegexRules", label: "Regex rules", x: 60, y: 158 },
  { id: "SemanticScan", label: "Semantic scan", x: 180, y: 158 },
  { id: "PhiClassifier", label: "PHI classifier", x: 300, y: 158 },
  { id: "RiskEngine", label: "Risk engine", x: 180, y: 228 },
  { id: "Block", label: "BLOCK", x: 60, y: 298 },
  { id: "Tokenizer", label: "Tokenize PHI", x: 180, y: 298 },
  { id: "AuditLogger", label: "Audit log", x: 300, y: 298 },
  { id: "Retrieval", label: "Retrieval (role)", x: 180, y: 362 },
  { id: "LlmStage", label: "LLM", x: 180, y: 426 },
  { id: "OutputAnalysis", label: "Output analysis", x: 180, y: 490 },
  { id: "Rehydrator", label: "Rehydrate tokens", x: 180, y: 554 },
  { id: "Response", label: "Response", x: 180, y: 618 },
];

const EDGES: [NodeId, NodeId][] = [
  ["Receive", "InputNormalizer"],
  ["InputNormalizer", "RegexRules"],
  ["InputNormalizer", "SemanticScan"],
  ["InputNormalizer", "PhiClassifier"],
  ["RegexRules", "RiskEngine"],
  ["SemanticScan", "RiskEngine"],
  ["PhiClassifier", "RiskEngine"],
  ["RiskEngine", "Block"],
  ["RiskEngine", "Tokenizer"],
  ["RiskEngine", "AuditLogger"],
  ["Tokenizer", "Retrieval"],
  ["Retrieval", "LlmStage"],
  ["LlmStage", "OutputAnalysis"],
  ["OutputAnalysis", "Rehydrator"],
  ["Rehydrator", "Response"],
  ["Block", "Response"],
];

const W = 104;
const H = 32;
const byId = new Map(NODES.map((n) => [n.id, n]));

type NodeState = "idle" | "ok" | "blocked" | "skipped" | "error";

interface Props {
  spans: StageSpan[];
  /** Playback position: nodes light up only once playback reaches their step. */
  current: number;
  done: boolean;
  selected?: string;
  onSelect: (span: StageSpan) => void;
}

export function PipelineGraph({ spans, current, done, selected, onSelect }: Props) {
  const visible = new Map(spans.filter((s) => STEPS.indexOf(s.step) <= current).map((s) => [s.stage as NodeId, s]));
  const blocked = visible.get("Block")?.status === "blocked";

  const stateOf = (id: NodeId): NodeState => {
    if (id === "Response") return done && current === STEPS.length - 1 ? (blocked ? "blocked" : "ok") : "idle";
    return (visible.get(id)?.status as NodeState | undefined) ?? "idle";
  };
  const isCurrent = (id: NodeId) => visible.get(id)?.step === STEPS[current];

  return (
    <svg viewBox="0 0 360 648" className="h-auto w-full" role="img" aria-label="Pipeline graph">
      {EDGES.map(([from, to]) => {
        const a = byId.get(from)!;
        const b = byId.get(to)!;
        const target = stateOf(to);
        const source = stateOf(from);
        // An edge is taken only if both ends ran, so Block → Response stays dark on an answered request.
        const lit = (target === "ok" || target === "blocked") && (source === "ok" || source === "blocked");
        const y1 = a.y + H / 2;
        const y2 = b.y - H / 2;
        const mid = (y1 + y2) / 2;
        // The refusal path runs down the left edge instead of cutting through the main column.
        const d =
          from === "Block"
            ? `M ${a.x} ${y1} V ${b.y - 10} Q ${a.x} ${b.y} ${a.x + 10} ${b.y} H ${b.x - W / 2}`
            : `M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`;
        return (
          <path
            key={`${from}-${to}`}
            d={d}
            fill="none"
            strokeWidth={lit ? 1.75 : 1}
            strokeDasharray={target === "skipped" ? "3 3" : undefined}
            className={cn(
              "transition-[stroke] duration-500",
              !lit ? "stroke-border" : target === "blocked" ? "stroke-red-600" : "stroke-foreground",
            )}
          />
        );
      })}

      {NODES.map((n) => {
        const state = stateOf(n.id);
        const span = visible.get(n.id);
        return (
          <g
            key={n.id}
            transform={`translate(${n.x - W / 2} ${n.y - H / 2})`}
            className={cn(span && "cursor-pointer")}
            onClick={() => span && onSelect(span)}
          >
            <rect
              width={W}
              height={H}
              rx={7}
              strokeWidth={span?.spanId === selected ? 2.5 : isCurrent(n.id) ? 2 : 1}
              strokeDasharray={state === "skipped" ? "4 3" : undefined}
              className={cn(
                "transition-[fill,stroke] duration-500",
                state === "ok" && "fill-foreground stroke-foreground",
                state === "blocked" && "fill-red-600 stroke-red-600",
                state === "error" && "fill-background stroke-red-600",
                (state === "idle" || state === "skipped") && "fill-background stroke-border",
                span?.spanId === selected && "stroke-sky-500",
              )}
            />
            <text
              x={W / 2}
              y={H / 2}
              dominantBaseline="central"
              textAnchor="middle"
              className={cn(
                "font-mono text-[10px] transition-[fill] duration-500",
                state === "ok" || state === "blocked" ? "fill-background" : "fill-muted-foreground",
                state === "skipped" && "line-through",
              )}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
