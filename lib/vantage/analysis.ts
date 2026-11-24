// Vantage readout: history (QuickBooks amounts per account per month) run
// through the approved mappings into a monthly P&L, funnel costs and
// collection days, then checked for the patterns the brief names:
// seasonality, margin drift, AR creep and overhead jumps.
//
// Each finding carries a validation question for the readout meeting, in the
// brief's style ("gross margin dropped 4 points last spring; what happened?").
//
// Pure: no server imports, no I/O. Sums are signed, never abs(), per the
// financial math invariants; abs() appears only to size coverage for display.

import { computePL, computeBS } from "@/lib/financials/metrics";
import {
  rollupFunnel,
  standardAccount,
  toLegacyItems,
  type CostType,
  type MappedLineItem,
  type OverheadFunction,
  type Stage,
} from "@/lib/financials/standard-coa";
import { signFor } from "./mapping/rules";

export type HistoryAmount = { qboAccountId: string; month: string; statement: "pl" | "bs"; amount: number };
export type ApprovedMapping = {
  account: string;
  serviceLine: string | null;
  /** The QuickBooks account type, so amounts can be signed for the standard account (signFor). */
  qboAccountType?: string | null;
};

export type MonthPoint = {
  month: string; // "2026-03"
  revenue: number;
  grossProfit: number;
  grossMargin: number | null;
  ebitda: number;
  ebitdaMargin: number | null;
  directByType: Record<CostType, number>;
  overhead: number;
  overheadByFunction: Record<OverheadFunction, number>;
  stageCost: Record<Stage, number>;
  deliveryMargin: number | null;
  cash: number | null;
  ar: number | null;
  ap: number | null;
  /** Days sales outstanding: AR over the last three months' revenue, times 91. */
  dso: number | null;
};

export type Finding = {
  kind: "seasonality" | "margin_drift" | "ar_creep" | "overhead_jump";
  severity: "high" | "medium" | "info";
  title: string;
  detail: string;
  question: string;
  from: string;
  to: string;
};

