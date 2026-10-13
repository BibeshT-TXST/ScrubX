import { Badge } from "@/components/ui/badge";
import type { DecisionAction } from "@/core/types";
import { DECISION_LABEL } from "@/lib/steps";
import { cn } from "@/lib/utils";

const TONE: Record<DecisionAction, string> = {
  allow: "bg-emerald-50 text-emerald-700 border-emerald-200",
  flag: "bg-amber-50 text-amber-800 border-amber-200",
  block: "bg-red-50 text-red-700 border-red-200",
};

export function DecisionBadge({ decision, className }: { decision: DecisionAction; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] uppercase tracking-wide", TONE[decision], className)}>
      {DECISION_LABEL[decision]}
    </Badge>
  );
}
