import { z } from "zod";
import { DEFAULT_ENTITY_POLICY, type EntityPolicies } from "./tokens/tokenize";

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

const threshold = (fallback: number) => z.coerce.number().min(0).max(1).default(fallback);

const EnvSchema = z
  .object({
    LLM_MODEL: z.string().optional(),
    // Model for the final retry when the main one is overloaded; "none" disables it.
    LLM_FALLBACK_MODEL: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    PATIENT_SOURCE: z.enum(["demo", "supabase"]).default("demo"),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    // Shared rate limit counts. The KV_ names are what stores migrated from Vercel KV may still use.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
    // Snapshots contain PHI. Unset, they are on only for the synthetic demo data (see loadConfig).
    SCRUBX_TRACE_PAYLOADS: flag,
    RISK_BLOCK_THRESHOLD: threshold(0.8),
    RISK_FLAG_THRESHOLD: threshold(0.4),
  })
  .refine((e) => e.RISK_FLAG_THRESHOLD < e.RISK_BLOCK_THRESHOLD, {
    message: "RISK_FLAG_THRESHOLD must be below RISK_BLOCK_THRESHOLD",
  })
  .refine((e) => e.PATIENT_SOURCE !== "supabase" || (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY), {
    message: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when PATIENT_SOURCE=supabase",
  })
  .refine((e) => !(e.UPSTASH_REDIS_REST_URL ?? e.KV_REST_API_URL) === !(e.UPSTASH_REDIS_REST_TOKEN ?? e.KV_REST_API_TOKEN), {
    message: "The rate limit store needs both a REST URL and a REST token",
  })
;

export interface ScrubXConfig {
  /** Gemini. Without an apiKey the app still runs and every chat reports it couldn't connect. */
  llm: {
    apiKey?: string;
    model?: string;
    /** undefined = provider default, null = no fallback. */
    fallbackModel?: string | null;
  };
  patientSource: "demo" | "supabase";
  /** Present when patientSource is "supabase". Server-side only. */
  supabase?: { url: string; serviceRoleKey: string };
  /** Shared rate limit counts. Absent means each server instance counts in memory. Server-side only. */
  rateLimitStore?: { url: string; token: string };
  tracePayloads: boolean;
  risk: { blockThreshold: number; flagThreshold: number };
  /** Per PHI type: tokenize (default), keep, or bucket (AGE only). Set in code, not env. */
  entityPolicy: EntityPolicies;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ScrubXConfig {
  // `KEY=` in an env file arrives as "", which should mean "unset".
  const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
  const e = EnvSchema.parse(set);
  const storeUrl = e.UPSTASH_REDIS_REST_URL ?? e.KV_REST_API_URL;
  const storeToken = e.UPSTASH_REDIS_REST_TOKEN ?? e.KV_REST_API_TOKEN;

  return {
    llm: {
      apiKey: e.GEMINI_API_KEY,
      model: e.LLM_MODEL,
      fallbackModel: e.LLM_FALLBACK_MODEL === "none" ? null : e.LLM_FALLBACK_MODEL,
    },
    patientSource: e.PATIENT_SOURCE,
    ...(e.PATIENT_SOURCE === "supabase" && {
      supabase: { url: e.SUPABASE_URL!, serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY! },
    }),
    ...(storeUrl && storeToken && { rateLimitStore: { url: storeUrl, token: storeToken } }),
    tracePayloads: e.SCRUBX_TRACE_PAYLOADS ?? e.PATIENT_SOURCE === "demo",
    risk: { blockThreshold: e.RISK_BLOCK_THRESHOLD, flagThreshold: e.RISK_FLAG_THRESHOLD },
    entityPolicy: DEFAULT_ENTITY_POLICY,
  };
}
