import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles, type LucideIcon } from "lucide-react";

/**
 * Chart-specific empty state. Deliberately framed as "waiting for your first
 * data point" rather than "nothing here", with the next action always visible.
 */
export function ChartEmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  onAction,
  footnote = "Updates automatically",
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  footnote?: string;
}) {
  return (
    <div className="vault-grid relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-ink/[0.012] px-6 py-9 text-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full border border-primary/12"
      >
        <span className="absolute inset-6 rounded-full border border-primary/10" />
        <span className="absolute -left-1 top-1/2 size-1.5 rounded-full bg-primary/60" />
      </span>

      <span className="relative grid size-11 place-items-center rounded-full bg-ice text-primary">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <p className="relative mt-4 text-sm font-medium text-ink">{title}</p>
      <p className="relative mt-1.5 max-w-[22rem] text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          size="sm"
          className="relative mt-4 h-9 rounded-full px-4"
          onClick={onAction}
        >
          {actionLabel}
          <ArrowUpRight className="size-3.5" />
        </Button>
      )}
      <p className="relative mt-3 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        {footnote}
      </p>
    </div>
  );
}
