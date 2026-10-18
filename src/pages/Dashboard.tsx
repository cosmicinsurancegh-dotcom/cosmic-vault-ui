import { ChartEmptyState } from "@/components/dashboard/ChartEmptyState";
import {
  ActivityChart,
  CoverageMixChart,
  PremiumByLineChart,
  type ActivityPoint,
  type MixPoint,
  type PremiumPoint,
} from "@/components/dashboard/Charts";
import {
  DASH_NAV,
  DashSidebar,
  SIDEBAR_STORAGE_KEY,
  type DashView,
} from "@/components/dashboard/DashSidebar";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { Brand } from "@/components/site/Brand";
import { QuoteDialog } from "@/components/site/QuoteDialog";
import { ThemeToggle } from "@/components/site/ThemeToggle";
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
  type CoverageKey,
} from "@/lib/vault";
import { cn } from "@/lib/utils";
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
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type Quote = Doc<"quotes">;

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
    text: "Payment dates, receipts, and plan changes - answered by a person, not a bot.",
  },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const quotes = useQuery(api.quotes.myQuotes);

  const [view, setView] = useState<DashView>("overview");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteSession, setQuoteSession] = useState(0);
  const [quoteCoverage, setQuoteCoverage] = useState<CoverageKey>("health");

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Storage can be unavailable in sandboxed previews - collapsing still works.
    }
  }, [collapsed]);

  const displayName = user?.name?.split(" ")[0] || "friend";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const openQuote = (coverage: CoverageKey = "health") => {
    setQuoteCoverage(coverage);
    setQuoteSession((session) => session + 1);
    setQuoteOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out of your vault.", {
      description: "Come back any time - your cover stays put.",
    });
    navigate("/");
  };

  const stats = useMemo(() => {
    const list = quotes ?? [];
    const lines = new Set(list.map((quote) => quote.coverage));
    const monthly = list.reduce(
      (total, quote) => total + (quote.monthlyEstimate ?? 0),
      0,
    );
    const readiness =
      list.length === 0
        ? 22
        : Math.min(98, 48 + lines.size * 10 + Math.min(10, list.length * 4));

    // Requests per month for the last six months.
    const now = new Date();
    const activity: ActivityPoint[] = [];
    for (let index = 5; index >= 0; index -= 1) {
      const month = new Date(now.getFullYear(), now.getMonth() - index, 1);
      activity.push({
        label: month.toLocaleDateString("en-GB", { month: "short" }),
        requests: 0,
      });
    }
    for (const quote of list) {
      const created = new Date(quote._creationTime);
      const monthsAgo =
        (now.getFullYear() - created.getFullYear()) * 12 +
        (now.getMonth() - created.getMonth());
      if (monthsAgo >= 0 && monthsAgo <= 5) {
        const bucket = activity[5 - monthsAgo];
        if (bucket) bucket.requests += 1;
      }
    }

    const mix: MixPoint[] = COVERAGE_OPTIONS.map((option) => ({
      key: option.key,
      label: option.short,
      value: list.filter((quote) => quote.coverage === option.key).length,
    })).filter((point) => point.value > 0);

    const premiumRows: PremiumPoint[] = COVERAGE_OPTIONS.map((option) => {
      const premium = list
        .filter((quote) => quote.coverage === option.key)
        .reduce(
          (total, quote) => total + (quote.monthlyEstimate ?? 0),
          0,
        );
      return { key: option.key, label: option.short, premium };
    }).filter((point) => point.premium > 0);

    return {
      list,
      lines,
      monthly,
      readiness,
      open: list.filter((quote) => quote.status === "in_review").length,
      activity,
      mix,
      premiumRows,
    };
  }, [quotes]);

  const firstName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const userName = user?.name ?? "Vault member";
  const userEmail = user?.email ?? "Anonymous session";

  return (
    <div className="flex min-h-screen bg-background text-ink">
      <DashSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        view={view}
        onNavigate={setView}
        quoteCount={stats.list.length}
        initials={initials(user?.name ?? user?.email)}
        userName={userName}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-background/90 px-5 py-3 backdrop-blur-xl lg:hidden">
          <Brand href="/" compact className="text-ink" />
          <div className="flex items-center gap-2">
            <ThemeToggle className="size-9" />
            <Button
              size="sm"
              className="h-9 rounded-[4px] px-4"
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
                  className="grid size-9 place-items-center rounded-[4px] border border-line text-ink"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[290px] bg-background p-6">
                <SheetTitle className="sr-only">Vault navigation</SheetTitle>
                <Brand href="/" className="text-ink" />
                <nav className="mt-8 space-y-1">
                  {DASH_NAV.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setView(id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                        view === id
                          ? "bg-primary text-primary-foreground"
                          : "text-ink/60 hover:bg-primary/8 hover:text-primary",
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

        <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8 sm:px-8 sm:py-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                Member vault
                <span className="size-1 rounded-[4px] bg-primary" />
                {today}
              </p>
              <h1 className="mt-2.5 text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold leading-none tracking-[-0.045em] text-ink">
                {greeting}, {firstName}.
              </h1>
            </div>
            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <ThemeToggle />
              <Button
                className="h-11 rounded-[4px] px-5"
                onClick={() => openQuote()}
              >
                <Plus className="size-4" />
                New quote
              </Button>
            </div>
          </header>

          <div className="mt-8">
            {quotes === undefined ? (
              <DashboardSkeleton />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {view === "overview" ? (
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
            )}
          </div>
        </main>
      </div>

      <QuoteDialog
        key={quoteSession}
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        defaultCoverage={quoteCoverage}
      />
    </div>
  );
}

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
    activity: ActivityPoint[];
    mix: MixPoint[];
    premiumRows: PremiumPoint[];
  };
  onQuote: (coverage?: CoverageKey, plan?: string) => void;
  onViewQuotes: () => void;
  onConcierge: () => void;
}) {
  const missing = COVERAGE_OPTIONS.filter(
    (option) => !stats.lines.has(option.key),
  ).slice(0, 4);

  const circumference = 2 * Math.PI * 42;

  return (
    <div className="space-y-5">
      {/* Readiness */}
      <div className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-6 text-bone sm:p-8">
        <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.35),transparent_65%)]" />
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
                ? "Request a quote and a named advisor will shape your cover within one business day. Every chart below fills in as your vault grows."
                : `You're tracking ${stats.lines.size} of 4 cover lines. Your advisor reviews every request personally - nothing is auto-approved or sold on.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                className="h-10 rounded-[4px] bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                onClick={() => onQuote()}
              >
                {stats.list.length === 0 ? "Request your first quote" : "Add cover"}
                <ArrowUpRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-[4px] px-4 text-bone/70 hover:bg-white/10 hover:text-bone"
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

      {/* Metric tiles */}
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
            value: stats.monthly > 0 ? formatGBP(stats.monthly) : "-",
            helper: "Based on selected plans",
            Icon: Wallet,
          },
        ].map(({ label, value, helper, Icon }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
            className="rounded-[4px] border border-line bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {label}
              </p>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-4 text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              {value}
            </p>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">{helper}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <ActivityChart
          data={stats.activity}
          onAction={() => onQuote()}
        />
        <CoverageMixChart data={stats.mix} onAction={() => onQuote()} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.45fr]">
        <PremiumByLineChart
          data={stats.premiumRows}
          onAction={() => onQuote("health", "Signature")}
        />

        <section className="rounded-[4px] border border-line bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
              Recent requests
            </h3>
            {stats.list.length > 0 && (
              <button
                type="button"
                onClick={onViewQuotes}
                className="text-xs font-medium text-primary transition-colors hover:text-ink"
              >
                View all
              </button>
            )}
          </div>

          {stats.list.length === 0 ? (
            <div className="mt-5">
              <ChartEmptyState
                icon={FileText}
                title="No requests yet"
                description="Your first quote takes about two minutes. An advisor does the rest and you can track every step here."
                actionLabel="Start a request"
                onAction={() => onQuote()}
                footnote="Typically answered in one business day"
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {stats.list.slice(0, 4).map((quote) => {
                const Icon = COVERAGE_ICONS[quote.coverage];
                const status =
                  STATUS_META[quote.status] ?? STATUS_META.in_review;
                return (
                  <li key={quote._id} className="flex items-center gap-3 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {coverageLabel(quote.coverage)}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                        {quote.reference} ·{" "}
                        {new Date(quote._creationTime).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "short" },
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-[4px] border px-2.5 py-1 text-[0.6rem] font-semibold",
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
        </section>
      </div>

      {/* Next steps */}
      <section className="rounded-[4px] border border-line bg-card p-5 sm:p-6">
        <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
          Next in your universe
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          Small additions that make a life measurably safer.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {missing.length === 0 ? (
            <div className="rounded-xl border border-line bg-ice/60 px-4 py-4 sm:col-span-2">
              <p className="text-sm font-medium text-ink">
                All four lines covered.
              </p>
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
                  className="group flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-ink/[0.04] text-ink/60 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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
                  <ArrowUpRight className="size-3.5 text-ink/30 transition-colors group-hover:text-primary" />
                </button>
              );
            })
          )}
        </div>
      </section>
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
    <div className="rounded-[4px] border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em] text-ink">
            Your quote requests
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {quotes.length === 0
              ? "Nothing here yet - your first quote starts below."
              : `${quotes.length} request${quotes.length === 1 ? "" : "s"} tracked in your vault.`}
          </p>
        </div>
        <Button
          className="h-9 rounded-[4px] px-4"
          size="sm"
          onClick={() => onQuote()}
        >
          <Plus className="size-3.5" />
          New request
        </Button>
      </div>

      {quotes.length === 0 ? (
        <div className="p-5 sm:p-7">
          <ChartEmptyState
            icon={FileText}
            title="A blank page, in the best way"
            description="Tell us what matters and we'll bring back a clear, itemised quote - usually within a day."
            actionLabel="Request a quote"
            onAction={() => onQuote()}
            footnote="No obligation, no credit check"
          />
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
                <span className="grid size-10 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {coverageLabel(quote.coverage)}
                    </p>
                    <span
                      className={cn(
                        "rounded-[4px] border px-2.5 py-0.5 text-[0.58rem] font-semibold",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {quote.reference} ·{" "}
                    {quote.plan
                      ? `${quote.plan} plan`
                      : "Plan recommendation requested"}{" "}
                    ·{" "}
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
                "group relative overflow-hidden rounded-[4px] border bg-card p-5 transition-all duration-400 sm:p-6",
                isCovered
                  ? "border-primary/25"
                  : "border-line hover:-translate-y-0.5 hover:border-ink/20",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "grid size-11 place-items-center rounded-[4px]",
                    isCovered
                      ? "bg-primary text-primary-foreground"
                      : "bg-ice text-primary",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                {isCovered && (
                  <span className="rounded-[4px] border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-primary">
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink transition-colors hover:text-primary"
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
          className="shrink-0 text-xs font-medium text-primary"
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
      <div className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-6 text-bone sm:p-7">
        <span className="pointer-events-none absolute -right-10 bottom-10 size-40 rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.28),transparent_70%)]" />
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-bone/45">
          Support
        </p>
        <div className="mt-5 flex items-center gap-4">
          <span className="relative grid size-16 place-items-center rounded-[4px] border border-white/15 text-electric-soft">
            <Headset className="size-6" />
          </span>
          <div>
            <p className="text-lg font-medium tracking-[-0.02em]">
              Held against your record
            </p>
            <p className="mt-0.5 text-xs text-bone/50">
              Policies, claims and payments
            </p>
          </div>
        </div>
        <p className="mt-5 font-display text-[1.35rem] italic leading-snug text-bone/85">
          Requests reach a person with your file in front of them, and every
          reply stays on the record.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            to="/support/contact"
            className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Headset className="size-3.5" />
            How support works
          </Link>
          <Link
            to="/help"
            className="inline-flex h-10 items-center gap-2 rounded-[4px] border border-white/15 px-4 text-xs font-medium text-bone/75 transition-colors hover:border-white/35 hover:text-bone"
          >
            <FileText className="size-3.5" />
            Help centre
          </Link>
        </div>
        <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[0.65rem] text-bone/40">
          <Clock className="size-3.5" />
          No published response time - we answer rather than estimate
        </div>
      </div>

      <div className="rounded-[4px] border border-line bg-card p-6 sm:p-7">
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-ink">
          What can we take off your mind?
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          Pick a starting point - we&apos;ll route you to the right human.
        </p>
        <div className="mt-5 space-y-2.5">
          {HELP_TOPICS.map(({ Icon, title, text }) => (
            <Link
              key={title}
              to="/support/contact"
              className="group flex items-start gap-3 rounded-xl border border-line px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {text}
                </span>
              </span>
              <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-ink/30 transition-colors group-hover:text-primary" />
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onQuote()}
          className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary"
        >
          Request a callback instead
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
