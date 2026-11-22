-- Vantage: month-by-month history per QuickBooks account, read from
-- QuickBooks' ProfitAndLoss and BalanceSheet reports (summarized by month).
--
--   P&L accounts:           the month's activity
--   Balance sheet accounts: the balance at month end
--
-- Amounts keep QuickBooks' report sign, which matches gbtn's convention
-- (revenue, expenses, assets, liabilities and equity positive; contra
-- accounts such as discounts, accumulated depreciation and draws negative).
--
-- This is a derived cache of the client's books (Layer 1 stays in
-- QuickBooks): lib/vantage/history.ts reloads a client's range in full on
-- each pull. Nothing is hand-edited here; corrections belong in the
-- mapping (vantage_account_mappings), never in these rows.
--
-- Service role writes only; GBTN platform admins may read. Idempotent.

create table if not exists public.vantage_monthly_amounts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  realm_id        text not null,
  qbo_account_id  text not null,
  -- First day of the month.
  month           date not null,
  statement       text not null check (statement in ('pl', 'bs')),
  amount          numeric(20, 2) not null,
  created_at      timestamptz not null default now(),
  constraint vantage_monthly_amounts_key unique (client_id, realm_id, qbo_account_id, month, statement)
);

create index if not exists idx_vantage_monthly_client_month on public.vantage_monthly_amounts (client_id, realm_id, month);

alter table public.vantage_monthly_amounts enable row level security;

drop policy if exists vantage_monthly_admin_read on public.vantage_monthly_amounts;
create policy vantage_monthly_admin_read on public.vantage_monthly_amounts
  for select using ( public.is_admin() );

-- What the last pull covered.
alter table public.vantage_qbo_connections add column if not exists history_from date;
alter table public.vantage_qbo_connections add column if not exists history_to date;
alter table public.vantage_qbo_connections add column if not exists history_synced_at timestamptz;
