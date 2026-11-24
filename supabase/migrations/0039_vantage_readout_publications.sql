-- Vantage: readout findings an analyst has chosen to show a client.
--
-- A publication is a SNAPSHOT of the findings exactly as reviewed (title,
-- detail, question, months), plus an optional note. The nightly refresh
-- recomputes the readout, but a client only ever sees what was published,
-- until an analyst publishes again or unpublishes.
--
-- Writes: service role only (lib/vantage/publish.ts, behind assertAdmin).
-- Reads: the portal reads with the service role after requireCapability;
-- RLS mirrors that gate as defense in depth (can_read_financials, which
-- also admits platform admins). Idempotent.

create table if not exists public.vantage_readout_publications (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  findings        jsonb not null check (jsonb_typeof(findings) = 'array'),
  note            text,
  -- The months the readout covered when published, for the client-facing caption.
  covers_from     text,
  covers_to       text,
  published_by    uuid references auth.users (id) on delete set null,
  published_at    timestamptz not null default now(),
  unpublished_at  timestamptz
);

create index if not exists idx_vantage_publications_client on public.vantage_readout_publications (client_id, published_at desc);

alter table public.vantage_readout_publications enable row level security;

drop policy if exists vantage_publications_read on public.vantage_readout_publications;
create policy vantage_publications_read on public.vantage_readout_publications
  for select using ( public.can_read_financials(client_id) );
