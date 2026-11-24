import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { QboClient, type QboConnectionRow } from "./qbo/client";
import { accountsByMonth, type ByMonthReport } from "./qbo/reports";

/**
 * Vantage history: 24 to 36 months of each QuickBooks account, month by
 * month, from QuickBooks' own P&L and balance sheet reports (read only).
 *
 * The range ends with the last complete month. Reports are requested a
 * year at a time (two calls per year), so 36 months is six calls. The pull
 * replaces the client's rows for the range in full: this table is a cache
 * of QuickBooks, and a reclass in the books must not leave a stale amount.
 *
 * No access checks here: callers gate first (assertAdmin).
 */

export const DEFAULT_MONTHS = 36;
const MIN_MONTHS = 12;
const MAX_MONTHS = 36;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const firstOfMonthUtc = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
const lastOfMonthUtc = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0));

/** [start, end] covering `months` complete months, ending last month. */
export function historyRange(months: number, today = new Date()): { start: Date; end: Date } {
  const n = Math.max(MIN_MONTHS, Math.min(MAX_MONTHS, Math.round(months)));
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() - 1; // last complete month
  return { start: firstOfMonthUtc(y, m - (n - 1)), end: lastOfMonthUtc(y, m) };
}

type Row = {
  client_id: string;
  realm_id: string;
  qbo_account_id: string;
  month: string;
  statement: "pl" | "bs";
  amount: number;
};

export async function pullHistory(
  clientId: string,
  months = DEFAULT_MONTHS
): Promise<{ months: number; rows: number; from: string; to: string; activeMonths: number; firstActive: string | null }> {
  const db = createAdminClient();
  const { data: conn, error } = await db
    .from("vantage_qbo_connections")
    .select("id, client_id, realm_id, access_token, refresh_token, access_expires_at")
    .eq("client_id", clientId)
    .maybeSingle<QboConnectionRow>();
  if (error) throw new Error(error.message);
  if (!conn || !conn.refresh_token) throw new Error("This client isn't connected to QuickBooks.");

  const client = new QboClient(conn);
  const { start, end } = historyRange(months);
  const rows: Row[] = [];
  const push = (statement: "pl" | "bs", report: ByMonthReport) => {
    for (const [id, a] of accountsByMonth(report)) {
      for (const [month, cents] of a.cents) {
        if (cents === 0) continue;
        rows.push({
          client_id: clientId,
          realm_id: conn.realm_id,
          qbo_account_id: id,
          month: `${month}-01`,
          statement,
          amount: cents / 100,
        });
      }
    }
  };

  for (let from = start; from <= end; ) {
    const to = new Date(Math.min(lastOfMonthUtc(from.getUTCFullYear(), from.getUTCMonth() + 11).getTime(), end.getTime()));
    const params = {
      start_date: ymd(from),
      end_date: ymd(to),
      summarize_column_by: "Month",
      accounting_method: "Accrual",
    };
    push("pl", await client.get<ByMonthReport>("reports/ProfitAndLoss", params));
    push("bs", await client.get<ByMonthReport>("reports/BalanceSheet", params));
    from = firstOfMonthUtc(to.getUTCFullYear(), to.getUTCMonth() + 1);
  }

  // Keep only months inside the range (QuickBooks can echo a partial edge column).
  const lo = ymd(start);
  const hi = ymd(end);
  const inRange = rows.filter((r) => r.month >= lo && r.month <= hi);

  // Replace the range without ever leaving it half empty (the client portal
  // reads this table): upsert every fresh row stamped with this pull's time,
  // THEN delete rows in the range that this pull didn't touch (an amount that
  // went to zero, a reclass). A failure part way leaves the old values in
  // place rather than a gap.
  const pulledAt = new Date().toISOString();
  const stamped = inRange.map((r) => ({ ...r, created_at: pulledAt }));
  for (let i = 0; i < stamped.length; i += 1000) {
    const { error: upErr } = await db
      .from("vantage_monthly_amounts")
      .upsert(stamped.slice(i, i + 1000), { onConflict: "client_id,realm_id,qbo_account_id,month,statement" });
    if (upErr) throw new Error(`Couldn't save the history: ${upErr.message}`);
  }
  const { error: delErr } = await db
    .from("vantage_monthly_amounts")
    .delete()
    .eq("client_id", clientId)
    .eq("realm_id", conn.realm_id)
    .gte("month", lo)
    .lte("month", hi)
    .lt("created_at", pulledAt);
  if (delErr) throw new Error(`Couldn't clear stale history: ${delErr.message}`);
  await db
    .from("vantage_qbo_connections")
    .update({ history_from: lo, history_to: hi, history_synced_at: new Date().toISOString() })
    .eq("id", conn.id);

  const n = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  // Months with P&L activity: a QuickBooks file started mid-year has fewer than requested.
  const active = [...new Set(inRange.filter((r) => r.statement === "pl").map((r) => r.month))].sort();
  return { months: n, rows: inRange.length, from: lo, to: hi, activeMonths: active.length, firstActive: active[0] ?? null };
}

export type MonthlyAmount = { qboAccountId: string; month: string; statement: "pl" | "bs"; amount: number };

/** Every stored month for the client's current QuickBooks company (paged past the 1,000 row API cap). */
export async function loadHistory(clientId: string, realmId: string): Promise<MonthlyAmount[]> {
  const db = createAdminClient();
  const out: MonthlyAmount[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("vantage_monthly_amounts")
      .select("qbo_account_id, month, statement, amount")
      .eq("client_id", clientId)
      .eq("realm_id", realmId)
      .order("month", { ascending: true })
      .order("qbo_account_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      out.push({
        qboAccountId: r.qbo_account_id as string,
        month: String(r.month).slice(0, 7),
        statement: r.statement as "pl" | "bs",
        amount: Number(r.amount),
      });
    }
    if (!data || data.length < PAGE) return out;
  }
}
