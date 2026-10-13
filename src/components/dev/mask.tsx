"use client";

import { createContext, useContext } from "react";
import { maskText } from "@/lib/trace-view";

/** Hides known PHI values in any text the Dev View prints. */
export interface Masker {
  enabled: boolean;
  text: (s: string) => string;
}

const MaskContext = createContext<Masker>({ enabled: false, text: (s) => s });

export const MaskProvider = MaskContext.Provider;
export const useMask = () => useContext(MaskContext);

export function makeMasker(enabled: boolean, pattern: RegExp | null): Masker {
  return { enabled, text: enabled ? (s) => maskText(s, pattern) : (s) => s };
}
