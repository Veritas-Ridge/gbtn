import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { GutCheckForm } from "@/components/gut-check-form";
import { GUT_CHECK } from "@/lib/gut-check";

export const metadata: Metadata = {
  title: `Get your ${GUT_CHECK.name}`,
  description:
    "Submit your business for a Gut Check: Tyler Briggs walks through your four pillars (Attract, Book, Convert, Deliver) and what it takes to get dialed in. On the show named, anonymous, or as a private review.",
};

const steps = [
  { n: "1", title: "Tell me about the business", body: "About two minutes. Rough answers are fine." },
  { n: "2", title: "Share your books", body: "I'll send a secure way to share your P&L and balance sheet." },
  { n: "3", title: "Get your Gut Check", body: "On the show, or privately. Your call, and nothing airs without your release." },
];

const pillars = [
  { name: "Attract", body: "Where leads come from and what each one costs." },
  { name: "Book", body: "How fast leads get to a booked next step." },
  { name: "Convert", body: "How many booked opportunities close." },
  { name: "Deliver", body: "Whether the work makes the margin it should." },
];

export default function GutCheckPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-50" />
        <div className="glow absolute inset-x-0 -top-24 h-72" />
        <Container className="relative py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>The show</Eyebrow>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Want your {GUT_CHECK.name}?
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Each week one owner sends in their numbers and I walk through
              their four pillars live: what&apos;s working, what&apos;s leaking,
              and the {GUT_CHECK.fixName} plan to fix it. Be on the show named,
              anonymous, or keep it private.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink">How it works</h2>
              <ol className="mt-6 space-y-5">
                {steps.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-white">
                      {s.n}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{s.title}</p>
                      <p className="mt-1 text-sm text-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-sm text-muted">
                Featured guests sign a short{" "}
                <Link
                  href={`${GUT_CHECK.path}/release`}
                  className="font-medium text-brand-700 underline-offset-4 hover:underline"
                >
                  guest release
                </Link>{" "}
                that sets exactly what can be shown. You review the episode before it airs.
              </p>

              <h2 className="mt-12 text-xl font-bold tracking-tight text-ink">The four pillars</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Every service business runs the same four stages. I score each one.
              </p>
              <dl className="mt-6 space-y-4">
                {pillars.map((p) => (
                  <div key={p.name} className="rounded-2xl border border-line bg-paper-soft p-4">
                    <dt className="text-sm font-semibold text-ink">{p.name}</dt>
                    <dd className="mt-1 text-sm text-muted">{p.body}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-3xl border border-line bg-white p-7 ring-card sm:p-9">
              <GutCheckForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
