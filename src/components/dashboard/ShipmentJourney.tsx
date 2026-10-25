import { shipmentSignal } from "./shipmentSignal";
import type { RouteEvent, RouteShipment } from "./ShipmentRouteRail";
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { cn } from "@/lib/utils";

/** The route rail owns the consignment shape; these names keep the chips honest. */
export type JourneyShipment = RouteShipment;
export type JourneyEvent = RouteEvent;

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
