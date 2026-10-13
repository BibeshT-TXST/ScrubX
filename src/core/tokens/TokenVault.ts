import type { PhiType } from "../types";

// Identifiers whose formatting varies ("MRN-100231" vs "100231") share a token by digits.
const DIGIT_KEYED: ReadonlySet<PhiType> = new Set(["PHONE", "MRN", "SSN"]);

function keyOf(type: PhiType, value: string): string {
  const norm = DIGIT_KEYED.has(type) ? value.replace(/\D/g, "") : value.toLowerCase().replace(/\s+/g, " ").trim();
  return `${type}:${norm}`;
}

/**
 * Request-scoped token ↔ value map. Lives only for one pipeline run.
 * It refuses to serialize or print itself so PHI can't leak through
 * JSON.stringify, logs or the trace.
 */
export class TokenVault {
  readonly #byToken = new Map<string, { type: PhiType; value: string }>();
  readonly #byKey = new Map<string, string>();
  readonly #counters = new Map<PhiType, number>();

  /** Same value → same token within a request. */
  tokenFor(type: PhiType, value: string): string {
    const key = keyOf(type, value);
    const existing = this.#byKey.get(key);
    if (existing) return existing;
    const n = (this.#counters.get(type) ?? 0) + 1;
    this.#counters.set(type, n);
    const token = `[${type}_${n}]`;
    this.#byKey.set(key, token);
    this.#byToken.set(token, { type, value });
    return token;
  }

  resolve(token: string): string | undefined {
    return this.#byToken.get(token)?.value;
  }

  get size(): number {
    return this.#byToken.size;
  }

  tokens(): { token: string; type: PhiType }[] {
    return [...this.#byToken].map(([token, { type }]) => ({ token, type }));
  }

  /** Raw values. Only for leak checks inside the pipeline and tests. */
  values(): string[] {
    return [...this.#byToken.values()].map((e) => e.value);
  }

  toJSON(): never {
    throw new Error("TokenVault must never be serialized");
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `TokenVault(${this.size} tokens, values redacted)`;
  }
}
