import type { ReactNode } from "react";
import type { PatientContext, PatientSummary } from "@/core/types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-label="Loading patient record">
      {[["w-2/3", "h-6"], ["w-full", "h-20"], ["w-full", "h-16"], ["w-full", "h-32"]].map(([w, h], i) => (
        <div key={i} className={`${w} ${h} animate-pulse rounded-md bg-muted`} />
      ))}
    </div>
  );
}

/** Left half of the Chat screen: the selected patient's record, as the clinician sees it. */
export function PatientInfo({ summary, record }: { summary?: PatientSummary; record?: PatientContext }) {
  return (
    <section className="min-h-0 overflow-y-auto border-r px-6 py-5">
      <header className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{summary?.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">{summary?.summary}</p>
      </header>

      {!record ? (
        <Skeleton />
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border bg-card p-4">
            <Field label="Date of birth">{record.fields.dob}</Field>
            <Field label="MRN">{record.fields.mrn}</Field>
            {record.fields.phone && <Field label="Phone">{record.fields.phone}</Field>}
            {record.fields.address && <Field label="Address">{record.fields.address}</Field>}
          </dl>

          {record.fields.conditions?.length ? (
            <Section title="Conditions">
              <ul className="flex flex-wrap gap-1.5">
                {record.fields.conditions.map((c) => (
                  <li key={c} className="rounded-md border bg-card px-2 py-0.5 text-sm">
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {record.fields.medications?.length ? (
            <Section title="Medications">
              <ul className="divide-y rounded-xl border bg-card text-sm">
                {record.fields.medications.map((m) => (
                  <li key={m} className="px-3 py-2">
                    {m}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Clinical notes">
            {/* Rendered raw on purpose: some records carry markup or hidden instructions the pipeline must handle. */}
            <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {record.description}
            </p>
          </Section>
        </div>
      )}
    </section>
  );
}
