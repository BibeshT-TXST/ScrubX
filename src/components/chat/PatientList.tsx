"use client";

import { MessageSquareText, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import type { PatientSummary } from "@/core/types";
import { formatAge, formatDate, sexFromSummary } from "@/lib/clinical-format";
import { matchesPatient } from "@/lib/patient-search";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const useIsMac = () => useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);

interface Props {
  patients: PatientSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Patients with a conversation in this session. */
  active: ReadonlySet<string>;
  className?: string;
}

/**
 * The worklist. Two identifiers on every row (DOB and MRN) so a wrong-patient pick
 * is visible. The open patient's row becomes a tab joined to the chart beside it.
 */
export function PatientList({ patients, selectedId, onSelect, active, className }: Props) {
  const [query, setQuery] = useState("");
  const list = useRef<HTMLUListElement>(null);
  // One tab per list instance: the sidebar and the small-screen list can both be mounted.
  const tabId = useId();
  const mac = useIsMac();
  const today = new Date();
  const shown = patients.filter((p) => matchesPatient(p, query));
  const buttons = () => [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];

  // Up/Down move between patients; Enter (the button's own) opens one.
  const onListKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = buttons();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = all[Math.min(Math.max(i + (e.key === "ArrowDown" ? 1 : -1), 0), all.length - 1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons()[0]?.focus();
    } else if (e.key === "Enter" && shown[0]) {
      e.preventDefault();
      onSelect(shown[0].id);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    // The divider is an inset shadow, so the open patient's tab can paint over it and join the chart.
    <aside aria-label="Patients" className={cn("flex min-h-0 flex-col bg-muted/40 shadow-[inset_-1px_0_0_var(--color-border)]", className)}>
      <header className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <h2 className="text-section font-semibold">Patients</h2>
        <span className="numeric text-meta text-muted-foreground">
          {query ? `${shown.length} of ${patients.length}` : `${patients.length} synthetic`}
        </span>
      </header>

      <div className="px-3 pb-3">
        {/* Icon and shortcut are centred on the field itself, not on the padded wrapper. */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-patient-search
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Name, MRN or DOB"
            aria-label="Search patients by name, MRN or date of birth"
            className="peer h-10 bg-background py-0 pr-16 pl-9 text-data leading-10 md:text-data [&::-webkit-search-cancel-button]:hidden"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 gap-1 peer-focus:hidden peer-not-placeholder-shown:hidden">
            <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <ul ref={list} onKeyDown={onListKey} className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-1 pb-4 pl-2">
        {shown.length === 0 && <li className="px-3 py-2 text-data text-muted-foreground">No patient matches “{query.trim()}”.</li>}
        {shown.map((p) => {
          const selected = p.id === selectedId;
          const sex = sexFromSummary(p.summary);
          return (
            <li key={p.id} className="relative">
              {selected && (
                <motion.span
                  layoutId={tabId}
                  aria-hidden
                  className="absolute inset-0 rounded-l-xl border border-r-0 border-foreground/15 bg-background shadow-[-4px_4px_12px_-6px_rgb(0_0_0/0.25)]"
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative w-full rounded-l-xl py-2 pr-4 pl-3 text-left transition-colors focus-visible:-outline-offset-2",
                  !selected && "hover:bg-background/60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-data", selected ? "font-semibold" : "font-medium")}>{p.name}</span>
                  {active.has(p.id) && (
                    <MessageSquareText className="size-4 shrink-0 text-muted-foreground" aria-label="Has a conversation this session" />
                  )}
                </span>
                <span className="numeric mt-0.5 flex flex-wrap gap-x-2 text-meta text-muted-foreground">
                  <span>
                    {formatDate(p.dob)} ({formatAge(p.dob, today)}
                    {sex && ` ${sex[0]}`})
                  </span>
                  <span className="font-mono">{p.mrn}</span>
                </span>
                <span className="mt-0.5 block truncate text-meta text-muted-foreground in-data-[density=compact]:hidden">{p.summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
