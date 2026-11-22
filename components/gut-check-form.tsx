"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { site } from "@/lib/site";
import { Check } from "./ui";
import {
  submitGutCheckAction,
  type GutCheckState,
} from "@/app/(marketing)/gut-check/actions";
import {
  GUT_CHECK,
  REVENUE_BANDS,
  DELIVERY_HEADACHES,
  OWNER_GOALS,
  BOOKKEEPERS,
  ACCOUNTING_SYSTEMS,
  FEATURE_PREFERENCES,
} from "@/lib/gut-check";

const initial: GutCheckState = {};

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1.5 block text-sm font-medium text-ink";
const hintCls = "font-normal text-muted-soft";

function Label({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={labelCls}>
      {children}
      {optional ? <span className={hintCls}> (optional)</span> : null}
    </label>
  );
}

function Group({ step, title, intro, first, children }: { step: string; title: string; intro: string; first?: boolean; children: ReactNode }) {
  return (
    <fieldset className={first ? "grid gap-4" : "grid gap-4 border-t border-line pt-8"}>
      <legend className="contents">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">{step}</span>
        <span className="mt-1 block text-lg font-bold tracking-tight text-ink">{title}</span>
      </legend>
      <p className="-mt-2 text-sm text-muted">{intro}</p>
      {children}
    </fieldset>
  );
}

