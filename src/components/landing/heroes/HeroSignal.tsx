import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { ArrowUpRight, ArrowRight, Activity } from "lucide-react";
import { Link } from "react-router";

export type HeroVariantProps = {
  onQuote: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const LINES = ["Nothing", "happens", "by", "accident."];

const TICKER = [
  "Home & contents",
  "Motor",
  "Travel",
  "Health",
  "Life & family",
  "Business",
];

const TICKS = Array.from({ length: 72 });

function SignalStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-white/12 bg-[#0a0d0b]/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="size-1 bg-[#d8ff3e]" />
        <span className="text-[0.48rem] font-medium uppercase tracking-[0.24em] text-white/45">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-[1.55rem] leading-none tracking-[-0.04em] text-[#f4f4ef] tabular-nums">
        {value}
      </p>
      {note && (
        <p className="mt-1 text-[0.52rem] leading-4 tracking-[0.02em] text-white/35">
          {note}
        </p>
      )}
    </div>
  );
}

function TickerGroup() {
  return (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {TICKER.map((item) => (
        <span
          key={item}
          className="flex items-center gap-8 whitespace-nowrap text-[0.6rem] font-medium uppercase tracking-[0.26em] text-white/45"
        >
          {item}
          <span className="text-[#d8ff3e]/70">✦</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Hero study 02 — "The Signal".
 * A near-black, instrument-panel composition: an oversized risk headline, a
 * slowly turning orbital seal and live claim telemetry. Deliberately colder
 * and more kinetic than the rest of the site.
 */
export function HeroSignal({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const driftX = useSpring(pointerX, { stiffness: 60, damping: 18, mass: 0.6 });
  const driftY = useSpring(pointerY, { stiffness: 60, damping: 18, mass: 0.6 });

  return (
    <section
      id="top"
      onPointerMove={(event) => {
        if (reduce) return;
        const box = event.currentTarget.getBoundingClientRect();
        pointerX.set(((event.clientX - box.left) / box.width - 0.5) * 24);
        pointerY.set(((event.clientY - box.top) / box.height - 0.5) * 24);
      }}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-[#07080a] pt-16 text-[#f4f4ef] sm:pt-20"
    >
      {/* Grid, bloom and scanner field */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:96px_96px]" />
        <div className="absolute -left-40 top-1/4 size-[42rem] rounded-full bg-[radial-gradient(circle,rgba(216,255,62,0.10),transparent_65%)] blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07080a] to-transparent" />
      </div>

      {/* Orbital instrument */}
      <div className="pointer-events-none absolute inset-y-0 right-[-42%] z-0 w-[105%] opacity-[0.16] sm:right-[-22%] sm:w-[78%] lg:right-0 lg:w-1/2 lg:opacity-100">
        <motion.div
          style={reduce ? undefined : { x: driftX, y: driftY }}
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, delay: 0.15, ease: EASE }}
          className="relative flex size-full items-center justify-center"
        >
          <div className="relative aspect-square w-full max-w-[min(50vw,660px)]">
            <svg viewBox="0 0 800 800" fill="none" aria-hidden="true" className="size-full">
              <defs>
                <path
                  id="signal-seal-path"
                  d="M400,400 m-250,0 a250,250 0 1,1 500,0 a250,250 0 1,1 -500,0"
                />
              </defs>

              <circle cx="400" cy="400" r="386" stroke="rgba(244,244,239,0.09)" />
              <circle
                cx="400"
                cy="400"
                r="318"
                stroke="rgba(216,255,62,0.16)"
                strokeDasharray="1 12"
              />
              <circle cx="400" cy="400" r="252" stroke="rgba(216,255,62,0.26)" />
              <circle
                cx="400"
                cy="400"
                r="160"
                stroke="rgba(244,244,239,0.12)"
                strokeDasharray="2 10"
              />

              <g>
                {TICKS.map((_, index) => {
                  const major = index % 6 === 0;
                  return (
                    <line
                      key={index}
                      x1="400"
                      y1={major ? 16 : 24}
                      x2="400"
                      y2={major ? 44 : 32}
                      stroke={
                        major
                          ? "rgba(216,255,62,0.55)"
                          : "rgba(244,244,239,0.16)"
                      }
                      transform={`rotate(${index * 5} 400 400)`}
                    />
                  );
                })}
              </g>

              <motion.g
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "400px 400px" }}
              >
                <text
                  fill="rgba(216,255,62,0.62)"
                  fontSize="11"
                  letterSpacing="6"
                  fontWeight="500"
                >
                  <textPath href="#signal-seal-path" startOffset="1%">
                    COSMIC VAULT · COVER FOR THE LONG HORIZON · EST. 1998 ·
                  </textPath>
                </text>
                <text
                  fill="rgba(216,255,62,0.62)"
                  fontSize="11"
                  letterSpacing="6"
                  fontWeight="500"
                >
                  <textPath href="#signal-seal-path" startOffset="51%">
                    SIX COVER LINES · ONE VAULT · UNDERWRITTEN BY PEOPLE ·
                  </textPath>
                </text>
              </motion.g>

              <motion.circle
                cx="400"
                cy="66"
                r="4"
                fill="#d8ff3e"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "400px 400px" }}
              />
              <circle cx="400" cy="66" r="10" stroke="rgba(216,255,62,0.35)" />
            </svg>

            {/* Radar sweep, masked to the ring so it never covers the copy. */}
            <div
              aria-hidden="true"
              className="absolute inset-[19%] animate-[spin_18s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,rgba(216,255,62,0.22),transparent_32%)] [mask-image:radial-gradient(circle,transparent_60%,black_62%)]"
            />

            {/* Centre seal */}
            <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
              <div className="grid size-32 place-items-center rounded-full border border-[#d8ff3e]/25 bg-[#080a08]/80 text-center backdrop-blur-sm">
                <div>
                  <p className="text-[0.48rem] uppercase tracking-[0.32em] text-[#d8ff3e]/70">
                    Est.
                  </p>
                  <p className="mt-0.5 font-display text-[2rem] leading-none tracking-[-0.04em] text-[#f4f4ef]">
                    1998
                  </p>
                  <p className="mt-1.5 text-[0.44rem] uppercase tracking-[0.26em] text-white/40">
                    Independent
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="absolute -left-[6%] top-[13%]">
                <SignalStat
                  label="Claims in progress"
                  value="412"
                  note="Live across six cover lines"
                />
              </div>
              <div className="absolute right-[3%] top-[45%]">
                <SignalStat
                  label="Settled this week"
                  value="£4.2m"
                  note="Paid, not reserved"
                />
              </div>
              <div className="absolute bottom-[8%] left-[9%]">
                <SignalStat
                  label="Average settlement"
                  value="3.4 days"
                  note="From first notice of loss"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-5 pt-3">
        <motion.header
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 text-[0.52rem] font-medium uppercase tracking-[0.24em] text-white/40"
        >
          <span className="flex items-center gap-2.5">
            <Activity className="size-3.5 text-[#d8ff3e]" />
            The Signal — risk, accounted for
          </span>
          <span className="hidden tabular-nums sm:inline">51.5072° N / 0.1276° W</span>
          <span className="flex items-center gap-2 text-[#d8ff3e]/80">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#d8ff3e]/50" />
              <span className="relative inline-flex size-2 rounded-full bg-[#d8ff3e]" />
            </span>
            Live
          </span>
        </motion.header>

        <div className="flex flex-1 flex-col justify-center py-8 lg:max-w-[62%] lg:py-10">
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center gap-3 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-[#d8ff3e]"
          >
            <span className="h-px w-7 bg-[#d8ff3e]/60" />
            Cover, measured
          </motion.p>

          <h1 className="mt-5 text-[clamp(2.5rem,min(7vw,11vh),6.6rem)] font-semibold uppercase leading-[0.84] tracking-[-0.045em]">
            {LINES.map((line, index) => (
              <span
                key={line}
                className="block overflow-hidden pb-[0.05em] -mb-[0.05em]"
              >
                <motion.span
                  initial={reduce ? false : { y: "115%" }}
                  animate={{ y: "0%" }}
                  transition={{
                    duration: 1,
                    delay: 0.18 + index * 0.075,
                    ease: EASE,
                  }}
                  className={
                    index === LINES.length - 1
                      ? "block text-[#d8ff3e]"
                      : "block text-[#f4f4ef]"
                  }
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
            className="mt-7 max-w-[29rem]"
          >
            <p className="text-[0.88rem] leading-7 text-white/55">
              Six cover lines, one underwriter-reviewed policy, and a claims
              file that never leaves the vault. The future is unknowable. The
              paperwork doesn't have to be.
            </p>

            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onQuote}
                className="group inline-flex items-center justify-between gap-3 rounded-[2px] bg-[#d8ff3e] py-2 pl-5 pr-2 text-[0.86rem] font-semibold text-[#07080a] transition-colors hover:bg-[#c6ef22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8ff3e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080a] sm:justify-center"
              >
                Get a quote
                <span className="grid size-8 place-items-center rounded-[1px] bg-[#07080a]/15 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                  <ArrowUpRight className="size-4" strokeWidth={2.2} />
                </span>
              </button>
              <Link
                to="/claims"
                className="group inline-flex items-center justify-between gap-2 rounded-[2px] border border-white/15 px-4 py-2.5 text-[0.8rem] font-medium text-white/70 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080a] sm:justify-center"
              >
                See how claims work
                <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.52rem] font-medium uppercase tracking-[0.18em] text-white/35">
              <span>98.6% of claims paid</span>
              <span className="size-1 bg-[#d8ff3e]/50" />
              <span>Solvency ratio 214%</span>
              <span className="size-1 bg-[#d8ff3e]/50" />
              <span>No price promise before underwriting</span>
            </div>
          </motion.div>
        </div>

        {/* Cover line ticker */}
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.7 }}
          className="relative flex overflow-hidden border-y border-white/10 py-3"
        >
          <div className="flex w-max animate-marquee">
            <TickerGroup />
            <TickerGroup />
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#07080a] to-transparent"
          />
        </motion.div>
      </div>
    </section>
  );
}
