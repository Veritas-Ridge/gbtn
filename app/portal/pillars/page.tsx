import Link from "next/link";
import { getSession, getActiveClient, requireCapability } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader, PortalShell, EmptyState, NoClientState } from "@/components/portal/ui";
import { DataSourceNote } from "@/components/portal/data-source-note";
import { PillarsView } from "@/components/portal/pillars/pillars-view";
import { loadFinancialItems } from "@/lib/financials/source";
import { buildPillars } from "@/lib/financials/pillars";
import { getPublication } from "@/lib/vantage/publish";
import { PublishedReadout } from "@/components/portal/pillars/published-readout";

/**
 * Four Pillars: what Attract, Book, Convert and Deliver cost, from the
 * client's mapped QuickBooks history. Same gate as Financials: gate first,
 * fetch second (the loader reads Vantage tables with the service role).
 */
export default async function PillarsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: clientParam } = await searchParams;
  const session = await getSession();
  const activeClient = await getActiveClient(clientParam);
  if (activeClient) await requireCapability(activeClient.id, "financials");

  if (!activeClient) {
    return (
      <PortalShell wide>
        <PortalHeader title="Four Pillars" />
        <div className="mt-8">
          <NoClientState isAdmin={Boolean(session?.isAdmin)} />
        </div>
      </PortalShell>
    );
  }

  const supabase = await createClient();
  // Both read with the service role, after the requireCapability gate above.
  const [src, publication] = await Promise.all([loadFinancialItems(supabase, activeClient.id), getPublication(activeClient.id)]);
  const report = src.source === "quickbooks" ? buildPillars(src.items) : null;
  const isAdmin = Boolean(session?.isAdmin);

  return (
    <PortalShell wide>
      <PortalHeader title="Four Pillars" subtitle={`${activeClient.name} · what each stage of the business costs`} />
      {report ? <DataSourceNote src={src} isAdmin={isAdmin} clientId={activeClient.id} /> : null}
      <div className="mt-8 space-y-6">
        {publication ? <PublishedReadout pub={publication} /> : null}
        {report ? (
          <PillarsView report={report} />
        ) : (
          <EmptyState
            title="Four Pillars needs QuickBooks"
            body={
              isAdmin
                ? "Connect this client's QuickBooks in Vantage, approve the account mapping and pull history; this page fills in from there."
                : "Your Four Pillars scorecard appears once your books are connected. Tyler will set it up with you."
            }
          />
        )}
        {!report && isAdmin ? (
          <p className="mt-4 text-center text-sm">
            <Link href={`/portal/vantage?client=${activeClient.id}`} className="font-medium text-brand-700 underline-offset-4 hover:underline">
              Open Vantage for {activeClient.name}
            </Link>
          </p>
        ) : null}
      </div>
    </PortalShell>
  );
}
