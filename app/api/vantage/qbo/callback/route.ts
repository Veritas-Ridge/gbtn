import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, sessionCan } from "@/lib/auth";
import { checkState, exchangeCode, STATE_COOKIE, STATE_COOKIE_PATH } from "@/lib/vantage/qbo/oauth";
import { saveConnection } from "@/lib/vantage/service";

/**
 * Intuit sends the person back here after Sign in with Intuit. The signed
 * state must match the nonce cookie set by /connect on this same browser,
 * belong to this signed-in person, and be under ten minutes old. Access to
 * the client is checked again here, not trusted from the state.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const nonce = jar.get(STATE_COOKIE)?.value;
  jar.delete({ name: STATE_COOKIE, path: STATE_COOKIE_PATH });

  const back = (clientId: string | null, q: string) =>
    NextResponse.redirect(new URL(`/portal/vantage${clientId ? `?client=${encodeURIComponent(clientId)}&` : "?"}${q}`, req.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const state = checkState(url.searchParams.get("state"), nonce, session.user.id);
  const denied = url.searchParams.get("error");
  if (denied) return back(state?.c ?? null, denied === "access_denied" ? "qbo=cancelled" : "qbo=error");

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  if (!state || !code || !realmId) return back(state?.c ?? null, "qbo=expired");
  if (!sessionCan(session, state.c, "manage_users")) return NextResponse.redirect(new URL("/portal", req.url));

  try {
    const tokens = await exchangeCode(code);
    await saveConnection({ clientId: state.c, realmId, tokens, userId: session.user.id });
  } catch (e) {
    console.error("[vantage/qbo] connect failed:", e);
    const message = e instanceof Error ? e.message : "QuickBooks connection failed.";
    return back(state.c, `qbo=error&message=${encodeURIComponent(message.slice(0, 200))}`);
  }
  return back(state.c, "qbo=connected");
}
