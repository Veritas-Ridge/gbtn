import "server-only";
import { randomBytes } from "node:crypto";
import { sign, verifySigned } from "./crypto";
import { QBO_SCOPE, qboConfig } from "./config";

/**
 * Sign in with Intuit (OAuth 2.0 authorization code), ported from Groundworks
 * (src/lib/qbo/oauth.ts). The state names the client being connected and the
 * person who started it, signed, and must match a nonce in a short-lived
 * cookie on the same browser, so a callback can't be forged or replayed.
 */

export const STATE_COOKIE = "gbtn_vantage_qbo_state";
export const STATE_COOKIE_PATH = "/api/vantage/qbo";
export const STATE_TTL_MS = 10 * 60 * 1000;

/** c: client being connected, u: person, n: nonce, t: time. */
export type QboState = { c: string; u: string; n: string; t: number };

export function startAuthorization(who: { clientId: string; userId: string }): { url: string; nonce: string } {
  const cfg = qboConfig();
  const nonce = randomBytes(16).toString("base64url");
  const state = sign({ c: who.clientId, u: who.userId, n: nonce, t: Date.now() } satisfies QboState);
  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QBO_SCOPE);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  return { url: url.toString(), nonce };
}

/** The state if it's ours, fresh, for this person, and matches the cookie's nonce; else null. */
export function checkState(state: string | null, cookieNonce: string | undefined, userId: string): QboState | null {
  const s = state ? verifySigned<QboState>(state) : null;
  if (!s || !cookieNonce || s.n !== cookieNonce || s.u !== userId || Date.now() - s.t > STATE_TTL_MS) return null;
  return s;
}

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
};

export class QboAuthError extends Error {
  /** True when Intuit says the grant is dead: the client must connect again. */
  readonly reconnect: boolean;
  constructor(message: string, reconnect: boolean) {
    super(message);
    this.reconnect = reconnect;
  }
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const cfg = qboConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    x_refresh_token_expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    const dead = json.error === "invalid_grant";
    throw new QboAuthError(
      dead
        ? "QuickBooks refused the sign-in (it expired or was revoked). Connect QuickBooks again."
        : `QuickBooks sign-in failed (${res.status}${json.error ? `: ${json.error}` : ""}).`,
      dead
    );
  }
  const now = Date.now();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessExpiresAt: new Date(now + (json.expires_in ?? 3600) * 1000),
    refreshExpiresAt: new Date(now + (json.x_refresh_token_expires_in ?? 100 * 86400) * 1000),
  };
}

export function exchangeCode(code: string): Promise<Tokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: qboConfig().redirectUri });
}

/** Refresh tokens ROTATE: every caller must persist the new refresh token (QboClient does). */
export function refreshTokens(refreshToken: string): Promise<Tokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Tell Intuit to forget the tokens. Best effort: a failure never blocks a disconnect. */
export async function revokeToken(token: string): Promise<void> {
  const cfg = qboConfig();
  await fetch(cfg.revokeUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
}
