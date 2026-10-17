import { QuoteDialog } from "@/components/site/QuoteDialog";
import { Brand } from "@/components/site/Brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import {
  COVERAGE_ICONS,
  COVERAGE_OPTIONS,
  STATUS_META,
  coverageLabel,
  formatGBP,
  initials,
  planByName,
  type CoverageKey,
} from "@/lib/vault";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  FileText,
  Headset,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "quotes", label: "My quotes", Icon: FileText },
  { id: "coverage", label: "Coverage", Icon: ShieldCheck },
  { id: "concierge", label: "Concierge", Icon: Headset },
] as const;

type View = (typeof NAV)[number]["id"];

const HELP_TOPICS = [
  {
    Icon: ShieldCheck,
    title: "Start a claim",
    text: "Tell us what happened and we'll assign a named claims owner straight away.",
  },
  {
    Icon: CalendarDays,
    title: "Review my cover",
    text: "New home, new baby, new business? Restructure your plan with no exit fees.",
  },
  {
    Icon: Clock,
    title: "Question about billing",
    text: "Payment dates, receipts, and plan changes — answered by a person, not a bot.",
  },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuery(api.quotes.myQuotes);

  const [view, setView] = useState<View>("overview");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSession, setQuoteSession] = useState(0);
  const [quoteCoverage, setQuoteCoverage] = useState<CoverageKey>("health");
  const [quotePlan, setQuotePlan] = useState<string | undefined>(undefined);

  const displayName = user?.name?.split(" ")[0] || "friend";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const openQuote = (coverage: CoverageKey = "health", plan?: string) => {
    setQuoteCoverage(coverage);
    setQuotePlan(plan);
    setQuoteSession((session) => session + 1);
    setQuoteOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out of your vault.", {
      description: "Come back any time — your cover stays put.",
    });
    navigate("/");
  };

  const stats = useMemo(() => {
    const list = quotes ?? [];
    const lines = new Set(list.map((quote) => quote.coverage));
    const monthly = list.reduce((total, quote) => {
      const plan = planByName(quote.plan);
      return total + (quote.monthlyEstimate ?? plan?.monthly ?? 0);
    }, 0);
    const readiness =
      list.length === 0 ? 22 : Math.min(98, 48 + lines.size * 10 + Math.min(10, list.length * 4));

    return {
      list,
      lines,
      monthly,
      readiness,
      open: list.filter((quote) => quote.status === "in_review").length,
    };
  }, [quotes]);

  const firstName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-line bg-background px-5 py-6 lg:flex">
        <Brand href="/" className="px-1.5 text-ink" />

        <nav aria-label="Vault" className="mt-10 space-y-1">
          <p className="px-3 pb-3 text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-ink/35">
            Member vault
          </p>
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                view === id
                  ? "bg-ink text-bone"
                  : "text-ink/60 hover:bg-ink/[0.045] hover:text-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={1.9} />
              {label}
              {id === "quotes" && stats.list.length > 0 && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[0.62rem] font-semibold",
                    view === id ? "bg-white/15 text-bone" : "bg-ink/8 text-ink/60",
                  )}
                >
                  {stats.list.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="starfield relative overflow-hidden rounded-2xl bg-[#071227] p-4 text-bone">
            <span className="absolute -right-6 -top-6 size-20 rounded-full bg-electric/30 blur-2xl" />
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-bone/45">
              Concierge
            </p>
            <p className="mt-2 text-sm font-medium leading-5">
              A human is awake, whenever you need one.
            </p>
            <button
              type="button"
              onClick={() => setView("concierge")}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-electric-soft transition-colors hover:text-white"
            >
              Open the line
              <ArrowUpRight className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line px-1 pt-4">
            <span className="grid size-9 place-items-center rounded-full bg-ink text-[0.68rem] font-semibold text-bone">
              {initials(user?.name ?? user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                {user?.name ?? "Vault member"}
              </p>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {user?.email ?? "Anonymous session"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[268px]">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-background/90 px-5 py-3 backdrop-blur-xl lg:hidden">
          <Brand href="/" compact className="text-ink" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 rounded-full px-4"
              onClick={() => openQuote()}
            >
              <Plus className="size-3.5" />
              Quote
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open vault menu"
                  className="grid size-9 place-items-center rounded-full border border-line text-ink"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[290px] bg-background p-6">
                <SheetTitle className="sr-only">Vault navigation</SheetTitle>
                <Brand href="/" className="text-ink" />
                <nav className="mt-8 space-y-1">
                  {NAV.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setView(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                        view === id
                          ? "bg-ink text-bone"
                          : "text-ink/60 hover:bg-ink/[0.045] hover:text-ink",
                      )}
                    >
                      <Icon className="size-4" />
                      {label}
                    </button>
                  ))}
                </nav>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-8 flex w-full items-center gap-2 rounded-xl border border-line px-3 py-3 text-sm font-medium text-ink/70"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="mx-auto max-w-[1080px] px-5 py-8 sm:px-8 sm:py-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                Member vault
                <span className="size-1 rounded-full bg-electric" />
                {today}
              </p>
              <h1 className="mt-2.5 text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-none tracking-[-0.045em] text-ink">
                {greeting}, {firstName}.
              </h1>
            </div>
            <Button
              className="h-11 self-start rounded-full px-5 sm:self-auto"
              onClick={() => openQuote()}
            >
              <Plus className="size-4" />
              New quote
            </Button>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="mt-8"
            >
              {quotes === undefined ? (
                <div className="flex min-h-[40vh] items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : view === "overview" ? (
                <Overview
                  stats={stats}
                  onQuote={openQuote}
                  onViewQuotes={() => setView("quotes")}
                  onConcierge={() => setView("concierge")}
                />
              ) : view === "quotes" ? (
                <QuotesView quotes={stats.list} onQuote={openQuote} />
              ) : view === "coverage" ? (
                <CoverageView quotes={stats.list} onQuote={openQuote} />
              ) : (
                <ConciergeView onQuote={openQuote} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <QuoteDialog
        key={quoteSession}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        defaultCoverage={quoteCoverage}
        defaultPlan={quotePlan}
      />
    </div>
  );
}

type Quote = Doc<"quotes">;

function Overview({
  stats,
  onQuote,
  onViewQuotes,
  onConcierge,
}: {
  stats: {
    list: Quote[];
    lines: Set<string>;
    monthly: number;
    readiness: number;
    open: number;
  };
  onQuote: (coverage?: CoverageKey, plan?: string) => void;
  onViewQuotes: () => void;
  onConcierge: () => void;
}) {
  const missing = COVERAGE_OPTIONS.filter(
    (option) => !stats.lines.has(option.key),
  ).slice(0, 2);

  const circumference = 2 * Math.PI * 42;

  return (
    <div className="space-y-5">
      <div className="starfield relative overflow-hidden rounded-[1.6rem] bg-[#071227] p-6 text-bone sm:p-8">
        <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.35),transparent_65%)]" />
        <div className="relative grid gap-7 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-bone/45">
              Vault readiness
            </p>
            <h2 className="mt-3 max-w-md text-2xl font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[1.9rem]">
              {stats.list.length === 0 ? (
                <>
                  Your vault is ready for its{" "}
                  <span className="text-electric-soft">first chapter.</span>
                </>
              ) : (
                <>
                  Your protection,{" "}
                  <span className="text-electric-soft">at a glance.</span>
                </>
              )}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-bone/55">
              {stats.list.length === 0
                ? "Request a quote and a named advisor will shape your cover within one business day. Everything you track will live here."
                : `You're tracking ${stats.lines.size} of 4 cover lines. Your advisor reviews every request personally — nothing is auto-approved or sold on.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="h-10 rounded-full bg-electric px-5 text-white hover:bg-[#235fe8]"
                onClick={() => onQuote()}
              >
                {stats.list.length === 0 ? "Request your first quote" : "Add cover"}
                <ArrowUpRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-full px-4 text-bone/70 hover:bg-white/10 hover:text-bone"
                onClick={onConcierge}
              >
                <Headset className="size-4" />
                Talk to an advisor
              </Button>
            </div>
          </div>

          <div className="relative mx-auto grid size-32 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#6f9bff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - stats.readiness / 100)}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="text-center">
              <p className="text-3xl font-semibold tracking-[-0.04em]">
                {stats.readiness}
                <span className="text-base text-bone/40">%</span>
              </p>
              <p className="mt-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-bone/40">
                Covered
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Open requests",
            value: String(stats.open),
            helper: stats.open > 0 ? "With an advisor now" : "Nothing waiting",
            Icon: FileText,
          },
          {
            label: "Cover lines",
            value: `${stats.lines.size} / 4`,
            helper: "Health, home, auto, life",
            Icon: ShieldCheck,
          },
          {
            label: "Estimated monthly",
            value: stats.monthly > 0 ? formatGBP(stats.monthly) : "—",
            helper: "Based on selected plans",
            Icon: Sparkles,
          },
        ].map(({ label, value, helper, Icon }) => (
          <div
            key={label}
            className="rounded-[1.2rem] border border-line bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {label}
              </p>
              <Icon className="size-4 text-electric" />
            </div>
            <p className="mt-4 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              {value}
            </p>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">{helper}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[1.4rem] border border-line bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
              Recent requests
            </h3>
            {stats.list.length > 0 && (
              <button
                type="button"
                onClick={onViewQuotes}
                className="text-xs font-medium text-electric transition-colors hover:text-ink"
              >
                View all
              </button>
            )}
          </div>

          {stats.list.length === 0 ? (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-dashed border-line bg-ink/[0.015] px-5 py-7">
              <span className="grid size-10 place-items-center rounded-full bg-ice text-electric">
                <FileText className="size-4" />
              </span>
              <p className="text-sm font-medium text-ink">No requests yet.</p>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                Your first quote takes about two minutes. An advisor does the
                rest and you can track every step here.
              </p>
              <button
                type="button"
                onClick={() => onQuote()}
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-electric"
              >
                Start a request
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {stats.list.slice(0, 3).map((quote) => {
                const Icon = COVERAGE_ICONS[quote.coverage];
                const status = STATUS_META[quote.status] ?? STATUS_META.in_review;
                return (
                  <li key={quote._id} className="flex items-center gap-3 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice text-electric">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {coverageLabel(quote.coverage)}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                        {quote.reference} ·{" "}
                        {new Date(quote._creationTime).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[1.4rem] border border-line bg-card p-5 sm:p-6">
          <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
            Next in your universe
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Small additions that make a life measurably safer.
          </p>
          <div className="mt-4 space-y-2.5">
            {missing.length === 0 ? (
              <div className="rounded-xl border border-line bg-ice/60 px-4 py-4">
                <p className="text-sm font-medium text-ink">All four lines covered.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Beautifully done. Ask your advisor about an annual vault review.
                </p>
              </div>
            ) : (
              missing.map((option) => {
                const Icon = COVERAGE_ICONS[option.key];
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onQuote(option.key)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-electric/30 hover:bg-electric/[0.03]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/[0.04] text-ink/60 transition-colors group-hover:bg-electric group-hover:text-white">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-ink">
                        Add {option.short.toLowerCase()} cover
                      </span>
                      <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
                        {option.from}
                      </span>
                    </span>
                    <ArrowUpRight className="size-3.5 text-ink/30 transition-colors group-hover:text-electric" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotesView({
  quotes,
  onQuote,
}: {
  quotes: Quote[];
  onQuote: (coverage?: CoverageKey) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em] text-ink">
            Your quote requests
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {quotes.length === 0
              ? "Nothing here yet — your first quote starts below."
              : `${quotes.length} request${quotes.length === 1 ? "" : "s"} tracked in your vault.`}
          </p>
        </div>
        <Button
          className="h-9 rounded-full px-4"
          size="sm"
          onClick={() => onQuote()}
        >
          <Plus className="size-3.5" />
          New request
        </Button>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-ice text-electric">
            <FileText className="size-6" />
          </span>
          <p className="mt-5 text-base font-medium text-ink">
            A blank page, in the best way.
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Tell us what matters and we&apos;ll bring back a clear, itemised
            quote — usually within a day.
          </p>
          <Button
            className="mt-5 h-10 rounded-full px-5"
            onClick={() => onQuote()}
          >
            Request a quote
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {quotes.map((quote) => {
            const Icon = COVERAGE_ICONS[quote.coverage];
            const status = STATUS_META[quote.status] ?? STATUS_META.in_review;
            return (
              <li
                key={quote._id}
                className="flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-ink/[0.02] sm:flex-row sm:items-center sm:px-7"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ice text-electric">
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {coverageLabel(quote.coverage)}
                    </p>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[0.58rem] font-semibold",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {quote.reference} · {quote.plan ? `${quote.plan} plan` : "Plan recommendation requested"} ·{" "}
                    {new Date(quote._creationTime).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-ink">
                    {quote.monthlyEstimate
                      ? `${formatGBP(quote.monthlyEstimate)}/mo`
                      : "Awaiting quote"}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    Estimate, not a bill
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line px-5 py-4 sm:px-7">
        <p className="text-[0.68rem] leading-5 text-muted-foreground">
          Quotes are shaped by a human advisor. You&apos;ll receive an email at{" "}
          <span className="font-medium text-ink">
            {quotes[0]?.email ?? "your address"}
          </span>{" "}
          when yours is ready.
        </p>
      </div>
    </div>
  );
}

function CoverageView({
  quotes,
  onQuote,
}: {
  quotes: Quote[];
  onQuote: (coverage?: CoverageKey) => void;
}) {
  const covered = new Set(quotes.map((quote) => quote.coverage));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
            Your coverage
          </h2>
          <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            Every line you add is reviewed by an advisor and can be adjusted at
            any time, without exit fees.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {covered.size} of 4 lines requested
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {COVERAGE_OPTIONS.map((option) => {
          const Icon = COVERAGE_ICONS[option.key];
          const isCovered = covered.has(option.key);
          return (
            <div
              key={option.key}
              className={cn(
                "group relative overflow-hidden rounded-[1.3rem] border bg-card p-5 transition-all duration-400 sm:p-6",
                isCovered
                  ? "border-electric/25"
                  : "border-line hover:-translate-y-0.5 hover:border-ink/20",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-full",
                    isCovered
                      ? "bg-electric text-white"
                      : "bg-ice text-electric",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                {isCovered && (
                  <span className="rounded-full border border-electric/20 bg-electric/[0.06] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-electric">
                    In your vault
                  </span>
                )}
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink">
                {option.label}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {option.blurb}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink/40">
                  {option.from}
                </span>
                <button
                  type="button"
                  onClick={() => onQuote(option.key)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink transition-colors hover:text-electric"
                >
                  {isCovered ? "Add another" : "Add cover"}
                  <ArrowUpRight className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-xl border border-dashed border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted-foreground">
          Buying a home, changing cars, or planning a family? Your advisor can
          restructure everything in one call.
        </p>
        <button
          type="button"
          onClick={() => onQuote()}
          className="shrink-0 text-xs font-medium text-electric"
        >
          Request a review →
        </button>
      </div>
    </div>
  );
}

function ConciergeView({
  onQuote,
}: {
  onQuote: (coverage?: CoverageKey) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="starfield relative overflow-hidden rounded-[1.5rem] bg-[#071227] p-6 text-bone sm:p-7">
        <span className="pointer-events-none absolute -right-10 bottom-10 size-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.28),transparent_70%)]" />
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-bone/45">
          Your named advisor
        </p>
        <div className="mt-5 flex items-center gap-4">
          <span className="relative">
            <img
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=200&q=80"
              alt="Maya Chen, Senior Vault Advisor"
              className="size-16 rounded-full object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-[3px] border-[#071227] bg-emerald-400" />
          </span>
          <div>
            <p className="text-lg font-medium tracking-[-0.02em]">Maya Chen</p>
            <p className="mt-0.5 text-xs text-bone/50">Senior Vault Advisor · London</p>
          </div>
        </div>
        <p className="mt-5 font-display text-[1.35rem] italic leading-snug text-bone/85">
          &ldquo;I answer my own phone. If something happens, you won&apos;t be
          starting from scratch with a stranger.&rdquo;
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <a
            href="tel:+442079460958"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-electric px-4 text-xs font-medium text-white transition-colors hover:bg-[#235fe8]"
          >
            <Phone className="size-3.5" />
            020 7946 0958
          </a>
          <a
            href="mailto:concierge@cosmicvault.co"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-medium text-bone/75 transition-colors hover:border-white/35 hover:text-bone"
          >
            <Mail className="size-3.5" />
            Email Maya
          </a>
        </div>
        <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[0.65rem] text-bone/40">
          <Clock className="size-3.5" />
          Concierge line open 24 hours · average answer 41 seconds
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-line bg-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-ink">
          What can we take off your mind?
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          Pick a starting point — we&apos;ll route you to the right human.
        </p>
        <div className="mt-5 space-y-2.5">
          {HELP_TOPICS.map(({ Icon, title, text }) => (
            <a
              key={title}
              href="mailto:concierge@cosmicvault.co"
              className="group flex items-start gap-3 rounded-xl border border-line px-4 py-3.5 transition-colors hover:border-electric/30 hover:bg-electric/[0.03]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ice text-electric">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {text}
                </span>
              </span>
              <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-ink/30 transition-colors group-hover:text-electric" />
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onQuote()}
          className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-electric"
        >
          Request a callback instead
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
