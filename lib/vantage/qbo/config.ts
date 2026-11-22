import "server-only";

/**
 * Vantage's QuickBooks Online settings, ported from Groundworks
 * (groundworks-erp src/lib/qbo/config.ts). Same Intuit app as the rest of
 * gbtn, so it reads the same env vars:
 *
 *   QBO_CLIENT_ID, QBO_CLIENT_SECRET   the Intuit app's keys
 *   QBO_ENVIRONMENT                    "sandbox" or "production". REQUIRED here:
 *                                      unlike lib/financials/qbo there is no
 *                                      silent sandbox default, so a misconfigured
 *                                      deploy fails loudly instead of reading
 *                                      fake books.
 *   QBO_TOKEN_ENC_KEY                  32 bytes, 64 hex chars or base64 (crypto.ts)
 *   NEXT_PUBLIC_SITE_URL               the redirect is <it>/api/vantage/qbo/callback,
 *                                      unless VANTAGE_QBO_REDIRECT_URI overrides it.
 *                                      Register that exact URL in the Intuit app.
 *
 * Read only, as a product invariant: Vantage only ever GETs from QuickBooks.
 */

export const QBO_SCOPE = "com.intuit.quickbooks.accounting";
/** Pinned like lib/financials/qbo. Do not bump without re-verifying docs/qbo-api/. */
export const QBO_MINOR_VERSION = "75";

export type QboConfig = {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl: string;
  apiBase: string;
};

export function qboConfigured(): boolean {
  return Boolean(
    process.env.QBO_CLIENT_ID &&
      process.env.QBO_CLIENT_SECRET &&
      process.env.QBO_TOKEN_ENC_KEY &&
      (process.env.QBO_ENVIRONMENT === "sandbox" || process.env.QBO_ENVIRONMENT === "production")
  );
}

export function qboConfig(): QboConfig {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const env = process.env.QBO_ENVIRONMENT;
  if (!clientId || !clientSecret) {
    throw new Error("QuickBooks isn't set up yet: QBO_CLIENT_ID and QBO_CLIENT_SECRET are missing.");
  }
  if (env !== "sandbox" && env !== "production") {
    throw new Error('QBO_ENVIRONMENT must be set to "sandbox" or "production".');
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    environment: env,
    redirectUri: process.env.VANTAGE_QBO_REDIRECT_URI || `${site}/api/vantage/qbo/callback`,
    authUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
    apiBase: env === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com",
  };
}
