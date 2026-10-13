export type ChangeKind =
  | "comment"
  | "markup"
  | "entity"
  | "nfkc"
  | "invisible"
  | "homoglyph"
  | "markdown"
  | "whitespace";

export type NormalizerChanges = Partial<Record<ChangeKind, number>>;

export interface NormalizedText {
  text: string;
  changes: NormalizerChanges;
}

const BLOCK_TAG = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|section|article)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;
const COMMENT = /<!--([\s\S]*?)-->/g;

// Zero-width, bidi controls, soft hyphen, and C0/C1 controls other than \t and \n.
// These are the usual carriers for instruction smuggling.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const ENTITY = /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi;

// Cyrillic and Greek letters that render like Latin ones.
const CONFUSABLES: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h",
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I",
  "ο": "o", "α": "a", "ν": "v", "ι": "i", "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K",
  "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X", "Υ": "Y",
};
const NON_LATIN_LOOKALIKE = /[Ͱ-ϿЀ-ӿԀ-ԯ]/;

const MARKDOWN: [RegExp, string][] = [
  [/!?\[([^\]\n]*)\]\(([^)\s]*)\)/g, "$1 ($2)"],
  [/\*\*([^*\n]+)\*\*/g, "$1"],
  [/__([^_\n]+)__/g, "$1"],
  [/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, "$1"],
  [/`([^`\n]+)`/g, "$1"],
  [/^#{1,6}[ \t]+/gm, ""],
  [/^>[ \t]?/gm, ""],
];

type Replacer = (match: string, ...groups: string[]) => string;

function replaceCounting(text: string, re: RegExp, by: string | Replacer): [string, number] {
  const count = text.match(re)?.length ?? 0;
  if (!count) return [text, 0];
  return [typeof by === "string" ? text.replace(re, by) : text.replace(re, by), count];
}

function decodeEntity(match: string, dec?: string, hex?: string, name?: string): string {
  if (dec || hex) {
    const cp = dec ? Number(dec) : parseInt(hex!, 16);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  }
  return NAMED_ENTITIES[name!.toLowerCase()] ?? match;
}

/** Fold lookalike letters only inside mixed-script words, the smuggling signature. */
function foldHomoglyphs(text: string): [string, number] {
  let count = 0;
  const out = text.replace(/[\p{L}\p{M}]+/gu, (word) => {
    if (!/[A-Za-z]/.test(word) || !NON_LATIN_LOOKALIKE.test(word)) return word;
    return Array.from(word, (ch) => {
      const latin = CONFUSABLES[ch];
      if (latin) count++;
      return latin ?? ch;
    }).join("");
  });
  return [out, count];
}

function nfkc(text: string): [string, number] {
  let count = 0;
  const out = Array.from(text, (ch) => {
    const n = ch.normalize("NFKC");
    if (n !== ch) count++;
    return n;
  }).join("");
  return [out, count];
}

/**
 * Cleans text before detection. Letter case is never changed: clinical
 * abbreviations (HbA1c, COPD) depend on it, and detection is case-insensitive.
 * Hidden content (comments, tags) is unwrapped rather than deleted so the
 * detectors still see what was hidden.
 */
export function normalizeText(raw: string): NormalizedText {
  const changes: NormalizerChanges = {};
  const note = (kind: ChangeKind, n: number) => {
    if (n) changes[kind] = (changes[kind] ?? 0) + n;
  };
  let t = raw.replace(/\r\n?/g, "\n");
  let n: number;

  [t, n] = replaceCounting(t, COMMENT, (_m, inner) => `\n${inner}\n`);
  note("comment", n);
  [t, n] = replaceCounting(t, BLOCK_TAG, "\n");
  note("markup", n);
  [t, n] = replaceCounting(t, ANY_TAG, "");
  note("markup", n);
  [t, n] = replaceCounting(t, ENTITY, decodeEntity);
  note("entity", n);
  [t, n] = nfkc(t);
  note("nfkc", n);
  [t, n] = replaceCounting(t, INVISIBLE, "");
  note("invisible", n);
  [t, n] = foldHomoglyphs(t);
  note("homoglyph", n);
  for (const [re, by] of MARKDOWN) {
    [t, n] = replaceCounting(t, re, by);
    note("markdown", n);
  }

  const before = t;
  t = t
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (t !== before) note("whitespace", 1);

  return { text: t, changes };
}
