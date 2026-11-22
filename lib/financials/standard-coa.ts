// GBTN standard chart of accounts (Vantage Layer 3).
//
// Client books stay untouched (Layer 1). The mapping engine (Layer 2, not yet
// built) assigns each client account to one standard account below, plus an
// optional service line. Everything Vantage reports is computed off this layer.
//
// The standard is organized by funnel stage, not just GAAP. Every service
// business runs Attract → Book → Convert → Deliver, so every overhead account
// carries the stage it funds and the function that owns it, and every direct
// cost carries its cost type. That is what turns a P&L into cost per lead,
// booking rate, close rate and delivery margin.
//
// Each standard account also names the legacy category it rolls up to
// (`lib/financials/categories.ts`), so `computePL`/`computeBS` keep working
// unchanged on standard-mapped data via `toLegacyItems()`.
//
// Pure module with no server imports on purpose: the mapping UI and dashboards
// will import it from "use client" components. Do not add `import "server-only"`.
//
// Sign convention matches metrics.ts: expenses, liabilities and equity are
// positive; credits and contra accounts (discounts, accumulated depreciation,
// owner draws) are negative. Every total here is a signed sum, never abs().

import type { LineItem } from "./metrics";
import type { StatementType } from "./categories";

// ── Funnel ──────────────────────────────────────────────────────────────────

export type Stage = "attract" | "book" | "convert" | "deliver";

export const STAGES: readonly Stage[] = ["attract", "book", "convert", "deliver"];

export type StageDefinition = {
  stage: Stage;
  label: string;
  /** What one unit of volume is called by default. Clients rename at setup. */
  unit: string;
  unitPlural: string;
  /** Default definition of a unit, for the setup screen. */
  definition: string;
};

/**
 * Default stage definitions. Each client overrides `unit` and `definition`
 * once at setup (a "booking" is an appointment for a trades shop, a scoping
 * call for an engineering firm, a qualified match for an acquisitions shop).
 * The math never changes, only the words.
 */
export const DEFAULT_STAGE_DEFINITIONS: Record<Stage, StageDefinition> = {
  attract: {
    stage: "attract",
    label: "Attract",
    unit: "lead",
    unitPlural: "leads",
    definition: "A new prospect who raised their hand: a call, form, chat or referral.",
  },
  book: {
    stage: "book",
    label: "Book",
    unit: "booking",
    unitPlural: "bookings",
    definition: "A lead moved to a scheduled next step: appointment, call or scoping meeting.",
  },
  convert: {
    stage: "convert",
    label: "Convert",
    unit: "sale",
    unitPlural: "sales",
    definition: "A booked opportunity that signed or paid.",
  },
  deliver: {
    stage: "deliver",
    label: "Deliver",
    unit: "delivery",
    unitPlural: "deliveries",
    definition: "A sold job, project or engagement the business completed.",
  },
};

// ── Account attributes ─────────────────────────────────────────────────────

/** Where the account sits in the P&L waterfall or the balance sheet. */
export type AccountRole =
  | "revenue"
  | "direct_cost"
  | "overhead"
  | "other_operating"
  | "below_ebitda"
  | "asset"
  | "liability"
  | "equity";

/** Direct cost split from the brief: labor, materials, subcontractors. */
export type CostType = "labor" | "materials" | "subcontractors" | "other_direct";

/** The four overhead owners from the brief. */
export type OverheadFunction = "marketing" | "sales" | "operations" | "finance_admin";

export type StandardAccount = {
  /** Stable four digit code, grouped by range (see SECTIONS). */
  code: string;
  /** Stable machine key. Mapping rows store this, so never rename one. */
  key: string;
  label: string;
  statement: StatementType;
  role: AccountRole;
  /** Legacy category in categories.ts this rolls up to for computePL/computeBS. */
  legacyCategory: string;
  /**
   * Funnel stage this cost funds. Set on every direct cost (deliver) and every
   * overhead account except finance and admin, which is company level (null).
   */
  stage: Stage | null;
  costType?: CostType;
  overheadFunction?: OverheadFunction;
  /** True when the mapping should also carry a client service line. */
  byServiceLine?: true;
  /** Normally carries a credit (negative) balance under the sign convention. */
  contra?: true;
  /** Owner money: a normalization and exit planning watch item. */
  ownerRelated?: true;
  /** One line hint for the analyst approval queue. */
  hint?: string;
};

export type Section = {
  key: string;
  label: string;
  statement: StatementType;
  /** Inclusive code range, for display grouping only. */
  from: string;
  to: string;
};

