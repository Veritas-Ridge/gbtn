"use client";

import { useMemo, useState, useTransition } from "react";
import {
  SECTIONS,
  STANDARD_ACCOUNTS,
  sectionFor,
  standardAccount,
  type StandardAccount,
} from "@/lib/financials/standard-coa";
import { CONFIDENT, fitsStatement, statementOf } from "@/lib/vantage/mapping/rules";
import type { MappingRow } from "@/lib/vantage/service";
import {
  approveConfidentAction,
  approveMappingAction,
  suggestWithAiAction,
  type VantageActionState,
} from "@/app/portal/vantage/actions";

const field =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-navy-2 focus:outline-none focus:ring-2 focus:ring-brand-100";
const smallBtn =
  "font-label inline-flex items-center justify-center rounded-md bg-ink px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream transition-all hover:bg-ink-soft disabled:opacity-60";
const barBtn =
  "font-label inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-navy-2 disabled:opacity-60";

type Filter = "review" | "waiting" | "approved" | "all";

const STAGE_LABEL: Record<string, string> = { attract: "Attract", book: "Book", convert: "Convert", deliver: "Deliver" };

/** Standard accounts this QuickBooks account may map to, grouped by section for the picker. */
function pickerFor(accountType: string | null): { label: string; accounts: StandardAccount[] }[] {
  const statement = statementOf(accountType);
  return SECTIONS.filter((s) => s.statement === statement)
    .map((s) => ({
      label: s.label,
      accounts: STANDARD_ACCOUNTS.filter((a) => sectionFor(a)?.key === s.key && fitsStatement(a.key, accountType)),
    }))
    .filter((g) => g.accounts.length > 0);
}

function needsReview(r: MappingRow) {
  return r.status !== "approved" && (r.confidence ?? 0) < CONFIDENT;
}

function Confidence({ row }: { row: MappingRow }) {
  if (row.confidence == null) return null;
  const sure = row.confidence >= CONFIDENT;
  const tone = row.status === "approved" ? "bg-emerald-50 text-emerald-700" : sure ? "bg-paper-soft text-muted" : "bg-amber-50 text-amber-700";
  const by = row.method === "ai" ? "AI" : row.method === "analyst" ? "Analyst" : "Rule";
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {by} · {Math.round(row.confidence * 100)}%
    </span>
  );
}

function Row({ clientId, row }: { clientId: string; row: MappingRow }) {
  const [account, setAccount] = useState(row.standardAccount ?? "");
  const [serviceLine, setServiceLine] = useState(row.serviceLine ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const std = standardAccount(account);
  const dirty = account !== (row.standardAccount ?? "") || serviceLine !== (row.serviceLine ?? "");
  const approved = row.status === "approved" && !dirty;

  return (
    <tr className={`border-t border-line align-top ${needsReview(row) ? "bg-amber-50/30" : ""}`}>
      <td className="py-3 pr-3">
        <p className="text-sm font-medium text-ink">
          {row.acctNum ? <span className="text-muted-soft">{row.acctNum} · </span> : null}
          {row.fullyQualifiedName ?? row.name}
          {!row.active ? <span className="ml-2 text-[11px] font-semibold text-muted-soft">inactive</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-soft">
          {row.accountType ?? "Unknown type"}
          {row.accountSubtype ? ` · ${row.accountSubtype}` : ""}
        </p>
      </td>
      <td className="min-w-[16rem] py-3 pr-3">
        <select className={field} value={account} onChange={(e) => setAccount(e.target.value)} aria-label={`Standard account for ${row.name}`}>
          {!account ? <option value="">Choose…</option> : null}
          {pickerFor(row.accountType).map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.accounts.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.code} {a.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-soft">
          {std?.stage ? `Funds ${STAGE_LABEL[std.stage]}` : std?.role === "overhead" ? "Company level" : null}
          {std?.costType ? ` · ${std.costType.replace("_", " ")}` : null}
        </p>
        {std?.byServiceLine ? (
          <input
            className={`${field} mt-1.5`}
            value={serviceLine}
            onChange={(e) => setServiceLine(e.target.value)}
            placeholder="Service line (optional), e.g. install"
            aria-label={`Service line for ${row.name}`}
          />
        ) : null}
      </td>
      <td className="py-3 pr-3">
        <Confidence row={row} />
        {row.rationale ? <p className="mt-1 max-w-xs text-xs text-muted">{row.rationale}</p> : null}
      </td>
      <td className="py-3 text-right">
        {approved ? (
          <span className="text-xs font-semibold text-emerald-700">Approved</span>
        ) : (
          <button
            type="button"
            className={smallBtn}
            disabled={pending || !account}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await approveMappingAction({ clientId, qboAccountId: row.qboAccountId, standardAccount: account, serviceLine });
                if (r.error) setError(r.error);
              })
            }
          >
            {pending ? "Saving…" : row.status === "approved" ? "Save" : "Approve"}
          </button>
        )}
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </td>
    </tr>
  );
}

export function MappingQueue({ clientId, rows }: { clientId: string; rows: MappingRow[] }) {
  const counts = useMemo(
    () => ({
      all: rows.length,
      approved: rows.filter((r) => r.status === "approved").length,
      review: rows.filter(needsReview).length,
      waiting: rows.filter((r) => r.status !== "approved").length,
      confident: rows.filter((r) => r.status !== "approved" && (r.confidence ?? 0) >= CONFIDENT).length,
      unsureRule: rows.filter((r) => r.status !== "approved" && r.method === "rule" && (r.confidence ?? 0) < CONFIDENT).length,
    }),
    [rows]
  );
  const [filter, setFilter] = useState<Filter>(counts.review > 0 ? "review" : counts.waiting > 0 ? "waiting" : "all");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<VantageActionState>({});
  const run = (fn: () => Promise<VantageActionState>) => start(async () => setResult(await fn()));

  const shown = rows.filter((r) =>
    filter === "review" ? needsReview(r) : filter === "waiting" ? r.status !== "approved" : filter === "approved" ? r.status === "approved" : true
  );
  const tabs: [Filter, string, number][] = [
    ["review", "Needs review", counts.review],
    ["waiting", "Not yet approved", counts.waiting],
    ["approved", "Approved", counts.approved],
    ["all", "All", counts.all],
  ];

  return (
    <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Account mapping</p>
          <p className="mt-1 text-sm text-muted">
            {counts.approved} of {counts.all} approved. Each QuickBooks account maps to one GBTN standard account; an analyst
            approves every mapping once, then new accounts are suggested automatically on each sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={barBtn} disabled={pending || counts.unsureRule === 0} onClick={() => run(() => suggestWithAiAction(clientId))}>
            Ask AI about {counts.unsureRule} unsure
          </button>
          <button type="button" className={barBtn} disabled={pending || counts.confident === 0} onClick={() => run(() => approveConfidentAction(clientId))}>
            Approve {counts.confident} confident
          </button>
        </div>
      </div>
      {pending ? <p className="mt-3 text-sm text-muted">Working…</p> : null}
      {result.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}
      {result.message ? <p className="mt-3 text-sm text-emerald-700">{result.message}</p> : null}

      <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === key ? "bg-ink text-cream" : "bg-paper-soft text-muted hover:text-ink"
            }`}
          >
            {label} <span className="opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-soft">
                <th className="pb-2 pr-3">QuickBooks account</th>
                <th className="pb-2 pr-3">GBTN standard account</th>
                <th className="pb-2 pr-3">Why</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <Row key={`${r.qboAccountId}:${r.standardAccount}:${r.status}`} clientId={clientId} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
