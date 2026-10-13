"use client";

import type { StageSpan, Step } from "@/core/pipeline/events";
import { stepBody } from "@/lib/trace-view";
import { Segments } from "./Segments";

const ROWS: [string, Step][] = [
  ["raw", "receive"],
  ["normalized", "normalize"],
  ["labeled", "detect"],
  ["tokenized", "tokenize"],
  ["model output", "model"],
  ["rehydrated", "restore"],
];

/** The same message at every stage of the pipeline: the core of the demo. */
export function DataLens({ spans, onStep }: { spans: StageSpan[]; onStep: (step: Step) => void }) {
  return (
    <ol className="divide-y rounded-xl border bg-card">
      {ROWS.map(([label, step]) => (
        <li key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-5 py-3">
          <button
            type="button"
            onClick={() => onStep(step)}
            className="self-start pt-1 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
          <Segments body={stepBody(step, spans)} className="text-xs leading-6" />
        </li>
      ))}
    </ol>
  );
}
