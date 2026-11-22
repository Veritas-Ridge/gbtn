"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout, CONTACT_NOTIFY_TO } from "@/lib/email";
import { ingestFormSubmission } from "@/lib/crm/service";
import {
  GUT_CHECK,
  REVENUE_BANDS,
  DELIVERY_HEADACHES,
  OWNER_GOALS,
  BOOKKEEPERS,
  ACCOUNTING_SYSTEMS,
  FEATURE_PREFERENCES,
  valuesOf,
  labelOf,
} from "@/lib/gut-check";

export type GutCheckState = { ok?: boolean; error?: string };

// Blank optional fields arrive as "", which should read as "not answered".
const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional()
  );
const optNumber = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => {
      if (v == null) return undefined;
      const s = String(v).replace(/[$,%\s]/g, "");
      return s === "" ? undefined : Number(s);
    },
    z.number({ error: msg }).min(min, msg).max(max, msg).optional()
  );
const optEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(values).optional());

const schema = z.object({
  // Section 1, the basics
  name: z.string().trim().min(1, "Please add your name.").max(120),
  businessName: z.string().trim().min(1, "Please add your business name.").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: optText(40),
  industry: z.string().trim().min(1, "Tell me your industry.").max(120),
  servicesSold: optText(1000),
  revenueBand: z.enum(valuesOf(REVENUE_BANDS), { error: "Pick a revenue band." }),
  teamSize: optNumber(0, 100000, "Team size should be a whole number."),
  yearsInBusiness: optNumber(0, 200, "Years in business should be a number."),

  // Section 2, the four pillars
  leadSources: optText(2000),
  marketingSpend: optNumber(0, 100_000_000, "Monthly marketing spend should be a dollar amount."),
  bookProcess: optText(2000),
  closeRate: optNumber(0, 100, "Close rate should be a percent from 0 to 100."),
  deliveryHeadache: optEnum(valuesOf(DELIVERY_HEADACHES)),
  deliveryNotes: optText(2000),

  // Section 3, the owner
  sleeplessNumber: optText(1000),
  dialedInVision: optText(2000),
  ownerGoal: optEnum(valuesOf(OWNER_GOALS)),
  bookkeeper: optEnum(valuesOf(BOOKKEEPERS)),
  accountingSystem: optEnum(valuesOf(ACCOUNTING_SYSTEMS)),
  accountingSystemOther: optText(120),
  featurePreference: z.enum(valuesOf(FEATURE_PREFERENCES), {
    error: "Choose how you'd like to be featured.",
  }),
  consent: z.literal("yes", { error: "Please confirm I can use your answers to prepare your snapshot." }),
});

type Parsed = z.infer<typeof schema>;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const FIELDS = [
  "name", "businessName", "email", "phone", "industry", "servicesSold", "revenueBand",
  "teamSize", "yearsInBusiness", "leadSources", "marketingSpend", "bookProcess",
  "closeRate", "deliveryHeadache", "deliveryNotes", "sleeplessNumber", "dialedInVision",
  "ownerGoal", "bookkeeper", "accountingSystem", "accountingSystemOther",
  "featurePreference", "consent",
] as const;

