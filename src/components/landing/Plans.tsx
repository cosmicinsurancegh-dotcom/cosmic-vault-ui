import { CtaButton } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import { ShieldCheck, Sliders, Timer } from "lucide-react";
import { Link } from "react-router";
import { SectionLabel } from "./SectionLabel";

/**
 * Cosmic Vault does not publish a price list, because a premium depends on the
 * published rating rules of the product and the answers given. This section
 * explains that instead of inventing plan tiers, prices or service promises.
 */
const steps = [
  {
    Icon: Sliders,
    title: "Your answers set the rating",
    text: "Each product multiplies its configured base premium by the rating factors that apply to you — mileage, property type, age band, turnover, term length. Nothing about the calculation is hidden.",
  },
  {
    Icon: ShieldCheck,
    title: "A person reviews the risk",
    text: "An underwriter reads the application, may ask a specific question, and records a decision with reasons. No automatic approval and no automatic decline.",
  },
  {
    Icon: Timer,
    title: "A figure becomes real at issue",
    text: "Cover begins when the application is approved, the premium clears, and a policy is issued with a start date, a schedule and wording you can read.",
  },
];

const notes = [
  "Every premium is labelled indicative until it is issued",
  "No teaser rate that doubles later",
  "No price shown before we know the risk",
  "No promise we cannot keep",
];

export function Plans({ onQuote }: { onQuote: () => void }) {
  return (
    <section id="pricing" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="05" className="text-ink/65">
              Pricing
            </SectionLabel>
            <h2 className="mt-4 max-w-xl text-balance text-[clamp(2.1rem,4.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Priced on the risk,{" "}
              <span className="text-electric">not on a headline.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.92rem] leading-7 text-muted-foreground">
              You will not find a price list here, because a premium depends on
              your answers and the product version in force. Here is how the
              number is actually built.
            </p>
            <Link
              to="/how-it-works"
              className="link-slide mt-4 inline-flex w-fit pb-0.5 text-sm font-medium text-electric"
            >
              See the whole process
            </Link>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:gap-5 lg:grid-cols-3">
          {steps.map(({ Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 0.07}>
              <article className="group flex h-full flex-col rounded-[1.6rem] border border-line bg-card p-6 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_26px_54px_-44px_rgba(8,18,39,0.5)] sm:p-7">
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-full bg-ice text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4 transition-transform duration-500 group-hover:rotate-[8deg]" strokeWidth={1.8} />
                  </span>
                  <span className="text-[0.6rem] font-semibold tracking-[0.2em] text-ink/20">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-[1.12rem] font-semibold tracking-[-0.025em] text-ink">
                  {title}
                </h3>
                <p className="mt-2.5 flex-1 text-[0.85rem] leading-6 text-muted-foreground">
                  {text}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10 grid gap-4 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            {notes.map((note) => (
              <div
                key={note}
                className="group flex items-center gap-2.5 rounded-full transition-colors"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-electric transition-transform duration-300 group-hover:scale-150" />
                <span className="text-[0.8rem] text-muted-foreground transition-colors group-hover:text-ink">
                  {note}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton onClick={onQuote}>Get a quote</CtaButton>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-electric" />
              No obligation, and nothing is charged at the quotation stage.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
