import type { Metadata } from "next";
import {
  Container,
  Section,
  Button,
  Arrow,
  Eyebrow,
  SectionHeading,
} from "@/components/ui";
import { CtaBand } from "@/components/sections";
import { WaitlistForm } from "@/components/waitlist-form";
import { metricGroups } from "@/lib/metric-guide";
import { book, primaryCta } from "@/lib/site";

export const metadata: Metadata = {
  title: "The Gut Check scorecard",
  description:
    "The operator one-pager: the numbers behind Attract, Book, Convert and Deliver, plus the scoreboard they add up to. Email unlocks the printable sheet and the book waitlist.",
};

export default function MetricsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div className="glow absolute inset-x-0 -top-24 h-80" />
        <Container className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Lead magnet</Eyebrow>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
              The Gut Check scorecard.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              Not a dashboard dump. The numbers behind your four pillars
              (Attract, Book, Convert and Deliver) plus the scoreboard they add
              up to. Drop your email, print the one-pager, and you&apos;re on the
              book waitlist.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/10 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              Unlock the one-pager
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">
              Print it. Stick it on the wall. Run it every week.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Same waitlist as {book.title}. Source tagged as metrics so we know
              how you found us.
            </p>
            <WaitlistForm source="metrics" idPrefix="metrics" />
          </div>
        </Container>
      </section>

      <Section className="bg-paper-soft">
        <Container>
          <SectionHeading
            eyebrow="The scorecard"
            title="The numbers behind each pillar."
            intro="One sentence each. Every pillar gets its own numbers, then the scoreboard shows what they add up to. These are the same numbers I score on every Gut Check."
          />
          <div className="mt-12 space-y-10">
            {metricGroups.map((g) => (
              <div key={g.key}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-xl font-bold tracking-tight text-ink">{g.label}</h3>
                  <p className="text-sm text-muted">{g.intro}</p>
                </div>
                <ol className="mt-4 grid gap-4">
                  {g.metrics.map((m) => (
                    <li
                      key={m.name}
                      className="rounded-2xl border border-line bg-white p-6 ring-soft sm:p-7"
                    >
                      <h4 className="text-lg font-semibold text-ink">{m.name}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{m.why}</p>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-10 text-sm text-muted">
            After you submit, you&apos;ll get a print ready sheet. Or go straight to{" "}
            <a
              href="/metrics/print"
              className="font-semibold text-brand-700 underline-offset-4 hover:underline"
            >
              the one-pager
            </a>{" "}
            once you&apos;re on the list.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              eyebrow="Next"
              title="A sheet on the wall is the start. The cadence is the system."
              intro="Not sure which pillar is leaking? Send in your numbers and I'll score all four for free."
            />
            <Button href={primaryCta.href} variant="primary">
              {primaryCta.label} <Arrow />
            </Button>
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
