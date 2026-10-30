import { z } from "zod";
import { ChatTurnSchema, DEFAULT_ROLE, MAX_HISTORY_CHARS } from "@/core";
import { NDJSON_CONTENT_TYPE, toNdjson, type StreamEvent } from "@/lib/ndjson";
import { scrubx } from "@/server/scrubx";

// Covers the Gemini provider's 50 s retry budget (3 attempts with backoff) plus pipeline overhead.
export const maxDuration = 60;

// The client names a patient; the record itself is resolved here, server-side.
const BodySchema = z.object({
  patientId: z.string().min(1).max(64),
  // Set by the host's auth layer. The app has one role, so the browser doesn't send it.
  role: z.string().min(1).max(40).default(DEFAULT_ROLE),
  message: z.string().trim().min(1).max(4000),
  history: z.array(ChatTurnSchema).max(20)
    .refine((turns) => turns.reduce((total, t) => total + t.content.length, 0) <= MAX_HISTORY_CHARS, `History can be at most ${MAX_HISTORY_CHARS} characters in total`)
    .default([]),
});

const REQUEST_ID = /^[\w.-]{1,64}$/;

function error(status: number, message: string, issues?: unknown) {
  return Response.json({ error: message, ...(issues ? { issues } : {}) }, { status });
}

async function* withErrorEvent(events: AsyncIterable<StreamEvent>, requestId: string): AsyncGenerator<StreamEvent> {
  try {
    yield* events;
  } catch (err) {
    // Details stay in server logs; the client gets a generic line.
    console.error(JSON.stringify({ type: "scrubx.error", requestId, message: err instanceof Error ? err.message : String(err) }));
    yield { type: "error", message: "The pipeline failed before an answer was produced." };
  }
}

/** Runs one chat turn through ScrubX and streams a StageEvent per line, ending with the PipelineResult. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return error(400, "Body must be JSON");
  }
  const body = BodySchema.safeParse(json);
  if (!body.success) return error(400, "Invalid request", z.flattenError(body.error).fieldErrors);

  const { patients, pipeline } = scrubx();
  const patient = await patients.get(body.data.patientId);
  if (!patient) return error(404, "Unknown patient");

  // A host gateway may already have tagged the request; otherwise mint an ID.
  const header = req.headers.get("x-request-id");
  const requestId = header && REQUEST_ID.test(header) ? header : `req_${crypto.randomUUID().slice(0, 8)}`;

  const { patientId: _, ...turn } = body.data;
  const events = withErrorEvent(pipeline.stream({ requestId, patient, ...turn }), requestId);
  return new Response(toNdjson(events), {
    headers: { "content-type": NDJSON_CONTENT_TYPE, "cache-control": "no-store", "x-request-id": requestId },
  });
}
