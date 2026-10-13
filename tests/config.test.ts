import { describe, expect, it } from "vitest";
import { loadConfig } from "@/core/config";
import { DEFAULT_ENTITY_POLICY } from "@/core/tokens/tokenize";

describe("loadConfig", () => {
  it("defaults to a keyless mock demo; payloads are on only because the data is synthetic", () => {
    expect(loadConfig({})).toEqual({
      llm: { provider: "mock", model: undefined, fallbackModel: undefined, apiKey: undefined, mockLatencyMs: 500 },
      patientSource: "demo",
      tracePayloads: true,
      risk: { blockThreshold: 0.8, flagThreshold: 0.4 },
      entityPolicy: DEFAULT_ENTITY_POLICY,
    });
  });

  it("treats empty strings as unset", () => {
    const cfg = loadConfig({ LLM_PROVIDER: "", RISK_BLOCK_THRESHOLD: "", SCRUBX_TRACE_PAYLOADS: "" });
    expect(cfg.llm.provider).toBe("mock");
    expect(cfg.risk.blockThreshold).toBe(0.8);
    expect(cfg.tracePayloads).toBe(true);
  });

  it("keeps trace payloads off by default for any non-demo patient source", () => {
    expect(loadConfig({ PATIENT_SOURCE: "supabase" }).tracePayloads).toBe(false);
    expect(loadConfig({ PATIENT_SOURCE: "supabase", SCRUBX_TRACE_PAYLOADS: "true" }).tracePayloads).toBe(true);
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

  it("requires an API key for the real provider", () => {
    expect(() => loadConfig({ LLM_PROVIDER: "gemini" })).toThrow(/GEMINI_API_KEY/);
    expect(loadConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k", LLM_MODEL: "m" }).llm).toMatchObject({
      provider: "gemini",
      apiKey: "k",
      model: "m",
    });
    expect(loadConfig({ LLM_FALLBACK_MODEL: "none" }).llm.fallbackModel).toBeNull();
    expect(loadConfig({ LLM_FALLBACK_MODEL: "gemini-x" }).llm.fallbackModel).toBe("gemini-x");
  });
});
