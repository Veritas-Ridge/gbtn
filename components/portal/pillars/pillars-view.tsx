import { money, percent } from "@/lib/financials/metrics";
import { STAGE_ORDER, type PillarsReport } from "@/lib/financials/pillars";
import { PILLARS } from "@/lib/gut-check";

/**
 * The client's Four Pillars: cost of each stage over the last twelve months
 * (or year to date), its share of revenue and direction, then month by month.
 * Server component. Text stays in ink tokens; direction is said in words.
 */

const VOLUME_METRIC: Record<string, string | null> = {
  attract: "Cost per lead",
  book: "Booking rate",
  convert: "Close rate",
  deliver: null,
};

function Trend({ pts }: { pts: number | null }) {
  if (pts == null || Math.abs(pts) < 0.5) return <span className="text-xs text-muted">Steady vs the 3 months before</span>;
  return (
    <span className="text-xs text-muted">
      <span aria-hidden className="font-semibold text-ink">{pts > 0 ? "↑" : "↓"}</span> {pts > 0 ? "Up" : "Down"}{" "}
      {Math.abs(pts).toFixed(1)} points of revenue vs the 3 months before
    </span>
  );
}

export function PillarsView({ report }: { report: PillarsReport }) {
  const window = report.scope === "t12" ? "Last 12 months" : `${report.monthsCovered} month${report.monthsCovered === 1 ? "" : "s"} so far`;
  const recent = report.months.slice(-12).reverse();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {window}, {report.from === report.to ? report.from : `${report.from} to ${report.to}`}. Revenue {money(report.revenue)}.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PILLARS.map((p, i) => {
          const s = STAGE_ORDER[i];
          const volume = VOLUME_METRIC[s];
          return (
            <div key={p.key} className="flex flex-col rounded-2xl border border-line bg-white p-5 ring-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-crimson">Pillar {i + 1}</p>
              <p className="mt-1 text-lg font-bold tracking-tight text-ink">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">What it costs</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">{money(report.cost[s])}</p>
                <p className="text-sm text-muted tabular-nums">{percent(report.share[s])} of revenue</p>
                <div className="mt-1">
                  <Trend pts={report.trend[s]} />
                </div>
              </div>
              <div className="mt-auto pt-4">
                {s === "deliver" ? (
                  <p className="text-sm text-ink">
                    <span className="font-semibold">Delivery margin {percent(report.deliveryMargin)}</span>
                    <span className="block text-xs text-muted">Revenue left after every cost of doing the work.</span>
                  </p>
                ) : volume ? (
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-ink">{volume}</span> arrives when your CRM and phone system are connected.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        Company overhead (finance, admin, office, insurance) is {money(report.companyOverhead)}, {percent(report.companyShare)} of
        revenue. It supports every pillar, so it isn&apos;t charged to one.
      </p>

      <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
        <p className="text-sm font-semibold text-ink">Month by month</p>
        <p className="mt-1 text-xs text-muted">Each pillar&apos;s cost, with its share of that month&apos;s revenue underneath.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-right text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
                <th className="pb-2 text-left">Month</th>
                <th className="pb-2">Revenue</th>
                {PILLARS.map((p) => (
                  <th key={p.key} className="pb-2">
                    {p.name}
                  </th>
                ))}
                <th className="pb-2">Delivery margin</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.end} className="border-t border-line align-top text-ink">
                  <td className="py-2 text-left">{m.label}</td>
                  <td className="py-2">{money(m.revenue)}</td>
                  {STAGE_ORDER.map((s) => (
                    <td key={s} className="py-2">
                      {money(m.cost[s])}
                      <span className="block text-xs text-muted">{percent(m.share[s])}</span>
                    </td>
                  ))}
                  <td className="py-2">{percent(m.deliveryMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {report.byServiceLine ? (
        <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
          <p className="text-sm font-semibold text-ink">By service line</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-right text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
                  <th className="pb-2 text-left">Service line</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">Direct costs</th>
                  <th className="pb-2">Gross margin</th>
                </tr>
              </thead>
              <tbody>
                {report.byServiceLine.map(({ line, result }) => (
                  <tr key={line} className="border-t border-line text-ink">
                    <td className="py-2 text-left capitalize">{line === "unassigned" ? "Not assigned" : line}</td>
                    <td className="py-2">{money(result.revenue)}</td>
                    <td className="py-2">{money(result.directCost)}</td>
                    <td className="py-2">{percent(result.grossMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
