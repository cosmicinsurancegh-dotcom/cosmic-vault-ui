import { usePageMeta } from "@/hooks/use-page-meta";
import { IMAGES } from "@/lib/imagery";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Copy,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

type Destination = {
  label: string;
  href: string;
  description: string;
  keywords: string;
};

const DESTINATIONS: Destination[] = [
  {
    label: "Home",
    href: "/",
    description: "Vault custody, object cover and how a release works.",
    keywords: "home start landing index",
  },
  {
    label: "Request a vault review",
    href: "/#review",
    description: "Tell us what you are storing. The vault desk reviews it.",
    keywords: "quote appraisal vault review depositing",
  },
  {
    label: "What we store",
    href: "/#store",
    description: "Bullion, diamonds, gemstones, rare earths and collections.",
    keywords: "custody bullion diamonds gemstones minerals storage",
  },
  {
    label: "Claims overview",
    href: "/claims",
    description: "How a claim is reported, assessed, and settled.",
    keywords: "claim loss damage settle",
  },
  {
    label: "Help centre",
    href: "/help",
    description: "Guides by topic, from documents to renewals.",
    keywords: "help guide support docs",
  },
  {
    label: "Frequently asked questions",
    href: "/faqs",
    description: "The questions people ask most, answered plainly.",
    keywords: "faq question answer",
  },
  {
    label: "Contact support",
    href: "/support/contact",
    description: "Reach a person rather than another dead end.",
    keywords: "contact support person advisor email",
  },
  {
    label: "How it works",
    href: "/how-it-works",
    description: "Underwriting, policy issue, and renewal, start to finish.",
    keywords: "process underwriting how",
  },
  {
    label: "Sign in to your vault",
    href: "/auth?returnTo=%2Fdashboard",
    description: "Policies, quotes, claims, and documents in one place.",
    keywords: "sign in login account dashboard vault",
  },
];

/* A live clock is its own component so its once-a-second tick never re-renders
   the page around it. */
function UtcClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="tabular-nums">
      {now.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })} UTC
    </span>
  );
}

function OrbitalZero({
  style,
  className,
}: {
  style?: React.ComponentProps<typeof motion.div>["style"];
  className?: string;
}) {
  return (
    <motion.div
      aria-hidden="true"
      style={style}
      className={cn(
        "relative grid aspect-square h-[clamp(4.6rem,14.6vw,10.4rem)] place-items-center",
        className,
      )}
    >
      <span className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(76,125,255,0.28),transparent_66%)] blur-md" />
      <span className="absolute inset-0 rounded-full border border-white/14" />
      <span className="absolute inset-[13%] rounded-full border border-dashed border-white/20 animate-orbit [animation-duration:26s]" />
      <span className="absolute inset-[30%] rounded-full border border-electric-soft/35" />
      {/* A single satellite traces the orbit. */}
      <span className="absolute inset-0 animate-orbit [animation-duration:19s]">
        <span className="absolute left-1/2 top-0 size-[0.42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric-soft shadow-[0_0_16px_4px_rgba(76,125,255,0.45)]" />
      </span>
      <span className="absolute inset-0 animate-orbit [animation-duration:31s] [animation-direction:reverse]">
        <span className="absolute bottom-[13%] left-1/2 size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-electric-soft/80" />
      </span>
      <span className="size-1.5 rounded-full bg-bone/80 shadow-[0_0_12px_2px_rgba(255,255,255,0.25)]" />
    </motion.div>
  );
}

function CopyRoute({ route }: { route: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Clipboard access can be refused; the route is already on screen. */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Address copied" : `Copy requested address ${route}`}
      className="group mt-4 inline-flex w-full items-center justify-between gap-3 rounded-[4px] border border-white/12 bg-white/[0.03] py-2.5 pl-4 pr-2.5 text-[0.72rem] font-medium text-bone/60 transition-colors hover:border-white/28 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071227]"
    >
      <span className="truncate">
        {copied ? "Address copied to clipboard" : "Copy this address"}
      </span>
      <span className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-white/10">
        {copied ? (
          <Check className="size-3 text-electric-soft" strokeWidth={2.4} />
        ) : (
          <Copy className="size-3 transition-transform duration-300 group-hover:-translate-y-0.5" />
        )}
      </span>
    </button>
  );
}

