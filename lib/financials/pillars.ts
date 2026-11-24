// The Four Pillars scorecard for the client portal: what each stage of the
// business (Attract, Book, Convert, Deliver) costs, month by month, from the
// client's mapped QuickBooks history. Built on rollupFunnel, the same math as
// the Vantage readout, so the two always agree.
//
// Cost only, for now: cost per lead, booking rate and close rate need volumes
// from the CRM and phone system (Vantage build step 6). The page says so.
//
// Pure (no server imports): items in, report out. Signed sums throughout.

import { rollupFunnel, type MappedLineItem, type ServiceLineResult, type Stage } from "./standard-coa";
import type { FpaRawItem } from "./fpa";

export const STAGE_ORDER: Stage[] = ["attract", "book", "convert", "deliver"];

export type PillarMonth = {
  label: string;
  end: string;
  revenue: number;
  cost: Record<Stage, number>;
  share: Record<Stage, number | null>;
  grossMargin: number | null;
  deliveryMargin: number | null;
  companyOverhead: number;
};

export type PillarsReport = {
  months: PillarMonth[];
  scope: "t12" | "ytd";
  from: string;
  to: string;
  monthsCovered: number;
  revenue: number;
  cost: Record<Stage, number>;
  share: Record<Stage, number | null>;
  grossMargin: number | null;
  deliveryMargin: number | null;
  companyOverhead: number;
  companyShare: number | null;
  /** Each stage's share of revenue, last three months against the three before, in points. */
  trend: Record<Stage, number | null>;
  /** Margin by service line over the window, when the mapping names two or more. */
  byServiceLine: { line: string; result: ServiceLineResult }[] | null;
};

const pct = (n: number, d: number) => (d ? (n / d) * 100 : null);
const zero = (): Record<Stage, number> => ({ attract: 0, book: 0, convert: 0, deliver: 0 });

export function buildPillars(items: FpaRawItem[]): PillarsReport | null {
  const byMonth = new Map<string, { label: string; items: MappedLineItem[] }>();
  for (const it of items) {
    if (it.statementType !== "pl" || !it.standardAccount || !it.periodEnd) continue;
    const slot = byMonth.get(it.periodEnd) ?? { label: it.periodLabel, items: [] };
    slot.items.push({ account: it.standardAccount, amount: it.amount, serviceLine: it.serviceLine ?? null });
    byMonth.set(it.periodEnd, slot);
  }
  if (byMonth.size === 0) return null;

  const months: PillarMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([end, { label, items: mi }]) => {
      const f = rollupFunnel(mi);
      const cost = { attract: f.stages.attract.cost, book: f.stages.book.cost, convert: f.stages.convert.cost, deliver: f.stages.deliver.cost };
      return {
        label,
        end,
        revenue: f.revenue,
        cost,
        share: {
          attract: pct(cost.attract, f.revenue),
          book: pct(cost.book, f.revenue),
          convert: pct(cost.convert, f.revenue),
          deliver: pct(cost.deliver, f.revenue),
        },
        grossMargin: f.kpis.grossMargin,
        deliveryMargin: f.kpis.deliveryMargin,
        companyOverhead: f.companyOverhead,
      };
    });

  const window = months.slice(-12);
  const allItems: MappedLineItem[] = [];
  const windowEnds = new Set(window.map((m) => m.end));
  for (const [end, slot] of byMonth) if (windowEnds.has(end)) allItems.push(...slot.items);
  const f = rollupFunnel(allItems);
  const cost = zero();
  for (const s of STAGE_ORDER) cost[s] = f.stages[s].cost;

  const shareOf = (ms: PillarMonth[], s: Stage) => {
    const rev = ms.reduce((t, m) => t + m.revenue, 0);
    return pct(
      ms.reduce((t, m) => t + m.cost[s], 0),
      rev
    );
  };
  const trend = {} as Record<Stage, number | null>;
  const last3 = months.slice(-3);
  const prev3 = months.length >= 6 ? months.slice(-6, -3) : [];
  for (const s of STAGE_ORDER) {
    const a = shareOf(last3, s);
    const b = prev3.length ? shareOf(prev3, s) : null;
    trend[s] = a != null && b != null ? a - b : null;
  }

  const lines = Object.entries(f.byServiceLine).filter(([k]) => k !== "unassigned");
  return {
    months,
    scope: window.length === 12 ? "t12" : "ytd",
    from: window[0].label,
    to: window[window.length - 1].label,
    monthsCovered: window.length,
    revenue: f.revenue,
    cost,
    share: {
      attract: pct(cost.attract, f.revenue),
      book: pct(cost.book, f.revenue),
      convert: pct(cost.convert, f.revenue),
      deliver: pct(cost.deliver, f.revenue),
    },
    grossMargin: f.kpis.grossMargin,
    deliveryMargin: f.kpis.deliveryMargin,
    companyOverhead: f.companyOverhead,
    companyShare: pct(f.companyOverhead, f.revenue),
    trend,
    byServiceLine:
      lines.length >= 2
        ? Object.entries(f.byServiceLine)
            .map(([line, result]) => ({ line, result }))
            .sort((a, b) => b.result.revenue - a.result.revenue)
        : null,
  };
}
