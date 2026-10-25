import { StatusPill } from "./PlatformUI";
import { shipmentSignal } from "./shipmentSignal";
import type { RouteEvent, RouteShipment } from "./ShipmentRouteRail";
import type { ShipmentStatus } from "@/convex/lib/shipments";
import { cn } from "@/lib/utils";

/** The route rail owns the consignment shape; these names keep the board honest. */
export type JourneyShipment = RouteShipment;
export type JourneyEvent = RouteEvent;

/**
 * The status on a consignment row. It is the same dot-and-label the rest of the
 * dashboard uses, so a status never looks like a different kind of thing.
 */
export function ShipmentStateChip({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  return <StatusPill status={status} className={className} />;
}

/** The exception beside the status: an icon and a tinted word, no box. */
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
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.62rem] font-medium",
        tone,
      )}
    >
      <Icon className="size-3" strokeWidth={2.4} />
      {label}
    </span>
  );
}
