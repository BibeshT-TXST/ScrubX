import { diffWordsWithSpace } from "diff";
import { findingsToLabels, resolveLabels } from "@/core/phi/labels";
import type { StageName, StageSpan, Step } from "@/core/pipeline/events";
import { MODEL_UNAVAILABLE } from "@/core/providers/LLMProvider";
import { QUARANTINED } from "@/core/providers/prompt";
import { REDACTED, TOKEN_PATTERN } from "@/core/tokens/tokenize";
import type { Decision, PhiLabel, Span } from "@/core/types";

// Pure helpers that turn a trace into what the Security Division draws. No React here.

export type SegmentKind =
  | "plain"
  | "markup"
  | "invisible"
  | "phi"
  | "injection"
  | "token"
  | "restored"
  | "redacted"
  | "quarantined";

export interface Segment {
  text: string;
  kind: SegmentKind;
  title?: string;
}

interface Mark extends Span {
  kind: SegmentKind;
  title?: string;
}

export const spanOf = (spans: readonly StageSpan[], stage: StageName) => spans.find((s) => s.stage === stage);

/** Splits text into plain and marked segments. Marks must not overlap; on overlap the earliest wins. */
export function toSegments(text: string, marks: readonly Mark[]): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const m of [...marks].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (m.start < cursor) continue;
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start), kind: "plain" });
    out.push({ text: text.slice(m.start, m.end), kind: m.kind, ...(m.title && { title: m.title }) });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), kind: "plain" });
  return out;
}

function marksFor(text: string, re: RegExp, kind: SegmentKind, title?: (match: string) => string): Mark[] {
  return [...text.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, kind, title: title?.(m[0]) }));
}

// What the normalizer is about to strip: tags, comment delimiters, entities, invisible characters.
const MARKUP = /<!--|-->|<\/?[a-z][^>]*>|&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi;
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g;
const codepoint = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

export function rawMarks(text: string): Mark[] {
  return [...marksFor(text, MARKUP, "markup"), ...marksFor(text, INVISIBLE, "invisible", (ch) => `invisible ${codepoint(ch)}`)];
}

/** Merged PHI labels on the normalized text (the tokenizer's input, or rebuilt when it was skipped). */
export function detectedLabels(spans: readonly StageSpan[]): PhiLabel[] {
  const fromTokenizer = (spanOf(spans, "Tokenizer")?.input?.data as { labels?: PhiLabel[] } | undefined)?.labels;
  if (fromTokenizer) return fromTokenizer;
  const classified = (spanOf(spans, "PhiClassifier")?.output?.data as PhiLabel[] | undefined) ?? [];
  return resolveLabels([...classified, ...findingsToLabels(spanOf(spans, "RegexRules")?.findings ?? [])]);
}

export function detectMarks(spans: readonly StageSpan[]): Mark[] {
  const injections = (spanOf(spans, "RegexRules")?.findings ?? [])
    .filter((f) => f.category === "injection")
    .map((f) => ({ start: f.start, end: f.end, kind: "injection" as const, title: `${f.ruleId} (${f.severity})` }));
  const phi = detectedLabels(spans).map((l) => ({ start: l.start, end: l.end, kind: "phi" as const, title: `${l.type} · ${l.source}` }));
  return [...injections, ...phi];
}

export function tokenMarks(text: string): Mark[] {
  return [
    ...marksFor(text, TOKEN_PATTERN, "token"),
    ...marksFor(text, new RegExp(escape(REDACTED), "g"), "redacted"),
    ...marksFor(text, new RegExp(escape(QUARANTINED), "g"), "quarantined"),
  ];
}

type MapData = { map?: { token: string; value: string }[] } | undefined;

/** Token → value. Prefers the Rehydrator's (complete) vault snapshot; the Tokenizer's lacks record tokens. */
export function tokenMap(spans: readonly StageSpan[]): Map<string, string> {
  const map =
    (spanOf(spans, "Rehydrator")?.input?.data as MapData)?.map ??
    (spanOf(spans, "Tokenizer")?.output?.data as MapData)?.map;
  return new Map(map?.map((t) => [t.token, t.value]));
}

/** The checked answer with each known token swapped for its value, i.e. exactly what the clinician sees. */
export function restoreSegments(text: string, map: Map<string, string>): Segment[] {
  return toSegments(text, tokenMarks(text)).map((s) => {
    const value = s.kind === "token" ? map.get(s.text) : undefined;
    return value === undefined ? s : { text: value, kind: "restored", title: s.text };
  });
}

// ---- masking -------------------------------------------------------------

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every PHI value this trace knows about: the token map plus each labeled span of the normalized text. */
export function phiValues(spans: readonly StageSpan[]): string[] {
  const normalized = spanOf(spans, "InputNormalizer")?.output?.text ?? "";
  const labeled = normalized ? detectedLabels(spans).map((l) => normalized.slice(l.start, l.end)) : [];
  const values = new Set([...tokenMap(spans).values(), ...labeled].map((v) => v.trim()).filter((v) => v.length >= 2));
  return [...values].sort((a, b) => b.length - a.length);
}

export function valuePattern(values: readonly string[]): RegExp | null {
  // Whole-word-ish boundaries so "58" doesn't match inside "0.58", "58.12" or "req_58ab".
  return values.length ? new RegExp(`(?<![\\w.])(?:${values.map(escape).join("|")})(?!\\w|\\.\\d)`, "gi") : null;
}

