"use client";

import { dots, type Segment, type SegmentKind, type StepBody } from "@/lib/trace-view";
import { cn } from "@/lib/utils";
import { useMask } from "./mask";

// Same visual language as the site animation: dashed outline = detected,
// filled chip = token, muted = markup about to be stripped.
const STYLE: Record<SegmentKind, string> = {
  plain: "",
  markup: "text-muted-foreground/50",
  invisible: "mx-px rounded-sm bg-amber-100 px-0.5 text-amber-700",
  phi: "rounded-sm outline-1 outline-offset-1 outline-dashed outline-foreground/70",
  injection: "rounded-sm bg-red-50 text-red-800 outline-1 outline-offset-1 outline-dashed outline-red-500",
  token: "rounded bg-foreground px-1 py-px text-[0.92em] text-background",
  restored: "underline decoration-emerald-500 decoration-2 underline-offset-4",
  redacted: "rounded bg-red-600 px-1 py-px text-[0.92em] text-white",
  quarantined: "rounded bg-amber-100 px-1 py-px text-[0.92em] text-amber-800",
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
    return <p className={cn("font-mono text-xs text-muted-foreground", className)}>{body.empty}</p>;
  }
  return (
    <p className={cn("whitespace-pre-wrap break-words font-mono text-[13px] leading-7", body.muted && "opacity-40", className)}>
      {body.segments.map((s, i) => (
        <SegmentText key={i} segment={s} />
      ))}
    </p>
  );
}