export const SECTIONS: readonly Section[] = [
  { key: "assets", label: "Assets", statement: "bs", from: "1000", to: "1999" },
  { key: "liabilities", label: "Liabilities", statement: "bs", from: "2000", to: "2999" },
  { key: "equity", label: "Equity", statement: "bs", from: "3000", to: "3999" },
  { key: "revenue", label: "Revenue", statement: "pl", from: "4000", to: "4999" },
  { key: "direct_costs", label: "Direct costs (Deliver)", statement: "pl", from: "5000", to: "5999" },
  { key: "marketing", label: "Marketing overhead (Attract)", statement: "pl", from: "6000", to: "6099" },
  { key: "sales", label: "Sales overhead (Book, Convert)", statement: "pl", from: "6100", to: "6199" },
  { key: "operations", label: "Operations overhead (Deliver)", statement: "pl", from: "6200", to: "6299" },
  { key: "finance_admin", label: "Finance and admin overhead", statement: "pl", from: "6300", to: "6399" },
  { key: "other_operating", label: "Other operating", statement: "pl", from: "7000", to: "7999" },
  { key: "below_ebitda", label: "Below EBITDA", statement: "pl", from: "8000", to: "8999" },
];

// ── The standard ───────────────────────────────────────────────────────────

// Small builders keep the table below readable and the attribute combinations
// consistent (every overhead row gets role, legacy category and function).
const rev = (code: string, key: string, label: string, extra: Partial<StandardAccount> = {}): StandardAccount => ({
  code, key, label, statement: "pl", role: "revenue", legacyCategory: "revenue", stage: null, byServiceLine: true, ...extra,
});
const direct = (code: string, key: string, label: string, costType: CostType, extra: Partial<StandardAccount> = {}): StandardAccount => ({
  code, key, label, statement: "pl", role: "direct_cost", legacyCategory: "cogs", stage: "deliver", costType, byServiceLine: true, ...extra,
});
const overhead = (code: string, key: string, label: string, fn: OverheadFunction, stage: Stage | null, extra: Partial<StandardAccount> = {}): StandardAccount => ({
  code, key, label, statement: "pl", role: "overhead", legacyCategory: "opex", stage, overheadFunction: fn, ...extra,
});
const bs = (code: string, key: string, label: string, role: "asset" | "liability" | "equity", legacyCategory: string, extra: Partial<StandardAccount> = {}): StandardAccount => ({
  code, key, label, statement: "bs", role, legacyCategory, stage: null, ...extra,
});

