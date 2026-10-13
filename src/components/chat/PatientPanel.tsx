import type { ReactNode } from "react";
import { KNOWN_ROLES, type PatientContext } from "@/core/types";
import { cn } from "@/lib/utils";

interface Props {
  patients: PatientContext[];
  selected: PatientContext;
  onSelect: (id: string) => void;
  role: string;
  onRole: (role: string) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-xs">
      <dt className="font-mono uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function PatientPanel({ patients, selected, onSelect, role, onRole }: Props) {
  const { fields } = selected;
  return (
    <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r bg-muted/30 p-4">
      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Role (set by host)</h2>
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-background p-1">
          {KNOWN_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRole(r)}
              aria-pressed={r === role}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                r === role ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Demo patients · synthetic</h2>
        <ul className="space-y-1">
          {patients.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                aria-current={p.id === selected.id}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                  p.id === selected.id ? "border-foreground bg-background" : "border-transparent hover:bg-background",
                )}
              >
                <span className="block text-sm font-medium">{p.fields.name}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {p.fields.conditions?.join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border bg-background p-3">
        <h2 className="font-medium">{fields.name}</h2>
        <dl className="space-y-1.5">
          <Field label="DOB">{fields.dob}</Field>
          <Field label="MRN">{fields.mrn}</Field>
          {fields.phone && <Field label="Phone">{fields.phone}</Field>}
          {fields.conditions && <Field label="Conditions">{fields.conditions.join(", ")}</Field>}
          {fields.medications && <Field label="Medications">{fields.medications.join(", ")}</Field>}
        </dl>
        {/* Rendered raw on purpose: some records carry markup or hidden instructions the pipeline must handle. */}
        <p className="whitespace-pre-wrap border-t pt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {selected.description}
        </p>
      </section>
    </aside>
  );
}
