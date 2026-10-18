import { HeroBroadsheet } from "@/components/landing/heroes/HeroBroadsheet";
import { HeroSignal } from "@/components/landing/heroes/HeroSignal";
import { HeroThreshold } from "@/components/landing/heroes/HeroThreshold";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

const VARIANTS = [
  {
    id: "broadsheet",
    name: "The Broadsheet",
    note: "Editorial · paper",
    swatch: "#2b61eb",
    Component: HeroBroadsheet,
  },
  {
    id: "signal",
    name: "The Signal",
    note: "Kinetic · instrument",
    swatch: "#d8ff3e",
    Component: HeroSignal,
  },
  {
    id: "threshold",
    name: "The Threshold",
    note: "Human · interactive",
    swatch: "#e08a5b",
    Component: HeroThreshold,
  },
];

/**
 * A presentation shell for the three hero studies. It sits outside the public
 * layout so each composition can own the full viewport, and it keeps the
 * selected variation in the URL so a direction can be shared and revisited.
 */
export default function HeroLab() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const index = useMemo(() => {
    const raw = Number(params.get("v") ?? "1");
    if (!Number.isFinite(raw)) return 0;
    return Math.min(VARIANTS.length, Math.max(1, Math.trunc(raw))) - 1;
  }, [params]);

  const active = VARIANTS[index];

  const select = (next: number) => {
    const clamped = Math.max(0, Math.min(VARIANTS.length - 1, next));
    setParams({ v: String(clamped + 1) }, { replace: true });
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable]") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        select(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        select(index - 1);
      } else if (event.key === "1" || event.key === "2" || event.key === "3") {
        event.preventDefault();
        select(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="min-h-svh bg-[#07080a]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-3 border-b border-white/10 bg-[#0b0d10]/95 px-3 text-[#f1ede4] backdrop-blur-xl sm:px-5">
        <span className="flex shrink-0 items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.24em]">
          <span className="size-1.5 rounded-full bg-[#f1ede4]/80" />
          <span className="hidden sm:inline">Cosmic Vault</span>
          <span className="text-white/35">/</span>
          <span className="text-white/55">Hero studies</span>
        </span>

        <nav
          aria-label="Hero variations"
          className="ml-auto flex items-center gap-0.5"
        >
          {VARIANTS.map((variant, itemIndex) => {
            const isActive = itemIndex === index;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => select(itemIndex)}
                aria-pressed={isActive}
                aria-label={`${itemIndex + 1}. ${variant.name}`}
                className={cn(
                  "group flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-[0.6rem] font-medium uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  isActive
                    ? "bg-[#f1ede4] text-[#0b0d10]"
                    : "text-white/45 hover:bg-white/[0.06] hover:text-white/90",
                )}
              >
                <span
                  className="size-1.5 rounded-full transition-opacity"
                  style={{
                    backgroundColor: variant.swatch,
                    opacity: isActive ? 1 : 0.45,
                  }}
                />
                <span className="tabular-nums">
                  {String(itemIndex + 1).padStart(2, "0")}
                </span>
                <span className="hidden lg:inline">{variant.name}</span>
              </button>
            );
          })}
        </nav>

        <span className="hidden items-center gap-2 border-l border-white/12 pl-3 text-[0.54rem] uppercase tracking-[0.16em] text-white/35 md:flex">
          {active.note}
          <span className="hidden items-center gap-1 border-l border-white/12 pl-2 xl:flex">
            <kbd className="rounded-[2px] border border-white/15 px-1 py-px text-[0.5rem] text-white/45">
              ←
            </kbd>
            <kbd className="rounded-[2px] border border-white/15 px-1 py-px text-[0.5rem] text-white/45">
              →
            </kbd>
            to switch
          </span>
        </span>

        <Link
          to="/"
          className="ml-2 flex shrink-0 items-center gap-1.5 rounded-[3px] border border-white/15 px-2.5 py-1.5 text-[0.58rem] font-medium uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeft className="size-3" />
          <span className="hidden sm:inline">Back to site</span>
          <span className="sm:hidden">Exit</span>
        </Link>
      </header>

      <main>
        <active.Component key={active.id} onQuote={() => navigate("/quote")} />
      </main>
    </div>
  );
}
