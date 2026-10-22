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
