"use client";

import { dots, type Segment, type SegmentKind, type StepBody } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { useMask } from "./mask";

// Same visual language as the site animation: dashed outline = detected,
// filled chip = token, muted = markup about to be stripped. Each kind also differs
// in shape (outline, fill, underline, strike), so none relies on color alone.
const STYLE: Record<SegmentKind, string> = {
  plain: "",
  markup: "text-muted-foreground/60 line-through decoration-muted-foreground/40",
  invisible: "mx-px rounded-sm border border-flag/40 bg-flag-surface px-0.5 text-flag",
  phi: "rounded-sm outline-1 outline-offset-1 outline-dashed outline-foreground/70",
  injection: "rounded-sm bg-block-surface text-block outline-2 outline-offset-1 outline-dashed outline-block",
  token: "rounded bg-foreground px-1 py-px text-[0.92em] text-background",
  restored: "underline decoration-allow decoration-2 underline-offset-4",
  redacted: "rounded bg-block px-1 py-px text-[0.92em] text-background",
  quarantined: "rounded border border-flag/40 bg-flag-surface px-1 py-px text-[0.92em] text-flag",
};

const LABEL: Record<Exclude<SegmentKind, "plain">, string> = {
  markup: "Markup, stripped",
  invisible: "Invisible character",
  phi: "PHI detected",
  injection: "Injection pattern",
  token: "Token sent to AI",
  restored: "Value restored",
  redacted: "Redacted",
  quarantined: "Quarantined instruction",
};

function SegmentText({ segment }: { segment: Segment }) {
  const mask = useMask();
  let text = segment.text;
  if (segment.kind === "invisible") text = "·";
  // Labeled and restored spans are PHI by definition; other text is masked by known value. Tokens never are.
  else if (segment.kind === "phi" || segment.kind === "restored") text = mask.enabled ? dots(text) : text;
  else if (segment.kind !== "token") text = mask.text(text);
  return (
    <span className={STYLE[segment.kind]} title={segment.title}>
      {text}
    </span>
  );
}

export function Segments({ body, className }: { body: StepBody; className?: string }) {
  if (!body.segments.length) {
    return <p className={cn("text-data text-muted-foreground", className)}>{body.empty}</p>;
  }
  return (
    <p className={cn("font-mono text-data leading-8 wrap-break-word whitespace-pre-wrap", body.muted && "opacity-50", className)}>
      {body.segments.map((s, i) => (
        <SegmentText key={i} segment={s} />
      ))}
    </p>
  );
}

/** A key for the marks actually on screen, so a reader never has to guess what an outline means. */
export function SegmentLegend({ body }: { body: StepBody }) {
  const kinds = [...new Set(body.segments.map((s) => s.kind))].filter((k): k is Exclude<SegmentKind, "plain"> => k !== "plain");
  if (!kinds.length) return null;
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-2 text-meta text-muted-foreground">
      {kinds.map((k) => (
        <li key={k} className="flex items-center gap-2">
          {/* Chips are sized in em; sampling them at body-text size keeps the legend at or above 12px. */}
          <span className="font-mono text-data">
            <span className={STYLE[k]}>{k === "invisible" ? "·" : "ab"}</span>
          </span>
          {LABEL[k]}
        </li>
      ))}
    </ul>
  );
}
