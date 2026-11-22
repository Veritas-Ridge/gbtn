import { money, percent } from "@/lib/financials/metrics";
import { monthLabel, rangeLabel, type Finding, type Readout } from "@/lib/vantage/analysis";

/**
 * The Vantage readout: trailing-twelve-month scorecard, findings with the
 * validation questions for the readout meeting, and the monthly trend as a
 * table. Server component; renders only what computeReadout produced.
 */

const SEVERITY: Record<Finding["severity"], { label: string; tone: string; icon: string }> = {
  high: { label: "Worth asking first", tone: "border-red-200 bg-red-50 text-red-800", icon: "!" },
  medium: { label: "Worth asking", tone: "border-amber-200 bg-amber-50 text-amber-800", icon: "?" },
  info: { label: "For context", tone: "border-line bg-paper-soft text-muted", icon: "i" },
};

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

const days = (n: number | null) => (n == null ? "—" : `${Math.round(n)} days`);

export function ReadoutView({ readout, historyFrom, historyTo }: { readout: Readout; historyFrom: string | null; historyTo: string | null }) {
  const { t12, findings, coverage, months } = readout;
  const recent = months.slice(-12).reverse();
  const coverageWarn = (coverage.plShareUnmapped ?? 0) >= 1 || (coverage.bsShareUnmapped ?? 0) >= 1;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-sm font-semibold text-ink">Readout</p>
          <p className="text-xs text-muted-soft">
            {historyFrom && historyTo ? `History ${rangeLabel(historyFrom.slice(0, 7), historyTo.slice(0, 7))}` : null}
            {t12 ? ` · Scorecard is the last 12 months, ${rangeLabel(t12.from, t12.to)}` : ""}
          </p>
        </div>

        {t12 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Tile
              label="Revenue"
              value={money(t12.revenue)}
              note={t12.revenueGrowth != null ? `${t12.revenueGrowth >= 0 ? "Up" : "Down"} ${Math.abs(t12.revenueGrowth).toFixed(1)}% on the year before` : undefined}
            />
            <Tile label="Gross margin" value={percent(t12.grossMargin)} />
            <Tile label="Delivery margin" value={percent(t12.deliveryMargin)} note="After all Deliver costs" />
            <Tile label="EBITDA margin" value={percent(t12.ebitdaMargin)} />
            <Tile label="Attract cost" value={percent(t12.stageShare.attract)} note="Of revenue" />
            <Tile label="Days to collect" value={days(t12.dso)} note={`As of ${monthLabel(t12.to)}`} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Pull at least 12 months to see the scorecard.</p>
        )}

        {coverageWarn ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Not yet in the numbers:{" "}
            {[
              (coverage.plShareUnmapped ?? 0) >= 0.05 ? `${percent(coverage.plShareUnmapped, 1)} of P&L activity` : null,
              (coverage.bsShareUnmapped ?? 0) >= 0.05 ? `${percent(coverage.bsShareUnmapped, 1)} of balances` : null,
            ]
              .filter(Boolean)
              .join(" and ")}{" "}
            {(coverage.plShareUnmapped ?? 0) >= 0.05 && (coverage.bsShareUnmapped ?? 0) >= 0.05 ? "sit" : "sits"} on accounts without an approved mapping
            {coverage.unmappedAccounts.length ? ` (${coverage.unmappedAccounts.slice(0, 4).join(", ")})` : ""}. Approve them
            in Account mapping to include them.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
        <p className="text-sm font-semibold text-ink">What the books say</p>
        <p className="mt-1 text-sm text-muted">Patterns found in the history, each with the question to ask in the readout meeting.</p>
        {findings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No seasonality, margin drift, slower collections or overhead jumps cleared the thresholds. Steady books.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {findings.map((f, i) => {
              const s = SEVERITY[f.severity];
              return (
                <li key={`${f.kind}-${f.from}-${i}`} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>
                      <span aria-hidden className="font-bold">{s.icon}</span>
                      {s.label}
                    </span>
                    <span className="text-xs text-muted-soft">{rangeLabel(f.from, f.to)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{f.title}</p>
                  <p className="mt-1 text-sm text-muted">{f.detail}</p>
                  <p className="mt-2 border-l-2 border-crimson pl-3 text-sm text-ink">
                    <span className="font-semibold">Ask:</span> {f.question}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {recent.length > 0 ? (
        <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
          <p className="text-sm font-semibold text-ink">Last {recent.length} months</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-right text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
                  <th className="pb-2 text-left">Month</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">Gross margin</th>
                  <th className="pb-2">EBITDA margin</th>
                  <th className="pb-2">Overhead</th>
                  <th className="pb-2">Receivables</th>
                  <th className="pb-2">Days to collect</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.month} className="border-t border-line text-ink">
                    <td className="py-2 text-left">{monthLabel(m.month)}</td>
                    <td className="py-2">{money(m.revenue)}</td>
                    <td className="py-2">{percent(m.grossMargin)}</td>
                    <td className="py-2">{percent(m.ebitdaMargin)}</td>
                    <td className="py-2">{money(m.overhead)}</td>
                    <td className="py-2">{money(m.ar)}</td>
                    <td className="py-2">{days(m.dso)}</td>
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
