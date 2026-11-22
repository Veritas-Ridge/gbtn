import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import { site } from "@/lib/site";
import { GUT_CHECK } from "@/lib/gut-check";

// Guest release for the Gut Check show. Lives in the (print) group so it
// prints clean to PDF for the e-sign flow. Bump VERSION on any wording change
// so a signed copy can always be matched to the text the guest agreed to.
const VERSION = "1.0";
const EFFECTIVE = "November 22, 2026";

export const metadata: Metadata = {
  title: `${GUT_CHECK.name} guest release`,
  description: `The agreement a featured ${GUT_CHECK.name} guest signs before an episode is published: what can be shown, anonymity, review, withdrawal and how your data is handled.`,
  robots: { index: false, follow: true },
};

function Term({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="text-base font-semibold text-navy-2">
        {n}. {title}
      </h2>
      <div className="mt-1.5 space-y-2 text-[13.5px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Box({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-[3px] inline-block h-3.5 w-3.5 shrink-0 border border-navy-2" />
      <span>{children}</span>
    </li>
  );
}

function Line({ label }: { label: string }) {
  return (
    <div>
      <div className="h-7 border-b border-navy-2/60" />
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-soft">{label}</p>
    </div>
  );
}

export default function GutCheckReleasePage() {
  const owner = `${site.legalName}, doing business as ${site.name} ("${site.shortName}")`;
  return (
    <div className="min-h-screen bg-cream text-paper-ink">
      <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={GUT_CHECK.path}
            className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            ← Back to {GUT_CHECK.name}
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-lg border border-line bg-white p-8 ring-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="border-b border-crimson pb-4">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-crimson">
              {site.shortName} · {GUT_CHECK.name} show
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-2">Guest release</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This release is between you (the &ldquo;Guest&rdquo;), the business you
              represent (the &ldquo;Business&rdquo;), and {owner}. It covers your
              appearance on {GUT_CHECK.name}, where {site.founder.name} reviews a
              business&apos;s numbers across the four pillars (Attract, Book, Convert,
              Deliver) and lays out a {GUT_CHECK.fixName} plan. Private reviews are
              never published and do not need this release.
            </p>
            <p className="mt-2 text-xs text-muted-soft">
              Version {VERSION} · Effective {EFFECTIVE}
            </p>
          </header>

          <div className="mt-6 space-y-5">
            <Term n={1} title="Your feature level">
              <p>Check one. This controls everything shown or said about you and the Business.</p>
              <ul className="space-y-2">
                <Box>
                  <span className="font-semibold text-ink">Named.</span> We may use your name,
                  the Business&apos;s name and logo, your image and voice, and the financial
                  figures discussed in the session, including dollar amounts.
                </Box>
                <Box>
                  <span className="font-semibold text-ink">Anonymous.</span> We will not show or
                  say your name, the Business&apos;s name, logo, website, street address, or any
                  location narrower than your state, and we will not name your employees,
                  customers or vendors. Figures appear only as percentages, ratios or indexed
                  values, never as dollar amounts. Industry and revenue band may be described.
                </Box>
              </ul>
              <p>If Anonymous, check how you appear on the recording:</p>
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                <Box>Voice only</Box>
                <Box>Not at all ({site.founder.name} presents alone)</Box>
                <Box>On camera</Box>
              </ul>
            </Term>

            <Term n={2} title="What you allow us to do">
              <p>
                You allow {site.shortName} to record the session on video and audio, edit it, and
                publish the recording and excerpts from it, within your feature level, on YouTube,
                podcast platforms, short-form video, LinkedIn and other social media, the{" "}
                {site.shortName} website, newsletters and other {site.shortName} marketing,
                worldwide and without a time limit, subject to Sections 5 and 6. Edits will not
                misrepresent what you said or the Business&apos;s results.
              </p>
            </Term>

            <Term n={3} title="What we will never show">
              <ul className="ml-4 list-disc space-y-1">
                <li>
                  Personal information about your customers, including anything drawn from your
                  CRM, phone system or ad accounts. That data is used only in totals such as lead
                  counts and conversion rates.
                </li>
                <li>Pay for any named or identifiable employee.</li>
                <li>Bank or account numbers, tax IDs, login details or contract terms.</li>
                <li>
                  Owner compensation, owner draws or personal finances, unless you agree in writing
                  before the session.
                </li>
              </ul>
            </Term>

            <Term n={4} title="Your data">
              <p>
                Information you share is handled under our{" "}
                <span className="font-medium text-ink">
                  Privacy Policy at {site.domain}/privacy
                </span>
                . Accounting connections are read-only: we never create, change or delete anything
                in your books. Beyond what your feature level allows on air, we keep your
                information confidential and use it only to prepare your snapshot, the episode and
                any follow-up you ask for.
              </p>
            </Term>

            <Term n={5} title="Review before publishing">
              <p>
                We will send you the edited episode at least three business days before it is
                published. You may ask us to fix a factual error, or to remove anything that
                identifies you or the Business beyond your feature level, and we will make that
                change before publishing.
              </p>
            </Term>

            <Term n={6} title="Changing your mind">
              <p>
                Before publication, you may withdraw by emailing {site.founder.email}, and we will
                not publish the recording. Once an episode or excerpt is published, the permission
                in Section 2 cannot be withdrawn and {site.shortName} is not required to take it
                down. Your feature level and Section 3 continue to apply to every later use.
              </p>
            </Term>

            <Term n={7} title="Not professional advice">
              <p>
                {GUT_CHECK.name} is educational content. It is not personalized accounting, tax,
                legal or investment advice, and appearing on the show does not make you or the
                Business a {site.shortName} client. A client relationship exists only under a
                separate signed engagement agreement.
              </p>
            </Term>

            <Term n={8} title="What you receive">
              <p>
                You will not be paid for appearing. As a featured guest you receive a complimentary
                30 day follow-up and a written {GUT_CHECK.fixName} plan for the Business.
              </p>
            </Term>

            <Term n={9} title="Your promises">
              <p>
                You are at least 18, you have authority to share the Business&apos;s information
                and to sign for it, and what you share is accurate to the best of your knowledge.
              </p>
            </Term>

            <Term n={10} title="General">
              <p>
                This release is governed by Arizona law. It is the full agreement about your
                appearance on {GUT_CHECK.name} and can be changed only in writing signed by both
                sides. Electronic signatures count as originals.
              </p>
            </Term>
          </div>

          <div className="mt-8 grid break-inside-avoid gap-8 border-t border-line pt-6 sm:grid-cols-2 print:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-navy-2">Guest, for self and the Business</p>
              <Line label="Signature" />
              <Line label="Printed name" />
              <Line label="Title" />
              <Line label="Business" />
              <Line label="Email" />
              <Line label="Date" />
            </div>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-navy-2">{site.name}</p>
              <Line label="Signature" />
              <div>
                <div className="flex h-7 items-end border-b border-navy-2/60 text-sm text-ink">
                  {site.founder.name}
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-soft">
                  Printed name
                </p>
              </div>
              <div>
                <div className="flex h-7 items-end border-b border-navy-2/60 text-sm text-ink">
                  {site.founder.title}
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-soft">
                  Title
                </p>
              </div>
              <Line label="Date" />
            </div>
          </div>

          <footer className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted-soft">
            <p>
              {site.legalName} dba {site.name} · {site.founder.location} ·{" "}
              {site.founder.email} · {GUT_CHECK.name} guest release v{VERSION}
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
