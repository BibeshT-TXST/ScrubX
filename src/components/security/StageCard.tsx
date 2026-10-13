"use client";

import { ChevronDown, Loader2, Pause, Play, RotateCcw, Shield, ShieldAlert } from "lucide-react";
import type { StageSpan } from "@/core/pipeline/events";
import type { StepSummary } from "@/core/pipeline/steps";
import type { DecisionAction } from "@/core/types";
import { STEP_LABEL } from "@/lib/steps";
import type { StepBody } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { Segments } from "./Segments";

interface Props {
  steps: StepSummary[];
  current: number;
  body: StepBody;
  requestId: string;
  role: string;
  action?: DecisionAction;
  playing: boolean;
  onStep: (i: number) => void;
  onToggle: () => void;
  onReplay: () => void;
  onSelectSpan: (span: StageSpan) => void;
}

const SEGMENT_TONE = {
  pending: "bg-muted",
  ok: "bg-foreground",
  blocked: "bg-red-600",
  error: "bg-red-600",
  skipped: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,var(--border)_4px_8px)]",
} as const;

const ACTIONS: DecisionAction[] = ["block", "flag", "allow"];

export function StageCard(p: Props) {
  const summary = p.steps[p.current]!;
  const blocked = summary.status === "blocked" || summary.status === "error";
  const pending = summary.status === "pending";
  const waiting = summary.step === "model" ? "Waiting for the model's reply…" : "Waiting for this step…";

  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-xs">
      <header className="flex items-center justify-between border-b px-5 py-3 font-mono text-xs">
        <span>
          stage {p.current + 1}/{p.steps.length} · {summary.step}
        </span>
        <span className="text-muted-foreground">
          {p.requestId} · role: {p.role}
        </span>
      </header>

      <div className="space-y-2 px-5 pt-4">
        <div className="flex gap-1.5">
          {p.steps.map((s) => (
            <button
              key={s.step}
              type="button"
              aria-label={`Go to ${s.step}`}
              onClick={() => p.onStep(s.index)}
              className={cn(
                "h-2 flex-1 rounded-sm transition-colors",
                s.index <= p.current ? SEGMENT_TONE[s.status] : "bg-muted",
              )}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          {p.steps.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => p.onStep(s.index)}
              className={cn(
                "flex-1 rounded-sm border border-transparent py-0.5 text-center font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
                s.index === p.current && "border-foreground text-foreground",
              )}
            >
              {STEP_LABEL[s.step]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-44 flex-1 space-y-3 px-5 py-5">
        {p.body.label && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{p.body.label}</p>
        )}
        <Segments body={p.body} />
        {summary.step === "decide" && p.action && (
          <div className="flex gap-2 pt-1">
            {ACTIONS.map((a) => (
              <span
                key={a}
                className={cn(
                  "rounded-md border px-3 py-1 font-mono text-xs",
                  a === p.action ? (a === "block" ? "border-red-600 bg-red-600 text-white" : "border-foreground bg-foreground text-background") : "text-muted-foreground",
                )}
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-start gap-2 border-t px-5 py-3 text-sm">
        {pending ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : blocked ? (
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
        ) : (
          <Shield className="mt-0.5 size-4 shrink-0" />
        )}
        <p className={cn("flex-1", pending && "text-muted-foreground")}>{summary.caption || waiting}</p>
        <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <button type="button" onClick={p.onToggle} className="rounded p-1 hover:bg-muted" aria-label={p.playing ? "Pause" : "Play"}>
            {p.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button type="button" onClick={p.onReplay} className="rounded p-1 hover:bg-muted" aria-label="Replay">
            <RotateCcw className="size-3.5" />
          </button>
          <span className="hidden font-mono text-[10px] lg:inline">← →</span>
        </div>
      </footer>

      {summary.spans.length > 0 && (
        <details className="group border-t">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-2 font-mono text-[11px] text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
            {summary.spans.length} internal stage{summary.spans.length === 1 ? "" : "s"}
          </summary>
          <ul className="divide-y border-t">
            {summary.spans.map((s) => (
              <li key={s.spanId}>
                <button
                  type="button"
                  onClick={() => p.onSelectSpan(s)}
                  className="grid w-full grid-cols-[150px_70px_60px_1fr] gap-3 px-5 py-2 text-left text-xs hover:bg-muted/50"
                >
                  <span className="font-mono">{s.stage}</span>
                  <span className={cn("font-mono", s.status !== "ok" && "text-red-700", s.status === "skipped" && "text-muted-foreground")}>
                    {s.status}
                  </span>
                  <span className="text-right font-mono tabular-nums text-muted-foreground">{s.durationMs.toFixed(1)} ms</span>
                  <span className="text-muted-foreground">{s.caption}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
