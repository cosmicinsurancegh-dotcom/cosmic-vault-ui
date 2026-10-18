import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { ADVISOR_FACES, coverImage } from "@/lib/imagery";
import { SectionLabel } from "./SectionLabel";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Pause,
  Play,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Link } from "react-router";

const AUTOPLAY_MS = 7200;

type Slide = {
  slug: string;
  tab: string;
  kicker: string;
  product: string;
  title: string;
  emphasis: string;
  body: string;
  features: string[];
};

const slides: Slide[] = [
  {
    slug: "home",
    tab: "Home",
    kicker: "Home & contents",
    product: "Vault Home & Contents",
    title: "The roof above you.",
    emphasis: "The life inside it.",
    body: "Buildings and contents written on the property you actually live in — not a postcode average — and reviewed by a person before any cover begins.",
    features: [
      "Buildings, contents, or both on one policy",
      "Rated on the rebuild value you declare",
      "Escape of water and storm damage considered",
    ],
  },
  {
    slug: "motor",
    tab: "Motor",
    kicker: "Motor",
    product: "Vault Comprehensive Motor",
    title: "For every mile",
    emphasis: "you mean to drive.",
    body: "Comprehensive private car cover for up to three vehicles on one policy, with the excess and the exclusions stated plainly in the schedule.",
    features: [
      "Up to three vehicles on one policy",
      "A named claims handler, not a queue",
      "Glass cover and limited European use",
    ],
  },
  {
    slug: "travel",
    tab: "Travel",
    kicker: "Travel",
    product: "Vault Worldwide Travel",
    title: "Cover that travels",
    emphasis: "wherever you land.",
    body: "Single-trip or annual cover with emergency medical treatment and repatriation at its centre, and one assistance number that answers from anywhere.",
    features: [
      "Emergency medical treatment and repatriation",
      "Cancellation, curtailment and baggage",
      "An assistance line staffed day and night",
    ],
  },
  {
    slug: "health",
    tab: "Health",
    kicker: "Health",
    product: "Vault Private Health",
    title: "Care that doesn't",
    emphasis: "wait in a queue.",
    body: "Consultant-led diagnostics, second opinions and mental-health support without needing a referral first — with pre-existing conditions assessed individually.",
    features: [
      "Consultant and diagnostic care",
      "Mental-health support without a referral",
      "Dental and optical option available",
    ],
  },
  {
    slug: "life",
    tab: "Life",
    kicker: "Life & family",
    product: "Vault Term Life",
    title: "A promise that",
    emphasis: "outlasts you.",
    body: "Level term cover for a fixed sum over a fixed term, with an optional critical illness element and guidance on putting the policy in trust.",
    features: [
      "A fixed sum assured for a fixed term",
      "Critical illness option where accepted",
      "Trust wording guidance included",
    ],
  },
  {
    slug: "business",
    tab: "Business",
    kicker: "Business",
    product: "Vault Business Liability",
    title: "Built by you.",
    emphasis: "Backed by us.",
    body: "Public and employers' liability for owner-managed businesses, rated on sector, headcount and turnover, with an account handler who knows the file.",
    features: [
      "Public and employers' liability",
      "Business interruption option",
      "Legal expenses helpline",
    ],
  },
];

const pad = (value: number) => String(value + 1).padStart(2, "0");

