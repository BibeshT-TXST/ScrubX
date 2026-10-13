import type { ScrubXConfig } from "../config";
import type { PatientRepository } from "../data/PatientRepository";
import type { PipelineRequest, PipelineResult } from "../types";

export interface PipelineDeps {
  config: ScrubXConfig;
  patients: PatientRepository;
}

/**
 * Orchestrator. Wires the stages in order, runs the three detectors in parallel
 * and branches on the Risk Engine's decision. Stages are added in Phase 1.
 */
export class Pipeline {
  constructor(private readonly deps: PipelineDeps) {}

  async run(_req: PipelineRequest): Promise<PipelineResult> {
    throw new Error("Pipeline stages are not implemented yet (Phase 1)");
  }
}
