"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { StageSpan } from "@/core/pipeline/events";
import type { AuditEvent } from "@/core/types";
import { decisionOf, spanOf } from "@/lib/trace-view";
import { cn } from "@/lib/utils";

export function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3 rounded-xl border bg-card p-5", className)}>
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

const pct = (n: number) => `${Math.round(Math.min(Math.max(n, 0), 1) * 100)}%`;

export function RiskBreakdown({ spans }: { spans: StageSpan[] }) {
  const risk = spanOf(spans, "RiskEngine");
  if (!risk) return <p className="text-xs text-muted-foreground">Waiting for the risk engine…</p>;
  const score = Number(risk.attributes.score);
  const flag = Number(risk.attributes.flagThreshold);
  const block = Number(risk.attributes.blockThreshold);
  const decision = decisionOf(spans);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          {/* Zones: allow | flag | block */}
          <div className="absolute inset-y-0 bg-amber-100" style={{ left: pct(flag), width: pct(block - flag) }} />
          <div className="absolute inset-y-0 right-0 bg-red-100" style={{ left: pct(block) }} />
          <div
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-700", score >= block ? "bg-red-600" : score >= flag ? "bg-amber-500" : "bg-foreground")}
            style={{ width: pct(Math.max(score, 0.01)) }}
          />
        </div>
        <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(flag) }}>flag {flag}</span>
          <span className="absolute -translate-x-1/2" style={{ left: pct(block) }}>block {block}</span>
          <span className="absolute right-0">1</span>
        </div>
        <p className="font-mono text-sm">
          score {score} → <span className="font-semibold">{String(risk.attributes.action)}</span>
        </p>
      </div>

      {decision ? (
        <>
          {decision.contributions.length > 0 && (
            <ul className="space-y-1.5">
              {decision.contributions.map((c) => (
                <li key={c.source} className="grid grid-cols-[150px_1fr_32px] items-center gap-2 font-mono text-[11px]">
                  <span className="truncate" title={c.source}>{c.source}</span>
                  <span className="h-1.5 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-foreground" style={{ width: pct(c.score) }} />
                  </span>
                  <span className="text-right tabular-nums">{c.score}</span>
                </li>
              ))}
            </ul>
          )}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {decision.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Contribution details need trace payloads.</p>
      )}
    </div>
  );
}

/** Shows the exact audit line and checks it, here in the browser, against every PHI value this trace knows. */
export function AuditPanel({ audit, pattern, known }: { audit?: AuditEvent; pattern: RegExp | null; known: number }) {
  if (!audit) return <p className="text-xs text-muted-foreground">The audit line is written when the request finishes.</p>;
  const line = JSON.stringify(audit, null, 2);
  const hits = pattern ? [...new Set(line.match(pattern) ?? [])] : [];

  return (
    <div className="space-y-3">
      {known === 0 ? (
        <p className="text-xs text-muted-foreground">No PHI values available to check against (payloads off or none detected).</p>
      ) : hits.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CircleCheck className="size-3.5" /> No PHI found: 0 of {known} known values appear in this line.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-red-700">
          <CircleAlert className="size-3.5" /> {hits.length} PHI value(s) found in the audit line.
        </p>
      )}
      {/* Deliberately unmasked: the point is to show the line exactly as it was emitted. */}
      <pre className="max-h-80 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-5">{line}</pre>
    </div>
  );
}

export function TimingWaterfall({ spans, total }: { spans: StageSpan[]; total: number }) {
  const end = Math.max(total, ...spans.map((s) => s.startMs + s.durationMs), 0.001);
  return (
    <div className="space-y-1">
      {spans.map((s) => (
        <div key={s.spanId} className="grid grid-cols-[110px_1fr_56px] items-center gap-2 font-mono text-[10px]">
          <span className={cn("truncate", s.status === "skipped" && "text-muted-foreground line-through")}>{s.stage}</span>
          <span className="relative h-2.5 rounded-sm bg-muted/60">
            <span
              className={cn(
                "absolute inset-y-0 rounded-sm",
                s.status === "skipped" ? "bg-border" : s.status === "ok" ? "bg-foreground" : "bg-red-600",
              )}
              style={{ left: pct(s.startMs / end), width: `max(2px, ${pct(s.durationMs / end)})` }}
            />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">{s.durationMs.toFixed(1)}</span>
        </div>
      ))}
      <p className="pt-1 text-right font-mono text-[10px] text-muted-foreground">total {end.toFixed(1)} ms</p>
    </div>
  );
}
