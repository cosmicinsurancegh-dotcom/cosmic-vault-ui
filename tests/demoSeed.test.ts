import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { internal } from "../src/convex/_generated/api";
import { DEMO_SEED_BATCH } from "../src/convex/demoSeed";

/**
 * `convex-test` needs a modules map whose keys are relative to the Convex
 * functions root and that includes the `_generated` directory so it can infer
 * that root. These tests import the real module (no generated mocks).
 */
const modules = {
  "../src/convex/_generated/api.js": () => import("../src/convex/_generated/api.js"),
  "../src/convex/demoSeed.ts": () => import("../src/convex/demoSeed"),
};

const test = () => convexTest(schema, modules);

type Test = ReturnType<typeof test>;

const SAMPLE = {
  confirm: DEMO_SEED_BATCH,
  allowDataOnlyIdentities: true,
};

async function preview(t: Test, allowDataOnlyIdentities = true) {
  return await t.query(internal.demoSeed.preview, { allowDataOnlyIdentities });
}

async function apply(t: Test, allowDataOnlyIdentities = true) {
  const plan = await preview(t, allowDataOnlyIdentities);
  return await t.mutation(internal.demoSeed.apply, {
    ...SAMPLE,
    allowDataOnlyIdentities,
    planHash: plan.planHash,
  });
}

async function addRealCustomerFixture(t: Test) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "real.customer@example.org",
      name: "Real Customer",
      role: "customer",
      status: "active",
    });
    await ctx.db.insert("customerProfiles", {
      userId,
      reference: "CUS-REAL01",
      fullName: "Real Customer",
      email: "real.customer@example.org",
      country: "GB",
      currency: "GBP",
      locale: "en-GB",
      timezone: "Europe/London",
      preferredLanguage: "en",
      marketingOptIn: false,
      verificationStatus: "verified",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return userId;
  });
}

const count = async (
  t: Test,
  table:
    | "users"
    | "customerProfiles"
    | "brokerProfiles"
    | "brokerAssignments"
    | "products"
    | "applications"
    | "policies"
    | "claims"
    | "transactions"
    | "documents"
    | "notifications"
    | "auditLogs",
) =>
  await t.run(async (ctx) => {
    const rows = await ctx.db.query(table).collect();
    return rows.length;
  });

beforeEach(() => {
  process.env.DEMO_SEED_ENABLED = "1";
  process.env.DEMO_SEED_ENVIRONMENT = "test";
});

afterEach(() => {
  delete process.env.DEMO_SEED_ENABLED;
  delete process.env.DEMO_SEED_ENVIRONMENT;
});

describe("demoSeed preview", () => {
  it("reports the full plan without writing anything", async () => {
    const t = test();
    const plan = await preview(t);

    expect(plan.blockers).toEqual([]);
    expect(plan.enabled).toBe(true);
    expect(plan.mode).toBe("sandbox-data-only");
    expect(plan.counts.planned).toMatchObject({
      users: 6,
      customerProfiles: 3,
      brokerProfiles: 2,
      brokerAssignments: 3,
      products: 5,
      applications: 12,
      policies: 8,
      claims: 6,
      transactions: 11,
      documents: 36,
      notifications: 17,
    });
    expect(plan.counts.toCreate.users).toBe(6);
    expect(await count(t, "users")).toBe(0);
    expect(await count(t, "products")).toBe(0);
    expect(await count(t, "policies")).toBe(0);
  });

  it("refuses writes when the deployment flag is off", async () => {
    const t = test();
    const plan = await preview(t);
    delete process.env.DEMO_SEED_ENABLED;

    await expect(
      t.mutation(internal.demoSeed.apply, { ...SAMPLE, planHash: plan.planHash }),
    ).rejects.toThrow(/disabled/i);
    expect(await count(t, "users")).toBe(0);
    expect(await count(t, "applications")).toBe(0);
  });

  it("rejects a stale plan hash before writing", async () => {
    const t = test();
    await expect(
      t.mutation(internal.demoSeed.apply, { ...SAMPLE, planHash: "fnv1a-deadbeef" }),
    ).rejects.toThrow(/stale/i);
    expect(await count(t, "users")).toBe(0);
  });

  it("blocks rather than overwriting an existing incompatible role", async () => {
    const t = test();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "admin@insureflow.demo",
        name: "Existing Broker Account",
        role: "broker",
        status: "active",
      });
    });

    const plan = await preview(t);
    expect(plan.blockers.join(" ")).toMatch(/cannot be elevated|exists with role/i);

    await expect(
      t.mutation(internal.demoSeed.apply, { ...SAMPLE, planHash: plan.planHash }),
    ).rejects.toThrow(/blocked/i);
    expect(await count(t, "products")).toBe(0);
  });
});

