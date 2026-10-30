import { convexTest } from "convex-test";
import { v } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../src/convex/schema";
import { internalAction } from "../src/convex/_generated/server";
import { api, internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  renderAssignmentEmail,
  renderShipmentStatusEmail,
} from "../src/convex/lib/shipmentEmail";

/**
 * The delivery adapter is an action that runs a mutation internally. convex-test
 * cannot nest that transaction inside a scheduled action, so the integration is
 * replaced by a no-op here; the email body itself is covered by the template
 * tests below and delivery state is covered by the adapter's own code path.
 */
const emailStub = {
  deliver: internalAction({
    args: {
      notificationId: v.id("notifications"),
      to: v.string(),
      subject: v.string(),
      text: v.string(),
      html: v.optional(v.string()),
    },
    handler: async () => ({ delivered: true }),
  }),
};

const modules = {
  "../src/convex/_generated/api.js": () =>
    import("../src/convex/_generated/api.js"),
  "../src/convex/minerals.ts": () => import("../src/convex/minerals"),
  "../src/convex/email.ts": () => Promise.resolve(emailStub),
  /* The member-facing records a mineral issues are only meaningful if the
     dashboard pages that read them can see them, so the queries they use are
     part of this suite. */
  "../src/convex/applications.ts": () => import("../src/convex/applications"),
  "../src/convex/documents.ts": () => import("../src/convex/documents"),
  "../src/convex/maintenance.ts": () => import("../src/convex/maintenance"),
  "../src/convex/payments.ts": () => import("../src/convex/payments"),
  "../src/convex/policies.ts": () => import("../src/convex/policies"),
  "../src/convex/products.ts": () => import("../src/convex/products"),
  "../src/convex/reports.ts": () => import("../src/convex/reports"),
  "../src/convex/settings.ts": () => import("../src/convex/settings"),
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
        permissions: ["policies.manage", "customers.view"],
        status: "active",
      }),
  );
}

async function seedCustomer(t: Test, email = "client@cosmicvault.test") {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("users", {
        name: "Casey Client",
        email,
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

function payload(userId?: Id<"users">) {
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
    assignment: userId
      ? { mode: "existing" as const, userId }
      : { mode: "existing" as const },
  };
}

/** Records a consignment on a mineral that is already on file. */
async function bookShipment(
  t: Test,
  admin: Id<"users">,
  mineralId: Id<"minerals">,
  overrides: Record<string, unknown> = {},
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
        ...overrides,
      },
    });
}

describe("minerals and shipments", () => {
  it("records a mineral and its policy without booking a shipment", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    // The notification queues an email through the scheduled adapter.
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(result.mineralId),
      cover: await ctx.db.get(result.coverId),
      shipments: await ctx.db.query("shipments").collect(),
      events: await ctx.db.query("shipmentEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(stored.mineral).toMatchObject({
      name: "Gold bullion",
      category: "Precious metals",
      declaredValue: 25_000_000,
      currency: "GBP",
      assignedUserId: client,
      status: "active",
    });
    expect(stored.mineral?.reference).toMatch(/^MIN-/);
    expect(stored.cover).toMatchObject({
      policyNumber: "CV-MIN-2026-014",
      coverage: "cargo_transit",
      coverageLimit: 30_000_000,
      currency: "GBP",
      status: "active",
    });
    // Nothing is moving until a request is worked or staff book a consignment.
    expect(stored.shipments).toHaveLength(0);
    expect(stored.events).toHaveLength(0);
    expect(stored.notifications).toHaveLength(1);
    expect(stored.notifications[0]).toMatchObject({
      userId: client,
      type: "mineral.assigned",
      emailStatus: "queued",
      href: "/dashboard/minerals",
    });
    expect(stored.notifications[0].body).toContain("request a shipment");

    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].shipment).toBeNull();
    expect(mine[0].request).toBeNull();
    expect(mine[0].policy?.policyNumber).toBe("CV-MIN-2026-014");
  });

  it("books a shipment on an existing mineral and emails its owner", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    const booked = await bookShipment(t, admin, created.mineralId);
    await t.finishAllScheduledFunctions(() => {});

    expect(booked.notified).toBe(true);
    const stored = await t.run(async (ctx) => ({
      shipment: await ctx.db.get(booked.shipmentId),
      events: await ctx.db.query("shipmentEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));

    expect(stored.shipment).toMatchObject({
      mineralId: created.mineralId,
      carrier: "Brink's Global Services",
      origin: "Zurich, CH",
      destination: "London, GB",
      status: "preparing",
      assignedUserId: client,
      createdBy: admin,
    });
    expect(stored.shipment?.reference).toMatch(/^SHP-/);
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0]).toMatchObject({
      shipmentId: booked.shipmentId,
      status: "preparing",
    });

    const email = stored.notifications.find(
      (notification) => notification.type === "shipment.created",
    );
    expect(email).toMatchObject({
      userId: client,
      emailStatus: "queued",
      href: "/dashboard/minerals",
    });
    expect(email?.emailText).toContain("Brink's Global Services");

    const audit = stored.audit.find(
      (entry) => entry.action === "mineral.shipment_created",
    );
    expect(audit?.entityId).toBe(booked.shipmentId);

    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].shipment?._id).toBe(booked.shipmentId);
    expect(mine[0].policy?.policyNumber).toBe("CV-MIN-2026-014");
  });

  it("creates a member account from an email address when none exists", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    await seedCurrency(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(),
        assignment: {
          mode: "new" as const,
          newUser: { name: "Morgan New", email: "Morgan@Example.test" },
        },
      });

    expect(result.isNewAccount).toBe(true);
    const created = await t.run(async (ctx) => ({
      user: await ctx.db.get(result.assignedUserId),
      profile: await ctx.db
        .query("customerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", result.assignedUserId))
        .unique(),
    }));

    expect(created.user).toMatchObject({
      name: "Morgan New",
      email: "morgan@example.test",
      role: "customer",
      status: "active",
      isAnonymous: false,
    });
    // The verified marker is what lets Convex Auth link the invitation to the
    // account created on first sign-in.
    expect(created.user?.emailVerificationTime).toBeTypeOf("number");
    expect(created.profile?.email).toBe("morgan@example.test");
  });

  it("reuses an existing account instead of duplicating it", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    await seedCurrency(t);

    await t.withIdentity({ subject: admin }).mutation(api.minerals.create, {
      ...payload(),
      assignment: {
        mode: "new" as const,
        newUser: { name: "Casey Client", email: "client@cosmicvault.test" },
      },
    });

    const first = await t.run(
      async (ctx) => await ctx.db.query("users").collect(),
    );
    expect(first).toHaveLength(2);

    const second = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(),
        policy: { ...payload().policy, policyNumber: "CV-MIN-2026-015" },
        assignment: {
          mode: "new" as const,
          newUser: { name: "Casey Client", email: "CLIENT@cosmicvault.test" },
        },
      });

    const after = await t.run(
      async (ctx) => await ctx.db.query("users").collect(),
    );
    expect(after).toHaveLength(2);
    expect(second.isNewAccount).toBe(false);
  });

  it("emails the assigned member on every shipment status change", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: booked.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
        note: "Cleared the vault and loaded onto the armoured convoy.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result.notified).toBe(true);
    const stored = await t.run(async (ctx) => ({
      shipment: await ctx.db.get(booked.shipmentId),
      events: await ctx.db.query("shipmentEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(stored.shipment).toMatchObject({
      status: "in_transit",
      currentLocation: "Basel, CH",
      updatedBy: admin,
    });
    expect(stored.events).toHaveLength(2);
    expect(stored.events.map((event) => event.status).sort()).toEqual([
      "in_transit",
      "preparing",
    ]);
    const update = stored.notifications.find(
      (notification) => notification.type === "shipment.status_changed",
    );
    expect(update).toMatchObject({
      userId: client,
      emailStatus: "queued",
      href: "/dashboard/minerals",
    });
    expect(update?.title).toContain("in transit");
    expect(update?.dedupeKey).toContain(result.eventId);

    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].events[0].status).toBe("in_transit");
    expect(mine[0].shipment?.currentLocation).toBe("Basel, CH");
  });

  it("moves the estimated delivery date with a status change", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    const nextEta = Date.UTC(2027, 0, 15);
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: booked.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
        estimatedArrivalAt: nextEta,
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(
      async (ctx) => await ctx.db.get(booked.shipmentId),
    );
    expect(stored?.estimatedArrivalAt).toBe(nextEta);

    // The member sees the new date on the tracking desk.
    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].shipment?.estimatedArrivalAt).toBe(nextEta);

    // An estimate before departure is refused, so the history stays coherent.
    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.updateShipmentStatus, {
          shipmentId: booked.shipmentId,
          status: "customs_hold",
          estimatedArrivalAt: Date.UTC(2020, 5, 1),
        }),
    ).rejects.toThrow(/after departure/i);
  });

  it("clears a delivery estimate that no longer applies", async () => {
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
        status: "customs_hold",
        note: "Carrier withdrew the sailing; the date is being re-planned.",
        estimatedArrivalAt: null,
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      shipment: await ctx.db.get(booked.shipmentId),
    }));
    // The field is gone, not left holding the old date.
    expect(stored.shipment?.estimatedArrivalAt).toBeUndefined();
    expect(stored.shipment).toMatchObject({
      status: "customs_hold",
      origin: "Zurich, CH",
    });

    // The audit entry records the removal distinctly from an untouched date.
    const audit = await t.run(
      async (ctx) => await ctx.db.query("auditLogs").collect(),
    );
    const change = audit.find(
      (entry) => entry.action === "shipment.status_changed",
    );
    expect(change?.before.estimatedArrivalAt).toBe(Date.UTC(2026, 9, 24));
    expect(change?.after.estimatedArrivalAt).toBeNull();

    // The member's desk now holds no estimate rather than a stale one.
    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].shipment?.estimatedArrivalAt).toBeUndefined();
  });

  it("rejects a status change that changes nothing", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.updateShipmentStatus, {
          shipmentId: booked.shipmentId,
          status: "preparing",
        }),
    ).rejects.toThrow(/already preparing/i);
  });

  it("keeps the module staff-only and the member view scoped", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    const other = await seedCustomer(t, "other@cosmicvault.test");
    await seedCurrency(t);

    await expect(
      t
        .withIdentity({ subject: client })
        .mutation(api.minerals.create, payload()),
    ).rejects.toThrow(/restricted to staff/i);

    await expect(
      t.withIdentity({ subject: client }).query(api.minerals.list, {}),
    ).rejects.toThrow(/restricted to staff/i);

    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    expect(
      await t.withIdentity({ subject: other }).query(api.minerals.mine, {}),
    ).toHaveLength(0);
  });

  it("refuses to assign a mineral to a staff account or reuse a policy number", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.create, payload(admin)),
    ).rejects.toThrow(/customer or broker/i);

    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.create, payload(client)),
    ).rejects.toThrow(/policy with that number/i);
  });
});

