import { getActiveClient, requireCapability } from "@/lib/auth";
import { PortalHeader, PortalShell, NoClientState } from "@/components/portal/ui";
import { ConnectionPanel } from "@/components/portal/vantage/connection-panel";
import { MappingQueue } from "@/components/portal/vantage/mapping-queue";
import { HistoryPanel } from "@/components/portal/vantage/history-panel";
import { ReadoutView } from "@/components/portal/vantage/readout";
import { PublishPanel } from "@/components/portal/vantage/publish-panel";
import { getPublication } from "@/lib/vantage/publish";
import { findingKey } from "@/lib/vantage/analysis";
import { qboConfigured } from "@/lib/vantage/qbo/config";
import { getConnectionSummary, getReadout, listMappings } from "@/lib/vantage/service";

// The history pull (a server action posted from this page) makes up to six
// QuickBooks report calls, and Intuit can be slow: MarcorSEN's first 36 month
// pull hit a 60 second limit on 2026-11-24. Same ceiling as the nightly cron.
export const maxDuration = 300;

/**
 * Vantage: connect a client's QuickBooks (read only) and map its chart of
 * accounts onto the GBTN standard.
 *
 * Gate first, fetch second. The page is open to GBTN admins and to the
 * client's own admins (manage_users), who can connect and disconnect. The
 * mapping queue is GBTN-internal analyst work: rendered only for platform
 * admins, and every mapping action re-asserts assertAdmin.
 */

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "QuickBooks connected. The chart of accounts is synced and mapping suggestions are ready." },
  cancelled: { tone: "warn", text: "QuickBooks sign-in was cancelled. Nothing changed." },
  expired: { tone: "warn", text: "That QuickBooks sign-in expired or didn't start here. Try Connect again." },
  not_configured: { tone: "warn", text: "QuickBooks isn't configured on this deployment yet." },
  error: { tone: "warn", text: "QuickBooks connection failed." },
};

export default async function VantagePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; qbo?: string; message?: string }>;
}) {
  const sp = await searchParams;
  // getActiveClient falls back to the first accessible client when ?client=
  // isn't one this user can see, so everything below uses client.id, never sp.client.
  const client = await getActiveClient(sp.client);
  if (!client) {
    return (
      <PortalShell>
        <NoClientState isAdmin={false} />
      </PortalShell>
    );
  }
  const session = await requireCapability(client.id, "manage_users");

  const [connection, rows, readout, publication] = await Promise.all([
    getConnectionSummary(client.id),
    session.isAdmin ? listMappings(client.id) : Promise.resolve([]),
    session.isAdmin ? getReadout(client.id) : Promise.resolve(null),
    session.isAdmin ? getPublication(client.id) : Promise.resolve(null),
  ]);
  const awaitingApproval = rows.filter((r) => r.status !== "approved").length;
  const notice = sp.qbo ? NOTICES[sp.qbo] : undefined;

  return (
    <PortalShell>
      <PortalHeader
        title="Vantage"
        subtitle={`${client.name}: QuickBooks connection${session.isAdmin ? " and account mapping" : ""}.`}
      />
      <div className="mt-6 space-y-6">
        {notice ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {notice.text}
            {sp.qbo === "error" && sp.message ? ` ${sp.message.slice(0, 200)}` : ""}
          </p>
        ) : null}

        <ConnectionPanel
          clientId={client.id}
          clientName={client.name}
          configured={qboConfigured()}
          connection={
            connection
              ? {
                  companyName: connection.companyName,
                  realmId: connection.realmId,
                  environment: connection.environment,
                  connected: connection.connected,
                  lastSyncedAt: connection.lastSyncedAt,
                  disconnectedAt: connection.disconnectedAt,
                }
              : null
          }
        />

        {session.isAdmin && connection?.connected ? (
          <HistoryPanel clientId={client.id} syncedAt={connection.historySyncedAt} pending={awaitingApproval} />
        ) : null}
        {session.isAdmin && connection && readout ? (
          <ReadoutView readout={readout} historyFrom={connection.historyFrom} historyTo={connection.historyTo} />
        ) : null}
        {session.isAdmin && connection && readout ? (
          <PublishPanel
            clientId={client.id}
            clientName={client.name}
            findings={readout.findings.map((f) => ({ key: findingKey(f), title: f.title, severity: f.severity }))}
            current={
              publication ? { count: publication.findings.length, publishedAt: publication.publishedAt, note: publication.note } : null
            }
          />
        ) : null}

        {session.isAdmin && connection ? <MappingQueue clientId={client.id} rows={rows} /> : null}
      </div>
    </PortalShell>
  );
}
