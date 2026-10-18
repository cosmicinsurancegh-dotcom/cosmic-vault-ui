import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";

/**
 * Security regression tests for the server-side boundaries that the React app
 * relies on: authorisation on staff functions, the public lead path's input
 * caps and rate limits, and the founding-super-admin check once the users table
 * is larger than a single scan window.
 *
 * `convex-test` runs the real function modules against an in-memory database,
 * so these assertions exercise the same guards as the deployment.
 */
const modules = {
  "../src/convex/_generated/api.js": () => import("../src/convex/_generated/api.js"),
  "../src/convex/quotes.ts": () => import("../src/convex/quotes"),
  "../src/convex/customers.ts": () => import("../src/convex/customers"),
  "../src/convex/setup.ts": () => import("../src/convex/setup"),
  "../src/convex/documents.ts": () => import("../src/convex/documents"),
  "../src/convex/payments.ts": () => import("../src/convex/payments"),
};

const test = () => convexTest(schema, modules);
type Test = ReturnType<typeof test>;

const VALID_QUOTE = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  coverage: "home" as const,
  message: "Looking for buildings and contents cover.",
};

async function seedUser(
  t: Test,
  user: {
    email: string;
    name?: string;
    role?: "super_admin" | "admin" | "broker" | "customer";
    status?: "active" | "suspended";
  },
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      email: user.email,
      name: user.name ?? user.email,
      role: user.role ?? "customer",
      status: user.status ?? "active",
    }),
  );
}

async function quoteCount(t: Test, email?: string) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("quotes").collect();
    return email ? rows.filter((row) => row.email === email).length : rows.length;
  });
}

describe("public quote requests", () => {
  it("normalises and stores a valid lead", async () => {
    const t = test();
    const result = await t.mutation(api.quotes.requestQuote, {
      ...VALID_QUOTE,
      email: "  Ada@Example.COM ",
      name: "  Ada Lovelace  ",
    });

    expect(result.reference).toMatch(/^CV-/);
    const stored = await t.run(async (ctx) =>
      await ctx.db.query("quotes").first(),
    );
    expect(stored).toMatchObject({
      email: "ada@example.com",
      name: "Ada Lovelace",
      status: "in_review",
      coverage: "home",
    });
    expect(stored?.userId).toBeUndefined();
  });

  it("rejects invalid and oversized input before writing", async () => {
    const t = test();

    await expect(
      t.mutation(api.quotes.requestQuote, { ...VALID_QUOTE, name: "A" }),
    ).rejects.toThrow(/full name/i);

    await expect(
      t.mutation(api.quotes.requestQuote, { ...VALID_QUOTE, email: "not-an-email" }),
    ).rejects.toThrow(/valid email/i);

    await expect(
      t.mutation(api.quotes.requestQuote, {
        ...VALID_QUOTE,
        name: "A".repeat(300),
      }),
    ).rejects.toThrow(/too long/i);

    await expect(
      t.mutation(api.quotes.requestQuote, {
        ...VALID_QUOTE,
        message: "x".repeat(5000),
      }),
    ).rejects.toThrow(/too long/i);

    expect(await quoteCount(t)).toBe(0);
  });

  it("caps repeated requests from one email and recovers when the window rolls over", async () => {
    const t = test();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await t.mutation(api.quotes.requestQuote, VALID_QUOTE);
    }
    expect(await quoteCount(t, "ada@example.com")).toBe(3);

    await expect(
      t.mutation(api.quotes.requestQuote, VALID_QUOTE),
    ).rejects.toThrow(/Too many requests/i);
    expect(await quoteCount(t, "ada@example.com")).toBe(3);

    // A different address has its own bucket: one spammer cannot lock the form.
    await t.mutation(api.quotes.requestQuote, {
      ...VALID_QUOTE,
      email: "grace@example.com",
    });
    expect(await quoteCount(t, "grace@example.com")).toBe(1);

    // Simulate the fixed window expiring, then confirm normal traffic resumes.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("rateLimits")
        .withIndex("by_key", (q) => q.eq("key", "quote.email:ada@example.com"))
        .unique();
      if (!row) throw new Error("rate limit row missing");
      await ctx.db.patch(row._id, {
        windowStart: Date.now() - 11 * 60_000,
        count: 3,
      });
    });

    await t.mutation(api.quotes.requestQuote, VALID_QUOTE);
    expect(await quoteCount(t, "ada@example.com")).toBe(4);
  });

  it("gives signed-in members a separate bucket keyed by user id", async () => {
    const t = test();
    const userId = await seedUser(t, { email: "member@example.com" });
    const signedIn = t.withIdentity({ subject: userId });

    // Ten distinct addresses stay under the per-email limit, so only the
    // per-user bucket can stop the eleventh request.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await signedIn.mutation(api.quotes.requestQuote, {
        ...VALID_QUOTE,
        email: `member${attempt}@example.com`,
      });
    }

    await expect(
      signedIn.mutation(api.quotes.requestQuote, {
        ...VALID_QUOTE,
        email: "fresh@example.com",
      }),
    ).rejects.toThrow(/Too many requests/i);

    // The visitor's bucket is untouched: limits follow the identity, not the
    // email address a member happens to type.
    await t.mutation(api.quotes.requestQuote, {
      ...VALID_QUOTE,
      email: "fresh@example.com",
    });
    expect(await quoteCount(t, "fresh@example.com")).toBe(1);
  });
});

