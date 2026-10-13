"use client";

import { useEffect, useState } from "react";
import { STEPS } from "@/core/pipeline/events";

const STEP_MS = 900;
const LAST = STEPS.length - 1;

/**
 * Walks the 7 steps at a readable pace, but never past `available` (the
 * furthest step real stream events have reached). A 1 ms pipeline stays
 * watchable and a slow one never shows a step before it happened.
 * Remount (via `key`) to reset for a new request.
 */
export function usePlayback(available: number) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);

  // Depends on whether we can advance, not on `available` itself, so spans
  // streaming in don't keep restarting the timer.
  const canAdvance = auto && step < available;
  useEffect(() => {
    if (!canAdvance) return;
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [canAdvance, step]);

  return {
    step,
    playing: auto && step < LAST,
    go: (i: number) => {
      setAuto(false);
      setStep(Math.min(Math.max(i, 0), LAST));
    },
    toggle: () => setAuto((a) => !a),
    replay: () => {
      setStep(0);
      setAuto(true);
    },
  };
}
