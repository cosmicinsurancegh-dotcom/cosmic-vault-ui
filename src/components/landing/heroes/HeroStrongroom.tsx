import { MINERAL_IMAGES } from "@/lib/imagery";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import type { HeroVariantProps } from "./HeroBroadsheet";

const EASE = [0.22, 1, 0.36, 1] as const;

const LINES = [
  { text: "Held." },
  { text: "Sealed." },
  { text: "Covered.", accent: true },
];

/* 100 graduations, every tenth one long and numbered, like a combination dial. */
const TICKS = Array.from({ length: 100 }, (_, i) => i);

function Ring({ radius }: { radius: number }) {
  return (
    <svg
      viewBox="-300 -300 600 600"
      className="size-full text-white"
      aria-hidden="true"
    >
      {TICKS.map((i) => {
        const major = i % 10 === 0;
        const a = (i / 100) * Math.PI * 2;
        const len = major ? 20 : 9;
        const sin = Math.sin(a);
        const cos = -Math.cos(a);
        const lx = sin * (radius - 38);
        const ly = cos * (radius - 38);
        return (
          <g key={i}>
            <line
              x1={sin * radius}
              y1={cos * radius}
              x2={sin * (radius - len)}
              y2={cos * (radius - len)}
              stroke="currentColor"
              strokeOpacity={major ? 0.95 : 0.4}
              strokeWidth={major ? 2 : 1}
            />
            {major && (
              <text
                x={lx}
                y={ly}
                className="fill-white font-display"
                fillOpacity={0.75}
                fontSize="15"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${i * 3.6} ${lx} ${ly})`}
              >
                {i}
              </text>
            )}
          </g>
        );
      })}
      <circle
        r={radius + 6}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.5}
      />
    </svg>
  );
}

/**
 * Hero study — "The Strongroom".
 * Cosmic Vault white, ink and electric blue. A combination dial turns with the
 * scroll and reads out the number under the index, like opening the door.
 */
export function HeroStrongroom({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scroll = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });
  const intro = useMotionValue(reduce ? 0 : -150);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(intro, 0, {
      duration: 2.4,
      ease: EASE,
      delay: 0.2,
    });
    return () => controls.stop();
  }, [intro, reduce]);

  const outer = useTransform([intro, scroll], ([a, s]: number[]) =>
    reduce ? 0 : a + s * 260,
  );
  const inner = useTransform(outer, (v) => -v * 1.6);
  /* The number under the index notch, 0–99. */
  const reading = useTransform(outer, (v) =>
    String(Math.round((((-v / 3.6) % 100) + 100) % 100)).padStart(2, "0"),
  );

  return (
    <section
      id="top"
      ref={ref}
      className="relative isolate flex min-h-[max(40rem,88svh)] flex-col justify-center overflow-hidden bg-[#2B61EB] pb-10 pt-20 text-white"
    >
      {/* Ice-tinted ground fading to white, with one soft electric bloom behind the dial and a faint tooth. */}
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

      {/* The dial: two counter-turning rings, a fixed index and the bullion at its heart. */}
      <div className="pointer-events-none absolute -right-[22vw] top-1/2 aspect-square w-[min(120vw,60rem)] -translate-y-1/2 opacity-25 sm:opacity-100 lg:right-[max(1.25rem,calc((100vw-1240px)/2+1.25rem))] lg:w-[min(38vw,34rem)]">
        <motion.div style={{ rotate: outer }} className="absolute inset-0">
          <Ring radius={286} />
        </motion.div>
        <motion.div style={{ rotate: inner }} className="absolute inset-[11%]">
          <Ring radius={222} />
        </motion.div>
        <div className="absolute inset-[30%] overflow-hidden rounded-full border border-white/40 shadow-[0_30px_80px_-30px_color-mix(in_oklch,var(--navy)_55%,transparent)]">
          <img
            src={MINERAL_IMAGES.bullion.src}
            alt=""
            decoding="async"
            className="size-full scale-[1.35] object-cover"
          />
          <span className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,color-mix(in_oklch,var(--navy)_35%,transparent))]" />
        </div>
        {/* Index notch */}
        <span className="absolute left-1/2 top-[-1.5%] h-[7%] w-[3px] -translate-x-1/2 bg-white" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-col px-5 pb-8">
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
            <motion.span className="inline-block w-[2ch] text-right tabular-nums text-white">
              {reading}
            </motion.span>
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
          className="mt-8 max-w-[26rem] sm:mt-10"
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
  );
}
