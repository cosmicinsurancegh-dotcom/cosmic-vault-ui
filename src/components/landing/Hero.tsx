import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { Reveal } from "@/components/site/Reveal";
import { ADVISOR_FACES, IMAGES, coverImage } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router";

const facts = [
  "Six cover lines configured",
  "Every application reviewed by a person",
  "Decisions recorded with reasons",
  "Documents held in one vault",
];

const coverLines = [
  { label: "Home", slug: "home" },
  { label: "Motor", slug: "motor" },
  { label: "Travel", slug: "travel" },
  { label: "Health", slug: "health" },
  { label: "Life", slug: "life" },
  { label: "Business", slug: "business" },
];

export function Hero({ onQuote }: { onQuote: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const orbitRotate = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative scroll-mt-24 overflow-hidden"
    >
      {/* Ambient cosmic light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] size-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.22),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-14%] top-[38%] size-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(228,217,196,0.65),transparent_70%)] blur-2xl"
      />

      <div className="relative mx-auto max-w-[1180px] px-5 pb-4 pt-10 sm:px-8 sm:pt-16">
        <Reveal y={12}>
          <div className="flex items-center gap-4 text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-ink/65">
            <span className="flex items-center gap-2">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-electric" />
              </span>
              Insurance for the long horizon
            </span>
            <span className="hidden h-px flex-1 bg-line sm:block" />
            <span className="hidden sm:block">Directly arranged cover</span>
          </div>
        </Reveal>

        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-5xl text-[clamp(2.85rem,6.6vw,5.7rem)] font-semibold leading-[0.94] tracking-[-0.048em] text-ink"
        >
          Your life, your world,
          <br className="hidden sm:block" />{" "}
          <span className="text-electric">held beautifully.</span>
        </motion.h1>

        <div className="mt-9 grid gap-6 lg:grid-cols-12 lg:items-end">
          <Reveal delay={0.15} className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-3">
              <CtaButton onClick={onQuote}>Get a quote</CtaButton>
              <a
                href="#process"
                className="group inline-flex items-center gap-2.5 rounded-full px-2 py-2 text-[0.88rem] font-medium text-ink/70 transition-colors hover:text-ink"
              >
                <span className="grid size-8 place-items-center rounded-full border border-ink/15 transition-colors group-hover:border-ink/40">
                  <ArrowDown className="size-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
                </span>
                How it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.22} className="lg:col-span-5 lg:pb-1">
            <p className="max-w-sm text-[0.95rem] leading-7 text-muted-foreground lg:ml-auto">
              Protection for your home, your car, your health and the people you
              love — shaped by a real advisor and written in language you can
              actually check.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-line py-5 sm:gap-x-10">
            {facts.map((fact) => (
              <span
                key={fact}
                className="text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {fact}
              </span>
            ))}
            <div className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <BadgeCheck className="size-4 text-electric" />
              No price promise before underwriting
            </div>
          </div>
        </Reveal>
      </div>

      {/* Hero image */}
      <div className="relative mx-auto mt-6 max-w-[1180px] px-5 sm:px-8">
        <Reveal y={40} delay={0.1}>
          <div className="relative overflow-hidden rounded-[1.6rem] border border-ink/10 bg-ink sm:rounded-[2.2rem]">
            <div className="group relative">
              <Media
                image={IMAGES.hero}
                eager
                parallax={26}
                overlay="cosmic"
                className="aspect-[4/3.3] w-full sm:aspect-[16/9] lg:aspect-[16/7.2]"
              />

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.6 }}
                className="absolute left-3 top-3 hidden items-center gap-2.5 rounded-full border border-white/15 bg-[#071227]/65 py-1.5 pl-1.5 pr-4 backdrop-blur-md sm:left-6 sm:top-6 sm:flex"
              >
                <div className="flex -space-x-2">
                  {ADVISOR_FACES.map((face) => (
                    <Media
                      key={face.src}
                      image={face}
                      className="size-7 rounded-full border border-white/25"
                      imgClassName="scale-105"
                    />
                  )).reverse()}
                </div>
                <span className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-bone/80">
                  Advisors, not bots
                </span>
              </motion.div>
            </div>

            {/* Your vault summary */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.7 }}
              className="absolute right-3 top-3 hidden items-center gap-3 rounded-2xl border border-white/15 bg-[#071227]/70 px-3.5 py-3 text-bone backdrop-blur-md sm:right-6 sm:top-6 sm:flex sm:px-4"
            >
              <span className="grid size-11 place-items-center rounded-full border border-white/15 text-electric-soft">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-bone/55">
                  Your vault
                </p>
                <p className="text-sm font-medium">
                  Policies, claims and documents
                </p>
              </div>
            </motion.div>

            {/* How a claim is handled */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.7 }}
              className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl border border-line bg-card/95 p-3.5 backdrop-blur sm:bottom-6 sm:left-6 sm:right-auto sm:w-[19rem] sm:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-electric text-white">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ink/60">
                  Claim review
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  Assessed by a person, decided with reasons
                </p>
              </div>
            </motion.div>

            <div className="absolute bottom-4 right-5 hidden items-center gap-2 text-[0.62rem] uppercase tracking-[0.24em] text-bone/60 lg:flex">
              <Sparkles className="size-3.5" />
              Manual underwriting, by design
            </div>
          </div>
        </Reveal>
      </div>

      {/* Configured cover lines */}
      <div className="mx-auto mt-12 max-w-[1180px] px-5 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-center sm:gap-8">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
            Cover lines configured today
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {coverLines.map((line, index) => (
              <Link
                key={line.slug}
                to={`/cover/${line.slug}`}
                className="group/chip group flex items-center gap-2 rounded-full border border-line bg-card/70 py-1 pl-1 pr-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-[0_10px_24px_-18px_rgba(8,18,39,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Media
                  image={coverImage(line.slug)}
                  className="size-8 rounded-full"
                  imgClassName="scale-105"
                />
                <span
                  className={cn(
                    "text-[0.92rem] text-ink/65 transition-colors group-hover/chip:text-primary",
                    index % 2 === 1 ? "font-display italic" : "font-medium",
                  )}
                >
                  {line.label}
                </span>
                <ArrowUpRight className="size-3 -translate-x-1 text-ink/0 transition-all duration-300 group-hover/chip:translate-x-0 group-hover/chip:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        style={reduceMotion ? undefined : { rotate: orbitRotate }}
        className="pointer-events-none absolute -right-24 top-24 hidden size-[26rem] rounded-full border border-electric/10 lg:block"
      >
        <span className="absolute -left-1 top-1/2 size-2 rounded-full bg-electric/70" />
        <span className="absolute inset-10 rounded-full border border-ink/[0.06]" />
      </motion.div>
    </section>
  );
}
