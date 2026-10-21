import { CtaButton } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import { SectionLabel } from "./SectionLabel";
import {
  FileCheck2,
  Fingerprint,
  ShieldCheck,
  Sliders,
  Truck,
} from "lucide-react";

const principles = [
  {
    Icon: Sliders,
    title: "The appraisal sets the limit",
    body: "Cover is written against the documented value of that object — the assay for bullion, the stone-by-stone appraisal for gems — not a household contents estimate.",
  },
  {
    Icon: ShieldCheck,
    title: "One policy, named perils",
    body: "Theft, physical damage, water and fire, and loss in transit are stated on the schedule. Anything excluded is written down, not buried.",
  },
  {
    Icon: Truck,
    title: "Cover follows the object",
    body: "When the drawer closes behind a release, the same policy is in force on the road, in the air and at the destination until signature.",
  },
];

const perils = ["Theft", "Damage", "Fire & flood", "Transit loss", "Natural disaster"];
const policyRows = [
  ["Policy", "Cosmic All-Risk · CV-P-8842"],
  ["Insured object", "Sovereign 1 kg Gold Bar · CV-A-1042"],
  ["Coverage", "£786,400 · agreed value"],
  ["Premium", "£3,045 per year · monthly available"],
  ["Deductible", "£7,850 per claim"],
  ["Term", "10 Sep 2026 → 10 Sep 2027"],
];

export function Plans({ onReview }: { onReview: () => void }) {
  return (
    <section id="cover" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/65">Object insurance</SectionLabel>
            <h2 className="mt-4 max-w-xl text-balance text-[clamp(2.1rem,4.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Every object gets its own{" "}
              <span className="text-electric">policy number.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.92rem] leading-7 text-muted-foreground">
              A blanket contents policy is a promise about a shelf. This is a
              promise about a specific bar, stone or specimen — with its weight,
              its certificate and its drawer written into the schedule.
            </p>
            <a
              href="#tracking"
              className="link-slide mt-4 inline-flex w-fit pb-0.5 text-sm font-medium text-electric"
            >
              See how a release stays covered
            </a>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8">
          <Reveal y={28}>
            <figure className="relative h-full overflow-hidden rounded-[4px] border border-line bg-card shadow-[0_28px_60px_-46px_rgba(8,18,39,0.55)]">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Certificate of insurance
                  </p>
                  <p className="mt-1 text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
                    Cosmic All-Risk
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  In force
                </span>
              </div>

              <dl className="divide-y divide-line px-5 sm:px-6">
                {policyRows.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-6 py-3">
                    <dt className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="max-w-[62%] text-right text-[0.76rem] font-medium leading-5 text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="border-t border-line px-5 py-4 sm:px-6">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Insured perils
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {perils.map((peril) => (
                    <li
                      key={peril}
                      className="rounded-[4px] border border-line bg-ice/60 px-2 py-1 text-[0.62rem] font-medium text-ink/75"
                    >
                      {peril}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line bg-ice/30 px-5 py-3.5 sm:px-6">
                <p className="inline-flex items-center gap-2 text-[0.62rem] text-muted-foreground">
                  <FileCheck2 className="size-3.5 text-primary" />
                  Schedule, wording and appraisal attached
                </p>
                <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-primary">
                  <Fingerprint className="size-3.5" />
                  Dual-signed
                </span>
              </div>
              <figcaption className="border-t border-line px-5 py-2.5 text-[0.56rem] text-muted-foreground sm:px-6">
                Example schedule from the demonstration ledger. Actual terms
                follow the appraisal and the policy wording in force.
              </figcaption>
            </figure>
          </Reveal>

          <div className="flex flex-col justify-between gap-6">
            {principles.map(({ Icon, title, body }, index) => (
              <Reveal key={title} delay={0.08 + index * 0.06}>
                <article className="flex gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0 sm:gap-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className="text-[1.02rem] font-semibold tracking-[-0.02em] text-ink">
                      {title}
                    </h3>
                    <p className="mt-1.5 max-w-md text-[0.84rem] leading-6 text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}

            <Reveal delay={0.24}>
              <div className="rounded-[4px] border border-line bg-ice/40 px-5 py-4">
                <p className="text-[0.82rem] font-semibold text-ink">
                  Arrived without cover?
                </p>
                <p className="mt-1 text-[0.78rem] leading-6 text-muted-foreground">
                  We bind a policy at the deposit table. Until it is signed, the
                  record says <span className="font-medium text-ink">Not insured</span> — never
                  quietly assumed to be covered.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.28}>
              <div className="flex flex-wrap items-center gap-4">
                <CtaButton onClick={onReview}>Ask for a policy schedule</CtaButton>
                <p className="text-xs leading-5 text-muted-foreground">
                  Indicative terms only · no charge until issue
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
