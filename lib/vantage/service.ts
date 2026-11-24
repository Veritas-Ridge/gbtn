import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { standardAccount } from "@/lib/financials/standard-coa";
import { qboConfig } from "./qbo/config";
import { seal, unseal } from "./qbo/crypto";
import { revokeToken, type Tokens } from "./qbo/oauth";
import { QboClient, type QboConnectionRow } from "./qbo/client";
import { CONFIDENT, fitsStatement, suggestByRule } from "./mapping/rules";
import { suggestByAi } from "./mapping/ai";
import { loadHistory } from "./history";
import { computeReadout, type ApprovedMapping, type Readout } from "./analysis";

/**
 * Vantage data layer: one client's QuickBooks connection, its chart of
 * accounts as QuickBooks has it, and the mapping onto the GBTN standard.
 *
 * Uses the service role and does NOT check access. Every caller gates first
 * (assertCapability / assertAdmin in the route or action), then calls in.
 * QuickBooks is only ever read.
 */

const CONNECTION_COLUMNS = "id, client_id, realm_id, access_token, refresh_token, access_expires_at";

export type ConnectionSummary = {
  realmId: string;
  environment: "sandbox" | "production";
  companyName: string | null;
  connected: boolean;
  connectedAt: string;
  disconnectedAt: string | null;
  lastSyncedAt: string | null;
  refreshExpiresAt: string | null;
  historyFrom: string | null;
  historyTo: string | null;
  historySyncedAt: string | null;
};

/** Safe to render: never includes tokens. */
export async function getConnectionSummary(clientId: string): Promise<ConnectionSummary | null> {
  const { data, error } = await createAdminClient()
    .from("vantage_qbo_connections")
    .select(
      "realm_id, environment, company_name, connected_at, disconnected_at, last_synced_at, refresh_expires_at, refresh_token, history_from, history_to, history_synced_at"
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    realmId: data.realm_id,
    environment: data.environment,
    companyName: data.company_name,
    connected: Boolean(data.refresh_token) && !data.disconnected_at,
    connectedAt: data.connected_at,
    disconnectedAt: data.disconnected_at,
    lastSyncedAt: data.last_synced_at,
    refreshExpiresAt: data.refresh_expires_at,
    historyFrom: data.history_from,
    historyTo: data.history_to,
    historySyncedAt: data.history_synced_at,
  };
}

async function loadConnection(clientId: string): Promise<QboConnectionRow> {
  const { data, error } = await createAdminClient()
    .from("vantage_qbo_connections")
    .select(CONNECTION_COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle<QboConnectionRow>();
  if (error) throw new Error(error.message);
  if (!data || !data.refresh_token) throw new Error("This client isn't connected to QuickBooks.");
  return data;
}

/** After Intuit's sign-in: store the connection, read the company name, pull the chart of accounts. */
export async function saveConnection(input: {
  clientId: string;
  realmId: string;
  tokens: Tokens;
  userId: string;
}): Promise<{ accounts: number; suggested: number }> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("vantage_qbo_connections")
    .select("realm_id, refresh_token, disconnected_at")
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (existing && existing.refresh_token && !existing.disconnected_at && existing.realm_id !== input.realmId) {
    throw new Error("This client is already connected to a different QuickBooks company. Disconnect it first.");
  }

  const now = new Date().toISOString();
  const { data: row, error } = await db
    .from("vantage_qbo_connections")
    .upsert(
      {
        client_id: input.clientId,
        realm_id: input.realmId,
        environment: qboConfig().environment,
        access_token: seal(input.tokens.accessToken),
        refresh_token: seal(input.tokens.refreshToken),
        access_expires_at: input.tokens.accessExpiresAt.toISOString(),
        refresh_expires_at: input.tokens.refreshExpiresAt.toISOString(),
        connected_by: input.userId,
        connected_at: now,
        disconnected_at: null,
        updated_at: now,
      },
      { onConflict: "client_id" }
    )
    .select(CONNECTION_COLUMNS)
    .single<QboConnectionRow>();
  if (error || !row) throw new Error(`Couldn't save the QuickBooks connection: ${error?.message ?? "no row"}`);

  const client = new QboClient(row);
  const companyName = await client.companyName().catch(() => null);
  if (companyName) {
    await db.from("vantage_qbo_connections").update({ company_name: companyName }).eq("id", row.id);
  }
  return syncAccounts(input.clientId);
}

