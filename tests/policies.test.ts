import { convexTest } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { internalAction } from "../src/convex/_generated/server";
import { api } from "../src/convex/_generated/api";

/**
 * Server coverage for the two admin creation flows: staff-created accounts and
 * a policy issued directly from the register. `convex-test` runs the real
 * modules against an in-memory database, so the permission gates, the records
 * written and the audit trail are the ones the deployment uses.
 *
 * The email adapter is a scheduled action that runs a mutation internally,
 * which convex-test cannot nest; it is replaced by a no-op. Delivery state is
 * covered by the adapter itself.
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
  "../src/convex/policies.ts": () => import("../src/convex/policies"),
  "../src/convex/customers.ts": () => import("../src/convex/customers"),
  "../src/convex/brokers.ts": () => import("../src/convex/brokers"),
  "../src/convex/staff.ts": () => import("../src/convex/staff"),
  "../src/convex/email.ts": () => Promise.resolve(emailStub),
};

const test = () => convexTest(schema, modules);
type Test = ReturnType<typeof test>;

async function seedUser(
  t: Test,
  user: {
    email: string;
    name?: string;
    role?: "super_admin" | "admin" | "broker" | "customer";
    permissions?: string[];
  },
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: user.name ?? user.email,
      email: user.email,
      role: user.role ?? "customer",
      status: "active",
      permissions: user.permissions,
    }),
  );
}

async function seedReference(t: Test) {
  await t.run(async (ctx) => {
    await ctx.db.insert("countries", {
      code: "GB",
      name: "United Kingdom",
      currency: "GBP",
      region: "Europe",
      active: true,
    });
    await ctx.db.insert("currencies", {
      code: "GBP",
      name: "Pound sterling",
      symbol: "£",
      minorUnits: 2,
      active: true,
    });
  });
}

async function seedProduct(t: Test, overrides: Record<string, unknown> = {}) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("products", {
      code: "MINERAL-ALLRISK",
      name: "Mineral all-risk",
      categoryKey: "minerals",
      description: "All-risk cover for vaulted minerals.",
      targetCustomer: "Collectors",
      countries: ["GB"],
      currency: "GBP",
      basePremium: 120_000,
      termMonths: 12,
      excess: 50_000,
      coverageLimit: 5_000_000,
      exclusions: ["Wear and tear"],
      benefits: ["Door-to-door transit"],
      ratingFactors: [],
      questions: [],
      requiredDocuments: [],
      wordingVersion: "2026.1",
      wording: "Policy wording body.",
      disclosures: "Disclosures body.",
      status: "published",
      version: 1,
      effectiveFrom: Date.UTC(2026, 0, 1),
      renewalNoticeDays: 30,
      cancellationNoticeDays: 14,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    }),
  );
}

const TODAY = "2026-10-23";

describe("issuing a policy from the register", () => {
  it("writes the policy, its application, documents, invoice and audit", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["policies.manage"],
    });
    const customer = await seedUser(t, {
      email: "member@cosmicvault.test",
      name: "Morgan Ellis",
      role: "customer",
    });
    await seedProduct(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.policies.create, {
        customerUserId: customer,
        productId: (await t.run(async (ctx) =>
          (await ctx.db.query("products").first())!._id))!,
        country: "GB",
        premium: 145_000,
        startDate: TODAY,
      });
    await t.finishAllScheduledFunctions(() => {});

    expect(result.policyNumber).toMatch(/^POL-/);

    const stored = await t.run(async (ctx) => ({
      policy: await ctx.db.get(result.policyId),
      application: await ctx.db.get(result.applicationId),
      documents: await ctx.db.query("documents").collect(),
      transactions: await ctx.db.query("transactions").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      events: await ctx.db.query("applicationEvents").collect(),
    }));

    expect(stored.policy).toMatchObject({
      policyNumber: result.policyNumber,
      customerUserId: customer,
      status: "active",
      insuredName: "Morgan Ellis",
      country: "GB",
      currency: "GBP",
      premium: 145_000,
      coverageLimit: 5_000_000,
      excess: 50_000,
      wordingVersion: "2026.1",
      issuedBy: admin,
    });
    expect(stored.policy?.applicationId).toBe(result.applicationId);
    expect(stored.application).toMatchObject({
      status: "approved",
      decision: "approved",
      policyId: result.policyId,
      premium: 145_000,
      answers: { source: "staff_issued" },
    });

    expect(stored.documents).toHaveLength(3);
    expect(stored.documents.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        `${result.policyNumber} - policy schedule`,
        `${result.policyNumber} - certificate`,
        `${result.policyNumber} - policy wording v2026.1`,
      ]),
    );
    expect(stored.documents[0].body).toContain("Morgan Ellis");

    expect(stored.transactions).toHaveLength(1);
    expect(stored.transactions[0]).toMatchObject({
      type: "premium",
      status: "pending",
      amount: 145_000,
      currency: "GBP",
      policyId: result.policyId,
      providerVerified: false,
      reconciled: false,
    });

    expect(stored.audit.map((row) => row.action)).toContain(
      "policy.issued_directly",
    );
    expect(stored.notifications.map((row) => row.type)).toContain(
      "policy.issued",
    );
    expect(stored.events[0].message).toContain(result.policyNumber);
  });

  it("inherits an active broker assignment", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["policies.manage"],
    });
    const broker = await seedUser(t, {
      email: "broker@cosmicvault.test",
      role: "broker",
    });
    const customer = await seedUser(t, {
      email: "member@cosmicvault.test",
      role: "customer",
    });
    await t.run(
      async (ctx) =>
        await ctx.db.insert("brokerAssignments", {
          brokerUserId: broker,
          customerUserId: customer,
          status: "active",
          assignedBy: admin,
          createdAt: Date.now(),
        }),
    );
    const productId = await seedProduct(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.policies.create, {
        customerUserId: customer,
        productId,
        country: "GB",
        premium: 100_000,
        startDate: TODAY,
      });

    const policy = await t.run(async (ctx) => await ctx.db.get(result.policyId));
    expect(policy?.brokerUserId).toBe(broker);
  });

  it("refuses staff customers, unpublished products and unsupported countries", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["policies.manage"],
    });
    const staffCustomer = await seedUser(t, {
      email: "other-admin@cosmicvault.test",
      role: "admin",
    });
    const customer = await seedUser(t, {
      email: "member@cosmicvault.test",
      role: "customer",
    });
    const published = await seedProduct(t);
    const draft = await seedProduct(t, {
      code: "MINERAL-DRAFT",
      status: "draft",
      version: 2,
    });

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.policies.create, {
        customerUserId: staffCustomer,
        productId: published,
        country: "GB",
        premium: 100_000,
        startDate: TODAY,
      }),
    ).rejects.toThrow(/customer account/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.policies.create, {
        customerUserId: customer,
        productId: draft,
        country: "GB",
        premium: 100_000,
        startDate: TODAY,
      }),
    ).rejects.toThrow(/published/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.policies.create, {
        customerUserId: customer,
        productId: published,
        country: "FR",
        premium: 100_000,
        startDate: TODAY,
      }),
    ).rejects.toThrow(/not available in the selected country/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.policies.create, {
        customerUserId: customer,
        productId: published,
        country: "GB",
        premium: -100,
        startDate: TODAY,
      }),
    ).rejects.toThrow(/Premium/i);

    expect(
      await t.run(async (ctx) => (await ctx.db.query("policies").collect()).length),
    ).toBe(0);
  });

  it("is closed to non-staff callers", async () => {
    const t = test();
    const customer = await seedUser(t, {
      email: "member@cosmicvault.test",
      role: "customer",
    });
    const productId = await seedProduct(t);

    await expect(
      t.withIdentity({ subject: customer }).mutation(api.policies.create, {
        customerUserId: customer,
        productId,
        country: "GB",
        premium: 100_000,
        startDate: TODAY,
      }),
    ).rejects.toThrow(/restricted to staff/i);
  });
});

describe("staff-created accounts", () => {
  it("invites a customer with a profile, audit entry and welcome email", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    await seedReference(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.customers.invite, {
        name: "Morgan Ellis",
        email: "Morgan@Example.COM",
        country: "GB",
        currency: "GBP",
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      user: await ctx.db.get(result.userId),
      profile: await ctx.db
        .query("customerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", result.userId))
        .unique(),
      audit: await ctx.db.query("auditLogs").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));

    expect(stored.user).toMatchObject({
      name: "Morgan Ellis",
      email: "morgan@example.com",
      role: "customer",
      status: "active",
      isAnonymous: false,
    });
    // The verified marker is what lets Convex Auth link the invitation to the
    // account created on first sign-in instead of duplicating the identity.
    expect(stored.user?.emailVerificationTime).toBeTypeOf("number");
    expect(stored.profile).toMatchObject({
      fullName: "Morgan Ellis",
      email: "morgan@example.com",
      country: "GB",
      currency: "GBP",
      verificationStatus: "unverified",
    });
    expect(stored.profile?.reference).toBe(result.reference);
    expect(stored.audit.map((row) => row.action)).toContain("customer.invited");
    expect(stored.notifications[0]).toMatchObject({
      userId: result.userId,
      type: "account.welcome",
      emailStatus: "queued",
    });
  });

  it("rejects an email that already has an account", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    await seedReference(t);
    await seedUser(t, { email: "member@cosmicvault.test", role: "customer" });

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.customers.invite, {
        name: "Morgan Ellis",
        email: "member@cosmicvault.test",
        country: "GB",
        currency: "GBP",
      }),
    ).rejects.toThrow(/already has an account/i);
  });

  it("requires customers.manage to invite a customer", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.view"],
    });
    await seedReference(t);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.customers.invite, {
        name: "Morgan Ellis",
        email: "morgan@example.com",
        country: "GB",
        currency: "GBP",
      }),
    ).rejects.toThrow(/permission/i);
  });

  it("invites a broker with a brokerage profile", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["brokers.manage"],
    });
    await seedReference(t);

    const result = await t
      .withIdentity({ subject: admin })
      .mutation(api.brokers.invite, {
        name: "Alex Broker",
        email: "alex@brokerage.test",
        orgName: "Northline Brokerage",
        contactName: "Alex Broker",
        countries: ["GB"],
        commissionEnabled: true,
        commissionRate: 12,
      });
    await t.finishAllScheduledFunctions(() => {});

    const stored = await t.run(async (ctx) => ({
      user: await ctx.db.get(result.userId),
      profile: await ctx.db.get(result.brokerProfileId),
      audit: await ctx.db.query("auditLogs").collect(),
    }));

    expect(stored.user).toMatchObject({
      name: "Alex Broker",
      email: "alex@brokerage.test",
      role: "broker",
      status: "active",
    });
    expect(stored.user?.emailVerificationTime).toBeTypeOf("number");
    expect(stored.profile).toMatchObject({
      orgName: "Northline Brokerage",
      contactName: "Alex Broker",
      email: "alex@brokerage.test",
      countries: ["GB"],
      commissionEnabled: true,
      commissionRate: 12,
      status: "active",
    });
    expect(stored.profile?.reference).toMatch(/^BRK-/);
    expect(stored.audit.map((row) => row.action)).toContain("broker.invited");
  });

  it("lets a super admin create staff, but no one else", async () => {
    const t = test();
    const superAdmin = await seedUser(t, {
      email: "root@cosmicvault.test",
      role: "super_admin",
    });
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["staff.manage"],
    });

    const result = await t
      .withIdentity({ subject: superAdmin })
      .mutation(api.staff.invite, {
        name: "Noor Admin",
        email: "noor@cosmicvault.test",
        role: "admin",
      });
    await t.finishAllScheduledFunctions(() => {});

    const created = await t.run(
      async (ctx) => await ctx.db.get(result.userId),
    );
    expect(created).toMatchObject({
      name: "Noor Admin",
      email: "noor@cosmicvault.test",
      role: "admin",
      status: "active",
    });
    expect(created?.emailVerificationTime).toBeTypeOf("number");
    expect(created?.permissions?.length).toBeGreaterThan(0);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.staff.invite, {
        name: "Second Admin",
        email: "second@cosmicvault.test",
        role: "admin",
      }),
    ).rejects.toThrow(/Only a super admin/i);
  });

  it("refuses to duplicate a staff account that already signed up", async () => {
    const t = test();
    const superAdmin = await seedUser(t, {
      email: "root@cosmicvault.test",
      role: "super_admin",
    });
    await seedUser(t, { email: "existing@cosmicvault.test", role: "customer" });

    await expect(
      t.withIdentity({ subject: superAdmin }).mutation(api.staff.invite, {
        name: "Existing Person",
        email: "existing@cosmicvault.test",
        role: "admin",
      }),
    ).rejects.toThrow(/already has an account/i);
  });
});
