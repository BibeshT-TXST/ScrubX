import { describe, expect, it } from "vitest";
import { readNdjson, toNdjson } from "@/lib/ndjson";

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

function chunked(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(c) {
      if (offset >= bytes.length) return c.close();
      c.enqueue(bytes.slice(offset, (offset += size)));
    },
  });
}

describe("ndjson", () => {
  it("round-trips events, one JSON value per line", async () => {
    async function* events() {
      yield { type: "span", n: 1 };
      yield { type: "result", text: "Maria López ✓" };
    }
    const stream = toNdjson(events());
    expect(await collect(readNdjson(stream))).toEqual([
      { type: "span", n: 1 },
      { type: "result", text: "Maria López ✓" },
    ]);
  });

  it("reassembles lines and multi-byte characters split across chunks", async () => {
    const text = '{"a":"é✓"}\n\n{"b":2}\n{"c":3}';
    expect(await collect(readNdjson(chunked(text, 3)))).toEqual([{ a: "é✓" }, { b: 2 }, { c: 3 }]);
  });

  it("stops the source iterator when the client disconnects", async () => {
    let finished = false;
    async function* events() {
      try {
        while (true) yield { tick: true };
      } finally {
        finished = true;
      }
    }
    const reader = toNdjson(events()).getReader();
    await reader.read();
    await reader.cancel();
    expect(finished).toBe(true);
  });
});
