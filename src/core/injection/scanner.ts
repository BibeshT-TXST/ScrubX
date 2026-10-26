import { COMMAND, INSTRUCTION_OVERRIDE, INSTRUCTIONS } from "../rules/injection.rules";
import type { NormalizerChanges } from "../text/normalize";
import type { Span } from "../types";

export const SIGNALS = [
  "role_override",
  "instruction_smuggling",
  "exfiltration",
  "encoded_payload",
  "obfuscation",
] as const;
export type SignalName = (typeof SIGNALS)[number];

export interface InjectionScan {
  /** 0–1, noisy-OR of the signal scores. */
  score: number;
  signals: Record<SignalName, number>;
  hits: (Span & { signal: SignalName; weight: number })[];
}

export interface ScanInput {
  text: string;
  /** Structural evidence from the normalizer (hidden markup, invisible chars, homoglyphs). */
  changes?: NormalizerChanges;
}

/** Swappable: v1 is the heuristic below; a model-based classifier can implement the same interface. */
export interface InjectionScanner {
  readonly name: string;
  scan(input: ScanInput): Promise<InjectionScan>;
}

type Family = readonly (readonly [RegExp, number])[];

// Weighted phrase families. Weights are per-pattern evidence, combined with noisy-OR.
const FAMILIES: Record<Exclude<SignalName, "obfuscation">, Family> = {
  role_override: [
    [/\byou are (?:now|no longer)\b/gi, 0.6],
    [/\bpretend (?:to be|you are)\b|\broleplay as\b/gi, 0.6],
    [/\bfrom now on\b/gi, 0.35],
    [/\b(?:new|updated|revised) (?:instructions|rules|persona|role)\b/gi, 0.6],
    [/(?:^|\n)\s*(?:system|assistant|developer)\s*:/gi, 0.7],
    [/\b(?:developer|god|admin|debug|unrestricted) mode\b/gi, 0.7],
  ],
  instruction_smuggling: [
        // Every override INJ-OVERRIDE sees, plus paraphrases still aimed at the assistant: a bare
    // command ("IGNORE INSTRUCTIONS!!") or "you|your" before the target ("bypass your rules").
    // Restrictions, policy and guidelines are clinical words ("ignore her dietary restrictions"),
    // so they count only after "you|your". One pattern, so a phrase that fits two shapes counts once.
    [new RegExp(
      String.raw`${INSTRUCTION_OVERRIDE.source}` +
        String.raw`|${COMMAND}\b(?:ignore|disregard|forget|override|bypass)\s+(?:(?:my|your|the|all|any)\s+)?${INSTRUCTIONS}` +
        String.raw`|\b(?:ignore|disregard|forget|override|bypass)\b(?:\s+\w+){0,2}?\s+(?:you|your|yourself)\b(?:\s+\w+){0,2}?\s+(?:${INSTRUCTIONS}|(?:guidelines|polic(?:y|ies)|restrictions)\b)`,
      "gi",
    ), 0.8],
    [/\b(?:ignore|disregard|forget|override|bypass)\b.{0,40}?\b(?:guardrails|filters?|what you (?:were|have been) told)\b/gi, 0.8],
    [/\b(?:do not|don't|never) (?:follow|obey|apply)\b.{0,30}?\b(?:rules|instructions|policy|guidelines)\b/gi, 0.7],
    [/\b(?:without|no) (?:restrictions|filters|censorship|limits|safety)\b/gi, 0.5],
  ],
  exfiltration: [
    [/\b(?:reveal|show|print|display|output|repeat|dump|leak|give me|export|send)\b.{0,50}?\b(?:system prompt|hidden (?:instructions|prompt|text|setup)|initial (?:instructions|prompt)|token map|tokens? (?:mapping|table)|vault|placeholders?|real (?:names?|values|identit(?:y|ies))|ssn|social security|api key|password|credentials)\b/gi, 0.8],
    [/\b(?:what|which|who) (?:is|are) (?:the )?(?:real|actual|true|original) (?:name|value|identity|patient)\b/gi, 0.6],
    [/\b(?:de-?tokeni[sz]e|unmask|re-?identify)\b/gi, 0.7],
    [/\b(?:all|every|other) patients?\b/gi, 0.35],
    [/https?:\/\/\S+/gi, 0.2],
  ],
  encoded_payload: [
    [/[A-Za-z0-9+/]{40,}={0,2}/g, 0.5],
    [/\b(?:base64|rot13|hex)[- ]?(?:decode|encoded|decoding)\b|\bdecode (?:this|the following)\b/gi, 0.5],
    [/(?:\\x[0-9a-f]{2}){4,}/gi, 0.4],
  ],
};

// Hiding text from a human reader is a strong tell on its own.
const OBFUSCATION_WEIGHTS = { comment: 0.4, invisible: 0.5, homoglyph: 0.5 } as const;

export const noisyOr = (scores: Iterable<number>) => {
  let keep = 1;
  for (const s of scores) keep *= 1 - s;
  return 1 - keep;
};

const round = (n: number) => Math.round(n * 100) / 100;

export class HeuristicScanner implements InjectionScanner {
  readonly name = "heuristic-v1";

  async scan({ text, changes = {} }: ScanInput): Promise<InjectionScan> {
    const hits: InjectionScan["hits"] = [];
    const signals = Object.fromEntries(SIGNALS.map((s) => [s, 0])) as Record<SignalName, number>;

    for (const [signal, family] of Object.entries(FAMILIES) as [SignalName, Family][]) {
      const weights: number[] = [];
      for (const [re, weight] of family) {
        for (const m of text.matchAll(re)) {
          hits.push({ signal, weight, start: m.index, end: m.index + m[0].length });
          weights.push(weight);
        }
      }
      signals[signal] = round(noisyOr(weights));
    }

    signals.obfuscation = round(
      noisyOr(
        (Object.keys(OBFUSCATION_WEIGHTS) as (keyof typeof OBFUSCATION_WEIGHTS)[])
          .filter((k) => changes[k])
          .map((k) => OBFUSCATION_WEIGHTS[k]),
      ),
    );

    return { score: round(noisyOr(Object.values(signals))), signals, hits };
  }
}
