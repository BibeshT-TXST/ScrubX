"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { STEPS, type Step } from "@/core/pipeline/events";
import { STEP_LABEL } from "@/lib/steps";
import { cn } from "@/lib/utils";

/** Seconds since `since`, ticking while mounted. */
export function useElapsed(since?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}

/**
 * The site animation's segmented bar, filled up to the step the stream last
 * reported. The model step can take a while with a real LLM, so it says so.
 */
export function StepProgress({ step, startedAt }: { step: Step; startedAt?: number }) {
  const current = STEPS.indexOf(step);
  const elapsed = useElapsed(startedAt);
  const waitingOnModel = step === "model";
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < current ? "bg-foreground" : i === current ? "animate-pulse bg-foreground/60" : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {waitingOnModel ? "Waiting for the model's reply" : `stage ${current + 1}/${STEPS.length} · ${STEP_LABEL[step].toLowerCase()}`}
        <span className="tabular-nums">· {elapsed}s</span>
      </p>
      {waitingOnModel && elapsed >= 8 && (
        <p className="text-xs text-muted-foreground">Real models can take up to half a minute when busy. Retrying automatically if needed.</p>
      )}
    </div>
  );
}
