import type { JourneyShipment } from "./ShipmentJourney";
import { daysUntil } from "@/lib/format";
import { AlertTriangle, CircleCheck, CircleX, Clock3 } from "lucide-react";
import type { ComponentType } from "react";

export type ShipmentSignal = {
  label: string;
  tone: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const SUCCESS = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
const WARNING = "bg-amber-500/10 text-amber-700 dark:text-amber-400";
const DANGER = "bg-destructive/10 text-destructive";

/**
 * The one exception worth flagging next to the status, read from the record
 * rather than invented: a customs hold, a late ETA, or the signature that ends
 * the journey.
 */
export function shipmentSignal(
  shipment: JourneyShipment,
): ShipmentSignal | null {
  if (shipment.status === "cancelled") {
    return { label: "Cancelled", tone: DANGER, Icon: CircleX };
  }
  if (shipment.status === "delivered") {
    return { label: "Signed for", tone: SUCCESS, Icon: CircleCheck };
  }
  if (shipment.status === "customs_hold") {
    return { label: "Held at customs", tone: WARNING, Icon: AlertTriangle };
  }
  if (shipment.status === "delayed") {
    const days = shipment.estimatedArrivalAt
      ? daysUntil(shipment.estimatedArrivalAt)
      : 0;
    return {
      label:
        days < 0
          ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`
          : "Delayed",
      tone: DANGER,
      Icon: AlertTriangle,
    };
  }
  if (shipment.status === "out_for_delivery") {
    return { label: "Out with courier", tone: SUCCESS, Icon: Clock3 };
  }
  if (shipment.estimatedArrivalAt) {
    const days = daysUntil(shipment.estimatedArrivalAt);
    if (days < 0) {
      return {
        label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`,
        tone: DANGER,
        Icon: AlertTriangle,
      };
    }
    if (days === 0) {
      return { label: "Due today", tone: WARNING, Icon: Clock3 };
    }
  }
  return null;
}