describe("shipment requests", () => {
  it("lets a member ask for a shipment and tells the logistics desk", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
        preferredDate: "2026-11-02",
        notes: "Deliver to the Zurich vault, please.",
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));

    expect(stored.request).toMatchObject({
      mineralId: created.mineralId,
      customerUserId: client,
      destination: "Zurich, CH",
      notes: "Deliver to the Zurich vault, please.",
      status: "pending",
    });
    expect(stored.request?.preferredDate).toBe(Date.UTC(2026, 10, 2));

    const notice = stored.notifications.find(
      (notification) => notification.type === "shipment.requested",
    );
    expect(notice).toMatchObject({
      userId: admin,
      emailStatus: "queued",
      href: "/dashboard/admin/shipments",
      relatedId: requestId,
    });
    expect(notice?.body).toContain("Zurich, CH");

    expect(
      stored.audit.some((entry) => entry.action === "shipment.requested"),
    ).toBe(true);

    // The member sees the open request against the mineral.
    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].request).toMatchObject({
      status: "pending",
      destination: "Zurich, CH",
    });

    const queue = await t
      .withIdentity({ subject: admin })
      .query(api.minerals.shipmentRequests, { status: "pending" });
    expect(queue).toHaveLength(1);
    expect(queue[0].request._id).toBe(requestId);
    expect(queue[0].mineral?._id).toBe(created.mineralId);
    expect(queue[0].requester?.email).toBe("client@cosmicvault.test");
  });

  it("refuses a duplicate request, an in-flight shipment and another vault", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });

    await expect(
      t
        .withIdentity({ subject: client })
        .mutation(api.minerals.requestShipment, {
          mineralId: created.mineralId,
          destination: "Basel, CH",
        }),
    ).rejects.toThrow(/already awaiting review/i);

    // Staff and other members can never request against this mineral.
    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.requestShipment, {
          mineralId: created.mineralId,
          destination: "Zurich, CH",
        }),
    ).rejects.toThrow(/customers and brokers/i);

    const other = await seedCustomer(t, "other@cosmicvault.test");
    await expect(
      t
        .withIdentity({ subject: other })
        .mutation(api.minerals.requestShipment, {
          mineralId: created.mineralId,
          destination: "Zurich, CH",
        }),
    ).rejects.toThrow(/not in your vault/i);

    await expect(
      t.withIdentity({ subject: client }).query(api.minerals.shipmentRequests, {
        status: "pending",
      }),
    ).rejects.toThrow(/restricted to staff/i);

    // A consignment in flight blocks a new request until it is delivered.
    const second = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(client),
        policy: { ...payload().policy, policyNumber: "CV-MIN-2026-777" },
      });
    await bookShipment(t, admin, second.mineralId);
    await expect(
      t
        .withIdentity({ subject: client })
        .mutation(api.minerals.requestShipment, {
          mineralId: second.mineralId,
          destination: "Zurich, CH",
        }),
    ).rejects.toThrow(/shipment in progress/i);

    // A preferred date in the past is not a plan the desk can keep.
    const third = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(client),
        policy: { ...payload().policy, policyNumber: "CV-MIN-2026-778" },
      });
    await expect(
      t
        .withIdentity({ subject: client })
        .mutation(api.minerals.requestShipment, {
          mineralId: third.mineralId,
          destination: "Zurich, CH",
          preferredDate: "2020-01-01",
        }),
    ).rejects.toThrow(/today or a later/i);
  });

  it("books the requested shipment, emails the owner and clears the queue", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
        preferredDate: "2026-11-02",
      });

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.fulfilShipmentRequest, {
        requestId,
        shipment: {
          carrier: "Malca-Amit",
          trackingNumber: "MA-55120",
          origin: "London, GB",
          destination: "Zurich, CH",
          departureAt: "2026-11-03",
          estimatedArrivalAt: "2026-11-05",
          status: "preparing",
          currentLocation: "London vault",
          notes: "Booked as requested.",
        },
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result.notified).toBe(true);
    const stored = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      shipment: await ctx.db.get(result.shipmentId),
      events: await ctx.db.query("shipmentEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));

    expect(stored.request).toMatchObject({
      status: "approved",
      shipmentId: result.shipmentId,
      decidedBy: admin,
    });
    expect(stored.request?.decidedAt).toBeTypeOf("number");
    expect(stored.shipment).toMatchObject({
      carrier: "Malca-Amit",
      origin: "London, GB",
      destination: "Zurich, CH",
      status: "preparing",
      assignedUserId: client,
    });
    expect(stored.events).toHaveLength(1);
    expect(stored.events[0].note).toMatch(/member's request/i);

    const email = stored.notifications.find(
      (notification) => notification.type === "shipment.created",
    );
    expect(email).toMatchObject({ userId: client, emailStatus: "queued" });
    expect(
      stored.audit.some(
        (entry) => entry.action === "shipment.request_approved",
      ),
    ).toBe(true);

    // The member sees the booked consignment against the approved request.
    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine[0].request?.status).toBe("approved");
    expect(mine[0].shipment?._id).toBe(result.shipmentId);

    // The queue no longer holds it, and it cannot be decided twice.
    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.shipmentRequests, { status: "pending" }),
    ).toHaveLength(0);
    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.fulfilShipmentRequest, {
          requestId,
          shipment: {
            carrier: "Malca-Amit",
            origin: "London, GB",
            destination: "Zurich, CH",
            status: "preparing",
          },
        }),
    ).rejects.toThrow(/already been decided/i);
  });

  it("declines a request with a reason the member is sent", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.declineShipmentRequest, {
          requestId,
          note: "   ",
        }),
    ).rejects.toThrow(/reason is required/i);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.declineShipmentRequest, {
        requestId,
        note: "Cover lapsed before the requested date.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result.notified).toBe(true);
    const stored = await t.run(async (ctx) => ({
      request: await ctx.db.get(requestId),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));
    expect(stored.request).toMatchObject({
      status: "declined",
      decisionNote: "Cover lapsed before the requested date.",
      decidedBy: admin,
    });

    const notice = stored.notifications.find(
      (notification) => notification.type === "shipment.request_declined",
    );
    expect(notice).toMatchObject({ userId: client, emailStatus: "queued" });
    expect(notice?.body).toContain("Cover lapsed");

    expect(
      stored.audit.some(
        (entry) => entry.action === "shipment.request_declined",
      ),
    ).toBe(true);

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.fulfilShipmentRequest, {
          requestId,
          shipment: {
            carrier: "Malca-Amit",
            origin: "London, GB",
            destination: "Zurich, CH",
            status: "preparing",
          },
        }),
    ).rejects.toThrow(/already been decided/i);
  });

  it("answers an open request when staff book a shipment directly", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });

    const booked = await bookShipment(t, admin, created.mineralId, {
      destination: "Zurich, CH",
    });
    await t.finishAllScheduledFunctions(() => {});

    expect(booked.requestId).toBe(requestId);
    const stored = await t.run(async (ctx) => await ctx.db.get(requestId));
    expect(stored).toMatchObject({
      status: "approved",
      shipmentId: booked.shipmentId,
      decidedBy: admin,
    });
    expect(stored?.decisionNote).toMatch(/directly/i);
  });

  it("keeps answered requests in the member's history, newest first", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    const declined = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.declineShipmentRequest, {
        requestId: declined.requestId,
        note: "Cover lapsed before that date.",
      });

    const approved = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Basel, CH",
      });
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.fulfilShipmentRequest, {
        requestId: approved.requestId,
        shipment: {
          carrier: "Malca-Amit",
          origin: "London, GB",
          destination: "Basel, CH",
          status: "preparing",
        },
      });
    await t.finishAllScheduledFunctions(() => {});

    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    // The answered requests stay on the record instead of being replaced by the
    // latest one, so the member can see what happened to each ask.
    expect(mine[0].requests.map((entry) => entry.status)).toEqual([
      "approved",
      "declined",
    ]);
    expect(mine[0].request?.status).toBe("approved");
    expect(mine[0].requests[1].decisionNote).toContain("Cover lapsed");
    expect(mine[0].requests[0].shipmentId).toBe(mine[0].shipment?._id);
  });

  it("carries the same request history into the staff register", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    const declined = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.declineShipmentRequest, {
        requestId: declined.requestId,
        note: "Cover lapsed before that date.",
      });

    const approved = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Basel, CH",
      });
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.fulfilShipmentRequest, {
        requestId: approved.requestId,
        shipment: {
          carrier: "Malca-Amit",
          origin: "London, GB",
          destination: "Basel, CH",
          status: "preparing",
        },
      });
    await t.finishAllScheduledFunctions(() => {});

    /* The dispatch board reads the register, so it must carry the same trail
       the member sees - otherwise staff cannot explain an earlier decline. */
    const rows = await t
      .withIdentity({ subject: admin })
      .query(api.minerals.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].requests.map((entry) => entry.status)).toEqual([
      "approved",
      "declined",
    ]);
    expect(rows[0].request?._id).toBe(approved.requestId);
    expect(rows[0].requests[0].shipmentId).toBe(rows[0].shipment?._id);
    expect(rows[0].requests[1].decisionNote).toContain("Cover lapsed");
  });

  it("closes a request the mineral can no longer answer when it changes owner", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    const newOwner = await seedCustomer(t, "new-owner@cosmicvault.test");
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.minerals.requestShipment, {
        mineralId: created.mineralId,
        destination: "Zurich, CH",
      });

    await t.withIdentity({ subject: admin }).mutation(api.minerals.reassign, {
      mineralId: created.mineralId,
      assignment: { mode: "existing" as const, userId: newOwner },
    });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => await ctx.db.get(requestId));
    expect(stored).toMatchObject({ status: "declined", decidedBy: admin });
    expect(stored?.decisionNote).toMatch(/moved to another account/i);

    // The queue is clear, and the new owner can ask for their own shipment.
    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.shipmentRequests, { status: "pending" }),
    ).toHaveLength(0);
    await expect(
      t
        .withIdentity({ subject: newOwner })
        .mutation(api.minerals.requestShipment, {
          mineralId: created.mineralId,
          destination: "London, GB",
        }),
    ).resolves.toHaveProperty("requestId");
  });

  it("refuses a second consignment while one is still moving", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    await bookShipment(t, admin, created.mineralId);

    await expect(bookShipment(t, admin, created.mineralId)).rejects.toThrow(
      /shipment in progress/i,
    );

    // Once the consignment is closed the mineral can move again.
    const booked = await t.run(async (ctx) => {
      const [row] = await ctx.db.query("shipments").collect();
      if (!row) throw new Error("Expected a booked shipment.");
      return row;
    });
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: booked._id,
        status: "delivered",
      });

    const next = await bookShipment(t, admin, created.mineralId);
    expect(next.shipmentId).not.toBe(booked._id);
  });
});

