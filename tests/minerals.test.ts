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
    shipment: {
      carrier: "Brink's Global Services",
      trackingNumber: "BGS-918273",
      origin: "Zurich, CH",
      destination: "London, GB",
      departureAt: "2026-10-20",
      estimatedArrivalAt: "2026-10-24",
      status: "preparing" as const,
    },
    assignment: userId
      ? { mode: "existing" as const, userId }
      : { mode: "existing" as const },
  };
}

describe("minerals and shipments", () => {
  it("records a mineral, policy and shipment and assigns an existing member", async () => {
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
      shipment: await ctx.db.get(result.shipmentId),
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
    expect(stored.shipment).toMatchObject({
      carrier: "Brink's Global Services",
      origin: "Zurich, CH",
      destination: "London, GB",
      status: "preparing",
      assignedUserId: client,
    });
    expect(stored.events).toHaveLength(1);
    expect(stored.notifications).toHaveLength(1);
    expect(stored.notifications[0]).toMatchObject({
      userId: client,
      type: "mineral.assigned",
      emailStatus: "queued",
      href: "/dashboard/minerals",
    });

    const mine = await t
      .withIdentity({ subject: client })
      .query(api.minerals.mine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].shipment?.reference).toBe(stored.shipment?.reference);
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

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: created.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
        note: "Cleared the vault and loaded onto the armoured convoy.",
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result.notified).toBe(true);
    const stored = await t.run(async (ctx) => ({
      shipment: await ctx.db.get(created.shipmentId),
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
    expect(stored.notifications).toHaveLength(2);
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

    const nextEta = Date.UTC(2027, 0, 15);
    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: created.shipmentId,
        status: "in_transit",
        location: "Basel, CH",
        estimatedArrivalAt: nextEta,
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(
      async (ctx) => await ctx.db.get(created.shipmentId),
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
          shipmentId: created.shipmentId,
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

    await t
      .withIdentity({ subject: admin })
      .mutation(api.minerals.updateShipmentStatus, {
        shipmentId: created.shipmentId,
        status: "customs_hold",
        note: "Carrier withdrew the sailing; the date is being re-planned.",
        estimatedArrivalAt: null,
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      shipment: await ctx.db.get(created.shipmentId),
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

    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.minerals.updateShipmentStatus, {
          shipmentId: created.shipmentId,
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
      [created.shipmentId, secondShipment].sort(),
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
    expect(rows[0].shipment?._id).toBe(first.shipmentId);
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
    expect(rows[0].shipment?._id).toBe(created.shipmentId);

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
      shipment: await ctx.db.get(created.shipmentId),
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
      shipmentIds: [created.shipmentId],
    });

    const stored = await t.run(async (ctx) => ({
      mineral: await ctx.db.get(created.mineralId),
      shipment: await ctx.db.get(created.shipmentId),
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

  it("builds the branded status email with the shipment progress", () => {
    const email = renderShipmentStatusEmail(base);

    expect(email.subject).toContain("on its way");
    expect(email.subject).toContain("MIN-AB12C");
    expect(email.html).toContain("Shipment update");
    expect(email.html).toContain("Gold bullion");
    expect(email.html).toContain("In transit");
    expect(email.html).toContain("Out for delivery");
    expect(email.html).toContain("CV-MIN-2026-014");
    expect(email.html).toContain("https://vault.test/dashboard/minerals");
    expect(email.text).toContain("Status: In transit");
    expect(email.text).toContain("Route: Zurich, CH to London, GB");
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
