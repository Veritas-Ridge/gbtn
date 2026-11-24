import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runNightly } from "@/lib/vantage/nightly";

// Nightly Vantage refresh: re-read every connected client's QuickBooks chart
// of accounts and history (read only) so the portal is current each morning.
//
// Two drivers, per the repo's cron convention: the vercel.json entry, and the
// pg_cron job 'vantage-sync' (migration 0038) calling run_cron_endpoint with
// the DB-held secret. authorizeCron accepts either secret and fails closed.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await authorizeCron(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runNightly();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "refresh failed" }, { status: 500 });
  }
}
