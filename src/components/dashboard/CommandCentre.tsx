import {
  ClaimsMixChart,
  LossRatioChart,
  PortfolioChart,
} from "@/components/dashboard/BoardCharts";
import { ChartEmptyState } from "@/components/dashboard/ChartEmptyState";
import { StatusPill } from "@/components/dashboard/PlatformUI";
import { CountUp } from "@/components/landing/CountUp";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDate, formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Car,
  ChevronRight,
  CircleDollarSign,
  HeartHandshake,
  HeartPulse,
  House,
  Plane,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";
import { Link, useNavigate } from "react-router";

type Board = FunctionReturnType<typeof api.reports.board>;

const DAY = 24 * 60 * 60 * 1000;

const LINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const CATEGORY_ICONS: Record<
  string,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  motor: Car,
  health: HeartPulse,
  home: House,
  travel: Plane,
  life: HeartHandshake,
  business: Briefcase,
};

function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

function scopeCopy(scope: Board["scope"]) {
  if (scope === "company") {
    return {
      eyebrow: "Command centre",
      description:
        "The whole book, in one calm room. Every number traces back to a policy, claim, or payment — nothing is estimated.",
      primaryLabel: "Review underwriting",
      primaryHref: "/dashboard/admin/applications",
      portfolioLabel: "Company portfolio",
      plansSubtitle: "Next renewals across the book",
      claimsSubtitle: "Newest reports across every line",
      emptyTitle: "The book starts with one policy.",
      emptyDescription:
        "Publish a product and issue the first policy. Premium, claims, and loss ratio will draw themselves from live records — no sample data.",
    };
  }
  if (scope === "book") {
    return {
      eyebrow: "Broker desk",
      description:
        "Your assigned book, nothing else. Renewals, claims, and production stay scoped to the customers you actually look after.",
      primaryLabel: "New quotation",
      primaryHref: "/dashboard/catalogue",
      portfolioLabel: "Your book",
      plansSubtitle: "Next renewals in your book",
      claimsSubtitle: "Newest claims in your book",
      emptyTitle: "Your book is ready for its first case.",
      emptyDescription:
        "Start a quotation for an assigned customer. As policies issue, this desk fills with live premium, claims, and renewals.",
    };
  }
  return {
    eyebrow: "Member vault",
    description:
      "Your cover, premiums, and claims in one calm view. Everything here is reviewed by a person — never auto-approved.",
    primaryLabel: "Explore cover",
    primaryHref: "/dashboard/catalogue",
    portfolioLabel: "Your protection",
    plansSubtitle: "Your next renewals",
    claimsSubtitle: "Your recent claims",
    emptyTitle: "Your cover story starts here.",
    emptyDescription:
      "Browse the catalogue and request your first quote. The charts stay quiet until real cover exists — we never invent data.",
  };
}

