"use client";

import { Users } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PatientSummary } from "@/core/types";
import { formatAge, formatDate, sexFromSummary } from "@/lib/clinical-format";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="numeric text-data font-medium">{children}</dd>
    </div>
  );
}

/**
 * Fixed above every view of a patient: two identifiers, age and sex, never
 * collapsed. Re-keyed per patient so a switch is visibly a switch.
 */
export function PatientBanner({ patient, onSwitch }: { patient: PatientSummary; onSwitch?: () => void }) {
  const sex = sexFromSummary(patient.summary);
  return (
    <motion.section
      key={patient.id}
      aria-label={`Patient banner: ${patient.name}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 border-b bg-card px-(--pane-x) py-3"
    >
      <div className="flex items-center gap-3">
        {onSwitch && (
          <Button variant="outline" size="icon" onClick={onSwitch} aria-label="Switch patient" className="lg:hidden">
            <Users />
          </Button>
        )}
        <h1 className="text-title font-semibold">{patient.name}</h1>
      </div>

      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Item label="Date of birth">
          {formatDate(patient.dob)} <span className="text-muted-foreground">({formatAge(patient.dob, new Date())})</span>
        </Item>
        <Item label="Sex">{sex ?? <span className="text-muted-foreground">Not recorded</span>}</Item>
        <Item label="MRN">
          <span className="font-mono">{patient.mrn}</span>
        </Item>
      </dl>
    </motion.section>
  );
}
