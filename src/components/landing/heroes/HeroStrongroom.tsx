import { MINERAL_IMAGES } from "@/lib/imagery";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type PointerEvent } from "react";
import type { HeroVariantProps } from "./HeroBroadsheet";

const EASE = [0.22, 1, 0.36, 1] as const;

const LINES = [
  { text: "Held." },
  { text: "Sealed." },
  { text: "Covered.", accent: true },
];

/* 100 graduations, every tenth one long and numbered, like a combination dial. */
const TICKS = Array.from({ length: 100 }, (_, i) => i);
const BOLTS = Array.from({ length: 12 }, (_, i) => i * 30);
const BEZEL_TEXT =
  "DUAL CONTROL · NAMED POLICY PER OBJECT · INSURED IN CUSTODY · COVER BOUND BEFORE THE DRAWER CLOSES · ";

/* Engraved outer bezel: lettering on a circle, stretched to fill it exactly. */
function Bezel() {
  return (
    <svg viewBox="-300 -300 600 600" className="size-full text-white" aria-hidden="true">
      <defs>
        <path id="bezel-path" d="M0 -262 A262 262 0 1 1 -0.01 -262" />
      </defs>
      <circle r="290" fill="none" stroke="currentColor" strokeOpacity={0.45} />
      <circle r="236" fill="none" stroke="currentColor" strokeOpacity={0.2} />
      <text
        className="fill-white font-display"
        fillOpacity={0.7}
        fontSize="12"
        fontWeight={600}
        transform="rotate(5)"
      >
        <textPath href="#bezel-path" textLength="1640" lengthAdjust="spacing">
          {BEZEL_TEXT}
        </textPath>
      </text>
    </svg>
  );
}

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

