import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/pipeline/route";
import { readNdjson, type StreamEvent } from "@/lib/ndjson";
import { patient } from "../helpers";

vi.mock("@/server/scrubx", () => ({
  scrubx: () => ({
    patients: { get: () => patient() },
    pipeline: {
      async *stream() {
        yield { type: "span", span: { stage: "Receive" } };
        throw new Error("provider exploded with internal detail");
      },
    },
  }),
}));

describe("POST /api/pipeline when the pipeline fails mid-stream", () => {
  it("ends the stream with a generic error event and logs the detail server-side", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new Request("http://test/api/pipeline", { method: "POST", body: JSON.stringify({ patientId: "pt-001", message: "hi" }) }),
    );

    const events: StreamEvent[] = [];
    for await (const e of readNdjson<StreamEvent>(res.body!)) events.push(e);

    expect(events.map((e) => e.type)).toEqual(["span", "error"]);
    expect(JSON.stringify(events)).not.toContain("internal detail");
    expect(JSON.parse(logged.mock.calls[0]![0] as string)).toMatchObject({
      type: "scrubx.error",
      message: "provider exploded with internal detail",
    });
  });
});
