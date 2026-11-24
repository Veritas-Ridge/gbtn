import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Finding } from "./analysis";

/**
 * Publishing Vantage readout findings to a client's portal. A publication is
 * a snapshot of the findings as the analyst reviewed them; the client sees
 * the latest live one and nothing else. No access checks here: callers gate
 * (assertAdmin to publish, requireCapability financials to read).
 */

export type Publication = {
  id: string;
  findings: Finding[];
  note: string | null;
  coversFrom: string | null;
  coversTo: string | null;
  publishedAt: string;
};

const KINDS = new Set(["seasonality", "margin_drift", "ar_creep", "overhead_jump"]);
const SEVERITIES = new Set(["high", "medium", "info"]);

/** Keep only well-formed findings with bounded text (the client sees this verbatim). */
function clean(f: Finding[]): Finding[] {
  return f
    .filter((x) => x && KINDS.has(x.kind) && SEVERITIES.has(x.severity))
    .slice(0, 12)
    .map((x) => ({
      kind: x.kind,
      severity: x.severity,
      title: String(x.title).slice(0, 300),
      detail: String(x.detail).slice(0, 1000),
      question: String(x.question).slice(0, 500),
      from: String(x.from).slice(0, 7),
      to: String(x.to).slice(0, 7),
    }));
}

/**
 * The client's current publication, or null. Never throws: a page with no
 * error boundary must not blank because this lookup failed (for example
 * before migration 0039 is applied); it just shows nothing published.
 */
export async function getPublication(clientId: string): Promise<Publication | null> {
  const { data, error } = await createAdminClient()
    .from("vantage_readout_publications")
    .select("id, findings, note, covers_from, covers_to, published_at")
    .eq("client_id", clientId)
    .is("unpublished_at", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[vantage/publish] lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    findings: clean((data.findings as Finding[]) ?? []),
    note: data.note,
    coversFrom: data.covers_from,
    coversTo: data.covers_to,
    publishedAt: data.published_at,
  };
}

/** Publish the chosen findings, replacing whatever the client saw before. */
export async function publish(input: {
  clientId: string;
  findings: Finding[];
  note: string | null;
  coversFrom: string | null;
  coversTo: string | null;
  userId: string;
}): Promise<number> {
  const findings = clean(input.findings);
  const note = input.note?.trim().slice(0, 2000) || null;
  if (findings.length === 0 && !note) throw new Error("Pick at least one finding or write a note.");
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error: e1 } = await db
    .from("vantage_readout_publications")
    .update({ unpublished_at: now })
    .eq("client_id", input.clientId)
    .is("unpublished_at", null);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await db.from("vantage_readout_publications").insert({
    client_id: input.clientId,
    findings,
    note,
    covers_from: input.coversFrom,
    covers_to: input.coversTo,
    published_by: input.userId,
    published_at: now,
  });
  if (e2) throw new Error(e2.message);
  return findings.length;
}

/** Take the client's readout down. */
export async function unpublish(clientId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("vantage_readout_publications")
    .update({ unpublished_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("unpublished_at", null);
  if (error) throw new Error(error.message);
}
