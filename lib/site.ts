// ───────────────────────────────────────────────────────────────────────────
// Growth by the Numbers - central content config.
// Edit copy here and it propagates across the whole site.
// ───────────────────────────────────────────────────────────────────────────

import { GUT_CHECK, type PillarKey } from "./gut-check";

export const site = {
  name: "Growth by the Numbers",
  shortName: "GBTN",
  /** Legal entity behind the brand — used in legal notices and copyright. */
  legalName: "Tyler M Briggs Inc",
  tagline:
    "Build a finance engine your team actually uses, and that sponsors trust.",
  domain: "growthbythenumbers.com",
  url: "https://growthbythenumbers.com",
  founder: {
    name: "Tyler Briggs",
    title: "Founder, President & CFO",
    location: "Arizona · Remote nationwide",
    email: "tyler@tylermbriggs.com",
    phone: "480.407.8503",
    phoneHref: "tel:+14804078503",
    linkedin: "https://www.linkedin.com/in/tylermarkbriggs",
    youtube: "https://www.youtube.com/@Growthbythenumbers",
    calendly: "", // TODO: add scheduling link
  },
} as const;

// ── Firm positioning (Gut Check model) ──────────────────────────────────────
// Every service business runs four pillars: Attract, Book, Convert, Deliver
// (lib/gut-check.ts). The free Gut Check scores them from real numbers; the
// paid ladder gets the business Dialed In. Home services is a proof point,
// not the fence.
export const positioning = {
  badge: "Attract · Book · Convert · Deliver",
  hero: {
    headline: "You're growing on gut.",
    accent: `Get a ${GUT_CHECK.name}.`,
    subhead:
      "Every service business runs on four pillars: Attract, Book, Convert and Deliver. Send in your numbers and I'll score all four, show you where the money is leaking, and lay out the plan to get you dialed in.",
  },
} as const;

/** The primary call to action, used by the nav, hero and closing band. */
export const primaryCta = {
  label: `Get your ${GUT_CHECK.name}`,
  href: GUT_CHECK.path,
} as const;

