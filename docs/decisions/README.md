# Why ScrubX is built this way

Every design here was a choice, and most of them cost something. Each file records one: the problem, what was decided, a real example from this project, where it lives and the trade-off.

**New here?** Start with [01](01-framework-free-core.md), [02](02-typed-request-scoped-tokens.md) and [18](18-an-honest-evaluation-set.md): how the pipeline is shaped, how masking works and how it's measured.

These files record what was decided at the time, and some claim more than later testing supports. For how ScrubX performs today, read [the results](../../eval/RESULTS.md).

## Keeping identifiers from the model

| Decision | In one line |
|---|---|
| [02 · Typed, request-scoped tokens](02-typed-request-scoped-tokens.md) | Identifiers become placeholders like `[PATIENT_1]`, and the real values live in one request's vault |
| [13 · Find identifiers the detector wasn't told about](13-find-identifiers-the-detector-was-not-told-about.md) | It looks for identifiers by shape and context, not only what the record holds, and a test plants its own |
| [14 · Someone with the patient's surname is not the patient](14-same-surname-is-not-the-patient.md) | A clinician title or a different given name marks another person. Testing still labeled 8 of 138 other people as the patient |
| [16 · A cue word is not part of the name](16-a-cue-word-is-not-part-of-the-name.md) | In `Nurse Tendai`, only the name is tokenized, and "Who" isn't a person |

## Stopping attacks

| Decision | In one line |
|---|---|
| [03 · Risk score and critical rules](03-risk-scoring.md) | One score decides, a known attack pattern blocks outright, and clinical wording isn't punished twice |
| [04 · Sanitize everything bound for the model](04-sanitize-everything-bound-for-the-model.md) | The record and history get the same checks as the message, and an instruction it recognizes is cut out |
| [15 · An override has to aim at the assistant](15-an-override-has-to-aim-at-the-assistant.md) | Non-adherence notes and review-of-systems headers aren't attacks, and a false-block test guards that |

## Keeping patient data contained

| Decision | In one line |
|---|---|
| [05 · Trace payloads follow the data source](05-trace-payloads-follow-the-data.md) | Full text for synthetic patients, counts only for real ones |
| [06 · Stateless server, in-memory client](06-stateless-server-client-held-history.md) | Nothing with PHI is kept on the server or written to disk |
| [07 · Patients resolved server-side](07-patient-resolved-server-side.md) | The browser sends an ID, never a record |
| [09 · Supabase, read-only, deny-all RLS](09-supabase-over-postgrest.md) | Only this server can read patients, and the app can't write |

## Building and running it

| Decision | In one line |
|---|---|
| [01 · Framework-free core with a Stage base class](01-framework-free-core.md) | Any host can import the pipeline, and no stage can skip the trace |
| [08 · Gemini over REST with retries and a fallback](08-gemini-over-rest.md) | Retries and a second model ride out a busy model, and a real outage gets an honest message |
| [17 · Limit what one client can send and spend](17-limit-what-one-client-can-send-and-spend.md) | History has a size limit, each address gets 10 requests a minute, and a deployment can cap model calls per day |

## The app people see

| Decision | In one line |
|---|---|
| [10 · One role, real model, observation-only security view](10-single-role-real-model-observation-only.md) | What runs is what would run in production |
| [11 · Clinical UI rules](11-clinical-ui.md) | Built for a tired clinician: the patient is always in view, dates and doses have one format, and status never relies on color alone |
| [12 · Show the record scrub; audit line stays in the log](12-show-the-record-scrub.md) | For synthetic patients, you see what was stored and what the model received |

## Measuring it

| Decision | In one line |
|---|---|
| [18 · Measure on rows nobody tuned on, and publish the first score](18-an-honest-evaluation-set.md) | `npm run eval` scores the real pipeline, refuses to run until the rows are committed, and says whether the detectors have changed since |

## Adding a decision

New decisions take the next number. A superseded decision stays in place and links forward.
