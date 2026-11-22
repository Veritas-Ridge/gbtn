// The Gut Check scorecard: the numbers behind each of the four pillars, plus
// the company scoreboard they add up to. Read by /metrics and /metrics/print.
// Pillar names and one-liners come from lib/gut-check.ts so they never drift.

import { PILLARS, type PillarKey } from "./gut-check";

type Metric = { name: string; why: string };

export type MetricGroup = {
  key: PillarKey | "scoreboard";
  label: string;
  intro: string;
  metrics: readonly Metric[];
};

const byPillar: Record<PillarKey, readonly Metric[]> = {
  attract: [
    {
      name: "Cost per lead",
      why: "Marketing spend divided by new leads, by channel. Rising cost per lead with flat volume means a channel is tapped out. If you can't name this number, you can't tell a good month from an expensive one.",
    },
    {
      name: "Customer concentration %",
      why: "One builder, one property manager or one channel at 20%+ of revenue is a valuation haircut waiting to happen. Widen the top of the funnel before you need the multiple.",
    },
  ],
  book: [
    {
      name: "Booking rate",
      why: "Leads that reach a scheduled appointment, call or scoping meeting. The cheapest growth in the business, because you already paid for the lead.",
    },
    {
      name: "Speed to book",
      why: "Hours from first contact to a booked next step. Leads go cold by the hour, and slow callbacks quietly double your real cost per lead.",
    },
  ],
  convert: [
    {
      name: "Close rate",
      why: "Booked opportunities that sign or pay. Track it by salesperson and by service line. The gap between your best and worst closer is usually the biggest number on the page.",
    },
    {
      name: "Average ticket",
      why: "Revenue per sale. When close rate holds but the ticket shrinks, pricing discipline or the offer mix is slipping.",
    },
  ],
  deliver: [
    {
      name: "Gross margin %",
      why: "This is where job costing lives: labor, materials and the trucks. If it drifts, crews are slow, tickets are underpriced, or the mix shifted to low margin work.",
    },
    {
      name: "Billable utilization %",
      why: "Tech hours on the job against paid hours. Every point of idle time is a truck you already paid for. Utilization is the first place scale breaks.",
    },
    {
      name: "Revenue per employee",
      why: "The leverage test. If revenue is up and this is flat, you added headcount as a crutch. Businesses that compound keep it rising through the growth years.",
    },
  ],
};

export const metricGroups: readonly MetricGroup[] = [
  ...PILLARS.map((p) => ({
    key: p.key,
    label: p.name,
    intro: p.body,
    metrics: byPillar[p.key],
  })),
  {
    key: "scoreboard",
    label: "The scoreboard",
    intro: "What the four pillars add up to.",
    metrics: [
      {
        name: "Revenue growth rate",
        why: "Organic growth the P&L can absorb. A spike from one commercial account or a price war is not a system. Buyers pay for repeatable, mix healthy growth.",
      },
      {
        name: "EBITDA margin %",
        why: "The score after overhead. Service businesses die on dispatch bloat, warranty and hiring their way out of chaos. EBITDA is what lenders and buyers underwrite.",
      },
      {
        name: "Cash conversion cycle",
        why: "DSO plus inventory and WIP, minus DPO. Trades get crushed when AR and inventory grow faster than collections. Growth that eats cash is not growth a lender will fund.",
      },
    ],
  },
];

export const metricCount = metricGroups.reduce((n, g) => n + g.metrics.length, 0);
