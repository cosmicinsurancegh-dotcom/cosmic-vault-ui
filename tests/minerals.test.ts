import { convexTest } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { internalAction } from "../src/convex/_generated/server";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import { renderShipmentStatusEmail } from "../src/convex/lib/shipmentEmail";

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
      policy: await ctx.db.get(result.policyId),
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
    expect(stored.policy).toMatchObject({
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
