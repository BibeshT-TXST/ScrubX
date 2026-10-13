import { CircleAlert, CircleCheck, CircleDashed, CircleDot, ShieldX, type LucideIcon } from "lucide-react";
import type { StepStatus } from "@/core/pipeline/steps";
import { cn } from "@/lib/utils";

/** One vocabulary for stage and step state everywhere in the Security Division: icon + word, color last. */
export const STATUS: Record<StepStatus, { icon: LucideIcon; label: string; className: string }> = {
  ok: { icon: CircleCheck, label: "Ran", className: "text-foreground" },
  blocked: { icon: ShieldX, label: "Blocked", className: "text-block" },
  error: { icon: CircleAlert, label: "Error", className: "text-block" },
  skipped: { icon: CircleDashed, label: "Skipped", className: "text-muted-foreground" },
  pending: { icon: CircleDot, label: "Not reached", className: "text-muted-foreground" },
};

export function StatusLabel({ status, className }: { status: StepStatus; className?: string }) {
  const { icon: Icon, label, className: tone } = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone, className)}>
      <Icon className="size-4 shrink-0" />
      {label}
    </span>
  );
}
