import { classifyPhi } from "../phi/classify";
import { countByType, resolveLabels } from "../phi/labels";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import type { PatientContext, PhiLabel } from "../types";
import { listCounts, plural } from "./format";

export interface PhiClassifierInput {
  text: string;
  patient: PatientContext;
}

/** Step 3c. Record-aware + dictionary PHI labels: type and offsets, never values. */
export class PhiClassifier extends Stage<PhiClassifierInput, PhiLabel[]> {
  readonly name = "PhiClassifier" as const;
  readonly step = "detect" as const;

  protected async process(input: PhiClassifierInput, ctx: StageContext): Promise<PhiLabel[]> {
    return resolveLabels(classifyPhi(input.text, input.patient, ctx.now));
  }

  protected override snapshotOutput(labels: PhiLabel[]) {
    return { data: labels };
  }

  protected override describe(_in: PhiClassifierInput, labels: PhiLabel[]): SpanDetails {
    const counts = countByType(labels);
    return {
      caption: labels.length
        ? `PHI classifier labeled ${plural(labels.length, "field")} (${listCounts(counts)}).`
        : "PHI classifier found no record or dictionary matches.",
      attributes: { labels: labels.length, ...counts },
    };
  }
}
