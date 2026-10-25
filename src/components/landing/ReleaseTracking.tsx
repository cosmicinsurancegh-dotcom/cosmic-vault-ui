import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Minus,
  PackageCheck,
  Radar,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SectionLabel } from "./SectionLabel";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Drives the rail on every visit: true once a third of the card is on screen,
 * and false again only after the card has left the viewport entirely. Two
 * thresholds rather than one, because a single observer would rewind the rail
 * while a third of it was still in front of the reader.
 */
function useReplayInView(ref: { readonly current: Element | null }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.35) setShown(true);
        else if (!entry.isIntersecting) setShown(false);
      },
      { threshold: [0, 0.35] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return shown;
}
/* One beat per stage on the rail, so the release reads left to right. The step
   is slow enough that each stage is legible on its own; the whole sequence runs
   about 2.3s, so a visitor who scrolls the card into view sees it from the first
   marker to the drawn rail rather than catching the tail of it. */
const STAGE_STEP = 0.22;
const MARKER_DURATION = 0.6;
const LABEL_DURATION = 0.6;

const STAGES = [
  {
    label: "Pending",
    time: "18 Oct · 09:00",
    note: "Outbound request recorded. Destination and carrier confirmed.",
    state: "done",
  },
  {
    label: "In Progress",
    time: "19 Oct · 09:00",
    note: "Sealed in a tamper-evident case and assigned to the carrier.",
    state: "done",
  },
  {
    label: "On Hold",
    time: "—",
    note: "Skipped. Would pause the release for an operational check.",
    state: "skipped",
  },
  {
    label: "In Transit",
    time: "19 Oct · 09:00",
    note: "Collected by Halcyon Armoured Transit. Air waybill issued and active.",
    state: "active",
  },
  {
    label: "Shipped",
    time: "Est. 22 Oct",
    note: "Awaiting delivery signature and photo evidence.",
    state: "next",
  },
] as const;

type StageState = (typeof STAGES)[number]["state"];

/**
 * One marker per stage: charged, live, skipped, or still to come. Each marker
 * pops in as its stage arrives, and the live one keeps a slow halo so the rail
 * reads as a process still in motion rather than a static diagram.
 */
function StageMarker({
  state,
  delay,
  shown,
  reduceMotion,
}: {
  state: StageState;
  delay: number;
  shown: boolean;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
      animate={
        reduceMotion || shown
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.5 }
      }
      transition={
        shown
          ? { duration: MARKER_DURATION, delay, ease: EASE }
          : /* Reset happens off screen, so it can be instant. */ { duration: 0 }
      }
      className={cn(
        "relative isolate z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card",
        state === "done" &&
          "bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_var(--electric)]",
        state === "active" &&
          "bg-primary text-primary-foreground ring-primary/20 shadow-[0_6px_14px_-8px_var(--electric)]",
        state === "skipped" &&
          "border border-dashed border-ink/25 bg-card text-muted-foreground/70",
        state === "next" && "border border-line bg-card",
      )}
    >
      {state === "active" && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/25"
          initial={{ opacity: 0, scale: 1 }}
          animate={
            shown ? { opacity: [0.5, 0], scale: [1, 2.2] } : { opacity: 0, scale: 1 }
          }
          transition={
            shown
              ? {
                  duration: 2.4,
                  delay: delay + 0.9,
                  repeat: Infinity,
                  ease: "easeOut",
                }
              : { duration: 0 }
          }
        />
      )}
      {state === "done" ? (
        <Check className="size-4" strokeWidth={2.6} />
      ) : state === "active" ? (
        <Truck className="size-4" strokeWidth={2.2} />
      ) : state === "skipped" ? (
        <Minus className="size-3.5" strokeWidth={2.4} />
      ) : (
        <span className="size-1.5 rounded-full bg-line" />
      )}
    </motion.span>
  );
}

const FACTS = [
  {
    Icon: Radar,
    title: "Five states, no invented ones",
    body: "Pending, In Progress, On Hold, In Transit, Shipped. The vocabulary is fixed so a status always means the same thing.",
  },
  {
    Icon: ShieldCheck,
    title: "Operations sets the state",
    body: "Only vault staff can move a release. Every change stores a timestamp, a note and the person accountable.",
  },
  {
    Icon: PackageCheck,
    title: "Cover runs until signature",
    body: "The policy stays in force on the road and in the air. Delivery is not complete until someone signs for it.",
  },
];