describe("authorisation boundaries", () => {
  it("rejects anonymous callers on staff and upload functions", async () => {
    const t = test();

    await expect(t.query(api.customers.directory, {})).rejects.toThrow(
      /sign in/i,
    );
    await expect(t.query(api.payments.listStaff, {})).rejects.toThrow(
      /sign in/i,
    );
    await expect(t.mutation(api.documents.generateUploadUrl, {})).rejects.toThrow(
      /sign in/i,
    );
  });

  it("rejects customers from staff-only queries and mutations", async () => {
    const t = test();
    const userId = await seedUser(t, { email: "customer@example.com" });

    await expect(
      t.withIdentity({ subject: userId }).query(api.customers.directory, {}),
    ).rejects.toThrow(/restricted to staff/i);

    await expect(
      t.withIdentity({ subject: userId }).query(api.payments.listStaff, {}),
    ).rejects.toThrow(/restricted to staff/i);

    await expect(
      t.withIdentity({ subject: userId }).query(api.customers.lookupByEmail, {
        email: "someone@example.com",
      }),
    ).rejects.toThrow(/restricted to staff/i);
  });

  it("does not reveal another member's transaction by reference", async () => {
    const t = test();
    const owner = await seedUser(t, { email: "owner@example.com" });
    const other = await seedUser(t, { email: "other@example.com" });

    await t.run(async (ctx) => {
      await ctx.db.insert("transactions", {
        reference: "PAY-REFLEAK",
        customerUserId: owner,
        type: "premium",
        amount: 48000,
        currency: "GBP",
        status: "succeeded",
        method: "bank_transfer",
        providerVerified: true,
        reconciled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asOther = await t
      .withIdentity({ subject: other })
      .query(api.payments.mineByReference, { reference: "pay-refleak" });
    expect(asOther).toBeNull();

    const asOwner = await t
      .withIdentity({ subject: owner })
      .query(api.payments.mineByReference, { reference: "PAY-REFLEAK" });
    expect(asOwner?.reference).toBe("PAY-REFLEAK");
  });
});

describe("founding super admin claim", () => {
  it("stays closed when the super admin is beyond a 200-row scan", async () => {
    const t = test();

    // Fill the table ahead of the real super admin, then add the super admin.
    await t.run(async (ctx) => {
      for (let index = 0; index < 250; index += 1) {
        await ctx.db.insert("users", {
          email: `filler${index}@example.com`,
          name: `Filler ${index}`,
          role: "customer",
          status: "active",
        });
      }
      await ctx.db.insert("users", {
        email: "founder@example.com",
        name: "Founder",
        role: "super_admin",
        status: "active",
      });
    });

    const newcomer = await seedUser(t, { email: "newcomer@example.com" });

    const status = await t
      .withIdentity({ subject: newcomer })
      .query(api.setup.status, {});
    expect(status.hasSuperAdmin).toBe(true);

    const result = await t
      .withIdentity({ subject: newcomer })
      .mutation(api.setup.bootstrap, {});
    expect(result).toEqual({ promoted: false, hasSuperAdmin: true });

    const after = await t.run(async (ctx) => await ctx.db.get(newcomer));
    expect(after?.role).toBe("customer");
  });

  it("refuses the founding claim from an anonymous guest session", async () => {
    const t = test();
    const guest = await t.run(async (ctx) =>
      await ctx.db.insert("users", {
        name: "Guest",
        isAnonymous: true,
        role: "customer",
        status: "active",
      }),
    );

    await expect(
      t.withIdentity({ subject: guest }).mutation(api.setup.bootstrap, {}),
    ).rejects.toThrow(/email address/i);

    const after = await t.run(async (ctx) => await ctx.db.get(guest));
    expect(after?.role).toBe("customer");
  });

  it("still lets the first signed-in user claim the seat when none exists", async () => {
    const t = test();
    const first = await seedUser(t, { email: "first@example.com" });

    const result = await t
      .withIdentity({ subject: first })
      .mutation(api.setup.bootstrap, {});
    expect(result).toEqual({ promoted: true, hasSuperAdmin: true });

    const after = await t.run(async (ctx) => await ctx.db.get(first));
    expect(after?.role).toBe("super_admin");

    const second = await seedUser(t, { email: "second@example.com" });
    const secondResult = await t
      .withIdentity({ subject: second })
      .mutation(api.setup.bootstrap, {});
    expect(secondResult.promoted).toBe(false);
  });
});

