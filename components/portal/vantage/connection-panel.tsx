"use client";

import { useState, useTransition } from "react";
import {
  disconnectAction,
  syncAccountsAction,
  type VantageActionState,
} from "@/app/portal/vantage/actions";

const primary =
  "font-label inline-flex items-center justify-center rounded-md bg-gradient-brand px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream ring-soft transition-all hover:brightness-110 disabled:opacity-60";
const secondary =
  "font-label inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cream transition-all hover:bg-ink-soft disabled:opacity-60";
const danger =
  "rounded-md border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60";

export type ConnectionView = {
  companyName: string | null;
  realmId: string;
  environment: "sandbox" | "production";
  connected: boolean;
  lastSyncedAt: string | null;
  disconnectedAt: string | null;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "never";

export function ConnectionPanel({
  clientId,
  clientName,
  connection,
  configured,
}: {
  clientId: string;
  clientName: string;
  connection: ConnectionView | null;
  configured: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<VantageActionState>({});
  const connectHref = `/api/vantage/qbo/connect?client=${encodeURIComponent(clientId)}`;
  const run = (fn: () => Promise<VantageActionState>) => start(async () => setResult(await fn()));

  return (
    <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">QuickBooks Online</p>
          {connection?.connected ? (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected, read only
                </span>
                <span>{connection.companyName ?? `Company ${connection.realmId}`}</span>
                {connection.environment === "sandbox" ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Sandbox</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-soft">Chart of accounts last synced {when(connection.lastSyncedAt)}.</p>
            </>
          ) : connection ? (
            <p className="mt-1 text-sm text-muted">
              Disconnected {when(connection.disconnectedAt)}. Mappings are kept; reconnect to sync again.
            </p>
          ) : (
            <p className="mt-1 max-w-xl text-sm text-muted">
              Connect {clientName}&apos;s QuickBooks so Vantage can read the chart of accounts. Access is read only:
              nothing in the books is ever created, changed or deleted.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!configured ? (
            <span className="font-label cursor-not-allowed rounded-md border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-soft">
              QuickBooks not configured
            </span>
          ) : connection?.connected ? (
            <>
              <button type="button" className={secondary} disabled={pending} onClick={() => run(() => syncAccountsAction(clientId))}>
                {pending ? "Working…" : "Sync accounts"}
              </button>
              <button
                type="button"
                className={danger}
                disabled={pending}
                onClick={() => {
                  if (confirm("Disconnect QuickBooks? Vantage stops reading the books until it's connected again.")) {
                    run(() => disconnectAction(clientId));
                  }
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <a href={connectHref} className={primary}>
              {connection ? "Reconnect QuickBooks" : "Connect QuickBooks"}
            </a>
          )}
        </div>
      </div>
      {result.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}
      {result.message ? <p className="mt-3 text-sm text-emerald-700">{result.message}</p> : null}
    </div>
  );
}