function Select({ id, options, required }: { id: string; options: readonly { value: string; label: string }[]; required?: boolean }) {
  return (
    <select id={id} name={id} className={field} defaultValue="" required={required}>
      <option value="" disabled={required}>
        Select one
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function GutCheckForm() {
  const [state, action, pending] = useActionState(submitGutCheckAction, initial);
  const [system, setSystem] = useState("");

  if (state.ok) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-200 bg-brand-50/60 p-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-brand text-white">
          <Check className="text-white" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-ink">Your {GUT_CHECK.name} is in.</h3>
        <p className="mt-2 max-w-md text-sm text-muted">
          I read every submission myself. Next I&apos;ll reach out with a secure
          way to share your P&amp;L and balance sheet so I can build your
          snapshot. Check your inbox for a confirmation. Questions? Reach me at{" "}
          <a
            href={`mailto:${site.founder.email}`}
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            {site.founder.email}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-8">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Group first step="Section 1" title="The basics" intro="Who you are and the size of the business.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Your name</Label>
            <input id="name" name="name" required autoComplete="name" className={field} placeholder="Jane Owner" />
          </div>
          <div>
            <Label htmlFor="businessName">Business name</Label>
            <input id="businessName" name="businessName" required autoComplete="organization" className={field} placeholder="Owner Plumbing Co." />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="jane@company.com" />
          </div>
          <div>
            <Label htmlFor="phone" optional>Phone</Label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={field} placeholder="(555) 555 0123" />
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <input id="industry" name="industry" required className={field} placeholder="HVAC, engineering, real estate…" />
          </div>
          <div>
            <Label htmlFor="revenueBand">Annual revenue</Label>
            <Select id="revenueBand" options={REVENUE_BANDS} required />
          </div>
          <div>
            <Label htmlFor="teamSize" optional>Team size</Label>
            <input id="teamSize" name="teamSize" type="number" min={0} step={1} inputMode="numeric" className={field} placeholder="12" />
          </div>
          <div>
            <Label htmlFor="yearsInBusiness" optional>Years in business</Label>
            <input id="yearsInBusiness" name="yearsInBusiness" type="number" min={0} step={1} inputMode="numeric" className={field} placeholder="8" />
          </div>
        </div>
        <div>
          <Label htmlFor="servicesSold" optional>Services you sell</Label>
          <textarea id="servicesSold" name="servicesSold" rows={2} className={field} placeholder="Installs, repairs, maintenance agreements…" />
        </div>
      </Group>

      <Group step="Section 2" title="The four pillars" intro="Rough answers are fine. Your books fill in the real numbers later.">
        <div>
          <Label htmlFor="leadSources" optional>Attract: where do most of your leads come from?</Label>
          <textarea id="leadSources" name="leadSources" rows={2} className={field} placeholder="Google, referrals, Angi, repeat customers…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="marketingSpend" optional>Attract: monthly marketing spend ($)</Label>
            <input id="marketingSpend" name="marketingSpend" inputMode="decimal" className={field} placeholder="5,000" />
          </div>
          <div>
            <Label htmlFor="closeRate" optional>Convert: percent of quotes that close</Label>
            <input id="closeRate" name="closeRate" inputMode="decimal" className={field} placeholder="35" />
          </div>
        </div>
        <div>
          <Label htmlFor="bookProcess" optional>Book: what happens when a lead comes in, and who handles it?</Label>
          <textarea id="bookProcess" name="bookProcess" rows={2} className={field} placeholder="Calls go to our office manager, who books an estimate…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div>
            <Label htmlFor="deliveryHeadache" optional>Deliver: biggest headache</Label>
            <Select id="deliveryHeadache" options={DELIVERY_HEADACHES} />
          </div>
          <div>
            <Label htmlFor="deliveryNotes" optional>Tell me more</Label>
            <input id="deliveryNotes" name="deliveryNotes" className={field} placeholder="We can't hire techs fast enough…" />
          </div>
        </div>
      </Group>

      <Group step="Section 3" title="The owner" intro="What the numbers can't tell me.">
        <div>
          <Label htmlFor="sleeplessNumber" optional>The one number that keeps you up at night</Label>
          <input id="sleeplessNumber" name="sleeplessNumber" className={field} placeholder="Cash in the bank on payroll Friday" />
        </div>
        <div>
          <Label htmlFor="dialedInVision" optional>What does &ldquo;{GUT_CHECK.fixName.toLowerCase()}&rdquo; look like 12 months from now?</Label>
          <textarea id="dialedInVision" name="dialedInVision" rows={3} className={field} placeholder="15% net margin, a GM running the day to day, and Fridays off." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="ownerGoal" optional>Your goal</Label>
            <Select id="ownerGoal" options={OWNER_GOALS} />
          </div>
          <div>
            <Label htmlFor="bookkeeper" optional>Who does the books?</Label>
            <Select id="bookkeeper" options={BOOKKEEPERS} />
          </div>
          <div>
            <Label htmlFor="accountingSystem" optional>Accounting system</Label>
            <select
              id="accountingSystem"
              name="accountingSystem"
              className={field}
              value={system}
              onChange={(e) => setSystem(e.target.value)}
            >
              <option value="">Select one</option>
              {ACCOUNTING_SYSTEMS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {system === "other" ? (
          <div>
            <Label htmlFor="accountingSystemOther" optional>Which system?</Label>
            <input id="accountingSystemOther" name="accountingSystemOther" className={field} placeholder="Xero, Acumatica…" />
          </div>
        ) : null}

        <div>
          <p className={labelCls}>How would you like to be featured?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {FEATURE_PREFERENCES.map((o, i) => (
              <label
                key={o.value}
                className="flex cursor-pointer flex-col gap-1 rounded-xl border border-line bg-white p-4 text-sm has-[:checked]:border-brand-400 has-[:checked]:ring-2 has-[:checked]:ring-brand-100"
              >
                <span className="flex items-center gap-2 font-medium text-ink">
                  <input type="radio" name="featurePreference" value={o.value} required={i === 0} className="accent-brand-700" />
                  {o.label}
                </span>
                <span className="text-muted">{o.detail}</span>
              </label>
            ))}
          </div>
        </div>
      </Group>

      <div className="grid gap-4 border-t border-line pt-8">
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consent" value="yes" required className="mt-0.5 accent-brand-700" />
          <span>
            I&apos;m OK with Growth by the Numbers using these answers to prepare
            my snapshot and contact me about it. Nothing about my business goes
            on the show without a separate guest release I sign. See the{" "}
            <Link href="/privacy" className="font-medium text-brand-700 underline-offset-4 hover:underline">
              privacy policy
            </Link>
            .
          </span>
        </label>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-gradient-brand inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold text-white ring-soft transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Sending…" : `Get my ${GUT_CHECK.name}`}
        </button>
      </div>
    </form>
  );
}