export const STANDARD_ACCOUNTS: readonly StandardAccount[] = [
  // Assets
  bs("1000", "cash_operating", "Operating cash", "asset", "cash", { hint: "Checking, petty cash, undeposited funds that clear in days." }),
  bs("1010", "cash_reserve", "Reserve cash", "asset", "cash", { hint: "Savings and money market held as a reserve." }),
  bs("1100", "ar_trade", "Accounts receivable", "asset", "accounts_receivable"),
  bs("1150", "ar_retainage", "Retainage receivable", "asset", "accounts_receivable", { hint: "Held back by the customer until project closeout." }),
  bs("1190", "ar_allowance", "Allowance for doubtful accounts", "asset", "accounts_receivable", { contra: true }),
  bs("1200", "inventory", "Inventory and materials on hand", "asset", "inventory"),
  bs("1250", "underbillings", "Costs in excess of billings", "asset", "other_current_asset", { hint: "WIP underbillings on percent complete jobs." }),
  bs("1300", "prepaid_other_current", "Prepaids and other current assets", "asset", "other_current_asset"),
  bs("1400", "due_from_owner", "Due from owner or related parties", "asset", "other_current_asset", { ownerRelated: true }),
  bs("1500", "fixed_assets", "Vehicles, equipment and property", "asset", "non_current_asset"),
  bs("1590", "accumulated_depreciation", "Accumulated depreciation", "asset", "non_current_asset", { contra: true }),
  bs("1700", "other_non_current_asset", "Other non current assets", "asset", "non_current_asset", { hint: "Deposits, intangibles, goodwill." }),

  // Liabilities
  bs("2000", "ap_trade", "Accounts payable", "liability", "accounts_payable"),
  bs("2100", "credit_cards", "Credit cards", "liability", "other_current_liability"),
  bs("2200", "accrued_payroll", "Accrued payroll and payroll liabilities", "liability", "other_current_liability"),
  bs("2250", "sales_tax_payable", "Sales tax payable", "liability", "other_current_liability"),
  bs("2300", "customer_deposits", "Customer deposits and billings in excess", "liability", "other_current_liability", { hint: "Deposits and WIP overbillings: cash collected ahead of delivery." }),
  bs("2350", "other_accrued", "Other accrued liabilities", "liability", "other_current_liability", { hint: "Warranty reserve, accrued expenses." }),
  bs("2400", "short_term_debt", "Line of credit and current debt", "liability", "other_current_liability"),
  bs("2500", "long_term_debt", "Long term debt", "liability", "non_current_liability", { hint: "Notes, vehicle and equipment loans, SBA, mortgages." }),
  bs("2600", "due_to_owner", "Due to owner or related parties", "liability", "non_current_liability", { ownerRelated: true }),

  // Equity
  bs("3000", "owner_capital", "Owner capital and contributions", "equity", "equity", { ownerRelated: true }),
  bs("3100", "owner_distributions", "Owner draws and distributions", "equity", "equity", { contra: true, ownerRelated: true }),
  bs("3200", "retained_earnings", "Retained earnings", "equity", "equity"),
  bs("3900", "current_year_earnings", "Current year net income", "equity", "equity"),

  // Revenue (carries a service line)
  rev("4000", "service_revenue", "Service revenue", { hint: "Labor and service billings. Split by service line at mapping." }),
  rev("4100", "materials_revenue", "Materials and equipment sales", { hint: "Product resold or installed and billed as goods." }),
  rev("4200", "recurring_revenue", "Recurring and agreement revenue", { hint: "Memberships, maintenance agreements, retainers." }),
  rev("4900", "revenue_contra", "Discounts, refunds and allowances", { contra: true }),

  // Direct costs (Deliver, carries a service line)
  direct("5000", "direct_labor", "Direct labor", "labor", { hint: "Wages for field, crew, project or billable staff." }),
  direct("5050", "direct_labor_burden", "Direct labor burden", "labor", { hint: "Payroll taxes, workers comp and benefits for direct labor." }),
  direct("5100", "materials", "Materials", "materials"),
  direct("5200", "subcontractors", "Subcontractors", "subcontractors"),
  direct("5300", "other_direct", "Other direct job costs", "other_direct", { hint: "Permits, disposal, equipment rental, job supplies." }),
  direct("5400", "warranty_callbacks", "Warranty and callbacks", "other_direct"),

  // Marketing overhead (Attract)
  overhead("6000", "paid_media", "Paid advertising", "marketing", "attract", { hint: "Google, Meta, LSA, print, radio, mailers." }),
  overhead("6010", "lead_purchase", "Lead purchase and referral fees", "marketing", "attract", { hint: "Angi, HomeAdvisor, Thumbtack, referral payouts." }),
  overhead("6020", "marketing_services", "Marketing agencies and software", "marketing", "attract"),
  overhead("6030", "marketing_payroll", "Marketing payroll", "marketing", "attract"),
  overhead("6040", "brand_events", "Brand, events and sponsorships", "marketing", "attract"),

  // Sales overhead (Book, then Convert)
  overhead("6100", "booking_payroll", "Front office and call handling payroll", "sales", "book", { hint: "CSRs, dispatchers, schedulers, answering service." }),
  overhead("6110", "booking_systems", "Phone, scheduling and CRM software", "sales", "book", { hint: "CallRail, phone system, CRM seats." }),
  overhead("6150", "sales_payroll", "Sales payroll", "sales", "convert", { hint: "Base pay for estimators, comfort advisors, business development." }),
  overhead("6160", "sales_commissions", "Sales commissions", "sales", "convert"),
  overhead("6170", "sales_expense", "Estimating and proposal costs", "sales", "convert"),
  overhead("6180", "financing_fees", "Customer financing fees", "sales", "convert", { hint: "Dealer fees paid to offer customer financing." }),

  // Operations overhead (Deliver)
  overhead("6200", "operations_payroll", "Operations management payroll", "operations", "deliver", { hint: "Ops managers, project managers, warehouse staff not billed to jobs." }),
  overhead("6210", "vehicles_fuel", "Vehicles and fuel", "operations", "deliver"),
  overhead("6220", "tools_equipment", "Tools and small equipment", "operations", "deliver"),
  overhead("6230", "facilities_operations", "Shop, warehouse and yard", "operations", "deliver"),
  overhead("6240", "field_software", "Field and project software", "operations", "deliver", { hint: "ServiceTitan, Jobber, project management tools." }),
  overhead("6250", "training_safety", "Training, licensing and safety", "operations", "deliver"),

  // Finance and admin overhead (company level)
  overhead("6300", "owner_compensation", "Owner compensation", "finance_admin", null, { ownerRelated: true, hint: "Owner salary and guaranteed payments. Draws go to 3100." }),
  overhead("6310", "admin_payroll", "Admin and accounting payroll", "finance_admin", null),
  overhead("6320", "office_occupancy", "Office rent and utilities", "finance_admin", null),
  overhead("6330", "insurance", "Insurance", "finance_admin", null, { hint: "General liability, property, auto. Workers comp on direct labor goes to 5050." }),
  overhead("6340", "professional_fees", "Professional fees", "finance_admin", null, { hint: "Legal, accounting, consulting, fractional CFO." }),
  overhead("6350", "software_it", "General software and IT", "finance_admin", null),
  overhead("6360", "bank_merchant_fees", "Bank and merchant fees", "finance_admin", null),
  overhead("6370", "office_general", "Office, dues and subscriptions", "finance_admin", null),
  overhead("6380", "travel_meals", "Travel and meals", "finance_admin", null),
  overhead("6390", "other_g_and_a", "Other general and administrative", "finance_admin", null),

  // Other operating (above EBITDA)
  { code: "7000", key: "other_operating_income", label: "Other operating income", statement: "pl", role: "other_operating", legacyCategory: "other_income", stage: null, hint: "Card rewards, rebates." },
  { code: "7100", key: "other_operating_expense", label: "Other operating expense", statement: "pl", role: "other_operating", legacyCategory: "other_expense", stage: null },

  // Below EBITDA
  { code: "8000", key: "depreciation_amortization", label: "Depreciation and amortization", statement: "pl", role: "below_ebitda", legacyCategory: "depreciation_amortization", stage: null },
  { code: "8100", key: "interest_net", label: "Interest, net", statement: "pl", role: "below_ebitda", legacyCategory: "interest", stage: null, hint: "Interest income is a credit here." },
  { code: "8200", key: "income_taxes", label: "Income taxes", statement: "pl", role: "below_ebitda", legacyCategory: "taxes", stage: null },
  { code: "8300", key: "non_operating", label: "Non operating and unreconciled", statement: "pl", role: "below_ebitda", legacyCategory: "other_below", stage: null, hint: "Ask My Accountant, one off gains and losses." },
];

