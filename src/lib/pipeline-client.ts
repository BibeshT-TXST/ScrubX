import type { ChatTurn } from "@/core/types";
import { readNdjson, type StreamEvent } from "./ndjson";

export interface ChatRequest {
  patientId: string;
  role: string;
  message: string;
  history: ChatTurn[];
}

/** Calls the pipeline endpoint and yields each streamed event as it arrives. */
export async function* streamPipeline(body: ChatRequest, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/pipeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed (${res.status})`);
  }
  yield* readNdjson<StreamEvent>(res.body);
}
