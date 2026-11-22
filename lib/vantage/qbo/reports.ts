// Reading QuickBooks' by-month reports (ProfitAndLoss, BalanceSheet with
// summarize_column_by=Month). Ported from Groundworks' tie-out reader
// (groundworks-erp src/lib/qbo/tieout.ts, accountsByMonth).
//
// Keyed on what's stable, never on display labels: each account row's
// QuickBooks id (ColData[0].id) and each column's StartDate metadata. Rows
// without an account id (section totals, Net Income, Gross Profit) are
// skipped. Money cells are strings; "" means no value. Amounts are held in
// integer cents so sums never drift.
//
// Pure (no server imports) so it can be checked against fixtures.

type Cell = { value?: string; id?: string };
export type ReportRow = {
  ColData?: Cell[];
  Rows?: { Row?: ReportRow[] };
  Header?: { ColData?: Cell[] };
  Summary?: { ColData?: Cell[] };
};
export type ByMonthReport = {
  Columns?: { Column?: Array<{ ColTitle?: string; MetaData?: Array<{ Name?: string; Value?: string }> }> };
  Rows?: { Row?: ReportRow[] };
};

/** QuickBooks account id → name and cents per month ("2026-03"). */
export type AccountMonths = Map<string, { name: string; cents: Map<string, number> }>;

function toCents(raw: string | undefined): number {
  const s = (raw ?? "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * An account with sub-accounts comes back as a section: its name and id in
 * the header, its sub-accounts as rows, and the total including them in the
 * summary. Its own amount is its own row when QuickBooks sends one, else the
 * summary less its sub-accounts.
 */
export function accountsByMonth(report: ByMonthReport): AccountMonths {
  const cols = (report.Columns?.Column ?? []).map(
    (c) => c.MetaData?.find((m) => m.Name === "StartDate")?.Value?.slice(0, 7) ?? null
  );
  const out: AccountMonths = new Map();
  const amounts = (cells: Cell[] | undefined) => {
    const m = new Map<string, number>();
    cols.forEach((month, i) => {
      if (month) m.set(month, toCents(cells?.[i]?.value));
    });
    return m;
  };
  const total = (r: ReportRow) => amounts(r.Summary?.ColData ?? r.ColData);
  const walk = (rows: ReportRow[] | undefined) => {
    for (const r of rows ?? []) {
      const head = r.Header?.ColData?.[0];
      if (head?.id) {
        const children = r.Rows?.Row ?? [];
        const ownRow = children.find((c) => c.ColData?.[0]?.id === head.id);
        let own: Map<string, number>;
        if (ownRow) own = amounts(ownRow.ColData);
        else {
          own = total(r);
          for (const c of children) for (const [m, v] of total(c)) own.set(m, (own.get(m) ?? 0) - v);
        }
        out.set(head.id, { name: head.value ?? head.id, cents: own });
        walk(children.filter((c) => c !== ownRow));
        continue;
      }
      const id = r.ColData?.[0]?.id;
      if (id) out.set(id, { name: r.ColData?.[0]?.value ?? id, cents: amounts(r.ColData) });
      walk(r.Rows?.Row);
    }
  };
  walk(report.Rows?.Row);
  return out;
}
