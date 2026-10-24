import {
  renderShipmentUpdateEmail,
  type RenderedShipmentEmail,
  type ShipmentEmailEvent,
} from "@/convex/vault/shipmentEmail";
import { SHIPPING_STATUS_META, formatAddress, formatWeight } from "./types";
import type { Mineral, ShippingStatus } from "./types";

/**
 * Bridges the vault model to the shipment-update email. The action arguments
 * are also the preview input, so the console can show exactly what the server
 * will send without a round trip.
 */

export type ShipmentEmailStatus = ShippingStatus;

export type ShipmentEmailActionArgs = {
  memberName: string;
  memberEmail: string;
  mineralName: string;
  mineralType: string;
  category: string;
  vaultId: string;
  weightLabel: string;
  photoPath?: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  estimatedDelivery: number;
  status: ShipmentEmailStatus;
  note?: string;
  updatedAt: number;
  events: ShipmentEmailEvent[];
};

export type ShipmentEmailDelivery = {
  deliveryStatus: "sent" | "failed" | "skipped";
  error: string | null;
};

function photoPath(mineral: Mineral) {
  const first = mineral.photos[0] ?? "";
  return /^\/minerals\/[a-z0-9/_-]+\.(webp|png|jpe?g|svg)$/i.test(first)
    ? first
    : undefined;
}

/**
 * Build the message the member receives for a status change. The store appends
 * the event itself, so the email timeline is built from the history plus the
 * event being published; a preview and a real send therefore match.
 */
export function shipmentEmailArgs(
  mineral: Mineral,
  status: ShippingStatus,
  note: string,
  updatedAt = Date.now(),
): ShipmentEmailActionArgs | null {
  const shipment = mineral.shipping;
  if (!shipment) return null;

  const eventNote = note.trim() || SHIPPING_STATUS_META[status].description;
  const events: ShipmentEmailEvent[] = [
    ...shipment.statusHistory.map((event) => ({
      status: event.status,
      at: event.at,
      note: event.note || undefined,
    })),
    { status, at: updatedAt, note: eventNote },
  ];

  return {
    memberName: mineral.ownerName,
    memberEmail: mineral.ownerEmail,
    mineralName: mineral.name,
    mineralType: mineral.type,
    category: mineral.category,
    vaultId: mineral.vaultId,
    weightLabel: formatWeight(mineral.weight, mineral.unit),
    photoPath: photoPath(mineral),
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    service: shipment.service,
    origin: formatAddress(shipment.origin),
    destination: formatAddress(shipment.destination),
    // The route rail shows the city, not the full street address.
    originCity: shipment.origin.city,
    destinationCity: shipment.destination.city,
    estimatedDelivery: shipment.estimatedDelivery,
    status,
    note: eventNote,
    updatedAt,
    events,
  };
}

export function previewShipmentEmail(
  args: ShipmentEmailActionArgs,
  options: { appOrigin?: string; companyName?: string; supportEmail?: string } = {},
): RenderedShipmentEmail {
  const appOrigin =
    options.appOrigin ??
    (typeof window === "undefined" ? undefined : window.location.origin);

  return renderShipmentUpdateEmail({
    ...args,
    trackingUrl: appOrigin ? `${appOrigin}/dashboard/shipments` : "",
    appOrigin,
    companyName: options.companyName,
    supportEmail: options.supportEmail,
  });
}