/** Pull every QuickBooks account (active and inactive), then suggest mappings for new ones. */
export async function syncAccounts(clientId: string): Promise<{ accounts: number; suggested: number }> {
  const conn = await loadConnection(clientId);
  const client = new QboClient(conn);
  const records = await client.all("Account", "Active in (true, false)");
  const now = new Date().toISOString();
  const rows = records.map((r) => ({
    client_id: clientId,
    realm_id: conn.realm_id,
    qbo_account_id: String(r.Id),
    name: String(r.Name ?? r.FullyQualifiedName ?? "Account").slice(0, 300),
    fully_qualified_name: r.FullyQualifiedName ? String(r.FullyQualifiedName).slice(0, 500) : null,
    account_type: (r.AccountType as string) ?? null,
    account_subtype: (r.AccountSubType as string) ?? null,
    classification: (r.Classification as string) ?? null,
    acct_num: typeof r.AcctNum === "string" && r.AcctNum.trim() ? r.AcctNum.trim().slice(0, 32) : null,
    parent_qbo_id: (r.ParentRef as { value?: string } | undefined)?.value ?? null,
    active: r.Active !== false,
    synced_at: now,
  }));
  const db = createAdminClient();
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from("vantage_qbo_accounts")
      .upsert(rows.slice(i, i + 500), { onConflict: "client_id,realm_id,qbo_account_id" });
    if (error) throw new Error(`Couldn't save the chart of accounts: ${error.message}`);
  }
  await db.from("vantage_qbo_connections").update({ last_synced_at: now }).eq("id", conn.id);
  const suggested = await suggestNewByRules(clientId, conn.realm_id);
  return { accounts: rows.length, suggested };
}

type AccountRow = {
  qbo_account_id: string;
  name: string;
  fully_qualified_name: string | null;
  account_type: string | null;
  account_subtype: string | null;
};

/** Rule suggestions for accounts that have no mapping yet. Never touches existing mappings. */
async function suggestNewByRules(clientId: string, realmId: string): Promise<number> {
  const db = createAdminClient();
  const [{ data: accounts }, { data: mapped }] = await Promise.all([
    db
      .from("vantage_qbo_accounts")
      .select("qbo_account_id, name, fully_qualified_name, account_type, account_subtype")
      .eq("client_id", clientId)
      .eq("realm_id", realmId),
    db.from("vantage_account_mappings").select("qbo_account_id").eq("client_id", clientId).eq("realm_id", realmId),
  ]);
  const done = new Set((mapped ?? []).map((m) => m.qbo_account_id as string));
  const fresh = ((accounts ?? []) as AccountRow[])
    .filter((a) => !done.has(a.qbo_account_id))
    .map((a) => {
      const s = suggestByRule({
        name: a.name,
        fullyQualifiedName: a.fully_qualified_name,
        accountType: a.account_type,
        accountSubtype: a.account_subtype,
      });
      return {
        client_id: clientId,
        realm_id: realmId,
        qbo_account_id: a.qbo_account_id,
        standard_account: s.account,
        confidence: s.confidence,
        method: "rule",
        rationale: s.rationale,
        status: "suggested",
      };
    });
  if (fresh.length === 0) return 0;
  const { error } = await db
    .from("vantage_account_mappings")
    .upsert(fresh, { onConflict: "client_id,realm_id,qbo_account_id", ignoreDuplicates: true });
  if (error) throw new Error(`Couldn't save mapping suggestions: ${error.message}`);
  return fresh.length;
}

