import { STEPS, type Step } from "@/core/pipeline/events";
import { STEP_LABEL } from "@/lib/steps";
import { cn } from "@/lib/utils";

/** The site animation's segmented bar, filled up to the step the stream last reported. */
export function StepProgress({ step }: { step: Step }) {
  const current = STEPS.indexOf(step);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn("h-1 flex-1 rounded-full transition-colors", i <= current ? "bg-foreground" : "bg-muted")}
          />
        ))}
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        stage {current + 1}/{STEPS.length} · {STEP_LABEL[step].toLowerCase()}…
      </p>
    </div>
  );
}
