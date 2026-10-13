import type { InjectionScanner } from "../injection/scanner";
import { detectPhi } from "../phi/classify";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import { QUARANTINED } from "../providers/prompt";
import { INJECTION_RULES } from "../rules/injection.rules";
import { matchRules } from "../rules/types";
import { normalizeText } from "../text/normalize";
import type { TokenVault } from "../tokens/TokenVault";
import { tokenizeText } from "../tokens/tokenize";
import { KNOWN_ROLES, type ChatTurn, type PatientContext, type PatientFieldKey, type Role } from "../types";
import { plural } from "./format";

// Address is never sent: it isn't needed to answer clinical questions.
export const FIELD_POLICY: Record<Role, readonly PatientFieldKey[]> = {
  medical_practitioner: ["name", "dob", "mrn", "phone", "conditions", "medications", "description"],
};

// Unknown roles get identification only. Pinned explicitly: with a single known role,
// "what every role shares" would be everything, the opposite of least privilege.
export const RESTRICTED_FIELDS: readonly PatientFieldKey[] = ["name", "dob"];

export function fieldsForRole(role: string): readonly PatientFieldKey[] {
  return (KNOWN_ROLES as readonly string[]).includes(role) ? FIELD_POLICY[role as Role] : RESTRICTED_FIELDS;
}

const FIELD_ORDER: readonly PatientFieldKey[] = ["name", "dob", "mrn", "phone", "address", "conditions", "medications", "description"];
const FIELD_LABEL: Record<PatientFieldKey, string> = {
  name: "Name", dob: "DOB", mrn: "MRN", phone: "Phone", address: "Address",
  conditions: "Conditions", medications: "Medications", description: "Description",
};

export interface RetrievalInput {
  patient: PatientContext;
  history: ChatTurn[];
  vault: TokenVault;
}

export interface Retrieved {
  context: string;
  history: ChatTurn[];
  released: PatientFieldKey[];
  withheld: PatientFieldKey[];
  /** Sentences dropped from the record or history because they carried instructions. */
  quarantined: number;
}

function fieldValue(patient: PatientContext, key: PatientFieldKey): string | undefined {
  const v = key === "description" ? patient.description : patient.fields[key];
  return Array.isArray(v) ? v.join(", ") : v || undefined;
}

/**
 * Step 6a. Builds the context the model sees: role-filtered record plus prior
 * turns. Both are untrusted (indirect injection), so they get the same
 * treatment as the message: normalize, drop sentences that carry
 * instructions, then tokenize with the request's vault so "Maria Lopez" is
 * [PATIENT_1] everywhere.
 */
export class Retrieval extends Stage<RetrievalInput, Retrieved> {
  readonly name = "Retrieval" as const;
  readonly step = "model" as const;

  constructor(private readonly scanner: InjectionScanner) {
    super();
  }

  protected async process({ patient, history, vault }: RetrievalInput, ctx: StageContext): Promise<Retrieved> {
    const allowed = fieldsForRole(ctx.role);
    const present = FIELD_ORDER.filter((k) => fieldValue(patient, k) !== undefined);
    const released = present.filter((k) => allowed.includes(k));
    const withheld = present.filter((k) => !allowed.includes(k));

    let quarantined = 0;
    const sanitize = async (text: string) => {
      const clean = await this.quarantine(normalizeText(text).text, ctx.config.risk.flagThreshold);
      quarantined += clean.removed;
      return tokenizeText(clean.text, detectPhi(clean.text, patient, ctx.now), vault, patient, ctx.config.entityPolicy).text;
    };

    // Sequential on purpose: token numbering follows reading order.
    const context = await sanitize(released.map((k) => `${FIELD_LABEL[k]}: ${fieldValue(patient, k)}`).join("\n"));
    const turns: ChatTurn[] = [];
    for (const t of history) turns.push({ role: t.role, content: await sanitize(t.content) });

    return { context, history: turns, released, withheld, quarantined };
  }

  private async quarantine(text: string, threshold: number): Promise<{ text: string; removed: number }> {
    let removed = 0;
    const lines = await Promise.all(
      text.split("\n").map(async (line) => {
        const sentences = await Promise.all(
          line.split(/(?<=[.!?])\s+/).map(async (s) => {
            const ruleHit = matchRules(s, INJECTION_RULES).some((f) => f.severity === "critical" || f.severity === "high");
            if (!ruleHit && (await this.scanner.scan({ text: s })).score < threshold) return s;
            removed++;
            return QUARANTINED;
          }),
        );
        return sentences.join(" ");
      }),
    );
    return { text: lines.join("\n"), removed };
  }

  protected override snapshotOutput(out: Retrieved) {
    return { text: out.context, data: { released: out.released, withheld: out.withheld, history: out.history } };
  }

  protected override describe(_in: RetrievalInput, out: Retrieved, ctx: StageContext): SpanDetails {
    const parts = [`Retrieval is filtered by role (${ctx.role}): ${plural(out.released.length, "field")} released, ${out.withheld.length} withheld`];
    if (out.quarantined) parts.push(`${plural(out.quarantined, "embedded instruction")} removed from the record`);
    return {
      caption: `${parts.join("; ")}.`,
      attributes: {
        released: out.released.join(","),
        withheld: out.withheld.join(","),
        quarantined: out.quarantined,
        historyTurns: out.history.length,
      },
    };
  }
}
