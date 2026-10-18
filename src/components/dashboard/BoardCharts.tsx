import { ChartEmptyState } from "@/components/dashboard/ChartEmptyState";
import { CountUp } from "@/components/landing/CountUp";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { motion, useReducedMotion } from "framer-motion";
import { ChartLine, ChartNoAxesColumn, Lock, PieChart } from "lucide-react";
import { formatMoneyValue } from "@/lib/format";
import { useId, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";

export type BoardMonth = {
  label: string;
  premium: number;
  claims: number;
  collected: number;
  newBusiness: number;
  policies: number;
  ratio: number;
};

export type BoardClaimMix = {
  key: "settled" | "open" | "declined" | string;
  label: string;
  value: number;
};

const MIX_COLORS: Record<string, string> = {
  settled: "var(--chart-2)",
  open: "var(--chart-4)",
  declined: "var(--destructive)",
};

const mixConfig = {
  settled: { label: "Settled", color: "var(--chart-2)" },
  open: { label: "In review", color: "var(--chart-4)" },
  declined: { label: "Declined", color: "var(--destructive)" },
} satisfies ChartConfig;

const portfolioConfig = {
  premium: { label: "Premium in force", color: "var(--chart-1)" },
  claims: { label: "Claims incurred", color: "var(--chart-4)" },
} satisfies ChartConfig;

const lossConfig = {
  claims: { label: "Claims incurred", color: "var(--chart-4)" },
} satisfies ChartConfig;

function ChartPanel({
  title,
  subtitle,
  badge,
  legend,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-[1.35rem] border border-line bg-card ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h2>
            {badge}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {subtitle}
          </p>
        </div>
        {legend}
      </div>
      <div className="flex-1 px-3 pb-3 sm:px-4 sm:pb-4">{children}</div>
    </section>
  );
}

function LegendChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[4px] border border-line/80 bg-ink/[0.02] px-2.5 py-1 text-[0.62rem] font-medium text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-[4px]"
        style={{ background: color }}
      />
      {label}
      {value && <span className="tabular-nums text-ink/70">{value}</span>}
    </span>
  );
}

