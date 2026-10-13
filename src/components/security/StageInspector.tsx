"use client";

import { diffWordsWithSpace } from "diff";
import type { ReactNode } from "react";
import type { StageSpan } from "@/core/pipeline/events";
import { cn } from "@/lib/utils";
import { useMask } from "./mask";

function Diff({ before, after }: { before: string; after: string }) {
  const mask = useMask();
  return (
    <p className="whitespace-pre-wrap break-words font-mono text-xs leading-6">
      {/* Mask first: a word diff splits "Maria Lopez" into parts that no longer match the masked value. */}
      {diffWordsWithSpace(mask.text(before), mask.text(after)).map((part, i) => (
        <span
          key={i}
          className={cn(
            part.removed && "bg-red-100 text-red-800 line-through decoration-red-400",
            part.added && "bg-emerald-100 text-emerald-900",
          )}
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Pre({ value }: { value: string }) {
  const mask = useMask();
  return (
    <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap break-words">
      {mask.text(value)}
    </pre>
  );
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

export function StageInspector({ span }: { span?: StageSpan }) {
  if (!span) {
    return <p className="text-sm text-muted-foreground">Click a node in the graph or a stage in the card drawer to inspect it.</p>;
  }
  const before = span.input?.text;
  const after = span.output?.text;
  const attributes = Object.entries(span.attributes);
  const hasPayload = span.input !== undefined || span.output !== undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="font-mono text-sm font-medium">{span.stage}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {span.status} · {span.durationMs.toFixed(2)} ms · step {span.step} · {span.spanId}
          {span.parentSpanId && ` · parent ${span.parentSpanId}`}
        </span>
      </header>
      {span.caption && <p className="text-sm">{span.caption}</p>}
      {span.error && <p className="text-sm text-red-700">Error: {span.error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {before !== undefined && after !== undefined && before !== after ? (
            <Block title="Text diff (input → output)">
              <Diff before={before} after={after} />
            </Block>
          ) : (
            (before ?? after) !== undefined && (
              <Block title={before !== undefined && after !== undefined ? "Text (unchanged)" : before !== undefined ? "Input text" : "Output text"}>
                <Pre value={(after ?? before)!} />
              </Block>
            )
          )}
          {span.input?.data !== undefined && (
            <Block title="Input data">
              <Pre value={json(span.input.data)} />
            </Block>
          )}
          {span.output?.data !== undefined && (
            <Block title="Output data">
              <Pre value={json(span.output.data)} />
            </Block>
          )}
          {span.findings?.length ? (
            <Block title="Findings">
              <ul className="space-y-1 font-mono text-xs">
                {span.findings.map((f, i) => (
                  <li key={i}>
                    <span className={f.category === "injection" ? "text-red-700" : ""}>{f.ruleId}</span>{" "}
                    <span className="text-muted-foreground">
                      {f.severity} · [{f.start}, {f.end})
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {!hasPayload && span.status !== "skipped" && (
            <p className="text-xs text-muted-foreground">No input/output snapshot: trace payloads are off or this stage only reports metadata.</p>
          )}
        </div>

        <Block title="Attributes">
          {attributes.length ? (
            <dl className="divide-y rounded-md border font-mono text-[11px]">
              {attributes.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="max-w-40 truncate text-right" title={String(v)}>
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">None</p>
          )}
        </Block>
      </div>
    </div>
  );
}
