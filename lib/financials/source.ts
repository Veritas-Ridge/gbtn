import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPeriods } from "./build";
import type { FpaRawItem } from "./fpa";
import type { Period } from "./metrics";
import { loadHistory } from "@/lib/vantage/history";
import { monthLabel } from "@/lib/vantage/analysis";
import { quickBooksItems } from "./source-transform";

/**
 * Where a client's portal financials come from.
 *
 *   quickbooks  Vantage history (lib/vantage/history.ts) run through the
 *               client's APPROVED mappings, refreshed nightly. Used whenever
 *               the client has pulled history and has approved mappings.
 *   uploads     The month-end workbook / statement uploads
 *               (financial_uploads + financial_line_items), as before.
 *
 * Both come back in the one shape every portal page already reads
 * (FpaRawItem), so Financials, FP&A, the CFO Briefing and the Overview don't
 * care which. rawLabel is the account's QuickBooks name, the same names the
 * month-end exports carry.
 *
 * NOT a gate. Vantage tables are read with the service role, so callers must
 * have passed requireCapability(clientId, "financials") (or sessionCan) first.
 * Uploads are read with the caller's own RLS-bound client, as before.
 */

export type FinancialSource = {
  source: "quickbooks" | "uploads";
  items: FpaRawItem[];
  periodEndByLabel: Record<string, string | null>;
  /** QuickBooks: when history was last pulled. */
  asOf: string | null;
  /** Latest period label with data. */
  through: string | null;
  /** QuickBooks: accounts with activity that have no approved mapping (left out). */
  unmappedAccounts: number;
};

async function fromQuickBooks(clientId: string): Promise<FinancialSource | null> {
  const db = createAdminClient();
  const { data: conn } = await db
    .from("vantage_qbo_connections")
    .select("realm_id, history_synced_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!conn?.history_synced_at) return null;

  const [{ data: maps }, { data: accounts }] = await Promise.all([
    db
      .from("vantage_account_mappings")
      .select("qbo_account_id, standard_account")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realm_id)
      .eq("status", "approved"),
    db
      .from("vantage_qbo_accounts")
      .select("qbo_account_id, name, account_type")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realm_id),
  ]);
  if (!maps || maps.length === 0) return null;

  const history = await loadHistory(clientId, conn.realm_id);
  const pl = history.filter((h) => h.statement === "pl" && h.amount !== 0);
  if (pl.length === 0) return null;

  const { items, periodEndByLabel, unmapped } = quickBooksItems(
    history,
    new Map((maps ?? []).map((m) => [m.qbo_account_id as string, m.standard_account as string])),
    new Map((accounts ?? []).map((a) => [a.qbo_account_id as string, { name: a.name as string, type: (a.account_type as string) ?? "" }]))
  );

  const last = pl.reduce((a, h) => (h.month > a ? h.month : a), pl[0].month);
  return {
    source: "quickbooks",
    items,
    periodEndByLabel,
    asOf: conn.history_synced_at as string,
    through: monthLabel(last),
    unmappedAccounts: unmapped,
  };
}

async function fromUploads(supabase: SupabaseClient, clientId: string): Promise<FinancialSource> {
  const [{ data: uploads }, { data: rows }] = await Promise.all([
    supabase.from("financial_uploads").select("id, period_label, period_end").eq("client_id", clientId).eq("status", "confirmed"),
    supabase.from("financial_line_items").select("statement_type, category, raw_label, amount, upload_id").eq("client_id", clientId),
  ]);
  const meta = new Map((uploads ?? []).map((u) => [u.id, { label: u.period_label as string, end: (u.period_end as string | null) ?? null }]));
  const periodEndByLabel: Record<string, string | null> = {};
  for (const u of uploads ?? []) {
    if (!(u.period_label in periodEndByLabel)) periodEndByLabel[u.period_label] = u.period_end ?? null;
  }
  const items: FpaRawItem[] = (rows ?? []).map((i) => {
    const m = meta.get(i.upload_id);
    return {
      periodLabel: m?.label ?? "Unknown",
      periodEnd: m?.end ?? null,
      statementType: i.statement_type,
      category: i.category,
      rawLabel: i.raw_label ?? "",
      amount: Number(i.amount),
    };
  });
  const through =
    Object.entries(periodEndByLabel)
      .filter(([, end]) => end)
      .sort(([, a], [, b]) => (a! < b! ? -1 : 1))
      .at(-1)?.[0] ?? null;
  return { source: "uploads", items, periodEndByLabel, asOf: null, through, unmappedAccounts: 0 };
}

/** QuickBooks when the client has pulled history and approved mappings; uploads otherwise. */
export async function loadFinancialItems(supabase: SupabaseClient, clientId: string): Promise<FinancialSource> {
  try {
    const qb = await fromQuickBooks(clientId);
    if (qb) return qb;
  } catch (e) {
    // A QuickBooks-side failure must not blank the page: fall back to uploads.
    console.error("[financials/source] QuickBooks history unavailable, using uploads:", e);
  }
  return fromUploads(supabase, clientId);
}

/** The Period[] the dashboards render, from either source. */
export function periodsFrom(src: FinancialSource): Period[] {
  return buildPeriods(
    src.items.map((i) => ({ statement_type: i.statementType, period_label: i.periodLabel, category: i.category, amount: i.amount })),
    src.periodEndByLabel
  );
}
