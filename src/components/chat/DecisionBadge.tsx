import { Loader2, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DecisionAction, PipelineOutcome } from "@/core/types";
import { outcomeLabel } from "@/lib/steps";
import { cn } from "@/lib/utils";

const TONE: Record<DecisionAction | "unavailable", string> = {
  allow: "bg-emerald-50 text-emerald-700 border-emerald-200",
  flag: "bg-amber-50 text-amber-800 border-amber-200",
  block: "bg-red-50 text-red-700 border-red-200",
  unavailable: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

interface Props {
  outcome?: PipelineOutcome;
  decision?: DecisionAction;
  /** Still streaming: shows a spinner instead of a result. */
  pending?: boolean;
  className?: string;
}

/** Risk decision for a finished request, or "couldn't connect" when the model was unreachable. */
export function OutcomeBadge({ outcome, decision, pending, className }: Props) {
  const base = "font-mono text-[11px] uppercase tracking-wide";
  if (pending) {
    return (
      <Badge variant="outline" className={cn(base, "text-muted-foreground", className)}>
        <Loader2 className="animate-spin" /> running
      </Badge>
    );
  }
  const label = outcomeLabel(outcome, decision);
  if (!label) return null;
  const tone = outcome === "unavailable" ? "unavailable" : decision!;
  return (
    <Badge variant="outline" className={cn(base, TONE[tone], className)}>
      {outcome === "unavailable" && <WifiOff />}
      {label}
    </Badge>
  );
}
