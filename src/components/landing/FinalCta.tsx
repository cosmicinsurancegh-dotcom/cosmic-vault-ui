import { CtaButton } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import { Phone, Sparkles } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

export function FinalCta({ onQuote }: { onQuote: () => void }) {
  return (
    <section id="contact" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal y={30}>
          <div className="relative overflow-hidden rounded-[2rem] border border-ink/[0.07] bg-ice px-6 py-12 sm:rounded-[2.5rem] sm:px-12 sm:py-16 lg:px-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full border border-electric/15"
            >
              <span className="absolute inset-10 rounded-full border border-electric/12" />
              <span className="absolute inset-24 rounded-full border border-electric/10" />
              <span className="absolute bottom-8 left-6 size-2 rounded-full bg-electric/60" />
              <span className="absolute right-10 top-1/3 size-1.5 rounded-full bg-halo" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 left-1/3 size-[22rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),transparent_70%)]"
            />

            <div className="relative grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-center">
              <div>
                <SectionLabel index="07" className="text-ink/50">
                  Your next chapter
                </SectionLabel>
                <h2 className="mt-5 max-w-xl text-balance text-[clamp(2.2rem,4.6vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                  Let&apos;s secure your{" "}
                  <span className="font-display font-normal italic text-electric">
                    universe.
                  </span>
                </h2>
                <p className="mt-4 max-w-md text-[0.93rem] leading-7 text-ink/60">
                  A quiet conversation, a clear quote, and cover that makes the
                  future feel a little lighter. No pressure, no jargon, no
                  obligation.
                </p>
              </div>

              <div className="flex flex-col items-start gap-5 lg:items-end">
                <CtaButton onClick={onQuote} className="w-full justify-between sm:w-auto sm:justify-center">
                  Get a free quote
                </CtaButton>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <a
                    href="tel:+442079460958"
                    className="group inline-flex items-center gap-2.5 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
                  >
                    <span className="grid size-8 place-items-center rounded-full border border-ink/15 transition-colors group-hover:border-ink/35">
                      <Phone className="size-3.5" />
                    </span>
                    Prefer to talk? 020 7946 0958
                  </a>
                  <p className="flex items-center gap-1.5 text-xs text-ink/45 lg:pr-1">
                    <Sparkles className="size-3.5 text-electric" />
                    Advisors answer in under 2 hours
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
