// Regex building blocks for names in any script. Every pattern that uses them needs the `u` flag.

// Word edges that know non-ASCII letters. JS `\b` is ASCII-only, so `\bJosé\b` never matches "José".
export const START = "(?<![\\p{L}\\p{M}\\p{N}_])";
export const END = "(?![\\p{L}\\p{M}\\p{N}_])";

// One capitalized name word: Smith, Núñez, Nguyễn, O'Neil, McDonald, Smith-Jones.
export const NAME_WORD = "\\p{Lu}(?:['’]\\p{Lu})?[\\p{Ll}\\p{M}]+(?:\\p{Lu}[\\p{Ll}\\p{M}]+)?(?:-\\p{Lu}[\\p{Ll}\\p{M}]+)?";

// A town or city: one to three capitalized words ("Kyle", "Round Rock", "Wilkes-Barre").
export const PLACE = "\\p{Lu}[\\p{Ll}\\p{M}]+(?:[ -]\\p{Lu}[\\p{Ll}\\p{M}]+){0,2}";

/**
 * "son" → "[Ss]on". The `i` flag can't be used next to `\p{Lu}`: under `iu`,
 * `\p{Lu}` matches lowercase letters too, and the capital is the signal.
 */
export const anyCase = (word: string) => `[${word[0]!.toUpperCase()}${word[0]!.toLowerCase()}]${word.slice(1)}`;

export function isSentenceStart(text: string, index: number): boolean {
  return /(?:^|[.!?]\s+|\n\s*)$/.test(text.slice(0, index));
}
