import type { StageName, StageSpan, Step, Trace } from "./events";

export type Clock = () => number;

export interface TraceRecorderOptions {
  traceId: string;
  /** When false, input/output snapshots are dropped and only metadata is kept. */
  payloads: boolean;
  clock?: Clock;
  now?: () => Date;
  /** Fires as each span closes; drives the NDJSON stream. */
  onSpan?: (span: StageSpan) => void;
}

/** Collects spans for one request. Created per request and discarded with it. */
export class TraceRecorder {
  readonly traceId: string;
  private readonly payloads: boolean;
  private readonly clock: Clock;
  private readonly onSpan?: (span: StageSpan) => void;
  private readonly origin: number;
  private readonly startedAt: string;
  private readonly spans: StageSpan[] = [];
  private seq = 0;

  constructor(opts: TraceRecorderOptions) {
    this.traceId = opts.traceId;
    this.payloads = opts.payloads;
    this.clock = opts.clock ?? (() => performance.now());
    this.onSpan = opts.onSpan;
    this.origin = this.clock();
    this.startedAt = (opts.now?.() ?? new Date()).toISOString();
  }

  /** Milliseconds since the trace started. */
  elapsed(): number {
    return this.clock() - this.origin;
  }

  nextSpanId(): string {
    return `${this.traceId}.${++this.seq}`;
  }

  record(span: StageSpan): StageSpan {
    const stored = this.payloads ? span : { ...span, input: undefined, output: undefined };
    this.spans.push(stored);
    this.onSpan?.(stored);
    return stored;
  }

  /** Records a stage that never ran (e.g. everything after a block). */
  skip(stage: StageName, step: Step, caption?: string): StageSpan {
    return this.record({
      spanId: this.nextSpanId(),
      stage,
      step,
      caption,
      status: "skipped",
      startMs: this.elapsed(),
      durationMs: 0,
      attributes: {},
    });
  }

  /** Duration per stage so far (for the audit line). */
  timings(): Record<string, number> {
    return Object.fromEntries(this.spans.map((s) => [s.stage, Math.round(s.durationMs * 100) / 100]));
  }

  finish(): Trace {
    return {
      traceId: this.traceId,
      startedAt: this.startedAt,
      durationMs: this.elapsed(),
      spans: [...this.spans],
    };
  }
}
