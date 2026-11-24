import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { site } from "@/lib/site";
import { QboAuthError } from "./qbo/oauth";
import { pullHistory } from "./history";
import { suggestUnsureWithAi, syncAccounts } from "./service";

/**
 * Nightly Vantage refresh, driven by /api/cron/vantage-sync. For every client
 * with a live QuickBooks connection:
 *
 *   1. re-read the chart of accounts; new accounts get rule suggestions, and
 *      if any are unsure, one AI pass (skipped quietly without a key);
 *   2. if the client has pulled history before, pull it again, so the portal
 *      shows last month as soon as QuickBooks has it.
 *
 * Read only against QuickBooks. Using the refresh token nightly also keeps it
 * from expiring (Intuit drops refresh tokens unused for 100 days).
 *
 * One email to GBTN, only when something needs a person: new accounts to
 * approve, or a connection that must be reconnected. A quiet night sends
 * nothing. Each client runs on its own; one failure never stops the rest.
 */

const BUDGET_MS = 240_000; // stop starting new clients past this (route maxDuration is 300s)

export type NightlyResult = {
  clients: number;
  refreshed: number;
  newAccounts: number;
  needsApproval: { client: string; count: number }[];
  reconnect: string[];
  errors: { client: string; error: string }[];
  skippedForTime: number;
};

export async function runNightly(now = Date.now()): Promise<NightlyResult> {
  const db = createAdminClient();
  const { data: conns, error } = await db
    .from("vantage_qbo_connections")
    .select("client_id, history_synced_at, clients!inner(name)")
    .not("refresh_token", "is", null)
    .is("disconnected_at", null);
  if (error) throw new Error(error.message);

  const result: NightlyResult = {
    clients: conns?.length ?? 0,
    refreshed: 0,
    newAccounts: 0,
    needsApproval: [],
    reconnect: [],
    errors: [],
    skippedForTime: 0,
  };

  for (const c of conns ?? []) {
    const name = ((Array.isArray(c.clients) ? c.clients[0] : c.clients) as { name?: string } | null)?.name ?? c.client_id;
    if (Date.now() - now > BUDGET_MS) {
      result.skippedForTime++;
      continue;
    }
    try {
      const sync = await syncAccounts(c.client_id);
      result.newAccounts += sync.suggested;
      if (sync.suggested > 0) await suggestUnsureWithAi(c.client_id);
      if (c.history_synced_at) await pullHistory(c.client_id);
      result.refreshed++;
    } catch (e) {
      if (e instanceof QboAuthError && e.reconnect) result.reconnect.push(name);
      else result.errors.push({ client: name, error: e instanceof Error ? e.message.slice(0, 200) : "failed" });
      console.error(`[vantage/nightly] ${name}:`, e);
    }
  }

  // Waiting approvals across all live clients (not just tonight's new ones).
  const ids = (conns ?? []).map((c) => c.client_id);
  if (ids.length) {
    const { data: waiting } = await db
      .from("vantage_account_mappings")
      .select("client_id")
      .in("client_id", ids)
      .eq("status", "suggested");
    const counts = new Map<string, number>();
    for (const w of waiting ?? []) counts.set(w.client_id as string, (counts.get(w.client_id as string) ?? 0) + 1);
    for (const c of conns ?? []) {
      const n = counts.get(c.client_id) ?? 0;
      if (n > 0) {
        const name = ((Array.isArray(c.clients) ? c.clients[0] : c.clients) as { name?: string } | null)?.name ?? c.client_id;
        result.needsApproval.push({ client: name, count: n });
      }
    }
  }

  // Only email when a person has something to do, and only for news: new
  // accounts tonight, a dead connection, or an error.
  if (result.newAccounts > 0 || result.reconnect.length || result.errors.length) {
    await notify(result).catch((e) => console.error("[vantage/nightly] notify failed:", e));
  }
  return result;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notify(r: NightlyResult) {
  const li = (s: string) => `<li style="margin:0 0 6px">${s}</li>`;
  const parts: string[] = [];
  if (r.needsApproval.length) {
    parts.push(
      `<p style="margin:0 0 8px"><strong>Mappings to approve</strong></p><ul style="margin:0 0 14px;padding-left:18px">${r.needsApproval
        .map((n) => li(`${esc(n.client)}: ${n.count} account${n.count === 1 ? "" : "s"}`))
        .join("")}</ul>`
    );
  }
  if (r.reconnect.length) {
    parts.push(
      `<p style="margin:0 0 8px"><strong>QuickBooks needs reconnecting</strong></p><ul style="margin:0 0 14px;padding-left:18px">${r.reconnect
        .map((n) => li(esc(n)))
        .join("")}</ul>`
    );
  }
  if (r.errors.length) {
    parts.push(
      `<p style="margin:0 0 8px"><strong>Refresh errors</strong></p><ul style="margin:0 0 14px;padding-left:18px">${r.errors
        .map((e) => li(`${esc(e.client)}: ${esc(e.error)}`))
        .join("")}</ul>`
    );
  }
  await sendEmail({
    subject: `Vantage overnight: ${[
      r.newAccounts ? `${r.newAccounts} new account${r.newAccounts === 1 ? "" : "s"} to map` : "",
      r.reconnect.length ? `${r.reconnect.length} to reconnect` : "",
      r.errors.length ? `${r.errors.length} error${r.errors.length === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(", ")}`,
    html: emailLayout({
      heading: "Vantage overnight refresh",
      bodyHtml: `<p style="margin:0 0 14px">Refreshed ${r.refreshed} of ${r.clients} connected client${r.clients === 1 ? "" : "s"}.</p>${parts.join("")}`,
      ctaLabel: "Open Vantage",
      ctaUrl: `${site.url}/portal/vantage`,
      footnote: "Sent only when something needs a person.",
    }),
  });
}
