import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PulseItem = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger" | "positive";
};

const TONE_TEXT = {
  default: "text-ink",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-destructive",
  positive: "text-emerald-700 dark:text-emerald-400",
} as const;

export function VaultPulse({
  items,
  className,
}: {
  items: PulseItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-2xl border border-line bg-card/70 sm:grid-cols-2 sm:divide-x sm:divide-line lg:grid-cols-4",
        className,
      )}
    >
      {items.map(({ label, value, helper, icon: Icon, tone = "default" }) => (
        <div key={label} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-primary/[0.07] text-primary">
            <Icon className="size-3.5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-1 truncate text-[1.05rem] font-semibold leading-none tracking-[-0.03em] tabular-nums",
                TONE_TEXT[tone],
              )}
            >
              {value}
            </p>
            {helper && (
              <p className="mt-1.5 truncate text-[0.61rem] text-muted-foreground">
                {helper}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
