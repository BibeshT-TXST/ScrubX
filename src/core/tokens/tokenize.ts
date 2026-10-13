import { PHI_TYPES, type PatientContext, type PhiLabel, type PhiType } from "../types";
import type { TokenVault } from "./TokenVault";

export type EntityPolicy = "tokenize" | "keep" | "bucket";
export type EntityPolicies = Record<PhiType, EntityPolicy>;

export const DEFAULT_ENTITY_POLICY: EntityPolicies = Object.fromEntries(
  PHI_TYPES.map((t) => [t, "tokenize"]),
) as EntityPolicies;

/** Matches any well-formed token, e.g. [PATIENT_1]. */
export const TOKEN_PATTERN = new RegExp(`\\[(?:${PHI_TYPES.join("|")})_\\d+\\]`, "g");

export interface TokenEntity {
  token: string;
  type: PhiType;
}

export interface TokenizedText {
  text: string;
  entities: TokenEntity[];
}

// Safe Harbor: ages over 89 must be aggregated into a single 90+ bucket.
function bucketAge(value: string): string {
  const age = Number(value);
  if (!Number.isFinite(age)) return value;
  if (age >= 90) return "90+";
  const lo = Math.floor(age / 10) * 10;
  return `${lo}-${lo + 9}`;
}

/** Replaces labeled spans with typed tokens. Labels must be non-overlapping (see resolveLabels). */
export function tokenizeText(
  text: string,
  labels: readonly PhiLabel[],
  vault: TokenVault,
  patient: PatientContext,
  policy: EntityPolicies = DEFAULT_ENTITY_POLICY,
): TokenizedText {
  const entities: TokenEntity[] = [];
  let out = "";
  let cursor = 0;
  for (const l of [...labels].sort((a, b) => a.start - b.start)) {
    const action = policy[l.type];
    if (action === "keep") continue;
    const raw = text.slice(l.start, l.end);
    let replacement: string;
    if (action === "bucket" && l.type === "AGE") {
      replacement = bucketAge(raw);
    } else {
      // Record-matched spans store the record's spelling so restore outputs "Maria Lopez", not "MARIA LOPEZ".
      const value = (l.field && patient.fields[l.field]) || raw;
      replacement = vault.tokenFor(l.type, value);
      entities.push({ token: replacement, type: l.type });
    }
    out += text.slice(cursor, l.start) + replacement;
    cursor = l.end;
  }
  return { text: out + text.slice(cursor), entities };
}

/** Swaps known tokens back to their values. Unknown tokens are left as-is (OutputAnalysis strips them first). */
export function rehydrateText(text: string, vault: TokenVault): { text: string; count: number } {
  let count = 0;
  const out = text.replace(TOKEN_PATTERN, (token) => {
    const value = vault.resolve(token);
    if (value === undefined) return token;
    count++;
    return value;
  });
  return { text: out, count };
}
