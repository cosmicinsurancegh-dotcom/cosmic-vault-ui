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

/** Skeleton that mirrors the dashboard layout, so loading never feels broken. */
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
