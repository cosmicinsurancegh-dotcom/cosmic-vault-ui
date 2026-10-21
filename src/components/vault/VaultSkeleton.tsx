import { Skeleton } from "@/components/ui/skeleton";

function PulseSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-card/70 sm:grid-cols-2 sm:divide-x sm:divide-line lg:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="size-8 shrink-0 rounded-[4px]" />
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

function CardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-card">
      <div className="relative aspect-[16/10] bg-muted/60">
        <Skeleton className="absolute inset-0 rounded-none" />
        <Skeleton
          className="absolute left-3 top-3 h-5 w-20 rounded-[4px]"
          style={{ animationDelay: `${delay + 60}ms` }}
        />
      </div>
      <div className="space-y-3 p-5">
        <div className="flex justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-2.5 w-14" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-1.5">
              <Skeleton className="h-2 w-14" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-line pt-3">
          <Skeleton className="h-5 w-20 rounded-[4px]" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function VaultSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your vault">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-2.5 w-64" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-[4px]" />
          <Skeleton className="h-10 w-28 rounded-[4px]" />
        </div>
      </div>

      <PulseSkeleton />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-[4px] border border-line bg-card p-3 sm:flex-row">
            <Skeleton className="h-9 flex-1 rounded-[4px]" />
            <Skeleton className="h-9 w-32 rounded-[4px]" />
            <Skeleton className="h-9 w-32 rounded-[4px]" />
            <Skeleton className="h-9 w-28 rounded-[4px]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: cards }).map((_, index) => (
              <CardSkeleton key={index} delay={index * 80} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-[4px] border border-line bg-card p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-2.5 w-44" />
            <div className="mt-5 space-y-4">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="flex gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-[4px]" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-full" />
                    <Skeleton className="h-2 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
