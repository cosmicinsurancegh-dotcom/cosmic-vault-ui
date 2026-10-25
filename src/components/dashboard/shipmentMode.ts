import { Plane, Ship, Truck } from "lucide-react";
import type { ComponentType } from "react";

export type ShipmentMode = {
  key: "road" | "air" | "sea";
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const SEA =
  /sea|marine|maritime|ocean|shipping line|maersk|hapag|msc\b|evergreen/;
const AIR = /air|aviation|airline|cargo jet|sky/;

/**
 * Consignments record the carrier, not the mode of transport, so the mode is
 * read from the carrier's own name. Anything unrecognised is a road courier,
 * which is what the vault's bonded carriers are.
 */
export function shipmentModeFor(carrier: string): ShipmentMode {
  const value = carrier.toLowerCase();
  if (SEA.test(value)) return { key: "sea", label: "Sea freight", Icon: Ship };
  if (AIR.test(value)) return { key: "air", label: "Air freight", Icon: Plane };
  return { key: "road", label: "Road freight", Icon: Truck };
}
