import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { MINERAL_IMAGES } from "@/lib/imagery";
import { ArrowUpRight, CircleCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { SectionLabel } from "./SectionLabel";

export function FinalCta({ onReview }: { onReview: () => void }) {
  return (
    <section id="review" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1240px] px-5">
        <Reveal y={30}>
          <div className="group relative overflow-hidden rounded-[4px] border border-line bg-card shadow-[0_30px_70px_-52px_rgba(10,18,36,0.4)]">
            <div
              aria-hidden="true"
              className="vault-grid pointer-events-none absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_18%_30%,black,transparent_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-32 size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(10,18,36,0.05),transparent_66%)]"
            />

            <div className="relative grid lg:grid-cols-[1.12fr_0.88fr]">
              <div className="px-6 py-12 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
                <SectionLabel className="text-ink/45">
                  Your next deposit
                </SectionLabel>
                <h2 className="mt-5 max-w-xl text-balance text-[clamp(2.2rem,4.2vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
                  Bring us something <span className="text-primary">rare.</span>
                </h2>
                <p className="mt-4 max-w-md text-[0.93rem] leading-7 text-ink/60">
                  Tell us what you hold and what it is worth to you. A vault
                  specialist confirms the class, arranges the appraisal and
                  quotes custody and cover together — with nothing charged until
                  a policy is issued.
                </p>

                <div className="mt-8 flex flex-col items-start gap-5">
                  <CtaButton
                    onClick={onReview}
                    className="w-full justify-between shadow-[0_20px_44px_-26px_rgba(29,74,214,0.65)] sm:w-auto sm:justify-center"
                  >
                    Request a vault review
                  </CtaButton>

                  <Link
                    to="/auth?returnTo=%2Fdashboard"
                    className="group/link inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-primary"
                  >
                    <span className="link-slide">Open the member vault</span>
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                  </Link>

                  <ul className="flex w-full max-w-sm flex-col gap-2.5 border-t border-line pt-4 text-xs">
                    <li className="flex items-center gap-1.5 text-ink/60">
                      <CircleCheck className="size-3.5 shrink-0 text-primary" />
                      No obligation, no charge before issue
                    </li>
                    <li className="flex items-center gap-1.5 text-ink/45">
                      <ShieldCheck className="size-3.5 shrink-0" />
                      Appraisal and custody quoted together
                    </li>
                  </ul>
                </div>
              </div>

              {/* Photograph only: the object supplies the colour, not the layout. */}
              <div className="relative min-h-[13rem] border-t border-line lg:border-l lg:border-t-0">
                <Media
                  image={MINERAL_IMAGES.diamonds}
                  parallax={24}
                  overlay="soft"
                  className="absolute inset-0"
                  imgClassName="object-cover [object-position:58%_50%]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 hidden w-12 bg-gradient-to-r from-card via-card/70 to-transparent lg:block"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card/70 to-transparent lg:hidden"
                />
                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-bone/75">
                    Parcel · 12 stones
                  </p>
                  <span className="rounded-[4px] border border-white/20 bg-black/35 px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-bone/85 backdrop-blur">
                    Insured
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
