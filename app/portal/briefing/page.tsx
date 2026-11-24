import { getSession, getActiveClient, requireCapability } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalHeader, PortalShell, EmptyState, NoClientState } from "@/components/portal/ui";
import { Briefing } from "@/components/portal/briefing/briefing";
import { buildBridge } from "@/lib/briefing/bridge";
import type { FpaRawItem } from "@/lib/financials/fpa";
import { loadFinancialItems } from "@/lib/financials/source";
import { DataSourceNote } from "@/components/portal/data-source-note";
import { listOrderLines } from "@/lib/ops/service";
import { fmtDate } from "@/lib/ops/format";

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const session = await getSession();
  const activeClient = await getActiveClient(clientParam);
  // Same gate as Financials — this joins the P&L to operations.
  if (activeClient) await requireCapability(activeClient.id, "financials");

  if (!activeClient) {
    return (
      <PortalShell wide>
        <PortalHeader title="CFO Briefing" />
        <div className="mt-8">
          <NoClientState isAdmin={Boolean(session?.isAdmin)} />
        </div>
      </PortalShell>
    );
  }

  // Gated above (requireCapability financials): live QuickBooks history when
  // the client has it, else the month-end uploads.
  const supabase = await createClient();
  const [src, ops] = await Promise.all([loadFinancialItems(supabase, activeClient.id), listOrderLines(activeClient.id)]);
  const fin: FpaRawItem[] = src.items;

  const report = buildBridge(ops, fin);

  // Latest cached AI briefing (read via service role — the requireCapability
  // gate above is the real check, and a platform admin may not be a member).
  const { data: summary } = await createAdminClient()
    .from("ai_summaries")
    .select("content, model, generated_at")
    .eq("client_id", activeClient.id)
    .eq("kind", "cfo_briefing")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The financials' latest month, for the "two clocks" caption.
  const finThrough = src.through;

  return (
    <PortalShell wide>
      <PortalHeader
        title="CFO Briefing"
        subtitle={`${activeClient.name} · operations and financials, joined`}
      />
      <DataSourceNote src={src} isAdmin={Boolean(session?.isAdmin)} clientId={activeClient.id} />
      <div className="mt-8">
        {report.hasFin && report.hasOps ? (
          <Briefing
            report={report}
            opsAsOf={report.asOf ? fmtDate(report.asOf) : null}
            finThrough={finThrough}
            clientId={activeClient.id}
            isAdmin={Boolean(session?.isAdmin)}
            aiSummary={
              summary
                ? { content: summary.content, model: summary.model, generatedAt: summary.generated_at }
                : null
            }
          />
        ) : (
          <EmptyState
            title={report.hasFin ? "No operations data yet" : "No financials yet"}
            body={
              report.hasFin
                ? "The briefing joins your P&L to the RFMS orders pipeline. Import an Orders export on Ops Reports to light up the operations side."
                : "Load the month-end (MRP) workbook on the Financials tab, and import the RFMS orders on Ops Reports, to build the briefing."
            }
            icon={
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                <path d="M4 19V5m0 14h16M8 13l3 3 3-6 3 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        )}
      </div>
    </PortalShell>
  );
}
