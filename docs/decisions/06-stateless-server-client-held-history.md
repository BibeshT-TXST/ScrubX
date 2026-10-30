# 06 · Stateless server, client-held history, in-memory client state

> ScrubX keeps nothing. No chat, trace or token map outlives the request on the server, and none of them is written to disk in the browser.

**Status:** accepted (narrowed by [17](17-limit-what-one-client-can-send-and-spend.md): hashed rate limit counters now outlive a request, and no patient data does)

## The problem

The module runs on serverless functions and handles PHI. Anything it stores is another place patient data can leak from, and another thing to secure, retain and delete.

## What we decided

- The server keeps nothing between requests. The `scrubx()` singleton is immutable wiring (config, repository, provider). The vault, the trace and the context are created per request and dropped afterwards.
- The browser holds chat threads, drafts, the selected patient and traces in **module memory**, never in localStorage or sessionStorage.
- Each request carries the last 10 completed, answered turns as history. Retrieval sanitizes them like everything else ([04](04-sanitize-everything-bound-for-the-model.md)).
- The browser keeps at most 20 traces.

## How it plays out in ScrubX

A clinician asks about Maria Lopez, switches to the Security Division to see the trace, then comes back. The conversation and the half-typed draft are still there, because they live in the chat store's memory. A refresh starts empty, which is intended: nothing with PHI survived on disk. The only thing in localStorage is the display preference (theme and density).

## Where it lives

- [src/server/scrubx.ts](../../src/server/scrubx.ts): the immutable singleton
- [src/lib/chat-store.ts](../../src/lib/chat-store.ts): in-memory threads, drafts, traces, `historyFor()` (`HISTORY_TURNS = 10`, `MAX_TRACES = 20`)
- [src/lib/pipeline-client.ts](../../src/lib/pipeline-client.ts): sends the history with each request and records the live trace
- [src/lib/display.ts](../../src/lib/display.ts): the one localStorage key, with no PHI in it

## Trade-offs

It deploys anywhere and leaves no PHI at rest. A trace can only be opened in the browser tab that produced it. A shared, cross-user security view would need a server-side trace store, with its own retention rules.
