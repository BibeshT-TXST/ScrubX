import { countByType } from "../phi/labels";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import { TokenVault } from "../tokens/TokenVault";
import { tokenizeText, type TokenizedText } from "../tokens/tokenize";
import type { PatientContext, PhiLabel } from "../types";
import { listCounts, plural } from "./format";

export interface TokenizerInput {
  text: string;
  /** Merged, non-overlapping labels from the PHI classifier and regex rules. */
  labels: PhiLabel[];
  patient: PatientContext;
}

export interface Tokenized extends TokenizedText {
  /** Request-scoped. Never part of a snapshot. */
  vault: TokenVault;
}

/** Step 5. Swaps identifiers for typed tokens ([PATIENT_1], [DATE_1]) and opens the vault. */
export class Tokenizer extends Stage<TokenizerInput, Tokenized> {
  readonly name = "Tokenizer" as const;
  readonly step = "tokenize" as const;

  protected async process(input: TokenizerInput, ctx: StageContext): Promise<Tokenized> {
    const vault = new TokenVault();
    return { ...tokenizeText(input.text, input.labels, vault, input.patient, ctx.config.entityPolicy), vault };
  }

  protected override snapshotInput(input: TokenizerInput) {
    return { text: input.text, data: { labels: input.labels } };
  }

  // The token map holds real values, so it only exists when trace payloads are on (synthetic demo).
  protected override snapshotOutput(out: Tokenized) {
    return { text: out.text, data: { map: out.vault.snapshot() } };
  }

  protected override describe(_in: TokenizerInput, out: Tokenized): SpanDetails {
    const counts = countByType(out.vault.tokens());
    return {
      caption: out.vault.size
        ? `Patient details are swapped for ${plural(out.vault.size, "token")} (${listCounts(counts)}).`
        : "No identifiers to tokenize.",
      attributes: { tokens: out.vault.size, mentions: out.entities.length, ...counts },
    };
  }
}