/** Ask AI about unapproved rule suggestions below the confidence bar. */
export async function suggestUnsureWithAi(
  clientId: string
): Promise<{ ok: true; asked: number; updated: number } | { ok: false; message: string }> {
  const conn = await getConnectionSummary(clientId);
  if (!conn) return { ok: false, message: "Connect QuickBooks first." };
  const db = createAdminClient();
  const { data, error } = await db
    .from("vantage_account_mappings")
    .select("qbo_account_id, confidence, vantage_qbo_accounts!inner(name, fully_qualified_name, account_type, account_subtype)")
    .eq("client_id", clientId)
    .eq("realm_id", conn.realmId)
    .eq("status", "suggested")
    .eq("method", "rule")
    .lt("confidence", CONFIDENT);
  if (error) return { ok: false, message: error.message };
  const unsure = (data ?? []).map((m) => {
    const a = (Array.isArray(m.vantage_qbo_accounts) ? m.vantage_qbo_accounts[0] : m.vantage_qbo_accounts) as AccountRow;
    return {
      id: m.qbo_account_id as string,
      name: a.name,
      fullyQualifiedName: a.fully_qualified_name,
      accountType: a.account_type,
      accountSubtype: a.account_subtype,
    };
  });
  if (unsure.length === 0) return { ok: true, asked: 0, updated: 0 };

  const res = await suggestByAi(unsure);
  if (!res.ok) {
    return {
      ok: false,
      message: res.reason === "no_key" ? "No Anthropic key is configured (Admin → Integrations)." : res.message,
    };
  }
  let updated = 0;
  const now = new Date().toISOString();
  for (const [qboAccountId, s] of res.suggestions) {
    const { error: e, count } = await db
      .from("vantage_account_mappings")
      .update(
        { standard_account: s.account, confidence: s.confidence, method: "ai", rationale: s.rationale, suggested_at: now, updated_at: now },
        { count: "exact" }
      )
      .eq("client_id", clientId)
      .eq("realm_id", conn.realmId)
      .eq("qbo_account_id", qboAccountId)
      .eq("status", "suggested");
    if (!e) updated += count ?? 0;
  }
  return { ok: true, asked: unsure.length, updated };
}

/** An analyst approves one mapping, optionally changing the standard account or service line. */
export async function approveMapping(input: {
  clientId: string;
  qboAccountId: string;
  standardAccount: string;
  serviceLine?: string | null;
  userId: string;
}): Promise<void> {
  const conn = await getConnectionSummary(input.clientId);
  if (!conn) throw new Error("Connect QuickBooks first.");
  const db = createAdminClient();
  const { data: acct } = await db
    .from("vantage_qbo_accounts")
    .select("account_type")
    .eq("client_id", input.clientId)
    .eq("realm_id", conn.realmId)
    .eq("qbo_account_id", input.qboAccountId)
    .maybeSingle();
  if (!acct) throw new Error("That QuickBooks account isn't on this client's chart.");
  const std = standardAccount(input.standardAccount);
  if (!std || !fitsStatement(input.standardAccount, acct.account_type)) {
    throw new Error("Pick a standard account on the same statement as the QuickBooks account.");
  }
  const { data: current } = await db
    .from("vantage_account_mappings")
    .select("standard_account, confidence, method, rationale")
    .eq("client_id", input.clientId)
    .eq("realm_id", conn.realmId)
    .eq("qbo_account_id", input.qboAccountId)
    .maybeSingle();
  const changed = !current || current.standard_account !== input.standardAccount;
  const serviceLine = std.byServiceLine ? input.serviceLine?.trim().toLowerCase().slice(0, 60) || null : null;
  const now = new Date().toISOString();
  const { error } = await db.from("vantage_account_mappings").upsert(
    {
      client_id: input.clientId,
      realm_id: conn.realmId,
      qbo_account_id: input.qboAccountId,
      standard_account: input.standardAccount,
      service_line: serviceLine,
      confidence: changed ? 1 : current!.confidence,
      method: changed ? "analyst" : current!.method,
      rationale: changed ? "Set by analyst" : current!.rationale,
      status: "approved",
      approved_by: input.userId,
      approved_at: now,
      updated_at: now,
    },
    { onConflict: "client_id,realm_id,qbo_account_id" }
  );
  if (error) throw new Error(error.message);
}

