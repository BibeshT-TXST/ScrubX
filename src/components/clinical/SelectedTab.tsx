"use client";

import { motion } from "motion/react";

/**
 * The open item in a sidebar list, drawn as a raised tab that runs through the
 * sidebar's divider and joins the pane it opened. Shared `layoutId` makes it slide
 * between rows, so a switch is seen, not just inferred. Place it first inside a
 * `relative` row; the sidebar draws its divider as an inset shadow so the tab can cover it.
 */
export function SelectedTab({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className="absolute inset-0 rounded-l-xl border border-r-0 border-foreground/15 bg-background shadow-[-4px_4px_12px_-6px_rgb(0_0_0/0.25)]"
    />
  );
}
