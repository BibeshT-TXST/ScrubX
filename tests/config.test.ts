import { describe, expect, it } from "vitest";
import { loadConfig } from "@/core/config";

describe("loadConfig", () => {
  it("defaults to a keyless mock demo with trace payloads off", () => {
    expect(loadConfig({})).toEqual({
      llm: { provider: "mock", model: undefined, apiKey: undefined },
      patientSource: "demo",
      tracePayloads: false,
      risk: { blockThreshold: 0.8, flagThreshold: 0.4 },
    });
  });

  it("treats empty strings as unset", () => {
    const cfg = loadConfig({ LLM_PROVIDER: "", RISK_BLOCK_THRESHOLD: "", SCRUBX_TRACE_PAYLOADS: "" });
    expect(cfg.llm.provider).toBe("mock");
    expect(cfg.risk.blockThreshold).toBe(0.8);
    expect(cfg.tracePayloads).toBe(false);
  });

  it("parses flags and thresholds", () => {
    const cfg = loadConfig({
      SCRUBX_TRACE_PAYLOADS: "true",
      RISK_BLOCK_THRESHOLD: "0.9",
      RISK_FLAG_THRESHOLD: "0.5",
    });
    expect(cfg.tracePayloads).toBe(true);
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
    expect(() => loadConfig({ LLM_PROVIDER: "openrouter" })).toThrow(/OPENROUTER_API_KEY/);
    expect(loadConfig({ LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k" }).llm.apiKey).toBe("k");
  });
});