describe("reassigning minerals and shipments", () => {
  it("moves the mineral and all of its shipments to another member", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const previousOwner = await seedCustomer(t);
    const newOwner = await seedCustomer(t, "new-owner@cosmicvault.test");
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(previousOwner));
    const booked = await bookShipment(t, admin, created.mineralId);

    // A second consignment on the same mineral must follow the owner too.
    const secondShipment = await t.run(
      async (ctx) =>
        await ctx.db.insert("shipments", {
          mineralId: created.mineralId,
          reference: "SHP-SECOND",
          carrier: "Malca-Amit",
          origin: "London, GB",
          destination: "Zurich, CH",
          status: "preparing",
          assignedUserId: previousOwner,
          createdBy: admin,
          lastStatusAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
    );

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: { mode: "existing" as const, userId: newOwner },
        note: "Recorded against the wrong client.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result).toMatchObject({
      assignedUserId: newOwner,
      previousUserId: previousOwner,
      isNewAccount: false,
      notified: true,
    });
    expect(result.shipmentIds.sort()).toEqual(
      [booked.shipmentId, secondShipment].sort(),
    );

    const stored = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      shipments: await ctx.db.query("shipments").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(stored.mineral).toMatchObject({
      assignedUserId: newOwner,
      assignedBy: admin,
    });
    expect(stored.shipments).toHaveLength(2);
    expect(
      stored.shipments.every(
        (shipment) => shipment.assignedUserId === newOwner,
      ),
    ).toBe(true);

    const audit = stored.audit.find(
      (entry) => entry.action === "mineral.reassigned",
    );
    expect(audit).toMatchObject({
      entityId: created.mineralId,
      actorId: admin,
      reason: "Recorded against the wrong client.",
      before: { assignedUserId: previousOwner },
      after: { assignedUserId: newOwner, newAccount: false },
    });

    const assignmentEmail = stored.notifications.find(
      (notification) =>
        notification.userId === newOwner &&
        notification.type === "mineral.assigned",
    );
    expect(assignmentEmail).toMatchObject({
      emailStatus: "queued",
      href: "/dashboard/minerals",
    });

    const notice = stored.notifications.find(
      (notification) =>
        notification.userId === previousOwner &&
        notification.type === "mineral.unassigned",
    );
    expect(notice).toMatchObject({ emailStatus: "skipped" });
    expect(notice?.title).toContain("moved to another account");

    const newOwnersVault = await t
      .withIdentity({ subject: newOwner })
      .query(api.minerals.mine, {});
    expect(newOwnersVault).toHaveLength(1);
    expect(newOwnersVault[0].mineral._id).toBe(created.mineralId);
    expect(stored.shipments.map((shipment) => shipment.reference)).toContain(
      newOwnersVault[0].shipment?.reference,
    );

    const previousOwnersVault = await t
      .withIdentity({ subject: previousOwner })
      .query(api.minerals.mine, {});
    expect(previousOwnersVault).toHaveLength(0);
  });

  it("creates or reuses the receiving account from an email address", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const previousOwner = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(previousOwner));

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: {
          mode: "new" as const,
          newUser: { name: "Rae Receiver", email: "Rae@Example.test" },
        },
      });

    expect(result.isNewAccount).toBe(true);
    const createdUser = await t.run(
      async (ctx) => await ctx.db.get(result.assignedUserId),
    );
    expect(createdUser).toMatchObject({
      name: "Rae Receiver",
      email: "rae@example.test",
      role: "customer",
    });

    const second = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...payload(previousOwner),
        policy: { ...payload().policy, policyNumber: "CV-MIN-2026-099" },
      });
    const reused = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.reassign, {
        mineralId: second.mineralId,
        assignment: {
          mode: "new" as const,
          newUser: { name: "Rae Receiver", email: "RAE@example.test" },
        },
      });
    expect(reused.isNewAccount).toBe(false);
    expect(reused.assignedUserId).toBe(result.assignedUserId);
  });

  it("guards ownership, roles and no-op moves", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    const other = await seedCustomer(t, "other@cosmicvault.test");
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: { mode: "existing" as const, userId: client },
      }),
    ).rejects.toThrow(/already assigned/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: { mode: "existing" as const, userId: admin },
      }),
    ).rejects.toThrow(/customer or broker/i);

    await expect(
      t.withIdentity({ subject: other }).mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: { mode: "existing" as const, userId: other },
      }),
    ).rejects.toThrow(/restricted to staff/i);
  });
});

