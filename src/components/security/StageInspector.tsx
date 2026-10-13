"use client";

import type { ReactNode } from "react";
import type { StageSpan } from "@/core/pipeline/events";
import { CircleAlert } from "lucide-react";
import { formatMs } from "@/lib/clinical-format";
import { STEP_LABEL } from "@/lib/steps";
import { readableDiff } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { StatusLabel } from "./stage-status";
import { useMask } from "./mask";

function Diff({ before, after }: { before: string; after: string }) {
  const mask = useMask();
  return (
    <p className="font-mono text-data leading-7 wrap-break-word whitespace-pre-wrap">
      {/* Mask first: a word diff splits "Maria Lopez" into parts that no longer match the masked value. */}
      {readableDiff(mask.text(before), mask.text(after)).map((part, i) => (
        <span
          key={i}
          className={cn(
            // Removed is struck through, added is underlined: the change reads without color.
            part.kind === "removed" && "bg-block-surface text-block line-through",
            part.kind === "added" && "bg-allow-surface text-allow underline decoration-2 underline-offset-4",
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
      <h4 className="text-meta font-semibold text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Pre({ value }: { value: string }) {
  const mask = useMask();
  return (
    <pre className="max-h-72 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-meta leading-5 wrap-break-word whitespace-pre-wrap">
      {mask.text(value)}
    </pre>
  );
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

export function StageInspector({ span }: { span?: StageSpan }) {
  if (!span) {
    return <p className="text-data text-muted-foreground">Select a node in the pipeline graph, or a stage in the step&apos;s table, to inspect it.</p>;
  }
  const before = span.input?.text;
  const after = span.output?.text;
  const attributes = Object.entries(span.attributes);
  const hasPayload = span.input !== undefined || span.output !== undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="font-mono text-body font-semibold">{span.stage}</h3>
        <StatusLabel status={span.status} className="text-data" />
        <span className="numeric text-meta text-muted-foreground">
          {formatMs(span.durationMs)} · step {STEP_LABEL[span.step]} · <span className="font-mono">{span.spanId}</span>
          {span.parentSpanId && (
            <>
              {" "}
              · parent <span className="font-mono">{span.parentSpanId}</span>
            </>
          )}
        </span>
      </header>
      {span.caption && <p className="text-body">{span.caption}</p>}
      {span.error && (
        <p className="flex items-center gap-2 text-data text-block">
          <CircleAlert className="size-4" /> Error: {span.error}
        </p>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_18rem]">
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
              <ul className="space-y-1 text-data">
                {span.findings.map((f, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("font-mono", f.category === "injection" && "font-semibold text-block")}>{f.ruleId}</span>
                    <span className="numeric text-meta text-muted-foreground">
                      {f.category} · {f.severity} · characters {f.start}–{f.end}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          {!hasPayload && span.status !== "skipped" && (
            <p className="text-data text-muted-foreground">No input/output snapshot: trace payloads are off or this stage only reports metadata.</p>
          )}
        </div>

        <Block title="Attributes">
          {attributes.length ? (
            <dl className="divide-y rounded-md border text-meta">
              {attributes.map(([k, v]) => (
                <div key={k} className="grid min-h-8 grid-cols-[1fr_auto] items-center gap-3 px-3 py-1">
                  <dt className="font-mono text-muted-foreground">{k}</dt>
                  <dd className="numeric max-w-44 truncate text-right font-mono" title={String(v)}>
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-data text-muted-foreground">None</p>
          )}
        </Block>
      </div>
    </div>
  );
}
