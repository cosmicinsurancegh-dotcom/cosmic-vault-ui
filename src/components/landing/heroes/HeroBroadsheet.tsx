import { MINERAL_IMAGES } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type HeroVariantProps = {
  onQuote: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTOPLAY_MS = 5200;

const HEADLINE: { text: string; accent?: boolean }[] = [
  { text: "Stored in the" },
  { text: "vault. Covered" },
  { text: "to the gram.", accent: true },
];

/* The four storage classes, in the same order the store section lists them.
   Each slide is a real certificate stub, so the reference, the recorded
   measure and the seal belong to the object on screen. */
const SLIDES = [
  {
    label: "Bullion & bars",
    image: MINERAL_IMAGES.bullion,
    reference: "CV-A-1042",
    detailLabel: "Weight",
    detail: "1,000.0 g · assayed",
  },
  {
    label: "Diamonds & gemstones",
    image: MINERAL_IMAGES.diamonds,
    reference: "CV-D-2287",
    detailLabel: "Graded",
    detail: "12 stones · ct certified",
  },
  {
    label: "Rare earths",
    image: MINERAL_IMAGES.rareEarth,
    reference: "CV-R-0913",
    detailLabel: "Documented",
    detail: "Oxide · 99.9% · lot sealed",
  },
  {
    label: "Collections",
    image: MINERAL_IMAGES.ruby,
    reference: "CV-C-4408",
    detailLabel: "Objects",
    detail: "9 pieces · one record",
  },
];

function StubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Hero study 01 — "The Broadsheet".
 * A printed editorial composition on the Cosmic Vault palette, with an
 * auto-advancing set of the four storage classes in the photograph slot.
 */
export function HeroBroadsheet({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const [slide, setSlide] = useState(0);
  /* null = auto, true = paused by the reader, false = explicitly playing. */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [inView, setInView] = useState(true);
  const figureRef = useRef<HTMLDivElement | null>(null);

  const active = SLIDES[slide] ?? SLIDES[0];
  /* Hover and focus hold the show, but an explicit Play overrides both so the
     control still works with the pointer resting on the photograph. */
  const held = hovered || focusWithin;
  const playing =
    !reduce &&
    userPaused !== true &&
    !pageHidden &&
    inView &&
    (userPaused === false || !held);

  /* Pause the imagery when the page or the hero leaves the screen. */
  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const node = figureRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* A timeout rather than an interval, so choosing a slide resets the dwell. */
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setSlide((current) => (current + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [playing, slide]);

  /* Warm the cache after first paint so later slides never flash. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      SLIDES.forEach(({ image }) => {
        const preload = new Image();
        preload.src = image.src;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background pb-0 pt-16 text-ink sm:pt-20"
    >
      {/* A cool paper wash, a faint tooth and one soft electric bloom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-ice/70 via-background to-background"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-ink/[0.055] [background-image:radial-gradient(currentColor_0.5px,transparent_0.5px)] [background-size:4px_4px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-0 -z-10 size-[36rem] rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-5 sm:px-8 lg:px-10">
        <div className="grid flex-1 items-center gap-7 py-5 sm:gap-12 sm:py-12 lg:grid-cols-12 lg:gap-8">
          {/* Type column */}
          <div className="lg:col-span-7 lg:pr-6">
            <motion.p
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-primary"
            >
              Vault custody · object insurance
            </motion.p>

            <h1 className="mt-4 max-w-[12ch] text-[clamp(2.55rem,7.1vw,6.4rem)] font-semibold leading-[0.9] tracking-[-0.055em] text-ink sm:mt-5">
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
                        ? "block font-serif italic tracking-[-0.06em] text-primary"
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
              className="mt-4 grid gap-5 sm:mt-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-6"
            >
              <div className="max-w-[24rem]">
                <p className="hidden text-[0.88rem] leading-7 text-muted-foreground sm:block">
                  Gold, stones and critical minerals — held under dual control,
                  each on its own named policy.
                </p>
                <p className="mt-2.5 flex items-center gap-2 text-[0.58rem] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:mt-3 sm:text-[0.6rem]">
                  <ShieldCheck className="size-3.5 shrink-0 text-primary" />
                  Cover bound before the drawer closes
                </p>
              </div>

              <div className="flex flex-col items-start gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={onQuote}
                  className="group inline-flex items-center gap-3 rounded-[4px] bg-primary py-2 pl-5 pr-2 text-[0.86rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Request a vault review
                  <span className="grid size-8 place-items-center rounded-[4px] bg-primary-foreground/20 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-45">
                    <ArrowUpRight className="size-4" strokeWidth={2} />
                  </span>
                </button>
                <a
                  href="#store"
                  className="link-slide text-[0.72rem] font-medium text-muted-foreground transition-colors hover:text-ink sm:text-[0.74rem]"
                >
                  See what we store
                </a>
              </div>
            </motion.div>
          </div>

          {/* Auto-sliding class imagery with the certificate stub breaking out */}
          <div className="relative lg:col-span-5">
            <motion.figure
              ref={figureRef}
              role="group"
              aria-roledescription="carousel"
              aria-label="The four storage classes"
              initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
              animate={{ clipPath: "inset(0 0 0% 0)" }}
              transition={{ duration: 1.15, delay: 0.22, ease: EASE }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocusCapture={() => setFocusWithin(true)}
              onBlurCapture={(event) => {
                if (
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  setFocusWithin(false);
                }
              }}
              className="relative overflow-hidden bg-muted"
            >
              <div className="relative aspect-[16/11] w-full sm:aspect-[4/5] lg:aspect-auto lg:h-[min(64vh,38rem)]">
                <AnimatePresence initial={false}>
                  <motion.img
                    key={active.label}
                    src={active.image.src}
                    alt={active.image.alt}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    initial={reduce ? false : { opacity: 0, scale: 1.045 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.85, ease: EASE }}
                    className="absolute inset-0 size-full object-cover"
                    style={{ objectPosition: active.image.position }}
                  />
                </AnimatePresence>
              </div>

              <span
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-navy/60 via-navy/10 to-transparent"
              />

              {/* Slide controls, overlaid so they add no height on mobile. */}
              <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-full border border-bone/20 bg-navy/35 p-1 backdrop-blur-md">
                {SLIDES.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSlide(index)}
                    aria-label={`Show the ${item.label} class`}
                    aria-current={index === slide ? "true" : undefined}
                    className="grid size-5 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/80"
                  >
                    <span
                      className={cn(
                        "block h-[2px] rounded-full transition-all duration-300",
                        index === slide
                          ? "w-3 bg-bone"
                          : "w-1.5 bg-bone/40 hover:bg-bone/75",
                      )}
                    />
                  </button>
                ))}
                {!reduce && (
                  <button
                    type="button"
                    onClick={() => setUserPaused((current) => current !== true)}
                    aria-pressed={userPaused === true}
                    aria-label={
                      userPaused === true
                        ? "Play class slideshow"
                        : "Pause class slideshow"
                    }
                    className="ml-0.5 grid size-5 place-items-center rounded-full text-bone/80 transition-colors hover:bg-bone/10 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone/80"
                  >
                    {userPaused === true ? (
                      <Play className="size-2.5" strokeWidth={2.5} />
                    ) : (
                      <Pause className="size-2.5" strokeWidth={2.5} />
                    )}
                  </button>
                )}
              </div>

              <figcaption className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-3 text-[0.52rem] font-medium uppercase tracking-[0.2em] text-bone/85">
                <span>{active.label}</span>
                <span className="tabular-nums">
                  {String(slide + 1).padStart(2, "0")} /{" "}
                  {String(SLIDES.length).padStart(2, "0")}
                </span>
              </figcaption>
            </motion.figure>

            {/* Paper certificate stub */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 26, rotate: -9 }}
              animate={{ opacity: 1, y: 0, rotate: -3 }}
              transition={{ duration: 0.85, delay: 0.7, ease: EASE }}
              className="absolute -bottom-7 -left-8 hidden w-[15rem] rounded-[4px] bg-card p-4 shadow-[0_30px_60px_-28px_rgba(8,18,39,0.55)] lg:block"
            >
              <div className="flex items-center justify-between gap-2 text-[0.46rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <span>Vault certificate</span>
                <ShieldCheck className="size-3.5 text-primary" />
              </div>
              <p className="mt-2 font-display text-[1.1rem] leading-none tracking-[-0.02em] text-ink">
                Ref {active.reference}
              </p>
              <div className="mt-3 space-y-1.5 text-[0.56rem] leading-4">
                <StubRow label="Depositor" value="A. Whitfield" />
                <StubRow label="Class" value={active.label} />
                <StubRow label={active.detailLabel} value={active.detail} />
                <StubRow label="Seal" value="Intact" />
              </div>
              <div className="absolute -right-3 -top-4 grid size-16 rotate-[9deg] place-items-center rounded-full bg-card text-center text-[0.4rem] font-semibold uppercase leading-[1.35] tracking-[0.12em] text-primary shadow-[0_12px_26px_-16px_rgba(8,18,39,0.55)]">
                Appraised
                <br />
                12 Nov
              </div>
            </motion.div>
          </div>
        </div>

        <div className="hidden items-center justify-end py-4 sm:flex">
          <span className="flex items-center gap-2 text-[0.5rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Scroll to read
            <ArrowDown className="size-3" />
          </span>
        </div>
      </div>
    </section>
  );
}
