import { Reveal } from "@/components/site/Reveal";
import {
  COVERAGE_ICONS,
  COVERAGE_OPTIONS,
  type CoverageKey,
} from "@/lib/vault";
import { ArrowUpRight } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

export function Solutions({
  onQuote,
}: {
  onQuote: (coverage: CoverageKey) => void;
}) {
  return (
    <section
      id="coverage"
      className="relative mt-24 scroll-mt-24 overflow-hidden bg-ice py-20 sm:mt-32 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 size-[30rem] rounded-full border border-electric/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-0 size-[22rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),transparent_68%)]"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="03" className="text-ink/55">
              Coverage
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.15rem,4.7vw,3.8rem)] font-semibold leading-[1.01] tracking-[-0.045em] text-ink">
              Cover that fits your{" "}
              <span className="text-electric">universe.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-sm text-[0.93rem] leading-7 text-ink/60">
              Four kinds of protection, one quiet system. Start with what keeps
              you up at night — add the rest as life unfolds.
            </p>
            <a
              href="#plans"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-electric"
            >
              Compare all plans
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {COVERAGE_OPTIONS.map((option, index) => {
            const Icon = COVERAGE_ICONS[option.key];
            return (
              <Reveal key={option.key} delay={index * 0.07}>
                <button
                  type="button"
                  onClick={() => onQuote(option.key)}
                  className="group relative h-full w-full overflow-hidden rounded-[1.5rem] border border-line bg-card p-6 text-left transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 sm:p-7"
                >
                  <span className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.10),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-start justify-between">
                    <span className="grid size-12 place-items-center rounded-full bg-ice text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="text-[0.62rem] font-semibold tracking-[0.22em] text-ink/25">
                      0{index + 1}
                    </span>
                  </div>

                  <span className="mt-7 block text-[1.35rem] font-semibold tracking-[-0.025em] text-ink">
                    {option.label}
                  </span>
                  <span className="mt-2 block max-w-[24rem] text-sm leading-6 text-muted-foreground">
                    {option.blurb}
                  </span>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink/45">
                      {option.from}
                    </span>
                    <span className="grid size-9 place-items-center rounded-full border border-ink/12 text-ink transition-all duration-500 group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </button>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[1.4rem] border border-line bg-card/60 px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-sm text-ink/70">
              <span className="font-medium text-ink">Not sure what you need?</span>{" "}
              Take the two-minute vault check and we&apos;ll suggest a
              starting point.
            </p>
            <button
              type="button"
              onClick={() => onQuote("health")}
              className="group inline-flex items-center gap-2 text-sm font-medium text-electric"
            >
              Start the check
              <span className="grid size-7 place-items-center rounded-full bg-electric text-white transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="size-3.5" />
              </span>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
