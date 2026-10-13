// Pure display formatting for clinical data. Every rule here is a patient-safety
// rule (ISMP, Joint Commission "Do Not Use", NHS CUI), so the UI never formats
// dates, times, numbers or doses inline.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * DD-Mmm-YYYY, never 10/12/26. An ISO date string is formatted from its parts
 * so a date of birth can't shift a day across time zones; a timestamp uses local time.
 */
export function formatDate(value: string | number): string {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) return value;
    return `${m[3]}-${MONTHS[Number(m[2]) - 1] ?? m[2]}-${m[1]}`;
  }
  const d = new Date(value);
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** 24-hour local time: 14:20, or 14:20:05 with seconds. */
export function formatTime(ms: number, seconds = false): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? `:${pad(d.getSeconds())}` : ""}`;
}

export function formatRelative(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Absolute and relative together, with the date only when it isn't today: "14:20 · 3 h ago". */
export function formatStamp(ms: number, now: number, seconds = false): string {
  const sameDay = new Date(ms).toDateString() === new Date(now).toDateString();
  const absolute = `${sameDay ? "" : `${formatDate(ms)} `}${formatTime(ms, seconds)}`;
  return `${absolute} · ${formatRelative(ms, now)}`;
}

/** Whole years from an ISO date of birth; months under 2 years, as paediatric charts show it. */
export function formatAge(dob: string, today: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return "Age unknown";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - mo);
  if (today.getDate() < d) months -= 1;
  if (months < 0) return "Age unknown";
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} y`;
}

/**
 * Sex isn't a structured field yet, but every summary starts with age and sex
 * ("58F, …"). Anything else is reported as not recorded rather than guessed.
 */
export function sexFromSummary(summary: string): "Female" | "Male" | undefined {
  const m = /^\s*\d+\s*([FM])\b/.exec(summary);
  return m?.[1] === "F" ? "Female" : m?.[1] === "M" ? "Male" : undefined;
}

/** Leading zero always, trailing zeros never: 0.5, 5, 12.25. */
export function formatNumber(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return "–";
  const fixed = Number(n.toFixed(maxDecimals));
  return String(Object.is(fixed, -0) ? 0 : fixed);
}

/** Durations with the unit attached and precision that fits the size. */
export function formatMs(ms: number): string {
  if (ms > 0 && ms < 0.01) return "< 0.01 ms";
  return `${formatNumber(ms, ms < 10 ? 2 : ms < 100 ? 1 : 0)} ms`;
}

// "Do Not Use" unit abbreviations, rewritten in full.
const UNIT_WORDS: [RegExp, string][] = [
  [/\bI\.?U\.?(?=\s|$)/g, "units"],
  [/\bU(?=\s|$)/g, "units"],
];

/** "metformin 1000 mg" → drug and dose, with the dose made safe to read. */
export function splitDose(medication: string): { drug: string; dose?: string } {
  const m = /^(.*?)\s+((?:\d*\.)?\d+(?:\s*\/\s*\d+)?\s*[a-zA-Zµ%/.]+(?:\s.*)?)$/.exec(medication.trim());
  if (!m) return { drug: medication.trim() };
  return { drug: m[1]!, dose: formatDose(m[2]!) };
}

export function formatDose(dose: string): string {
  let out = dose
    // .5 mg → 0.5 mg
    .replace(/(^|[^\d])\.(\d)/g, "$10.$2")
    // 5.0 mg → 5 mg, 2.50 mg → 2.5 mg
    .replace(/(\d+)\.(\d*?)0+(?!\d)/g, (_, whole: string, frac: string) => (frac ? `${whole}.${frac}` : whole));
  for (const [re, word] of UNIT_WORDS) out = out.replace(re, word);
  return out;
}

/**
 * Tall Man lettering for look-alike/sound-alike drug names (ISMP and FDA lists).
 * Data, not code: extend the list rather than branching.
 */
export const TALL_MAN = [
  "ALPRAZolam", "amLODIPine", "ARIPiprazole", "busPIRone", "buPROPion", "carBAMazepine", "OXcarbazepine",
  "chlorproMAZINE", "chlorproPAMIDE", "clonazePAM", "cloNIDine", "LORazepam", "cycloSPORINE", "cycloSERINE",
  "DAUNOrubicin", "DOXOrubicin", "DOBUTamine", "DOPamine", "DULoxetine", "FLUoxetine", "PARoxetine",
  "glipiZIDE", "glyBURIDE", "hydrALAZINE", "hydrOXYzine", "HYDROcodone", "oxyCODONE", "HYDROmorphone",
  "levETIRAcetam", "levoFLOXacin", "NIFEdipine", "niCARdipine", "OLANZapine", "QUEtiapine",
  "predniSONE", "prednisoLONE", "risperiDONE", "rOPINIRole", "sAXagliptin", "SITagliptin",
  "SUMAtriptan", "ZOLMitriptan", "traMADol", "traZODone", "vinBLAStine", "vinCRIStine",
];

const TALL_MAN_BY_NAME = new Map(TALL_MAN.map((t) => [t.toLowerCase(), t]));
const TALL_MAN_PATTERN = new RegExp(`\\b(?:${TALL_MAN.join("|")})\\b`, "gi");

export function tallMan(text: string): string {
  return text.replace(TALL_MAN_PATTERN, (word) => TALL_MAN_BY_NAME.get(word.toLowerCase()) ?? word);
}
