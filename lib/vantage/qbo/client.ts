import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { seal, unseal } from "./crypto";
import { QBO_MINOR_VERSION, qboConfig } from "./config";
import { refreshTokens, type Tokens } from "./oauth";

/**
 * Reading one client's QuickBooks data, ported from Groundworks
 * (src/lib/qbo/client.ts). READ ONLY: this class has no method that writes
 * to QuickBooks, and none may be added (product invariant).
 *
 * Refreshes the access token when it's about to expire (or QuickBooks says it
 * has) and saves the rotated tokens right away, so a later failure can never
 * lose the only refresh token that still works. Retries throttling (429) and
 * server errors (5xx); times each call out so a hung Intuit request can't eat
 * the whole function budget.
 */

export const PAGE_SIZE = 1000;
const RETRIES = 4;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_RETRIES = 2;

export type QboRecord = Record<string, unknown> & { Id: string };

/** The columns QboClient needs. Tokens are sealed. */
export type QboConnectionRow = {
  id: string;
  client_id: string;
  realm_id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
};

export class QboApiError extends Error {
  readonly status: number;
  readonly intuitTid?: string;
  constructor(message: string, status: number, intuitTid?: string) {
    super(message);
    this.status = status;
    this.intuitTid = intuitTid;
  }
}

export class QboClient {
  private conn: QboConnectionRow;

  constructor(conn: QboConnectionRow) {
    this.conn = conn;
  }

  get realmId() {
    return this.conn.realm_id;
  }

  /** Persist freshly issued tokens on a connection, sealed. */
  static async saveTokens(connectionId: string, t: Tokens): Promise<void> {
    const { error } = await createAdminClient()
      .from("vantage_qbo_connections")
      .update({
        access_token: seal(t.accessToken),
        refresh_token: seal(t.refreshToken),
        access_expires_at: t.accessExpiresAt.toISOString(),
        refresh_expires_at: t.refreshExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    if (error) throw new Error(`Couldn't save the refreshed QuickBooks tokens: ${error.message}`);
  }

  private async token(force = false): Promise<string> {
    if (!this.conn.access_token || !this.conn.refresh_token) {
      throw new Error("This client is no longer connected to QuickBooks. Connect it again to continue.");
    }
    const soon = Date.now() + 5 * 60 * 1000;
    const expires = this.conn.access_expires_at ? Date.parse(this.conn.access_expires_at) : 0;
    if (force || expires < soon) {
      const t = await refreshTokens(unseal(this.conn.refresh_token));
      await QboClient.saveTokens(this.conn.id, t);
      this.conn = {
        ...this.conn,
        access_token: seal(t.accessToken),
        refresh_token: seal(t.refreshToken),
        access_expires_at: t.accessExpiresAt.toISOString(),
      };
      return t.accessToken;
    }
    return unseal(this.conn.access_token);
  }

  /** GET a company resource (path after /v3/company/<realm>/). */
  async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${qboConfig().apiBase}/v3/company/${this.conn.realm_id}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("minorversion", QBO_MINOR_VERSION);
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: { authorization: `Bearer ${await this.token(false)}`, accept: "application/json" },
          signal: ctrl.signal,
          cache: "no-store",
        });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError" && attempt < MAX_TIMEOUT_RETRIES) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }
        if ((err as { name?: string }).name === "AbortError") {
          throw new QboApiError(`QuickBooks didn't respond within ${REQUEST_TIMEOUT_MS / 1000}s. Try again.`, 504);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await this.token(true);
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(wait, 10_000)));
        continue;
      }
      const json = (await res.json().catch(() => null)) as
        | (T & { Fault?: { Error?: Array<{ Message?: string; Detail?: string }> } })
        | null;
      if (!res.ok || !json || json.Fault) {
        const e = json?.Fault?.Error?.[0];
        // intuit_tid identifies the request in Intuit's own logs, for support.
        const tid = res.headers.get("intuit_tid") ?? res.headers.get("intuit-tid") ?? undefined;
        throw new QboApiError(`QuickBooks: ${e?.Detail ?? e?.Message ?? `request failed (${res.status})`}`, res.status, tid);
      }
      return json;
    }
  }

  /** One page of `select * from <entity> [where …]`. */
  async page(entity: string, startPosition: number, where = ""): Promise<QboRecord[]> {
    const q = `select * from ${entity}${where ? ` where ${where}` : ""} startposition ${startPosition} maxresults ${PAGE_SIZE}`;
    const r = await this.get<{ QueryResponse: Record<string, QboRecord[] | number | undefined> }>("query", { query: q });
    const named = r.QueryResponse[entity];
    if (Array.isArray(named)) return named;
    const lists = Object.values(r.QueryResponse).filter((v): v is QboRecord[] => Array.isArray(v));
    return lists.length === 1 ? lists[0] : [];
  }

  /** Every record of a query, page by page. */
  async all(entity: string, where = ""): Promise<QboRecord[]> {
    const out: QboRecord[] = [];
    for (let pos = 1; ; pos += PAGE_SIZE) {
      const rows = await this.page(entity, pos, where);
      out.push(...rows);
      if (rows.length < PAGE_SIZE) return out;
    }
  }

  /** The QuickBooks company's own name. */
  async companyName(): Promise<string | null> {
    const r = await this.get<{ CompanyInfo?: { CompanyName?: string; LegalName?: string } }>(`companyinfo/${this.conn.realm_id}`);
    return r.CompanyInfo?.CompanyName ?? r.CompanyInfo?.LegalName ?? null;
  }
}
