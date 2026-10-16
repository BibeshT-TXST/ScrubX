import { MEDICATIONS } from "../phi/dictionaries";
import { detectPhi } from "../phi/classify";
import { Stage, type SpanDetails, type StageContext } from "../pipeline/Stage";
import type { TokenVault } from "../tokens/TokenVault";
import { REDACTED, repairTokens, TOKEN_PATTERN } from "../tokens/tokenize";
import type { PatientContext, PhiType } from "../types";
import { plural } from "./format";

export interface OutputInput {
  completion: string;
  vault: TokenVault;
  patient: PatientContext;
  /** Everything the model was given (tokenized), for the grounding check. */
  sources: string;
  /** Set when the risk engine flagged the request or Retrieval quarantined something. */
  strict: boolean;
}

export interface OutputVerdict {
  text: string;
  leaks: { type: PhiType; start: number; end: number }[];
  unknownTokens: string[];
  ungrounded: { kind: "number" | "medication"; text: string }[];
  /** Placeholders the model mangled ("[PATIENT 1]") that were restored to a known token. */
  repairedTokens: number;
  linksRemoved: number;
  strict: boolean;
}

const NUMBER = /\d+(?:\.\d+)?/g;
const URL = /\bhttps?:\/\/\S+/gi;
// Confidence a raw PHI hit needs before it is redacted; strict mode redacts everything.
const LEAK_CONFIDENCE = { normal: 0.5, strict: 0 } as const;

const numbersIn = (text: string) => new Set(text.replace(TOKEN_PATTERN, " ").match(NUMBER) ?? []);

/**
 * Step 6c. Checks the tokenized answer before anything is restored:
 * unknown tokens are stripped, raw PHI (which the model never saw, so it is
 * invented or leaked) is redacted, and ungrounded numbers or medications are
 * flagged in the trace but left in place.
 */
export class OutputAnalysis extends Stage<OutputInput, OutputVerdict> {
  readonly name = "OutputAnalysis" as const;
  readonly step = "model" as const;

  protected async process(input: OutputInput, ctx: StageContext): Promise<OutputVerdict> {
    const repair = repairTokens(input.completion, input.vault);
    const unknownTokens: string[] = [];
    let text = repair.text.replace(TOKEN_PATTERN, (t) => {
      if (input.vault.resolve(t) !== undefined) return t;
      unknownTokens.push(t);
      return REDACTED;
    });

    const minConfidence = LEAK_CONFIDENCE[input.strict ? "strict" : "normal"];
    // Links in the answer follow the link policy below (removed in strict mode), not the leak check.
    const leaks = detectPhi(text, input.patient, ctx.now)
      .filter((l) => l.type !== "URL" && l.confidence >= minConfidence)
      .map(({ type, start, end }) => ({ type, start, end }));
    for (const l of [...leaks].reverse()) text = text.slice(0, l.start) + REDACTED + text.slice(l.end);

    let linksRemoved = 0;
    if (input.strict) {
      text = text.replace(URL, () => {
        linksRemoved++;
        return "[link removed]";
      });
    }

    const sourceNumbers = numbersIn(input.sources);
    const sources = input.sources.toLowerCase();
    const medications = new Set([
      ...MEDICATIONS,
      ...(input.patient.fields.medications ?? []).map((m) => m.split(" ")[0]!.toLowerCase()),
    ]);
    const ungrounded: OutputVerdict["ungrounded"] = [
      ...[...numbersIn(text)].filter((n) => !sourceNumbers.has(n)).map((n) => ({ kind: "number" as const, text: n })),
      ...[...medications]
        .filter((m) => new RegExp(`\\b${m}\\b`, "i").test(text) && !sources.includes(m))
        .map((m) => ({ kind: "medication" as const, text: m })),
    ];

    return { text, leaks, unknownTokens, ungrounded, repairedTokens: repair.repaired, linksRemoved, strict: input.strict };
  }

  protected override snapshotInput(input: OutputInput) {
    return { text: input.completion, data: { strict: input.strict } };
  }

  protected override snapshotOutput(v: OutputVerdict) {
    return {
      text: v.text,
      data: { leaks: v.leaks, unknownTokens: v.unknownTokens, ungrounded: v.ungrounded, repairedTokens: v.repairedTokens },
    };
  }

  protected override describe(_in: OutputInput, v: OutputVerdict): SpanDetails {
    const issues = [
      v.leaks.length && `${plural(v.leaks.length, "PHI leak")} redacted`,
      v.unknownTokens.length && `${plural(v.unknownTokens.length, "unknown token")} stripped`,
      v.ungrounded.length && `${plural(v.ungrounded.length, "ungrounded claim")} flagged`,
      v.linksRemoved && `${plural(v.linksRemoved, "link")} removed`,
      v.repairedTokens && `${plural(v.repairedTokens, "mangled token")} repaired`,
    ].filter(Boolean);
    return {
      caption: issues.length
        ? `Answer checked for leaks: ${issues.join(", ")}.`
        : "Answer checked for leaks: none found, every claim grounded.",
      attributes: {
        strict: v.strict,
        leaks: v.leaks.length,
        unknownTokens: v.unknownTokens.length,
        ungrounded: v.ungrounded.length,
        linksRemoved: v.linksRemoved,
        repairedTokens: v.repairedTokens,
      },
    };
  }
}