describe("minerals for a customer record", () => {
  it("lists only that customer's minerals with their policy and shipment", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    const other = await seedCustomer(t, "other@cosmicvault.test");
    await seedCurrency(t);

    const first = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, first.mineralId);
    await t.withIdentity({ subject: admin }).mutation(api.minerals.create, {
      ...payload(other),
      policy: { ...payload().policy, policyNumber: "CV-MIN-2026-200" },
    });

    await expect(
      t
        .withIdentity({ subject: client })
        .query(api.minerals.forOwner, { userId: client }),
    ).rejects.toThrow(/restricted to staff/i);

    const rows = await t
      .withIdentity({ subject: admin })
      .query(api.minerals.forOwner, { userId: client });
    expect(rows).toHaveLength(1);
    expect(rows[0].mineral._id).toBe(first.mineralId);
    expect(rows[0].policy?.policyNumber).toBe("CV-MIN-2026-014");
    expect(rows[0].shipment?._id).toBe(booked.shipmentId);
    expect(rows[0].shipments).toHaveLength(1);

    await t.withIdentity({ subject: admin }).mutation(api.minerals.reassign, {
      mineralId: first.mineralId,
      assignment: { mode: "existing" as const, userId: other },
    });

    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.forOwner, { userId: client }),
    ).toHaveLength(0);
    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.forOwner, { userId: other }),
    ).toHaveLength(2);
  });
});

describe("unassigned minerals", () => {
  it("offers only ownerless minerals and attaches one to the customer", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    // Detach the record so it becomes an attach candidate on a customer page.
    await t.run(async (ctx) => {
      await ctx.db.patch(created.mineralId, { assignedUserId: undefined });
      const shipments = await ctx.db
        .query("shipments")
        .withIndex("by_mineral", (q) => q.eq("mineralId", created.mineralId))
        .collect();
      for (const shipment of shipments) {
        await ctx.db.patch(shipment._id, { assignedUserId: undefined });
      }
    });

    await expect(
      t.withIdentity({ subject: client }).query(api.minerals.unassigned, {}),
    ).rejects.toThrow(/restricted to staff/i);

    const rows = await t
      .withIdentity({ subject: admin })
      .query(api.minerals.unassigned, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].mineral._id).toBe(created.mineralId);
    expect(rows[0].shipment?._id).toBe(booked.shipmentId);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.reassign, {
        mineralId: created.mineralId,
        assignment: { mode: "existing" as const, userId: client },
        note: "Matched to the customer record.",
      });
    await t.finishAllScheduledFunctions(() => {});
    expect(result.notified).toBe(true);

    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.unassigned, {}),
    ).toHaveLength(0);
    expect(
      await t.withIdentity({ subject: client }).query(api.minerals.mine, {}),
    ).toHaveLength(1);

    const stored = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      shipment: await ctx.db.get(booked.shipmentId),
      audit: await ctx.db.query("auditLogs").collect(),
    }));
    expect(stored.mineral?.assignedUserId).toBe(client);
    expect(stored.shipment?.assignedUserId).toBe(client);
    expect(
      stored.audit.some((entry) => entry.action === "mineral.reassigned"),
    ).toBe(true);
  });
});

describe("detaching minerals", () => {
  it("returns the mineral and its shipments to the unassigned pool", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    const booked = await bookShipment(t, admin, created.mineralId);

    await expect(
      t.withIdentity({ subject: client }).mutation(api.minerals.detach, {
        mineralId: created.mineralId,
      }),
    ).rejects.toThrow(/restricted to staff/i);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.detach, {
        mineralId: created.mineralId,
        note: "Customer moved the record to another vault.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result).toMatchObject({
      previousUserId: client,
      shipmentIds: [booked.shipmentId],
    });

    const stored = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      shipment: await ctx.db.get(booked.shipmentId),
      audit: await ctx.db.query("auditLogs").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(stored.mineral?.assignedUserId).toBeUndefined();
    expect(stored.mineral?.assignedAt).toBeUndefined();
    expect(stored.shipment?.assignedUserId).toBeUndefined();

    const audit = stored.audit.find(
      (entry) => entry.action === "mineral.detached",
    );
    expect(audit).toMatchObject({
      entityId: created.mineralId,
      reason: "Customer moved the record to another vault.",
      before: { assignedUserId: client },
      after: { assignedUserId: null },
    });

    const notice = stored.notifications.find(
      (notification) =>
        notification.userId === client &&
        notification.type === "mineral.unassigned" &&
        notification.title.includes("removed from your vault"),
    );
    expect(notice).toMatchObject({ emailStatus: "skipped" });

    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.minerals.forOwner, { userId: client }),
    ).toHaveLength(0);
    expect(
      (
        await t
          .withIdentity({ subject: admin })
          .query(api.minerals.unassigned, {})
      ).map((row) => row.mineral._id),
    ).toContain(created.mineralId);
    expect(
      await t.withIdentity({ subject: client }).query(api.minerals.mine, {}),
    ).toHaveLength(0);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.minerals.detach, {
        mineralId: created.mineralId,
      }),
    ).rejects.toThrow(/not assigned/i);
  });
});