export function PortfolioChart({
  data,
  currency,
  onAction,
  months,
  restricted = false,
}: {
  data: BoardMonth[];
  currency: string;
  onAction: () => void;
  months: number;
  restricted?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const hasData = data.some((point) => point.premium > 0 || point.claims > 0);
  const latest = data[data.length - 1];

  return (
    <ChartPanel
      title="Portfolio state"
      subtitle={`Premium in force against claims incurred · last ${months} months, ${currency}`}
      badge={
        hasData ? (
          <span className="rounded-[4px] border border-primary/15 bg-primary/[0.06] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-primary">
            Live
          </span>
        ) : undefined
      }
      legend={
        hasData ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <LegendChip
              color="var(--chart-1)"
              label="Premium"
              value={formatMoneyValue(latest?.premium ?? 0, currency, {
                compact: true,
              })}
            />
            <LegendChip
              color="var(--chart-4)"
              label="Claims"
              value={formatMoneyValue(latest?.claims ?? 0, currency, {
                compact: true,
              })}
            />
          </div>
        ) : undefined
      }
    >
      {restricted ? (
        <ChartEmptyState
          icon={Lock}
          title="Financial detail is restricted."
          description="Your staff role does not include the payments.view permission, so premium and claims amounts stay hidden here. Ask a super admin to grant it."
          footnote="Enforced on the server as well"
          className="mx-2 sm:mx-2"
        />
      ) : !hasData ? (
        <ChartEmptyState
          icon={ChartLine}
          title="The first chapter hasn't been plotted."
          description="Premium and claims draw themselves here as soon as the first policy is issued. No estimates, no placeholder numbers."
          actionLabel="Open underwriting"
          onAction={onAction}
          footnote="Updates from live policy records"
          className="mx-2 sm:mx-2"
        />
      ) : (
        <ChartContainer
          config={portfolioConfig}
          className="aspect-auto h-[290px] w-full sm:h-[318px]"
          role="img"
          aria-label={`Premium in force and claims incurred over the last ${months} months in ${currency}`}
        >
          <ComposedChart
            data={data}
            margin={{ top: 18, right: 8, bottom: 0, left: -8 }}
          >
            <defs>
              <linearGradient id={`premium-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="80%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 6"
              className="stroke-line/70"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={14}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value) =>
                formatMoneyValue(Number(value), currency, { compact: true })
              }
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--chart-1)",
                strokeOpacity: 0.22,
                strokeWidth: 1,
              }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  formatter={(value) =>
                    formatMoneyValue(Number(value), currency)
                  }
                />
              }
            />
            <Area
              dataKey="premium"
              type="monotone"
              stroke="var(--color-premium)"
              strokeWidth={2.4}
              fill={`url(#premium-fill-${uid})`}
              fillOpacity={1}
              activeDot={{
                r: 5,
                fill: "var(--color-premium)",
                stroke: "var(--card)",
                strokeWidth: 3,
              }}
              animationDuration={1000}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
            <Bar
              dataKey="claims"
              fill="var(--color-claims)"
              fillOpacity={0.26}
              stroke="var(--color-claims)"
              strokeOpacity={0.42}
              strokeWidth={1}
              radius={[6, 6, 2, 2]}
              maxBarSize={24}
              animationDuration={900}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            />
          </ComposedChart>
        </ChartContainer>
      )}
    </ChartPanel>
  );
}

export function LossRatioChart({
  data,
  currency,
  lossRatio,
  onAction,
  restricted = false,
}: {
  data: BoardMonth[];
  currency: string;
  lossRatio: number;
  onAction: () => void;
  restricted?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const hasClaims = data.some((point) => point.claims > 0);
  const claimsIncurred = data.reduce((sum, point) => sum + point.claims, 0);
  const earnedPremium =
    (data[data.length - 1]?.premium ?? 0) * (data.length / 12);
  const arcFraction = Math.min(1, Math.max(0, lossRatio / 100));
  const tone =
    lossRatio > 100
      ? "var(--destructive)"
      : lossRatio > 70
        ? "var(--chart-4)"
        : "var(--chart-2)";
  const status =
    lossRatio > 100 ? "Above target" : lossRatio > 70 ? "Watch" : "Within target";

  return (
    <ChartPanel
      title="Loss ratio"
      subtitle="Claims incurred against earned premium"
      badge={
        hasClaims ? (
          <span
            className="rounded-[4px] border px-2 py-0.5 text-[0.58rem] font-semibold"
            style={{
              borderColor: `color-mix(in oklab, ${tone} 30%, transparent)`,
              background: `color-mix(in oklab, ${tone} 10%, transparent)`,
              color: tone,
            }}
          >
            {status}
          </span>
        ) : undefined
      }
    >
      {restricted ? (
        <ChartEmptyState
          icon={Lock}
          title="Loss ratio is restricted."
          description="Claims and premium amounts need the payments.view permission. The gauge unlocks the moment access is granted."
          footnote="Enforced on the server as well"
          className="mx-2 sm:mx-2"
        />
      ) : !hasClaims ? (
        <ChartEmptyState
          icon={ChartNoAxesColumn}
          title="The good kind of empty."
          description="No claims have been reported in this window. The moment one is, its value and the rolling loss ratio plot here."
          actionLabel="View claims"
          onAction={onAction}
          footnote="Claims are recorded by authorised handlers"
          className="mx-2 sm:mx-2"
        />
      ) : (
        <div className="flex h-full flex-col px-2 pb-1 sm:px-3">
          <div className="flex flex-col items-center pt-1">
            <div className="relative w-full max-w-[238px]">
              <svg
                viewBox="0 0 200 116"
                role="img"
                aria-label={`Loss ratio ${lossRatio} percent, ${status.toLowerCase()}`}
                className="w-full"
              >
                <path
                  d="M20 100A80 80 0 0 1 180 100"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M20 100A80 80 0 0 1 180 100"
                  fill="none"
                  stroke={tone}
                  strokeWidth="10"
                  strokeLinecap="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: Math.max(0.02, arcFraction) }}
                  transition={{ duration: 1.1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* Benchmark notch at 70% */}
                <line
                  x1="140"
                  y1="45"
                  x2="152"
                  y2="29"
                  stroke="var(--muted-foreground)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.5"
                />
                <text
                  x="161"
                  y="26"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[6.5px] font-semibold uppercase tracking-[0.12em]"
                >
                  70%
                </text>
              </svg>
              <div className="pointer-events-none absolute inset-x-0 bottom-[6px] text-center">
                <p className="text-[2rem] font-semibold leading-none tracking-[-0.06em] text-ink">
                  <CountUp value={lossRatio} suffix="%" />
                </p>
                <p className="mt-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Trailing {data.length} months
                </p>
              </div>
            </div>

            <div className="mt-1 grid w-full grid-cols-2 gap-2 border-t border-line/70 pt-2.5">
              <div>
                <p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Claims
                </p>
                <p className="mt-1 text-[0.72rem] font-semibold tabular-nums text-ink">
                  {formatMoneyValue(claimsIncurred, currency, { compact: true })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Earned premium
                </p>
                <p className="mt-1 text-[0.72rem] font-semibold tabular-nums text-ink">
                  {formatMoneyValue(earnedPremium, currency, { compact: true })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-3">
            <p className="mb-1 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Monthly claims
            </p>
            <ChartContainer
              config={lossConfig}
              className="aspect-auto h-[46px] w-full"
              role="img"
              aria-label="Claims incurred by month"
            >
              <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip
                  cursor={{ fill: "var(--primary)", fillOpacity: 0.05 }}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) =>
                        formatMoneyValue(Number(value), currency)
                      }
                    />
                  }
                />
                <Bar
                  dataKey="claims"
                  fill="var(--color-claims)"
                  fillOpacity={0.55}
                  radius={[3, 3, 2, 2]}
                  maxBarSize={18}
                  animationDuration={850}
                  animationEasing="ease-out"
                  isAnimationActive={!reduceMotion}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </ChartPanel>
  );
}

export function ClaimsMixChart({
  data,
  onAction,
}: {
  data: BoardClaimMix[];
  onAction: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const total = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <ChartPanel
      title="Claims mix"
      subtitle="Every claim, by outcome"
      className="h-full"
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={PieChart}
          title="All quiet on claims."
          description="Your claims mix appears with the first report. Until then there is nothing to divide, and that is a good place to be."
          actionLabel="Open claims desk"
          onAction={onAction}
          footnote="No claims recorded"
          className="mx-2 sm:mx-2"
        />
      ) : (
        <div className="flex h-full flex-col items-center gap-4 pb-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative h-[176px] w-full max-w-[184px] shrink-0">
            <ChartContainer
              config={mixConfig}
              className="aspect-auto h-full w-full"
              role="img"
              aria-label={`${total} claims split by outcome`}
            >
              <RechartsPieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent nameKey="key" hideLabel indicator="dot" />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={56}
                  outerRadius={78}
                  paddingAngle={3}
                  cornerRadius={5}
                  strokeWidth={0}
                  animationBegin={140}
                  animationDuration={950}
                  animationEasing="ease-out"
                  isAnimationActive={!reduceMotion}
                >
                  {data.map((point) => (
                    <Cell
                      key={point.key}
                      fill={MIX_COLORS[point.key] ?? "var(--chart-1)"}
                    />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[1.65rem] font-semibold leading-none tracking-[-0.05em] text-ink">
                  {total}
                </p>
                <p className="mt-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Claims
                </p>
              </div>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-2.5">
            {data.map((point) => (
              <li key={point.key} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-[4px]"
                  style={{
                    background: MIX_COLORS[point.key] ?? "var(--chart-1)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                  {point.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-ink">
                  {Math.round((point.value / total) * 100)}%
                </span>
                <span className="w-5 text-right text-[0.65rem] tabular-nums text-muted-foreground">
                  {point.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartPanel>
  );
}
