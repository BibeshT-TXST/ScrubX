"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DecisionBadge } from "@/components/chat/DecisionBadge";
import { useChatStore } from "@/lib/chat-store";
import { STEP_LABEL } from "@/lib/steps";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  ok: "text-foreground",
  skipped: "text-muted-foreground line-through",
  blocked: "text-red-700",
  error: "text-red-700",
} as const;

export function TraceList() {
  const results = useChatStore((s) => s.results);
  const requested = useSearchParams().get("request");
  const ids = Object.keys(results);
  const result = results[requested ?? ids.at(-1) ?? ""];

  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        No trace yet. Traces live in this tab only.{" "}
        <Link href="/" className="underline underline-offset-4">
          Send a message in Chat View
        </Link>{" "}
        and choose “View trace”.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
        <span>{result.requestId}</span>
        <span>· role: {result.audit.role}</span>
        <DecisionBadge decision={result.audit.decision} />
        <span className="ml-auto">{result.trace.durationMs.toFixed(1)} ms total</span>
      </header>

      <table className="w-full border-collapse text-left text-sm">
        <thead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-4 font-normal">Step</th>
            <th className="py-2 pr-4 font-normal">Stage</th>
            <th className="py-2 pr-4 font-normal">Status</th>
            <th className="py-2 pr-4 text-right font-normal">ms</th>
            <th className="py-2 font-normal">Caption</th>
          </tr>
        </thead>
        <tbody>
          {result.trace.spans.map((s) => (
            <tr key={s.spanId} className="border-b align-top">
              <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{STEP_LABEL[s.step]}</td>
              <td className={cn("py-2 pr-4 font-mono text-xs", s.parentSpanId && "pl-3")}>{s.stage}</td>
              <td className={cn("py-2 pr-4 font-mono text-xs", STATUS_TONE[s.status])}>{s.status}</td>
              <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">{s.durationMs.toFixed(1)}</td>
              <td className="py-2 text-xs">{s.caption}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ids.length > 1 && (
        <nav className="flex flex-wrap gap-2 font-mono text-xs">
          {ids.map((id) => (
            <Link
              key={id}
              href={`/dev?request=${id}`}
              className={cn("rounded border px-2 py-0.5", id === result.requestId ? "bg-muted" : "hover:bg-muted")}
            >
              {id}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
