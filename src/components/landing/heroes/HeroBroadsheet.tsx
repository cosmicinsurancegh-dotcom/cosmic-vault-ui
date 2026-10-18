import { IMAGES } from "@/lib/imagery";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export type HeroVariantProps = {
  onQuote: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const STATS = [
  { value: "11,400", label: "members in the vault" },
  { value: "£4.2m", label: "claims settled this year" },
  { value: "4.9 / 5", label: "advisory rating" },
];

const HEADLINE: { text: string; accent?: boolean }[] = [
  { text: "Cover for" },
  { text: "the life you've" },
  { text: "actually built.", accent: true },
];

function StubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[#151a22]/40">{label}</span>
      <span className="font-medium text-[#151a22]/85">{value}</span>
    </div>
  );
}

/**
 * Hero study 01 — "The Broadsheet".
 * A warm, printed-broadsheet composition: paper, hairline rules, a mounted
 * photograph and an oversized editorial headline. No carousel, no dark panel.
 */
export function HeroBroadsheet({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-[#f1ece1] pb-0 pt-16 text-[#151a22] sm:pt-20"
    >
      {/* Paper tooth + a faint warm vignette keep the flat colour from
          looking like a plain white block on large screens. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.22] [background-image:radial-gradient(rgba(21,26,33,0.55)_0.45px,transparent_0.45px)] [background-size:4px_4px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_0%,rgba(180,70,43,0.07),transparent_55%),radial-gradient(ellipse_at_90%_90%,rgba(21,26,33,0.06),transparent_55%)]"
      />

      {/* The twelve-column rule field, drawn behind the composition. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-full justify-center px-10 lg:flex"
      >
        <div className="grid w-full max-w-[1320px] grid-cols-4">
          {[0, 1, 2, 3].map((rule) => (
            <motion.span
              key={rule}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 1.1, delay: 0.1 + rule * 0.05, ease: EASE }}
              className="origin-top border-l border-[#151a22]/[0.07] last:border-r"
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-5 sm:px-8 lg:px-10">
        {/* Masthead */}
        <motion.header
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex items-center justify-between gap-4 border-b border-[#151a22]/15 pb-3 pt-2 text-[0.55rem] font-medium uppercase tracking-[0.24em] text-[#151a22]/55"
        >
          <span className="flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-[#b4462b]" />
            Cosmic Vault — The Broadsheet
          </span>
          <span className="hidden md:inline">Independent insurance · London · Est. 1998</span>
          <span className="tabular-nums">No. 06 — 2026</span>
        </motion.header>

        <div className="grid flex-1 items-center gap-10 pb-6 pt-6 sm:gap-12 sm:pt-8 lg:grid-cols-12 lg:gap-8">
          {/* Type column */}
          <div className="lg:col-span-7 lg:pr-6">
            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="flex items-center gap-3 text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-[#b4462b]"
            >
              <span className="h-px w-7 bg-[#b4462b]/60" />
              Insurance, written by hand
            </motion.p>

            <h1 className="mt-5 max-w-[12ch] text-[clamp(2.55rem,7.1vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-[#151a22]">
              {HEADLINE.map((line, index) => (
                <span
                  key={line.text}
                  className="block overflow-hidden pb-[0.12em] -mb-[0.12em]"
                >
                  <motion.span
                    initial={reduce ? false : { y: "118%" }}
                    animate={{ y: "0%" }}
                    transition={{
                      duration: 1.05,
                      delay: 0.16 + index * 0.09,
                      ease: EASE,
                    }}
                    className={
                      line.accent
                        ? "block font-serif italic tracking-[-0.06em] text-[#b4462b]"
                        : "block"
                    }
                  >
                    {line.text}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
              className="mt-6 grid gap-6 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <div className="max-w-[24rem]">
                <p className="text-[0.88rem] leading-7 text-[#151a22]/65">
                  Buildings, motor, travel, health, life and business cover —
                  written by underwriters who read the file, not a form. Six
                  cover lines, one vault, and a person on the other end.
                </p>
                <p className="mt-3 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-[#151a22]/45">
                  <ShieldCheck className="size-3.5 text-[#b4462b]" />
                  Reviewed before any cover begins
                </p>
              </div>

              <div className="flex flex-col items-start gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={onQuote}
                    className="group inline-flex items-center gap-3 rounded-[3px] bg-[#151a22] py-2 pl-5 pr-2 text-[0.86rem] font-medium text-[#f6f1e7] transition-colors hover:bg-[#2b3341] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#151a22]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f1ece1]"
                  >
                    Request a quote
                    <span className="grid size-8 place-items-center rounded-[2px] bg-[#f6f1e7]/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                      <ArrowUpRight className="size-4" strokeWidth={2} />
                    </span>
                  </button>
                </div>
                <Link
                  to="/how-it-works"
                  className="link-slide text-[0.74rem] font-medium text-[#151a22]/60 transition-colors hover:text-[#151a22]"
                >
                  Read how a claim is settled
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Photograph, mounted like a print, with the policy stub breaking out */}
          <div className="relative lg:col-span-5">
            <motion.div
              aria-hidden="true"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.35 }}
              className="absolute -left-4 -top-4 hidden h-full w-full border border-[#151a22]/20 sm:block"
            />
            <motion.figure
              initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
              animate={{ clipPath: "inset(0 0 0% 0)" }}
              transition={{ duration: 1.15, delay: 0.22, ease: EASE }}
              className="relative overflow-hidden bg-[#d8cfbe]"
            >
              <motion.img
                src={IMAGES.homeInterior.src}
                alt={IMAGES.homeInterior.alt}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                draggable={false}
                initial={reduce ? false : { scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, delay: 0.22, ease: EASE }}
                className="aspect-[4/3] w-full object-cover sm:aspect-[4/5] lg:aspect-auto lg:h-[min(58vh,34rem)]"
                style={{ objectPosition: IMAGES.homeInterior.position }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(21,26,33,0.28),transparent_45%)]"
              />
              <figcaption className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 text-[0.52rem] font-medium uppercase tracking-[0.2em] text-white/85">
                <span>Buildings &amp; contents</span>
                <span className="tabular-nums">Ref. CV—4471</span>
              </figcaption>
            </motion.figure>

            {/* Paper policy stub */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 26, rotate: -9 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 0.85, delay: 0.7, ease: EASE }}
              className="absolute -bottom-7 -left-8 hidden w-[15rem] rounded-[2px] border border-[#151a22]/15 bg-[#f8f3e8] p-4 shadow-[0_26px_50px_-32px_rgba(21,26,33,0.6)] lg:block"
            >
              <div className="flex items-center justify-between gap-2 text-[0.46rem] font-semibold uppercase tracking-[0.2em] text-[#151a22]/45">
                <span>Certificate of cover</span>
                <ShieldCheck className="size-3.5 text-[#b4462b]" />
              </div>
              <p className="mt-2 font-display text-[1.1rem] leading-none tracking-[-0.02em] text-[#151a22]">
                Policy 4471
              </p>
              <div className="mt-3 space-y-1.5 border-t border-dashed border-[#151a22]/25 pt-2.5 text-[0.56rem] leading-4">
                <StubRow label="Insured" value="A. Whitfield" />
                <StubRow label="Property" value="14 Alder Lane" />
                <StubRow label="Rebuild" value="£486,000" />
                <StubRow label="Excess" value="£250" />
              </div>
              <div className="absolute -right-3 -top-4 grid size-16 rotate-[9deg] place-items-center rounded-full border border-[#b4462b]/45 bg-[#f8f3e8] text-center text-[0.4rem] font-semibold uppercase leading-[1.35] tracking-[0.12em] text-[#b4462b]">
                Reviewed
                <br />
                12 Nov
              </div>
            </motion.div>
          </div>
        </div>

        {/* Figure strip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          className="grid grid-cols-3 divide-x divide-[#151a22]/12 border-t border-[#151a22]/15"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="px-3 py-3.5 first:pl-0 sm:px-6 sm:py-4">
              <p className="font-display text-[clamp(1.1rem,2.2vw,1.6rem)] font-medium tracking-[-0.03em] text-[#151a22]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[0.5rem] uppercase leading-4 tracking-[0.16em] text-[#151a22]/45">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        <div className="flex items-center justify-between gap-4 border-t border-[#151a22]/10 py-3 text-[0.5rem] font-medium uppercase tracking-[0.22em] text-[#151a22]/40">
          <span>Cosmic Vault — an insurance house, not a quote engine</span>
          <span className="hidden items-center gap-2 sm:flex">
            Scroll to read
            <ArrowDown className="size-3" />
          </span>
        </div>
      </div>
    </section>
  );
}