describe("shipment status email", () => {
  const base = {
    recipientName: "Casey",
    companyName: "Cosmic Vault Insurance",
    supportEmail: "concierge@cosmicvault.test",
    appUrl: "https://vault.test",
    updatedAt: "21 Oct 2026, 10:00",
    status: "in_transit" as const,
    previousStatus: "preparing" as const,
    location: "Basel, CH",
    note: "Loaded onto the armoured convoy.",
    mineral: {
      name: "Gold bullion",
      reference: "MIN-AB12C",
      category: "Precious metals",
      quantity: "12.5 kg",
      declaredValue: "£250,000.00",
    },
    policy: {
      policyNumber: "CV-MIN-2026-014",
      provider: "Cosmic Vault Insurance",
      coverage: "Cargo & transit",
      coverageLimit: "£300,000.00",
      endDate: "1 Jan 2027",
    },
    shipment: {
      reference: "SHP-XY98Z",
      carrier: "Brink's Global Services",
      trackingNumber: "BGS-918273",
      origin: "Zurich, CH",
      destination: "London, GB",
      eta: "24 Oct 2026",
    },
  };

  it("draws the consignment route instead of the old stage bars", () => {
    const email = renderShipmentStatusEmail(base);

    expect(email.subject).toContain("on its way");
    expect(email.subject).toContain("MIN-AB12C");
    expect(email.html).toContain("Shipment update");
    expect(email.html).toContain("Gold bullion");
    expect(email.html).toContain("In transit");
    expect(email.html).toContain("CV-MIN-2026-014");
    expect(email.html).toContain("https://vault.test/dashboard/minerals");
    expect(email.text).toContain("Status: In transit");
    expect(email.text).toContain("Route: Zurich, CH to London, GB");

    // The four progress bars are gone: origin, live position and destination
    // sit on one line, the way the dispatch board draws the route, and the
    // milestones below are a ledger of rows rather than four bars.
    expect(email.html).not.toContain("height:4px");
    expect(email.html).toContain(">Origin<");
    expect(email.html).toContain(">Position<");
    expect(email.html).toContain(">Destination<");
    expect(email.html).toContain("Zurich, CH");
    expect(email.html).toContain("Basel, CH");
    expect(email.html).toContain("London, GB");

    // The markers are the same pin and truck the dashboard uses.
    expect(email.html).toContain(
      "https://vault.test/email/route-pin-origin.png",
    );
    expect(email.html).toContain("https://vault.test/email/route-truck.png");
    expect(email.html).toContain(
      "https://vault.test/email/route-pin-destination.png",
    );

    // In transit reaches the truck; the last leg is still dashed.
    expect(email.html).toContain("border-top:2px solid");
    expect(email.html).toContain("border-top:2px dashed");

    // The milestones sit under the route as a ledger: one 22px marker per
    // stage, the current one carrying the update's own timestamp.
    expect(email.html).toContain("border-radius:11px");
    expect(email.html).toContain("Out for delivery");
    expect(email.html).toContain("Complete");
    expect(email.html).toContain("To come");
    expect(email.text).toContain("Journey");
  });

  it("fills the route to the destination only once it is delivered", () => {
    const delivered = renderShipmentStatusEmail({
      ...base,
      status: "delivered",
      previousStatus: "out_for_delivery",
    });
    expect(delivered.html).not.toContain("border-top:2px dashed");
    expect(delivered.html).toContain(">Destination<");

    // Out for delivery reaches the second waypoint, not the door.
    const outForDelivery = renderShipmentStatusEmail({
      ...base,
      status: "out_for_delivery",
      previousStatus: "in_transit",
    });
    expect(outForDelivery.html).toContain("border-top:2px dashed");
  });

  it("closes on the dashboard's navy footer, the same bands as the vault email", () => {
    const email = renderShipmentStatusEmail(base);

    // The dark panel with its electric rule, rather than the old pale strip.
    expect(email.html).toContain('bgcolor="#091430"');
    expect(email.html).toContain("border-top:3px solid #2B61EB");

    // The two link columns point at real console routes.
    expect(email.html).toContain(
      'href="https://vault.test/dashboard/shipments"',
    );
    expect(email.html).toContain('href="https://vault.test/dashboard/support"');
    expect(email.html).toContain('href="https://vault.test/legal/terms"');
    expect(email.html).toContain('href="mailto:concierge@cosmicvault.test"');

    // The footer names the consignment the message is about.
    expect(email.html).toContain("SHP-XY98Z");
  });

  it("opens with the site's own logo, and a plain mark without an origin", () => {
    const email = renderShipmentStatusEmail(base);
    // The same PNG the vault email uses, so both headers carry the brand.
    expect(email.html).toContain("https://vault.test/email/logo-mark.png");
    expect(email.html).toContain('width="22" height="22" alt=""');

    // A preview with no site configured keeps the electric square rather than
    // pointing at an image that will not load.
    const preview = renderShipmentStatusEmail({ ...base, appUrl: "" });
    expect(preview.html).not.toContain("logo-mark.png");
    expect(preview.html).toContain(
      "border-radius:4px;vertical-align:middle;font-size:0",
    );

    // The route pins are served from the same origin, so they go the same way:
    // the rail is drawn instead, and no link is left pointing at a host.
    expect(preview.html).not.toContain("/email/route-pin-origin.png");
    expect(preview.html).not.toContain('href="/');
    expect(preview.html).not.toContain("Track this shipment</a>");
    expect(preview.html).toContain("border-top:2px dashed");
    expect(preview.text).toContain(
      "Track this shipment from your vault at your dashboard.",
    );
  });

  it("never reports the status as the consignment's location", () => {
    const unknown = {
      ...base,
      location: undefined,
      shipment: { ...base.shipment, eta: undefined },
    };

    // The rail names the position, so an unrecorded one is said there and the
    // ledger does not repeat it as a row of its own.
    const railed = renderShipmentStatusEmail(unknown);
    expect(railed.html).toContain("No location recorded");
    expect(railed.html).not.toContain("Current location");
    expect(railed.text).not.toContain("Current location");

    // A map image replaces the rail, so the place moves into the ledger - and
    // an unrecorded one is said plainly instead of wearing the status word.
    const mapped = renderShipmentStatusEmail({
      ...unknown,
      mapUrl:
        "https://api.mapbox.com/styles/v1/mapbox/light-v11/static/path/x/auto/494x317?access_token=pk.test",
    });
    expect(mapped.html).toContain("Current location");
    expect(mapped.html).toContain(">Not recorded</td>");
    expect(mapped.text).toContain("Current location: Not recorded");
  });

  it("escapes member-facing values instead of injecting markup", () => {
    const email = renderShipmentStatusEmail({
      ...base,
      note: "<script>alert(1)</script>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("removing a mineral record", () => {
  /** Seeds a mineral, books a consignment and closes it at the destination. */
  async function seedClosedRecord() {
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
        status: "delivered",
      });
    await t.finishAllScheduledFunctions(() => {});

    return { t, admin, client, created, booked };
  }

  it("takes the mineral, policy, closed consignment and notifications with it", async () => {
    const { t, admin, created } = await seedClosedRecord();

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.remove, {
        mineralId: created.mineralId,
        reason: "Test record created in error.",
      });

    expect(result.removed).toEqual({
      policies: 1,
      shipments: 1,
      events: 2,
      requests: 0,
      memberPolicies: 1,
      memberDocuments: 2,
      memberTransactions: 1,
      memberApplicationEvents: 1,
    });

    const left = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      policies: await ctx.db.query("mineralPolicies").collect(),
      shipments: await ctx.db.query("shipments").collect(),
      events: await ctx.db.query("shipmentEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));

    expect(left.mineral).toBeNull();
    expect(left.policies).toHaveLength(0);
    expect(left.shipments).toHaveLength(0);
    expect(left.events).toHaveLength(0);
    // The assignment, booking and delivery notices all pointed at this record.
    expect(left.notifications).toHaveLength(0);

    /* The trail outlives the row, and it carries enough to reconstruct what was
       deleted without the records themselves. */
    const entry = left.audit.find((row) => row.action === "mineral.removed");
    expect(entry).toMatchObject({
      entityType: "minerals",
      entityId: created.mineralId,
      reason: "Test record created in error.",
      before: {
        policyNumbers: ["CV-MIN-2026-014"],
        shipmentReferences: [expect.stringMatching(/^SHP-/)],
      },
    });
  });

  it("refuses while a consignment is still in flight", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    await bookShipment(t, admin, created.mineralId);
    await t.finishAllScheduledFunctions(() => {});

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.minerals.remove, {
        mineralId: created.mineralId,
        reason: "Test record created in error.",
      }),
    ).rejects.toThrow(/still in flight/i);

    // Nothing was taken, and nothing was written to the trail either.
    const left = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      audit: await ctx.db.query("auditLogs").collect(),
    }));
    expect(left.mineral).not.toBeNull();
    expect(left.audit.some((row) => row.action === "mineral.removed")).toBe(
      false,
    );
  });

  it("is staff-only and needs a reason", async () => {
    const { t, admin, client, created } = await seedClosedRecord();

    await expect(
      t.withIdentity({ subject: client }).mutation(api.minerals.remove, {
        mineralId: created.mineralId,
        reason: "Not mine to remove.",
      }),
    ).rejects.toThrow(/restricted to staff/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.minerals.remove, {
        mineralId: created.mineralId,
        reason: "   ",
      }),
    ).rejects.toThrow(/reason/i);

    const left = await t.run(
      async (ctx) => await ctx.db.get(created.mineralId),
    );
    expect(left).not.toBeNull();
  });
});

