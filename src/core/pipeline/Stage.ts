import type { ScrubXConfig } from "../config";
import type { Finding } from "../types";
import type { SpanAttributes, StageName, StageSnapshot, StageSpan, Step } from "./events";
import type { TraceRecorder } from "./TraceRecorder";

export interface StageContext {
  requestId: string;
  role: string;
  config: ScrubXConfig;
  trace: TraceRecorder;
  /** Request start time. Fixed per request so age math and timestamps agree (and tests are deterministic). */
  now: Date;
  /** Set by the orchestrator when stages fan out (detectors share the normalizer as parent). */
  parentSpanId?: string;
}

/** What a stage contributes to its span beyond timing and snapshots. */
export interface SpanDetails {
  caption?: string;
  status?: "ok" | "blocked";
  attributes?: SpanAttributes;
  findings?: Finding[];
}

export interface StageResult<O> {
  output: O;
  span: StageSpan;
}

/**
 * Base for every pipeline stage. Subclasses implement `process()` and optionally
 * the snapshot/describe hooks; timing, span creation and error capture live here.
 */
export abstract class Stage<I, O> {
  abstract readonly name: StageName;
  abstract readonly step: Step;

  protected abstract process(input: I, ctx: StageContext): Promise<O>;

  protected snapshotInput(_input: I): StageSnapshot | undefined {
    return undefined;
  }

  protected snapshotOutput(_output: O): StageSnapshot | undefined {
    return undefined;
  }

  protected describe(_input: I, _output: O, _ctx: StageContext): SpanDetails {
    return {};
  }

  async run(input: I, ctx: StageContext): Promise<StageResult<O>> {
    const { trace } = ctx;
    const spanId = trace.nextSpanId();
    const startMs = trace.elapsed();
    const base = { spanId, parentSpanId: ctx.parentSpanId, stage: this.name, step: this.step, startMs };

    let output: O;
    try {
      output = await this.process(input, ctx);
    } catch (err) {
      trace.record({
        ...base,
        status: "error",
        durationMs: trace.elapsed() - startMs,
        input: this.snapshotInput(input),
        attributes: {},
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const durationMs = trace.elapsed() - startMs;
    const { status = "ok", attributes = {}, ...details } = this.describe(input, output, ctx);
    const span = trace.record({
      ...base,
      ...details,
      status,
      durationMs,
      attributes,
      input: this.snapshotInput(input),
      output: this.snapshotOutput(output),
    });
    return { output, span };
  }
}
