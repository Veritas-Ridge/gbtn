import Link from "next/link";
import {
  Container,
  Section,
  Button,
  Arrow,
  Check,
  Eyebrow,
  SectionHeading,
  Card,
} from "@/components/ui";
import {
  StatBar,
  LogoWall,
  ProcessSteps,
  CtaBand,
} from "@/components/sections";
import { WaitlistForm } from "@/components/waitlist-form";
import {
  positioning,
  primaryCta,
  services,
  gutCheckStep,
  fixLabels,
  differentiators,
  trackRecord,
  book,
} from "@/lib/site";
import { GUT_CHECK, PILLARS } from "@/lib/gut-check";

export default function HomePage() {
  return (
    <>
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div className="glow absolute inset-x-0 -top-32 h-[28rem]" />
        <div className="absolute -right-40 top-10 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <Container className="relative pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {positioning.badge}
            </span>
            <h1 className="animate-fade-up mt-6 text-balance text-4xl font-bold tracking-tight text-white sm:text-6xl">
              {positioning.hero.headline}{" "}
              <span className="text-gradient">{positioning.hero.accent}</span>
            </h1>
            <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              {positioning.hero.subhead} Founded by Tyler Briggs, who scaled a
              PE-backed platform from{" "}
              <span className="font-semibold text-white">$30M to $100M+</span>.
            </p>
            <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href={primaryCta.href} variant="primary">
                {primaryCta.label} <Arrow />
              </Button>
              <Button href="/contact" variant="light">
                Book a consultation
              </Button>
            </div>
          </div>

          <div className="animate-fade-up mt-16">
            <StatBar dark />
          </div>
        </Container>
      </section>

      <LogoWall />

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="The gap"
                title="Your bookkeeper keeps score. You need someone who can change it."
                intro="Most growing companies have someone recording history, and no one engineering the future. Clean books tell you what happened. They don't tell you where the margin is hiding, whether you can afford the next hire, or what your business is worth to a buyer."
              />
              <p className="mt-5 text-lg leading-relaxed text-muted">
                That&apos;s the difference between accounting and a CFO. I sit
                on the strategy side of the numbers: forecasting cash,
                pressure-testing decisions, and building the financial engine
                that compounds value quarter after quarter.
              </p>
              <div className="mt-8">
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-600"
                >
                  See how we work <Arrow />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {differentiators.map((d) => (
                <Card key={d.title} className="p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Check className="text-brand-600" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    {d.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {d.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section className="bg-paper-soft">
        <Container>
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              eyebrow="The offer ladder"
              title={`Start with a free ${GUT_CHECK.name}. Then three engagements to get you ${GUT_CHECK.fixName}.`}
            />
            <Button href="/services" variant="ghost">
              All services <Arrow />
            </Button>
          </div>

          <div className="mt-12 flex flex-col gap-6 rounded-2xl border border-brand-200 bg-white p-7 ring-card lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                  {gutCheckStep.tier}
                </span>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {gutCheckStep.price}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold tracking-tight text-ink">
                {gutCheckStep.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {gutCheckStep.summary}
              </p>
            </div>
            <Button href={primaryCta.href} variant="primary" className="shrink-0">
              {primaryCta.label} <Arrow />
            </Button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.id}
                className="group flex flex-col rounded-2xl border border-line bg-white p-7 ring-card transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                    {s.tier}
                  </span>
                  <span className="text-xs font-medium text-muted-soft">
                    {s.timeline}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-ink">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {s.summary}
                </p>
                <ul className="mt-6 space-y-2.5">
                  {s.deliverables.slice(0, 3).map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2.5 text-sm text-ink/80"
                    >
                      <Check className="text-brand-500" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {s.fixes.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-line bg-paper-soft px-2.5 py-0.5 text-xs font-medium text-ink/70"
                    >
                      {fixLabels[f]}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between pt-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-soft">
                    {s.rungLabel}
                  </span>
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors group-hover:text-brand-600"
                  >
                    Details <Arrow />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div className="glow absolute inset-x-0 -top-20 h-64" />
        <Container className="relative py-20 sm:py-28">
          <SectionHeading
            eyebrow="The method"
            title="Four pillars. Every service business runs them."
            intro="Leads come in, get booked, close, and get delivered. Each step has a number that tells you whether it's working, and every dollar you spend funds one of them. The Gut Check scores all four, so you fix the leak that costs the most first."
            dark
          />

          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <li
                key={p.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur"
              >
                <span className="text-gradient text-3xl font-bold tracking-tight">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {p.body}
                </p>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-400">
                  {p.headline}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-400">
                The Gut Check scorecard
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                The numbers I score for each pillar, plus the scoreboard they
                add up to: growth, EBITDA margin and cash. Print it and run it
                every week.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button href={primaryCta.href} variant="primary">
                {primaryCta.label} <Arrow />
              </Button>
              <Button href="/metrics" variant="light">
                Get the scorecard
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <SectionHeading
              eyebrow="The track record"
              title="A résumé of value created, not just hours billed."
              intro="I've spent my career inside the companies private equity builds, sitting in the President and CFO seats, integrating acquisitions, and answering to boards. This is the experience your business gets access to."
            />
            <div className="space-y-4">
              {trackRecord.slice(0, 3).map((t) => (
                <div
                  key={t.company}
                  className="rounded-2xl border border-line bg-white p-6 ring-soft"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-ink">
                      {t.company}
                    </h3>
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {t.backer}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-muted">
                    {t.role} · {t.period}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/80">
                    {t.highlight}
                  </p>
                </div>
              ))}
              <Link
                href="/about"
                className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand-700 hover:text-brand-600"
              >
                See the full track record <Arrow />
              </Link>
            </div>
          </div>
        </Container>
      </Section>

      <Section className="bg-paper-soft">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="A clear path from financial fog to financial command."
            align="center"
          />
          <div className="mt-14">
            <ProcessSteps />
          </div>
        </Container>
      </Section>

      <Section id="waitlist" className="bg-paper-soft">
        <Container>
          <div className="grid items-center gap-8 rounded-3xl border border-line bg-white p-8 ring-soft sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
            <div>
              <Eyebrow>The book</Eyebrow>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {book.title}
              </h3>
              <p className="mt-1 text-base font-medium text-brand-700">
                {book.subtitle}
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted">
                {book.blurb}
              </p>
              <WaitlistForm />
            </div>
            <div className="flex flex-wrap gap-2.5">
              {PILLARS.map((p) => (
                <span
                  key={p.key}
                  className="rounded-full border border-line bg-paper-soft px-4 py-2 text-sm font-medium text-ink/75"
                >
                  {p.name} · {p.headline}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <figure className="mx-auto max-w-3xl text-center">
            <div className="text-gradient text-5xl font-bold leading-none">
              &ldquo;
            </div>
            <blockquote className="mt-4 text-balance text-2xl font-medium leading-relaxed tracking-tight text-ink sm:text-3xl">
              Tyler walked into a fast-growth mess and gave us a financial
              operating system. For the first time, we made decisions on data
              instead of gut.
            </blockquote>
            <figcaption className="mt-6 text-sm font-medium text-muted">
              Owner &amp; Founder, PE-backed home services platform
            </figcaption>
          </figure>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
