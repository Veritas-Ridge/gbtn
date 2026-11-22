// Vantage mapping, first pass: QuickBooks account → GBTN standard account,
// from the account's type, subtype and name. Deterministic and pure (no
// server imports) so it can be checked in isolation.
//
// Starts from Groundworks' type/subtype table (groundworks-erp
// src/lib/qbo/import/accounts.ts) and goes further, because the standard is
// organized by funnel stage: "Advertising" and "Vehicle" are both QuickBooks
// Expense accounts, but one funds Attract and the other Deliver.
//
// Every suggestion carries a confidence. Anything under CONFIDENT is flagged
// for the analyst (and is what the AI pass looks at); an analyst approves
// every mapping once either way.

import { standardAccount, type StandardAccountKey } from "@/lib/financials/standard-coa";

export const CONFIDENT = 0.8;

/** The QuickBooks fields mapping reads. */
export type QboAccountInput = {
  name: string;
  fullyQualifiedName?: string | null;
  accountType?: string | null;
  accountSubtype?: string | null;
};

export type Suggestion = {
  account: StandardAccountKey;
  confidence: number;
  rationale: string;
};

const BALANCE_SHEET_TYPES = new Set([
  "Bank", "Accounts Receivable", "Other Current Asset", "Fixed Asset", "Other Asset",
  "Accounts Payable", "Credit Card", "Other Current Liability", "Long Term Liability", "Equity",
]);

/** Which statement a QuickBooks account type lives on. Unknown types read as P&L. */
export function statementOf(accountType: string | null | undefined): "pl" | "bs" {
  return accountType && BALANCE_SHEET_TYPES.has(accountType) ? "bs" : "pl";
}

type Ctx = { type: string; sub: string; text: string };
type Rule = {
  when: (c: Ctx) => boolean;
  account: StandardAccountKey;
  confidence: number;
  why: string;
};

const has = (re: RegExp) => (c: Ctx) => re.test(c.text);
const sub = (...names: string[]) => (c: Ctx) => names.includes(c.sub);
const type = (...names: string[]) => (c: Ctx) => names.includes(c.type);
const all = (...fs: ((c: Ctx) => boolean)[]) => (c: Ctx) => fs.every((f) => f(c));
const any = (...fs: ((c: Ctx) => boolean)[]) => (c: Ctx) => fs.some((f) => f(c));
const not = (f: (c: Ctx) => boolean) => (c: Ctx) => !f(c);

const OWNERISH = /\b(owner|officer|shareholder|stockholder|member|partner|principal)s?\b/;
const PAYROLLISH = /\b(payroll|salar(y|ies)|wages?|compensation|guaranteed payments?)\b/;

