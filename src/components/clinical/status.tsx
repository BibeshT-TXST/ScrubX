import { CircleCheck, Info, Loader2, ShieldAlert, ShieldX, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DecisionAction, PipelineOutcome } from "@/core/types";
import { outcomeLabel, outcomeTone, type OutcomeTone } from "@/lib/steps";
import { cn } from "@/lib/utils";

// Status is never color alone: every tone carries its own icon and a word.
const TONE: Record<OutcomeTone, { icon: LucideIcon; className: string }> = {
  allow: { icon: CircleCheck, className: "border-allow/30 bg-allow-surface text-allow" },
  flag: { icon: TriangleAlert, className: "border-flag/30 bg-flag-surface text-flag" },
  block: { icon: ShieldX, className: "border-block/30 bg-block-surface text-block" },
  unavailable: { icon: WifiOff, className: "border-notice/30 bg-notice-surface text-notice" },
};

interface BadgeProps {
  outcome?: PipelineOutcome;
  decision?: DecisionAction;
  /** Still streaming: shows a spinner instead of a result. */
  pending?: boolean;
  className?: string;
}

/** ScrubX's verdict on a request: allowed, flagged, blocked, or couldn't connect. */
export function OutcomeBadge({ outcome, decision, pending, className }: BadgeProps) {
  const base = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-meta font-medium whitespace-nowrap";
  if (pending) {
    return (
      <span className={cn(base, "text-muted-foreground", className)}>
        <Loader2 className="size-3.5 animate-spin" /> Checking
      </span>
    );
  }
  const tone = outcomeTone(outcome, decision);
  if (!tone) return null;
  const { icon: Icon, className: toneClass } = TONE[tone];
  return (
    <span className={cn(base, toneClass, className)}>
      <Icon className="size-3.5" />
      {outcomeLabel(outcome, decision)}
    </span>
  );
}

const NOTICE: Record<"info" | "flag" | "block" | "unavailable", { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-border bg-muted/50 text-foreground" },
  flag: { icon: TriangleAlert, className: "border-flag/30 bg-flag-surface text-flag" },
  block: { icon: ShieldAlert, className: "border-block/30 bg-block-surface text-block" },
  unavailable: { icon: WifiOff, className: "border-notice/30 bg-notice-surface text-notice" },
};

/** Tier-2 advisory: inline and non-blocking. Modals are kept for decisions, not information. */
export function Notice({
  tone,
  title,
  children,
  className,
}: {
  tone: keyof typeof NOTICE;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = NOTICE[tone];
  return (
    <div role={tone === "block" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="text-data font-semibold">{title}</p>
        {children && <div className="text-data text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}