export function ReleaseTracking() {
  const activeIndex = STAGES.findIndex((stage) => stage.state === "active");
  const travelled =
    activeIndex === -1 ? 0 : ((activeIndex + 0.5) / STAGES.length) * 100 - 10;

  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const shown = useReplayInView(cardRef);

  return (
    <section
      id="tracking"
      className="mt-24 scroll-mt-24 bg-ice py-20 sm:mt-32 sm:py-24"
    >
      <div className="mx-auto max-w-[1240px] px-5">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel className="text-ink/60">
              Release & tracking
            </SectionLabel>
            <h2 className="mt-4 text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              A release you can <span className="text-electric">watch.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="lg:col-span-5 lg:pb-2">
            <p className="max-w-md text-[0.92rem] leading-7 text-ink/60">
              A withdrawal is not a favour. It is an operational process with
              five defined stages, published to the member the moment each one
              happens — and covered the whole way.
            </p>
          </Reveal>
        </div>

        <Reveal y={26}>
          <div
            ref={cardRef}
            className="mt-10 overflow-hidden rounded-[4px] border border-line bg-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Release record
                  <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[0.5rem] tracking-[0.16em] text-ink/50">
                    Sample
                  </span>
                </p>
                <p className="mt-1 text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
                  1 kg gold bar
                </p>
                <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                  Halcyon Armoured Transit · ETA 22 Oct 2026
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                In Transit
              </span>
            </div>

            {/* Desktop rail */}
            <div className="hidden px-7 pb-8 pt-9 md:block">
              <ol
                className="relative grid grid-cols-5"
                aria-label="Release stages"
              >
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[10%] right-[10%] top-[15px] h-0 border-t-2 border-dashed border-muted-foreground/30"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={reduceMotion || shown ? { opacity: 1 } : { opacity: 0 }}
                  transition={
                    shown
                      ? { duration: 0.6, delay: 0.1, ease: "easeOut" }
                      : { duration: 0 }
                  }
                />
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[10%] top-[14.5px] h-[3px] rounded-full bg-primary shadow-[0_2px_7px_-1px_var(--electric)]"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={
                    reduceMotion || shown
                      ? { width: `${travelled}%` }
                      : { width: 0 }
                  }
                  transition={
                    shown
                      ? { duration: 1.8, delay: 0.5, ease: EASE }
                      : { duration: 0 }
                  }
                />
                {STAGES.map((stage, index) => (
                  <motion.li
                    key={stage.label}
                    className="relative flex min-w-0 flex-col items-center px-2 text-center"
                    aria-current={stage.state === "active" ? "step" : undefined}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={
                      reduceMotion || shown
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 8 }
                    }
                    transition={
                      shown
                        ? {
                            duration: LABEL_DURATION,
                            delay: 0.4 + index * STAGE_STEP,
                            ease: EASE,
                          }
                        : { duration: 0 }
                    }
                  >
                    <StageMarker
                      state={stage.state}
                      delay={0.25 + index * STAGE_STEP}
                      shown={shown}
                      reduceMotion={reduceMotion}
                    />
                    <p
                      className={cn(
                        "mt-3 text-[0.72rem] font-semibold tracking-[-0.01em]",
                        stage.state === "active"
                          ? "text-primary"
                          : stage.state === "done"
                            ? "text-ink"
                            : "text-muted-foreground/70",
                      )}
                    >
                      {stage.label}
                    </p>
                    <p className="mt-1 text-[0.6rem] tabular-nums text-muted-foreground">
                      {stage.time}
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 max-w-[12rem] text-[0.65rem] leading-5",
                        stage.state === "skipped" || stage.state === "next"
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground",
                      )}
                    >
                      {stage.note}
                    </p>
                  </motion.li>
                ))}
              </ol>
            </div>

            {/* Mobile stack */}
            <ol className="px-5 py-6 md:hidden" aria-label="Release stages">
              {STAGES.map((stage, index) => (
                <motion.li
                  key={stage.label}
                  className={cn(
                    "relative flex gap-3.5",
                    index === STAGES.length - 1 ? "pb-0" : "pb-5",
                  )}
                  aria-current={stage.state === "active" ? "step" : undefined}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={
                    reduceMotion || shown
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 8 }
                  }
                  transition={
                    shown
                      ? {
                          duration: LABEL_DURATION,
                          delay: 0.3 + index * STAGE_STEP,
                          ease: EASE,
                        }
                      : { duration: 0 }
                  }
                >
                  {index < STAGES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[15px] top-8 h-[calc(100%-32px)] border-l-2 border-dashed border-muted-foreground/30"
                    />
                  )}
                  <StageMarker
                    state={stage.state}
                    delay={0.2 + index * STAGE_STEP}
                    shown={shown}
                    reduceMotion={reduceMotion}
                  />
                  <div className="min-w-0 pt-0.5">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={cn(
                          "text-[0.74rem] font-semibold tracking-[-0.01em]",
                          stage.state === "active"
                            ? "text-primary"
                            : stage.state === "done"
                              ? "text-ink"
                              : "text-muted-foreground/70",
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="text-[0.58rem] tabular-nums text-muted-foreground">
                        {stage.time}
                      </span>
                    </p>
                    <p className="mt-1 text-[0.66rem] leading-5 text-muted-foreground">
                      {stage.note}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {FACTS.map(({ Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 0.06}>
              <div className="border-t border-ink/10 pt-5">
                <Icon className="size-4 text-primary" strokeWidth={1.8} />
                <h3 className="mt-3 text-[0.9rem] font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-1.5 text-[0.78rem] leading-6 text-muted-foreground">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