// ── Balance sheet: QuickBooks' type is reliable, so confidence is high. ──
const BS_RULES: Rule[] = [
  { when: all(type("Bank"), any(sub("Savings", "MoneyMarket"), has(/\b(savings|reserve|money market)\b/))), account: "cash_reserve", confidence: 0.9, why: "Savings or money market bank account" },
  { when: type("Bank"), account: "cash_operating", confidence: 0.95, why: "QuickBooks Bank account" },

  { when: all(type("Accounts Receivable"), has(/retain/)), account: "ar_retainage", confidence: 0.9, why: "Receivable named as retainage" },
  { when: type("Accounts Receivable"), account: "ar_trade", confidence: 0.95, why: "QuickBooks Accounts Receivable" },

  { when: sub("AllowanceForBadDebts"), account: "ar_allowance", confidence: 0.95, why: "Allowance for bad debts subtype" },
  { when: all(type("Other Current Asset"), any(sub("Inventory"), has(/\binventory\b/))), account: "inventory", confidence: 0.95, why: "Inventory asset" },
  { when: all(type("Other Current Asset"), any(sub("Retainage"), has(/retain/))), account: "ar_retainage", confidence: 0.9, why: "Retainage held by customers" },
  { when: sub("UndepositedFunds"), account: "cash_operating", confidence: 0.9, why: "Undeposited funds clear to the bank in days" },
  { when: all(type("Other Current Asset"), has(/(costs?.*excess.*billings?|underbill)/)), account: "underbillings", confidence: 0.9, why: "Costs in excess of billings (WIP underbillings)" },
  { when: all(type("Other Current Asset"), any(sub("LoansToOfficers", "LoansToStockholders"), has(OWNERISH))), account: "due_from_owner", confidence: 0.85, why: "Loan to an owner or officer" },
  { when: all(type("Other Current Asset"), any(sub("PrepaidExpenses"), has(/prepaid/))), account: "prepaid_other_current", confidence: 0.95, why: "Prepaid expense" },
  { when: type("Other Current Asset"), account: "prepaid_other_current", confidence: 0.8, why: "Other current asset" },

  { when: all(type("Fixed Asset", "Other Asset"), any(sub("AccumulatedDepreciation", "AccumulatedDepletion", "AccumulatedAmortization", "AccumulatedAmortizationOfOtherAssets"), has(/accum/))), account: "accumulated_depreciation", confidence: 0.95, why: "Accumulated depreciation or amortization (contra asset)" },
  { when: type("Fixed Asset"), account: "fixed_assets", confidence: 0.95, why: "QuickBooks Fixed Asset" },
  { when: type("Other Asset"), account: "other_non_current_asset", confidence: 0.9, why: "QuickBooks Other Asset" },

  { when: type("Accounts Payable"), account: "ap_trade", confidence: 0.95, why: "QuickBooks Accounts Payable" },
  { when: type("Credit Card"), account: "credit_cards", confidence: 0.95, why: "QuickBooks Credit Card" },

  { when: all(type("Other Current Liability"), any(sub("SalesTaxPayable", "GlobalTaxPayable"), has(/sales tax/))), account: "sales_tax_payable", confidence: 0.95, why: "Sales tax payable" },
  { when: all(type("Other Current Liability"), any(sub("PayrollTaxPayable", "PayrollClearing", "DirectDepositPayable"), has(/\b(payroll|wages|401k|withholding)\b/))), account: "accrued_payroll", confidence: 0.9, why: "Payroll liability" },
  { when: all(type("Other Current Liability"), has(/\b(deposits?|unearned|deferred revenue|billings? in excess|overbill)/)), account: "customer_deposits", confidence: 0.85, why: "Customer deposits or billings in excess" },
  { when: all(type("Other Current Liability"), any(sub("LineOfCredit", "LoanPayable", "CurrentPortionOfObligationsUnderFinanceLeases"), has(/\b(line of credit|loc|loan|note|current portion)\b/)), not(has(OWNERISH))), account: "short_term_debt", confidence: 0.9, why: "Line of credit or current debt" },
  { when: all(type("Other Current Liability", "Long Term Liability"), any(sub("ShareholderNotesPayable"), has(OWNERISH))), account: "due_to_owner", confidence: 0.85, why: "Owed to an owner or related party" },
  { when: type("Other Current Liability"), account: "other_accrued", confidence: 0.75, why: "Other current liability" },
  { when: type("Long Term Liability"), account: "long_term_debt", confidence: 0.9, why: "QuickBooks Long Term Liability" },

  { when: all(type("Equity"), sub("RetainedEarnings")), account: "retained_earnings", confidence: 0.95, why: "Retained earnings" },
  { when: all(type("Equity"), any(sub("PartnerDistributions", "PersonalExpense", "PersonalIncome", "Healthcare", "EstimatedTaxes"), has(/\b(draws?|distributions?|personal)\b/))), account: "owner_distributions", confidence: 0.9, why: "Owner draws or distributions" },
  { when: all(type("Equity"), sub("OpeningBalanceEquity")), account: "owner_capital", confidence: 0.6, why: "Opening Balance Equity is a QuickBooks plug; it should usually be cleaned out to zero" },
  { when: type("Equity"), account: "owner_capital", confidence: 0.85, why: "Owner capital or stock" },
];

