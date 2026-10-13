-- ScrubX patient store. Read by the server with the service-role key only.
-- Run in the Supabase SQL editor (or `supabase db push`), then `npm run db:seed`.

create table if not exists public.patients (
  id          text primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  summary     text not null,
  description text not null,
  name        text not null,
  dob         date not null,
  mrn         text not null unique,
  phone       text,
  address     text,
  medications text[] not null default '{}',
  conditions  text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Deny by default: RLS on with no policies means anon and authenticated
-- clients (the public anon key, browsers) can read nothing. The service role
-- bypasses RLS and is only ever used server-side by SupabasePatientRepository.
alter table public.patients enable row level security;
revoke all on table public.patients from anon, authenticated;

comment on table public.patients is
  'Synthetic demo patients for ScrubX. Never store real patient data here without a HIPAA-eligible plan and a BAA.';
