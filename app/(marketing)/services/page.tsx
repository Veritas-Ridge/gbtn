import type { Metadata } from "next";
import {
  Container,
  Section,
  Button,
  Arrow,
  Check,
  Eyebrow,
  SectionHeading,
} from "@/components/ui";
import { ProcessSteps, CtaBand } from "@/components/sections";
import {
  services,
  addOns,
  audiences,
  gutCheckStep,
  fixLabels,
  primaryCta,
} from "@/lib/site";
import { GUT_CHECK } from "@/lib/gut-check";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Start with a free Gut Check of your four pillars (Attract, Book, Convert, Deliver), then a productized ladder that gets the business dialed in: Diagnose, Install, Institutionalize.",
};

export default function ServicesPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div className="glow absolute inset-x-0 -top-24 h-80" />
        <Container className="relative py-20 text-center sm:py-28">
          <div className="mx-auto max-w-3xl">
            <Eyebrow>Services</Eyebrow>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
              From {GUT_CHECK.name} to{" "}
              <span className="text-gradient">{GUT_CHECK.fixName}.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              Start with a free Gut Check of your four pillars. Then a
              diagnostic, a build phase, and an optional cadence retainer, each
              aimed at the pillars that are leaking. Every engagement is scoped
              to one outcome: predictable profit and cash.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Service detail blocks ── */}
      <Section>
        <Container>
          <div className="space-y-8">
            <div
              id="gut-check"
              className="grid gap-8 rounded-3xl border border-brand-200 bg-white p-8 ring-card sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:gap-12"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-sm font-bold text-white">
                    00
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                    {gutCheckStep.tier}
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    {gutCheckStep.price}
                  </span>
                </div>
                <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {gutCheckStep.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  {gutCheckStep.summary}
                </p>
                <div className="mt-6">
                  <Button href={primaryCta.href} variant="primary">
                    {primaryCta.label} <Arrow />
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-paper-soft/60 p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                  What you get
                </p>
                <ul className="mt-5 space-y-3.5">
                  {gutCheckStep.points.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-3 text-sm leading-relaxed text-ink/85"
                    >
                      <Check className="text-brand-500" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {services.map((s, i) => (
              <div
                key={s.id}
                id={s.id}
                className="grid gap-8 rounded-3xl border border-line bg-white p-8 ring-soft sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:gap-12"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-sm font-bold text-white">
                      0{i + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
                      {s.tier}
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {s.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-muted">
                    {s.summary}
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-paper-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-soft">
                        Timeline
                      </p>
                      <p className="mt-1 text-sm font-bold text-ink">
                        {s.timeline}
                      </p>
                    </div>
                    <div className="rounded-xl bg-paper-soft p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-soft">
                        Ladder rung
                      </p>
                      <p className="mt-1 text-sm font-bold text-ink">
                        {s.rungLabel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-paper-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-soft">
                      Pillars it fixes
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.fixes.map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-ink/75"
                        >
                          {fixLabels[f]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-paper-soft p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-soft">
                      Best for
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {s.forWho}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-paper-soft/60 p-6 sm:p-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
                    What you get
                  </p>
                  <ul className="mt-5 space-y-3.5">
                    {s.deliverables.map((d) => (
                      <li
                        key={d}
                        className="flex items-start gap-3 text-sm leading-relaxed text-ink/85"
                      >
                        <Check className="text-brand-500" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Add-on modules ── */}
      <Section className="bg-paper-soft">
        <Container>
          <SectionHeading
            eyebrow="Add-on sprints"
            title="Targeted modules for a specific leak."
            intro="Bolt these onto any engagement, or run one standalone when you know exactly where the problem is."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {addOns.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white px-6 py-5 ring-soft"
              >
                <Check className="text-brand-500" />
                <span className="text-sm font-semibold text-ink">{a.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-soft">
            Scope depends on entity complexity: locations, acquisitions, data
            cleanliness, and systems. We size each engagement to fit — pricing is
            a conversation, not a rate card. Optional success-fee and
            advisory-equity structures available for the right fit.
          </p>
        </Container>
      </Section>

      {/* ── Who I serve ── */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Who we serve"
            title="Operator-led companies. One operating system."
            align="center"
          />
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border border-line bg-white p-7 ring-soft"
              >
                <h3 className="text-lg font-bold text-ink">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {a.body}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {a.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-sm text-ink/80"
                    >
                      <Check className="text-brand-500" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Process ── */}
      <Section>
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="A clear path from financial fog to financial command."
            align="center"
          />
          <div className="mt-14">
            <ProcessSteps />
          </div>
          <div className="mt-12 text-center">
            <Button href={primaryCta.href} variant="primary">
              Start with a {GUT_CHECK.name} <Arrow />
            </Button>
          </div>
        </Container>
      </Section>

      <CtaBand />
    </>
  );
}
