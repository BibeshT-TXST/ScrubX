"use client";

import { Info } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { OutcomeBadge } from "@/components/clinical/status";
import type { StageSpan } from "@/core/pipeline/events";
import type { DecisionAction } from "@/core/types";
import { formatNumber } from "@/lib/clinical-format";
import { decisionOf, spanOf } from "@/lib/trace-view";
import { cn } from "@/lib/utils";

export function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("space-y-4 rounded-xl border bg-card p-5", className)}>
      <h2 className="text-section font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-data text-muted-foreground">
      <Info className="size-4 shrink-0" />
      {children}
    </p>
  );
}

const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
const pct = (n: number) => `${clamp(n) * 100}%`;

export function RiskBreakdown({ spans }: { spans: StageSpan[] }) {
  const risk = spanOf(spans, "RiskEngine");
  if (!risk) return <Waiting>Waiting for the risk engine…</Waiting>;
  const score = Number(risk.attributes.score);
  const flag = Number(risk.attributes.flagThreshold);
  const block = Number(risk.attributes.blockThreshold);
  const action = risk.attributes.action as DecisionAction;
  const decision = decisionOf(spans);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-meta text-muted-foreground">Risk score (0 to 1)</p>
          <p className="numeric text-hero font-semibold">{formatNumber(score)}</p>
        </div>
        <OutcomeBadge decision={action} className="mb-2" />
      </div>

      {/* Zones are labeled in text below the bar; the score marker carries its own value. */}
      <div className="space-y-2">
        <div
          className="relative h-3 rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={score}
          aria-label={`Risk score ${formatNumber(score)}, flag at ${formatNumber(flag)}, block at ${formatNumber(block)}`}
        >
          <div className="absolute inset-y-0 bg-flag-surface" style={{ left: pct(flag), width: pct(block - flag) }} />
          <div className="absolute inset-y-0 right-0 rounded-r-full bg-block-surface" style={{ left: pct(block) }} />
          {[flag, block].map((t) => (
            <span key={t} className="absolute -inset-y-1 w-0.5 bg-foreground/40" style={{ left: pct(t) }} />
          ))}
          <motion.span
            initial={{ left: "0%" }}
            animate={{ left: pct(score) }}
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
          />
        </div>
        <div className="numeric grid text-meta text-muted-foreground" style={{ gridTemplateColumns: `${pct(flag)} ${pct(block - flag)} 1fr` }}>
          <span>Allow &lt; {formatNumber(flag)}</span>
          <span className="pl-1">Flag {formatNumber(flag)}–{formatNumber(block)}</span>
          <span className="pl-1">Block ≥ {formatNumber(block)}</span>
        </div>
      </div>

      {decision ? (
        <>
          {decision.contributions.length > 0 && (
            <table className="w-full text-data">
              <caption className="pb-2 text-left text-meta font-semibold text-muted-foreground">What raised the score</caption>
              <tbody className="divide-y">
                {decision.contributions.map((c) => (
                  <tr key={c.source} className="h-(--row-h)">
                    <th scope="row" className="max-w-40 truncate pr-3 text-left font-mono text-meta font-normal" title={c.source}>
                      {c.source}
                    </th>
                    <td className="w-full">
                      <span className="block h-2 rounded-full bg-muted">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: pct(c.score) }}
                          className="block h-full rounded-full bg-foreground/70"
                        />
                      </span>
                    </td>
                    <td className="numeric pl-3 text-right font-mono">{formatNumber(c.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="list-disc space-y-1 pl-5 text-data text-muted-foreground">
            {decision.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : (
        <Waiting>Contribution details need trace payloads.</Waiting>
      )}
    </div>
  );
}
