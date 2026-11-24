import type { FinancialSource } from "@/lib/financials/source";

/** One line under a financial page header saying where the numbers come from and how fresh they are. */
export function DataSourceNote({ src, isAdmin, clientId }: { src: FinancialSource; isAdmin: boolean; clientId: string }) {
  if (src.items.length === 0) return null;
  const asOf = src.asOf
    ? new Date(src.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })
    : null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {src.source === "quickbooks" ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Live from QuickBooks
          </span>
          <span>
            Through {src.through}
            {asOf ? `, refreshed ${asOf}` : ""}.
          </span>
          {isAdmin && src.unmappedAccounts > 0 ? (
            <a href={`/portal/vantage?client=${clientId}`} className="font-semibold text-amber-700 underline-offset-4 hover:underline">
              {src.unmappedAccounts} account{src.unmappedAccounts === 1 ? "" : "s"} with activity not yet mapped
            </a>
          ) : null}
        </>
      ) : (
        <span>From month-end uploads{src.through ? `, through ${src.through}` : ""}.</span>
      )}
    </p>
  );
}
