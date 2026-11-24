// QuickBooks history → the FpaRawItem rows every portal financial page reads.
// Pure (no server imports) so it can be checked offline; lib/financials/source.ts
// does the loading and the gating contract.

import { standardAccount } from "./standard-coa";
import type { FpaRawItem } from "./fpa";
import { monthLabel, type HistoryAmount } from "@/lib/vantage/analysis";
import { signFor } from "@/lib/vantage/mapping/rules";

const ASSET_TYPES = new Set(["Bank", "Accounts Receivable", "Other Current Asset", "Fixed Asset", "Other Asset"]);
const LIAB_EQUITY_TYPES = new Set(["Accounts Payable", "Credit Card", "Other Current Liability", "Long Term Liability", "Equity"]);

export const lastDayOf = (month: string) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * Each stored QuickBooks amount becomes one row under its APPROVED standard
 * account's legacy category, labelled with the QuickBooks account name.
 * Accounts with no approved mapping are left out and counted.
 *
 * Months start at the first month with P&L activity (an opening-balance month
 * before the books begin is not a month of business), the same rule as the
 * Vantage readout.
 *
 * Equity gets one extra row per balance sheet month: QuickBooks' own "Net
 * Income" line, which it computes rather than keeping in an account. It is
 * taken as what balances QuickBooks' balance sheet (every asset account less
 * every liability and equity account, mapped or not), which is exactly that
 * line by definition. Unlike summing P&L months, this is right for any fiscal
 * year start and for a pulled range that begins mid-year.
 */
export function quickBooksItems(
  history: HistoryAmount[],
  mapped: Map<string, { account: string; serviceLine: string | null }>,
  accounts: Map<string, { name: string; type: string }>
): { items: FpaRawItem[]; periodEndByLabel: Record<string, string | null>; unmapped: number } {
  const pl = history.filter((h) => h.statement === "pl" && h.amount !== 0);
  const items: FpaRawItem[] = [];
  const periodEndByLabel: Record<string, string | null> = {};
  if (pl.length === 0) return { items, periodEndByLabel, unmapped: 0 };
  const firstMonth = pl.reduce((a, h) => (h.month < a ? h.month : a), pl[0].month);

  const unmapped = new Set<string>();
  const niByMonth = new Map<string, number>(); // assets less liabilities and equity accounts, per month

  for (const h of history) {
    if (h.month < firstMonth) continue;
    const label = monthLabel(h.month);
    periodEndByLabel[label] = lastDayOf(h.month);
    const a = accounts.get(h.qboAccountId);
    if (h.statement === "bs" && a) {
      const sign = ASSET_TYPES.has(a.type) ? 1 : LIAB_EQUITY_TYPES.has(a.type) ? -1 : 0;
      niByMonth.set(h.month, (niByMonth.get(h.month) ?? 0) + sign * h.amount);
    }
    const m = mapped.get(h.qboAccountId);
    const key = m?.account;
    const std = key ? standardAccount(key) : undefined;
    if (!std || std.statement !== h.statement) {
      if (h.amount !== 0) unmapped.add(h.qboAccountId);
      continue;
    }
    items.push({
      periodLabel: label,
      periodEnd: lastDayOf(h.month),
      statementType: h.statement,
      category: std.legacyCategory,
      rawLabel: a?.name ?? std.label,
      // Flip when the account's nature differs from its standard account's (see signFor).
      amount: h.amount * signFor(a?.type, key!),
      standardAccount: key,
      serviceLine: m?.serviceLine ?? null,
    });
  }

  for (const [m, ni] of [...niByMonth.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    items.push({
      periodLabel: monthLabel(m),
      periodEnd: lastDayOf(m),
      statementType: "bs",
      category: "equity",
      rawLabel: "Net Income (year to date)",
      amount: Math.round(ni * 100) / 100,
    });
  }
  return { items, periodEndByLabel, unmapped: unmapped.size };
}