// Plain text recap for the CRM activity body.
function summary(d: Parsed): string {
  const lines: [string, string | number | undefined][] = [
    ["Industry", d.industry],
    ["Services", d.servicesSold],
    ["Revenue", labelOf(REVENUE_BANDS, d.revenueBand)],
    ["Team size", d.teamSize],
    ["Years in business", d.yearsInBusiness],
    ["Attract: lead sources", d.leadSources],
    ["Attract: monthly marketing spend", d.marketingSpend != null ? `$${d.marketingSpend.toLocaleString("en-US")}` : undefined],
    ["Book: lead handling", d.bookProcess],
    ["Convert: close rate", d.closeRate != null ? `${d.closeRate}%` : undefined],
    ["Deliver: biggest headache", d.deliveryHeadache ? labelOf(DELIVERY_HEADACHES, d.deliveryHeadache) : undefined],
    ["Deliver: notes", d.deliveryNotes],
    ["Number that keeps them up", d.sleeplessNumber],
    ["Dialed in in 12 months", d.dialedInVision],
    ["Goal", d.ownerGoal ? labelOf(OWNER_GOALS, d.ownerGoal) : undefined],
    ["Books done by", d.bookkeeper ? labelOf(BOOKKEEPERS, d.bookkeeper) : undefined],
    ["Accounting system", d.accountingSystem === "other" ? d.accountingSystemOther ?? "Other" : d.accountingSystem ? labelOf(ACCOUNTING_SYSTEMS, d.accountingSystem) : undefined],
    ["Feature preference", labelOf(FEATURE_PREFERENCES, d.featurePreference)],
  ];
  return lines
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export async function submitGutCheckAction(
  _prev: GutCheckState,
  formData: FormData
): Promise<GutCheckState> {
  // Honeypot: real users never fill this hidden field. Pretend success.
  if (String(formData.get("website") ?? "")) return { ok: true };

  const raw: Record<string, unknown> = {};
  for (const f of FIELDS) raw[f] = formData.get(f) ?? undefined;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;
  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
  const recap = summary(d);

  // 1. Persist first: the submission must survive even if email later fails.
  let submissionId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("gut_check_submissions")
      .insert({
        name: d.name,
        business_name: d.businessName,
        email: d.email,
        phone: d.phone ?? null,
        industry: d.industry,
        services_sold: d.servicesSold ?? null,
        revenue_band: d.revenueBand,
        team_size: d.teamSize != null ? Math.round(d.teamSize) : null,
        years_in_business: d.yearsInBusiness != null ? Math.round(d.yearsInBusiness) : null,
        attract_lead_sources: d.leadSources ?? null,
        attract_monthly_spend: d.marketingSpend ?? null,
        book_process: d.bookProcess ?? null,
        convert_close_rate_pct: d.closeRate ?? null,
        deliver_headache: d.deliveryHeadache ?? null,
        deliver_notes: d.deliveryNotes ?? null,
        sleepless_number: d.sleeplessNumber ?? null,
        dialed_in_vision: d.dialedInVision ?? null,
        owner_goal: d.ownerGoal ?? null,
        bookkeeper: d.bookkeeper ?? null,
        accounting_system: d.accountingSystem ?? null,
        accounting_system_other: d.accountingSystem === "other" ? d.accountingSystemOther ?? null : null,
        feature_preference: d.featurePreference,
        consented_at: new Date().toISOString(),
        user_agent: userAgent,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    submissionId = data?.id ?? null;

    // Mirror into the CRM (best effort; never blocks the submission).
    const contactId = await ingestFormSubmission(admin, {
      name: d.name,
      email: d.email,
      company: d.businessName,
      revenue: labelOf(REVENUE_BANDS, d.revenueBand),
      message: recap,
      submissionId,
      source: "gut_check",
      subject: `${GUT_CHECK.name} submission`,
      meta: { feature_preference: d.featurePreference },
    });
    if (contactId && submissionId) {
      await admin.from("gut_check_submissions").update({ crm_contact_id: contactId }).eq("id", submissionId);
    }
  } catch (e) {
    console.error("[gut-check] save failed:", e);
    return {
      error:
        "Something went wrong saving your submission. Please email me directly at " +
        CONTACT_NOTIFY_TO +
        ".",
    };
  }

  // 2. Notify GBTN (best effort). Record whether it sent.
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#9a958c;white-space:nowrap;vertical-align:top">${label}</td><td style="color:#11294a;white-space:pre-wrap"><strong>${value}</strong></td></tr>`;
  const html = emailLayout({
    heading: `New ${GUT_CHECK.name} submission`,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;">
        ${row("Name", esc(d.name))}
        ${row("Business", esc(d.businessName))}
        ${row("Email", `<a href="mailto:${esc(d.email)}" style="color:#16335b">${esc(d.email)}</a>`)}
        ${row("Phone", esc(d.phone ?? "Not given"))}
      </table>
      <p style="margin:18px 0 6px;color:#9a958c;font-size:13px">Answers</p>
      <p style="margin:0;white-space:pre-wrap;border-left:3px solid #9e2335;padding-left:14px;color:#3a4252">${esc(recap)}</p>`,
    footnote: "Reply directly to this email to reach the owner. Nothing airs without a signed guest release.",
  });
  const sent = await sendEmail({
    subject: `${GUT_CHECK.name}: ${d.businessName} (${labelOf(REVENUE_BANDS, d.revenueBand)})`,
    html,
    replyTo: d.email,
  });
  if (sent.ok && submissionId) {
    try {
      const admin = createAdminClient();
      await admin.from("gut_check_submissions").update({ notified: true }).eq("id", submissionId);
    } catch {
      /* non-fatal: the submission is stored regardless */
    }
  } else if (!sent.ok) {
    console.error("[gut-check] notification email failed:", sent.error);
  }

  // 3. Confirm to the owner (best effort).
  const first = d.name.split(" ")[0] || d.name;
  const confirmed = await sendEmail({
    to: d.email,
    subject: `Your ${GUT_CHECK.name} submission is in`,
    html: emailLayout({
      heading: `Your ${GUT_CHECK.name} submission is in`,
      bodyHtml: `
        <p style="margin:0 0 12px">Hi ${esc(first)},</p>
        <p style="margin:0 0 12px">Thanks for sending in ${esc(d.businessName)}. I read every submission myself.</p>
        <p style="margin:0 0 12px">Next step: I'll reach out with a secure way to share your P&amp;L and balance sheet so I can build your snapshot across the four pillars: Attract, Book, Convert, Deliver.</p>
        <p style="margin:0">Nothing goes on the show without your sign off on a separate guest release. You picked: <strong>${esc(labelOf(FEATURE_PREFERENCES, d.featurePreference))}</strong>. You can change that any time by replying to this email.</p>`,
      footnote: `${GUT_CHECK.name} submission confirmation.`,
    }),
  });
  if (!confirmed.ok) {
    console.error("[gut-check] owner confirmation failed:", confirmed.error);
  }

  return { ok: true };
}