export type StandardAccountKey = string;

const BY_KEY: ReadonlyMap<string, StandardAccount> = new Map(STANDARD_ACCOUNTS.map((a) => [a.key, a]));

export function standardAccount(key: StandardAccountKey): StandardAccount | undefined {
  return BY_KEY.get(key);
}

export function standardAccountsFor(statement: StatementType): StandardAccount[] {
  return STANDARD_ACCOUNTS.filter((a) => a.statement === statement);
}

export function sectionFor(account: StandardAccount): Section | undefined {
  return SECTIONS.find((s) => s.statement === account.statement && account.code >= s.from && account.code <= s.to);
}

// ── Mapped data ────────────────────────────────────────────────────────────

/** A client line item after Layer 2 mapping. */
export type MappedLineItem = {
  account: StandardAccountKey;
  amount: number;
  /** Client defined service line key, only meaningful on revenue and direct cost. */
  serviceLine?: string | null;
  raw_label?: string;
};

/**
 * Collapse standard-mapped items to legacy categories so computePL and
 * computeBS run unchanged. Unknown keys are dropped (and surfaced by
 * `unknownAccounts`) rather than guessed.
 */
export function toLegacyItems(items: MappedLineItem[]): LineItem[] {
  const out: LineItem[] = [];
  for (const i of items) {
    const a = BY_KEY.get(i.account);
    if (!a) continue;
    out.push({ category: a.legacyCategory, amount: i.amount, raw_label: i.raw_label });
  }
  return out;
}

export function unknownAccounts(items: MappedLineItem[]): string[] {
  return Array.from(new Set(items.filter((i) => !BY_KEY.has(i.account)).map((i) => i.account)));
}

// ── Funnel rollup ──────────────────────────────────────────────────────────

/** Operational volumes for the same period, from CRM, phone and job systems. */
export type StageVolumes = Partial<Record<Stage, number>>;

export type StageResult = {
  stage: Stage;
  /** Signed cost charged to the stage (overhead tagged to it, plus direct costs for Deliver). */
  cost: number;
  volume: number | null;
  /** Cost per unit of this stage's volume. */
  costPerUnit: number | null;
  /** Share of this stage's volume that reached the next stage, as a %. Null for Deliver. */
  conversionToNext: number | null;
};

export type ServiceLineResult = {
  revenue: number;
  directCost: number;
  grossProfit: number;
  grossMargin: number | null;
};

