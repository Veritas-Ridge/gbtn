import { NextResponse } from "next/server";
import { getSession, sessionCan } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { qboConfigured } from "@/lib/vantage/qbo/config";
import { startAuthorization, STATE_COOKIE, STATE_COOKIE_PATH, STATE_TTL_MS } from "@/lib/vantage/qbo/oauth";

/**
 * Start Sign in with Intuit for one client: GET /api/vantage/qbo/connect?client=<id>.
 *
 * Nothing gates /api/* in this app (middleware only sniffs /portal cookies),
 * so the gate is here: a signed-in GBTN admin, or that client's own admin
 * (manage_users). Responds with redirects, never JSON, because a browser
 * follows this link.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client") ?? "";
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/portal/vantage${clientId ? `?client=${encodeURIComponent(clientId)}&` : "?"}${q}`, req.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !sessionCan(session, clientId, "manage_users")) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }
  const { data: client } = await createAdminClient().from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.redirect(new URL("/portal", req.url));
  if (!qboConfigured()) return back("qbo=not_configured");

  const { url: intuitUrl, nonce } = startAuthorization({ clientId, userId: session.user.id });
  const res = NextResponse.redirect(intuitUrl);
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: STATE_COOKIE_PATH,
    maxAge: Math.floor(STATE_TTL_MS / 1000),
  });
  return res;
}
