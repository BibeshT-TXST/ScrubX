import "server-only";
import {
  DemoPatientRepository,
  GeminiProvider,
  loadConfig,
  MockProvider,
  Pipeline,
  type LLMProvider,
  type PatientRepository,
  type ScrubXConfig,
} from "@/core";

interface ScrubX {
  config: ScrubXConfig;
  patients: PatientRepository;
  pipeline: Pipeline;
}

function createProvider(config: ScrubXConfig): LLMProvider {
  switch (config.llm.provider) {
    case "mock":
      return new MockProvider({ latencyMs: config.llm.mockLatencyMs });
    case "gemini":
      // loadConfig already guarantees the key is present for this provider.
      return new GeminiProvider({ apiKey: config.llm.apiKey!, model: config.llm.model, fallbackModel: config.llm.fallbackModel });
  }
}

function createRepository(config: ScrubXConfig): PatientRepository {
  switch (config.patientSource) {
    case "demo":
      return new DemoPatientRepository();
    case "supabase":
      throw new Error("PATIENT_SOURCE=supabase is not available yet (Phase 5)");
  }
}

let instance: ScrubX | undefined;

/**
 * The host-side wiring: env → config → repository + provider + pipeline.
 * Built once per server instance. All three are immutable and hold no
 * per-request state, so reusing them keeps the module stateless.
 */
export function scrubx(): ScrubX {
  if (!instance) {
    const config = loadConfig();
    instance = { config, patients: createRepository(config), pipeline: new Pipeline({ config, llm: createProvider(config) }) };
  }
  return instance;
}