/** Approve every unapproved suggestion at or above the confidence bar. */
export async function approveConfident(clientId: string, userId: string): Promise<number> {
  const conn = await getConnectionSummary(clientId);
  if (!conn) throw new Error("Connect QuickBooks first.");
  const now = new Date().toISOString();
  const { error, count } = await createAdminClient()
    .from("vantage_account_mappings")
    .update({ status: "approved", approved_by: userId, approved_at: now, updated_at: now }, { count: "exact" })
    .eq("client_id", clientId)
    .eq("realm_id", conn.realmId)
    .eq("status", "suggested")
    .gte("confidence", CONFIDENT);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Forget the tokens and tell Intuit. The synced chart and mappings stay. */
export async function disconnect(clientId: string): Promise<void> {
  const db = createAdminClient();
  const { data } = await db
    .from("vantage_qbo_connections")
    .select("id, refresh_token")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return;
  if (data.refresh_token) {
    try {
      await revokeToken(unseal(data.refresh_token));
    } catch {
      /* best effort: the local tokens are cleared regardless */
    }
  }
  const now = new Date().toISOString();
  const { error } = await db
    .from("vantage_qbo_connections")
    .update({ access_token: null, refresh_token: null, access_expires_at: null, disconnected_at: now, updated_at: now })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
}

export type MappingRow = {
  qboAccountId: string;
  name: string;
  fullyQualifiedName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  acctNum: string | null;
  active: boolean;
  standardAccount: string | null;
  serviceLine: string | null;
  confidence: number | null;
  method: "rule" | "ai" | "analyst" | null;
  rationale: string | null;
  status: "suggested" | "approved" | null;
};

/** The approval queue for a client's current QuickBooks company. */
export async function listMappings(clientId: string): Promise<MappingRow[]> {
  const conn = await getConnectionSummary(clientId);
  if (!conn) return [];
  const db = createAdminClient();
  const [{ data: accounts, error: e1 }, { data: maps, error: e2 }] = await Promise.all([
    db
      .from("vantage_qbo_accounts")
      .select("qbo_account_id, name, fully_qualified_name, account_type, account_subtype, acct_num, active")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realmId),
    db
      .from("vantage_account_mappings")
      .select("qbo_account_id, standard_account, service_line, confidence, method, rationale, status")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realmId),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const byId = new Map((maps ?? []).map((m) => [m.qbo_account_id as string, m]));
  return (accounts ?? [])
    .map((a) => {
      const m = byId.get(a.qbo_account_id as string);
      return {
        qboAccountId: a.qbo_account_id as string,
        name: a.name as string,
        fullyQualifiedName: a.fully_qualified_name as string | null,
        accountType: a.account_type as string | null,
        accountSubtype: a.account_subtype as string | null,
        acctNum: a.acct_num as string | null,
        active: a.active as boolean,
        standardAccount: (m?.standard_account as string) ?? null,
        serviceLine: (m?.service_line as string) ?? null,
        confidence: m ? Number(m.confidence) : null,
        method: (m?.method as MappingRow["method"]) ?? null,
        rationale: (m?.rationale as string) ?? null,
        status: (m?.status as MappingRow["status"]) ?? null,
      };
    })
    .sort((x, y) => (x.fullyQualifiedName ?? x.name).localeCompare(y.fullyQualifiedName ?? y.name));
}

/**
 * The readout for a client's current QuickBooks company: stored history run
 * through APPROVED mappings only. Suggested mappings are left out (and show
 * up in coverage) so nothing unreviewed reaches a client conversation.
 */
export async function getReadout(clientId: string): Promise<Readout | null> {
  const conn = await getConnectionSummary(clientId);
  if (!conn || !conn.historySyncedAt) return null;
  const db = createAdminClient();
  const [history, { data: maps, error: e1 }, { data: accounts, error: e2 }] = await Promise.all([
    loadHistory(clientId, conn.realmId),
    db
      .from("vantage_account_mappings")
      .select("qbo_account_id, standard_account, service_line")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realmId)
      .eq("status", "approved"),
    db
      .from("vantage_qbo_accounts")
      .select("qbo_account_id, name, fully_qualified_name, account_type")
      .eq("client_id", clientId)
      .eq("realm_id", conn.realmId),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const typeOf = new Map((accounts ?? []).map((a) => [a.qbo_account_id as string, (a.account_type as string) ?? null]));
  const mappings = new Map<string, ApprovedMapping>(
    (maps ?? []).map((m) => [
      m.qbo_account_id as string,
      {
        account: m.standard_account as string,
        serviceLine: (m.service_line as string) ?? null,
        qboAccountType: typeOf.get(m.qbo_account_id as string) ?? null,
      },
    ])
  );
  const names = new Map<string, string>(
    (accounts ?? []).map((a) => [a.qbo_account_id as string, ((a.fully_qualified_name as string) || (a.name as string)) ?? ""])
  );
  return computeReadout(history, mappings, names);
}
