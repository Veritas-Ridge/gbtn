-- Gut Check show submissions from the public form at /gut-check.
-- Distinct from contact_submissions (consult requests) and waitlist (book).
--
-- Holds owner supplied business detail (revenue band, close rate, marketing
-- spend, goals), so reads are staff only. Inserts come through the service
-- role client in app/(marketing)/gut-check/actions.ts, which bypasses RLS, so
-- there is intentionally no public or client insert policy.
--
-- Idempotent: safe to re-run.

create table if not exists public.gut_check_submissions (
  id                       uuid primary key default gen_random_uuid(),

  -- Section 1, the basics
  name                     text not null,
  business_name            text not null,
  email                    text not null,
  phone                    text,
  industry                 text not null,
  services_sold            text,
  revenue_band             text not null
    check (revenue_band in ('under_1m', '1m_5m', '5m_20m', '20m_plus')),
  team_size                integer check (team_size is null or team_size >= 0),
  years_in_business        integer check (years_in_business is null or years_in_business >= 0),

  -- Section 2, the four pillars
  attract_lead_sources     text,
  attract_monthly_spend    numeric check (attract_monthly_spend is null or attract_monthly_spend >= 0),
  book_process             text,
  convert_close_rate_pct   numeric check (convert_close_rate_pct is null or (convert_close_rate_pct >= 0 and convert_close_rate_pct <= 100)),
  deliver_headache         text
    check (deliver_headache is null or deliver_headache in ('capacity', 'quality', 'people', 'margin', 'other')),
  deliver_notes            text,

  -- Section 3, the owner
  sleepless_number         text,
  dialed_in_vision         text,
  owner_goal               text
    check (owner_goal is null or owner_goal in ('grow', 'sell', 'step_back')),
  bookkeeper               text
    check (bookkeeper is null or bookkeeper in ('in_house', 'outside', 'owner')),
  accounting_system        text
    check (accounting_system is null or accounting_system in ('qbo', 'netsuite', 'sage', 'other')),
  accounting_system_other  text,
  feature_preference       text not null
    check (feature_preference in ('named', 'anonymous', 'private')),

  -- Consent to use the answers to prepare a snapshot. Not a guest release:
  -- nothing airs until a separate signed release exists.
  consented_at             timestamptz not null,

  -- Pipeline
  status                   text not null default 'new'
    check (status in ('new', 'snapshot_pending', 'episode_booked', 'private_review', 'declined')),
  crm_contact_id           uuid,
  notified                 boolean not null default false,
  user_agent               text,
  created_at               timestamptz not null default now()
);

create index if not exists idx_gut_check_created on public.gut_check_submissions (created_at desc);
create index if not exists idx_gut_check_email on public.gut_check_submissions (lower(email));
create index if not exists idx_gut_check_status on public.gut_check_submissions (status);

alter table public.gut_check_submissions enable row level security;

drop policy if exists gut_check_staff_read on public.gut_check_submissions;
create policy gut_check_staff_read on public.gut_check_submissions
  for select using ( public.is_staff() );

drop policy if exists gut_check_admin_all on public.gut_check_submissions;
create policy gut_check_admin_all on public.gut_check_submissions
  for all using ( public.is_admin() ) with check ( public.is_admin() );
