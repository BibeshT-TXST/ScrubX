"use client";

import { Check, ChevronDown, EyeOff, FileText, ChevronLeft, ChevronRight, Loader2, Pause, Play, RotateCcw, Shield, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StageSpan } from "@/core/pipeline/events";
import type { StepSummary } from "@/core/pipeline/steps";
import type { DecisionAction } from "@/core/types";
import { formatMs } from "@/lib/clinical-format";
import { STEP_LABEL } from "@/lib/steps";
import type { RecordView, StepBody } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { SegmentLegend, Segments } from "./Segments";
import { STATUS, StatusLabel } from "./stage-status";

interface Props {
  steps: StepSummary[];
  current: number;
  body: StepBody;
  /** The Model step's record, as stored and as sent. */
  record?: RecordView;
  requestId: string;
  role: string;
  action?: DecisionAction;
  playing: boolean;
  onStep: (i: number) => void;
  onToggle: () => void;
  onReplay: () => void;
  onSelectSpan: (span: StageSpan) => void;
}

const ACTIONS: DecisionAction[] = ["allow", "flag", "block"];

const FIELD_NAME: Record<string, string> = { address: "Address", phone: "Phone", mrn: "MRN", dob: "Date of birth", conditions: "Conditions", medications: "Medications", description: "Clinical notes", name: "Name" };

/** The record is scrubbed exactly like the message: this puts its before and after side by side. */
function RecordScrub({ record }: { record: RecordView }) {
  return (
    <section aria-label="Patient record sent to the AI" className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="flex items-center gap-2 text-body font-semibold">
          <FileText className="size-4" /> Patient record, scrubbed before the model
        </h3>
        <span className="numeric text-meta text-muted-foreground">
          {record.quarantined} instruction{record.quarantined === 1 ? "" : "s"} quarantined
        </span>
        {record.withheld.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
            <EyeOff className="size-3.5" /> Withheld for this role: {record.withheld.map((f) => FIELD_NAME[f] ?? f).join(", ")}
          </span>
        )}
      </header>
      <div className="grid gap-4 2xl:grid-cols-2">
        {[record.stored, record.sent].map((b) => (
          <div key={b.label} className="min-w-0 space-y-2">
            <p className="text-meta font-medium text-muted-foreground">{b.label}</p>
            <Segments body={b} className="rounded-md border bg-card p-3" />
          </div>
        ))}
      </div>
      <SegmentLegend body={{ segments: [...record.stored.segments, ...record.sent.segments] }} />
    </section>
  );
}

function Control({ label, shortcut, onClick, disabled, children }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export function StageCard(p: Props) {
  const summary = p.steps[p.current]!;
  const blocked = summary.status === "blocked" || summary.status === "error";
  const pending = summary.status === "pending";
  const waiting = summary.step === "model" ? "Waiting for the model's reply…" : "Waiting for this step…";

  return (
    <section aria-label="Stage walkthrough" className="flex flex-col rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3">
        <h2 className="numeric text-section font-semibold">
          Step {p.current + 1} of {p.steps.length} · {STEP_LABEL[summary.step]}
        </h2>
        <span className="text-meta text-muted-foreground">
          <span className="font-mono">{p.requestId}</span> · {p.role}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Control label="Previous step" shortcut="←" onClick={() => p.onStep(p.current - 1)} disabled={p.current === 0}>
            <ChevronLeft />
          </Control>
          <Control label={p.playing ? "Pause playback" : "Play"} onClick={p.onToggle}>
            {p.playing ? <Pause /> : <Play />}
          </Control>
          <Control label="Next step" shortcut="→" onClick={() => p.onStep(p.current + 1)} disabled={p.current === p.steps.length - 1}>
            <ChevronRight />
          </Control>
          <Control label="Replay from the start" onClick={p.onReplay}>
            <RotateCcw />
          </Control>
        </div>
      </header>

      <ol aria-label="Steps" className="grid grid-cols-7 gap-1 px-5 pt-4">
        {p.steps.map((s) => {
          const reached = s.index <= p.current;
          const status = reached ? s.status : "pending";
          const { icon: Icon, className } = STATUS[status];
          const isCurrent = s.index === p.current;
          return (
            <li key={s.step}>
              <button
                type="button"
                onClick={() => p.onStep(s.index)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${STEP_LABEL[s.step]}: ${STATUS[status].label}`}
                className="group relative flex w-full flex-col items-center gap-1.5 rounded-md px-1 pt-1 pb-2"
              >
                <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.span
                    initial={false}
                    animate={{ scaleX: reached && status !== "pending" ? 1 : 0 }}
                    className={cn(
                      "absolute inset-0 origin-left rounded-full",
                      status === "blocked" || status === "error" ? "bg-block" : status === "skipped" ? "bg-border" : "bg-foreground",
                    )}
                  />
                </span>
                <span className={cn("flex items-center gap-1 text-meta", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                  <Icon className={cn("hidden size-3.5 shrink-0 md:block", className)} />
                  <span className="truncate">{STEP_LABEL[s.step]}</span>
                </span>
                {isCurrent && <motion.span layoutId="step-current" className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-foreground" />}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-h-48 flex-1 px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={p.current}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {p.record && <RecordScrub record={p.record} />}
            {p.body.label && <p className="text-meta font-medium text-muted-foreground">{p.body.label}</p>}
            <Segments body={p.body} />
            {summary.step === "decide" && p.action && (
              <div role="group" aria-label="Risk decision" className="flex flex-wrap gap-2">
                {ACTIONS.map((a) => {
                  const chosen = a === p.action;
                  return (
                    <span
                      key={a}
                      aria-current={chosen ? "true" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-data capitalize",
                        chosen ? (a === "block" ? "border-block bg-block font-semibold text-background" : "border-foreground bg-foreground font-semibold text-background") : "text-muted-foreground",
                      )}
                    >
                      {chosen && <Check className="size-4" />}
                      {a}
                    </span>
                  );
                })}
              </div>
            )}
            <SegmentLegend body={p.body} />
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="flex items-start gap-3 border-t px-5 py-3" aria-live="polite">
        {pending ? (
          <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : blocked ? (
          <ShieldAlert className="mt-1 size-4 shrink-0 text-block" />
        ) : (
          <Shield className="mt-1 size-4 shrink-0" />
        )}
        <p className={cn("flex-1 text-body", pending && "text-muted-foreground")}>{summary.caption || waiting}</p>
      </footer>

      {summary.spans.length > 0 && (
        <details className="group border-t">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-5 text-data text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            {summary.spans.length} internal stage{summary.spans.length === 1 ? "" : "s"} in this step
          </summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-data">
              <thead className="bg-muted/50 text-left text-meta text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Duration</th>
                  <th scope="col" className="px-5 py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.spans.map((s) => (
                  <tr key={s.spanId} className="h-(--row-h) hover:bg-muted/50">
                    <td className="px-5">
                      <button type="button" onClick={() => p.onSelectSpan(s)} className="rounded-sm font-mono hover:underline">
                        {s.stage}
                      </button>
                    </td>
                    <td className="px-3">
                      <StatusLabel status={s.status} />
                    </td>
                    <td className="numeric px-3 text-right font-mono whitespace-nowrap">{formatMs(s.durationMs)}</td>
                    <td className="px-5 py-2 text-muted-foreground">{s.caption}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
