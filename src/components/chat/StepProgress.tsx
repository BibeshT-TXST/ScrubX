"use client";

import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { STEPS, type Step } from "@/core/pipeline/events";
import { STEP_LABEL } from "@/lib/steps";
import { useNow } from "@/lib/use-now";

/**
 * Where the request is in ScrubX, filled up to the step the stream last
 * reported. The model step can take a while with a real LLM, so it says so.
 */
export function StepProgress({ step, startedAt }: { step: Step; startedAt?: number }) {
  const current = STEPS.indexOf(step);
  const now = useNow(1000);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const waitingOnModel = step === "model";

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${STEPS.length}: ${STEP_LABEL[step]}`}
        className="flex gap-1"
      >
        {STEPS.map((s, i) => (
          <span key={s} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-foreground"
              initial={false}
              animate={{ scaleX: i <= current ? 1 : 0, opacity: i === current ? 0.55 : 1 }}
            />
          </span>
        ))}
      </div>
      <p className="numeric flex items-center gap-2 text-data text-muted-foreground" aria-live="polite">
        <Loader2 className="size-4 animate-spin" />
        {waitingOnModel ? "Waiting for the AI model's reply" : `Checking: ${STEP_LABEL[step]} (step ${current + 1} of ${STEPS.length})`}
        <span>· {elapsed} s</span>
      </p>
      {waitingOnModel && elapsed >= 8 && (
        <p className="text-meta text-muted-foreground">Real models can take up to half a minute when busy. ScrubX retries automatically.</p>
      )}
    </div>
  );
}
