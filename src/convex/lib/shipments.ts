/**
 * Shipment status vocabulary shared by the backend, the notification email and
 * the dashboard. Deliberately dependency-free so the browser bundle can import
 * it without pulling in Convex server code.
 */
export const SHIPMENT_STATUSES = [
  "preparing",
  "in_transit",
  "customs_hold",
  "out_for_delivery",
  "delivered",
  "delayed",
  "cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  preparing: "Preparing",
  in_transit: "In transit",
  customs_hold: "Held at customs",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  delayed: "Delayed",
  cancelled: "Cancelled",
};

export type ShipmentStage = {
  key: string;
  label: string;
};

/** The four milestones a member cares about, in order. */
export const SHIPMENT_STAGES: ShipmentStage[] = [
  { key: "preparing", label: "Preparing" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

/**
 * How many of the four milestones are complete for a status. `customs_hold` and
 * `delayed` sit at the in-transit stage until the shipment moves again.
 */
export function shipmentStageCount(status: ShipmentStatus): number {
  switch (status) {
    case "preparing":
      return 1;
    case "in_transit":
    case "customs_hold":
    case "delayed":
      return 2;
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    case "cancelled":
      return 1;
  }
}

export function shipmentProgress(status: ShipmentStatus): number {
  return Math.round(
    (shipmentStageCount(status) / SHIPMENT_STAGES.length) * 100,
  );
}

/** True when the shipment needs attention rather than celebration. */
export function shipmentNeedsAttention(status: ShipmentStatus): boolean {
  return (
    status === "delayed" || status === "cancelled" || status === "customs_hold"
  );
}
