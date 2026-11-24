"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, assertCapability } from "@/lib/auth";
import { pullHistory } from "@/lib/vantage/history";
import { publish, unpublish } from "@/lib/vantage/publish";
import { findingKey, monthLabel } from "@/lib/vantage/analysis";
import {
  approveConfident,
  approveMapping,
  disconnect,
  getReadout,
  suggestUnsureWithAi,
  syncAccounts,
} from "@/lib/vantage/service";

// Portal action contract: { ok?, error?, message? }, never throw to the client.
export type VantageActionState = { ok?: boolean; error?: string; message?: string };

const UUID = /^[0-9a-f-]{36}$/i;
const fail = (e: unknown): VantageActionState => ({
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/** Re-read the client's QuickBooks chart of accounts. GBTN admin, or the client's own admin. */
export async function syncAccountsAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    await assertCapability(clientId, "manage_users");
    const r = await syncAccounts(clientId);
    revalidatePath("/portal/vantage");
    return { ok: true, message: `Synced ${r.accounts} accounts${r.suggested ? `, ${r.suggested} new to map` : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

/** Disconnect QuickBooks. GBTN admin, or the client's own admin. Mappings are kept. */
export async function disconnectAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    await assertCapability(clientId, "manage_users");
    await disconnect(clientId);
    revalidatePath("/portal/vantage");
    return { ok: true, message: "QuickBooks disconnected." };
  } catch (e) {
    return fail(e);
  }
}

// ── Mapping: GBTN analysts only (platform admins). ──

export async function suggestWithAiAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    await assertAdmin();
    const r = await suggestUnsureWithAi(clientId);
    if (!r.ok) return { error: r.message };
    revalidatePath("/portal/vantage");
    return {
      ok: true,
      message: r.asked === 0 ? "Nothing unsure left to ask about." : `AI reviewed ${r.asked} unsure accounts and updated ${r.updated}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function approveMappingAction(input: {
  clientId: string;
  qboAccountId: string;
  standardAccount: string;
  serviceLine?: string | null;
}): Promise<VantageActionState> {
  if (!UUID.test(input.clientId)) return { error: "Unknown client." };
  try {
    const session = await assertAdmin();
    await approveMapping({ ...input, userId: session.user.id });
    revalidatePath("/portal/vantage");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function approveConfidentAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    const session = await assertAdmin();
    const n = await approveConfident(clientId, session.user.id);
    revalidatePath("/portal/vantage");
    return { ok: true, message: n ? `Approved ${n} confident mappings.` : "No confident suggestions waiting." };
  } catch (e) {
    return fail(e);
  }
}

/** Pull up to 36 months of month-by-month history from QuickBooks (read only). Analysts only. */
export async function pullHistoryAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    await assertAdmin();
    const r = await pullHistory(clientId);
    revalidatePath("/portal/vantage");
    if (r.activeMonths === 0) return { ok: true, message: `No P&L activity in QuickBooks for the last ${r.months} months.` };
    const started = r.activeMonths < r.months && r.firstActive ? ` The books start ${monthLabel(r.firstActive.slice(0, 7))}.` : "";
    return { ok: true, message: `Pulled ${r.activeMonths} months with activity.${started}` };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Publish chosen readout findings to the client's portal. Analysts only. The
 * findings are recomputed here and picked by key, never taken from the
 * browser, so the client sees exactly the analysis on screen.
 */
export async function publishReadoutAction(input: { clientId: string; keys: string[]; note: string }): Promise<VantageActionState> {
  if (!UUID.test(input.clientId)) return { error: "Unknown client." };
  try {
    const session = await assertAdmin();
    const readout = await getReadout(input.clientId);
    if (!readout) return { error: "Pull history first." };
    const wanted = new Set(input.keys);
    const chosen = readout.findings.filter((f) => wanted.has(findingKey(f)));
    const months = readout.months;
    const n = await publish({
      clientId: input.clientId,
      findings: chosen,
      note: input.note,
      coversFrom: months.length ? months[0].month : null,
      coversTo: months.length ? months[months.length - 1].month : null,
      userId: session.user.id,
    });
    revalidatePath("/portal/vantage");
    revalidatePath("/portal/pillars");
    return { ok: true, message: `Published ${n} finding${n === 1 ? "" : "s"} to the client's Four Pillars page.` };
  } catch (e) {
    return fail(e);
  }
}

export async function unpublishReadoutAction(clientId: string): Promise<VantageActionState> {
  if (!UUID.test(clientId)) return { error: "Unknown client." };
  try {
    await assertAdmin();
    await unpublish(clientId);
    revalidatePath("/portal/vantage");
    revalidatePath("/portal/pillars");
    return { ok: true, message: "Taken down. The client no longer sees the readout." };
  } catch (e) {
    return fail(e);
  }
}
