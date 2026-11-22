"use client";

import { useState, useTransition } from "react";
import { pullHistoryAction, type VantageActionState } from "@/app/portal/vantage/actions";

const btn =
  "font-label inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cream transition-all hover:bg-ink-soft disabled:opacity-60";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : null;

/** The "Pull history" control. Reads QuickBooks only; replaces the stored months for the range. */
export function HistoryPanel({
  clientId,
  syncedAt,
  pending: approvalsPending,
}: {
  clientId: string;
  syncedAt: string | null;
  /** Mappings still waiting for approval; they're left out of the readout. */
  pending: number;
}) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<VantageActionState>({});
  return (
    <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">History</p>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {syncedAt
              ? `Last pulled ${when(syncedAt)}. Pull again after month end, or after fixing mappings, to refresh the readout.`
              : "Pull 36 months of month-by-month P&L and balance sheet from QuickBooks to build the readout. Takes about half a minute."}
            {approvalsPending > 0 ? ` ${approvalsPending} mappings still need approval and are left out until approved.` : ""}
          </p>
        </div>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => start(async () => setResult(await pullHistoryAction(clientId)))}
        >
          {busy ? "Pulling from QuickBooks…" : syncedAt ? "Pull again" : "Pull 36 months"}
        </button>
      </div>
      {result.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}
      {result.message ? <p className="mt-3 text-sm text-emerald-700">{result.message}</p> : null}
    </div>
  );
}
