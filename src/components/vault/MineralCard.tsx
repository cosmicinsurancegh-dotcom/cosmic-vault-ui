import { formatDate, formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Mineral } from "@/lib/vault/types";
import { formatWeight } from "@/lib/vault/types";
import { ArrowUpRight, MapPin, Scale, Ruler, Sparkle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { MineralVisual } from "./MineralVisual";
import {
  InsuranceBadge,
  ShippingBadgeForMineral,
  ShippingStatusBadge,
} from "./StatusBadges";

function Meta({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Scale;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[0.54rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {Icon && <Icon className="size-2.5 shrink-0" strokeWidth={2} />}
        {label}
      </dt>
      <dd className="mt-1 truncate text-[0.7rem] font-medium leading-4 text-ink">
        {value}
      </dd>
    </div>
  );
}

export function MineralCard({
  mineral,
  onOpen,
  index = 0,
}: {
  mineral: Mineral;
  onOpen: (mineral: Mineral) => void;
  index?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.42,
        delay: Math.min(index * 0.045, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative min-w-0 overflow-hidden rounded-[4px] border border-line bg-card transition-colors hover:border-primary/30"
    >
      <button
        type="button"
        onClick={() => onOpen(mineral)}
        aria-label={`Open ${mineral.name}, vault record ${mineral.vaultId}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
      >
        <MineralVisual mineral={mineral} className="aspect-[16/10]">
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <span className="rounded-[4px] border border-white/15 bg-[#071227]/55 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-bone/80 backdrop-blur-md">
              {mineral.type}
            </span>
            {mineral.shipping && (
              <ShippingStatusBadge
                status={mineral.shipping.currentStatus}
                className="border-white/15 bg-[#071227]/60 text-bone/85 backdrop-blur-md [&>span]:opacity-100"
              />
            )}
          </div>
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-bone/45">
                Vault ID
              </p>
              <p className="mt-0.5 truncate text-[0.72rem] font-semibold tracking-[0.04em] text-bone">
                {mineral.vaultId}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-bone/45">
                Certificate
              </p>
              <p className="mt-0.5 truncate text-[0.64rem] font-medium text-bone/80">
                {mineral.certificateNumber}
              </p>
            </div>
          </div>
        </MineralVisual>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {mineral.category}
              </p>
              <h3 className="mt-1 truncate text-[0.98rem] font-semibold tracking-[-0.025em] text-ink">
                {mineral.name}
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.5rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Appraised
              </p>
              <p className="mt-1 text-[0.86rem] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-line pt-4">
            <Meta
              label="Weight"
              value={formatWeight(mineral.weight, mineral.unit)}
              icon={Scale}
            />
            <Meta label="Dimensions" value={mineral.dimensions} icon={Ruler} />
            <Meta
              label="Purity / grade"
              value={[mineral.purity, mineral.grade].filter(Boolean).join(" · ")}
              icon={Sparkle}
            />
            <Meta
              label="Storage"
              value={mineral.storageLocation}
              icon={MapPin}
            />
          </dl>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <InsuranceBadge mineral={mineral} />
              <ShippingBadgeForMineral mineral={mineral} />
            </div>
            <span className="text-[0.56rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {mineral.ownerReference}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-3">
            <span className="text-[0.58rem] uppercase tracking-[0.13em] text-muted-foreground">
              Deposited {formatDate(mineral.depositDate)}
            </span>
            <span className="inline-flex items-center gap-1 text-[0.63rem] font-semibold text-primary">
              Open record
              <ArrowUpRight className="size-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

export function MineralListRow({
  mineral,
  onOpen,
  className,
}: {
  mineral: Mineral;
  onOpen: (mineral: Mineral) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(mineral)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[4px] border border-line bg-card p-3 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <MineralVisual
        mineral={mineral}
        className="aspect-square size-14 shrink-0 rounded-[4px]"
        overlay={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-semibold text-ink">{mineral.name}</p>
          <InsuranceBadge mineral={mineral} showIcon={false} className="shrink-0" />
        </div>
        <p className="mt-0.5 truncate text-[0.62rem] text-muted-foreground">
          {mineral.vaultId} · {formatWeight(mineral.weight, mineral.unit)} ·{" "}
          {mineral.storageLocation}
        </p>
        {mineral.shipping && (
          <div className="mt-1">
            <ShippingStatusBadge status={mineral.shipping.currentStatus} />
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[0.7rem] font-semibold tabular-nums text-ink">
          {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
        </p>
        <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
          {mineral.type}
        </p>
      </div>
    </button>
  );
}
