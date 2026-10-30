import { afterEach, describe, expect, it, vi } from "vitest";
import { createCounter, REQUESTS_PER_MINUTE, retryAfterSeconds } from "@/server/rate-limit";

const STORE = { url: "https://store.test", token: "secret-token" };

const request = (ip?: string) => new Request("http://test", { headers: ip ? { "x-forwarded-for": ip } : {} });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function exhaust(counter: ReturnType<typeof createCounter>, ip?: string) {
  for (let i = 0; i < REQUESTS_PER_MINUTE; i++) expect(await retryAfterSeconds(request(ip), counter)).toBeNull();
}

describe("retryAfterSeconds", () => {
  it("allows the limit, then reports the seconds left in the window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const counter = createCounter();
    await exhaust(counter);
    vi.advanceTimersByTime(15_500);
    expect(await retryAfterSeconds(request(), counter)).toBe(45);
  });

  it("starts a new window once the minute is up", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const counter = createCounter();
    await exhaust(counter);
    vi.advanceTimersByTime(60_000);
    expect(await retryAfterSeconds(request(), counter)).toBeNull();
  });

  it("on Vercel, counts each client address on its own", async () => {
    vi.stubEnv("VERCEL", "1");
    const counter = createCounter();
    await exhaust(counter, "198.51.100.1");
    expect(await retryAfterSeconds(request("198.51.100.1, 10.0.0.1"), counter)).toBeGreaterThan(0);
    expect(await retryAfterSeconds(request("198.51.100.2"), counter)).toBeNull();
  });

  it("off Vercel, ignores the header so a made-up address can't buy a fresh allowance", async () => {
    const counter = createCounter();
    await exhaust(counter, "198.51.100.1");
    expect(await retryAfterSeconds(request("198.51.100.2"), counter)).toBeGreaterThan(0);
  });

  it("on Vercel without the header, falls back to the shared allowance", async () => {
    vi.stubEnv("VERCEL", "1");
    const counter = createCounter();
    await exhaust(counter);
    expect(await retryAfterSeconds(request(), counter)).toBeGreaterThan(0);
  });
});

describe("createCounter in memory", () => {
  it("stays bounded under a flood of new keys and keeps the longest window", async () => {
    const counter = createCounter();
    await counter("daily", 86_400_000);
    for (let i = 0; i < 10_001; i++) await counter(`ip:${i}`, 60_000);
    expect((await counter("daily", 86_400_000)).count).toBe(2);
    expect((await counter("ip:0", 60_000)).count).toBe(1);
  });
});

describe("createCounter with a store", () => {
  it("increments atomically, authenticates, and never sends the raw key", async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: [3, 42_000] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await createCounter(STORE)("ip:198.51.100.1", 60_000)).toEqual({ count: 3, resetInMs: 42_000 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(STORE.url);
    expect(init.headers).toMatchObject({ authorization: "Bearer secret-token" });
    expect(init.body).not.toContain("198.51.100.1");
    const [command, , keys, key, windowMs] = JSON.parse(init.body as string);
    expect([command, keys, windowMs]).toEqual(["EVAL", "1", "60000"]);
    expect(key).toMatch(/^scrubx:rl:[\w-]{43}$/);
  });

  it.each([
    ["is unreachable", () => Promise.reject(new TypeError("fetch failed"))],
    ["rejects the request", async () => Response.json({ error: "WRONGPASS" }, { status: 401 })],
    ["replies with something unexpected", async () => Response.json({ result: "OK" })],
  ])("still counts in memory when the store %s, and logs no address", async (_, reply) => {
    vi.stubGlobal("fetch", reply);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const counter = createCounter(STORE);

    expect((await counter("ip:198.51.100.1", 60_000)).count).toBe(1);
    expect((await counter("ip:198.51.100.1", 60_000)).count).toBe(2);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("198.51.100.1");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret-token");
  });
});
