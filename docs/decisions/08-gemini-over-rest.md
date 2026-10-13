# 08 · Gemini over REST with retries and a fallback model

> A busy model shows up as a slower answer, not a failed one. And when the model really is down, the clinician sees "we couldn't connect", never a crash.

**Status:** accepted

## The problem

The first real-model run succeeded 3 times out of 7. Two attempts failed with `503 UNAVAILABLE` (high demand) and two hit 25-second timeouts. `gemini-3.8-flash` took 8 s to reply "OK", while `gemini-3.5-flash-lite` took about 0.5 s.

## What we decided

- `GeminiProvider` calls `models/{model}:generateContent` with plain `fetch` and no SDK, so the core stays dependency-free.
- The key travels in the `x-goog-api-key` header, never in the URL, so it can't end up in access logs.
- Transient failures (408, 429, 5xx, per-attempt timeouts) are retried twice with exponential backoff and jitter. The total budget is 50 seconds, under the route's 60-second limit. Other 4xx errors and client disconnects are not retried.
- The last retry goes to the fallback model (`LLM_FALLBACK_MODEL`, default `gemini-3.5-flash-lite`). The trace records which model actually answered, and Chat labels each answer with it ("AI-generated · gemini-3.5-flash-lite").
- Thinking is set to `low`, and thought parts are dropped. The prompt asks for plain text and forbids mentioning placeholders. OutputAnalysis repairs mangled tokens, but only into tokens the vault actually issued.

## How it plays out in ScrubX

After the change, the same 7-request run succeeded 7 times, two of them on the fallback model. With no `GEMINI_API_KEY` at all, the app still starts: every request passes the checks, the LLM span records the error, and the reply says it couldn't connect ([10](10-single-role-real-model-observation-only.md)).

## Where it lives

- [src/core/providers/GeminiProvider.ts](../../src/core/providers/GeminiProvider.ts): REST call, retries, backoff, fallback
- [src/core/providers/LLMProvider.ts](../../src/core/providers/LLMProvider.ts): the provider interface and the "couldn't connect" message
- [src/core/providers/prompt.ts](../../src/core/providers/prompt.ts): the system prompt and token rules
- [src/core/stages/OutputAnalysis.ts](../../src/core/stages/OutputAnalysis.ts): token repair, leak redaction, ungrounded-claim flags
- [src/app/api/pipeline/route.ts](../../src/app/api/pipeline/route.ts): `maxDuration = 60`

## Trade-offs

Answers can still take tens of seconds when the primary model is under load. Setting `LLM_MODEL=gemini-3.5-flash-lite` trades some answer quality for speed.
