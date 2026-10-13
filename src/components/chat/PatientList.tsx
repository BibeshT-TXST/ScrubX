import type { PatientSummary } from "@/core/types";
import { cn } from "@/lib/utils";

interface Props {
  patients: PatientSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Patients with a conversation in this session get a dot. */
  active: ReadonlySet<string>;
}

export function PatientList({ patients, selectedId, onSelect, active }: Props) {
  return (
    <aside className="flex min-h-0 flex-col border-r bg-muted/30">
      <h2 className="px-4 pt-4 pb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        Patients · synthetic
      </h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {patients.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              aria-current={p.id === selectedId}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                p.id === selectedId ? "border-foreground bg-background" : "border-transparent hover:bg-background",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {p.name}
                {active.has(p.id) && <span className="size-1.5 rounded-full bg-foreground" aria-label="has conversation" />}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
