import { describe, expect, it } from "vitest";
import { vaultRoute } from "@/components/vault/vaultRoute";
import type { Shipment, ShippingStatus } from "@/lib/vault/types";

const RELEASED_AT = Date.UTC(2026, 9, 20, 9, 15);
const MOVED_AT = Date.UTC(2026, 9, 22, 16, 40);
const ETA = Date.UTC(2026, 10, 4);

function shipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    trackingNumber: "BG-7781-02",
    carrier: "Brink's Global Services",
    service: "Secure road · signed delivery",
    origin: {
      name: "London vault",
      line1: "1 Threadneedle Street",
      city: "London",
      postcode: "EC2R 8AY",
      country: "United Kingdom",
    },
    destination: {
      name: "Zurich vault",
      line1: "Bahnhofstrasse 12",
      city: "Zurich",
      postcode: "8001",
      country: "Switzerland",
    },
    estimatedDelivery: ETA,
    currentStatus: "in_transit",
    dispatchedAt: MOVED_AT,
    statusHistory: [
      {
        status: "pending",
        at: RELEASED_AT,
        note: "Authorised by vault operations.",
        actor: "Ops desk",
      },
      {
        status: "in_transit",
        at: MOVED_AT,
        note: "Loaded onto the armoured convoy.",
        actor: "Ops desk",
      },
    ],
    ...overrides,
  };
}

describe("vault route adapter", () => {
  it("feeds the shared rail the consignment's places, stamps and estimate", () => {
    const route = vaultRoute(shipment());

    expect(route.shipment).toMatchObject({
      reference: "BG-7781-02",
      trackingNumber: "BG-7781-02",
      carrier: "Brink's Global Services",
      origin: "London",
      destination: "Zurich",
      departureAt: MOVED_AT,
      estimatedArrivalAt: ETA,
      status: "in_transit",
    });

    // The vault keeps history oldest first; the rail reads the newest first.
    expect(route.events.map((event) => event.createdAt)).toEqual([
      MOVED_AT,
      RELEASED_AT,
    ]);
    expect(route.events[0]).toMatchObject({
      status: "in_transit",
      note: "Loaded onto the armoured convoy.",
    });
    expect(route.shipment.lastStatusAt).toBe(MOVED_AT);
    expect(route.shipment.createdAt).toBe(RELEASED_AT);
  });

  it("maps every vault state onto the rail's tracking vocabulary", () => {
    const expected: Record<ShippingStatus, string> = {
      pending: "preparing",
      in_progress: "preparing",
      on_hold: "customs_hold",
      in_transit: "in_transit",
      shipped: "delivered",
    };

    for (const [state, status] of Object.entries(expected)) {
      const route = vaultRoute(
        shipment({ currentStatus: state as ShippingStatus }),
      );
      expect(route.shipment.status).toBe(status);
    }
  });

  it("falls back to the estimate when nothing has been recorded yet", () => {
    const route = vaultRoute(
      shipment({
        statusHistory: [],
        currentStatus: "pending",
        dispatchedAt: undefined,
      }),
    );

    expect(route.events).toEqual([]);
    expect(route.shipment.lastStatusAt).toBe(ETA);
    expect(route.shipment.createdAt).toBe(ETA);
    expect(route.shipment.departureAt).toBeUndefined();
  });
});
