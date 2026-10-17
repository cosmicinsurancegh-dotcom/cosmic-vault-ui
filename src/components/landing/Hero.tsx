import { CtaButton } from "@/components/site/Cta";
import { Reveal } from "@/components/site/Reveal";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowDown,
  BadgeCheck,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { useRef } from "react";

const stats = [
  { value: "£4.2B", label: "cover placed" },
  { value: "24,000+", label: "members protected" },
  { value: "48h", label: "average claim" },
  { value: "4.9/5", label: "member rating" },
];

export function Hero({ onQuote }: { onQuote: () => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
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
          <div className="flex items-center gap-4 text-[0.64rem] font-semibold uppercase tracking-[0.30em] text-ink/50">
            <span className="flex items-center gap-2">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-electric" />
              </span>
              Insurance for the long horizon
            </span>
            <span className="hidden h-px flex-1 bg-line sm:block" />
            <span className="hidden sm:block">Est. 2009 · London</span>
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
          <span className="font-display font-normal italic tracking-[-0.02em] text-electric">
            held beautifully.
          </span>
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
              Protection for your health, home, car and the people you love —
              shaped by a real advisor, priced without theatre, and settled in
              days rather than months.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-line py-5 sm:gap-x-12">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tracking-[-0.02em] text-ink">
                  {stat.value}
                </span>
                <span className="text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
            <div className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <BadgeCheck className="size-4 text-electric" />
              FCA regulated
            </div>
          </div>
        </Reveal>
      </div>

      {/* Hero image */}
      <div className="relative mx-auto mt-6 max-w-[1180px] px-5 sm:px-8">
        <Reveal y={40} delay={0.1}>
          <div className="relative overflow-hidden rounded-[1.6rem] border border-ink/10 bg-ink sm:rounded-[2.2rem]">
            <motion.div
              style={reduceMotion ? undefined : { y: imageY }}
              className="relative aspect-[4/3.3] w-full sm:aspect-[16/9] lg:aspect-[16/7.2]"
            >
              <img
                src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1900&q=80"
                alt="A Cosmic Vault advisor walking a family through their cover"
                className="size-full scale-[1.06] object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04101f]/75 via-[#04101f]/10 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(76,125,255,0.18),transparent_45%)]" />
            </motion.div>

            {/* floating vault score */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.7 }}
              className="absolute right-3 top-3 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#071227]/70 px-3.5 py-3 text-bone backdrop-blur-md sm:right-6 sm:top-6 sm:px-4"
            >
              <div className="relative grid size-11 place-items-center">
                <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
                  <circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    stroke="#6f9bff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="119.4"
                    strokeDashoffset="9.5"
                  />
                </svg>
                <span className="text-sm font-semibold">98</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-[0.58rem] uppercase tracking-[0.2em] text-bone/55">
                  Vault score
                </p>
                <p className="text-sm font-medium">Exceptionally covered</p>
              </div>
            </motion.div>

            {/* floating claim card */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.7 }}
              className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-2xl border border-white/20 bg-bone/95 p-3.5 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[19rem] sm:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-electric text-white">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-ink/45">
                  Claim CV-8192 · settled
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  £2,480 paid in 41 hours
                </p>
              </div>
              <div className="ml-auto hidden items-center gap-1 rounded-full bg-ink/[0.05] px-2.5 py-1 text-[0.65rem] font-medium text-ink/60 sm:flex">
                <Star className="size-3 fill-halo text-halo" />
                4.9
              </div>
            </motion.div>

            <div className="absolute bottom-4 right-5 hidden items-center gap-2 text-[0.62rem] uppercase tracking-[0.24em] text-bone/60 sm:flex">
              <Sparkles className="size-3.5" />
              Member advisory — Meridian Wharf
            </div>
          </div>
        </Reveal>
      </div>

      {/* Featured strip */}
      <div className="mx-auto mt-12 max-w-[1180px] px-5 sm:px-8">
        <div className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-center sm:gap-8">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
            Recognised by
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 font-display text-lg text-ink/40 sm:gap-x-10 sm:text-xl">
            <span>Financial Times</span>
            <span className="italic">Monocle</span>
            <span>Forbes</span>
            <span className="italic">Wired</span>
            <span>Which?</span>
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
