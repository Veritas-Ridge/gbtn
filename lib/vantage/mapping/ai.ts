import "server-only";
import { generate } from "@/lib/ai/anthropic";
import { STANDARD_ACCOUNTS, DEFAULT_STAGE_DEFINITIONS } from "@/lib/financials/standard-coa";
import { fitsStatement, statementOf, type Suggestion } from "./rules";

/**
 * Vantage mapping, second pass: ask Claude about the accounts the rules were
 * unsure of. Only account metadata leaves GBTN (name, full name, QuickBooks
 * type and subtype), never balances or transactions. Answers are validated
 * against the standard chart and the account's statement; anything invalid
 * is dropped and the rule suggestion stands. AI confidence is capped so an AI
 * answer is never treated as surer than a strong rule.
 *
 * Degrades quietly: with no Anthropic key configured it returns no
 * suggestions and the caller keeps the rule pass.
 */

const MAX_AI_CONFIDENCE = 0.9;
const BATCH = 60;

export type AiAccount = {
  id: string;
  name: string;
  fullyQualifiedName?: string | null;
  accountType?: string | null;
  accountSubtype?: string | null;
};

const SYSTEM = `You map a small service business's QuickBooks accounts onto the GBTN standard chart of accounts.

Every service business runs four stages: ${Object.values(DEFAULT_STAGE_DEFINITIONS)
  .map((s) => `${s.label} (${s.definition})`)
  .join("; ")}.
The standard tags each overhead account with the stage it funds, so pick by what the money actually pays for, not by QuickBooks' type alone. A field technician's wages are direct labor even when QuickBooks files them under Expense. Balance sheet accounts must map to balance sheet standard accounts and P&L accounts to P&L ones.

Reply with ONLY a JSON array, no prose, one object per input account:
[{"id": "<input id>", "account": "<standard key>", "confidence": <0 to 1>, "rationale": "<one short sentence>"}]
Use a confidence under 0.6 when the name alone can't tell you, and say what the analyst should check.`;

function standardList(): string {
  return STANDARD_ACCOUNTS.map(
    (a) =>
      `${a.key} | ${a.label} | ${a.statement === "pl" ? "P&L" : "balance sheet"} | ${a.role}${a.stage ? ` | ${a.stage}` : ""}${a.hint ? ` | ${a.hint}` : ""}`
  ).join("\n");
}

function prompt(batch: AiAccount[]): string {
  const rows = batch.map((a) => ({
    id: a.id,
    name: a.fullyQualifiedName || a.name,
    quickbooks_type: a.accountType ?? null,
    quickbooks_subtype: a.accountSubtype ?? null,
    statement: statementOf(a.accountType) === "pl" ? "P&L" : "balance sheet",
  }));
  return `Standard accounts (key | label | statement | role | stage | hint):\n${standardList()}\n\nAccounts to map:\n${JSON.stringify(rows, null, 1)}`;
}

/** Pull the JSON array out of a reply, tolerating code fences or stray prose. */
function parseReply(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export type AiOutcome =
  | { ok: true; suggestions: Map<string, Suggestion>; model: string }
  | { ok: false; reason: "no_key" | "refused" | "error"; message: string };

export async function suggestByAi(accounts: AiAccount[]): Promise<AiOutcome> {
  const out = new Map<string, Suggestion>();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let model = "";
  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH);
    const res = await generate(SYSTEM, prompt(batch), 16000);
    if (!res.ok) {
      // Nothing usable yet: report why. Partial results from earlier batches still count.
      if (out.size === 0) return res;
      break;
    }
    model = res.model;
    for (const raw of parseReply(res.text)) {
      const r = raw as { id?: unknown; account?: unknown; confidence?: unknown; rationale?: unknown };
      const acct = typeof r.id === "string" ? byId.get(r.id) : undefined;
      if (!acct || typeof r.account !== "string" || !fitsStatement(r.account, acct.accountType)) continue;
      const conf = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? r.confidence : 0.5;
      out.set(acct.id, {
        account: r.account,
        confidence: Math.max(0, Math.min(MAX_AI_CONFIDENCE, conf)),
        rationale: typeof r.rationale === "string" ? r.rationale.slice(0, 300) : "Suggested by AI",
      });
    }
  }
  return { ok: true, suggestions: out, model };
}
