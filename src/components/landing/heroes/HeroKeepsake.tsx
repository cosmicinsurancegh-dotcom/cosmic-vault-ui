import { CtaButton } from "@/components/site/Cta";
import { coverImage, IMAGES, type VaultImage } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Pause, Play, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type HeroVariantProps = {
  onQuote: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTOPLAY_MS = 6200;

type Slide = { id: string; label: string; image: VaultImage };

/* The three photographs are the same ones the cover pages use, so the hero
   never introduces imagery that cannot be found elsewhere on the site. */
const SLIDES: Slide[] = [
  { id: "life", label: "Life & family", image: coverImage("life") },
  { id: "home", label: "Home & contents", image: coverImage("home") },
  { id: "advisory", label: "The advisory desk", image: IMAGES.story },
];

function SlideControl({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} photograph`}
      className="group grid size-11 place-items-center rounded-full border border-ink/15 bg-background/55 text-ink/50 backdrop-blur-sm transition-colors duration-300 hover:border-electric/45 hover:bg-background hover:text-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Icon
        className={cn(
          "size-4 transition-transform duration-300",
          direction === "previous"
            ? "group-hover:-translate-x-0.5"
            : "group-hover:translate-x-0.5",
        )}
        strokeWidth={1.6}
      />
    </button>
  );
}

/**
 * Hero study — "The Keepsake".
 * A quiet, light split: a wide, generously led headline on the page's left
 * half and a full-height family photograph on the right, dissolving into the
 * paper at the seam. The controls sit in the margin so the composition stays
 * airy, and the rule above the headline carries the slide marker.
 */
export function HeroKeepsake({ onQuote }: HeroVariantProps) {
  const reduce = useReducedMotion();
  const [slide, setSlide] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [inView, setInView] = useState(true);
  /* null = auto, true = paused by the reader, false = explicitly playing. */
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);

  const active = SLIDES[slide] ?? SLIDES[0];
  const held = hovered || focusWithin;
  const playing =
    !reduce &&
    userPaused !== true &&
    !pageHidden &&
    inView &&
    (userPaused === false || !held);
  const marker = ((slide + 0.5) / SLIDES.length) * 100;

  const go = (delta: number) =>
    setSlide((current) => (current + delta + SLIDES.length) % SLIDES.length);

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

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => setSlide((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [playing, slide]);

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
      className="relative isolate overflow-hidden bg-background text-ink lg:min-h-svh"
    >
      {/* Paper wash, a faint tooth, and two soft panels stacked behind the type. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-ice/80 via-background to-background"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 text-ink/[0.04] [background-image:radial-gradient(currentColor_0.5px,transparent_0.5px)] [background-size:4px_4px]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-[18%] hidden size-[24rem] rotate-[16deg] rounded-[4px] border border-ink/[0.04] bg-card/60 shadow-[0_60px_120px_-90px_rgba(8,18,39,0.6)] sm:block" />
        <div className="absolute -left-10 top-[34%] hidden size-[15rem] -rotate-6 rounded-[4px] border border-ink/[0.04] bg-card/50 sm:block" />
        <div className="absolute bottom-0 left-0 size-[22rem] rounded-full bg-halo/[0.12] blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col pt-24 sm:pt-28 lg:min-h-svh lg:flex-row lg:items-center lg:pt-0">
        <div className="w-full px-5 pb-10 sm:px-8 sm:pb-12 lg:px-10 lg:pb-0">
          <div className="mx-auto w-full max-w-[1320px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10 lg:py-24">
              {/* Margin rail: the reference's vertical pair of arrows. */}
              <div className="hidden shrink-0 flex-col gap-3 lg:flex">
                <SlideControl direction="previous" onClick={() => go(-1)} />
                <SlideControl direction="next" onClick={() => go(1)} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="max-w-[32rem] lg:max-w-[30rem] xl:max-w-[32rem]">
                  {/* Gradient rule with the slide marker riding above it. */}
                  <div className="relative w-[min(20rem,74%)]">
                    <span
                      aria-hidden="true"
                      className="absolute -top-[1.15rem] grid size-3 -translate-x-1/2 place-items-center rounded-full border border-primary/45 bg-background shadow-[0_0_0_3px_var(--background)] transition-[left] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ left: `${marker}%` }}
                    >
                      <span className="size-1 rounded-full bg-primary" />
                    </span>
                    <motion.span
                      aria-hidden="true"
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 1, delay: 0.1, ease: EASE }}
                      className="block h-[7px] w-full origin-left rounded-full bg-[linear-gradient(90deg,var(--electric),var(--electric-soft))]"
                    />
                  </div>

                  <h1 className="mt-7 text-[clamp(2.5rem,4.6vw,4.2rem)] font-semibold leading-[1.01] tracking-[-0.048em] text-ink">
                    {["Cover for", "the life you've"].map((line, index) => (
                      <span
                        key={line}
                        className="block overflow-hidden pb-[0.08em] -mb-[0.08em]"
                      >
                        <motion.span
                          initial={reduce ? false : { y: "115%" }}
                          animate={{ y: "0%" }}
                          transition={{
                            duration: 1,
                            delay: 0.16 + index * 0.08,
                            ease: EASE,
                          }}
                          className="block"
                        >
                          {line}
                        </motion.span>
                      </span>
                    ))}
                    <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
                      <motion.span
                        initial={reduce ? false : { y: "115%" }}
                        animate={{ y: "0%" }}
                        transition={{ duration: 1, delay: 0.32, ease: EASE }}
                        className="block"
                      >
                        actually <span className="text-primary">built.</span>
                      </motion.span>
                    </span>
                  </h1>

                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
                  >
                    <p className="mt-6 max-w-[24rem] text-[0.92rem] leading-7 text-muted-foreground">
                      Six cover lines, written by underwriters who read the file
                      — not a form.
                    </p>

                    <div className="mt-8">
                      <CtaButton onClick={onQuote}>Let&apos;s get started</CtaButton>
                    </div>

                    <p className="mt-5 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      <ShieldCheck className="size-3.5 shrink-0 text-primary" />
                      A person reviews every application
                    </p>

                    {/* The margin rail is desktop-only; these carry the same
                        controls on small screens. */}
                    <div className="mt-8 flex items-center gap-4 lg:hidden">
                      <SlideControl
                        direction="previous"
                        onClick={() => go(-1)}
                      />
                      <span className="text-[0.58rem] font-medium uppercase tracking-[0.22em] text-muted-foreground tabular-nums">
                        {String(slide + 1).padStart(2, "0")} /{" "}
                        {String(SLIDES.length).padStart(2, "0")}
                      </span>
                      <SlideControl direction="next" onClick={() => go(1)} />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Full-height photograph, bleeding to the right and bottom edges. */}
        <motion.figure
          ref={figureRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="Cosmic Vault cover photography"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setFocusWithin(false);
            }
          }}
          className="relative h-[62svh] min-h-[22rem] w-full overflow-hidden bg-muted sm:h-[66svh] lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-1/2"
        >
          <AnimatePresence initial={false}>
            <motion.img
              key={active.id}
              src={active.image.src}
              alt={active.image.alt}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              initial={reduce ? false : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.6, ease: EASE } }}
              transition={{ duration: reduce ? 0 : 0.95, ease: EASE }}
              className="absolute inset-0 size-full object-cover"
              style={{ objectPosition: active.image.position }}
            />
          </AnimatePresence>

          {/* The seam: photograph dissolving back into the page. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/85 to-transparent lg:hidden"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-[26%] bg-gradient-to-r from-background via-background/60 to-transparent lg:block"
          />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-background/80 px-3 py-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-ink/70 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-primary" />
              {active.label}
            </span>
            <span className="flex items-center gap-1.5">
              {!reduce && (
                <button
                  type="button"
                  onClick={() => setUserPaused((current) => current !== true)}
                  aria-pressed={userPaused === true}
                  aria-label={
                    userPaused === true
                      ? "Play cover photography"
                      : "Pause cover photography"
                  }
                  className="grid size-7 place-items-center rounded-full border border-ink/10 bg-background/80 text-ink/65 backdrop-blur-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {userPaused === true ? (
                    <Play className="size-3" strokeWidth={2.2} />
                  ) : (
                    <Pause className="size-3" strokeWidth={2.2} />
                  )}
                </button>
              )}
              <span className="inline-flex items-center rounded-full border border-ink/10 bg-background/80 px-3 py-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-ink/70 tabular-nums backdrop-blur-md">
                {String(slide + 1).padStart(2, "0")} /{" "}
                {String(SLIDES.length).padStart(2, "0")}
              </span>
            </span>
          </figcaption>

          <span aria-live="polite" className="sr-only">
            Photograph {slide + 1} of {SLIDES.length}: {active.label}
          </span>
        </motion.figure>
      </div>
    </section>
  );
}
