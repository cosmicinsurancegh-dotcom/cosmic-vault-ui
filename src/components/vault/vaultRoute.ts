import type {
  RouteEvent,
  RouteShipment,
} from "@/components/dashboard/ShipmentRouteRail";
import type {
  Shipment,
  ShipmentEvent,
  ShippingStatus,
} from "@/lib/vault/types";

/**
 * The vault desk records five shipping states; the route rail speaks the
 * tracking vocabulary the rest of the platform uses. Both preparation states
 * sit at the origin, a hold reads as customs attention, and "shipped" is the
 * delivered end of the line.
 */
const RAIL_STATUS: Record<ShippingStatus, RouteShipment["status"]> = {
  pending: "preparing",
  in_progress: "preparing",
  on_hold: "customs_hold",
  in_transit: "in_transit",
  shipped: "delivered",
};

function toRouteEvent(event: ShipmentEvent): RouteEvent {
  return {
    status: RAIL_STATUS[event.status],
    note: event.note,
    createdAt: event.at,
  };
}

/**
 * Adapt a vault consignment to the shared route rail. The vault keeps its
 * history oldest first; the rail reads the newest entry as the live position.
 */
export function vaultRoute(shipment: Shipment) {
  const history = shipment.statusHistory;
  const events = [...history].reverse().map(toRouteEvent);
  const latest = events[0];
  const first = events[events.length - 1];

  const route: RouteShipment = {
    reference: shipment.trackingNumber,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    origin: shipment.origin.city,
    destination: shipment.destination.city,
    departureAt: shipment.dispatchedAt,
    estimatedArrivalAt: shipment.estimatedDelivery,
    status: RAIL_STATUS[shipment.currentStatus],
    lastStatusAt: latest?.createdAt ?? shipment.estimatedDelivery,
    createdAt: first?.createdAt ?? shipment.estimatedDelivery,
  };

  return { shipment: route, events };
}
