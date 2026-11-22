import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { metricGroups } from "@/lib/metric-guide";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gut Check scorecard",
  description:
    "Printable operator one-pager: the numbers behind Attract, Book, Convert and Deliver, plus the company scoreboard.",
  robots: { index: false, follow: true },
};

export default function MetricsPrintPage() {
  return (
    <div className="min-h-screen bg-cream text-paper-ink">
      <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/metrics"
            className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            ← Back to the metrics page
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-lg border border-line bg-white p-8 ring-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="border-b border-crimson pb-4">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-crimson">
              {site.shortName} · Operator one-pager
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-2">
              The Gut Check scorecard
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Four pillars, the numbers behind each, and the scoreboard they add
              up to. Run these weekly. One number drifting is a decision; a whole
              pillar drifting is a story you tell the board too late.
            </p>
          </header>

          {metricGroups.map((g) => (
            <section key={g.key} className="mt-5 break-inside-avoid">
              <h2 className="font-label text-[12px] font-semibold uppercase tracking-[0.18em] text-crimson">
                {g.label} <span className="normal-case tracking-normal text-muted">· {g.intro}</span>
              </h2>
              <ol className="mt-1 divide-y divide-line">
                {g.metrics.map((m) => (
                  <li key={m.name} className="py-2.5">
                    <h3 className="text-base font-semibold text-navy-2">{m.name}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{m.why}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <footer className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted-soft">
            <p>
              Growth by the Numbers · {site.founder.name} ·{" "}
              {site.url.replace("https://", "")} · {site.founder.email}
            </p>
            <p className="mt-1">
              Print this page (Ctrl/Cmd+P) and choose Save as PDF. Not advice; a
              scorecard. Get a free Gut Check at {site.url.replace("https://", "")}/gut-check
              if the numbers don&apos;t match the story.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
