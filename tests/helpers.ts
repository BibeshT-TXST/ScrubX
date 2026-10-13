import { loadConfig, type ScrubXConfig } from "@/core/config";
import { DemoPatientRepository } from "@/core/data/DemoPatientRepository";
import { Pipeline, type PipelineDeps } from "@/core/pipeline/Pipeline";
import type { StageContext } from "@/core/pipeline/Stage";
import { TraceRecorder } from "@/core/pipeline/TraceRecorder";
import { MockProvider } from "./support/MockProvider";
import type { PatientContext, PipelineRequest } from "@/core/types";
import demoPatients from "../data/patients.demo.json";

export const NOW = new Date("2026-10-12T12:00:00Z");

export const repo = new DemoPatientRepository();
export const DEMO_IDS = demoPatients.map((p) => p.id);

export async function patient(id = "pt-001"): Promise<PatientContext> {
  const p = await repo.get(id);
  if (!p) throw new Error(`no demo patient ${id}`);
  return p;
}

export function config(env: Record<string, string> = {}): ScrubXConfig {
  return loadConfig({ SCRUBX_TRACE_PAYLOADS: "true", ...env });
}

export function ctx(overrides: Partial<StageContext> = {}): StageContext {
  let t = 0;
  return {
    requestId: "req_test",
    role: "medical_practitioner",
    config: config(),
    trace: new TraceRecorder({ traceId: "req_test", payloads: true, clock: () => t++, now: () => NOW }),
    now: NOW,
    ...overrides,
  };
}

export function pipeline(deps: Partial<PipelineDeps> = {}): Pipeline {
  let t = 0;
  return new Pipeline({
    config: config(),
    llm: new MockProvider(),
    auditSink: () => {},
    clock: () => t++,
    now: () => NOW,
    ...deps,
  });
}

export async function request(message: string, overrides: Partial<PipelineRequest> = {}): Promise<PipelineRequest> {
  return { requestId: "req_test", role: "medical_practitioner", message, patient: await patient(), ...overrides };
}