describe("mineral assignment email", () => {
  const base = {
    recipientName: "Casey",
    companyName: "Cosmic Vault Insurance",
    supportEmail: "concierge@cosmicvault.test",
    appUrl: "https://vault.test",
    isNewAccount: true,
    mineral: {
      name: "Gold bullion",
      reference: "MIN-AB12C",
      category: "Precious metals",
      quantity: "12.5 kg",
      declaredValue: "£250,000.00",
    },
  };

  it("links the vault and the mark when the deployment knows its origin", () => {
    const email = renderAssignmentEmail(base);

    expect(email.html).toContain(
      'href="https://vault.test/dashboard/minerals"',
    );
    expect(email.html).toContain("Sign in at https://vault.test/auth");
    expect(email.html).toContain("https://vault.test/email/logo-mark.png");
    expect(email.text).toContain(
      "Open your vault: https://vault.test/dashboard/minerals",
    );
  });

  it("says where to go, rather than linking a host, without one", () => {
    const email = renderAssignmentEmail({ ...base, appUrl: "" });

    // No href survives - a mail client cannot open a relative one - and the
    // header falls back to the drawn mark rather than a broken image.
    expect(email.html).not.toContain('href="/');
    expect(email.html).not.toContain("logo-mark.png");
    expect(email.text).not.toContain("http");
    expect(email.text).toContain("Open your vault from your dashboard");
    expect(email.text).toContain("Sign in with this email address");
  });
});

describe("email origins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Queues the assignment email for a fresh mineral and returns the notice. */
  async function queuedAssignment(
    t: Test,
    admin: Id<"users">,
    client: Id<"users">,
  ) {
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    await t.finishAllScheduledFunctions(() => {});
    return await t.run(async (ctx) => {
      const rows = await ctx.db.query("notifications").collect();
      return rows.find(
        (row) => row.type === "mineral.assigned" && row.userId === client,
      );
    });
  }

  it("addresses every link and image at the deployment's own site URL", async () => {
    vi.stubEnv("SITE_URL", "https://cosmicinsurance2vaultgh.com/");
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const notice = await queuedAssignment(t, admin, client);

    expect(notice?.emailHtml).toContain(
      "https://cosmicinsurance2vaultgh.com/email/logo-mark.png",
    );
    expect(notice?.emailHtml).toContain(
      'href="https://cosmicinsurance2vaultgh.com/dashboard/minerals"',
    );
    expect(notice?.emailText).toContain(
      "https://cosmicinsurance2vaultgh.com/dashboard/minerals",
    );
  });

  it("falls back to the drawn mark instead of a host it may not serve", async () => {
    vi.stubEnv("SITE_URL", "");
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);

    const notice = await queuedAssignment(t, admin, client);

    // The old fallback was cosmicvault.co, which does not serve the assets.
    expect(notice?.emailHtml).not.toContain("logo-mark.png");
    expect(notice?.emailHtml).not.toContain("cosmicvault.co/dashboard");
    expect(notice?.emailHtml).not.toContain('href="/');
    expect(notice?.emailText).toContain("Open your vault from your dashboard");
  });
});

/**
 * A member holding an insured mineral reads that cover from the same places as
 * any other policy. These tests go through the member queries themselves, not
 * just the rows, because the bug they cover was that the pages could not see
 * records that existed.
 */
