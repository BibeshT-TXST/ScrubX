// Seeds the Supabase `patients` table from data/patients.demo.json (synthetic only).
// Usage: npm run db:seed [-- --dry-run]
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local by the npm script).
// Upserts by id, so it is safe to re-run. The app itself never writes to the table.

import { readFile } from "node:fs/promises";

const dryRun = process.argv.includes("--dry-run");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const patients = JSON.parse(await readFile(new URL("../data/patients.demo.json", import.meta.url), "utf8"));
const rows = patients.map(({ id, summary, description, fields }) => ({
  id,
  summary,
  description,
  name: fields.name,
  dob: fields.dob,
  mrn: fields.mrn,
  phone: fields.phone ?? null,
  address: fields.address ?? null,
  medications: fields.medications ?? [],
  conditions: fields.conditions ?? [],
}));

if (dryRun) {
  console.log(`Dry run: would upsert ${rows.length} synthetic patients: ${rows.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local) before seeding.");
  process.exit(1);
}

// Accept the project URL with or without the "/rest/v1/" suffix the dashboard also shows.
const base = SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const res = await fetch(`${base}/rest/v1/patients?on_conflict=id`, {
  method: "POST",
  headers: {
    // Secret keys (sb_secret_…) go in apikey only; legacy service_role JWTs also as Bearer.
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    ...(!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_") && { authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }),
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});

if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  console.error(`Seed failed (${res.status}): ${body.message ?? res.statusText}`);
  if (res.status === 404) console.error("Is the table there? Run supabase/migrations/0001_patients.sql first.");
  process.exit(1);
}
console.log(`Seeded ${rows.length} synthetic patients into ${new URL(SUPABASE_URL).host}.`);
