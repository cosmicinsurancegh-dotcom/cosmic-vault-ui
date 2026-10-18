import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { IMAGES } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { SectionLabel } from "./SectionLabel";

/**
 * The platform has no verified customer testimonials, so this section states
 * commitments that are evidenced by how the product actually behaves instead of
 * inventing members, ratings or review counts.
 */
const commitments = [
  {
    statement:
      "Every decision carries a reason — and the name of the person accountable for it.",
    detail:
      "Applications and claims record a status, a decision and the reasoning behind it. If something is declined, you are told why and what would change it.",
    label: "Commitment 01 · Decisions",
    href: "/about/principles",
    linkLabel: "Read our principles",
    image: IMAGES.claimReview,
  },
  {
    statement:
      "Documents written to be read, not skimmed past on the way to a signature.",
    detail:
      "Schedules and policy wording live on your record in plain language, and stay available after a policy ends so you can evidence cover for a past period.",
    label: "Commitment 02 · Clarity",
    href: "/how-it-works/your-policy",
    linkLabel: "Understanding your policy",
    image: IMAGES.homeInterior,
  },
  {
    statement: "A person at the end of every route, including the difficult ones.",
    detail:
      "Support requests reach a human with the policy, claim or payment in front of them, and disagreements have a documented route rather than a dead end.",
    label: "Commitment 03 · Service",
    href: "/claims",
    linkLabel: "How claims work",
    image: IMAGES.support,
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const item = commitments[index];

  const go = (direction: number) => {
    setIndex(
      (current) => (current + direction + commitments.length) % commitments.length,
    );
  };

  return (
    <section id="commitments" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/65">
              Our commitments
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Steady when it{" "}
              <span className="text-electric">matters.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.9rem] leading-7 text-muted-foreground">
              We do not publish member quotes, review scores or award badges,
              because none of them have been verified. These are the standards
              the platform is built to hold itself to instead.
            </p>
          </Reveal>
        </div>

        <Reveal y={30}>
          <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-line bg-card">
            <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
              <div className="group relative min-h-[15rem] overflow-hidden sm:min-h-[19rem] lg:min-h-full">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={item.image.src}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <Media image={item.image} overlay="floor" className="size-full" />
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-5">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-bone backdrop-blur">
                    On the record
                  </span>
                  <span className="font-display text-sm italic text-bone/70">
                    0{index + 1} / 0{commitments.length}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="max-w-[15rem] text-[0.72rem] leading-5 text-bone/70">
                    Standards the platform is built to hold itself to — not
                    testimonials we cannot verify.
                  </p>
                </div>
              </div>

              <div className="relative flex flex-col justify-between">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-14 select-none font-display text-[14rem] italic leading-none text-ink/[0.04] sm:text-[18rem]"
                >
                  &rdquo;
                </span>

                <div className="relative px-6 py-10 sm:px-10 sm:py-12">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-ink/55">
                        {item.label}
                      </p>
                      <blockquote className="mt-5 max-w-2xl text-[clamp(1.3rem,2.3vw,1.9rem)] font-medium leading-[1.28] tracking-[-0.028em] text-ink">
                        {item.statement}
                      </blockquote>
                      <p className="mt-6 max-w-xl text-[0.9rem] leading-7 text-muted-foreground">
                        {item.detail}
                      </p>
                      <Link
                        to={item.href}
                        className="group mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary"
                      >
                        <span className="link-slide">{item.linkLabel}</span>
                        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between border-t border-line px-6 py-4 sm:px-10">
                  <div className="flex items-center gap-2">
                    {commitments.map((entry, dotIndex) => (
                      <button
                        key={entry.label}
                        type="button"
                        onClick={() => setIndex(dotIndex)}
                        aria-label={`Show ${entry.label}`}
                        aria-current={dotIndex === index}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          dotIndex === index
                            ? "w-7 bg-electric"
                            : "w-1.5 bg-ink/15 hover:bg-ink/30",
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label="Previous commitment"
                      className="press grid size-9 place-items-center rounded-full border border-line text-ink/60 transition-colors hover:border-ink/30 hover:text-ink"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label="Next commitment"
                      className="press grid size-9 place-items-center rounded-full bg-foreground text-background transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
