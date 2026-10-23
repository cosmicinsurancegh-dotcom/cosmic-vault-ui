import type { Shipment } from "@/lib/vault/types";
import { Plane, Ship, Truck } from "lucide-react";

/** Road, air or sea — picked from the carrier service line. */
export function shipmentMode(shipment: Shipment) {
  const service = shipment.service.toLowerCase();
  if (service.includes("air")) return { Icon: Plane, label: "Air freight" };
  if (service.includes("sea") || service.includes("ocean")) {
    return { Icon: Ship, label: "Sea freight" };
  }
  return { Icon: Truck, label: "Road freight" };
}
