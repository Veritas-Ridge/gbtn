import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Sealing QuickBooks tokens and signing the OAuth state, ported from
 * Groundworks (src/lib/security/crypto.ts).
 *
 * Key: QBO_TOKEN_ENC_KEY, the same 32-byte key the rest of gbtn's QBO work
 * uses (64 hex chars or base64). Rotating it orphans every sealed token and
 * every in-flight sign-in here too; see docs/qbo-app-listing/incident-runbook.md.
 *
 * A sealed value is "v1.<iv>.<tag>.<ciphertext>" (base64url, AES-256-GCM);
 * tampering fails to open. Signing uses an HMAC key derived from the same
 * secret under a Vantage-specific label, so a Vantage state can never be
 * replayed against another flow.
 */

function key(): Buffer {
  const raw = process.env.QBO_TOKEN_ENC_KEY?.trim();
  if (!raw) throw new Error("QBO_TOKEN_ENC_KEY isn't set, so QuickBooks tokens can't be stored.");
  const k = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("QBO_TOKEN_ENC_KEY must decode to exactly 32 bytes (64 hex chars or base64).");
  return k;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function unseal(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || body === undefined) throw new Error("A stored QuickBooks token is unreadable.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

const signingKey = () => createHmac("sha256", key()).update("gbtn-vantage-qbo-state-v1").digest();

/** "<payload>.<signature>", payload base64url JSON. */
export function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", signingKey()).update(body).digest("base64url")}`;
}

/** The payload if the signature is ours, else null. */
export function verifySigned<T>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", signingKey()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
