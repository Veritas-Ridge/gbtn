-- Vantage: per-client QuickBooks connection, the client's chart of accounts
-- as QuickBooks has it (Layer 1, read only), and each account's mapping to
-- the GBTN standard chart (Layer 2, lib/financials/standard-coa.ts).
--
-- Separate from the uncommitted lib/financials/qbo workstream on purpose:
-- different table names, so the two can't collide when that lands.
--
-- All writes go through the service role (lib/vantage/**). Tokens are
-- AES-256-GCM sealed and the connections table has NO policies, so nothing
-- reaches it through RLS. The other two are readable by GBTN platform admins
-- only. No client INSERT/UPDATE/DELETE policies anywhere, by design.
--
-- Idempotent: safe to re-run.

create table if not exists public.vantage_qbo_connections (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients (id) on delete cascade,
  realm_id            text not null,
  environment         text not null check (environment in ('sandbox', 'production')),
  company_name        text,
  -- Sealed with QBO_TOKEN_ENC_KEY (lib/vantage/qbo/crypto.ts). Null once disconnected.
  access_token        text,
  refresh_token       text,
  access_expires_at   timestamptz,
  refresh_expires_at  timestamptz,
  connected_by        uuid references auth.users (id) on delete set null,
  connected_at        timestamptz not null default now(),
  disconnected_at     timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint vantage_qbo_connections_client_key unique (client_id)
);

alter table public.vantage_qbo_connections enable row level security;
-- Intentionally no policies: secrets are service-role only.

-- The client's QuickBooks accounts, keyed by realm so reconnecting a client to
-- a different QuickBooks company never mixes the two charts.
create table if not exists public.vantage_qbo_accounts (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients (id) on delete cascade,
  realm_id              text not null,
  qbo_account_id        text not null,
  name                  text not null,
  fully_qualified_name  text,
  account_type          text,
  account_subtype       text,
  classification        text,
  acct_num              text,
  parent_qbo_id         text,
  active                boolean not null default true,
  synced_at             timestamptz not null default now(),
  constraint vantage_qbo_accounts_key unique (client_id, realm_id, qbo_account_id)
);

create index if not exists idx_vantage_qbo_accounts_client on public.vantage_qbo_accounts (client_id, realm_id);

alter table public.vantage_qbo_accounts enable row level security;

drop policy if exists vantage_qbo_accounts_admin_read on public.vantage_qbo_accounts;
create policy vantage_qbo_accounts_admin_read on public.vantage_qbo_accounts
  for select using ( public.is_admin() );

-- One mapping per account. `suggested` until an analyst approves it once;
-- approved mappings are never overwritten by later suggestion runs.
create table if not exists public.vantage_account_mappings (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null,
  realm_id          text not null,
  qbo_account_id    text not null,
  -- A key from STANDARD_ACCOUNTS in lib/financials/standard-coa.ts (validated in the app).
  standard_account  text not null,
  service_line      text,
  confidence        numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  method            text not null check (method in ('rule', 'ai', 'analyst')),
  rationale         text,
  status            text not null default 'suggested' check (status in ('suggested', 'approved')),
  suggested_at      timestamptz not null default now(),
  approved_by       uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  updated_at        timestamptz not null default now(),
  constraint vantage_account_mappings_key unique (client_id, realm_id, qbo_account_id),
  constraint vantage_account_mappings_account_fk
    foreign key (client_id, realm_id, qbo_account_id)
    references public.vantage_qbo_accounts (client_id, realm_id, qbo_account_id)
    on delete cascade
);

create index if not exists idx_vantage_mappings_status on public.vantage_account_mappings (client_id, realm_id, status);

alter table public.vantage_account_mappings enable row level security;

drop policy if exists vantage_mappings_admin_read on public.vantage_account_mappings;
create policy vantage_mappings_admin_read on public.vantage_account_mappings
  for select using ( public.is_admin() );
