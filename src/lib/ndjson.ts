import type { StageEvent } from "@/core/pipeline/events";

/** One line on the wire: a pipeline event, or a transport-level failure. */
export type StreamEvent = StageEvent | { type: "error"; message: string };

export const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

/** Pull-based, so a slow client applies backpressure and a disconnect stops the iterator. */
export function toNdjson(events: AsyncIterable<unknown>): ReadableStream<Uint8Array> {
  const it = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await it.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    },
    async cancel() {
      await it.return?.();
    },
  });
}

export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // stream: true keeps multi-byte characters split across chunks intact.
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as T;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as T;
  } finally {
    reader.releaseLock();
  }
}
