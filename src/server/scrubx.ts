import "server-only";
import {
  DemoPatientRepository,
  GeminiProvider,
  loadConfig,
  Pipeline,
  SupabasePatientRepository,
  UnavailableProvider,
  type LLMProvider,
  type PatientRepository,
  type ScrubXConfig,
} from "@/core";

interface ScrubX {
  config: ScrubXConfig;
  patients: PatientRepository;
  pipeline: Pipeline;
}

// Always a real model. Without a key the app still runs, and every chat reports
// that it couldn't connect instead of the server failing to start.
function createProvider({ llm }: ScrubXConfig): LLMProvider {
  return llm.apiKey
    ? new GeminiProvider({ apiKey: llm.apiKey, model: llm.model, fallbackModel: llm.fallbackModel })
    : new UnavailableProvider("No model is configured (GEMINI_API_KEY is not set)");
}

function createRepository(config: ScrubXConfig): PatientRepository {
  switch (config.patientSource) {
    case "demo":
      return new DemoPatientRepository();
    case "supabase":
      // loadConfig guarantees url and key for this source.
      return new SupabasePatientRepository(config.supabase!);
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
