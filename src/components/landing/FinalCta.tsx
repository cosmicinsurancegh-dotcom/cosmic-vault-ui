import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { IMAGES } from "@/lib/imagery";
import { CircleCheck, MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { SectionLabel } from "./SectionLabel";

export function FinalCta({ onQuote }: { onQuote: () => void }) {
  return (
    <section id="contact" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal y={30}>
          <div className="starfield relative overflow-hidden rounded-[4px] border border-white/10 bg-[#071227] px-6 py-12 text-bone sm:px-12 sm:py-16 lg:px-16">
            <Media
              image={IMAGES.auth}
              parallax={30}
              className="absolute inset-0"
              imgClassName="object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#04101f]/94 via-[#04101f]/78 to-[#04101f]/35"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(76,125,255,0.24),transparent_55%)]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-[4px] border border-white/10"
            >
              <span className="absolute inset-10 rounded-[4px] border border-white/[0.07]" />
              <span className="absolute inset-24 rounded-[4px] border border-white/[0.05]" />
              <span className="absolute bottom-8 left-6 size-2 animate-[float-soft_7s_ease-in-out_infinite] rounded-[4px] bg-electric-soft" />
              <span className="absolute right-10 top-1/3 size-1.5 rounded-[4px] bg-halo" />
            </div>

            <div className="relative grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-center">
              <div>
                <SectionLabel className="text-bone/55">
                  Your next chapter
                </SectionLabel>
                <h2 className="mt-5 max-w-xl text-balance text-[clamp(2.2rem,4.6vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-bone">
                  Let&apos;s secure your{" "}
                  <span className="text-electric-soft">universe.</span>
                </h2>
                <p className="mt-4 max-w-md text-[0.93rem] leading-7 text-bone/65">
                  A quiet conversation and a clear quote, with no price promise
                  before underwriting and no fabricated certainty. Ask us
                  anything, including whether you need cover at all.
                </p>
              </div>

              <div className="flex flex-col items-start gap-5 lg:items-end">
                <CtaButton
                  onClick={onQuote}
                  className="w-full justify-between shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] sm:w-auto sm:justify-center"
                >
                  Get a free quote
                </CtaButton>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
                  <Link
                    to="/support/contact"
                    className="group inline-flex items-center gap-2.5 text-sm font-medium text-bone/70 transition-colors hover:text-bone"
                  >
                    <span className="grid size-8 place-items-center rounded-[4px] border border-white/20 transition-colors group-hover:border-white/45 group-hover:bg-white/10">
                      <MessageCircle className="size-3.5" />
                    </span>
                    <span className="link-slide">Prefer to ask first? Contact support</span>
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-bone/55 lg:pr-1">
                    <CircleCheck className="size-3.5 text-electric-soft" />
                    No obligation, no pressure, no jargon
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
