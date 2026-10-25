import { convexTest } from "convex-test";
import { v } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../src/convex/schema";
import { internalAction } from "../src/convex/_generated/server";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";

/**
 * Delivery is asynchronous: the mutation queues the message and a scheduled
 * action hands it to the provider. These tests cover the two things that made a
 * missing email impossible to see - the queued message is kept so a retry
 * resends it verbatim, and a delivery that never reports back is surfaced
 * instead of sitting on "queued" for ever - plus the per-consignment read-back
 * the dispatch board uses.
 *
 * Scheduled work is drained with fake timers: the provider action is scheduled
 * through `setTimeout`, so a real-clock drain races it.
 */

type DeliveryAttempt = {
  notificationId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let attempts: DeliveryAttempt[] = [];

const emailRecorder = {
  deliver: internalAction({
    args: {
      notificationId: v.id("notifications"),
      to: v.string(),
      subject: v.string(),
      text: v.string(),
      html: v.optional(v.string()),
    },
    handler: async (_ctx, args) => {
      attempts.push(args as DeliveryAttempt);
      return { delivered: true };
    },
  }),
};

const modules = {
  "../src/convex/_generated/api.js": () =>
    import("../src/convex/_generated/api.js"),
  "../src/convex/minerals.ts": () => import("../src/convex/minerals"),
  "../src/convex/notifications.ts": () => import("../src/convex/notifications"),
  "../src/convex/email.ts": () => Promise.resolve(emailRecorder),
};

const test = () => convexTest(schema, modules);
type Test = ReturnType<typeof test>;

async function seedAdmin(t: Test) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("users", {
        name: "Ada Admin",
        email: "admin@cosmicvault.test",
        role: "admin",
        permissions: ["policies.manage", "settings.manage"],
        status: "active",
      }),
  );
}

async function seedCustomer(t: Test) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("users", {
        name: "Casey Client",
        email: "client@cosmicvault.test",
        role: "customer",
        status: "active",
      }),
  );
}

async function seedCurrency(t: Test) {
  await t.run(
    async (ctx) =>
      await ctx.db.insert("currencies", {
        code: "GBP",
        name: "Pound sterling",
        symbol: "£",
        minorUnits: 2,
        active: true,
      }),
  );
}

function payload(userId: Id<"users">) {
  return {
    mineral: {
      name: "Gold bullion",
      category: "Precious metals",
      quantity: 12.5,
      unit: "kg",
      declaredValue: 25_000_000,
      currency: "GBP",
    },
    policy: {
      policyNumber: "CV-MIN-2026-014",
      provider: "Cosmic Vault Insurance",
      coverage: "cargo_transit" as const,
      coverageLimit: 30_000_000,
      premium: 45_000,
      startDate: "2026-01-01",
      endDate: "2027-01-01",
      status: "active" as const,
    },
    assignment: { mode: "existing" as const, userId },
  };
}

/** Records a consignment on a mineral that is already on file. */
async function bookShipment(
  t: Test,
  admin: Id<"users">,
  mineralId: Id<"minerals">,
) {
  return await t
    .withIdentity({ subject: admin })
    .mutation(api.minerals.createShipment, {
      mineralId,
      shipment: {
        carrier: "Brink's Global Services",
        trackingNumber: "BGS-918273",
        origin: "Zurich, CH",
        destination: "London, GB",
        departureAt: "2026-10-20",
        estimatedArrivalAt: "2026-10-24",
        status: "preparing" as const,
      },
    });
}

async function statusNotification(t: Test) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("notifications").collect();
    return rows.find((row) => row.type === "shipment.status_changed") ?? null;
  });
}

beforeEach(() => {
  attempts = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shipment status email delivery", () => {
  it("keeps the queued message so a retry resends the same email", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: booked.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
        note: "Cleared the vault and loaded onto the armoured convoy.",
      });

    const notification = await statusNotification(t);
    expect(notification).not.toBeNull();
    // The designed message is stored alongside the notification, not only sent.
    expect(notification?.emailSubject).toContain("on its way");
    expect(notification?.emailText).toContain("Gold bullion");
    expect(notification?.emailHtml).toContain("<!doctype html>");
    expect(notification?.emailStatus).toBe("queued");

    // A retry (staff console) must resend that message, not a template.
    await t
      .withIdentity({ subject: admin })
      .mutation(api.notifications.retryEmail, {
        notificationId: notification!._id,
      });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const sent = attempts.filter(
      (attempt) => attempt.notificationId === notification?._id,
    );
    // Once for the status change, once for the retry - the same email both ways.
    expect(sent).toHaveLength(2);
    for (const attempt of sent) {
      expect(attempt).toMatchObject({
        to: "client@cosmicvault.test",
        subject: notification?.emailSubject,
        text: notification?.emailText,
        html: notification?.emailHtml,
      });
    }
  });

  it("reports a delivery that was scheduled but never reported back", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    const now = Date.now();

    const insert = (
      emailStatus: "queued" | "failed" | "skipped",
      ageMs: number,
    ) =>
      t.run(
        async (ctx) =>
          await ctx.db.insert("notifications", {
            userId: client,
            type: "shipment.status_changed",
            title: "Gold bullion is in transit",
            body: "BGS-918273",
            dedupeKey: `test:${emailStatus}:${ageMs}`,
            emailStatus,
            emailAttempts: 0,
            createdAt: now - ageMs,
          }),
      );

    const stalledId = await insert("queued", 10 * 60_000);
    const freshId = await insert("queued", 5_000);
    const retriedId = await insert("failed", 20 * 60_000);

    const issues = await t
      .withIdentity({ subject: admin })
      .query(api.notifications.deliveryIssues, {});

    // A queued row that never got a result is a silent non-delivery; a fresh
    // one is still in flight and must not be reported as a problem.
    expect(issues.stalled.map((row) => row._id)).toEqual([stalledId]);
    expect(issues.stalled.map((row) => row._id)).not.toContain(freshId);
    expect(issues.stalledAfterMinutes).toBe(5);
    expect(issues.failed).toHaveLength(1);

    // An old record that staff retry is queued *now*, so it is not stalled.
    await t
      .withIdentity({ subject: admin })
      .mutation(api.notifications.retryEmail, { notificationId: retriedId });
    const afterRetry = await t
      .withIdentity({ subject: admin })
      .query(api.notifications.deliveryIssues, {});
    expect(afterRetry.stalled.map((row) => row._id)).toEqual([stalledId]);
    expect(afterRetry.failed).toHaveLength(0);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});