// ── P&L: names carry most of the signal, so name rules come before subtypes. ──
const PL_RULES: Rule[] = [
  // Below EBITDA first, whatever the QuickBooks type.
  { when: any(sub("Depreciation", "Amortization"), has(/\b(depreciation|amortization|amortisation)\b/)), account: "depreciation_amortization", confidence: 0.95, why: "Depreciation or amortization" },
  { when: all(any(sub("InterestPaid", "MortgageInterest", "VehicleLoanInterest", "InterestEarned"), has(/\binterest\b/)), not(has(/\binterest-free\b/))), account: "interest_net", confidence: 0.9, why: "Interest expense or income" },
  { when: all(has(/\b(income tax|federal tax|state tax|franchise tax)\b/), not(has(/payroll/))), account: "income_taxes", confidence: 0.85, why: "Income or franchise tax" },
  { when: has(/\b(ask my accountant|uncategori[sz]ed|suspense|reconciliation discrepanc)/), account: "non_operating", confidence: 0.9, why: "Holding or unreconciled account" },
  { when: any(sub("PenaltiesSettlements", "ExchangeGainOrLoss", "UnrealisedLossOnSecurities"), has(/\b(penalt(y|ies)|settlement|gain on|loss on|gain\/loss)\b/)), account: "non_operating", confidence: 0.8, why: "One-off gain, loss or penalty" },

  // Revenue.
  { when: all(type("Income"), any(sub("DiscountsRefundsGiven"), has(/\b(discounts?|refunds?|allowances?|returns?)\b/))), account: "revenue_contra", confidence: 0.9, why: "Discounts and refunds reduce revenue" },
  { when: all(type("Income"), has(/\b(maintenance|agreements?|memberships?|subscriptions?|retainers?|recurring|service plans?|club)\b/)), account: "recurring_revenue", confidence: 0.8, why: "Recurring or agreement revenue" },
  { when: all(type("Income"), has(/\b(materials?|products?|equipment sales?|parts|merchandise)\b/)), account: "materials_revenue", confidence: 0.8, why: "Product or materials sales" },
  { when: all(type("Income"), sub("SalesOfProductIncome")), account: "service_revenue", confidence: 0.6, why: "QuickBooks calls this product income, but service businesses often book all sales here; confirm" },
  { when: all(type("Income"), sub("ServiceFeeIncome", "OtherPrimaryIncome")), account: "service_revenue", confidence: 0.85, why: "Service income" },
  { when: type("Income"), account: "service_revenue", confidence: 0.75, why: "Income account; service revenue by default" },
  { when: all(type("Other Income"), has(/\b(rewards?|cash ?back|rebates?)\b/)), account: "other_operating_income", confidence: 0.85, why: "Card rewards or rebates" },
  { when: type("Other Income"), account: "other_operating_income", confidence: 0.7, why: "Other income" },

  // Direct costs (Deliver). QuickBooks COGS accounts.
  { when: all(type("Cost of Goods Sold"), has(/\bsub-? ?contract/)), account: "subcontractors", confidence: 0.95, why: "Subcontractor cost" },
  { when: all(type("Cost of Goods Sold"), has(/\b(payroll tax|burden|workers'? comp|benefits?|fica|futa|suta)\b/)), account: "direct_labor_burden", confidence: 0.85, why: "Taxes and benefits on direct labor" },
  { when: all(type("Cost of Goods Sold"), any(sub("CostOfLaborCos"), has(/\b(labor|labour|wages?|payroll|crew|techs?|technicians?|installers?)\b/))), account: "direct_labor", confidence: 0.9, why: "Direct labor" },
  { when: all(type("Cost of Goods Sold"), any(sub("SuppliesMaterialsCogs"), has(/\b(materials?|supplies|parts|products?|inventory|equipment cost)\b/))), account: "materials", confidence: 0.9, why: "Job materials" },
  { when: all(type("Cost of Goods Sold"), has(/\b(warrant(y|ies)|callbacks?|rework)\b/)), account: "warranty_callbacks", confidence: 0.85, why: "Warranty and callback cost" },
  { when: all(type("Cost of Goods Sold"), any(sub("EquipmentRentalCos", "ShippingFreightDeliveryCos", "OtherCostsOfServiceCos"), has(/\b(permits?|disposal|dump|rental|freight|shipping)\b/))), account: "other_direct", confidence: 0.8, why: "Other direct job cost" },
  { when: type("Cost of Goods Sold"), account: "other_direct", confidence: 0.6, why: "Cost of goods sold, type unclear from the name" },

  // Subcontractors booked as an expense are still a direct cost.
  { when: has(/\bsub-? ?contract/), account: "subcontractors", confidence: 0.8, why: "Subcontractor cost booked as an expense" },
  { when: has(/\b(contract labor|contractors?|1099 labor)\b/), account: "subcontractors", confidence: 0.7, why: "Contract labor; confirm it is job work, not admin help" },
  { when: all(not(has(/\btools?\b/)), any(sub("SuppliesMaterials"), has(/\b(job (supplies|materials)|materials?)\b/))), account: "materials", confidence: 0.6, why: "Job materials booked as an expense; confirm they go on jobs" },

  // Owner money.
  { when: any(has(/\bguaranteed payments?\b/), all(has(OWNERISH), has(PAYROLLISH))), account: "owner_compensation", confidence: 0.85, why: "Owner or officer pay" },

  // Attract.
  { when: has(/\b(leads?|angi|angie'?s|homeadvisor|thumbtack|referral fees?|yelp|porch|networx|bark)\b/), account: "lead_purchase", confidence: 0.85, why: "Lead purchase or referral fees" },
  { when: all(has(/\b(marketing|advertising)\b/), has(PAYROLLISH)), account: "marketing_payroll", confidence: 0.8, why: "Marketing payroll" },
  { when: has(/\b(agency|seo|website|web design|hubspot|mailchimp|marketing software)\b/), account: "marketing_services", confidence: 0.8, why: "Marketing agency or software" },
  { when: has(/\b(sponsor(ship)?s?|events?|trade ?shows?|branding|swag|promotional items?)\b/), account: "brand_events", confidence: 0.75, why: "Brand, events or sponsorships" },
  { when: all(not(has(/\b(google workspace|g suite)\b/)), any(sub("AdvertisingPromotional"), has(/\b(advertis\w*|ads|google|facebook|meta|ppc|marketing|mailers?|direct mail|radio|billboards?|lsa|promotion\w*)\b/))), account: "paid_media", confidence: 0.85, why: "Advertising and paid media" },

  // Book.
  { when: has(/\b(call cent(er|re)|answering|csrs?|customer service reps?|dispatch\w*|reception\w*|front office|scheduler)\b/), account: "booking_payroll", confidence: 0.8, why: "Front office and call handling" },
  { when: has(/\b(callrail|ringcentral|dialpad|nextiva|phones?|telephone|crm|scheduling software)\b/), account: "booking_systems", confidence: 0.7, why: "Phone and scheduling systems (could be office overhead)" },

  // Convert.
  { when: has(/\b(dealer fees?|financing fees?|greensky|synchrony|service finance|wisetack)\b/), account: "financing_fees", confidence: 0.85, why: "Customer financing fees" },
  { when: all(has(/\bcommissions?\b/), not(has(/\b(merchant|bank|processing|card)\b/))), account: "sales_commissions", confidence: 0.85, why: "Sales commissions" },
  { when: has(/\b(sales (salar(y|ies)|wages|payroll)|estimators?|comfort advisors?|business development)\b/), account: "sales_payroll", confidence: 0.8, why: "Sales payroll" },
  { when: has(/\b(estimating|proposals?|bids?)\b/), account: "sales_expense", confidence: 0.7, why: "Estimating and proposal cost" },

  // Business taxes and licenses (not income tax, not trade licensing).
  { when: any(sub("TaxesPaid"), has(/\btax(es)? (and|&) licen/)), account: "other_g_and_a", confidence: 0.6, why: "Business taxes and licenses; split out any trade licensing" },

  // Deliver overhead.
  { when: any(sub("VehicleInsurance"), has(/\b(auto|vehicle|truck|fleet) insurance\b/)), account: "vehicles_fuel", confidence: 0.75, why: "Fleet insurance (vehicles and fuel)" },
  { when: any(sub("Auto", "GasAndFuel", "Vehicle", "VehicleLease", "VehicleRegistration", "VehicleRepairs", "OtherVehicleExpenses", "ParkingAndTolls"), has(/\b(vehicles?|trucks?|fuel|gas|auto|fleet|parking|tolls?|mileage)\b/)), account: "vehicles_fuel", confidence: 0.85, why: "Vehicles and fuel" },
  { when: has(/\b(servicetitan|service titan|jobber|housecall|fieldedge|field edge|procore|buildertrend|project management)\b/), account: "field_software", confidence: 0.85, why: "Field service or project software" },
  { when: has(/\b(small tools|tools?|small equipment)\b/), account: "tools_equipment", confidence: 0.8, why: "Tools and small equipment" },
  { when: has(/\b(shop|warehouse|yard|storage unit)\b/), account: "facilities_operations", confidence: 0.75, why: "Shop, warehouse or yard" },
  { when: has(/\b(training|licen[cs](e|es|ing)|certifications?|safety|ppe|osha)\b/), account: "training_safety", confidence: 0.75, why: "Training, licensing and safety" },
  { when: sub("EquipmentRental"), account: "tools_equipment", confidence: 0.7, why: "Equipment rental" },
  { when: has(/\bworkers'? comp/), account: "direct_labor_burden", confidence: 0.6, why: "Workers comp usually rides on field labor; confirm the split" },

  // Finance and admin.
  { when: any(sub("LegalProfessionalFees"), has(/\b(legal|attorney|accounting|cpa|bookkeeping|consult\w*|professional fees?)\b/)), account: "professional_fees", confidence: 0.9, why: "Professional fees" },
  { when: any(sub("BankCharges"), has(/\b(bank (fees?|charges?)|merchant|stripe|square|processing fees?|credit card fees?|service charges?)\b/)), account: "bank_merchant_fees", confidence: 0.9, why: "Bank and merchant fees" },
  { when: any(sub("Insurance"), has(/\binsurance\b/)), account: "insurance", confidence: 0.85, why: "Business insurance" },
  { when: any(sub("RentOrLeaseOfBuildings", "Utilities"), has(/\b(rent|lease|utilit(y|ies)|electric\w*|water|internet)\b/)), account: "office_occupancy", confidence: 0.75, why: "Office rent and utilities" },
  { when: any(sub("Travel", "TravelMeals", "Entertainment", "EntertainmentMeals", "PromotionalMeals"), has(/\b(travel|meals?|entertainment|lodging|hotels?|airfare)\b/)), account: "travel_meals", confidence: 0.85, why: "Travel and meals" },
  { when: has(/\b(software|saas|computers?|it services|microsoft|google workspace|quickbooks)\b/), account: "software_it", confidence: 0.75, why: "General software and IT" },
  { when: any(sub("OfficeExpenses", "OfficeGeneralAdministrativeExpenses", "DuesSubscriptions"), has(/\b(office|postage|printing|dues|subscriptions?|memberships?)\b/)), account: "office_general", confidence: 0.75, why: "Office, dues and subscriptions" },
  { when: any(sub("PayrollExpenses", "CostOfLabor"), has(PAYROLLISH), has(/\b(payroll tax|fica|futa|suta)\b/)), account: "admin_payroll", confidence: 0.5, why: "Payroll with no role in the name; split by who it pays" },
  { when: any(sub("CharitableContributions"), has(/\b(charit\w*|donations?)\b/)), account: "other_operating_expense", confidence: 0.7, why: "Donations" },
  { when: any(sub("BadDebts"), has(/\bbad debts?\b/)), account: "other_g_and_a", confidence: 0.7, why: "Bad debt" },
  { when: sub("RepairMaintenance"), account: "facilities_operations", confidence: 0.6, why: "Repairs and maintenance; confirm what it repairs" },

  // Fallbacks.
  { when: type("Other Expense"), account: "other_operating_expense", confidence: 0.5, why: "Other expense" },
  { when: () => true, account: "other_g_and_a", confidence: 0.4, why: "No clear match; defaulted to other general and administrative" },
];

/** Normalized text the name rules read: full name (parent:child), lowercased. */
function textOf(a: QboAccountInput): string {
  return `${a.fullyQualifiedName || a.name}`.toLowerCase().replace(/[’']/g, "'").replace(/[:_]/g, " ").replace(/\s+/g, " ").trim();
}

/** The first rule that fits, as a suggestion. Always returns one. */
export function suggestByRule(a: QboAccountInput): Suggestion {
  const c: Ctx = { type: a.accountType ?? "", sub: a.accountSubtype ?? "", text: textOf(a) };
  const rules = statementOf(a.accountType) === "bs" ? BS_RULES : PL_RULES;
  const rule = rules.find((r) => r.when(c)) ?? PL_RULES[PL_RULES.length - 1];
  return { account: rule.account, confidence: rule.confidence, rationale: rule.why };
}

/** True when a standard account key exists and sits on the same statement as the QuickBooks account. */
export function fitsStatement(key: string, accountType: string | null | undefined): boolean {
  const s = standardAccount(key);
  return Boolean(s && s.statement === statementOf(accountType));
}
