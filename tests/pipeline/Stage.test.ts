import { describe, expect, it } from "vitest";
import { loadConfig } from "@/core/config";
import type { StageSnapshot, StageSpan } from "@/core/pipeline/events";
import { Stage, type SpanDetails, type StageContext } from "@/core/pipeline/Stage";
import { TraceRecorder } from "@/core/pipeline/TraceRecorder";

class Upper extends Stage<string, string> {
  readonly name = "InputNormalizer" as const;
  readonly step = "normalize" as const;

  protected async process(input: string) {
    return input.toUpperCase();
  }
  protected override snapshotInput(input: string): StageSnapshot {
    return { text: input };
  }
  protected override snapshotOutput(output: string): StageSnapshot {
    return { text: output };
  }
  protected override describe(input: string, output: string): SpanDetails {
    return { caption: "uppercased", attributes: { changed: input !== output } };
  }
}

class Boom extends Stage<string, string> {
  readonly name = "RiskEngine" as const;
  readonly step = "decide" as const;

  protected async process(): Promise<string> {
    throw new Error("detector failed");
  }
}

function setup(payloads = true) {
  let t = 0;
  const emitted: StageSpan[] = [];
  const trace = new TraceRecorder({
    traceId: "req_1",
    payloads,
    clock: () => (t += 5),
    now: () => new Date("2026-01-01T00:00:00Z"),
    onSpan: (s) => emitted.push(s),
  });
  const ctx: StageContext = { requestId: "req_1", role: "physician", config: loadConfig({}), trace, now: new Date("2026-01-01T00:00:00Z") };
  return { ctx, trace, emitted };
}

describe("Stage.run", () => {
  it("returns the output and records a timed span with snapshots and details", async () => {
    const { ctx, trace, emitted } = setup();
    const { output, span } = await new Upper().run("hi", ctx);

    expect(output).toBe("HI");
    expect(span).toMatchObject({
      spanId: "req_1.1",
      stage: "InputNormalizer",
      step: "normalize",
      status: "ok",
      caption: "uppercased",
      startMs: 5,
      durationMs: 5,
      input: { text: "hi" },
      output: { text: "HI" },
      attributes: { changed: true },
    });
    expect(emitted).toEqual([span]);
    expect(trace.finish()).toMatchObject({
      traceId: "req_1",
      startedAt: "2026-01-01T00:00:00.000Z",
      spans: [span],
    });
  });

  it("inherits the parent span id from the context", async () => {
    const { ctx } = setup();
    const { span } = await new Upper().run("a", { ...ctx, parentSpanId: "req_1.0" });
    expect(span.parentSpanId).toBe("req_1.0");
  });

  it("strips snapshots when trace payloads are disabled", async () => {
    const { ctx } = setup(false);
    const { span } = await new Upper().run("secret", ctx);
    expect(span.input).toBeUndefined();
    expect(span.output).toBeUndefined();
    expect(JSON.stringify(span)).not.toContain("secret");
    expect(span.attributes).toEqual({ changed: true });
  });

  it("records an error span and rethrows", async () => {
    const { ctx, trace } = setup();
    await expect(new Boom().run("x", ctx)).rejects.toThrow("detector failed");
    expect(trace.finish().spans).toMatchObject([
      { stage: "RiskEngine", status: "error", error: "detector failed" },
    ]);
  });
});

describe("TraceRecorder.skip", () => {
  it("records a zero-duration skipped span", () => {
    const { trace } = setup();
    const span = trace.skip("LlmStage", "model", "skipped: request blocked");
    expect(span).toMatchObject({ status: "skipped", durationMs: 0, stage: "LlmStage" });
  });
});
