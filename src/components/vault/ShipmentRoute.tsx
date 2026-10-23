import { daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Shipment, ShippingStatus } from "@/lib/vault/types";
import { SHIPPING_STATUS_META } from "@/lib/vault/types";
import {
  CircleCheck,
  CirclePause,
  Clock3,
  MapPin,
  PackageCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/** Where the active marker sits between origin and destination. */
const PROGRESS: Record<ShippingStatus, number> = {
  pending: 0.12,
  in_progress: 0.36,
  on_hold: 0.5,
  in_transit: 0.72,
  shipped: 1,
};

const STATUS_ICON: Record<
  ShippingStatus,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  pending: Clock3,
  in_progress: PackageCheck,
  on_hold: CirclePause,
  in_transit: Truck,
  shipped: CircleCheck,
};

const ACTIVE_MARKER: Record<ShippingStatus, string> = {
  pending: "border border-dashed border-line bg-card text-muted-foreground",
  in_progress: "border border-primary/30 bg-primary/10 text-primary",
  on_hold: "bg-amber-500 text-white",
  in_transit: "bg-primary text-primary-foreground",
  shipped: "bg-emerald-600 text-white",
};

const STAMP = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function stamp(at?: number) {
  return at ? STAMP.format(new Date(at)) : "Awaiting";
}

export function ShipmentStatusChip({
  status,
  className,
}: {
  status: ShippingStatus;
  className?: string;
}) {
  const meta = SHIPPING_STATUS_META[status];
  const Icon = STATUS_ICON[status];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold leading-none",
        meta.tone,
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} />
      {meta.label}
    </span>
  );
}

/** A mineral that has no consignment yet. */
export function InVaultChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-muted/60 px-2.5 py-1 text-[0.6rem] font-semibold leading-none text-muted-foreground",
        className,
      )}
    >
      <Warehouse className="size-3" strokeWidth={2.4} />
      In vault
    </span>
  );
}

/** The one exception worth flagging on the row, in the reference's red chip. */
export function ShipmentAlertChip({ shipment }: { shipment: Shipment }) {
  if (shipment.currentStatus === "shipped") return null;
  if (shipment.currentStatus === "on_hold") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[0.6rem] font-semibold leading-none text-amber-700 dark:text-amber-400">
        <CirclePause className="size-3" strokeWidth={2.4} />
        Held for review
      </span>
    );
  }
  const days = daysUntil(shipment.estimatedDelivery);
  if (days < 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[0.6rem] font-semibold leading-none text-destructive">
        <Clock3 className="size-3" strokeWidth={2.4} />
        {Math.abs(days)} day{Math.abs(days) === 1 ? "" : "s"} late
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[0.6rem] font-semibold leading-none text-amber-700 dark:text-amber-400">
        <Clock3 className="size-3" strokeWidth={2.4} />
        Due today
      </span>
    );
  }
  return null;
}

function Station({
  kicker,
  title,
  lines,
  short,
  marker,
}: {
  kicker: string;
  title: string;
  lines: string[];
  short: string;
  marker: ReactNode;
}) {
  return (
    <li className="relative z-10 flex min-w-0 flex-col items-center text-center">
      <span className="grid size-8 place-items-center rounded-full ring-4 ring-card">
        {marker}
      </span>
      <p className="mt-2.5 hidden text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
        {kicker}
      </p>
      <p className="mt-1 w-full truncate text-[0.72rem] font-semibold leading-4 tracking-[-0.01em] text-ink sm:text-[0.76rem]">
        {title}
      </p>
      <p className="mt-1 w-full truncate text-[0.55rem] leading-4 tabular-nums text-muted-foreground sm:hidden">
        {short}
      </p>
      <p className="mt-1 hidden w-full truncate text-[0.6rem] leading-4 text-muted-foreground sm:block">
        {lines[0]}
      </p>
      <p className="mt-0.5 hidden w-full truncate text-[0.58rem] leading-4 text-muted-foreground/80 sm:block">
        {lines[1]}
      </p>
    </li>
  );
}

/**
 * The consignment route, drawn like a dispatch board: a vault pin, an active
 * marker with waypoint diamonds on the line, and a destination pin — with the
 * two timestamps a client actually looks for under each end.
 */
export function ShipmentRoute({
  shipment,
  className,
}: {
  shipment: Shipment;
  className?: string;
}) {
  const status = shipment.currentStatus;
  const meta = SHIPPING_STATUS_META[status];
  const progress = PROGRESS[status];
  const delivered = status === "shipped";
  const ActiveIcon = STATUS_ICON[status];
  const latest = shipment.statusHistory[shipment.statusHistory.length - 1];
  const releasedAt = shipment.statusHistory[0]?.at;

  return (
    <div className={cn("min-w-0", className)}>
      <ol
        className="relative grid grid-cols-3 items-start gap-1"
        aria-label={`Route for ${shipment.trackingNumber}: ${meta.longLabel}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-4 h-0 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/30"
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-[16.667%] top-4 h-[3px] -translate-y-1/2 rounded-full",
            status === "on_hold"
              ? "bg-amber-500 shadow-[0_2px_7px_-1px_var(--halo)]"
              : "bg-primary shadow-[0_2px_7px_-1px_var(--electric)]",
          )}
          style={{ width: `calc(66.667% * ${progress})` }}
        />
        {[0.25, 0.75].map((point) => (
          <span
            key={point}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-[13px] size-[7px] -translate-x-1/2 rotate-45 rounded-[1px] border",
              point < progress
                ? "border-primary bg-primary"
                : "border-line bg-card",
            )}
            style={{ left: `calc(16.667% + 66.667% * ${point})` }}
          />
        ))}

        <Station
          kicker="Origin"
          title={shipment.origin.city}
          lines={[
            `Vault release - ${stamp(releasedAt)}`,
            `Departure - ${stamp(shipment.dispatchedAt)}`,
          ]}
          short={stamp(releasedAt)}
          marker={
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_var(--electric)]">
              <MapPin className="size-4" strokeWidth={2.4} />
            </span>
          }
        />

        <Station
          kicker="Position"
          title={meta.label}
          lines={[
            `Updated - ${stamp(latest?.at)}`,
            `${shipment.statusHistory.length} recorded event${
              shipment.statusHistory.length === 1 ? "" : "s"
            }`,
          ]}
          short={stamp(latest?.at)}
          marker={
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full",
                ACTIVE_MARKER[status],
              )}
            >
              <ActiveIcon className="size-4" strokeWidth={2.4} />
            </span>
          }
        />

        <Station
          kicker="Destination"
          title={shipment.destination.city}
          lines={[
            `${delivered ? "Delivered" : "Est. delivery"} - ${stamp(
              delivered
                ? (shipment.deliveredAt ?? latest?.at)
                : shipment.estimatedDelivery,
            )}`,
            shipment.destination.country,
          ]}
          short={stamp(
            delivered
              ? (shipment.deliveredAt ?? latest?.at)
              : shipment.estimatedDelivery,
          )}
          marker={
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full border",
                delivered
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-primary/35 bg-card text-primary",
              )}
            >
              <MapPin className="size-4" strokeWidth={2.4} />
            </span>
          }
        />
      </ol>

      <p className="sr-only">
        {shipment.carrier} · {shipment.service} · tracking{" "}
        {shipment.trackingNumber}
      </p>
    </div>
  );
}
