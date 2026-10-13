import { Stage, type SpanDetails } from "../pipeline/Stage";
import type { ChatTurn, PatientContext, PipelineRequest } from "../types";

export interface Received {
  message: string;
  patient: PatientContext;
  history: ChatTurn[];
}

/**
 * Step 1. The host already authenticated the request; this only records the
 * request ID and role it passed in and snapshots the raw input.
 */
export class Receive extends Stage<PipelineRequest, Received> {
  readonly name = "Receive" as const;
  readonly step = "receive" as const;

  protected async process(req: PipelineRequest): Promise<Received> {
    return { message: req.message, patient: req.patient, history: req.history ?? [] };
  }

  protected override snapshotInput(req: PipelineRequest) {
    return { text: req.message };
  }

  protected override describe(req: PipelineRequest): SpanDetails {
    return {
      caption: "Request received from host, tagged with ID and role.",
      attributes: {
        requestId: req.requestId,
        role: req.role,
        messageChars: req.message.length,
        historyTurns: req.history?.length ?? 0,
      },
    };
  }
}