export const nav = [
  { label: GUT_CHECK.name, href: GUT_CHECK.path },
  { label: "Services", href: "/services" },
  { label: "Results", href: "/results" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

// Top-line credibility stats (founder's resume figures).
export const stats = [
  { value: "$1B+", label: "In acquisitions I've led" },
  { value: "$5B+", label: "In exits I've led" },
  { value: "$30M → $100M+", label: "Revenue scaled as President & CFO" },
  { value: "18%", label: "Annualized EBITDA growth driven" },
  { value: "20+", label: "M&A deals, diligence to integration" },
  { value: "12+ yrs", label: "Inside PE-backed & founder-led operators" },
] as const;

// Logos / platforms the founder has operated inside (real associations).
export const platforms = [
  { name: "Semper Fi Heating & Cooling", note: "Pulte Capital-backed" },
  { name: "Panoramic Health", note: "Audax-backed" },
  { name: "OfferPad", note: "PE-backed iBuyer" },
  { name: "Window Rock Capital", note: "Family office" },
  { name: "Copper Mountain Capital", note: "Founder" },
] as const;

// ── Productized engagements (the real GBTN offer ladder) ────────────────────
// The free Gut Check is step zero; these are the paid rungs after it. `fixes`
// tags each rung with the pillars it works on ("company" = company level).
export type FixArea = PillarKey | "company";

export const fixLabels: Record<FixArea, string> = {
  attract: "Attract",
  book: "Book",
  convert: "Convert",
  deliver: "Deliver",
  company: "Company level",
};

export const gutCheckStep = {
  tier: "Step zero",
  title: GUT_CHECK.name,
  price: "Free",
  summary:
    "Send in your numbers and I score all four pillars: what's working, what's leaking, and what it takes to get dialed in. On the show named, anonymous, or as a private review.",
  points: [
    "About two minutes to submit",
    "Scored from your real P&L and balance sheet",
    `A written ${GUT_CHECK.fixName} plan, ranked by dollars`,
  ],
} as const;

export const services = [
  {
    id: "profit",
    tier: "Diagnostic",
    rung: "diagnose",
    rungLabel: "Diagnose",
    eyebrow: "Start here",
    title: "Profit by the Numbers",
    timeline: "2-4 weeks",
    summary:
      "A fast, forensic read on where margin and cash are leaking, and the prioritized plan to stop it. Most clients see measurable improvement inside 30 days.",
    deliverables: [
      "Margin bridge + root-cause driver tree (price / mix / labor / material / overhead)",
      "13-week cash forecast baseline + working-capital opportunities",
      "Full Gut Check scorecard across Attract, Book, Convert and Deliver",
      "Top-10 action plan with owners, timing, and expected impact",
      "Leadership- and sponsor-ready readout",
    ],
    forWho: "Operators who need clarity on margin and cash, fast.",
    fixes: ["convert", "deliver"],
  },
  {
    id: "scale",
    tier: "Build + Cadence",
    rung: "install",
    rungLabel: "Install",
    eyebrow: "Build the engine",
    title: "Scale by the Numbers",
    timeline: "6-12 weeks + retainer",
    summary:
      "The planning and reporting cadence your leadership runs every week, not just month-end financials. We install the operating system and the rhythm that makes it stick.",
    deliverables: [
      "Budget + rolling forecast (best / base / downside)",
      "Unit economics by branch / crew / channel",
      "Monthly close cadence + leadership pack",
      "Weekly KPI dashboard + decision rhythm",
      "Pricing + compensation alignment workshop",
    ],
    forWho: "Growth-stage operators ready for a repeatable operating system.",
    fixes: ["attract", "book", "convert", "deliver"],
  },
  {
    id: "institutional",
    tier: "PE-Ready Platform",
    rung: "institutionalize",
    rungLabel: "Institutionalize",
    eyebrow: "Institutional grade",
    title: "Institutional-Grade Scale",
    timeline: "3-6+ months",
    summary:
      "The full investor-grade finance stack (board reporting, controls, systems, and M&A integration) so value creation becomes repeatable and the platform is ready for its next phase.",
    deliverables: [
      "Board / IC pack with KPI bridges and cohort views",
      "Controls, policy library, and approval matrix",
      "ERP / BI build leadership (selection to implementation)",
      "M&A diligence + 30/60/90 integration playbook",
      "Lender package + covenant-ready reporting",
    ],
    forWho: "PE-backed platforms preparing for a recap, add-ons, or exit.",
    fixes: ["company"],
  },
] as const;

// Common add-on sprints. Pricing is a consultation conversation, not a rate card.
export const addOns = [
  { name: "13-week cash forecast + cash war room" },
  { name: "Pricing & gross-margin reset sprint" },
  { name: "AP/AR cleanup + collections playbook" },
  { name: "Job / branch profitability build" },
  { name: "Vendor negotiation sprint" },
  { name: "Post-acquisition integration sprint (30/60/90)" },
] as const;

// Who GBTN serves: two related audiences.
export const audiences = [
  {
    title: "Founder-led operators",
    body: "Home & field services and multi-location businesses ($5M-$150M) where execution and unit economics decide whether growth turns into profit.",
    points: ["HVAC, plumbing, electrical, roofing, landscaping", "Multi-location & regional branch models", "Asset-heavy, job-level profitability"],
  },
  {
    title: "PE-backed platforms",
    body: "Sponsors and portfolio CEOs who need investor-grade visibility, covenant-ready cash, and repeatable value-creation workstreams across a roll-up.",
    points: ["Roll-up & integration-heavy platforms", "Board / IC reporting and KPI bridges", "Recap, add-on, or exit readiness"],
  },
] as const;

// "How it works": Gut Check, then Dialed In, then run it every week.
export const process = [
  {
    step: "01",
    title: `Get your ${GUT_CHECK.name}`,
    body: "Send in your numbers. I score Attract, Book, Convert and Deliver and show you which pillar is leaking the most money.",
  },
  {
    step: "02",
    title: `Get ${GUT_CHECK.fixName}`,
    body: "We fix the leaks in order of dollars: pricing, booking, close rates, job margin and cash. Each fix has an owner and a date.",
  },
  {
    step: "03",
    title: "Run on the numbers",
    body: "We install the weekly scorecard for all four pillars and run it alongside your team, so margin and cash compound quarter over quarter.",
  },
] as const;

// Founder career timeline / track record.
export const trackRecord = [
  {
    company: "Semper Fi Heating & Cooling",
    role: "President & Chief Financial Officer",
    period: "2022-2025",
    backer: "Pulte Capital",
    sector: "Home Services / HVAC",
    highlight:
      "Scaled the platform from ~$30M to $100M+ in revenue in three years while driving 18% annualized EBITDA growth.",
    points: [
      "Led M&A strategy and executed the company's strategic acquisition end to end, from diligence through post-close integration.",
      "Built and ran the finance function from scratch: FP&A, board-grade reporting, KPI dashboards, SOPs, and a weekly operating cadence.",
      "Directed a multi-entity $100M+ P&L and a 50+ person finance, operations, and technology team inside a 300+ FTE organization.",
      "Implemented ServiceTitan and Power BI, cutting reporting cycle times by roughly 30%.",
      "Negotiated banking, insurance, and vendor terms for $2M+ in annual savings, and partnered with the board and PE sponsor on capital allocation and exit planning.",
    ],
  },
  {
    company: "Panoramic Health",
    role: "Financial Integrations Manager",
    period: "2021-2022",
    backer: "Audax Private Equity",
    sector: "Healthcare Platform",
    highlight:
      "Drove financial integration inside a $450M, Audax-backed nephrology platform spanning 3,400+ employees nationwide and acquiring $20-30M of add-on practices every month.",
    points: [
      "Integrated the platform's add-on pipeline at a pace of roughly four practice acquisitions per month, coordinating data migration and systems setup on tight schedules.",
      "Built KPI frameworks and post-integration assessments that cut variance roughly 20%.",
      "Partnered with Finance & Accounting and the Integration Management Office, leading a 15+ person cross-functional team.",
    ],
  },
  {
    company: "OfferPad",
    role: "Property Success Manager",
    period: "2017-2018",
    backer: "PE-backed iBuyer (later public)",
    sector: "Real Estate / PropTech",
    highlight:
      "Operated inside one of the original iBuyer platforms at national scale.",
    points: [
      "Built national holding procedures and managed renovation scheduling for 500+ homes, with ~250 cycling per month.",
      "Modeled customer-acquisition cost and daily holding costs across MSAs, sharpening unit-economics visibility.",
      "Partnered with PE leadership on the financial models behind investment-committee decisions.",
    ],
  },
  {
    company: "Window Rock Capital Partners",
    role: "Associate",
    period: "2012-2015",
    backer: "Family Office Investment Arm",
    sector: "Real Estate / Funds",
    highlight:
      "Cut my teeth on the capital side: REIT accounting and fund structuring.",
    points: [
      "Built pro-forma models and pitch materials supporting raises of $100M+, and contributed to $50M+ funded into the platform.",
      "Developed underwriting criteria and acquisition and liquidation models aligned to fund return targets.",
      "Worked directly alongside the founder and senior leadership on investor communications.",
    ],
  },
  {
    company: "Copper Mountain Capital",
    role: "Founder",
    period: "2014-2021",
    backer: "Independent Advisory",
    sector: "Multi-Industry",
    highlight:
      "Founded an advisory practice, the forerunner to Growth by the Numbers.",
    points: [
      "Advised 15+ clients across real estate funds and mid-market operating companies on accounting, FP&A, and capital structuring.",
      "Built acquisition models across $200M+ in aggregate deal value and supported nationwide deal pipelines.",
      "Structured GP/LP funds and SPVs and ran property accounting for 200+ doors.",
    ],
  },
] as const;

// Hard-outcome case study cards.
export const results = [
  {
    metric: "$30M → $100M+",
    title: "From regional contractor to platform",
    sector: "PE-backed home services",
    body: "As President & CFO, professionalized finance and operating discipline to triple-plus revenue in three years, turning a founder-led business into an institutional-grade platform.",
  },
  {
    metric: "18%",
    title: "EBITDA growth, every year",
    sector: "Home services",
    body: "FP&A infrastructure, KPI dashboards, and SOPs created the visibility and accountability that compounded margin year over year.",
  },
  {
    metric: "20+ deals",
    title: "Acquisitions that actually integrate",
    sector: "Healthcare & home services",
    body: "Across two PE-backed platforms, led M&A from target evaluation through the post-close integration where most deals lose their synergies.",
  },
  {
    metric: "$2M+",
    title: "Found in the cost structure",
    sector: "Multi-entity operator",
    body: "Renegotiated banking, insurance, and vendor agreements, with annual savings that dropped straight to EBITDA and enterprise value.",
  },
] as const;

// What makes GBTN different.
export const differentiators = [
  {
    title: "Operator-first",
    body: "I translate finance into daily actions for GMs, dispatch, sales, and production, not slide decks nobody opens.",
  },
  {
    title: "PE-fluent",
    body: "IC-level models, KPI bridges, covenant reporting, and value-creation workstreams sponsors actually trust.",
  },
  {
    title: "I've actually done it",
    body: "I sat in the President and CFO seats of PE-backed companies and scaled one past $100M. This isn't theory.",
  },
  {
    title: "Hands-on, not hand-off",
    body: "We build the models and the cadence with you and run them alongside your team — founder-led by Tyler, delivered as a firm, not a slide deck tossed over the wall.",
  },
] as const;

// The book.
export const book = {
  title: "Growth by the Numbers",
  subtitle: "The operator's system for turning gut into truth.",
  blurb:
    "The four pillars, the numbers behind each one, and the weekly cadence that move smart, hardworking operators off gut instinct and onto a system that compounds.",
} as const;
