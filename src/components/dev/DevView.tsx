"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DecisionBadge } from "@/components/chat/DecisionBadge";
import { STEPS, type StageSpan, type Step } from "@/core/pipeline/events";
import { summarizeSteps } from "@/core/pipeline/steps";
import type { DecisionAction, PatientSummary } from "@/core/types";
import { chatActions, useChatStore, type LiveTrace } from "@/lib/chat-store";
import { phiValues, stepBody, valuePattern } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { DataLens } from "./DataLens";
import { makeMasker, MaskProvider } from "./mask";
import { AuditPanel, Panel, RiskBreakdown, TimingWaterfall } from "./Panels";
import { PipelineGraph } from "./PipelineGraph";
import { RunBar } from "./RunBar";
import { StageCard } from "./StageCard";
import { StageInspector } from "./StageInspector";
import { usePlayback } from "./usePlayback";

export function DevView({ patients }: { patients: PatientSummary[] }) {
  const traces = useChatStore((s) => s.traces);
  const mask = useChatStore((s) => s.mask);
  const requested = useSearchParams().get("request");
  const ids = Object.keys(traces);
  const trace = traces[requested ?? ids.at(-1) ?? ""];

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-5 px-6 py-6">
        <RunBar patients={patients} />

        <div className="flex flex-wrap items-center gap-2">
          {ids.map((id) => {
            const t = traces[id]!;
            return (
              <Link
                key={id}
                href={`/dev?request=${id}`}
                scroll={false}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]",
                  id === trace?.requestId ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {id}
                {t.result && <DecisionBadge decision={t.result.audit.decision} className="h-4 px-1.5 text-[9px]" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => chatActions.setMask(!mask)}
            aria-pressed={mask}
            className="ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
          >
            {mask ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {mask ? "PHI masked" : "PHI visible"}
          </button>
        </div>

        {trace ? (
          // Keyed so playback and selection reset for each request.
          <TraceExplorer key={trace.requestId} trace={trace} mask={mask} />
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Run a request above (try the presets), or send a message in{" "}
            <Link href="/" className="underline underline-offset-4">
              Chat View
            </Link>
            , then watch it move through the pipeline here.
          </p>
        )}
      </div>
    </main>
  );
}

function TraceExplorer({ trace, mask }: { trace: LiveTrace; mask: boolean }) {
  const { spans, result } = trace;
  const steps = useMemo(() => summarizeSteps(spans), [spans]);
  const available = result ? STEPS.length - 1 : Math.max(-1, ...spans.map((s) => STEPS.indexOf(s.step)));
  const play = usePlayback(available);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const values = useMemo(() => phiValues(spans), [spans]);
  const pattern = useMemo(() => valuePattern(values), [values]);
  const masker = useMemo(() => makeMasker(mask, pattern), [mask, pattern]);

  const current = steps[play.step]!;
  const selected = spans.find((s) => s.spanId === selectedId) ?? current.spans[0];
  const action = spans.find((s) => s.stage === "RiskEngine")?.attributes.action as DecisionAction | undefined;

  const select = (span: StageSpan) => {
    setSelectedId(span.spanId);
    play.go(STEPS.indexOf(span.step));
  };
  const goStep = (i: number) => {
    setSelectedId(null);
    play.go(i);
  };

  // Arrow keys step through the card, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") goStep(play.step + 1);
      if (e.key === "ArrowLeft") goStep(play.step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <MaskProvider value={masker}>
      <div className="space-y-5">
        {trace.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{trace.error}</p>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <StageCard
              steps={steps}
              current={play.step}
              body={stepBody(current.step, spans)}
              requestId={trace.requestId}
              role={trace.role}
              action={action}
              playing={play.playing}
              onStep={goStep}
              onToggle={play.toggle}
              onReplay={() => {
                setSelectedId(null);
                play.replay();
              }}
              onSelectSpan={select}
            />
            <Panel title="Stage inspector">
              <StageInspector span={selected} />
            </Panel>
          </div>
          <Panel title="Pipeline">
            <PipelineGraph spans={spans} current={play.step} done={!!result} selected={selected?.spanId} onSelect={select} />
          </Panel>
        </div>

        <div className="space-y-2">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Data lens · the same message at every stage
          </h3>
          <DataLens spans={spans} onStep={(step: Step) => goStep(STEPS.indexOf(step))} />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-3">
          <Panel title="Risk breakdown">
            <RiskBreakdown spans={spans} />
          </Panel>
          <Panel title="Audit log line">
            <AuditPanel audit={result?.audit} pattern={pattern} known={values.length} />
          </Panel>
          <Panel title="Timing waterfall">
            <TimingWaterfall spans={spans} total={result?.trace.durationMs ?? 0} />
          </Panel>
        </div>
      </div>
    </MaskProvider>
  );
}