export const dots = (s: string) => "•".repeat(Math.min(Math.max(s.length, 3), 12));

export function maskText(text: string, pattern: RegExp | null): string {
  return pattern ? text.replace(pattern, dots) : text;
}

// ---- per-step card bodies -------------------------------------------------

export interface StepBody {
  label?: string;
  segments: Segment[];
  /** Shown instead of segments when there is nothing to draw. */
  empty?: string;
  muted?: boolean;
}

const PAYLOADS_OFF = "Payload snapshots are off (SCRUBX_TRACE_PAYLOADS=false). Only metadata was recorded.";
const WAITING = "Waiting for this stage…";

function body(span: StageSpan | undefined, text: string | undefined, marks: (t: string) => Mark[], label?: string): StepBody {
  if (!span) return { label, segments: [], empty: WAITING };
  if (text === undefined) return { label, segments: [], empty: PAYLOADS_OFF };
  return { label, segments: toSegments(text, marks(text)) };
}

const none = () => [];

export function stepBody(step: Step, spans: readonly StageSpan[]): StepBody {
  const get = (stage: StageName) => spanOf(spans, stage);
  const normalizer = get("InputNormalizer");
  const block = get("Block");
  const refusal = (label?: string, muted = true): StepBody => ({
    label,
    muted,
    segments: [{ text: block?.output?.text ?? "Request blocked.", kind: "plain" }],
  });

  switch (step) {
    case "receive": {
      const receive = get("Receive");
      return body(receive, receive?.input?.text, rawMarks);
    }
    case "normalize":
      return body(normalizer, normalizer?.output?.text, none);
    case "detect":
    case "decide":
      return body(normalizer, normalizer?.output?.text, () => detectMarks(spans));
    case "tokenize": {
      const tokenizer = get("Tokenizer");
      return tokenizer?.status === "skipped" ? refusal() : body(tokenizer, tokenizer?.output?.text, tokenMarks);
    }
    case "model": {
      const llm = get("LlmStage");
      if (llm?.status === "error") {
        return { label: "model answer", muted: true, segments: [{ text: `No answer: ${llm.error ?? "the model could not be reached"}`, kind: "plain" }] };
      }
      return llm?.status === "skipped" ? refusal("model answer") : body(llm, llm?.output?.text, tokenMarks, "model answer");
    }
    case "restore": {
      if (block) return refusal("answer to clinician", false);
      const label = "answer to clinician";
      if (get("LlmStage")?.status === "error") return { label, segments: [{ text: MODEL_UNAVAILABLE, kind: "plain" }] };
      const output = get("OutputAnalysis");
      const text = output?.output?.text;
      if (!get("Rehydrator")) return { label, segments: [], empty: WAITING };
      if (text === undefined) return { label, segments: [], empty: PAYLOADS_OFF };
      return { label, segments: restoreSegments(text, tokenMap(spans)) };
    }
  }
}

/** How the patient record was scrubbed on its way to the model: as stored, and as sent. */
export interface RecordView {
  /** The role-filtered record before scrubbing, with the markup and hidden characters marked. */
  stored: StepBody;
  /** What the model received: tokens and quarantined sentences marked. */
  sent: StepBody;
  /** Record fields the role policy kept back (names only). */
  withheld: string[];
  quarantined: number;
}

/** Undefined until Retrieval runs, and when it was skipped: a blocked request sends no record. */
export function recordView(spans: readonly StageSpan[]): RecordView | undefined {
  const r = spanOf(spans, "Retrieval");
  if (!r || r.status === "skipped") return undefined;
  return {
    stored: body(r, r.input?.text, rawMarks, "As stored, role-filtered"),
    sent: body(r, r.output?.text, tokenMarks, "Sent to the AI"),
    withheld: String(r.attributes.withheld ?? "").split(",").filter(Boolean),
    quarantined: Number(r.attributes.quarantined ?? 0),
  };
}

export interface DiffPart {
  value: string;
  kind: "same" | "removed" | "added";
}

/**
 * Word diff that reads as replacements. A raw word diff matches stray ":" or spaces
 * between a quarantined sentence and its marker and interleaves them word by word;
 * here one-character glue inside a change joins the change, and each change shows
 * everything removed, then everything added.
 */
export function readableDiff(before: string, after: string): DiffPart[] {
  const parts = diffWordsWithSpace(before, after);
  const out: DiffPart[] = [];
  let removed = "";
  let added = "";
  const flush = () => {
    if (removed) out.push({ value: removed, kind: "removed" });
    if (added) out.push({ value: added, kind: "added" });
    removed = added = "";
  };
  parts.forEach((p, i) => {
    if (p.removed) removed += p.value;
    else if (p.added) added += p.value;
    else if ((removed || added) && p.value.trim().length <= 1 && (parts[i + 1]?.added || parts[i + 1]?.removed)) {
      removed += p.value;
      added += p.value;
    } else {
      flush();
      out.push({ value: p.value, kind: "same" });
    }
  });
  flush();
  return out;
}

export function decisionOf(spans: readonly StageSpan[]): Decision | undefined {
  return spanOf(spans, "RiskEngine")?.output?.data as Decision | undefined;
}