/* Fixed drafting layer: crosshair, 5° scale, registration marks and a dimension line. */
function Reticle() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="-300 -300 600 600" className="pointer-events-none absolute inset-0 size-full text-white" aria-hidden="true">
      <g stroke="currentColor" fill="none">
        <circle r="203" strokeOpacity={0.14} strokeDasharray="2 5" />
        <circle r="150" strokeOpacity={0.14} />
        <line x1="-300" x2="300" strokeOpacity={0.12} strokeDasharray="1 6" />
        <line y1="-300" y2="300" strokeOpacity={0.12} strokeDasharray="1 6" />
        {ticks.map((d) => {
          const a = (d * Math.PI) / 180;
          const long = d % 45 === 0;
          const r1 = 203;
          const r2 = long ? 192 : 197;
          return (
            <line
              key={d}
              x1={Math.sin(a) * r1}
              y1={-Math.cos(a) * r1}
              x2={Math.sin(a) * r2}
              y2={-Math.cos(a) * r2}
              strokeOpacity={long ? 0.5 : 0.22}
            />
          );
        })}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x * 296} ${y * 270} V${y * 296} H${x * 270}`} strokeOpacity={0.45} />
        ))}
        <path d="M-120 288 H120 M-120 282 V294 M120 282 V294" strokeOpacity={0.4} />
      </g>
      <g className="fill-white font-display" fontSize="8" letterSpacing="1.5" textAnchor="middle">
        <text y="291" x="0" fillOpacity={0.6} className="[paint-order:stroke]" stroke="#2B61EB" strokeWidth="6">
          Ø 340 MM · GRADE 316
        </text>
        <text x="-282" y="-278" textAnchor="start" fillOpacity={0.5}>
          FIG. 01
        </text>
        <text x="282" y="-278" textAnchor="end" fillOpacity={0.5}>
          1:1.6
        </text>
      </g>
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

  /* Drag-to-spin adds to the scroll-driven turn; releasing coasts to the nearest graduation. */
  const spin = useMotionValue(0);
  const dialRef = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{ a: number; t: number; v: number } | null>(null);
  const coast = useRef<{ stop: () => void } | null>(null);

  const outer = useTransform([intro, scroll, spin], ([a, s, d]: number[]) =>
    (reduce ? 0 : a + s * 260) + d,
  );
  const inner = useTransform(outer, (v) => -v * 1.6);
  const bezel = useTransform(outer, (v) => v * 0.35);

  /* Bolts withdraw as the door opens. */
  const bolt = useTransform(scroll, [0, 0.6], ["0%", "130%"]);

  const angleAt = (e: PointerEvent) => {
    const r = dialRef.current!.getBoundingClientRect();
    return (
      (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) /
      Math.PI
    );
  };
  const grabDial = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    coast.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { a: angleAt(e), t: performance.now(), v: 0 };
  };
  const turnDial = (e: PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const a = angleAt(e);
    let d = a - g.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const now = performance.now();
    g.v = 0.8 * g.v + 0.2 * ((d / Math.max(now - g.t, 1)) * 1000);
    g.a = a;
    g.t = now;
    spin.set(spin.get() + d);
  };
  const releaseDial = () => {
    const g = grab.current;
    grab.current = null;
    if (!g) return;
    const snap = (t: number) => Math.round(t / 3.6) * 3.6;
    if (reduce) return void spin.set(snap(spin.get()));
    coast.current = animate(spin, spin.get(), {
      type: "inertia",
      velocity: g.v,
      power: 0.6,
      timeConstant: 260,
      modifyTarget: snap,
    });
  };
  /* The number under the index notch, 0–99. */
  const reading = useTransform(outer, (v) =>
    String(Math.round((((-v / 3.6) % 100) + 100) % 100)).padStart(2, "0"),
  );

  /* Landing on a whole ten flashes the index notch. */
  const flash = useMotionValue(0);
  const lastTen = useRef("");
  useMotionValueEvent(reading, "change", (v) => {
    if (v.endsWith("0") && v !== lastTen.current && !reduce) animate(flash, [1, 0], { duration: 0.45 });
    lastTen.current = v;
  });

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

      {/* The dial: a static stack of machined layers — bezel, two counter-turning rings, bolts and the bullion. */}
      <div
        ref={dialRef}
        onPointerDown={grabDial}
        onPointerMove={turnDial}
        onPointerUp={releaseDial}
        onPointerCancel={releaseDial}
        className="pointer-events-none absolute -right-[22vw] top-1/2 aspect-square w-[min(120vw,60rem)] -translate-y-1/2 select-none opacity-25 sm:pointer-events-auto sm:cursor-grab sm:opacity-100 sm:active:cursor-grabbing lg:right-[max(1.25rem,calc((100vw-1240px)/2+1.25rem))] lg:w-[min(38vw,34rem)]"
      >
        <div className="absolute inset-0">
          {/* Machined plates: stepped faces with inset shadows read as recessed and raised metal */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-white/20 bg-[radial-gradient(circle,rgb(255_255_255/0.02)_55%,rgb(255_255_255/0.10)_100%)] shadow-[0_40px_70px_-30px_color-mix(in_oklch,var(--navy)_60%,transparent),inset_0_2px_0_rgb(255_255_255/0.18),inset_0_-14px_30px_rgb(0_20_80/0.35)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[9%] rounded-full border border-white/25 bg-[radial-gradient(circle_at_50%_30%,#2f66ee,#1a45bd_85%)] shadow-[0_24px_40px_-14px_rgb(0_20_80/0.6),inset_0_1.5px_0_rgb(255_255_255/0.3),inset_0_-10px_24px_rgb(0_20_80/0.45)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-[20%] rounded-full border border-white/15 bg-[#163a9e]/40 shadow-[inset_0_8px_22px_rgb(0_15_70/0.6),0_1px_0_rgb(255_255_255/0.2)]"
          />
          <Reticle />

          <div aria-hidden="true" className="absolute inset-0">
            <motion.div style={{ rotate: bezel }} className="size-full">
              <Bezel />
            </motion.div>
          </div>
          <div aria-hidden="true" className="absolute inset-[9%]">
            <motion.div style={{ rotate: outer }} className="size-full">
              <Ring radius={286} />
            </motion.div>
          </div>
          <div aria-hidden="true" className="absolute inset-[9%]">
            <motion.div style={{ rotate: inner }} className="absolute inset-[11%]">
              <Ring radius={222} />
            </motion.div>
          </div>

          {/* Locking bolts, seated against the bullion and withdrawing with scroll */}
          <div aria-hidden="true" className="absolute inset-0">
            {BOLTS.map((deg) => (
              <div key={deg} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
                <motion.span
                  style={{ y: reduce ? "0%" : bolt }}
                  className="absolute left-1/2 top-[31.8%] h-[2.6%] w-[2%] -translate-x-1/2 rounded-[1px] bg-white shadow-[0_2px_4px_rgb(0_20_80/0.45)]"
                />
              </div>
            ))}
          </div>

          <div className="absolute inset-[34%] overflow-hidden rounded-full border border-white/50 shadow-[0_0_0_5px_rgb(255_255_255/0.08),0_0_0_6px_rgb(255_255_255/0.25),0_30px_60px_-20px_color-mix(in_oklch,var(--navy)_70%,transparent)]">
            <img
              src={MINERAL_IMAGES.bullion.src}
              alt=""
              decoding="async"
              draggable={false}
              className="size-full scale-[1.35] object-cover"
            />
            <span className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,color-mix(in_oklch,var(--navy)_35%,transparent))]" />
            <span className="absolute inset-0 rounded-full shadow-[inset_0_6px_14px_rgb(0_15_70/0.5),inset_0_-2px_6px_rgb(255_255_255/0.15)]" />
          </div>

          {/* Index notch */}
          <div aria-hidden="true" className="absolute inset-0">
            <motion.span
              style={{ opacity: flash }}
              className="absolute left-1/2 top-[1%] h-[8%] w-[14px] -translate-x-1/2 rounded-full bg-white blur-md"
            />
            <span className="absolute left-1/2 top-[1%] h-[7%] w-[3px] -translate-x-1/2 bg-white" />
          </div>

        </div>
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
  );
}