export default function NotFound() {
  usePageMeta(
    "Page not found",
    "That address does not point to a page in the Cosmic Vault. Search the site, browse cover, or contact support.",
  );

  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const route = `${location.pathname}${location.search}`;

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const leanX = useMotionValue(0);
  const leanY = useMotionValue(0);

  const glowX = useSpring(pointerX, { stiffness: 55, damping: 20, mass: 0.6 });
  const glowY = useSpring(pointerY, { stiffness: 55, damping: 20, mass: 0.6 });
  const leanSpringX = useSpring(leanX, { stiffness: 60, damping: 18 });
  const leanSpringY = useSpring(leanY, { stiffness: 60, damping: 18 });
  const zeroX = useTransform(leanSpringX, [-1, 1], [-12, 12]);
  const zeroY = useTransform(leanSpringY, [-1, 1], [-8, 8]);
  const [pointerActive, setPointerActive] = useState(false);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return DESTINATIONS;
    return DESTINATIONS.filter((destination) =>
      [destination.label, destination.description, destination.keywords]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query]);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType === "touch") return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    pointerX.set(x);
    pointerY.set(y);
    leanX.set((x / box.width) * 2 - 1);
    leanY.set((y / box.height) * 2 - 1);
    setPointerActive(true);
  };

  const onPointerLeave = () => {
    leanX.set(0);
    leanY.set(0);
    setPointerActive(false);
  };

  return (
    <div className="relative isolate overflow-hidden bg-[#050b18] text-bone">
      {/* The photograph of the Milky Way is the whole set: one horizon, one
          field of stars, and a faint grid that hints at a map with edges. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <img
          src={IMAGES.orbit.src}
          alt=""
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="size-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,#050b18_4%,rgba(5,11,24,0.62)_48%,rgba(5,11,24,0.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_16%_8%,rgba(76,125,255,0.22),transparent_55%)]" />
        <div className="absolute inset-0 starfield opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:84px_84px]" />
      </div>

      <section
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative min-h-[min(100svh,50rem)] overflow-hidden"
      >
        {/* A soft light that follows the cursor, like a torch across a map. */}
        <motion.div
          aria-hidden="true"
          style={{ x: glowX, y: glowY }}
          animate={{ opacity: pointerActive ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="pointer-events-none absolute left-[-19rem] top-[-19rem] hidden size-[38rem] rounded-full bg-[radial-gradient(circle,rgba(76,125,255,0.16),transparent_64%)] lg:block"
        />

        <div className="relative mx-auto max-w-[1240px] px-5 pb-14 pt-8 sm:pb-20 sm:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-bone/45">
            <span className="flex items-center gap-2.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric-soft/60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-electric-soft" />
              </span>
              Signal lost · Error 404
            </span>
            <span className="flex items-center gap-4">
              <span className="hidden sm:inline">Vault status · nominal</span>
              <UtcClock />
            </span>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-8"
            >
              <p className="flex items-center gap-3 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-bone/55">
                <span className="h-px w-8 bg-electric-soft/70" />
                Off the mapped route
              </p>

              <h1
                aria-label="Error 404: page not found"
                className="mt-6 sm:mt-8"
              >
                <span aria-hidden="true" className="flex items-center">
                  <span className="bg-[linear-gradient(180deg,#ffffff_8%,rgba(255,255,255,0.3)_100%)] bg-clip-text text-[clamp(5.6rem,19vw,13.5rem)] font-semibold leading-[0.72] tracking-[-0.07em] text-transparent">
                    4
                  </span>
                  <OrbitalZero
                    style={
                      reduceMotion ? undefined : { x: zeroX, y: zeroY }
                    }
                    className="mx-[0.06em]"
                  />
                  <span className="bg-[linear-gradient(180deg,#ffffff_8%,rgba(255,255,255,0.3)_100%)] bg-clip-text text-[clamp(5.6rem,19vw,13.5rem)] font-semibold leading-[0.72] tracking-[-0.07em] text-transparent">
                    4
                  </span>
                </span>
                <span className="mt-6 block max-w-[15ch] text-balance text-[clamp(2rem,4.8vw,3.5rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
                  You&apos;ve stepped{" "}
                  <span className="text-electric-soft">outside the map.</span>
                </span>
              </h1>

              <p className="mt-6 max-w-md text-[0.92rem] leading-7 text-bone/60">
                This address does not point to a page. It may have been
                renamed, or the link that carried you here is out of date.
                Nothing is wrong with your account - policies, claims, and
                documents are exactly where you left them.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/"
                  className="group inline-flex h-11 items-center justify-between gap-3 rounded-[4px] bg-bone pl-5 pr-2 text-[0.86rem] font-medium text-[#071227] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b18]"
                >
                  <span>Back to the vault</span>
                  <span className="grid size-7 place-items-center rounded-[4px] bg-[#071227]/10 transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
                  </span>
                </Link>
                <Link
                  to="/cover"
                  className="group inline-flex h-11 items-center justify-between gap-3 rounded-[4px] border border-white/18 px-5 text-[0.86rem] font-medium text-bone/70 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b18]"
                >
                  Browse cover
                  <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </motion.div>

            {/* The flight recorder: what was asked for, and what the vault saw. */}
            <motion.aside
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative lg:col-span-4"
            >
              <div className="relative overflow-hidden rounded-[4px] border border-white/12 bg-[#071227]/75 p-5 backdrop-blur-xl">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-soft/60 to-transparent"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.56rem] font-semibold uppercase tracking-[0.26em] text-bone/45">
                    Flight recorder
                  </p>
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-electric-soft/80">
                    Unmapped
                  </span>
                </div>

                <dl className="mt-4">
                  <div className="flex items-start justify-between gap-4 border-t border-white/8 py-3">
                    <dt className="text-[0.7rem] text-bone/45">Requested route</dt>
                    <dd
                      title={route}
                      className="max-w-[62%] break-all text-right text-[0.72rem] font-medium text-bone/80"
                    >
                      {route}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 py-3">
                    <dt className="text-[0.7rem] text-bone/45">Resolution</dt>
                    <dd className="text-[0.72rem] font-medium text-bone/80">
                      No matching page
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 py-3">
                    <dt className="text-[0.7rem] text-bone/45">Vault records</dt>
                    <dd className="flex items-center gap-1.5 text-[0.72rem] font-medium text-bone/80">
                      <ShieldCheck className="size-3.5 text-electric-soft" />
                      Intact
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 py-3">
                    <dt className="text-[0.7rem] text-bone/45">Recorded</dt>
                    <dd className="text-[0.72rem] font-medium text-bone/80">
                      <UtcClock />
                    </dd>
                  </div>
                </dl>

                <CopyRoute route={route} />
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      {/* Search: a real way out, rather than a decorative suggestion grid. */}
      <section className="relative border-t border-white/10 bg-[#071227]/80">
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:py-16">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end lg:gap-12">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-bone/45">
                Find your way back
              </p>
              <h2 className="mt-3 text-balance text-[clamp(1.7rem,3.2vw,2.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                Search the vault.
              </h2>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-bone/40" />
              <label htmlFor="notfound-search" className="sr-only">
                Search pages in the vault
              </label>
              <input
                id="notfound-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setQuery("");
                }}
                placeholder="Try “cover”, “claim”, or “support”"
                autoComplete="off"
                className="h-12 w-full appearance-none rounded-[4px] border border-white/14 bg-white/[0.04] pl-11 pr-24 text-[0.86rem] text-bone placeholder:text-bone/35 focus:border-electric-soft/60 focus:outline-none focus:ring-2 focus:ring-electric-soft/20 [&::-webkit-search-cancel-button]:hidden"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search field"
                    className="grid size-7 place-items-center rounded-[4px] text-bone/45 transition-colors hover:bg-white/10 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft/60"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <span
                  aria-live="polite"
                  className="pr-1 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-bone/35"
                >
                  {matches.length} {matches.length === 1 ? "route" : "routes"}
                </span>
              </div>
            </div>
          </div>

          {matches.length > 0 ? (
            <ul className="mt-8 grid gap-px overflow-hidden rounded-[4px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((destination, index) => (
                <li key={destination.href}>
                  <Link
                    to={destination.href}
                    className="group flex h-full items-start gap-3.5 bg-[#071227] px-5 py-4 transition-colors hover:bg-[#0b1930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-electric-soft/60"
                  >
                    <span className="pt-0.5 text-[0.58rem] tabular-nums tracking-[0.12em] text-bone/25">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[0.87rem] font-medium text-bone/85 transition-colors group-hover:text-bone">
                          {destination.label}
                        </span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-bone/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-electric-soft" />
                      </span>
                      <span className="mt-1 block text-[0.72rem] leading-5 text-bone/45">
                        {destination.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-[4px] border border-white/10 bg-white/[0.03] px-5 py-8 sm:flex-row sm:items-center">
              <div>
                <p className="text-[0.92rem] font-medium text-bone/85">
                  Nothing on that bearing.
                </p>
                <p className="mt-1 text-[0.76rem] leading-5 text-bone/45">
                  Try a broader term - cover, claim, help, or account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex h-9 items-center rounded-[4px] border border-white/18 px-4 text-[0.78rem] font-medium text-bone/75 transition-colors hover:border-white/40 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-soft/60"
              >
                Clear search
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-[0.74rem] text-bone/45 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Followed a link from inside the vault?{" "}
              <Link
                to="/support/report"
                className="font-medium text-bone/75 underline decoration-white/25 underline-offset-2 transition-colors hover:text-bone hover:decoration-white/60"
              >
                Report the broken route
              </Link>
              .
            </p>
            <p className="flex items-center gap-2 text-[0.64rem] uppercase tracking-[0.2em] text-bone/35">
              <span className="size-1 rounded-full bg-electric-soft/80" />
              All records accounted for
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
