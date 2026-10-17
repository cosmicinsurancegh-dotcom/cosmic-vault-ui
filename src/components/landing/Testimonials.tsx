import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useState } from "react";
import { SectionLabel } from "./SectionLabel";

const stories = [
  {
    quote:
      "When a storm took the roof off in February, Cosmic Vault had a surveyor on site before lunch. The claim was paid in full on Thursday. I have never experienced anything like it from an insurer.",
    name: "Mira Okafor",
    role: "Home cover · Signature",
    location: "Bristol",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  },
  {
    quote:
      "I run a small studio and assumed insurance would always be a maze. My advisor read the policy out loud with me, cut two things I didn't need, and saved me £600 a year. That's the whole review.",
    name: "Daniel Reyes",
    role: "Life & health · Horizon",
    location: "London",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  },
  {
    quote:
      "A diagnosis in March could have derailed everything. Instead, treatment was approved in nine days and my concierge called every week — not to sell me anything, just to check I was alright.",
    name: "Priya Shah",
    role: "Health cover · Infinite",
    location: "Edinburgh",
    avatar:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=200&q=80",
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const story = stories[index];

  const go = (direction: number) => {
    setIndex((current) => (current + direction + stories.length) % stories.length);
  };

  return (
    <section id="stories" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel index="06" className="text-ink/55">
              Member stories
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Steady when it{" "}
              <span className="font-display font-normal italic text-electric">
                matters.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5 lg:pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-halo">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="size-4 fill-halo" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-ink">4.9 / 5</span> from 2,431
                member reviews
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal y={30}>
          <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-line bg-card">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-16 select-none font-display text-[18rem] italic leading-none text-ink/[0.035] sm:text-[24rem]"
            >
              &rdquo;
            </span>

            <div className="relative px-6 py-10 sm:px-12 sm:py-14 lg:px-16">
              <AnimatePresence mode="wait">
                <motion.div
                  key={story.name}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <blockquote className="max-w-4xl text-[clamp(1.35rem,2.6vw,2.1rem)] font-medium leading-[1.28] tracking-[-0.028em] text-ink">
                    &ldquo;{story.quote}&rdquo;
                  </blockquote>

                  <div className="mt-9 flex flex-wrap items-center gap-4">
                    <div className="relative">
                      <span className="absolute -inset-1 rounded-full border border-electric/20" />
                      <img
                        src={story.avatar}
                        alt={story.name}
                        loading="lazy"
                        className="relative size-12 rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{story.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {story.role} · {story.location}
                      </p>
                    </div>
                    <div className="ml-auto hidden items-center gap-2 text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground sm:flex">
                      Verified member
                      <span className="size-1 rounded-full bg-electric" />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between border-t border-line px-6 py-4 sm:px-12">
              <div className="flex items-center gap-2">
                {stories.map((item, dotIndex) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setIndex(dotIndex)}
                    aria-label={`Read ${item.name}'s story`}
                    aria-current={dotIndex === index}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-400",
                      dotIndex === index
                        ? "w-7 bg-electric"
                        : "w-1.5 bg-ink/15 hover:bg-ink/30",
                    )}
                  />
                ))}
                <span className="ml-3 text-[0.66rem] font-medium tracking-[0.18em] text-muted-foreground">
                  0{index + 1} / 0{stories.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous story"
                  className="grid size-9 place-items-center rounded-full border border-line text-ink/60 transition-colors hover:border-ink/30 hover:text-ink"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next story"
                  className="grid size-9 place-items-center rounded-full bg-ink text-bone transition-colors hover:bg-electric"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
