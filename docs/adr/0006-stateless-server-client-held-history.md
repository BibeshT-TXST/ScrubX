# 0006 · Stateless server, client-held history, in-memory client state

**Status:** accepted

**Context.** The module must run on serverless functions with no persistence of chats or PHI.

**Decision.** The server keeps nothing between requests: the `scrubx()` singleton is immutable wiring, and the vault, trace and context are per request. The browser holds chat threads and traces in module memory (not localStorage or sessionStorage) and sends the last 10 completed, answered turns with each request.

**Consequences.** It deploys anywhere and leaves no PHI at rest. A refresh starts empty, which is intended. Traces can be opened from the Dev View only in the tab that produced them.
