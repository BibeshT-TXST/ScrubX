"use client";

import { EyeOff, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldsForRole } from "@/core/stages/Retrieval";
import { DEFAULT_ROLE, type PatientContext, type PatientFieldKey } from "@/core/types";
import { formatStamp, splitDose, tallMan } from "@/lib/clinical-format";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

const SENT = new Set<PatientFieldKey>(fieldsForRole(DEFAULT_ROLE));

/** Fields the role policy keeps away from the model get a visible tag, so the clinician knows what the AI can't see. */
function Withheld({ field }: { field: PatientFieldKey }) {
  if (SENT.has(field)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border px-1.5 text-meta font-medium text-muted-foreground">
      <EyeOff className="size-3.5" /> Not sent to AI
    </span>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-body font-semibold">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-data text-muted-foreground">{children}</p>;
}

function RecordSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading patient record">
      {["h-16", "h-28", "h-40", "h-16"].map((h, i) => (
        <Skeleton key={i} className={`w-full ${h}`} />
      ))}
    </div>
  );
}

interface Props {
  record?: PatientContext;
  /** When the record was retrieved, for provenance. */
  retrievedAt?: number;
  source: "demo" | "supabase";
  className?: string;
}

export function PatientRecord({ record, retrievedAt, source, className }: Props) {
  const now = useNow();
  const fields = record?.fields;

  return (
    <section aria-label="Patient record" className={cn("flex min-h-0 flex-col", className)}>
      <header className="flex items-center gap-2 border-b px-(--pane-x) py-3">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="text-section font-semibold">Record</h2>
        <span className="ml-auto rounded-sm border px-1.5 text-meta font-medium text-muted-foreground">View only</span>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-(--pane-x) py-(--pane-y)">
        {!fields ? (
          <RecordSkeleton />
        ) : (
          <>
            <Section title="Conditions">
              {fields.conditions?.length ? (
                <ul className="divide-y rounded-lg border bg-card">
                  {fields.conditions.map((c) => (
                    <li key={c} className="flex min-h-(--row-h) items-center px-3 text-data">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>None recorded.</Empty>
              )}
            </Section>

            <Section title="Medications">
              {fields.medications?.length ? (
                <table className="w-full overflow-hidden rounded-lg border bg-card text-data">
                  <thead className="bg-muted/50 text-left text-meta text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Medication
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Dose
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fields.medications.map((m) => {
                      const { drug, dose } = splitDose(m);
                      return (
                        <tr key={m} className="h-(--row-h)">
                          <td className="px-3">{tallMan(drug)}</td>
                          <td className="numeric px-3 text-right font-mono">
                            {dose ?? <span className="font-sans text-muted-foreground">Dose not recorded</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Empty>None recorded.</Empty>
              )}
            </Section>

            <Section title="Clinical notes">
              {/* Shown exactly as stored: some records carry markup or hidden instructions that ScrubX must handle. */}
              <p className="max-w-[72ch] rounded-lg border bg-card p-4 text-body whitespace-pre-wrap">{record.description}</p>
              <p className="text-meta text-muted-foreground">
                Shown as stored. ScrubX strips markup and quarantines instructions before any of this reaches the AI.
              </p>
            </Section>

            <Section title="Contact">
              <dl className="divide-y rounded-lg border bg-card text-data">
                <div className="flex min-h-(--row-h) flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                  <dt className="w-20 text-muted-foreground">Phone</dt>
                  <dd className="numeric font-mono">{fields.phone ?? <span className="font-sans text-muted-foreground">Not recorded</span>}</dd>
                  <Withheld field="phone" />
                </div>
                <div className="flex min-h-(--row-h) flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                  <dt className="w-20 text-muted-foreground">Address</dt>
                  <dd className="min-w-0 flex-1">{fields.address ?? <span className="text-muted-foreground">Not recorded</span>}</dd>
                  <Withheld field="address" />
                </div>
              </dl>
            </Section>

            <footer className="space-y-1 border-t pt-4 text-meta text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Source:</span>{" "}
                {source === "demo" ? "Synthetic demo dataset (fictional patients)" : "Supabase patient store, read-only"}
              </p>
              {retrievedAt && (
                <p className="numeric">
                  <span className="font-medium text-foreground">Retrieved:</span> {formatStamp(retrievedAt, now)}
                </p>
              )}
              <p>
                <span className="font-medium text-foreground">Entered by:</span> not recorded in this source
              </p>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}
