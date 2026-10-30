# 17 · Limit what one client can send and spend

> The API has no login on its own, so anyone could send a 1.2 million character prompt or drain the shared model quota. Now history has a size limit, each address gets 10 requests a minute, and a deployment can cap its model calls per day.

**Status:** accepted (narrows [06](06-stateless-server-client-held-history.md))

## The problem

`message` was capped at 4000 characters, but a history turn had no limit and nothing limited the request rate. 20 turns of 60,000 characters each were accepted, and the model was sent a 1,201,455 character prompt.

## What we decided

- **History limits.** 8000 characters per turn and 40,000 in total. Over either one returns 400.
- **The browser trims first.** Normal use can exceed the limits: 5 questions of 4000 characters and 5 answers of about 8000 is 60,000. `historyFor()` drops the oldest turns, so a long conversation loses old context instead of every later request failing.
- **10 requests a minute per address.** The check runs before the body is read, and every attempt counts. Over the limit returns 429 with `Retry-After`.
- **Upstash over REST, in-memory otherwise.** Plain `fetch` and no SDK, like [08](08-gemini-over-rest.md) and [09](09-supabase-over-postgrest.md). Vercel KV no longer exists: its stores moved to Upstash.
- **If the store fails, count in memory.** Traffic stays limited, and the chat still works.
- **Trust the address header only on Vercel.** Vercel overwrites `x-forwarded-for`. Next keeps whatever a client sends, so anywhere else all clients share one allowance.
- **Only a keyed hash of the address leaves the server.** An IP address is an identifier, and the store is a third party. Its keys expire with their window.
- **Optional daily cap on model calls.** `DAILY_MODEL_CALL_CAP` is the backstop for traffic spread across many addresses. Past it, chats get the normal "couldn't connect" reply.

## How it plays out in ScrubX

A script posts in a loop. Its 11th request in a minute gets a 429 and `Retry-After: 53`, before ScrubX has read the body, so it costs no model quota. A clinician deep in a long conversation sees nothing: the oldest turns simply stop being sent.

## Where it lives

- [src/core/types.ts](../../src/core/types.ts): `MAX_TURN_CHARS`, `MAX_HISTORY_CHARS`
- [src/core/schemas.ts](../../src/core/schemas.ts) and [src/app/api/pipeline/route.ts](../../src/app/api/pipeline/route.ts): the 400s and the 429
- [src/lib/chat-store.ts](../../src/lib/chat-store.ts): `historyFor()` trims to the limits
- [src/server/rate-limit.ts](../../src/server/rate-limit.ts): the counter and the address rule
- [src/server/DailyCapProvider.ts](../../src/server/DailyCapProvider.ts): the daily cap

## Trade-offs

- Windows are fixed, not sliding, so a client can get up to 20 requests through across a window boundary. The script is short and the cost is bounded.
- Without a store, each Vercel instance counts on its own, so the real limit is higher than 10. Production should set the store.
- Self-hosted without Vercel, all clients share 10 requests a minute. A host with its own gateway should limit there.
- Addresses are counted one by one. If IPv6 clients reach the deployment, one with a whole /64 could rotate through addresses, and only the daily cap would stop it.
- The server now keeps something between requests, but only hashed counters that expire, and never patient data.