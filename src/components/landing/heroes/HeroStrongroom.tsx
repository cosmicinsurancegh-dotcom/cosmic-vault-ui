import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useCallback, useRef } from "react";
import type { VaultStatus } from "../vault-door/VaultDoor";
import type { HeroVariantProps } from "./HeroBroadsheet";

const EASE = [0.22, 1, 0.36, 1] as const;

/* The door is a few hundred KB of finished SVG; let the headline paint first. */
const VaultDoor = lazy(() => import("../vault-door/VaultDoor").then((m) => ({ default: m.VaultDoor })));

const LINES = [
  { text: "Held." },
  { text: "Sealed." },
  { text: "Covered.", accent: true },
];

/**
 * Hero study — "The Strongroom".
 * Cosmic Vault white, ink and electric blue. An isometric round vault door: dial the
 * combination and three wheels drop their gates, the drive ring turns and twelve bolts
 * withdraw. It runs the combination itself until someone puts a hand on the dial.
 *
 * The hero is pinned for one more screen of scrolling: the first sixth of that travel turns the dial and
 * withdraws the bolts, the rest swings the door ninety degrees. The pin lets go as the door finishes, and
 * scrolling back up shuts it. With reduced motion the door stands open and nothing is pinned.
 */
export function HeroStrongroom({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const openProgress = useSpring(scrollYProgress, { stiffness: 160, damping: 28, mass: 0.4, restDelta: 0.0005 });
  const dialNumber = useRef<HTMLSpanElement | null>(null);
  const dialText = useRef<HTMLSpanElement | null>(null);

  /* The door reports what it is doing; write it straight to the DOM so the hero never re-renders. */
  const onStatus = useCallback(({ reading, text }: VaultStatus) => {
    if (dialNumber.current) dialNumber.current.textContent = String(reading).padStart(2, "0");
    if (dialText.current) dialText.current.textContent = text;
  }, []);

  return (
    <div ref={track} id="top" className={reduce ? undefined : "h-[calc(max(40rem,100svh)+100svh)]"}>
    <section
      className={`relative isolate flex flex-col justify-center overflow-hidden bg-[#2B61EB] pb-10 pt-20 text-white ${
        reduce ? "min-h-[max(40rem,88svh)]" : "sticky top-0 h-[max(40rem,100svh)]"
      }`}
    >
      {/* Ice-tinted ground fading to white, with one soft electric bloom behind the door and a faint tooth. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-white/10 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_72%_50%,rgb(255_255_255/0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-white/[0.07] [background-image:radial-gradient(currentColor_0.5px,transparent_0.5px)] [background-size:4px_4px]"
      />

      {/* The door. A faint backdrop behind the copy on a phone, beside it from sm up, where it can be turned by hand.
          `.iso-band` centres it in the band below the fixed navbar and caps it to that band, so it never slides under the bar. */}
      <div className="iso-band pointer-events-none absolute -right-[18vw] flex w-[min(118vw,52rem)] items-center opacity-25 sm:pointer-events-auto sm:opacity-100 lg:right-[max(0rem,calc((100vw-1240px)/2-3rem))] lg:w-[min(52vw,50rem)]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.15, ease: EASE }}
          className="w-full"
        >
          <Suspense fallback={null}>
            <VaultDoor onStatus={onStatus} openProgress={reduce ? 1 : openProgress} />
          </Suspense>
          <p
            aria-hidden="true"
            className="mt-1 flex items-center justify-between gap-6 px-[5%] text-[0.55rem] font-semibold uppercase tracking-[0.24em] text-white/70"
          >
            <span className="hidden sm:inline">Drag the dial · scroll to open</span>
            <span ref={dialText} className="ml-auto text-right">
              Locked
            </span>
          </p>
        </motion.div>
      </div>

      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1240px] flex-col px-5 pb-8">
        <div className="flex items-center justify-between pt-6 text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-white">
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-white"
          >
            Vault custody · object insurance
          </motion.p>
          <span
            aria-hidden="true"
            className="hidden items-center gap-2 text-white/70 sm:flex"
          >
            Dial
            <span ref={dialNumber} className="inline-block w-[2ch] text-right tabular-nums text-white">
              00
            </span>
          </span>
        </div>

        <h1 className="mt-5 text-[clamp(2.6rem,min(7.1vw,12vh),6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em]">
          {LINES.map((line, i) => (
            <span
              key={line.text}
              className="block overflow-hidden pb-[0.12em] -mb-[0.12em]"
            >
              <motion.span
                initial={reduce ? false : { y: "118%" }}
                animate={{ y: "0%" }}
                transition={{
                  duration: 1.05,
                  delay: 0.25 + i * 0.1,
                  ease: EASE,
                }}
                className={
                  line.accent
                    ? "block text-[#CFE0FF]"
                    : "block"
                }
              >
                {line.text}
              </motion.span>
              {i < LINES.length - 1 && <span className="sr-only"> </span>}
            </span>
          ))}
        </h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
          className="pointer-events-auto mt-8 max-w-[26rem] sm:mt-10"
        >
          <p className="text-[0.88rem] leading-7 text-white/80">
            Gold, stones and critical minerals — held under dual control, each
            on its own named policy.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={onQuote}
              className="group inline-flex items-center gap-3 rounded-[4px] bg-white py-2 pl-5 pr-2 text-[0.86rem] font-medium text-[#2B61EB] transition-[background-color,scale] duration-150 hover:bg-white/90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2B61EB]"
            >
              Request a vault review
              <span className="grid size-8 place-items-center rounded-[4px] bg-[#2B61EB]/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                <ArrowUpRight className="size-4" strokeWidth={2} />
              </span>
            </button>
            <a
              href="#store"
              className="link-slide inline-flex items-center gap-2 text-[0.74rem] font-medium text-white/80 transition-colors hover:text-white"
            >
              See what we store
              <ArrowDown className="size-3" />
            </a>
          </div>

          <p className="mt-5 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white/80">
            <ShieldCheck className="size-3.5 shrink-0 text-white" />
            Cover bound before the drawer closes
          </p>
        </motion.div>
      </div>
    </section>
    </div>
  );
}
