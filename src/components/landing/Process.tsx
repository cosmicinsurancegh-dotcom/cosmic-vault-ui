import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { IMAGES } from "@/lib/imagery";
import { SectionLabel } from "./SectionLabel";
import { Clock } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Get a free quote",
    text: "Tell us what you're protecting. We'll come back within one business day with a clear, itemised quote — no calls you didn't ask for.",
    image: IMAGES.hero,
  },
  {
    number: "02",
    title: "Choose your plan",
    text: "Pick the cover that fits, adjust the details with your advisor, and sign in minutes. Everything is written in plain English.",
    image: IMAGES.workspaces,
  },
  {
    number: "03",
    title: "Live, quietly protected",
    text: "Your vault opens: documents, claims, and a concierge line that reaches an actual person, any hour of any day.",
    image: IMAGES.auth,
  },
];

export function Process({ onQuote }: { onQuote: () => void }) {
  return (
    <section id="process" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <Reveal y={36}>
          {/* Sized so the panel — heading, three steps and the CTA row —
              fits a single laptop viewport instead of running past the fold. */}
          <div className="starfield relative overflow-hidden rounded-[2rem] bg-[#071227] px-6 py-12 text-bone sm:rounded-[2.5rem] sm:px-12">
            <Media
              image={IMAGES.cosmos}
              parallax={34}
              className="pointer-events-none absolute inset-0 opacity-35"
              imgClassName="scale-105"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071227]/70 via-[#071227]/40 to-[#071227]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.28),transparent_65%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 -right-10 size-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(228,217,196,0.13),transparent_65%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 top-1/2 hidden size-[24rem] -translate-y-1/2 rounded-full border border-white/[0.07] lg:block"
            >
              <span className="absolute inset-12 rounded-full border border-white/[0.05]" />
              <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-electric-soft" />
            </div>

            <div className="relative mx-auto max-w-2xl text-center">
              <SectionLabel className="justify-center text-bone/45">
                The process
              </SectionLabel>
              <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.7vw,3.7rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Easy, transparent,{" "}
                <span className="text-electric-soft">human.</span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[0.93rem] leading-7 text-bone/55">
                Three steps, no forms in triplicate, no waiting on hold. The
                whole thing takes about as long as a coffee.
              </p>
            </div>

            <div className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {steps.map((step, index) => (
                <Reveal key={step.number} delay={index * 0.1}>
                  <div className="group relative border-t border-white/12 pt-6">
                    <span className="absolute -top-[3px] left-0 size-1.5 rounded-full bg-electric-soft transition-transform duration-500 group-hover:scale-150" />
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-5xl italic leading-none text-bone/20 transition-colors duration-500 group-hover:text-electric-soft sm:text-6xl">
                        {step.number}
                      </span>
                      {index < steps.length - 1 && (
                        <span className="hidden h-px w-10 bg-white/10 md:block" />
                      )}
                    </div>
                    <Media
                      image={step.image}
                      overlay="soft"
                      className="mt-5 aspect-[16/9] w-full rounded-[1rem] border border-white/10 opacity-85 transition-opacity duration-500 group-hover:opacity-100"
                      imgClassName="grayscale-[18%]"
                    />
                    <h3 className="mt-5 text-lg font-medium tracking-[-0.02em] text-bone">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-6 text-bone/55">
                      {step.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* The CTA row sits at the foot of an already-revealed panel: it
                fades in with the panel itself rather than waiting on its own
                viewport trigger, which never fired at the bottom of a tall
                panel and left the buttons invisible. */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CtaButton onClick={onQuote}>Start your quote</CtaButton>
              <p className="flex items-center gap-2 text-xs text-bone/45">
                <Clock className="size-3.5 text-electric-soft" />
                Two minutes · no credit check · no obligation
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