describe("demoSeed apply", () => {
  it("creates a relationally consistent dataset and passes verification", async () => {
    const t = test();
    const result = await apply(t);

    expect(result.created).toMatchObject({
      users: 6,
      customerProfiles: 3,
      brokerProfiles: 2,
      brokerAssignments: 3,
      products: 5,
      applications: 12,
      policies: 8,
      claims: 6,
      transactions: 11,
      documents: 36,
      notifications: 17,
      auditLogs: 40,
    });
    expect(result.integrity).toMatchObject({
      approvedApplicationsWithPolicy: 8,
      declinedApplicationsWithPolicy: 0,
      demoPolicies: 8,
      duplicatePolicyNumbers: 0,
      duplicateTransactionKeys: 0,
      demoNotificationsQueuedForEmail: 0,
      policiesWithPremiumReceipt: 8,
    });

    const verified = await t.query(internal.demoSeed.verify, {});
    expect(verified.demoCounts).toMatchObject({
      users: 6,
      applications: 12,
      policies: 8,
      claims: 6,
      transactions: 11,
    });
    expect(verified.allChecksPassed).toBe(true);
    expect(verified.statuses.applications).toMatchObject({
      approved: 8,
      declined: 1,
      draft: 1,
      submitted: 1,
      under_review: 1,
    });
    expect(verified.statuses.policies).toEqual({ active: 5, expired: 2, cancelled: 1 });
    expect(verified.brokerWorkload).toHaveLength(2);
    expect(verified.brokerWorkload.map((row) => row.assignedCustomers)).toEqual([2, 1]);
  });

  it("is idempotent across a fresh preview and second apply", async () => {
    const t = test();
    await apply(t);
    const before = await t.query(internal.demoSeed.verify, {});

    const secondPlan = await preview(t);
    expect(Object.values(secondPlan.counts.toCreate).every((value) => value === 0)).toBe(true);

    const second = await t.mutation(internal.demoSeed.apply, {
      ...SAMPLE,
      planHash: secondPlan.planHash,
    });
    expect(second.created).toEqual({});
    expect(second.verification).toEqual(before.demoCounts);
    expect(await count(t, "users")).toBe(6);
    expect(await count(t, "policies")).toBe(8);
  });

  it("leaves non-demo records untouched", async () => {
    const t = test();
    await addRealCustomerFixture(t);
    await apply(t);

    const verified = await t.query(internal.demoSeed.verify, {});
    expect(verified.nonDemoCounts).toMatchObject({
      users: 1,
      customerProfiles: 1,
      products: 0,
      applications: 0,
      policies: 0,
      claims: 0,
      transactions: 0,
    });
    expect(await count(t, "users")).toBe(7);
    expect(await count(t, "customerProfiles")).toBe(4);
  });
});

describe("demoSeed cleanup", () => {
  it("deletes only batch records after a matching preview", async () => {
    const t = test();
    await addRealCustomerFixture(t);
    await apply(t);

    const plan = await t.query(internal.demoSeed.cleanupPreview, {});
    expect(plan.safeToDelete).toBe(true);
    expect(plan.counts.users).toBe(6);

    const result = await t.mutation(internal.demoSeed.cleanup, {
      confirm: `delete:${DEMO_SEED_BATCH}`,
      planHash: plan.planHash,
    });
    expect(result.deleted).toMatchObject({
      users: 6,
      customerProfiles: 3,
      brokerProfiles: 2,
      products: 5,
      applications: 12,
      policies: 8,
      claims: 6,
      transactions: 11,
      notifications: 17,
    });

    expect(await count(t, "users")).toBe(1);
    expect(await count(t, "customerProfiles")).toBe(1);
    expect(await count(t, "products")).toBe(0);
    expect(await count(t, "applications")).toBe(0);
    expect(await count(t, "policies")).toBe(0);
    expect(await count(t, "claims")).toBe(0);
    expect(await count(t, "transactions")).toBe(0);
    expect(await count(t, "notifications")).toBe(0);

    const survivor = await t.run(async (ctx) => await ctx.db.query("users").first());
    expect(survivor?.email).toBe("real.customer@example.org");
  });

  it("rejects a stale cleanup hash and deletes nothing", async () => {
    const t = test();
    await apply(t);
    const plan = await t.query(internal.demoSeed.cleanupPreview, {});

    await expect(
      t.mutation(internal.demoSeed.cleanup, {
        confirm: `delete:${DEMO_SEED_BATCH}`,
        planHash: "fnv1a-deadbeef",
      }),
    ).rejects.toThrow(/stale/i);
    expect(await count(t, "users")).toBe(6);
    expect(await count(t, "policies")).toBe(8);
    expect(plan.safeToDelete).toBe(true);
  });

  it("refuses cleanup when a demo account has an auth account", async () => {
    const t = test();
    await apply(t);
    await t.run(async (ctx) => {
      const demoAdmin = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "admin@insureflow.demo"))
        .first();
      if (!demoAdmin) throw new Error("demo admin missing");
      await ctx.db.insert("authAccounts", {
        userId: demoAdmin._id,
        provider: "email-otp",
        providerAccountId: "admin@insureflow.demo",
      });
    });

    const plan = await t.query(internal.demoSeed.cleanupPreview, {});
    expect(plan.safeToDelete).toBe(false);
    expect(plan.blockers.join(" ")).toMatch(/Convex Auth account/i);

    await expect(
      t.mutation(internal.demoSeed.cleanup, {
        confirm: `delete:${DEMO_SEED_BATCH}`,
        planHash: plan.planHash,
      }),
    ).rejects.toThrow(/blocked/i);
    expect(await count(t, "users")).toBe(6);
  });
});

describe("demoSeed deactivate", () => {
  it("suspends demo identities and archives demo products without deleting history", async () => {
    const t = test();
    await apply(t);

    const result = await t.mutation(internal.demoSeed.deactivate, {
      confirm: `deactivate:${DEMO_SEED_BATCH}`,
    });
    expect(result).toMatchObject({ suspendedUsers: 6, archivedProducts: 5 });

    const users = await t.run(async (ctx) => await ctx.db.query("users").collect());
    expect(users.every((user) => user.status === "suspended")).toBe(true);
    const products = await t.run(async (ctx) => await ctx.db.query("products").collect());
    expect(products.every((product) => product.status === "archived")).toBe(true);
    expect(await count(t, "policies")).toBe(8);
    expect(await count(t, "claims")).toBe(6);
  });
});
