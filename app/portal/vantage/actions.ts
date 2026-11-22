"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, assertCapability } from "@/lib/auth";
import {
  approveConfident,
  approveMapping,
  disconnect,
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
