import { z } from "zod";

// The gold vocabulary is the regulation's, not the detector's: IP and BIOMETRIC have no
// ScrubX label on purpose, so a missing rule shows up as a miss instead of a smaller denominator.
export const GOLD_TYPES = [
  "NAME", "DATE", "AGE", "PHONE", "FAX", "EMAIL", "URL", "IP", "SSN", "MRN", "ID", "BIOMETRIC", "ADDRESS", "ORG",
] as const;
export type GoldType = (typeof GOLD_TYPES)[number];

const RecordSchema = z.strictObject({
  name: z.string().min(1),
  dob: z.iso.date(),
  mrn: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const GoldSchema = z
  .strictObject({
    value: z.string().min(1),
    type: z.enum(GOLD_TYPES),
    // safe_harbor counts toward the headline; extended is identifying but outside the 18 categories.
    scope: z.enum(["safe_harbor", "extended"]),
    subject: z.enum(["patient", "other"]).optional(),
    // A month with no day ("March 2026", "in March"): covered by Safe Harbor, left visible by decision 13.
    monthYear: z.literal(true).optional(),
    // 1-based. Omitted means every occurrence of the value is gold.
    occurrence: z.number().int().positive().optional(),
    origin: z.string().optional(),
  })
  .refine((g) => g.type !== "NAME" || g.subject, { message: "a NAME needs a subject" })
  .refine((g) => !g.monthYear || g.type === "DATE", { message: "monthYear only applies to a DATE" });

export const PhiRowSchema = z.strictObject({
  id: z.string().min(1),
  stratum: z.string().min(1),
  shape: z.enum(["plain", "lowercase", "allcaps", "messy"]),
  text: z.string().min(1).max(8000),
  patient: RecordSchema.nullable(),
  gold: z.array(GoldSchema),
});

export const InjectionRowSchema = z
  .strictObject({
    id: z.string().min(1),
    channel: z.enum(["message", "record"]),
    label: z.enum(["attack", "benign"]),
    category: z.string().min(1),
    language: z.string().min(1),
    text: z.string().min(1).max(8000),
    // The sentence carrying the instruction, for an attack hidden in record text.
    payload: z.string().min(1).optional(),
  })
  .refine((r) => !(r.channel === "record" && r.label === "attack") || (r.payload && r.text.includes(r.payload)), {
    message: "a record attack needs a payload copied exactly from its text",
  });

export type Gold = z.infer<typeof GoldSchema>;
export type PhiRow = z.infer<typeof PhiRowSchema>;
export type InjectionRow = z.infer<typeof InjectionRowSchema>;

/** Parses JSONL, naming the line of the first problem so a data error is easy to fix. */
export function parseJsonl<T>(source: string, schema: z.ZodType<T>, file: string): T[] {
  const rows = source.split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    try {
      return [schema.parse(JSON.parse(line))];
    } catch (e) {
      throw new Error(`${file}:${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  const ids = new Set<string>();
  for (const { id } of rows as { id: string }[]) {
    if (ids.has(id)) throw new Error(`${file}: duplicate id ${id}`);
    ids.add(id);
  }
  return rows;
}
