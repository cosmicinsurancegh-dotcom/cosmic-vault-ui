import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VaultActivity } from "@/lib/vault/types";
import {
  ArrowDownToLine,
  FileCheck2,
  Gem,
  MessageSquareLock,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router";

const ICONS: Record<VaultActivity["kind"], LucideIcon> = {
  deposit: ArrowDownToLine,
  insurance: ShieldCheck,
  shipping: Truck,
  claim: FileCheck2,
  valuation: Scale,
  edit: Sparkles,
  note: MessageSquareLock,
};

export function VaultActivityFeed({
  activities,
  limit = 8,
  showOwner = false,
  onOpenMineral,
  href,
  className,
}: {
  activities: VaultActivity[];
  limit?: number;
  showOwner?: boolean;
  onOpenMineral?: (mineralId: string) => void;
  href?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rows = activities.slice(0, limit);

  return (
    <div className={cn("overflow-hidden rounded-[4px] border border-line bg-card", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
            Vault activity
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every update, in the order it happened.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[0.55rem] font-semibold text-emerald-700 dark:text-emerald-400">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-[4px] bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-[4px] bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-muted-foreground">
          Activity appears here as your collection changes.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {rows.map((activity, index) => {
            const Icon = ICONS[activity.kind] ?? Gem;
            const content = (
              <>
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                  <Icon className="size-3.5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-[0.7rem] font-semibold text-ink">
                      {activity.title}
                    </span>
                    {activity.internal && (
                      <span className="rounded-[4px] border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.48rem] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">
                        Internal
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[0.64rem] leading-5 text-muted-foreground">
                    {activity.body}
                  </span>
                  <span className="mt-1 block text-[0.54rem] uppercase tracking-[0.12em] text-muted-foreground/75">
                    {formatDateTime(activity.at)}
                    {showOwner ? ` · ${activity.ownerName}` : ""}
                  </span>
                </span>
              </>
            );

            return (
              <motion.li
                key={activity.id}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.2) }}
              >
                {onOpenMineral ? (
                  <button
                    type="button"
                    onClick={() => onOpenMineral(activity.mineralId)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3">{content}</div>
                )}
              </motion.li>
            );
          })}
        </ol>
      )}

      {href && rows.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <Link to={href} className="text-[0.63rem] font-semibold text-primary">
            View every movement
          </Link>
        </div>
      )}
    </div>
  );
}
