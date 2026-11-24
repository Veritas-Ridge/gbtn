"use client";

import { useState, useTransition } from "react";
import { publishReadoutAction, unpublishReadoutAction, type VantageActionState } from "@/app/portal/vantage/actions";

const primary =
  "font-label inline-flex items-center justify-center rounded-md bg-gradient-brand px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream ring-soft transition-all hover:brightness-110 disabled:opacity-60";
const danger =
  "rounded-md border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-60";

export type PublishableFinding = { key: string; title: string; severity: "high" | "medium" | "info" };

/**
 * Choose which readout findings the client sees on their Four Pillars page.
 * Sends only keys and a note; the server recomputes the findings and stores
 * a snapshot, so later refreshes never change what the client was shown.
 */
export function PublishPanel({
  clientId,
  clientName,
  findings,
  current,
}: {
  clientId: string;
  clientName: string;
  findings: PublishableFinding[];
  current: { count: number; publishedAt: string; note: string | null } | null;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(findings.filter((f) => f.severity === "high").map((f) => f.key)));
  const [note, setNote] = useState(current?.note ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<VantageActionState>({});
  const toggle = (k: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const when = current ? new Date(current.publishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
      <p className="text-sm font-semibold text-ink">Share with {clientName}</p>
      <p className="mt-1 text-sm text-muted">
        {current
          ? `Their Four Pillars page shows ${current.count} finding${current.count === 1 ? "" : "s"} you published ${when}. Publishing again replaces it.`
          : "Nothing is shared yet. Pick the findings the client should see on their Four Pillars page, as they read now."}
      </p>

      {findings.length ? (
        <ul className="mt-4 space-y-2">
          {findings.map((f) => (
            <li key={f.key}>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
                <input type="checkbox" className="mt-0.5 accent-brand-700" checked={picked.has(f.key)} onChange={() => toggle(f.key)} />
                <span>{f.title}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No findings this time; you can still share a note.</p>
      )}

      <label className="mt-4 block text-sm font-medium text-ink" htmlFor="publish-note">
        Note to the client <span className="font-normal text-muted-soft">(optional)</span>
      </label>
      <textarea
        id="publish-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-navy-2 focus:outline-none focus:ring-2 focus:ring-brand-100"
        placeholder="A line on what to look at before our next meeting."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={primary}
          disabled={pending || (picked.size === 0 && !note.trim())}
          onClick={() => start(async () => setResult(await publishReadoutAction({ clientId, keys: [...picked], note })))}
        >
          {pending ? "Publishing…" : `Publish ${picked.size} to client`}
        </button>
        {current ? (
          <button
            type="button"
            className={danger}
            disabled={pending}
            onClick={() => {
              if (confirm("Take the readout down from the client's portal?")) start(async () => setResult(await unpublishReadoutAction(clientId)));
            }}
          >
            Take down
          </button>
        ) : null}
      </div>
      {result.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}
      {result.message ? <p className="mt-3 text-sm text-emerald-700">{result.message}</p> : null}
    </div>
  );
}
