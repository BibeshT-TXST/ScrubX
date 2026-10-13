"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OutcomeBadge } from "@/components/chat/DecisionBadge";
import { STEPS, type StageSpan } from "@/core/pipeline/events";
import { summarizeSteps } from "@/core/pipeline/steps";
import type { DecisionAction, PatientSummary } from "@/core/types";
import { chatActions, useChatStore, type LiveTrace } from "@/lib/chat-store";
import { ROLE_LABEL } from "@/lib/steps";
import { maskText, phiValues, stepBody, valuePattern } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { makeMasker, MaskProvider } from "./mask";
import { AuditPanel, Panel, RiskBreakdown, TimingWaterfall } from "./Panels";
import { PipelineGraph } from "./PipelineGraph";
import { StageCard } from "./StageCard";
import { StageInspector } from "./StageInspector";
import { usePlayback } from "./usePlayback";

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function SecurityView({ patients }: { patients: PatientSummary[] }) {
  const router = useRouter();
  const traces = useChatStore((s) => s.traces);
  const mask = useChatStore((s) => s.mask);
  const requested = useSearchParams().get("request");

  const all = useMemo(() => Object.values(traces).sort((a, b) => a.startedAt - b.startedAt), [traces]);
  const trace = traces[requested ?? ""] ?? all.at(-1);
  const names = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients]);
  const observed = [...new Set(all.map((t) => t.patientId))];
  const conversation = all.filter((t) => t.patientId === trace?.patientId);
  const open = (id: string) => router.replace(`/security?request=${id}`, { scroll: false });

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-350 space-y-5 px-6 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="size-5" /> Security Division
            </h1>
            <p className="text-sm text-muted-foreground">
              Observation only. Every request made from Chat in this browser session, as ScrubX processed it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => chatActions.setMask(!mask)}
            aria-pressed={mask}
            className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
          >
            {mask ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {mask ? "PHI masked" : "PHI visible"}
          </button>
        </header>

        {!trace ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No activity yet. Conversations from{" "}
            <Link href="/" className="underline underline-offset-4">
              Chat
            </Link>{" "}
            appear here as they happen.
          </p>
        ) : (
          <>
            <section className="rounded-xl border bg-card">
              <nav className="flex flex-wrap gap-1 border-b px-3 pt-3" aria-label="Patients with activity">
                {observed.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => open(all.filter((t) => t.patientId === id).at(-1)!.requestId)}
                    className={cn(
                      "-mb-px rounded-t-md border border-b-0 px-3 py-1.5 text-sm",
                      id === trace.patientId ? "bg-card font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {/* Names are PHI too, so the mask covers them. */}
                    {mask ? `Patient ${id}` : (names.get(id) ?? id)}
                  </button>
                ))}
              </nav>
              <ConversationLog traces={conversation} selected={trace.requestId} mask={mask} onOpen={open} />
            </section>

            {/* Keyed so playback and selection reset for each request. */}
            <TraceExplorer key={trace.requestId} trace={trace} mask={mask} />
          </>
        )}
      </div>
    </main>
  );
}

/** The selected patient's chat record: one row per message, newest last. */
function ConversationLog(props: { traces: LiveTrace[]; selected: string; mask: boolean; onOpen: (id: string) => void }) {
  return (
    <ol className="max-h-56 divide-y overflow-y-auto">
      {props.traces.map((t) => {
        const pattern = props.mask ? valuePattern(phiValues(t.spans)) : null;
        return (
          <li key={t.requestId}>
            <button
              type="button"
              onClick={() => props.onOpen(t.requestId)}
              aria-current={t.requestId === props.selected}
              className={cn(
                "grid w-full grid-cols-[72px_minmax(0,1fr)_auto_96px] items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/50",
                t.requestId === props.selected && "bg-muted",
              )}
            >
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{time(t.startedAt)}</span>
              <span className="truncate">{maskText(t.message, pattern)}</span>
              <OutcomeBadge
                pending={!t.result && !t.error}
                outcome={t.error ? "unavailable" : t.result?.outcome}
                decision={t.result?.audit.decision}
              />
              <span className="text-right font-mono text-[11px] text-muted-foreground">{t.requestId}</span>
            </button>
          </li>
        );
      })}
    </ol>
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
  const role = String(spans[0]?.attributes.role ?? "").replace("medical_practitioner", ROLE_LABEL);

  const select = (span: StageSpan) => {
    setSelectedId(span.spanId);
    play.go(STEPS.indexOf(span.step));
  };
  const goStep = (i: number) => {
    setSelectedId(null);
    play.go(i);
  };

  // Arrow keys step through the card.
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
          <p className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-700">
            The request did not complete: {trace.error}
          </p>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <StageCard
              steps={steps}
              current={play.step}
              body={stepBody(current.step, spans)}
              requestId={trace.requestId}
              role={role || "…"}
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
