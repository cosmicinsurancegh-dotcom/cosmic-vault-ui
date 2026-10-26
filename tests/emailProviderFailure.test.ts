import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../src/convex/schema";
import { api, internal } from "../src/convex/_generated/api";
import { deliveryFailure } from "../src/convex/lib/delivery";

/**
 * The email gateway answers HTTP 2xx even when it refuses a message, carrying
 * its verdict in the body (`data.status: "failed"` plus `data.error`). Trusting
 * the transport code recorded those sends as delivered, so a customer could go
 * without an email while the console showed "sent" and offered no retry. These
 * tests pin both delivery actions to the provider's own answer.
 */

const modules = {
  "../src/convex/_generated/api.js": () =>
    import("../src/convex/_generated/api.js"),
  "../src/convex/email.ts": () => import("../src/convex/email"),
  "../src/convex/notifications.ts": () => import("../src/convex/notifications"),
  "../src/convex/settings.ts": () => import("../src/convex/settings"),
  "../src/convex/shipmentEmails.ts": () => import("../src/convex/shipmentEmails"),
  "../src/convex/shipmentEmailDelivery.ts": () =>
    import("../src/convex/shipmentEmailDelivery"),
  "../src/convex/lib/vly.ts": () => import("../src/convex/lib/vly"),
};

const test = () => convexTest(schema, modules);
type Test = ReturnType<typeof test>;

/** Answers every gateway call with the given body, as a 2xx. */
function gatewayAnswers(body: Record<string, unknown>) {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

/** A notification to deliver, since the action records its result on one. */
async function seedQueuedNotification(t: Test) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Casey Client",
      email: "client@cosmicvault.test",
      role: "customer",
      status: "active",
    }),
  );
  return await t.run((ctx) =>
    ctx.db.insert("notifications", {
      userId,
      type: "shipment.status_changed",
      title: "Gold bullion is in transit",
      body: "SHP-1 · London → Zurich",
      dedupeKey: `shipment.status:test:${userId}`,
      emailStatus: "queued",
      emailAttempts: 0,
      createdAt: Date.now(),
    }),
  );
}

describe("deliveryFailure", () => {
  it("passes a message the gateway accepted", () => {
    expect(deliveryFailure({ success: true, data: { status: "sent" } })).toBeNull();
    expect(
      deliveryFailure({ success: true, data: { status: "queued" } }),
    ).toBeNull();
  });

  it("keeps the reason a 2xx body reports the message as failed", () => {
    expect(
      deliveryFailure({
        success: true,
        data: {
          status: "failed",
          error: "Invalid `to` field. Please use our testing email address.",
        },
      }),
    ).toBe("Invalid `to` field. Please use our testing email address.");
  });

  it("still reads a transport failure", () => {
    expect(
      deliveryFailure({ success: false, error: "Request timeout" }),
    ).toBe("Request timeout");
  });

  it("says so plainly when the provider gives no reason", () => {
    expect(deliveryFailure({ success: true, data: { status: "failed" } })).toBe(
      "Provider rejected the message.",
    );
    expect(deliveryFailure({ success: false })).toBe(
      "Provider rejected the message.",
    );
  });

  it("leaves a 2xx with no verdict as accepted", () => {
    expect(deliveryFailure({ success: true, data: {} })).toBeNull();
    expect(deliveryFailure({ success: true })).toBeNull();
  });
});

describe("notification delivery outcome", () => {
  const originalKey = process.env.VLY_INTEGRATION_KEY;

  beforeEach(() => {
    process.env.VLY_INTEGRATION_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.VLY_INTEGRATION_KEY = originalKey;
  });

  it("records a message a 2xx body calls failed as failed", async () => {
    const t = test();
    const notificationId = await seedQueuedNotification(t);
    gatewayAnswers({
      status: "failed",
      error: "Domain cosmicvault.co is not verified for this project.",
    });

    const result = await t.action(internal.email.deliver, {
      notificationId,
      to: "client@cosmicvault.test",
      subject: "Shipment in transit",
      text: "Hello Casey, your shipment is on its way.",
    });

    expect(result).toEqual({ delivered: false, reason: "provider_error" });
    const stored = await t.run((ctx) => ctx.db.get(notificationId));
    expect(stored).toMatchObject({
      emailStatus: "failed",
      emailAttempts: 1,
      emailError: "Domain cosmicvault.co is not verified for this project.",
    });
  });

  it("records an accepted message as sent", async () => {
    const t = test();
    const notificationId = await seedQueuedNotification(t);
    gatewayAnswers({ id: "msg-1", status: "sent" });

    const result = await t.action(internal.email.deliver, {
      notificationId,
      to: "client@cosmicvault.test",
      subject: "Shipment in transit",
      text: "Hello Casey, your shipment is on its way.",
    });

    expect(result).toEqual({ delivered: true });
    const stored = await t.run((ctx) => ctx.db.get(notificationId));
    expect(stored).toMatchObject({ emailStatus: "sent", emailAttempts: 1 });
    expect(stored?.emailError).toBeUndefined();
  });
});

/** The consignment email has its own delivery audit table. */
describe("consignment email outcome", () => {
  const originalKey = process.env.VLY_INTEGRATION_KEY;

  beforeEach(() => {
    process.env.VLY_INTEGRATION_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.VLY_INTEGRATION_KEY = originalKey;
  });

  const args = {
    memberName: "Casey Client",
    memberEmail: "client@cosmicvault.test",
    mineralName: "Gold bullion",
    mineralType: "bar",
    category: "Precious metals",
    vaultId: "CV-1",
    weightLabel: "12.5 kg",
    trackingNumber: "TRK-1",
    carrier: "Brinks",
    service: "Secure transit",
    origin: "18 Finsbury Circus, London",
    destination: "Bahnhofstrasse 1, Zurich",
    originCity: "London",
    destinationCity: "Zurich",
    estimatedDelivery: Date.UTC(2027, 0, 15),
    status: "in_transit" as const,
    note: "Left the depot",
    updatedAt: Date.UTC(2026, 9, 25),
    events: [{ status: "in_transit" as const, at: Date.UTC(2026, 9, 25) }],
  };

  async function sendAsStaff(t: Test) {
    const admin = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ada Admin",
        email: "admin@cosmicvault.test",
        role: "admin",
        permissions: ["vault.ship", "settings.manage"],
        status: "active",
      }),
    );
    return await t
      .withIdentity({ subject: admin })
      .action(api.shipmentEmailDelivery.sendUpdate, args);
  }

  it("records a message a 2xx body calls failed as failed", async () => {
    const t = test();
    gatewayAnswers({ status: "failed", error: "Recipient address rejected." });

    const result = await sendAsStaff(t);

    expect(result).toEqual({
      deliveryStatus: "failed",
      error: "Recipient address rejected.",
    });
    const [row] = await t.run((ctx) =>
      ctx.db.query("shipmentEmails").collect(),
    );
    expect(row).toMatchObject({
      deliveryStatus: "failed",
      error: "Recipient address rejected.",
    });
    expect(row?.deliveredAt).toBeUndefined();
  });
});
