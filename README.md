# ScrubX
ScrubX is a security gateway that sits between a clinical app and an LLM. A doctor's question passes through it, sensitive patient details get swapped for tokens before anything reaches the model, and the real values get swapped back into the answer on the way out. Every request leaves an audit trail, and risky ones never make it past the gate. I am building so i can **simulate how hospitals can use an LLM without sending patient data** anywhere it shouldn't go.

## System Architecture(Proposed):
ScrubX runs as a single service with a staged pipeline i.e. normalize, detect, decide, tokenize, call and restore. Each stage is a module behind its own interface, so anyone can be swapped or pulled into its own service without touching the others. Audit writes happen off the request path.

![System Architecture](./docs/ScrubX.png)

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # typecheck + lint + tests
```

Open `/` for Chat (pick a patient: their record on the left, the conversation on the right) and `/security` for the Security Division, a read-only view of how ScrubX handled every message in the session.

### API

- `POST /api/pipeline`: `{ "patientId": "pt-001", "message": "...", "history": [] }` (`role` is optional and defaults to `medical_practitioner`; in production the host sets it). Streams NDJSON: one line per pipeline stage, then the final result with the response, trace and PHI-free audit event.
- `GET /api/patients` and `GET /api/patients/:id`: synthetic demo patients.

Answers come from Gemini. Add your key to `.env.local`; without one the app still runs, and every reply says it couldn't connect:

```bash
GEMINI_API_KEY=...
# optional: LLM_MODEL (default gemini-3.8-flash), LLM_FALLBACK_MODEL (default gemini-3.5-flash-lite)
```

To read patients from Supabase instead of the bundled demo data:

1. Run `supabase/migrations/0001_patients.sql` in the Supabase SQL editor.
2. Add `PATIENT_SOURCE=supabase`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`.
3. `npm run db:seed` loads the 8 synthetic patients (`-- --dry-run` to preview).

See `.env.example` for every setting, [docs/architecture.md](docs/architecture.md) for how the pipeline works, and [docs/adr/](docs/adr) for the decisions behind it. The pipeline core in `src/core` is framework-free so a host project can import it directly.
