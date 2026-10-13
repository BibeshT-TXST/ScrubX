# 0008 · Gemini over REST with retries and a fallback model

**Status:** accepted

**Context.** The first real-model run succeeded 3 times out of 7: `503 UNAVAILABLE` (high demand) twice and 25-second timeouts twice. `gemini-3.8-flash` took 8 s to reply "OK", while `gemini-3.5-flash-lite` took about 0.5 s.

**Decision.** `GeminiProvider` calls `models/{model}:generateContent` with plain `fetch` and no SDK, so the core stays dependency-free. The key goes in the `x-goog-api-key` header, never the URL. Transient failures (408, 429, 5xx, per-attempt timeouts) are retried twice with exponential backoff and jitter, within a 50-second budget under the route's 60-second limit; 4xx errors and client disconnects are not retried. The last retry goes to `gemini-3.5-flash-lite` (`LLM_FALLBACK_MODEL`). Thinking is set to `low`. Thought parts are dropped. The prompt asks for plain text and forbids mentioning placeholders. OutputAnalysis repairs mangled tokens, but only into tokens the vault issued.

**Consequences.** After the change, the same run succeeded 7 times out of 7, two of them on the fallback model, which the trace records. Answers can still take tens of seconds when the primary model is under load; `LLM_MODEL=gemini-3.5-flash-lite` trades some quality for speed.
