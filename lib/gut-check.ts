// Gut Check show submission: the option lists shared by the public form
// (components/gut-check-form.tsx), its server action and the staff email.
//
// Not server-only: the "use client" form imports these lists. Keep it free of
// secrets and server imports.
//
// The show title and trademark are still open, so the public name lives in one
// constant. Rename here and the page, form and emails follow.

export const GUT_CHECK = {
  name: "Gut Check",
  fixName: "Dialed In",
  path: "/gut-check",
} as const;

type Option<K extends string> = { value: K; label: string };

export const REVENUE_BANDS = [
  { value: "under_1m", label: "Under $1M" },
  { value: "1m_5m", label: "$1M to $5M" },
  { value: "5m_20m", label: "$5M to $20M" },
  { value: "20m_plus", label: "$20M+" },
] as const satisfies readonly Option<string>[];

export const DELIVERY_HEADACHES = [
  { value: "capacity", label: "Capacity" },
  { value: "quality", label: "Quality" },
  { value: "people", label: "People" },
  { value: "margin", label: "Margin" },
  { value: "other", label: "Something else" },
] as const satisfies readonly Option<string>[];

export const OWNER_GOALS = [
  { value: "grow", label: "Grow" },
  { value: "sell", label: "Sell eventually" },
  { value: "step_back", label: "Step back" },
] as const satisfies readonly Option<string>[];

export const BOOKKEEPERS = [
  { value: "in_house", label: "In house" },
  { value: "outside", label: "Outside bookkeeper" },
  { value: "owner", label: "I do them" },
] as const satisfies readonly Option<string>[];

export const ACCOUNTING_SYSTEMS = [
  { value: "qbo", label: "QuickBooks Online" },
  { value: "netsuite", label: "NetSuite" },
  { value: "sage", label: "Sage" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option<string>[];

export const FEATURE_PREFERENCES = [
  {
    value: "named",
    label: "On the show, named",
    detail: "Your name and business on air, with your real numbers.",
  },
  {
    value: "anonymous",
    label: "On the show, anonymous",
    detail: "No names. Numbers shown as percentages only.",
  },
  {
    value: "private",
    label: "Private review only",
    detail: "Nothing on air. A one on one walkthrough of your snapshot.",
  },
] as const;

export type Values<T extends readonly { value: string }[]> = T[number]["value"];

export const valuesOf = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [Values<T>, ...Values<T>[]];

export function labelOf(opts: readonly { value: string; label: string }[], value: string | null | undefined): string {
  return opts.find((o) => o.value === value)?.label ?? value ?? "";
}
