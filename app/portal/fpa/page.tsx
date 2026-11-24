import { getSession, getActiveClient, requireCapability } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader, PortalShell, EmptyState, NoClientState } from "@/components/portal/ui";
import { FpaDashboard } from "@/components/portal/financials/fpa";
import { buildFpaReport, type FpaRawItem } from "@/lib/financials/fpa";
import { loadFinancialItems } from "@/lib/financials/source";
import { DataSourceNote } from "@/components/portal/data-source-note";

export default async function FpaPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const session = await getSession();
  const activeClient = await getActiveClient(clientParam);
  // FP&A is financial detail — same gate as the Financials tab. Enforced before
  // any fetch because the dashboard reads via the service role (bypasses RLS).
  if (activeClient) await requireCapability(activeClient.id, "financials");

  if (!activeClient) {
    return (
      <PortalShell wide>
        <PortalHeader title="FP&A" />
        <div className="mt-8">
          <NoClientState isAdmin={Boolean(session?.isAdmin)} />
        </div>
      </PortalShell>
    );
  }

  // Gated above (requireCapability financials): live QuickBooks history when
  // the client has it, else the month-end uploads.
  const supabase = await createClient();
  const src = await loadFinancialItems(supabase, activeClient.id);
  const raw: FpaRawItem[] = src.items;

  const report = buildFpaReport(raw);
  const hasData = report.months.length > 0;
  const isAdmin = Boolean(session?.isAdmin);

  return (
    <PortalShell wide>
      <PortalHeader
        title="FP&A"
        subtitle={`${activeClient.name} · overhead and cost trends, month over month`}
      />
      <DataSourceNote src={src} isAdmin={isAdmin} clientId={activeClient.id} />
      <div className="mt-8">
        {hasData ? (
          <FpaDashboard report={report} />
        ) : (
          <EmptyState
            title="No financials yet"
            body={
              isAdmin
                ? "Load the month-end (MRP) workbook on the Financials tab to build the FP&A trends."
                : "Your FP&A trends will appear here once your advisor loads your month-end numbers."
            }
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                <path
                  d="M4 19V5m0 14h16M8 14l3-3 3 2 4-6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        )}
      </div>
    </PortalShell>
  );
}
