import { Reveal } from "@/components/site/Reveal";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatGBP } from "@/lib/vault";
import { Activity, PieChart as PieChartIcon, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "./ChartEmptyState";

export type ActivityPoint = { label: string; requests: number };
export type MixPoint = { key: string; label: string; value: number };
export type PremiumPoint = { key: string; label: string; premium: number };

/* ------------------------------------------------------------------ panel */

function ChartPanel({
  title,
  subtitle,
  badge,
  delay = 0,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <section className="flex h-full flex-col rounded-[1.4rem] border border-line bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {badge && (
            <span className="shrink-0 rounded-full border border-line bg-ink/[0.03] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-5 flex-1">{children}</div>
      </section>
    </Reveal>
  );
}

/* ------------------------------------------------------------- activity */

const ACTIVITY_CONFIG = {
  requests: { label: "Requests", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ActivityChart({
  data,
  onAction,
}: {
  data: ActivityPoint[];
  onAction: () => void;
}) {
  const total = data.reduce((sum, point) => sum + point.requests, 0);

  return (
    <ChartPanel
      title="Request activity"
      subtitle="Quote requests you've made, by month"
      badge={total > 0 ? `${total} total` : undefined}
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={Activity}
          title="No requests to plot yet"
          description="Each quote request you make lands here as a bar, so you can watch your cover grow month by month."
          actionLabel="Start a request"
          onAction={onAction}
        />
      ) : (
        <ChartContainer
          config={ACTIVITY_CONFIG}
          role="img"
          aria-label={`Quote requests by month, ${total} in total`}
          className="aspect-auto h-[236px] w-full"
        >
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar
              dataKey="requests"
              fill="var(--color-requests)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              animationBegin={120}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartPanel>
  );
}

/* --------------------------------------------------------- coverage mix */

const MIX_CONFIG = {
  health: { label: "Health", color: "var(--chart-1)" },
  home: { label: "Home", color: "var(--chart-2)" },
  auto: { label: "Auto", color: "var(--chart-3)" },
  life: { label: "Life", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function CoverageMixChart({
  data,
  onAction,
}: {
  data: MixPoint[];
  onAction: () => void;
}) {
  const total = data.reduce((sum, point) => sum + point.value, 0);

  return (
    <ChartPanel
      title="Coverage mix"
      subtitle="How your protection is balanced"
      badge={total > 0 ? `${total} line${total === 1 ? "" : "s"}` : undefined}
      delay={0.08}
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={PieChartIcon}
          title="Your cover mix appears here"
          description="Add your first cover line and this chart maps how your protection is spread across health, home, auto and life."
          actionLabel="Request a quote"
          onAction={onAction}
        />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <div className="relative h-[196px] w-full max-w-[220px] shrink-0">
            <ChartContainer
              config={MIX_CONFIG}
              role="img"
              aria-label={`Coverage mix across ${total} cover lines`}
              className="aspect-auto h-full w-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="key" hideLabel />}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={4}
                  cornerRadius={6}
                  strokeWidth={0}
                  animationBegin={150}
                  animationDuration={950}
                >
                  {data.map((point) => (
                    <Cell
                      key={point.key}
                      fill={`var(--color-${point.key})`}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-ink">
                  {total}
                </p>
                <p className="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Cover lines
                </p>
              </div>
            </div>
          </div>

          <ul className="w-full space-y-2.5">
            {data.map((point) => (
              <li
                key={point.key}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--color-${point.key})` }}
                />
                <span className="flex-1 text-ink/75">{point.label}</span>
                <span className="font-medium tabular-nums text-ink">
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

/* ------------------------------------------------------ premium by line */

const PREMIUM_CONFIG = {
  premium: { label: "Est. monthly", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PremiumByLineChart({
  data,
  onAction,
}: {
  data: PremiumPoint[];
  onAction: () => void;
}) {
  const total = data.reduce((sum, point) => sum + point.premium, 0);

  return (
    <ChartPanel
      title="Premium by cover line"
      subtitle="Your estimate, split by cover"
      badge={total > 0 ? `${formatGBP(total)}/mo` : undefined}
      delay={0.04}
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={Wallet}
          title="No premium to forecast"
          description="Pick a plan and we'll chart your estimated monthly premium for each cover line - no surprises, no hidden fees."
          actionLabel="Choose a plan"
          onAction={onAction}
        />
      ) : (
        <ChartContainer
          config={PREMIUM_CONFIG}
          role="img"
          aria-label={`Estimated monthly premium by cover line, ${formatGBP(total)} in total`}
          className="aspect-auto h-[236px] w-full"
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="4 4" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={66}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => formatGBP(Number(value))}
                />
              }
            />
            <Bar
              dataKey="premium"
              fill="var(--color-premium)"
              radius={[0, 6, 6, 0]}
              maxBarSize={26}
              animationBegin={180}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartPanel>
  );
}
