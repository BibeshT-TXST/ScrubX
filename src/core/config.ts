import { z } from "zod";
import { DEFAULT_ENTITY_POLICY, type EntityPolicies } from "./tokens/tokenize";

const flag = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === "true"));

const threshold = (fallback: number) => z.coerce.number().min(0).max(1).default(fallback);

const EnvSchema = z
  .object({
    LLM_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
    LLM_MODEL: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    // Simulated model latency for the mock, so the streamed trace is visible in the UI.
    MOCK_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(500),
    PATIENT_SOURCE: z.enum(["demo", "supabase"]).default("demo"),
    // Off by default: snapshots contain PHI. Only the synthetic demo turns it on.
    SCRUBX_TRACE_PAYLOADS: flag(false),
    RISK_BLOCK_THRESHOLD: threshold(0.8),
    RISK_FLAG_THRESHOLD: threshold(0.4),
  })
  .refine((e) => e.RISK_FLAG_THRESHOLD < e.RISK_BLOCK_THRESHOLD, {
    message: "RISK_FLAG_THRESHOLD must be below RISK_BLOCK_THRESHOLD",
  })
  .refine((e) => e.LLM_PROVIDER !== "openrouter" || e.OPENROUTER_API_KEY, {
    message: "OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter",
  });

export interface ScrubXConfig {
  llm: { provider: "mock" | "openrouter"; model?: string; apiKey?: string; mockLatencyMs: number };
  patientSource: "demo" | "supabase";
  tracePayloads: boolean;
  risk: { blockThreshold: number; flagThreshold: number };
  /** Per PHI type: tokenize (default), keep, or bucket (AGE only). Set in code, not env. */
  entityPolicy: EntityPolicies;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ScrubXConfig {
  // `KEY=` in an env file arrives as "", which should mean "unset".
  const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
  const e = EnvSchema.parse(set);
  return {
    llm: { provider: e.LLM_PROVIDER, model: e.LLM_MODEL, apiKey: e.OPENROUTER_API_KEY, mockLatencyMs: e.MOCK_LATENCY_MS },
    patientSource: e.PATIENT_SOURCE,
    tracePayloads: e.SCRUBX_TRACE_PAYLOADS,
    risk: { blockThreshold: e.RISK_BLOCK_THRESHOLD, flagThreshold: e.RISK_FLAG_THRESHOLD },
    entityPolicy: DEFAULT_ENTITY_POLICY,
  };
}