export type Readout = {
  months: MonthPoint[];
  /** Last 12 months when there are 12, else everything there is (a new QuickBooks file mid-year). */
  scorecard: {
    scope: "t12" | "ytd";
    months: number;
    from: string;
    to: string;
    revenue: number;
    revenueGrowth: number | null;
    grossMargin: number | null;
    ebitdaMargin: number | null;
    deliveryMargin: number | null;
    stageShare: Record<Stage, number | null>;
    dso: number | null;
  } | null;
  /** Checks that need more months than the books hold, said plainly in the readout. */
  limits: string[];
  findings: Finding[];
  coverage: { plShareUnmapped: number | null; bsShareUnmapped: number | null; unmappedAccounts: string[] };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A finding's stable key, so a publish form can name findings without sending their text. */
export function findingKey(f: { kind: string; from: string; to: string }): string {
  return `${f.kind}:${f.from}:${f.to}`;
}

export function monthLabel(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}
export function rangeLabel(from: string, to: string): string {
  if (from === to) return monthLabel(from);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${MONTHS[Number(from.slice(5, 7)) - 1]} to ${monthLabel(to)}`
    : `${monthLabel(from)} to ${monthLabel(to)}`;
}
const addMonths = (m: string, n: number) => {
  const y = Number(m.slice(0, 4));
  const mo = Number(m.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, mo, 1));
  return d.toISOString().slice(0, 7);
};
const pct = (num: number, den: number) => (den ? (num / den) * 100 : null);
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const usd = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(1)}M` : a >= 1_000 ? `$${Math.round(a / 1_000)}K` : `$${Math.round(a)}`;
  return n < 0 ? `-${s}` : s;
};
const pts = (n: number) => `${Math.abs(n).toFixed(1)} points`;

const FUNCTION_LABEL: Record<OverheadFunction, string> = {
  marketing: "marketing (Attract)",
  sales: "sales (Book and Convert)",
  operations: "operations (Deliver)",
  finance_admin: "finance and admin",
};
const COST_LABEL: Record<CostType, string> = {
  labor: "direct labor",
  materials: "materials",
  subcontractors: "subcontractors",
  other_direct: "other job costs",
};

/** Monthly P&L, funnel and balance points, every month from first to last with data. */
export function buildMonths(history: HistoryAmount[], mappings: Map<string, ApprovedMapping>): MonthPoint[] {
  // Start at the first month with P&L activity: a balance-sheet-only month
  // (opening balances dated before the books begin) is not a month of business.
  const pl = history.filter((h) => h.statement === "pl" && h.amount !== 0);
  if (pl.length === 0) return [];
  const first = pl.reduce((a, h) => (h.month < a ? h.month : a), pl[0].month);
  const last = history.reduce((a, h) => (h.month > a ? h.month : a), history[0].month);
  const byMonth = new Map<string, { pl: MappedLineItem[]; bs: MappedLineItem[] }>();
  for (const h of history) {
    const m = mappings.get(h.qboAccountId);
    if (!m) continue;
    const std = standardAccount(m.account);
    if (!std || std.statement !== h.statement) continue;
    const slot = byMonth.get(h.month) ?? { pl: [], bs: [] };
    slot[h.statement].push({ account: m.account, amount: h.amount * signFor(m.qboAccountType, m.account), serviceLine: m.serviceLine });
    byMonth.set(h.month, slot);
  }

  const points: MonthPoint[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) {
    const slot = byMonth.get(m) ?? { pl: [], bs: [] };
    const pl = computePL(toLegacyItems(slot.pl));
    const f = rollupFunnel(slot.pl);
    const bs = slot.bs.length ? computeBS(toLegacyItems(slot.bs)) : null;
    const overhead = sum(Object.values(f.overheadByFunction));
    points.push({
      month: m,
      revenue: pl.revenue,
      grossProfit: pl.grossProfit,
      grossMargin: pl.grossMargin,
      ebitda: pl.ebitda,
      ebitdaMargin: pl.ebitdaMargin,
      directByType: f.directCostByType,
      overhead,
      overheadByFunction: f.overheadByFunction,
      stageCost: { attract: f.stages.attract.cost, book: f.stages.book.cost, convert: f.stages.convert.cost, deliver: f.stages.deliver.cost },
      deliveryMargin: f.kpis.deliveryMargin,
      cash: bs ? bs.cash : null,
      ar: bs ? bs.accountsReceivable : null,
      ap: bs ? bs.accountsPayable : null,
      dso: null,
    });
  }
  points.forEach((p, i) => {
    if (i < 2 || p.ar == null) return;
    const rev3 = points[i].revenue + points[i - 1].revenue + points[i - 2].revenue;
    p.dso = rev3 > 0 ? (p.ar / rev3) * 91 : null;
  });
  return points;
}

// ── Pattern checks ─────────────────────────────────────────────────────────

/** Revenue by calendar month across years; flags a peak to trough swing of 30% or more. */
export function seasonality(points: MonthPoint[]): Finding | null {
  if (points.length < 24) return null;
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (const p of points) buckets[Number(p.month.slice(5, 7)) - 1].push(p.revenue);
  if (buckets.some((b) => b.length === 0)) return null;
  const avg = buckets.map((b) => sum(b) / b.length);
  const overall = sum(avg) / 12;
  if (overall <= 0) return null;
  const hi = avg.indexOf(Math.max(...avg));
  const lo = avg.indexOf(Math.min(...avg));
  if (avg[lo] <= 0 || avg[hi] / avg[lo] < 1.3) return null;
  const up = Math.round((avg[hi] / overall - 1) * 100);
  const down = Math.round((1 - avg[lo] / overall) * 100);
  const swing = avg[hi] / avg[lo];
  return {
    kind: "seasonality",
    severity: swing >= 2 ? "high" : "medium",
    title: `Revenue peaks in ${MONTHS_LONG[hi]} and bottoms out in ${MONTHS_LONG[lo]}`,
    detail: `Across ${Math.floor(points.length / 12)} years, ${MONTHS_LONG[hi]} runs ${up}% above an average month and ${MONTHS_LONG[lo]} runs ${down}% below it (a ${swing.toFixed(1)}x swing).`,
    question: `${MONTHS_LONG[lo]} is your slowest month. What drives it, and how do you staff and spend through the slow stretch?`,
    from: points[0].month,
    to: points[points.length - 1].month,
  };
}

type Window = { from: string; to: string; rev: number; gp: number; direct: Record<CostType, number> };
function window3(points: MonthPoint[], end: number): Window | null {
  if (end < 2) return null;
  const ws = points.slice(end - 2, end + 1);
  const direct = { labor: 0, materials: 0, subcontractors: 0, other_direct: 0 } as Record<CostType, number>;
  for (const p of ws) for (const k of Object.keys(direct) as CostType[]) direct[k] += p.directByType[k];
  return { from: ws[0].month, to: ws[2].month, rev: sum(ws.map((p) => p.revenue)), gp: sum(ws.map((p) => p.grossProfit)), direct };
}

/**
 * The worst three-month gross margin decline in the last year, against the
 * same three months a year earlier (or the three before, with under two
 * years of history). Flags a drop of 3 points or more.
 */
export function marginDrift(points: MonthPoint[]): Finding | null {
  const lag = points.length >= 15 ? 12 : 3;
  let worst: { cur: Window; prev: Window; delta: number } | null = null;
  for (let end = Math.max(2 + lag, points.length - 12); end < points.length; end++) {
    const cur = window3(points, end);
    const prev = window3(points, end - lag);
    if (!cur || !prev || cur.rev <= 0 || prev.rev <= 0) continue;
    const delta = (cur.gp / cur.rev - prev.gp / prev.rev) * 100;
    if (!worst || delta < worst.delta) worst = { cur, prev, delta };
  }
  if (!worst || worst.delta > -3) return null;
  const { cur, prev, delta } = worst;
  // Which direct cost grew most as a share of revenue.
  let driver: CostType | null = null;
  let driverPts = 0;
  for (const k of Object.keys(cur.direct) as CostType[]) {
    const d = (cur.direct[k] / cur.rev - prev.direct[k] / prev.rev) * 100;
    if (d > driverPts) {
      driverPts = d;
      driver = k;
    }
  }
  const versus = lag === 12 ? "the same months a year earlier" : "the three months before";
  return {
    kind: "margin_drift",
    severity: delta <= -5 ? "high" : "medium",
    title: `Gross margin dropped ${pts(delta)} in ${rangeLabel(cur.from, cur.to)}`,
    detail: `Gross margin was ${((cur.gp / cur.rev) * 100).toFixed(1)}% against ${((prev.gp / prev.rev) * 100).toFixed(1)}% in ${versus}.${
      driver ? ` The biggest mover was ${COST_LABEL[driver]}, up ${pts(driverPts)} of revenue.` : ""
    }`,
    question: `Gross margin dropped ${pts(delta)} in ${rangeLabel(cur.from, cur.to)}${driver ? `, mostly ${COST_LABEL[driver]}` : ""}. What happened?`,
    from: cur.from,
    to: cur.to,
  };
}

/** Days sales outstanding now against a year ago (or the earliest point six or more months back). */
export function arCreep(points: MonthPoint[]): Finding | null {
  const withDso = points.map((p, i) => ({ p, i })).filter((x) => x.p.dso != null);
  if (withDso.length < 7) return null;
  const now = withDso[withDso.length - 1];
  const target = now.i - 12;
  const then = withDso.find((x) => x.i >= target && now.i - x.i >= 6) ?? null;
  if (!then) return null;
  const a = then.p.dso!;
  const b = now.p.dso!;
  const days = b - a;
  if (days < 10 || (a > 0 && b / a < 1.2)) return null;
  return {
    kind: "ar_creep",
    severity: days >= 20 ? "high" : "medium",
    title: `Customers are paying ${Math.round(days)} days slower`,
    detail: `Days sales outstanding went from ${Math.round(a)} in ${monthLabel(then.p.month)} to ${Math.round(b)} in ${monthLabel(now.p.month)}. Receivables stand at ${usd(now.p.ar ?? 0)}.`,
    question: `Customers are taking about ${Math.round(days)} days longer to pay than in ${monthLabel(then.p.month)}. Did terms, billing timing or a big customer change?`,
    from: then.p.month,
    to: now.p.month,
  };
}

/**
 * Step changes in overhead (new fixed cost, the "breakthrough levels").
 *
 * With 24+ months, each candidate month is judged year over year, so costs
 * that simply rise and fall with the busy season (ad spend, seasonal help)
 * don't count: the three months from month i must be up 15%+ on the same
 * months a year earlier, and that growth must be at least 15 points more than
 * the three months before i grew on their own year earlier. With less history
 * it falls back to the three months after against the three before. Either
 * way the step must be at least 2% of average monthly revenue, and still
 * elevated afterwards. Up to three, non-overlapping.
 */
export function overheadJumps(points: MonthPoint[]): Finding[] {
  if (points.length < 9) return [];
  const yoy = points.length >= 24;
  const avgRev = sum(points.map((p) => p.revenue)) / points.length;
  const avg = (from: number, key: (p: MonthPoint) => number) => sum(points.slice(from, from + 3).map(key)) / 3;
  const oh = (p: MonthPoint) => p.overhead;
  const cands: { i: number; before: number; after: number; step: number; ratio: number }[] = [];
  for (let i = yoy ? 15 : 3; i + 2 < points.length; i++) {
    const before = avg(i - 3, oh);
    const after = avg(i, oh);
    if (before <= 0) continue;
    const rest = points.slice(i + 3);
    const held = rest.length === 0 || sum(rest.map(oh)) / rest.length >= before * 1.1;
    if (!held) continue;
    if (yoy) {
      const afterLy = avg(i - 12, oh);
      const beforeLy = avg(i - 15, oh);
      if (afterLy <= 0 || beforeLy <= 0) continue;
      const growthAfter = after / afterLy;
      const growthBefore = before / beforeLy;
      const step = after - afterLy - (before - beforeLy);
      if (growthAfter >= 1.15 && growthAfter - growthBefore >= 0.15 && step >= 0.02 * avgRev) {
        cands.push({ i, before, after, step, ratio: after / before });
      }
    } else if (after / before >= 1.15 && after - before >= 0.02 * avgRev) {
      cands.push({ i, before, after, step: after - before, ratio: after / before });
    }
  }
  cands.sort((x, y) => y.step - x.step);
  const picked: typeof cands = [];
  for (const c of cands) {
    if (picked.every((p) => Math.abs(p.i - c.i) > 3)) picked.push(c);
    if (picked.length === 3) break;
  }
  return picked
    .sort((x, y) => x.i - y.i)
    .map((c) => {
      // Which function stepped up most, judged the same way the step was.
      let fn: OverheadFunction = "finance_admin";
      let fnUp = -Infinity;
      for (const k of Object.keys(FUNCTION_LABEL) as OverheadFunction[]) {
        const f = (p: MonthPoint) => p.overheadByFunction[k];
        const d = yoy ? avg(c.i, f) - avg(c.i - 12, f) - (avg(c.i - 3, f) - avg(c.i - 15, f)) : avg(c.i, f) - avg(c.i - 3, f);
        if (d > fnUp) {
          fnUp = d;
          fn = k;
        }
      }
      const revBefore = avg(c.i - 3, (p) => p.revenue);
      const revAfter = avg(c.i, (p) => p.revenue);
      const revMove = revBefore > 0 ? Math.round((revAfter / revBefore - 1) * 100) : null;
      const start = points[c.i].month;
      return {
        kind: "overhead_jump" as const,
        severity: c.step >= 0.3 * c.before ? ("high" as const) : ("medium" as const),
        title: `Overhead stepped up about ${usd(c.step)} a month from ${monthLabel(start)}`,
        detail: `Average monthly overhead went from ${usd(c.before)} to ${usd(c.after)}, mostly ${FUNCTION_LABEL[fn]}${
          yoy ? ", beyond its usual seasonal swing" : ""
        }.${revMove != null ? ` Revenue over the same months moved ${revMove >= 0 ? "up" : "down"} ${Math.abs(revMove)}%.` : ""}`,
        question: `Overhead jumped in ${monthLabel(start)}, mostly ${FUNCTION_LABEL[fn]}. What was added: a hire, a location, a system? Did revenue follow?`,
        from: start,
        to: points[Math.min(c.i + 2, points.length - 1)].month,
      };
    });
}

// ── The readout ────────────────────────────────────────────────────────────

export function computeReadout(
  history: HistoryAmount[],
  mappings: Map<string, ApprovedMapping>,
  accountNames: Map<string, string> = new Map()
): Readout {
  const months = buildMonths(history, mappings);

  // Coverage: how much activity sits on accounts with no approved mapping (sized with abs, display only).
  const lastMonth = months.length ? months[months.length - 1].month : null;
  let plAll = 0;
  let plOut = 0;
  let bsAll = 0;
  let bsOut = 0;
  const out = new Map<string, number>();
  for (const h of history) {
    const mapped = mappings.has(h.qboAccountId);
    if (h.statement === "pl") {
      plAll += Math.abs(h.amount);
      if (!mapped) {
        plOut += Math.abs(h.amount);
        out.set(h.qboAccountId, (out.get(h.qboAccountId) ?? 0) + Math.abs(h.amount));
      }
    } else if (h.month === lastMonth) {
      bsAll += Math.abs(h.amount);
      if (!mapped) {
        bsOut += Math.abs(h.amount);
        out.set(h.qboAccountId, (out.get(h.qboAccountId) ?? 0) + Math.abs(h.amount));
      }
    }
  }
  const unmappedAccounts = [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => accountNames.get(id) ?? `QuickBooks account ${id}`);

  let scorecard: Readout["scorecard"] = null;
  if (months.length > 0) {
    const last12 = months.slice(-12);
    const prev12 = months.length >= 24 ? months.slice(-24, -12) : null;
    const rev = sum(last12.map((p) => p.revenue));
    const gp = sum(last12.map((p) => p.grossProfit));
    const ebitda = sum(last12.map((p) => p.ebitda));
    const stage = (s: Stage) => pct(sum(last12.map((p) => p.stageCost[s])), rev);
    const prevRev = prev12 ? sum(prev12.map((p) => p.revenue)) : 0;
    scorecard = {
      scope: last12.length === 12 ? "t12" : "ytd",
      months: last12.length,
      from: last12[0].month,
      to: last12[last12.length - 1].month,
      revenue: rev,
      revenueGrowth: prev12 && prevRev > 0 ? (rev / prevRev - 1) * 100 : null,
      grossMargin: pct(gp, rev),
      ebitdaMargin: pct(ebitda, rev),
      deliveryMargin: pct(rev - sum(last12.map((p) => p.stageCost.deliver)), rev),
      stageShare: { attract: stage("attract"), book: stage("book"), convert: stage("convert"), deliver: stage("deliver") },
      dso: last12[last12.length - 1].dso,
    };
  }

  const limits: string[] = [];
  if (months.length > 0 && months.length < 24) limits.push("Seasonality needs 24 months of books.");
  if (months.length > 0 && months.length < 15) {
    limits.push("Margin and overhead changes are compared with the months just before, not a year earlier (that needs 15 months).");
  }
  if (months.length > 0 && months.length < 12) limits.push("The scorecard is year to date; a trailing twelve months needs 12.");

  const findings = [marginDrift(months), arCreep(months), ...overheadJumps(months), seasonality(months)].filter(
    (f): f is Finding => f != null
  );
  const rank = { high: 0, medium: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    months,
    scorecard,
    limits,
    findings,
    coverage: {
      plShareUnmapped: plAll ? (plOut / plAll) * 100 : null,
      bsShareUnmapped: bsAll ? (bsOut / bsAll) * 100 : null,
      unmappedAccounts,
    },
  };
}
