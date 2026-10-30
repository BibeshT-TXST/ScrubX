import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { loadConfig } from "@/core";

export interface Hit {
  count: number;
  resetInMs: number;
}

/** Counts one hit on a key and reports the total so far. The first hit starts the window. */
export type Counter = (key: string, windowMs: number) => Promise<Hit>;

interface Store {
  url: string;
  token: string;
}

export const REQUESTS_PER_MINUTE = 10;
const MINUTE_MS = 60_000;
const MAX_TRACKED_KEYS = 10_000;
const STORE_TIMEOUT_MS = 1000;

// One atomic step, so concurrent requests can't lose a count or leave a key with no expiry.
const INCREMENT = `local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return {count, redis.call("PTTL", KEYS[1])}`;

const StoreReply = z.object({ result: z.tuple([z.number(), z.number()]) });

// Plain fetch, no SDK, like the Gemini provider and the Supabase repository. An IP address is
// an identifier, so only a keyed hash of it leaves this server.
async function hitStore({ url, token }: Store, key: string, windowMs: number): Promise<Hit> {
  const hashed = createHmac("sha256", token).update(key).digest("base64url");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(["EVAL", INCREMENT, "1", `scrubx:rl:${hashed}`, String(windowMs)]),
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Rate limit store failed (${res.status})`);
  const { result } = StoreReply.parse(await res.json());
  return { count: result[0], resetInMs: result[1] };
}

// Makes room by dropping finished windows, then the one closest to finishing. The long daily
// window is the last to go, so a flood of new addresses can't reset the daily cap.
function evict(windows: Map<string, { count: number; resetAt: number }>, now: number) {
  let soonest: string | undefined;
  let soonestAt = Infinity;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
    else if (window.resetAt < soonestAt) [soonest, soonestAt] = [key, window.resetAt];
  }
  if (soonest && windows.size >= MAX_TRACKED_KEYS) windows.delete(soonest);
}

/**
 * Counts in the store when one is configured, otherwise in this server instance's memory.
 * If the store fails, the request is still limited: it falls back to memory rather than
 * letting traffic through unmetered or failing the chat.
 */
export function createCounter(store?: Store): Counter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const hitMemory = (key: string, windowMs: number): Hit => {
    const now = Date.now();
    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      if (!window && windows.size >= MAX_TRACKED_KEYS) evict(windows, now);
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }
    window.count++;
    return { count: window.count, resetInMs: window.resetAt - now };
  };

  return async (key, windowMs) => {
    if (!store) return hitMemory(key, windowMs);
    try {
      return await hitStore(store, key, windowMs);
    } catch (err) {
      console.error(JSON.stringify({ type: "scrubx.error", message: err instanceof Error ? err.message : String(err) }));
      return hitMemory(key, windowMs);
    }
  };
}

let shared: Counter | undefined;

/** The server's one counter, built from the environment on first use. */
export const hit: Counter = (key, windowMs) => (shared ??= createCounter(loadConfig().rateLimitStore))(key, windowMs);

// Vercel's edge overwrites x-forwarded-for, so there it names the client. Anywhere else a client
// can set it (Next only fills it in when it's missing), so everyone shares one allowance rather
// than a made-up header buying a fresh one.
function clientKey(req: Request): string {
  const ip = process.env.VERCEL === "1" ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  return `ip:${ip || "shared"}`;
}

/** Counts this request against its client. Returns how long to wait when over the limit, otherwise null. */
export async function retryAfterSeconds(req: Request, counter: Counter = hit): Promise<number | null> {
  const { count, resetInMs } = await counter(clientKey(req), MINUTE_MS);
  return count > REQUESTS_PER_MINUTE ? Math.max(1, Math.ceil(resetInMs / 1000)) : null;
}