describe("consignment delivery log", () => {
  it("reads back each shipment's last attempt and flags a stalled one", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const first = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const second = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(client),
        policy: {
          ...payload(client).policy,
          policyNumber: "CV-MIN-2026-099",
        },
      });
    const firstShipment = await bookShipment(t, admin, first.mineralId);
    const secondShipment = await bookShipment(t, admin, second.mineralId);

    // A status change queues its email immediately, so the row reports "queued".
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: firstShipment.shipmentId,
        status: "in_transit",
      });

    // A send that never reported back is the case staff could not see before:
    // the second consignment's booking email is still "queued" half an hour on.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("notifications").collect();
      const row = rows.find(
        (item) =>
          item.relatedId === secondShipment.shipmentId &&
          item.type === "shipment.created",
      );
      if (!row) throw new Error("Expected the booking email to be queued.");
      await ctx.db.patch(row._id, {
        emailStatus: "queued",
        emailError: undefined,
        emailAttempts: 0,
        emailQueuedAt: Date.now() - 30 * 60_000,
      });
    });

    const log = await t
      .withIdentity({ subject: admin })
      .query(api.minerals.emailLog, {
        shipmentIds: [firstShipment.shipmentId, secondShipment.shipmentId],
      });

    expect(log).toHaveLength(2);
    const queued = log.find(
      (row) => row.shipmentId === firstShipment.shipmentId,
    );
    expect(queued).toMatchObject({ emailStatus: "queued", stalled: false });
    const stalled = log.find(
      (row) => row.shipmentId === secondShipment.shipmentId,
    );
    expect(stalled).toMatchObject({ emailStatus: "queued", stalled: true });

    // The delivery log is the mineral console's, so members cannot read it.
    await expect(
      t.withIdentity({ subject: client }).query(api.minerals.emailLog, {
        shipmentIds: [firstShipment.shipmentId],
      }),
    ).rejects.toThrow(/restricted to staff/i);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("resends a failed consignment's email from the board, once", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: booked.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
      });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    attempts = [];

    // The provider rejected the status email: the row turns amber on the board.
    const failedId = await t.run(async (ctx) => {
      const rows = await ctx.db.query("notifications").collect();
      const row = rows.find(
        (item) =>
          item.relatedId === booked.shipmentId &&
          item.type === "shipment.status_changed",
      )!;
      await ctx.db.patch(row._id, {
        emailStatus: "failed",
        emailError: "Provider rejected the recipient address.",
        emailAttempts: 1,
      });
      return row._id;
    });

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.resendShipmentEmail, {
        shipmentId: booked.shipmentId,
      });
    expect(result.to).toBe("client@cosmicvault.test");
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    // The row's own resend sends the message that failed, branded HTML included.
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      notificationId: failedId,
      to: "client@cosmicvault.test",
    });
    expect(attempts[0]?.html).toContain("<!doctype html>");

    const requeued = await t.run(async (ctx) => await ctx.db.get(failedId));
    expect(requeued?.emailStatus).toBe("queued");
    expect(requeued?.emailError).toBeUndefined();
    // The rejection is kept as history, not reset to look like a first try.
    expect(requeued?.emailAttempts).toBe(1);

    // A send the provider accepted is never repeated by a second click.
    await t.run(
      async (ctx) => await ctx.db.patch(failedId, { emailStatus: "sent" }),
    );
    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.resendShipmentEmail, {
          shipmentId: booked.shipmentId,
        }),
    ).rejects.toThrow(/already accepted/i);

    // Members hold no policies.manage, so the console action is out of reach.
    await expect(
      t
        .withIdentity({ subject: client })
        .mutation(api.minerals.resendShipmentEmail, {
          shipmentId: booked.shipmentId,
        }),
    ).rejects.toThrow(/restricted to staff/i);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});