export function CommandCentre({
  board,
  months,
  onMonthsChange,
  userName,
  canManageMinerals,
}: {
  board: Board;
  months: number;
  onMonthsChange: (months: number) => void;
  userName?: string;
  /* Adding a mineral is the staff console's most used write, so it belongs on
     the dashboard itself rather than only behind the sidebar's Minerals link. */
  canManageMinerals?: boolean;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const copy = scopeCopy(board.scope);
  const firstName = (userName ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const symbol = currencySymbol(board.currency);

  /* The query returns a 12-month snapshot; derive the 6-month view locally so
     the range switch is instant and the chart morphs instead of refetching. */
  const view = useMemo(() => {
    const window = board.monthly.slice(-months);
    if (months >= board.monthly.length) {
      return { monthly: window, kpis: board.kpis };
    }
    const prior = board.monthly.slice(-months * 2, -months);
    const claims = window.reduce((sum, point) => sum + point.claims, 0);
    const priorClaims = prior.reduce((sum, point) => sum + point.claims, 0);
    const newBusiness = window.reduce(
      (sum, point) => sum + point.newBusiness,
      0,
    );
    const priorBusiness = prior.reduce(
      (sum, point) => sum + point.newBusiness,
      0,
    );
    const collected = window.reduce(
      (sum, point) => sum + point.collected,
      0,
    );
    const earned = board.kpis.premiumInForce * (months / 12);
    const change = (current: number, previous: number) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
    return {
      monthly: window,
      kpis: {
        ...board.kpis,
        claimsInWindow: Math.round(claims),
        collected: Math.round(collected),
        newBusiness: Math.round(newBusiness),
        lossRatio:
          earned > 0 ? Math.round((claims / earned) * 100) : 0,
        newBusinessChange: change(newBusiness, priorBusiness),
        claimsChange: change(claims, priorClaims),
      },
    };
  }, [board, months]);
  const { monthly, kpis } = view;

  const plansHref =
    board.scope === "company" ? "/dashboard/admin/policies" : "/dashboard/policies";
  const claimsHref =
    board.scope === "company"
      ? "/dashboard/admin/claims"
      : board.scope === "member"
        ? "/dashboard/claims"
        : "/dashboard/policies";

  const pulse = [
    {
      label: "Premium in force",
      value: board.canSeeMoney
        ? formatMoneyValue(kpis.premiumInForce, board.currency, {
            compact: true,
          })
        : "Restricted",
      helper: `${kpis.activePolicies} active ${
        kpis.activePolicies === 1 ? "policy" : "policies"
      }`,
      Icon: Wallet,
      tone: undefined,
    },
    {
      label: "Loss ratio",
      value: board.canSeeMoney ? `${kpis.lossRatio}%` : "Restricted",
      helper: board.canSeeMoney
        ? kpis.lossRatio > 100
          ? "Above the 70% guideline"
          : `Trailing ${months} months`
        : "Payments permission required",
      Icon: TrendingDown,
      tone: kpis.lossRatio > 100 ? -1 : undefined,
    },
    {
      label: "New business",
      value: board.canSeeMoney
        ? formatMoneyValue(kpis.newBusiness, board.currency, {
            compact: true,
          })
        : "Restricted",
      helper:
        kpis.newBusinessChange === null
          ? `Written in ${months} months`
          : `${kpis.newBusinessChange >= 0 ? "+" : ""}${kpis.newBusinessChange}% vs prior`,
      Icon: TrendingUp,
      tone: kpis.newBusinessChange,
    },
    {
      label: "Renewals due",
      value: String(kpis.renewalsDue),
      helper: "Inside the notice window",
      Icon: RefreshCw,
      tone: undefined,
    },
  ];

  const actionForEmpty =
    board.scope === "company"
      ? "/dashboard/admin/applications"
      : "/dashboard/catalogue";

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {copy.eyebrow}
            <span className="size-1 rounded-[4px] bg-primary/60" />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            <span className="size-1 rounded-[4px] bg-primary/60" />
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-[4px] bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-[4px] bg-emerald-500" />
              </span>
              Live book
            </span>
          </p>
          <h1 className="mt-2.5 text-[clamp(1.8rem,3.3vw,2.5rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-ink">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <div
            role="group"
            aria-label="Chart range"
            className="relative flex items-center rounded-[4px] border border-line bg-card p-0.5"
          >
            {[6, 12].map((value) => {
              const active = value === months;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onMonthsChange(value)}
                  aria-pressed={active}
                  className={cn(
                    "relative rounded-[4px] px-3.5 py-1.5 text-[0.68rem] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="board-range-pill"
                      className="absolute inset-0 rounded-[4px] bg-primary"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 34 }
                      }
                    />
                  )}
                  <span className="relative">{value}M</span>
                </button>
              );
            })}
          </div>
          {canManageMinerals && (
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
            >
              <Link to="/dashboard/admin/minerals">Add mineral</Link>
            </Button>
          )}
          <Button asChild className="h-10 rounded-[4px] px-4">
            <Link to={copy.primaryHref}>
              {copy.primaryLabel}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Portfolio pulse */}
      <div className="grid overflow-hidden rounded-2xl border border-line bg-card/70 sm:grid-cols-2 sm:divide-x sm:divide-line lg:grid-cols-4">
        {pulse.map(({ label, value, helper, Icon, tone }) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-primary/[0.07] text-primary">
              <Icon className="size-3.5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-[1.05rem] font-semibold leading-none tracking-[-0.03em] text-ink">
                {value}
              </p>
              <p
                className={cn(
                  "mt-1.5 truncate text-[0.62rem]",
                  typeof tone === "number" && tone < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {helper}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Line cards */}
      {board.lines.length === 0 ? (
        <section className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-6 text-bone sm:p-8">
          <span className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-[4px] bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.35),transparent_65%)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-lg">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-bone/45">
                Ready when you are
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.035em]">
                {copy.emptyTitle}
              </h2>
              <p className="mt-2.5 text-sm leading-6 text-bone/55">
                {copy.emptyDescription}
              </p>
            </div>
            <Button
              asChild
              className="h-10 shrink-0 rounded-[4px] bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              <Link to={actionForEmpty}>
                {copy.primaryLabel}
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {board.lines.map((line, index) => {
            const color = LINE_COLORS[index % LINE_COLORS.length];
            const Icon = CATEGORY_ICONS[line.key] ?? ShieldCheck;
            return (
              <motion.article
                key={line.key}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.055,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative overflow-hidden rounded-[4px] border border-line/80 bg-card p-4 transition-colors hover:border-primary/25 sm:p-5"
                style={{
                  backgroundImage: `radial-gradient(130% 120% at 100% 0%, color-mix(in oklab, ${color} 17%, transparent), transparent 62%)`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {line.label} insurance
                    </p>
                    <p className="mt-2 text-[1.55rem] font-semibold leading-none tracking-[-0.05em] text-ink">
                      {board.canSeeMoney ? (
                        <>
                          <CountUp
                            value={line.premium}
                            prefix={symbol}
                            className="tabular-nums"
                          />
                          <span className="ml-1.5 align-middle text-[0.6rem] font-medium tracking-normal text-muted-foreground">
                            / yr
                          </span>
                        </>
                      ) : (
                        <span className="text-base">Restricted</span>
                      )}
                    </p>
                  </div>
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[4px] border border-white/50 text-ink shadow-[0_8px_24px_-16px_rgba(8,18,39,0.55)] dark:border-white/10"
                    style={{
                      background: `color-mix(in oklab, ${color} 22%, var(--card))`,
                    }}
                  >
                    <Icon className="size-4" strokeWidth={1.9} />
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <p className="text-[0.65rem] text-muted-foreground">
                    <span className="font-semibold text-ink">
                      {line.activePolicies}
                    </span>{" "}
                    active {line.activePolicies === 1 ? "policy" : "policies"}
                  </p>
                  <p className="text-[0.62rem] font-semibold tabular-nums text-ink/60">
                    {line.share}% of book
                  </p>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-[4px] bg-ink/[0.06] dark:bg-white/10">
                  <motion.div
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${Math.max(3, line.share)}%` }}
                    transition={{
                      duration: 0.9,
                      delay: 0.25 + index * 0.07,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="h-full rounded-[4px]"
                    style={{ background: color }}
                  />
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <PortfolioChart
            data={monthly}
            currency={board.currency}
            months={months}
            onAction={() => navigate(actionForEmpty)}
            restricted={!board.canSeeMoney}
          />
          <div className="grid gap-4 md:grid-cols-[1.12fr_0.88fr]">
            <LossRatioChart
              data={monthly}
              currency={board.currency}
              lossRatio={kpis.lossRatio}
              onAction={() => navigate(claimsHref)}
              restricted={!board.canSeeMoney}
            />
            <ClaimsMixChart
              data={board.claimsMix}
              onAction={() => navigate(claimsHref)}
            />
          </div>
          <RecentClaims
            claims={board.recentClaims}
            currency={board.currency}
            href={claimsHref}
            emptyActionLabel={copy.primaryLabel}
            onEmptyAction={() => navigate(actionForEmpty)}
            canSeeMoney={board.canSeeMoney}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <ActivePlans
            plans={board.plans}
            currency={board.currency}
            href={plansHref}
            subtitle={copy.plansSubtitle}
            emptyActionLabel={copy.primaryLabel}
            onEmptyAction={() => navigate(actionForEmpty)}
            canSeeMoney={board.canSeeMoney}
          />
          <Alerts alerts={board.alerts} />
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[0.62rem] text-muted-foreground">
        <BadgeCheck className="size-3.5 text-primary/70" />
        Reporting currency {board.currency}.
        {board.otherCurrencies > 0
          ? ` ${board.otherCurrencies} other ${
              board.otherCurrencies === 1 ? "currency is" : "currencies are"
            } never added into these totals.`
          : " Currencies are never added together."}
        <span className="size-1 rounded-[4px] bg-line" />
        Synced{" "}
        {new Date(board.asOf).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function ActivePlans({
  plans,
  currency,
  href,
  subtitle,
  emptyActionLabel,
  onEmptyAction,
  canSeeMoney,
}: {
  plans: Board["plans"];
  currency: string;
  href: string;
  subtitle: string;
  emptyActionLabel: string;
  onEmptyAction: () => void;
  canSeeMoney: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[4px] border border-line bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
            Active plans
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {plans.length > 0 && (
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-primary transition-colors hover:text-ink"
          >
            All plans
            <ChevronRight className="size-3" />
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="p-4">
          <ChartEmptyState
            icon={ShieldCheck}
            title="No plans in force yet."
            description="Active policies and their renewal dates land here as soon as cover is issued."
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
            footnote="Renewals are never automatic"
            className="min-h-[220px]"
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {plans.map((plan) => {
            const days = Math.max(
              0,
              Math.ceil((plan.endDate - new Date().getTime()) / DAY),
            );
            return (
              <li key={plan.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                      {plan.productName}
                    </p>
                    <p className="mt-1 truncate text-[0.62rem] text-muted-foreground">
                      {plan.categoryLabel}
                      {plan.customerName ? ` · ${plan.customerName}` : ""}
                    </p>
                    <p className="mt-0.5 text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground/70">
                      {plan.policyNumber}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 rounded-[4px] px-3 text-[0.62rem]"
                  >
                    <Link to={href}>Manage</Link>
                  </Button>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <p className="text-[0.62rem] text-muted-foreground">
                    {days === 0
                      ? "Renews today"
                      : `Renews in ${days} ${days === 1 ? "day" : "days"}`}
                  </p>
                  <p className="text-[0.68rem] font-semibold tabular-nums text-ink">
                    {canSeeMoney ? (
                      <>
                        {formatMoneyValue(plan.premium, plan.currency)}
                        <span className="ml-0.5 text-[0.55rem] font-medium text-muted-foreground">
                          /yr
                        </span>
                      </>
                    ) : (
                      <span className="text-[0.6rem] font-medium text-muted-foreground">
                        Restricted
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line px-5 py-3">
        <p className="flex items-center gap-1.5 text-[0.58rem] text-muted-foreground">
          <CircleDollarSign className="size-3 text-primary/70" />
          Amounts are annual premium in {currency}
        </p>
      </div>
    </section>
  );
}

function Alerts({ alerts }: { alerts: Board["alerts"] }) {
  const open = alerts.reduce((total, alert) => total + alert.count, 0);

  return (
    <section className="rounded-[4px] border border-line bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
            Needs attention
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live exceptions, never hidden.
          </p>
        </div>
        <span
          className={cn(
            "rounded-[4px] border px-2 py-0.5 text-[0.58rem] font-semibold tabular-nums",
            open > 0
              ? "border-halo/40 bg-halo/15 text-[#7a5a1c] dark:text-halo"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {open > 0 ? `${open} open` : "Clear"}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {alerts.map((alert) => (
          <li key={alert.key}>
            <Link
              to={alert.href}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-primary/[0.03]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-[4px]",
                  alert.count === 0
                    ? "bg-emerald-500/60"
                    : alert.severity === "critical"
                      ? "bg-destructive"
                      : alert.severity === "warning"
                        ? "bg-halo"
                        : "bg-primary",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[0.68rem] text-ink/75">
                {alert.label}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  alert.count === 0 ? "text-muted-foreground" : "text-ink",
                )}
              >
                {alert.count}
              </span>
              <ChevronRight className="size-3 shrink-0 text-ink/25" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-5 py-3">
        <p className="flex items-center gap-1.5 text-[0.58rem] text-muted-foreground">
          <BadgeCheck className="size-3 text-primary/70" />
          Counts refresh with every record change
        </p>
      </div>
    </section>
  );
}

function RecentClaims({
  claims,
  currency,
  href,
  emptyActionLabel,
  onEmptyAction,
  canSeeMoney,
}: {
  claims: Board["recentClaims"];
  currency: string;
  href: string;
  emptyActionLabel: string;
  onEmptyAction: () => void;
  canSeeMoney: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[4px] border border-line bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
            Recent claims
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Decisions and settlements are recorded by authorised handlers.
          </p>
        </div>
        {claims.length > 0 && (
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-primary transition-colors hover:text-ink"
          >
            Open desk
            <ChevronRight className="size-3" />
          </Link>
        )}
      </div>

      {claims.length === 0 ? (
        <div className="p-4">
          <ChartEmptyState
            icon={ShieldCheck}
            title="No claims on the record."
            description="When a claim is reported it appears here with its reference, amount, and current decision state."
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
            footnote="Submitting a claim is not an admission of cover"
            className="min-h-[210px]"
          />
        </div>
      ) : (
        <div className="mt-3">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] gap-3 border-y border-line/70 px-5 py-2 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
            <span>Claim</span>
            <span>Product</span>
            <span className="text-right">Amount</span>
            <span className="w-24 text-right">Status</span>
          </div>
          <ul className="divide-y divide-line">
            {claims.map((claim) => (
              <li
                key={claim.id}
                className="grid gap-2 px-5 py-3 transition-colors hover:bg-primary/[0.02] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink">
                    {claim.reference}
                  </p>
                  <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                    {claim.customerName ?? claim.productName}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.68rem] text-ink/70">
                    {claim.productName}
                  </p>
                  <p className="mt-0.5 text-[0.58rem] text-muted-foreground">
                    Reported {formatDate(claim.reportedAt).replace(/,.*/, "")}
                  </p>
                </div>
                <p className="text-[0.68rem] font-semibold tabular-nums text-ink sm:text-right">
                  {canSeeMoney
                    ? formatMoneyValue(claim.amount, claim.currency)
                    : "Restricted"}
                </p>
                <div className="sm:w-24 sm:text-right">
                  <StatusPill status={claim.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="border-t border-line px-5 py-3">
        <p className="flex items-center gap-1.5 text-[0.58rem] text-muted-foreground">
          <CircleDollarSign className="size-3 text-primary/70" />
          Claim amounts are shown in their original currency
          {currency ? ` · company totals use ${currency}` : ""}
        </p>
      </div>
    </section>
  );
}
