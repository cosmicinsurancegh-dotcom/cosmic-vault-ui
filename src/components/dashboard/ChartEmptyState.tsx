import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChartLine, type LucideIcon } from "lucide-react";

/**
 * Chart-specific empty state. Deliberately framed as "waiting for your first
 * data point" rather than "nothing here", with the next action always visible
 * and a ghosted plot so the space reads as intentional, not broken.
 */
export function ChartEmptyState({
  icon: Icon = ChartLine,
  title,
  description,
  actionLabel,
  onAction,
  footnote = "Updates automatically",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  footnote?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative flex min-h-[248px] flex-col items-center justify-center overflow-hidden rounded-[1rem] border border-dashed border-line bg-[color-mix(in_oklab,var(--ice)_38%,transparent)] px-6 py-10 text-center",
        className,
      )}
    >
      <span aria-hidden="true" className="vault-grid absolute inset-0 opacity-60" />

      {/* Ghost plot: a deliberate "first data point" waiting to be drawn. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] w-full text-primary/25"
      >
        <path
          d="M0 104H320M0 74H320M0 44H320"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeDasharray="2 7"
          strokeWidth="1"
        />
        <motion.path
          d="M8 98C44 96 58 84 88 82C120 80 138 90 170 76C202 62 220 48 252 46C276 44 292 40 312 34"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          cx="170"
          cy="76"
          r="3.5"
          fill="var(--primary)"
          initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ duration: 0.5, delay: 1.2, ease: "easeOut" }}
          style={{ transformOrigin: "170px 76px" }}
        />
      </svg>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-[4px] border border-primary/10"
      >
        <span className="absolute inset-6 rounded-[4px] border border-primary/10" />
        <span className="absolute -left-1 top-1/2 size-1.5 rounded-[4px] bg-primary/50" />
      </span>

      <span className="relative grid size-11 place-items-center rounded-[4px] border border-primary/15 bg-card text-primary shadow-[0_10px_30px_-18px_rgba(29,116,245,0.55)]">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <p className="relative mt-4 text-sm font-semibold tracking-[-0.01em] text-ink">
        {title}
      </p>
      <p className="relative mt-1.5 max-w-[24rem] text-xs leading-5 text-muted-foreground">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          size="sm"
          className="relative mt-4 h-9 rounded-[4px] px-4"
          onClick={onAction}
        >
          {actionLabel}
          <ArrowUpRight className="size-3.5" />
        </Button>
      )}
      <p className="relative mt-3.5 inline-flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        <span className="size-1 rounded-[4px] bg-primary/40" />
        {footnote}
      </p>
    </div>
  );
}
