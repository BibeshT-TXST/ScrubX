# Embedding ScrubX in another app

ScrubX runs on its own, but the pipeline is built to sit inside someone else's backend. Everything it needs is in `src/core`, plain TypeScript with no framework. It isn't published as a package, so your build has to bring in the source and compile it.

```ts
import { loadConfig, Pipeline } from "./scrubx/src/core";

const pipeline = new Pipeline({ config: loadConfig(), llm: yourProvider });
const result = await pipeline.run({ requestId, role, message, patient, history });
// result.outcome, result.response, result.trace, result.audit
```

The route in [src/app/api/pipeline/route.ts](../src/app/api/pipeline/route.ts) is a working example, with streaming.

## Who does what

| Your app | ScrubX |
|---|---|
| Handles login and roles. ScrubX trusts the role it gets, and an unknown role sees only name and date of birth | Scans, decides, tokenizes, checks the answer and restores the real values |
| Loads the patient record and passes it in. ScrubX never fetches patients | Sanitizes the record and history before they reach the model |
| Holds the conversation and sends it back as `history`. ScrubX keeps nothing between requests | Writes one audit line per request, to stdout unless you pass an `auditSink` |
| Picks the model, by implementing [`LLMProvider`](../src/core/providers/LLMProvider.ts) | Records a trace of every stage |

## Example: SightX

ScrubX began as a module for [SightX](https://github.com/BibeshT-TXST/SightX), and this is the integration it was designed for. It hasn't been built yet: dashed lines show the planned parts.

SightX grades retinal images with a ResNet-50 model and keeps clinicians, roles and records in Supabase. When a clinician asks about a patient, the record, the grade and the question all pass through ScrubX first. Only the tokenized prompt reaches AWS Bedrock, and the answer comes back through ScrubX before the clinician reads it.

![ScrubX as a module inside the SightX backend, between Supabase, the inference engine and AWS Bedrock](./SightX_integration.png)

Moving from Gemini to Bedrock means adding one provider behind `LLMProvider`. The pipeline stays the same.
