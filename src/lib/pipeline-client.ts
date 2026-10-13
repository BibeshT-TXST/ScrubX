import type { StageSpan } from "@/core/pipeline/events";
import type { ChatTurn, PipelineResult } from "@/core/types";
import { chatActions } from "./chat-store";
import { readNdjson, type StreamEvent } from "./ndjson";

// No role: the app has a single role, and in production the host sets it from auth.
export interface ChatRequest {
  patientId: string;
  message: string;
  history: ChatTurn[];
}

export interface RunHooks {
  onSpan?: (span: StageSpan) => void;
  onResult?: (result: PipelineResult) => void;
  onError?: (message: string) => void;
}

/** Calls the pipeline endpoint and yields each streamed event as it arrives. */
export async function* streamPipeline(
  body: ChatRequest,
  requestId: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/pipeline", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed (${res.status})`);
  }
  yield* readNdjson<StreamEvent>(res.body);
}

export const newRequestId = () => `req_${crypto.randomUUID().slice(0, 8)}`;

/**
 * Runs one request and records it as a live trace, so Chat and the Security Division
 * see the same spans as they stream. The ID is minted here (and sent as
 * x-request-id) so callers can link to the trace before it finishes.
 */
export function runRequest(body: ChatRequest, hooks: RunHooks = {}, signal?: AbortSignal) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  chatActions.startTrace({ requestId, patientId: body.patientId, message: body.message, startedAt });

  const fail = (message: string) => {
    chatActions.failTrace(requestId, message);
    hooks.onError?.(message);
  };

  const done = (async () => {
    try {
      for await (const event of streamPipeline(body, requestId, signal)) {
        if (event.type === "span") {
          chatActions.addSpan(requestId, event.span);
          hooks.onSpan?.(event.span);
        } else if (event.type === "result") {
          chatActions.finishTrace(requestId, event.result);
          hooks.onResult?.(event.result);
        } else {
          fail(event.message);
        }
      }
    } catch (err) {
      if (!signal?.aborted) fail(err instanceof Error ? err.message : "Request failed");
    }
  })();

  return { requestId, startedAt, done };
}