export type FunnelRollup = {
  revenue: number;
  directCost: number;
  directCostByType: Record<CostType, number>;
  overheadByFunction: Record<OverheadFunction, number>;
  stages: Record<Stage, StageResult>;
  /** Finance and admin overhead: company level, not charged to a stage. */
  companyOverhead: number;
  /** Owner related P&L spend (owner compensation), for normalized EBITDA. */
  ownerCompensation: number;
  byServiceLine: Record<string, ServiceLineResult>;
  kpis: {
    costPerLead: number | null;
    bookingRate: number | null;
    closeRate: number | null;
    completionRate: number | null;
    /** Revenue less every Deliver cost (direct costs and operations overhead), as % of revenue. */
    deliveryMargin: number | null;
    /** Revenue less direct costs only, as % of revenue. */
    grossMargin: number | null;
    /** All funnel costs (Attract through Deliver) per sale. */
    fullyLoadedCostPerSale: number | null;
  };
};

const pct = (num: number, den: number | null | undefined): number | null =>
  den ? (num / den) * 100 : null;
const per = (num: number, den: number | null | undefined): number | null =>
  den ? num / den : null;

const UNASSIGNED = "unassigned";

/**
 * Roll standard-mapped P&L items into the four pillar view. Pure and signed:
 * a credit on a cost account lowers that stage's cost. Balance sheet items are
 * ignored. Volumes are optional; without them the cost side still computes and
 * every rate reads null.
 */
export function rollupFunnel(items: MappedLineItem[], volumes: StageVolumes = {}): FunnelRollup {
  const stageCost: Record<Stage, number> = { attract: 0, book: 0, convert: 0, deliver: 0 };
  const directCostByType: Record<CostType, number> = { labor: 0, materials: 0, subcontractors: 0, other_direct: 0 };
  const overheadByFunction: Record<OverheadFunction, number> = { marketing: 0, sales: 0, operations: 0, finance_admin: 0 };
  const byLine: Record<string, { revenue: number; directCost: number }> = {};
  let revenue = 0;
  let directCost = 0;
  let companyOverhead = 0;
  let ownerCompensation = 0;

  const line = (key: string | null | undefined) => {
    const k = key || UNASSIGNED;
    return (byLine[k] ??= { revenue: 0, directCost: 0 });
  };

  for (const i of items) {
    const a = BY_KEY.get(i.account);
    if (!a || a.statement !== "pl") continue;

    if (a.role === "revenue") {
      revenue += i.amount;
      line(i.serviceLine).revenue += i.amount;
    } else if (a.role === "direct_cost") {
      directCost += i.amount;
      if (a.costType) directCostByType[a.costType] += i.amount;
      line(i.serviceLine).directCost += i.amount;
      stageCost.deliver += i.amount;
    } else if (a.role === "overhead") {
      if (a.overheadFunction) overheadByFunction[a.overheadFunction] += i.amount;
      if (a.stage) stageCost[a.stage] += i.amount;
      else companyOverhead += i.amount;
      if (a.ownerRelated) ownerCompensation += i.amount;
    }
  }

  const vol = (s: Stage): number | null => volumes[s] ?? null;
  const stages = {} as Record<Stage, StageResult>;
  STAGES.forEach((s, idx) => {
    const next = STAGES[idx + 1];
    const v = vol(s);
    stages[s] = {
      stage: s,
      cost: stageCost[s],
      volume: v,
      costPerUnit: per(stageCost[s], v),
      conversionToNext: next ? pct(vol(next) ?? 0, v) : null,
    };
    // A missing next stage volume is unknown, not zero.
    if (next && vol(next) == null) stages[s].conversionToNext = null;
  });

  const byServiceLine: Record<string, ServiceLineResult> = {};
  for (const [k, v] of Object.entries(byLine)) {
    const gp = v.revenue - v.directCost;
    byServiceLine[k] = { revenue: v.revenue, directCost: v.directCost, grossProfit: gp, grossMargin: pct(gp, v.revenue) };
  }

  const funnelCost = stageCost.attract + stageCost.book + stageCost.convert + stageCost.deliver;

  return {
    revenue,
    directCost,
    directCostByType,
    overheadByFunction,
    stages,
    companyOverhead,
    ownerCompensation,
    byServiceLine,
    kpis: {
      costPerLead: stages.attract.costPerUnit,
      bookingRate: stages.attract.conversionToNext,
      closeRate: stages.book.conversionToNext,
      completionRate: stages.convert.conversionToNext,
      deliveryMargin: pct(revenue - stageCost.deliver, revenue),
      grossMargin: pct(revenue - directCost, revenue),
      fullyLoadedCostPerSale: per(funnelCost, vol("convert")),
    },
  };
}
