import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { SpotlightCard } from "@/components/site/SpotlightCard";
import { coverImage } from "@/lib/imagery";
import { COVERAGE_ICONS, COVERAGE_OPTIONS, type CoverageKey } from "@/lib/vault";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { SectionLabel } from "./SectionLabel";

const COVER_HREF: Record<CoverageKey, string> = {
  health: "/cover/health",
  home: "/cover/home",
  auto: "/cover/motor",
  life: "/cover/life",
};

export function Solutions() {
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
            <SectionLabel className="text-ink/65">
              Coverage
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.15rem,4.7vw,3.8rem)] font-semibold leading-[1.01] tracking-[-0.045em] text-ink">
              Cover that fits your{" "}
              <span className="text-electric">universe.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-sm text-[0.93rem] leading-7 text-ink/60">
              Four kinds of protection built on one quiet system. Start with
              what keeps you up at night — add the rest as life unfolds.
            </p>
            <Link
              to="/cover"
              className="link-slide group mt-4 inline-flex w-fit items-center gap-1.5 pb-0.5 text-sm font-medium text-ink transition-colors hover:text-electric"
            >
              See all six cover lines
              <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {COVERAGE_OPTIONS.map((option, index) => {
            const Icon = COVERAGE_ICONS[option.key];
            return (
              <Reveal key={option.key} delay={index * 0.07}>
                <SpotlightCard
                  to={COVER_HREF[option.key]}
                  className="flex h-full w-full flex-col rounded-[1.5rem] border border-line bg-card text-left transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_28px_60px_-44px_rgba(8,18,39,0.55)]"
                >
                  <div className="relative overflow-hidden">
                    <Media
                      image={coverImage(option.key === "auto" ? "motor" : option.key)}
                      overlay="soft"
                      className="aspect-[16/9] w-full"
                    />
                    <span className="absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-background/92 text-primary shadow-sm backdrop-blur transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground sm:left-6">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="absolute right-5 top-5 text-[0.62rem] font-semibold tracking-[0.22em] text-bone/75 sm:right-6">
                      0{index + 1}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <span className="block text-[1.35rem] font-semibold tracking-[-0.025em] text-ink">
                      {option.label}
                    </span>
                    <span className="mt-2 block max-w-[24rem] flex-1 text-sm leading-6 text-muted-foreground">
                      {option.blurb}
                    </span>

                    <span className="mt-6 flex items-center justify-between">
                      <span className="link-slide text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink/60 transition-colors group-hover:text-primary">
                        Explore this cover
                      </span>
                      <span className="grid size-9 place-items-center rounded-full border border-ink/12 text-ink transition-all duration-500 group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </span>
                  </div>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[1.4rem] border border-line bg-card/60 px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-sm text-ink/70">
              <span className="font-medium text-ink">
                Not sure which cover you need?
              </span>{" "}
              The guidance pages explain limits, exclusions and disclosure before
              you commit to anything.
            </p>
            <Link
              to="/cover/understanding"
              className="group inline-flex items-center gap-2 text-sm font-medium text-electric"
            >
              <span className="link-slide">Understanding your coverage</span>
              <span className="grid size-7 place-items-center rounded-full bg-electric text-white transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
