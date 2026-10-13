"use client";

import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyDisplay } from "@/lib/display";

export function Providers({ children }: { children: ReactNode }) {
  // "Match system" has to follow the OS when it flips between day and night themes.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDisplay();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    // reducedMotion="user": every motion component honours prefers-reduced-motion.
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18, ease: "easeOut" }}>
      <TooltipProvider delay={300}>
        {children}
      </TooltipProvider>
    </MotionConfig>
  );
}
