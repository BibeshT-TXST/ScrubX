import { useSyncExternalStore } from "react";
import { DISPLAY_KEY } from "./display-bootstrap";

// Per-viewer display preferences. The only thing ScrubX keeps in localStorage:
// a theme and a density, never PHI.

export const THEMES = ["system", "light", "dark"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export type Theme = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];

export interface Display {
  theme: Theme;
  density: Density;
}

const DEFAULT: Display = { theme: "system", density: "comfortable" };

export function parseDisplay(raw: string | null): Display {
  try {
    const p = JSON.parse(raw ?? "{}") as Partial<Display>;
    return {
      theme: THEMES.includes(p.theme as Theme) ? (p.theme as Theme) : DEFAULT.theme,
      density: DENSITIES.includes(p.density as Density) ? (p.density as Density) : DEFAULT.density,
    };
  } catch {
    return DEFAULT;
  }
}

let current: Display | null = null;
const listeners = new Set<() => void>();

function read(): Display {
  if (!current) {
    try {
      current = parseDisplay(localStorage.getItem(DISPLAY_KEY));
    } catch {
      current = DEFAULT;
    }
  }
  return current;
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Mirrors the bootstrap script in the root layout, which runs before first paint. */
export function applyDisplay(d: Display = read()) {
  const root = document.documentElement;
  const dark = d.theme === "dark" || (d.theme === "system" && prefersDark());
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  if (d.density === "compact") root.dataset.density = "compact";
  else delete root.dataset.density;
}

export function setDisplay(patch: Partial<Display>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(current));
  } catch {
    // Private mode or blocked storage: the choice still applies for this page.
  }
  applyDisplay(current);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplay(): Display {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
