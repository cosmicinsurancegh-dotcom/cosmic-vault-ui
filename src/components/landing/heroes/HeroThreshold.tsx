import { Media } from "@/components/site/Media";
import { COVERS } from "@/lib/covers";
import { coverImage } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

export type HeroVariantProps = {
  onQuote: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const LABELS: Record<string, string> = {
  home: "Home & contents",
  motor: "Motor",
  travel: "Travel",
  health: "Health",
  life: "Life & family",
  business: "Business",
};

const LINES = COVERS.map((cover) => ({
  slug: cover.slug,
  label: LABELS[cover.slug] ?? cover.navLabel,
  summary: cover.summary,
}));

/**
 * Hero study 03 — "The Threshold".
 * A warm, human split: a deep-green index of the six cover lines beside a
 * full-bleed photograph that changes as you move through it. The interaction
 * is the hero, rather than a carousel underneath it.
 */
export function HeroThreshold({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const line = LINES[active];

  return (
    <section
      id="top"
      className="relative grid min-h-svh overflow-hidden bg-[#ede5d6] lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)]"
    >
      {/* Index panel */}
      <div className="relative z-10 flex flex-col bg-[#16302a] px-5 pb-8 pt-20 text-[#f1e9da] sm:px-8 lg:px-10 lg:pb-6 lg:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(241,233,218,0.16)_0.5px,transparent_0.5px)] [background-size:5px_5px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-1/3 size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(195,106,63,0.22),transparent_68%)] blur-2xl"
        />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative flex items-center justify-between gap-4 text-[0.52rem] font-medium uppercase tracking-[0.26em] text-[#f1e9da]/45"
        >
          <span className="flex items-center gap-2.5">
            <span className="h-px w-7 bg-[#e08a5b]" />
            The threshold
          </span>
          <span className="tabular-nums">06 cover lines</span>
        </motion.div>

        <div className="relative mt-6">
          <h1 className="text-[clamp(2.15rem,4.2vw,3.45rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            {["What would you", "like to"].map((text, index) => (
              <span
                key={text}
                className="block overflow-hidden pb-[0.12em] -mb-[0.12em]"
              >
                <motion.span
                  initial={reduce ? false : { y: "115%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.9, delay: 0.12 + index * 0.07, ease: EASE }}
                  className="block"
                >
                  {text}
                </motion.span>
              </span>
            ))}
            <span className="block overflow-hidden pb-[0.14em] -mb-[0.14em]">
              <motion.span
                initial={reduce ? false : { y: "115%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, delay: 0.26, ease: EASE }}
                className="block font-serif italic tracking-[-0.055em] text-[#e08a5b]"
              >
                protect?
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
            className="mt-3 max-w-[23rem] text-[0.8rem] leading-6 text-[#f1e9da]/55"
          >
            Choose a cover line to see what sits inside it. Every application is
            read by a person before it becomes a policy.
          </motion.p>
        </div>

        <motion.ul
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="relative mt-5"
          aria-label="Cover lines"
        >
          {LINES.map((item, index) => {
            const isActive = index === active;
            return (
              <li key={item.slug} className="border-t border-[#f1e9da]/12 last:border-b">
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-pressed={isActive}
                  className={cn(
                    "group relative flex w-full items-center gap-4 py-2 pl-4 pr-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e08a5b]/50 focus-visible:ring-offset-4 focus-visible:ring-offset-[#16302a]",
                    isActive
                      ? "text-[#f1e9da]"
                      : "text-[#f1e9da]/50 hover:text-[#f1e9da]/80",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="threshold-marker"
                      transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
                      className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 bg-[#e08a5b]"
                    />
                  )}
                  <span
                    className={cn(
                      "w-5 shrink-0 text-[0.55rem] font-medium tabular-nums tracking-[0.16em] transition-colors",
                      isActive ? "text-[#e08a5b]" : "text-[#f1e9da]/30",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[1rem] font-medium tracking-[-0.02em]">
                    {item.label}
                  </span>
                  <ArrowUpRight
                    className={cn(
                      "size-4 shrink-0 transition-all duration-300",
                      isActive
                        ? "text-[#e08a5b]"
                        : "text-[#f1e9da]/25 group-hover:text-[#f1e9da]/55",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </motion.ul>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6, ease: EASE }}
          className="relative mt-auto pt-6"
        >
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onQuote}
              className="group inline-flex items-center justify-between gap-3 rounded-[3px] bg-[#c36a3f] py-2 pl-5 pr-2 text-[0.86rem] font-medium text-[#fbf3e6] transition-colors hover:bg-[#b25c33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e08a5b]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16302a] sm:justify-center"
            >
              Request a quote
              <span className="grid size-8 place-items-center rounded-[2px] bg-[#fbf3e6]/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                <ArrowUpRight className="size-4" strokeWidth={2} />
              </span>
            </button>
            <Link
              to="/support/contact"
              className="link-slide self-start text-[0.76rem] font-medium text-[#f1e9da]/60 transition-colors hover:text-[#f1e9da] sm:self-auto"
            >
              Or talk to an advisor
            </Link>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[0.55rem] leading-4 text-[#f1e9da]/35">
            <ShieldCheck className="mt-px size-3 shrink-0" />
            Indicative terms only. Cover begins after underwriting.
          </p>
        </motion.div>
      </div>

      {/* Photograph */}
      <div className="group relative h-[64vh] min-h-[24rem] overflow-hidden bg-[#c9c1b2] lg:h-auto">
        <AnimatePresence initial={false}>
          <motion.div
            key={line.slug}
            initial={reduce ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
            className="absolute inset-0"
          >
            <Media image={coverImage(line.slug)} className="size-full" eager />
          </motion.div>
        </AnimatePresence>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(9,27,23,0.9),rgba(9,27,23,0.28)_46%,rgba(9,27,23,0.14))]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[#f1e9da]/25"
        />

        {/* Giant index number */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={line.slug}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-none absolute left-5 top-20 select-none font-display text-[clamp(5.5rem,12vw,10rem)] font-semibold leading-[0.72] tracking-[-0.08em] text-[#f1e9da]/25 sm:left-8 sm:top-24"
          >
            {String(active + 1).padStart(2, "0")}
          </motion.span>
        </AnimatePresence>

        {/* Human-review stamp */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.85, rotate: -14 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          className="absolute right-5 top-20 grid size-24 place-items-center rounded-full border border-[#16302a]/20 bg-[#f1e9da] text-center shadow-[0_18px_40px_-24px_rgba(9,27,23,0.7)] sm:right-8 sm:top-24 lg:size-28"
        >
          <div>
            <ShieldCheck className="mx-auto size-4 text-[#c36a3f]" />
            <p className="mt-1.5 text-[0.44rem] font-semibold uppercase leading-[1.55] tracking-[0.16em] text-[#16302a]">
              A person
              <br />
              reads
              <br />
              every file
            </p>
          </div>
        </motion.div>

        {/* Active cover caption */}
        <div aria-live="polite" className="absolute inset-x-0 bottom-0 p-5 pt-24 sm:p-8">
          <div className="flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.26em] text-[#eab68f]">
            <span className="h-px w-6 bg-[#eab68f]/70" />
            {String(active + 1).padStart(2, "0")} — {line.label}
          </div>
          <p className="mt-2 max-w-[26rem] text-[0.82rem] leading-6 text-[#f1e9da]/80">
            {line.summary}
          </p>
          <Link
            to={`/cover/${line.slug}`}
            className="group/link mt-4 inline-flex items-center gap-2.5 text-[0.78rem] font-medium text-[#f1e9da] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f1e9da]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16302a]"
          >
            <span className="link-slide">Explore this cover</span>
            <span className="grid size-7 place-items-center rounded-[2px] border border-[#f1e9da]/30 transition-colors group-hover/link:border-[#f1e9da]/60">
              <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
        </div>

        <span className="pointer-events-none absolute bottom-8 right-6 hidden text-[0.48rem] font-medium uppercase tracking-[0.3em] text-[#f1e9da]/40 [writing-mode:vertical-rl] lg:block">
          Cosmic Vault · Est. 1998
        </span>
      </div>
    </section>
  );
}