describe("member records for vault cover", () => {
  async function issued() {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, payload(client));
    await t.finishAllScheduledFunctions(() => {});
    return { t, admin, client, created };
  }

  it("shows the cover on the member's policies, payments, documents and applications pages", async () => {
    const { t, client, created } = await issued();

    const policies = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({
      policyNumber: "CV-MIN-2026-014",
      status: "active",
      premium: 45_000,
      coverageLimit: 30_000_000,
      currency: "GBP",
      customerUserId: client,
    });

    const transactions = await t
      .withIdentity({ subject: client })
      .query(api.payments.mine, {});
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: "premium",
      status: "pending",
      amount: 45_000,
      currency: "GBP",
      policyId: created.policyId,
    });

    const documents = await t
      .withIdentity({ subject: client })
      .query(api.documents.mine, {});
    expect(documents).toHaveLength(2);
    expect(documents.every((document) => document.category === "policy")).toBe(
      true,
    );
    expect(
      documents.some((document) =>
        document.name.includes("policy schedule"),
      ),
    ).toBe(true);

    const applications = await t
      .withIdentity({ subject: client })
      .query(api.applications.mine, {});
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      status: "approved",
      customerUserId: client,
      policyId: created.policyId,
    });

    // The cover stays the vault's own record, linked from the policy it issued.
    const cover = await t.run(async (ctx) => ctx.db.get(created.coverId));
    expect(cover?.policyId).toBe(created.policyId);
  });

  it("raises no invoice when the cover carries no premium", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const base = payload(client);

    await t.withIdentity({ subject: admin }).mutation(api.minerals.create, {
      ...base,
      policy: { ...base.policy, premium: 0 },
    });
    await t.finishAllScheduledFunctions(() => {});

    const transactions = await t
      .withIdentity({ subject: client })
      .query(api.payments.mine, {});
    expect(transactions).toHaveLength(0);
  });

  it("moves the policy, documents and outstanding invoice with the mineral", async () => {
    const { t, admin, client, created } = await issued();
    const other = await seedCustomer(t, "second@cosmicvault.test");

    await t.withIdentity({ subject: admin }).mutation(api.minerals.reassign, {
      mineralId: created.mineralId,
      assignment: { mode: "existing" as const, userId: other },
    });
    await t.finishAllScheduledFunctions(() => {});

    const before = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(before).toHaveLength(0);

    const after = await t
      .withIdentity({ subject: other })
      .query(api.policies.mine, {});
    expect(after).toHaveLength(1);
    expect(after[0].policyNumber).toBe("CV-MIN-2026-014");

    const documents = await t
      .withIdentity({ subject: other })
      .query(api.documents.mine, {});
    expect(documents).toHaveLength(2);

    const invoices = await t
      .withIdentity({ subject: other })
      .query(api.payments.mine, {});
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe("pending");
  });

  it("suspends the member's policy when the mineral leaves their vault", async () => {
    const { t, admin, client, created } = await issued();

    await t.withIdentity({ subject: admin }).mutation(api.minerals.detach, {
      mineralId: created.mineralId,
      note: "Returned to the pool.",
    });
    await t.finishAllScheduledFunctions(() => {});

    const policies = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(policies).toHaveLength(1);
    expect(policies[0].status).toBe("suspended");
    expect(policies[0].suspensionReason).toContain("vault desk");
  });

  it("takes the member records with a mineral recorded in error", async () => {
    const { t, admin, client, created } = await issued();

    const removed = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.remove, {
        mineralId: created.mineralId,
        reason: "Test record created in error.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(removed.removed).toMatchObject({
      memberPolicies: 1,
      memberDocuments: 2,
      memberTransactions: 1,
      memberApplicationEvents: 1,
    });

    const [policies, transactions, documents, applications] = await Promise.all(
      [
        t.withIdentity({ subject: client }).query(api.policies.mine, {}),
        t.withIdentity({ subject: client }).query(api.payments.mine, {}),
        t.withIdentity({ subject: client }).query(api.documents.mine, {}),
        t.withIdentity({ subject: client }).query(api.applications.mine, {}),
      ],
    );
    expect(policies).toHaveLength(0);
    expect(transactions).toHaveLength(0);
    expect(documents).toHaveLength(0);
    expect(applications).toHaveLength(0);
  });

  it("backfills a cover recorded before the member records existed", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const now = Date.now();

    const mineralId = await t.run(
      async (ctx) =>
        await ctx.db.insert("minerals", {
          reference: "MIN-LEGACY",
          name: "Silver bars",
          category: "Precious metals",
          quantity: 40,
          unit: "kg",
          declaredValue: 3_000_000,
          currency: "GBP",
          status: "active",
          assignedUserId: client,
          assignedAt: now,
          assignedBy: admin,
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );
    await t.run(
      async (ctx) =>
        await ctx.db.insert("mineralPolicies", {
          mineralId,
          policyNumber: "CV-MIN-LEGACY-1",
          provider: "Cosmic Vault Insurance",
          coverage: "storage",
          coverageLimit: 5_000_000,
          premium: 12_000,
          currency: "GBP",
          startDate: now - 86_400_000,
          endDate: now + 300 * 86_400_000,
          status: "active",
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );

    // The operator command, which attributes each issuance to the staff
    // account that recorded the cover rather than to a session.
    const first = await t.mutation(internal.minerals.backfillMemberRecords, {});
    expect(first).toMatchObject({ repaired: 1, remaining: 0 });

    const policies = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(policies).toHaveLength(1);
    expect(policies[0].policyNumber).toBe("CV-MIN-LEGACY-1");

    // Idempotent: a second run finds nothing left to issue.
    const second = await t.mutation(internal.minerals.backfillMemberRecords, {});
    expect(second).toMatchObject({ repaired: 0 });
  });

  it("expires the cover with the policy the daily job closes", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const base = payload(client);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...base,
        policy: {
          ...base.policy,
          startDate: "2020-01-01",
          endDate: "2021-01-01",
        },
      });
    await t.finishAllScheduledFunctions(() => {});

    await t.mutation(internal.maintenance.daily, {});
    await t.finishAllScheduledFunctions(() => {});

    const [cover, policy] = await t.run(async (ctx) => [
      await ctx.db.get(created.coverId),
      await ctx.db.get(created.policyId),
    ]);
    expect(policy?.status).toBe("expired");
    expect(cover?.status).toBe("expired");
  });

  it("shows the cover on the member's dashboard metrics", async () => {
    const { t, client } = await issued();

    const overview = await t
      .withIdentity({ subject: client })
      .query(api.reports.overview, {});
    if (overview.kind !== "customer") {
      throw new Error("Expected the member overview.");
    }

    expect(overview.metrics.activePolicies).toBe(1);
    expect(overview.recentPolicies).toHaveLength(1);
    expect(overview.recentPolicies[0].policyNumber).toBe("CV-MIN-2026-014");
    expect(overview.recentDocuments).toHaveLength(2);
    expect(overview.outstanding).toEqual([{ currency: "GBP", amount: 45_000 }]);
    // Cover in force is not lapsed cover.
    expect(overview.lapsedCover).toHaveLength(0);
  });

  it("backfills the paperwork for a lapsed cover without billing it", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const now = Date.now();

    const mineralId = await t.run(
      async (ctx) =>
        await ctx.db.insert("minerals", {
          reference: "MIN-LAPSED",
          name: "Sapphire parcel",
          category: "Precious stones",
          quantity: 3,
          unit: "ct",
          declaredValue: 2_000_000,
          currency: "GBP",
          status: "active",
          assignedUserId: client,
          assignedAt: now,
          assignedBy: admin,
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );
    await t.run(
      async (ctx) =>
        await ctx.db.insert("mineralPolicies", {
          mineralId,
          policyNumber: "CV-MIN-LAPSED-1",
          provider: "Cosmic Vault Insurance",
          coverage: "all_risk",
          coverageLimit: 4_000_000,
          premium: 90_000,
          currency: "GBP",
          startDate: now - 400 * 86_400_000,
          endDate: now - 35 * 86_400_000,
          status: "expired",
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );

    const result = await t.mutation(internal.minerals.backfillMemberRecords, {});
    expect(result).toMatchObject({ repaired: 1 });

    const policies = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(policies).toHaveLength(1);
    expect(policies[0].status).toBe("expired");

    /* Lapsed cover leaves the active count but not the dashboard: it is listed
       as cover that has ended, so a member whose vault cover lapsed is told. */
    const overview = await t
      .withIdentity({ subject: client })
      .query(api.reports.overview, {});
    if (overview.kind !== "customer") {
      throw new Error("Expected the member overview.");
    }
    expect(overview.metrics.activePolicies).toBe(0);
    expect(overview.lapsedCover).toHaveLength(1);
    expect(overview.lapsedCover[0]).toMatchObject({
      policyNumber: "CV-MIN-LAPSED-1",
      status: "expired",
      categoryKey: "mineral",
    });

    const documents = await t
      .withIdentity({ subject: client })
      .query(api.documents.mine, {});
    expect(documents).toHaveLength(2);

    // History is reconstructed, not billed: no invoice, so no overdue notice.
    const transactions = await t
      .withIdentity({ subject: client })
      .query(api.payments.mine, {});
    expect(transactions).toHaveLength(0);
  });

  it("lets a member ask to renew cover that has lapsed", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const now = Date.now();

    const mineralId = await t.run(
      async (ctx) =>
        await ctx.db.insert("minerals", {
          reference: "MIN-RENEW",
          name: "Opal parcel",
          category: "Precious stones",
          quantity: 2,
          unit: "ct",
          declaredValue: 900_000,
          currency: "GBP",
          status: "active",
          assignedUserId: client,
          assignedAt: now,
          assignedBy: admin,
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );
    await t.run(
      async (ctx) =>
        await ctx.db.insert("mineralPolicies", {
          mineralId,
          policyNumber: "CV-MIN-RENEW-1",
          provider: "Cosmic Vault Insurance",
          coverage: "storage",
          coverageLimit: 1_500_000,
          premium: 30_000,
          currency: "GBP",
          startDate: now - 400 * 86_400_000,
          endDate: now - 30 * 86_400_000,
          status: "expired",
          createdBy: admin,
          createdAt: now,
          updatedAt: now,
        }),
    );
    await t.mutation(internal.minerals.backfillMemberRecords, {});

    const [policy] = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(policy.status).toBe("expired");

    /* Lapsed cover refuses every other change but takes a renewal: the card
       that surfaces it exists precisely so the member can act on it. */
    await expect(
      t.withIdentity({ subject: client }).mutation(api.policies.requestChange, {
        policyId: policy._id,
        kind: "endorsement",
        details: "Please add extra cover.",
      }),
    ).rejects.toThrow(/no longer in force/i);

    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.policies.requestChange, {
        policyId: policy._id,
        kind: "renewal",
        details: "Please renew my vault cover.",
      });

    // One request per kind is already awaiting a decision.
    await expect(
      t.withIdentity({ subject: client }).mutation(api.policies.requestChange, {
        policyId: policy._id,
        kind: "renewal",
        details: "Please renew again.",
      }),
    ).rejects.toThrow(/awaiting a decision/i);

    const overview = await t
      .withIdentity({ subject: client })
      .query(api.reports.overview, {});
    if (overview.kind !== "customer") {
      throw new Error("Expected the member overview.");
    }
    expect(overview.lapsedCover[0].renewalRequested).toBe(true);

    /* Staff approval puts cover back in force with a fresh term, and the
       pending status pill on the card is no longer offered a second time. */
    await t
      .withIdentity({ subject: admin })
      .mutation(api.policies.decideRequest, {
        requestId,
        decision: "approved",
        note: "Renewed after review.",
      });
    await t.finishAllScheduledFunctions(() => {});

    const renewed = await t
      .withIdentity({ subject: client })
      .query(api.policies.mine, {});
    expect(renewed[0].status).toBe("active");
    expect(renewed[0].endDate).toBeGreaterThan(now);

    const after = await t
      .withIdentity({ subject: client })
      .query(api.reports.overview, {});
    if (after.kind !== "customer") {
      throw new Error("Expected the member overview.");
    }
    expect(after.metrics.activePolicies).toBe(1);
    expect(after.lapsedCover).toHaveLength(0);

    // The renewal premium is real money, unlike the backfilled history.
    const transactions = await t
      .withIdentity({ subject: client })
      .query(api.payments.mine, {});
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "premium", status: "pending" });
    /* Due on renewal, not when the new term ends: a date 12 months out would
       hide the receivable from the overdue job for a year. */
    expect(transactions[0].dueDate).toBeGreaterThan(now);
    expect(transactions[0].dueDate).toBeLessThan(now + 8 * 86_400_000);
  });

  it("clears the lapse markers when a suspended cover is renewed", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const base = payload(client);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...base,
        policy: { ...base.policy, startDate: "2026-01-01", endDate: "2027-01-01" },
      });
    await t.finishAllScheduledFunctions(() => {});

    await t.run(
      async (ctx) =>
        await ctx.db.patch(created.policyId, {
          status: "suspended",
          suspendedAt: Date.now(),
          suspensionReason: "The mineral left custody.",
        }),
    );

    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.policies.requestChange, {
        policyId: created.policyId,
        kind: "renewal",
        details: "Please renew my vault cover.",
      });

    await t
      .withIdentity({ subject: admin })
      .mutation(api.policies.decideRequest, {
        requestId,
        decision: "approved",
        note: "Renewed after review.",
      });
    await t.finishAllScheduledFunctions(() => {});

    const policy = await t.run(async (ctx) => await ctx.db.get(created.policyId));
    expect(policy?.status).toBe("active");
    // A reinstated policy must not still read as suspended on the dashboard.
    expect(policy?.suspensionReason).toBeUndefined();
    expect(policy?.suspendedAt).toBeUndefined();
  });

  it("uses the configured premium payment term for renewal invoices", async () => {
    const t = test();
    const admin = await seedAdmin(t);
    const client = await seedCustomer(t);
    await seedCurrency(t);
    const base = payload(client);

    const created = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.create, {
        ...base,
        policy: { ...base.policy, startDate: "2026-01-01", endDate: "2027-01-01" },
      });
    await t.finishAllScheduledFunctions(() => {});

    // Finance asks for a longer window than the seven-day default.
    const owner = await t.run(
      async (ctx) =>
        await ctx.db.insert("users", {
          name: "Sam Super",
          email: "super@cosmicvault.test",
          role: "super_admin",
          status: "active",
        }),
    );
    const current = await t
      .withIdentity({ subject: owner })
      .query(api.settings.get, {});
    await t.withIdentity({ subject: owner }).mutation(api.settings.update, {
      companyName: current.companyName,
      supportEmail: current.supportEmail,
      emailFromAddress: current.emailFromAddress,
      defaultCurrency: "GBP",
      commissionEnabled: current.commissionEnabled,
      renewalNoticeDays: current.renewalNoticeDays,
      claimSlaDays: current.claimSlaDays,
      premiumPaymentTermDays: 21,
      allowedCurrencies: ["GBP"],
      emailTemplates: current.emailTemplates,
    });

    const { requestId } = await t
      .withIdentity({ subject: client })
      .mutation(api.policies.requestChange, {
        policyId: created.policyId,
        kind: "renewal",
        details: "Please renew my vault cover.",
      });

    const now = Date.now();
    await t
      .withIdentity({ subject: admin })
      .mutation(api.policies.decideRequest, {
        requestId,
        decision: "approved",
        note: "Renewed after review.",
      });
    await t.finishAllScheduledFunctions(() => {});

    const transactions = await t
      .withIdentity({ subject: client })
      .query(api.payments.mine, {});
    const renewal = transactions.find((row) =>
      row.note?.startsWith("Renewal premium"),
    );
    if (!renewal) throw new Error("Expected the renewal premium invoice.");
    expect(renewal.dueDate).toBeGreaterThan(now + 20 * 86_400_000);
    expect(renewal.dueDate).toBeLessThan(now + 22 * 86_400_000);
  });

  it("keeps the cover anchor out of the member catalogue", async () => {
    const { t, client } = await issued();
    const now = Date.now();

    await t.run(async (ctx) => {
      const anchor = await ctx.db
        .query("products")
        .withIndex("by_code", (q) => q.eq("code", "MIN-CUSTODY-01"))
        .first();
      if (!anchor) throw new Error("Expected the cover anchor product.");

      /* A deployment that recorded minerals before the anchor was archived
         still holds it as published. The empty market list is what keeps it
         out of the catalogue the member browses. */
      await ctx.db.patch(anchor._id, { status: "published" });

      await ctx.db.insert("products", {
        code: "MOT-COMP-99",
        name: "Retail motor cover",
        categoryKey: "motor",
        description: "A product the catalogue should list.",
        targetCustomer: "Private car owners.",
        countries: ["GB"],
        currency: "GBP",
        basePremium: 48_000,
        termMonths: 12,
        excess: 25_000,
        coverageLimit: 2_000_000,
        exclusions: [],
        benefits: [],
        ratingFactors: [],
        questions: [],
        requiredDocuments: [],
        wordingVersion: "1.0",
        wording: "Wording for the retail product the catalogue lists.",
        disclosures: "Not financial advice.",
        status: "published",
        version: 1,
        effectiveFrom: now - 86_400_000,
        renewalNoticeDays: 30,
        cancellationNoticeDays: 14,
        createdAt: now,
        updatedAt: now,
      });
    });

    const catalogue = await t
      .withIdentity({ subject: client })
      .query(api.products.catalogue, {});

    expect(catalogue.products.map((product) => product.code)).toEqual([
      "MOT-COMP-99",
    ]);
  });
});
