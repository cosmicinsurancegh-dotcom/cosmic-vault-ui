import AcidSquares from "@/components/reactbits/AcidSquares";
import { CtaButton } from "@/components/site/Cta";
import { Media } from "@/components/site/Media";
import { ADVISOR_FACES } from "@/lib/imagery";
import { SectionLabel } from "./SectionLabel";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
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
    body: "Buildings and contents written on the property you actually live in - not a postcode average - and reviewed by a person before any cover begins.",
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
    body: "Consultant-led diagnostics, second opinions and mental-health support without needing a referral first - with pre-existing conditions assessed individually.",
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

export function Hero({ onQuote }: { onQuote: () => void }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const elapsedRef = useRef(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const slide = slides[index];
  const playing = !hovered && !keyboardFocus && !pageHidden && !reduceMotion;

  const go = useCallback((next: number) => {
    elapsedRef.current = 0;
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, []);

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
    /* The hero owns one full fold: the panel grows to fill the viewport and
       stops at 56rem on very tall displays, so the composition never becomes
       a banner on a 4K screen or a clipped rail on a 768px laptop. */
    <section
      id="top"
      className="relative flex min-h-[min(100svh,56rem)] flex-col overflow-hidden"
    >
      <div className="relative flex flex-1 flex-col">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Cover lines from Cosmic Vault"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeRef.current = null)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={(event) => {
            /* Only a keyboard focus should stop the show - a click should not. */
            if ((event.target as HTMLElement).matches?.(":focus-visible")) {
              setKeyboardFocus(true);
            }
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setKeyboardFocus(false);
            }
          }}
          className="group/hero relative isolate flex w-full flex-1 touch-pan-y flex-col overflow-hidden bg-[#0b1930] text-bone outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {/* The vault surface: one acid-tile field behind every cover line,
              lit from either side and dimmed at the foot so the copy holds. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
            <AcidSquares
              color="#0e2342"
              accentColor="#4c7dff"
              secondaryColor="#e4d9c4"
              tileSize={1.15}
              gap={0.14}
              roundness={0.28}
              rotation={35}
              waves={1}
              pulse={0}
              lighting="split"
              tilt={0.68}
              grain={0.1}
              fade={0.2}
              opacity={1}
              brightness={0.86}
              gloss={0}
              intro
              mouseInteraction={false}
            />

            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,16,31,0.72)_0%,rgba(4,16,31,0.34)_34%,rgba(4,16,31,0.08)_64%,rgba(4,16,31,0.38)_100%)]" />
            <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(4,16,31,0.62)_0%,rgba(4,16,31,0.24)_44%,transparent_74%)] lg:block" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#04101f]/50 to-transparent sm:h-32" />
          </div>

          {/* Slide copy - centred in the space between the floating navbar
              and the chapter rail (the top padding clears the navbar: ≈70px
              on mobile, ≈74px from sm up). */}
          <div className="relative z-10 mx-auto my-auto grid w-full max-w-[1180px] gap-8 px-5 pb-7 pt-20 sm:px-8 sm:pb-8 sm:pt-24 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-10 lg:pt-24">
            <div className="lg:col-span-7">
              {/* Height is reserved for the tallest cover line in each range
                  (measured to the widest wrap), so autoplay never nudges the
                  CTA row or the chapter rail. */}
              <div
                role="tabpanel"
                id="hero-slide-panel"
                aria-labelledby={`hero-tab-${slide.slug}`}
                aria-live="off"
                className="min-h-[19rem] min-[360px]:min-h-[15.5rem] lg:min-h-[17rem]"
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
                    <SectionLabel className="text-bone/70">
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

              {/* On phones the two actions stack deliberately (a full-width
                  primary, then the quieter link) instead of wrapping at random
                  widths; from sm up they sit inline. */}
              <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center">
                <CtaButton
                  onClick={onQuote}
                  className="w-full justify-between sm:w-auto sm:justify-center"
                >
                  Get a quote
                </CtaButton>
                <Link
                  to={`/cover/${slide.slug}`}
                  className="group/explore inline-flex items-center gap-2.5 self-start rounded-[4px] px-2 py-2 text-[0.86rem] font-medium text-bone/70 transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-auto"
                >
                  <span className="link-slide">Explore this cover</span>
                  <span className="grid size-8 place-items-center rounded-[4px] border border-white/20 transition-colors group-hover/explore:border-white/45">
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
                  className="rounded-[4px] border border-white/12 bg-[#071227]/85 p-5 backdrop-blur-md"
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
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] bg-white/10 text-electric-soft">
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

          {/* Chapter rail */}
          <div className="relative z-10 py-3.5">
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
                        "group/tab relative flex shrink-0 items-center gap-2.5 rounded-[4px] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]",
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
                          className="absolute inset-0 rounded-[4px] bg-white/10"
                        />
                      )}
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

              {/* Slide controls */}
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    aria-label="Previous cover line"
                    className="press grid size-9 place-items-center rounded-[4px] border border-white/15 text-bone/65 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    aria-label="Next cover line"
                    className="press grid size-9 place-items-center rounded-[4px] border border-white/15 text-bone/65 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]"
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
                  className="size-6 rounded-[4px] border border-background"
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
