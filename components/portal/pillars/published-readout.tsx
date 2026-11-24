import { rangeLabel } from "@/lib/vantage/analysis";
import type { Publication } from "@/lib/vantage/publish";
import { site } from "@/lib/site";

/** What the analyst chose to share from the readout, on the client's Four Pillars page. */
export function PublishedReadout({ pub }: { pub: Publication }) {
  const when = new Date(pub.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="rounded-2xl border border-line bg-white p-5 ring-soft">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm font-semibold text-ink">What the books say</p>
        <p className="text-xs text-muted-soft">
          From {site.founder.name}, {when}
          {pub.coversFrom && pub.coversTo ? ` · ${rangeLabel(pub.coversFrom, pub.coversTo)}` : ""}
        </p>
      </div>
      {pub.note ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{pub.note}</p> : null}
      {pub.findings.length ? (
        <ul className="mt-4 space-y-3">
          {pub.findings.map((f, i) => (
            <li key={`${f.kind}-${f.from}-${i}`} className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">{f.title}</p>
              <p className="mt-1 text-sm text-muted">{f.detail}</p>
              <p className="mt-2 border-l-2 border-crimson pl-3 text-sm text-ink">
                <span className="font-semibold">To talk through:</span> {f.question}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
