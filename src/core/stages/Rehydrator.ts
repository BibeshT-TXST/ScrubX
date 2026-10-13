import { Stage, type SpanDetails } from "../pipeline/Stage";
import type { TokenVault } from "../tokens/TokenVault";
import { rehydrateText } from "../tokens/tokenize";
import { plural } from "./format";

export interface RehydratorInput {
  text: string;
  vault: TokenVault;
}

/** Step 7. Swaps tokens back to real values, the last thing before the clinician sees the answer. */
export class Rehydrator extends Stage<RehydratorInput, { text: string; count: number }> {
  readonly name = "Rehydrator" as const;
  readonly step = "restore" as const;

  protected async process({ text, vault }: RehydratorInput) {
    return rehydrateText(text, vault);
  }

  protected override snapshotInput(input: RehydratorInput) {
    return { text: input.text };
  }

  protected override snapshotOutput(out: { text: string }) {
    return { text: out.text };
  }

  protected override describe(_in: RehydratorInput, out: { count: number }): SpanDetails {
    return {
      caption: `Tokens are swapped back (${plural(out.count, "replacement")}). The audit log keeps no PHI.`,
      attributes: { rehydrated: out.count },
    };
  }
}
