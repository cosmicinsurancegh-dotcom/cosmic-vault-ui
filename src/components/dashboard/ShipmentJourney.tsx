import { shipmentModeFor } from "./shipmentMode";
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  shipmentStageCount,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { shipmentSignal } from "./shipmentSignal";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

export type JourneyShipment = {
  reference: string;
  carrier: string;
  trackingNumber?: string;
  origin: string;
  destination: string;
  departureAt?: number;
  estimatedArrivalAt?: number;
  status: ShipmentStatus;
  currentLocation?: string;
  lastStatusAt: number;
  createdAt: number;
};

export type JourneyEvent = {
  status: ShipmentStatus;
  location?: string;
  note?: string;
  createdAt: number;
};

const STATUS_CHIP: Record<ShipmentStatus, string> = {
  preparing: "bg-halo/20 text-[#7a5a1c] dark:text-halo",
  in_transit: "bg-primary/10 text-primary dark:text-electric-soft",
  customs_hold: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  out_for_delivery: "bg-primary/10 text-primary dark:text-electric-soft",
  delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  delayed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cancelled: "bg-destructive/10 text-destructive",
};

/** The status chip on a row: a filled dot and tinted label, never a border. */
export function ShipmentStateChip({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-2 py-1 text-[0.6rem] font-semibold leading-none",
        STATUS_CHIP[status],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {SHIPMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function ShipmentSignalChip({
  shipment,
}: {
  shipment: JourneyShipment;
}) {
  const signal = shipmentSignal(shipment);
  if (!signal) return null;
  const { Icon, label, tone } = signal;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-2 py-1 text-[0.6rem] font-semibold leading-none",
        tone,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} />
      {label}
    </span>
  );
}

type Station = {
  key: string;
  kicker: string;
  title: string;
  lines: string[];
  marker: ReactNode;
};

/**
 * The consignment drawn like a dispatch board: release point, live position and
 * destination on one line, with the filled span showing how far it has come.
 */
export function ShipmentRouteRail({
  shipment,
  events,
  className,
}: {
  shipment: JourneyShipment;
  events: JourneyEvent[];
  className?: string;
}) {
  const mode = shipmentModeFor(shipment.carrier);
  const stage = shipmentStageCount(shipment.status);
  const progress = stage / SHIPMENT_STAGES.length;
  const attention = shipmentNeedsAttention(shipment.status);
  const delivered = shipment.status === "delivered";
  const latest = events[0];
  const first = events[events.length - 1];

  const arrival = delivered
    ? shipment.lastStatusAt
    : shipment.estimatedArrivalAt;

  const stations: Station[] = [
    {
      key: "origin",
      kicker: "Origin",
      title: shipment.origin,
      lines: [
        `Released · ${formatDateTime(first?.createdAt ?? shipment.createdAt)}`,
        shipment.departureAt
          ? `Departed · ${formatDateTime(shipment.departureAt)}`
          : "Awaiting departure",
      ],
      marker: (
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_18px_-12px_var(--electric)]">
          <MapPin className="size-4" strokeWidth={2.4} />
        </span>
      ),
    },
    {
      key: "position",
      kicker: "Position",
      title:
        shipment.currentLocation ?? SHIPMENT_STATUS_LABELS[shipment.status],
      lines: [
        `Updated · ${formatDateTime(latest?.createdAt ?? shipment.lastStatusAt)}`,
        events.length > 0
          ? `${events.length} recorded update${events.length === 1 ? "" : "s"}`
          : "",
      ],
      marker: (
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full border",
            attention
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-primary bg-primary text-primary-foreground",
          )}
        >
          <mode.Icon className="size-4" strokeWidth={2.2} />
        </span>
      ),
    },
    {
      key: "destination",
      kicker: "Destination",
      title: shipment.destination,
      lines: [
        arrival
          ? `${delivered ? "Delivered" : "Est. delivery"} · ${formatDateTime(arrival)}`
          : "Awaiting an estimate",
        shipment.carrier,
      ],
      marker: (
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full border bg-card",
            delivered
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-primary/40 text-primary",
          )}
        >
          <MapPin className="size-4" strokeWidth={2.4} />
        </span>
      ),
    },
  ];

  return (
    <ol
      className={cn("relative grid grid-cols-3 items-start gap-1", className)}
      aria-label={`Route from ${shipment.origin} to ${shipment.destination}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-4 h-0 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/25"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-[16.667%] top-4 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-500",
          attention
            ? "bg-amber-500 shadow-[0_2px_7px_-1px_var(--halo)]"
            : "bg-primary shadow-[0_2px_7px_-1px_var(--electric)]",
        )}
        style={{ width: `calc(66.667% * ${progress})` }}
      />
      {[0.34, 0.68].map((point) => (
        <span
          key={point}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-[13px] size-[7px] -translate-x-1/2 rotate-45 rounded-[1px] border",
            point < progress
              ? attention
                ? "border-amber-500 bg-amber-500"
                : "border-primary bg-primary"
              : "border-line bg-card",
          )}
          style={{ left: `calc(16.667% + 66.667% * ${point})` }}
        />
      ))}

      {stations.map((station) => (
        <li
          key={station.key}
          className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center"
        >
          <span className="grid size-8 place-items-center rounded-full ring-4 ring-card">
            {station.marker}
          </span>
          <p className="mt-2.5 text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {station.kicker}
          </p>
          <p className="mt-1 w-full truncate text-[0.78rem] font-semibold leading-4 tracking-[-0.01em] text-ink">
            {station.title}
          </p>
          <p className="mt-1 hidden w-full truncate text-[0.58rem] leading-4 tabular-nums text-muted-foreground sm:block">
            {station.lines[0]}
          </p>
          {station.lines[1] && (
            <p className="mt-0.5 hidden w-full truncate text-[0.56rem] leading-4 text-muted-foreground/75 sm:block">
              {station.lines[1]}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
