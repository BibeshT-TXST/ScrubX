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
  { id: "Receive", label: "Chat input", x: 235, y: 26 },
  { id: "InputNormalizer", label: "Input normalizer", x: 235, y: 84 },
  { id: "RegexRules", label: "Regex rules", x: 80, y: 146 },
  { id: "SemanticScan", label: "Semantic scan", x: 235, y: 146 },
  { id: "PhiClassifier", label: "PHI classifier", x: 390, y: 146 },
  { id: "RiskEngine", label: "Risk engine", x: 235, y: 208 },
  { id: "Block", label: "Block", x: 80, y: 270 },
  { id: "Tokenizer", label: "Tokenize PHI", x: 235, y: 270 },
  { id: "AuditLogger", label: "Audit log", x: 390, y: 270 },
  { id: "Retrieval", label: "Retrieval (role)", x: 235, y: 328 },
  { id: "LlmStage", label: "AI model", x: 235, y: 386 },
  { id: "OutputAnalysis", label: "Output analysis", x: 235, y: 444 },
  { id: "Rehydrator", label: "Restore tokens", x: 235, y: 502 },
  { id: "Response", label: "Response", x: 235, y: 560 },
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

const W = 150;
const H = 38;
const byId = new Map(NODES.map((n) => [n.id, n]));

type NodeState = "idle" | "ok" | "blocked" | "skipped" | "error";

// A glyph per state, so the graph reads the same without color (and in print).
const GLYPH: Record<NodeState, string> = { idle: "", ok: "✓", blocked: "✕", error: "!", skipped: "–" };
const STATE_LABEL: Record<NodeState, string> = { idle: "not reached", ok: "ran", blocked: "blocked", error: "error", skipped: "skipped" };

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
    <div className="space-y-4">
      <svg viewBox="0 0 470 586" className="mx-auto h-auto w-full max-w-md" role="group" aria-label="Pipeline graph">
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
              strokeWidth={lit ? 2 : 1}
              strokeDasharray={target === "skipped" ? "4 4" : undefined}
              className={cn("transition-[stroke] duration-200", !lit ? "stroke-border" : target === "blocked" ? "stroke-block" : "stroke-foreground")}
            />
          );
        })}

        {NODES.map((n) => {
          const state = stateOf(n.id);
          const span = visible.get(n.id);
          const isSelected = !!span && span.spanId === selected;
          const filled = state === "ok" || state === "blocked";
          return (
            <g
              key={n.id}
              transform={`translate(${n.x - W / 2} ${n.y - H / 2})`}
              role={span ? "button" : "img"}
              tabIndex={span ? 0 : undefined}
              aria-label={`${n.label}: ${STATE_LABEL[state]}`}
              aria-pressed={span ? isSelected : undefined}
              className={cn("outline-none", span && "cursor-pointer [&:focus-visible>rect:first-child]:stroke-focus [&:focus-visible>rect:first-child]:stroke-3")}
              onClick={() => span && onSelect(span)}
              onKeyDown={(e) => {
                if (span && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(span);
                }
              }}
            >
              <rect
                width={W}
                height={H}
                rx={8}
                strokeWidth={isSelected ? 3 : isCurrent(n.id) ? 2 : 1}
                strokeDasharray={state === "skipped" ? "5 4" : undefined}
                className={cn(
                  "transition-[fill,stroke] duration-200",
                  state === "ok" && "fill-foreground stroke-foreground",
                  state === "blocked" && "fill-block stroke-block",
                  state === "error" && "fill-card stroke-block",
                  (state === "idle" || state === "skipped") && "fill-card stroke-border",
                  isSelected && "stroke-focus",
                )}
              />
              <text
                x={GLYPH[state] ? W / 2 + 6 : W / 2}
                y={H / 2}
                dominantBaseline="central"
                textAnchor="middle"
                className={cn(
                  "font-sans text-[14px] font-medium transition-[fill] duration-200",
                  filled ? "fill-background" : state === "error" ? "fill-block" : "fill-muted-foreground",
                )}
              >
                {GLYPH[state] && <tspan className="font-semibold">{GLYPH[state]} </tspan>}
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      <ul aria-label="Graph legend" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-meta text-muted-foreground">
        <li className="flex items-center gap-2">
          <span className="grid h-4 w-6 place-items-center rounded-sm bg-foreground text-[0.75rem] text-background">✓</span> Ran
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-4 w-6 place-items-center rounded-sm bg-block text-[0.75rem] text-background">✕</span> Blocked
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-6 rounded-sm border border-dashed border-muted-foreground" /> Skipped
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-6 rounded-sm border" /> Not reached
        </li>
      </ul>
    </div>
  );
}