export function Hero({ onQuote }: { onQuote: () => void }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const elapsedRef = useRef(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const suppressHoverRef = useRef(false);

  const slide = slides[index];
  const playing =
    !paused && !hovered && !keyboardFocus && !pageHidden && !reduceMotion;

  const go = useCallback((next: number) => {
    elapsedRef.current = 0;
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, []);

  /* Resuming from the explicit control should also lift the temporary hover
     and focus holds, otherwise the show appears not to restart until the
     pointer leaves the panel. */
  const togglePlayback = () => {
    const next = !paused;
    setPaused(next);
    if (!next) {
      suppressHoverRef.current = true;
      setHovered(false);
      setKeyboardFocus(false);
    }
  };

  /* Pause the show while the tab is in the background. */
  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* Drive the autoplay line directly on the element, so the frames do not
     re-render the whole slider. Hovering, focusing or pausing holds the line
     where it was, and it picks up from the same point afterwards. */
  useEffect(() => {
    const bar = progressRef.current;
    if (reduceMotion) {
      if (bar) bar.style.transform = "scaleX(1)";
      return;
    }
    if (!playing) return;

    const startedAt = performance.now() - elapsedRef.current * AUTOPLAY_MS;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / AUTOPLAY_MS);
      elapsedRef.current = progress;
      if (bar) bar.style.transform = `scaleX(${progress})`;
      if (progress >= 1) {
        elapsedRef.current = 0;
        setIndex((current) => (current + 1) % slides.length);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, playing, reduceMotion]);

  /* A change of slide always starts its own line from zero. */
  useEffect(() => {
    if (progressRef.current) progressRef.current.style.transform = "scaleX(0)";
  }, [index]);

  /* On narrow screens the chapter rail scrolls. Keep the current tab in view
     when the show advances on its own or via the arrows. */
  useEffect(() => {
    const rail = railRef.current;
    const tab = tabRefs.current[index];
    if (!rail || !tab || rail.scrollWidth <= rail.clientWidth) return;
    const railBox = rail.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.left >= railBox.left && tabBox.right <= railBox.right) return;
    const offset =
      tabBox.left +
      tabBox.width / 2 -
      (railBox.left + railBox.width / 2);
    rail.scrollBy({
      left: offset,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [index, reduceMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(slides.length - 1);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      go(index + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Ambient light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] size-[34rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.18),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-14%] top-[46%] size-[24rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(228,217,196,0.55),transparent_70%)] blur-2xl"
      />

      <div className="relative">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Cover lines from Cosmic Vault"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeRef.current = null)}
          onMouseEnter={() => {
            if (!suppressHoverRef.current) setHovered(true);
          }}
          onMouseLeave={() => {
            suppressHoverRef.current = false;
            setHovered(false);
          }}
          onFocusCapture={(event) => {
            /* Only a keyboard focus should stop the show — a click should not. */
            if ((event.target as HTMLElement).matches?.(":focus-visible")) {
              setKeyboardFocus(true);
            }
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setKeyboardFocus(false);
            }
          }}
          className="group/hero relative isolate flex w-full touch-pan-y flex-col overflow-hidden bg-[#071227] text-bone outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* Slide photography, stacked and cross-faded */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            {slides.map((item, itemIndex) => {
              const active = itemIndex === index;
              return (
                <motion.div
                  key={item.slug}
                  className="absolute inset-0"
                  initial={false}
                  animate={{
                    opacity: active ? 1 : 0,
                    scale: active && !reduceMotion ? 1.05 : 1,
                  }}
                  transition={{
                    opacity: { duration: reduceMotion ? 0 : 1.1, ease: "easeOut" },
                    scale: { duration: 10, ease: "linear" },
                  }}
                >
                  <Media
                    image={coverImage(item.slug)}
                    eager={itemIndex === 0}
                    className="size-full"
                  />
                </motion.div>
              );
            })}

            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,16,31,0.97)_0%,rgba(4,16,31,0.9)_34%,rgba(4,16,31,0.75)_62%,rgba(4,16,31,0.6)_100%)]" />
            <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(4,16,31,0.9)_0%,rgba(4,16,31,0.5)_42%,rgba(4,16,31,0.05)_76%)] lg:block" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#04101f]/85 to-transparent sm:h-32" />
          </div>

          {/* Slide copy — the top padding clears the floating navbar
              (≈70px on mobile, ≈74px from sm up). */}
          <div className="relative z-10 mx-auto mt-auto grid w-full max-w-[1180px] gap-8 px-5 pb-6 pt-[5.25rem] sm:px-8 sm:pb-8 sm:pt-24 lg:grid-cols-12 lg:items-end lg:gap-10 lg:pb-9 lg:pt-28">
            <div className="lg:col-span-7">
              <div
                role="tabpanel"
                id="hero-slide-panel"
                aria-labelledby={`hero-tab-${slide.slug}`}
                aria-live="off"
                className="min-h-[15.5rem] sm:min-h-[17rem]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={slide.slug}
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <SectionLabel index={pad(index)} className="text-bone/70">
                      {slide.kicker}
                    </SectionLabel>

                    <h1 className="mt-4 max-w-[23ch] text-[clamp(2.35rem,5.6vw,4.5rem)] font-semibold leading-[0.97] tracking-[-0.045em] text-bone">
                      {slide.title}{" "}
                      <span className="text-electric-soft">{slide.emphasis}</span>
                    </h1>

                    <p className="mt-5 max-w-lg text-[0.93rem] leading-7 text-bone/65">
                      {slide.body}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <CtaButton onClick={onQuote}>Get a quote</CtaButton>
                <Link
                  to={`/cover/${slide.slug}`}
                  className="group/explore inline-flex items-center gap-2.5 rounded-full px-2 py-2 text-[0.86rem] font-medium text-bone/70 transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="link-slide">Explore this cover</span>
                  <span className="grid size-8 place-items-center rounded-full border border-white/20 transition-colors group-hover/explore:border-white/45">
                    <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover/explore:-translate-y-0.5 group-hover/explore:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>

            {/* What is inside the cover line */}
            <div className="hidden lg:col-span-5 lg:block">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.slug}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.45,
                    delay: reduceMotion ? 0 : 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="rounded-[1.35rem] border border-white/12 bg-[#071227]/85 p-5 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[0.56rem] font-semibold uppercase tracking-[0.24em] text-bone/55">
                      On this cover line
                    </p>
                    <ShieldCheck className="size-4 text-electric-soft" />
                  </div>
                  <p className="mt-2 font-display text-xl leading-tight text-bone">
                    {slide.product}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {slide.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[0.8rem] leading-5 text-bone/65"
                      >
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-white/10 text-electric-soft">
                          <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 border-t border-white/10 pt-3.5 text-[0.62rem] leading-5 text-bone/55">
                    Indicative pricing, reviewed by an underwriter before cover
                    begins. The schedule states the terms that apply.
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Directly arranged cover — its own line above the rail, with the
              play/pause control beside it and outside the arrow controls. */}
          <div className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-end gap-2.5 px-5 pb-3 sm:gap-3 sm:px-8 sm:pb-4">
            <p className="flex items-center gap-2 whitespace-nowrap text-[0.5rem] font-semibold uppercase leading-none tracking-[0.16em] text-bone/50 sm:text-[0.55rem] sm:tracking-[0.2em]">
              <span
                aria-hidden="true"
                className="hidden h-px w-6 bg-gradient-to-r from-transparent to-electric-soft/70 sm:block"
              />
              Directly arranged cover
            </p>
            {!reduceMotion && (
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={paused ? "Play slide show" : "Pause slide show"}
                className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-bone/70 backdrop-blur-md transition-colors hover:border-white/35 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {paused ? (
                  <Play className="size-3.5" />
                ) : (
                  <Pause className="size-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Chapter rail */}
          <div className="relative z-10 border-t border-white/10 bg-[#071227]/40 py-3.5 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-5 sm:px-8">
              <div
                ref={railRef}
                role="tablist"
                aria-label="Choose a cover line"
                className="flex flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {slides.map((item, itemIndex) => {
                  const active = itemIndex === index;
                  return (
                    <button
                      key={item.slug}
                      ref={(node) => {
                        tabRefs.current[itemIndex] = node;
                      }}
                      id={`hero-tab-${item.slug}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls="hero-slide-panel"
                      onClick={() => go(itemIndex)}
                      className={cn(
                        "group/tab relative flex shrink-0 items-center gap-2.5 rounded-full px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]",
                        !active && "hover:bg-white/[0.05]",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="hero-tab-pill"
                          transition={{
                            duration: reduceMotion ? 0 : 0.35,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="absolute inset-0 rounded-full bg-white/10"
                        />
                      )}
                      <span
                        className={cn(
                          "relative text-[0.62rem] font-semibold tabular-nums transition-colors",
                          active ? "text-electric-soft" : "text-bone/40",
                        )}
                      >
                        {pad(itemIndex)}
                      </span>
                      <span
                        className={cn(
                          "relative text-[0.78rem] transition-colors",
                          active
                            ? "font-medium text-bone"
                            : "text-bone/55 group-hover/tab:text-bone/80",
                        )}
                      >
                        {item.tab}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Slide controls — counter and arrows only. */}
              <div className="flex shrink-0 items-center gap-3 border-l border-white/10 pl-3 sm:pl-4">
                <span className="hidden font-display text-sm italic tabular-nums text-bone/70 sm:block">
                  {pad(index)}{" "}
                  <span className="text-bone/40">/ {pad(slides.length - 1)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    aria-label="Previous cover line"
                    className="press grid size-9 place-items-center rounded-full border border-white/15 text-bone/65 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    aria-label="Next cover line"
                    className="press grid size-9 place-items-center rounded-full border border-white/15 text-bone/65 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Autoplay line */}
          <div aria-hidden="true" className="relative z-10 h-[2px] w-full bg-white/10">
            <span
              ref={progressRef}
              className="block h-full origin-left bg-electric-soft"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>

        {/* Trust bar */}
        <div className="mx-auto mt-4 flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-5 pb-6 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {ADVISOR_FACES.map((face) => (
                <Media
                  key={face.src}
                  image={face}
                  className="size-6 rounded-full border border-background"
                  imgClassName="scale-105"
                />
              )).reverse()}
            </div>
            <p className="text-[0.72rem] text-muted-foreground">
              <span className="font-medium text-ink">Advisors, not bots.</span>{" "}
              Every application is read by a person.
            </p>
          </div>
          <div className="hidden items-center gap-4 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <span>Six cover lines</span>
            <span className="h-3 w-px bg-line" />
            <span>One vault</span>
            <span className="h-3 w-px bg-line" />
            <span>No price promise before underwriting</span>
          </div>
        </div>
      </div>
    </section>
  );
}
