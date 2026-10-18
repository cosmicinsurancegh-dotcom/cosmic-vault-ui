import { Skeleton } from "@/components/ui/skeleton";

const BAR_HEIGHTS = [44, 66, 52, 86, 58, 74];

function ChartCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="rounded-[1.4rem] border border-line bg-card p-5 sm:p-6">
      <Skeleton className="h-4 w-32" style={{ animationDelay: `${delay}ms` }} />
      <Skeleton
        className="mt-2.5 h-3 w-44"
        style={{ animationDelay: `${delay + 80}ms` }}
      />
      <div className="mt-6 flex h-[190px] items-end gap-2">
        {BAR_HEIGHTS.map((height, index) => (
          <Skeleton
            key={index}
            className="w-full rounded-t-md"
            style={{
              height: `${height}%`,
              animationDelay: `${delay + index * 90}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-card/70 sm:grid-cols-2 sm:divide-x sm:divide-line lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommandChartSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="rounded-[1.35rem] border border-line bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-2.5 w-52" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div
        className={`relative mt-5 flex items-end gap-2 overflow-hidden rounded-lg bg-ink/[0.015] px-2 ${
          tall ? "h-[290px] sm:h-[318px]" : "h-[236px]"
        }`}
      >
        {[38, 56, 44, 68, 52, 74, 60, 84, 66, 78, 58, 72].map(
          (height, index) => (
            <Skeleton
              key={index}
              className="w-full rounded-t-md"
              style={{
                height: `${height}%`,
                animationDelay: `${index * 80}ms`,
              }}
            />
          ),
        )}
        <span className="pointer-events-none absolute inset-x-2 top-1/3 h-px bg-line/60" />
        <span className="pointer-events-none absolute inset-x-2 top-2/3 h-px bg-line/40" />
      </div>
    </div>
  );
}

function RailCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-[1.35rem] border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-40" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-4 space-y-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2 border-t border-line/60 pt-3 first:border-0 first:pt-0">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-3/5" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading shell that mirrors the Command Centre, so nothing jumps on load. */
export function CommandCentreSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-64" />
          <Skeleton className="h-9 w-72 max-w-full sm:w-80" />
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>

      <PulseSkeleton />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="rounded-[1.25rem] border border-line bg-card p-5"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
              <Skeleton className="size-9 rounded-full" />
            </div>
            <div className="mt-5 flex justify-between gap-3">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="mt-2 h-1 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <CommandChartSkeleton tall />
          <div className="grid gap-4 md:grid-cols-[1.12fr_0.88fr]">
            <CommandChartSkeleton />
            <CommandChartSkeleton />
          </div>
          <RailCardSkeleton rows={4} />
        </div>
        <div className="space-y-4">
          <RailCardSkeleton />
          <RailCardSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton that mirrors the member dashboard layout, so loading never feels broken. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[236px] w-full rounded-[1.6rem]" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-[1.2rem] border border-line bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <Skeleton
              className="mt-4 h-7 w-20"
              style={{ animationDelay: `${index * 90}ms` }}
            />
            <Skeleton className="mt-2.5 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <ChartCardSkeleton />
        <ChartCardSkeleton delay={120} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <ChartCardSkeleton delay={60} />
        <div className="rounded-[1.4rem] border border-line bg-card p-5 sm:p-6">
          <Skeleton className="h-4 w-32" />
          <div className="mt-5 space-y-3.5">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-3/5" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
