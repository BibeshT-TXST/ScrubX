import { describe, expect, it } from "vitest";
import { loadConfig } from "@/core/config";
import { DEFAULT_ENTITY_POLICY } from "@/core/tokens/tokenize";

const SUPABASE = { PATIENT_SOURCE: "supabase", SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" };

describe("loadConfig", () => {
  it("defaults to the demo data with no model key; payloads are on only because the data is synthetic", () => {
    expect(loadConfig({})).toEqual({
      llm: { apiKey: undefined, model: undefined, fallbackModel: undefined },
      patientSource: "demo",
      tracePayloads: true,
      risk: { blockThreshold: 0.8, flagThreshold: 0.4 },
      entityPolicy: DEFAULT_ENTITY_POLICY,
    });
  });

  it("treats empty strings as unset", () => {
    const cfg = loadConfig({ GEMINI_API_KEY: "", RISK_BLOCK_THRESHOLD: "", SCRUBX_TRACE_PAYLOADS: "" });
    expect(cfg.llm.apiKey).toBeUndefined();
    expect(cfg.risk.blockThreshold).toBe(0.8);
    expect(cfg.tracePayloads).toBe(true);
  });

  it("requires Supabase credentials for the supabase source and keeps them server-side config", () => {
    expect(() => loadConfig({ PATIENT_SOURCE: "supabase" })).toThrow(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => loadConfig({ ...SUPABASE, SUPABASE_URL: "not a url" })).toThrow();
    expect(loadConfig(SUPABASE).supabase).toEqual({ url: "https://abc.supabase.co", serviceRoleKey: "k" });
    expect(loadConfig({}).supabase).toBeUndefined();
  });

  it("reads the rate limit store under either name, and rejects half of one", () => {
    const store = { url: "https://r.upstash.io", token: "t" };
    expect(loadConfig({}).rateLimitStore).toBeUndefined();
    expect(loadConfig({ UPSTASH_REDIS_REST_URL: store.url, UPSTASH_REDIS_REST_TOKEN: "t" }).rateLimitStore).toEqual(store);
    expect(loadConfig({ KV_REST_API_URL: store.url, KV_REST_API_TOKEN: "t" }).rateLimitStore).toEqual(store);
    expect(() => loadConfig({ UPSTASH_REDIS_REST_URL: store.url })).toThrow(/both a REST URL and a REST token/);
    expect(() => loadConfig({ KV_REST_API_TOKEN: "t" })).toThrow(/both a REST URL and a REST token/);
  });

  it("keeps trace payloads off by default for any non-demo patient source", () => {
    expect(loadConfig(SUPABASE).tracePayloads).toBe(false);
    expect(loadConfig({ ...SUPABASE, SCRUBX_TRACE_PAYLOADS: "true" }).tracePayloads).toBe(true);
    expect(loadConfig({ SCRUBX_TRACE_PAYLOADS: "false" }).tracePayloads).toBe(false);
  });

  it("parses flags and thresholds", () => {
    const cfg = loadConfig({
      SCRUBX_TRACE_PAYLOADS: "false",
      RISK_BLOCK_THRESHOLD: "0.9",
      RISK_FLAG_THRESHOLD: "0.5",
    });
    expect(cfg.tracePayloads).toBe(false);
    expect(cfg.risk).toEqual({ blockThreshold: 0.9, flagThreshold: 0.5 });
  });

  it("rejects a flag threshold at or above the block threshold", () => {
    expect(() => loadConfig({ RISK_BLOCK_THRESHOLD: "0.5", RISK_FLAG_THRESHOLD: "0.5" })).toThrow(
      /RISK_FLAG_THRESHOLD/,
    );
  });

  it("rejects out-of-range or non-numeric thresholds", () => {
    expect(() => loadConfig({ RISK_BLOCK_THRESHOLD: "1.5" })).toThrow();
    expect(() => loadConfig({ RISK_BLOCK_THRESHOLD: "high" })).toThrow();
  });

  it("reads the Gemini settings; a missing key is allowed (chats report they couldn't connect)", () => {
    expect(() => loadConfig({})).not.toThrow();
    expect(loadConfig({ GEMINI_API_KEY: "k", LLM_MODEL: "m" }).llm).toMatchObject({ apiKey: "k", model: "m" });
    expect(loadConfig({ LLM_FALLBACK_MODEL: "none" }).llm.fallbackModel).toBeNull();
    expect(loadConfig({ LLM_FALLBACK_MODEL: "gemini-x" }).llm.fallbackModel).toBe("gemini-x");
  });
});
