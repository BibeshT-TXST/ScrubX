"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Notice, OutcomeBadge } from "@/components/clinical/status";
import { Switch } from "@/components/ui/switch";
import { STEPS, type StageSpan } from "@/core/pipeline/events";
import { summarizeSteps } from "@/core/pipeline/steps";
import type { DecisionAction, PatientSummary } from "@/core/types";
import { chatActions, useChatStore, type LiveTrace } from "@/lib/chat-store";
import { formatDate, formatStamp } from "@/lib/clinical-format";
import { ROLE_LABEL } from "@/lib/steps";
import { maskText, phiValues, recordView, stepBody, valuePattern } from "@/lib/trace-view";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { makeMasker, MaskProvider } from "./mask";
import { Panel, RiskBreakdown } from "./Panels";
import { PipelineGraph } from "./PipelineGraph";
import { StageCard } from "./StageCard";
import { StageInspector } from "./StageInspector";
import { usePlayback } from "./usePlayback";

const outcomeOf = (t: LiveTrace) => ({
  pending: !t.result && !t.error,
  outcome: t.error ? ("unavailable" as const) : t.result?.outcome,
  decision: t.result?.audit.decision,
});

export function SecurityView({ patients }: { patients: PatientSummary[] }) {
  const router = useRouter();
  const traces = useChatStore((s) => s.traces);
  const mask = useChatStore((s) => s.mask);
  const requested = useSearchParams().get("request");
  const now = useNow();

  const all = useMemo(() => Object.values(traces).sort((a, b) => a.startedAt - b.startedAt), [traces]);
  const trace = traces[requested ?? ""] ?? all.at(-1);
  const byId = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const observed = [...new Set(all.map((t) => t.patientId))];
  const conversation = all.filter((t) => t.patientId === trace?.patientId);
  const open = (id: string) => router.replace(`/security?request=${id}`, { scroll: false });
  // Names are PHI too, so the mask covers them.
  const patientLabel = (id: string) => (mask ? `Patient ${id}` : (byId.get(id)?.name ?? id));

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-480 space-y-6 px-(--pane-x) py-(--pane-y)">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-title font-semibold">
              <ShieldCheck className="size-6" /> Security Division
            </h1>
            <p className="text-data text-muted-foreground">
              Observation only: every request made from Chat in this browser session, as ScrubX processed it. Nothing can be sent from here.
            </p>
          </div>
          <label className="ml-auto flex h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 text-data font-medium">
            {mask ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {mask ? "PHI masked" : "PHI visible"}
            <Switch checked={mask} onCheckedChange={(v) => chatActions.setMask(v)} aria-label="Mask PHI" />
          </label>
        </header>

        {!trace ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-body text-muted-foreground">
              No activity yet. Conversations from{" "}
              <Link href="/" className="font-medium text-foreground underline underline-offset-4">
                Chat
              </Link>{" "}
              appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-0">
              <section aria-label="Patients with activity" className="rounded-xl border bg-card">
                <h2 className="border-b px-4 py-3 text-section font-semibold">Patients</h2>
                <ul className="p-2">
                  {observed.map((id) => {
                    const count = all.filter((t) => t.patientId === id).length;
                    const current = id === trace.patientId;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => open(all.filter((t) => t.patientId === id).at(-1)!.requestId)}
                          aria-current={current ? "true" : undefined}
                          className={cn(
                            "relative flex min-h-(--row-h) w-full items-center justify-between gap-2 rounded-md px-3 text-left text-data",
                            current ? "bg-muted font-semibold" : "hover:bg-muted/60",
                          )}
                        >
                          {current && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-foreground" />}
                          <span className="truncate">{patientLabel(id)}</span>
                          <span className="numeric shrink-0 text-meta font-normal text-muted-foreground">
                            {count} request{count === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <RequestLog traces={conversation} selected={trace.requestId} mask={mask} now={now} onOpen={open} />
            </aside>

            {/* Keyed so playback and selection reset for each request. */}
            <TraceExplorer key={trace.requestId} trace={trace} mask={mask} now={now} patient={byId.get(trace.patientId)} />
          </div>
        )}
      </div>
    </main>
  );
}

/** The selected patient's chat record: one row per message, newest last. */
function RequestLog(props: { traces: LiveTrace[]; selected: string; mask: boolean; now: number; onOpen: (id: string) => void }) {
  return (
    <section aria-label="Requests" className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-section font-semibold">Requests</h2>
      <ol className="max-h-112 divide-y overflow-y-auto">
        {props.traces.map((t) => {
          const pattern = props.mask ? valuePattern(phiValues(t.spans)) : null;
          const current = t.requestId === props.selected;
          return (
            <li key={t.requestId}>
              <button
                type="button"
                onClick={() => props.onOpen(t.requestId)}
                aria-current={current ? "true" : undefined}
                className={cn("relative w-full space-y-2 px-4 py-3 text-left", current ? "bg-muted" : "hover:bg-muted/50")}
              >
                {current && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-foreground" />}
                <span className="numeric block text-meta text-muted-foreground">{formatStamp(t.startedAt, props.now, true)}</span>
                <span className={cn("line-clamp-2 text-data", current && "font-medium")}>{maskText(t.message, pattern)}</span>
                <span className="flex items-center justify-between gap-2">
                  <OutcomeBadge {...outcomeOf(t)} />
                  <span className="font-mono text-meta text-muted-foreground">{t.requestId}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface ExplorerProps {
  trace: LiveTrace;
  mask: boolean;
  now: number;
  patient?: PatientSummary;
}

function TraceExplorer({ trace, mask, now, patient }: ExplorerProps) {
  const { spans, result } = trace;
  const steps = useMemo(() => summarizeSteps(spans), [spans]);
  const available = result ? STEPS.length - 1 : Math.max(-1, ...spans.map((s) => STEPS.indexOf(s.step)));
  const play = usePlayback(available);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pattern = useMemo(() => valuePattern(phiValues(spans)), [spans]);
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
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") goStep(play.step + 1);
      if (e.key === "ArrowLeft") goStep(play.step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <MaskProvider value={masker}>
      <div className="min-w-0 space-y-6">
        {/* Which patient and which request this is, before any detail. Identifiers follow the mask. */}
        <section aria-label="Request context" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border bg-card px-5 py-3">
          <div>
            <p className="text-meta text-muted-foreground">Patient</p>
            <p className="text-body font-semibold">
              {mask || !patient ? `Patient ${trace.patientId}` : patient.name}
              {!mask && patient && (
                <span className="numeric ml-3 text-data font-normal text-muted-foreground">
                  {formatDate(patient.dob)} · <span className="font-mono">{patient.mrn}</span>
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-meta text-muted-foreground">Sent</p>
            <p className="numeric text-data font-medium">{formatStamp(trace.startedAt, now, true)}</p>
          </div>
          <div>
            <p className="text-meta text-muted-foreground">Request</p>
            <p className="font-mono text-data">{trace.requestId}</p>
          </div>
          <OutcomeBadge {...outcomeOf(trace)} className="ml-auto" />
        </section>

        {trace.error && <Notice tone="unavailable" title="The request did not complete.">{trace.error}</Notice>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="min-w-0 space-y-6">
            <StageCard
              steps={steps}
              current={play.step}
              body={stepBody(current.step, spans)}
              record={current.step === "model" ? recordView(spans) : undefined}
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
          {/* The audit line is written to logs, not shown; per-stage timings live in the step table and inspector. */}
          <div className="space-y-6">
            <Panel title="Pipeline">
              <PipelineGraph spans={spans} current={play.step} done={!!result} selected={selected?.spanId} onSelect={select} />
            </Panel>
            <Panel title="Risk breakdown">
              <RiskBreakdown spans={spans} />
            </Panel>
          </div>
        </div>
      </div>
    </MaskProvider>
  );
}
