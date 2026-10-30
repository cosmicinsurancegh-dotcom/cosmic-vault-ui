import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { api } from "../src/convex/_generated/api";
import { RATE_LIMITS } from "../src/convex/lib/rateLimit";

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
  "../src/convex/tickets.ts": () => import("../src/convex/tickets"),
  // Creating a ticket queues the receipt email, and convex-test resolves the
  // scheduled delivery, so both ends of that hand-off are registered here.
  "../src/convex/notifications.ts": () => import("../src/convex/notifications"),
  "../src/convex/email.ts": () => import("../src/convex/email"),
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

describe("support tickets", () => {
  /** A ticket that names a record. `relatedId` is whatever the creator sent,
   *  so the thread must re-check that the record belongs to the ticket owner. */
  async function seedTicket(
    t: Test,
    userId: Awaited<ReturnType<typeof seedUser>>,
    relatedId: string,
  ) {
    return await t.run(async (ctx) =>
      await ctx.db.insert("tickets", {
        reference: "SUP-RELATED",
        userId,
        category: "payment",
        subject: "Where is my refund?",
        message: "The refund has not reached my account.",
        status: "open",
        priority: "normal",
        relatedType: "transactions",
        relatedId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }

  it("resolves the linked record for the customer who owns it", async () => {
    const t = test();
    const owner = await seedUser(t, { email: "owner@example.com" });
    const transactionId = await t.run(async (ctx) =>
      await ctx.db.insert("transactions", {
        reference: "PAY-LINKED",
        customerUserId: owner,
        type: "refund",
        amount: 48000,
        currency: "GBP",
        status: "succeeded",
        method: "bank_transfer",
        providerVerified: true,
        reconciled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const ticketId = await seedTicket(t, owner, transactionId);

    const view = await t
      .withIdentity({ subject: owner })
      .query(api.tickets.get, { ticketId });

    expect(view.related).toEqual({
      type: "transactions",
      reference: "PAY-LINKED",
      title: "Refund",
      status: "succeeded",
      amount: 48000,
      currency: "GBP",
    });
  });

  it("never resolves another customer's record through a ticket", async () => {
    const t = test();
    const owner = await seedUser(t, { email: "owner@example.com" });
    const other = await seedUser(t, { email: "other@example.com" });
    const transactionId = await t.run(async (ctx) =>
      await ctx.db.insert("transactions", {
        reference: "PAY-NOT-MINE",
        customerUserId: owner,
        type: "premium",
        amount: 12000,
        currency: "GBP",
        status: "succeeded",
        method: "card",
        providerVerified: true,
        reconciled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    // The ticket belongs to `other` but names the owner's payment.
    const ticketId = await seedTicket(t, other, transactionId);

    const asStaff = await t
      .withIdentity({ subject: await seedUser(t, { email: "staff@example.com", role: "admin" }) })
      .query(api.tickets.get, { ticketId });

    expect(asStaff.related).toBeNull();
    await expect(
      t.withIdentity({ subject: owner }).query(api.tickets.get, { ticketId }),
    ).rejects.toThrow(/access/i);
  });

  it("hides the record from staff without the permission for it", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const limitedStaff = await t.run(async (ctx) =>
      await ctx.db.insert("users", {
        email: "limited@example.com",
        role: "admin",
        status: "active",
        // Can read the ticket, but not payments.
        permissions: ["customers.view"],
      }),
    );
    const transactionId = await t.run(async (ctx) =>
      await ctx.db.insert("transactions", {
        reference: "PAY-HIDDEN",
        customerUserId: customer,
        type: "premium",
        amount: 9000,
        currency: "GBP",
        status: "succeeded",
        method: "card",
        providerVerified: true,
        reconciled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const ticketId = await seedTicket(t, customer, transactionId);

    const view = await t
      .withIdentity({ subject: limitedStaff })
      .query(api.tickets.get, { ticketId });

    expect(view.related).toBeNull();
  });

  async function seedPayment(
    t: Test,
    customerUserId: Awaited<ReturnType<typeof seedUser>>,
    reference: string,
  ) {
    return await t.run(async (ctx) =>
      await ctx.db.insert("transactions", {
        reference,
        customerUserId,
        type: "premium",
        amount: 15000,
        currency: "GBP",
        status: "succeeded",
        method: "card",
        providerVerified: true,
        reconciled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }

  const NEW_TICKET = {
    category: "payment",
    subject: "Refund missing",
    message: "The refund has not reached my account.",
  };

  it("links a record the member owns", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const paymentId = await seedPayment(t, customer, "PAY-OWNED");

    await t.withIdentity({ subject: customer }).mutation(api.tickets.create, {
      ...NEW_TICKET,
      relatedType: "transactions",
      relatedId: paymentId,
    });

    const stored = await t.run(
      async (ctx) => await ctx.db.query("tickets").first(),
    );
    expect(stored).toMatchObject({
      relatedType: "transactions",
      relatedId: paymentId,
    });
  });

  it("refuses to link a record that belongs to another member", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const other = await seedUser(t, { email: "other@example.com" });
    const paymentId = await seedPayment(t, other, "PAY-SOMEONE-ELSE");

    await expect(
      t.withIdentity({ subject: customer }).mutation(api.tickets.create, {
        ...NEW_TICKET,
        relatedType: "transactions",
        relatedId: paymentId,
      }),
    ).rejects.toThrow(/belongs to you/i);

    const tickets = await t.run(
      async (ctx) => await ctx.db.query("tickets").collect(),
    );
    expect(tickets).toHaveLength(0);
  });

  it("refuses an unknown record type and a half-specified link", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const signedIn = t.withIdentity({ subject: customer });

    await expect(
      signedIn.mutation(api.tickets.create, {
        ...NEW_TICKET,
        relatedType: "storage",
        relatedId: "whatever",
      }),
    ).rejects.toThrow(/cannot be linked/i);

    await expect(
      signedIn.mutation(api.tickets.create, {
        ...NEW_TICKET,
        relatedType: "transactions",
      }),
    ).rejects.toThrow(/both/i);
  });

  async function seedProduct(t: Test) {
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
        exclusions: [],
        benefits: [],
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
      }),
    );
  }

  async function seedApplication(
    t: Test,
    customerUserId: Awaited<ReturnType<typeof seedUser>>,
    reference: string,
    brokerUserId?: Awaited<ReturnType<typeof seedUser>>,
  ) {
    const productId = await seedProduct(t);
    return await t.run(async (ctx) =>
      await ctx.db.insert("applications", {
        reference,
        customerUserId,
        brokerUserId,
        productId,
        productCode: "MINERAL-ALLRISK",
        productVersion: 1,
        productName: "Mineral all-risk",
        categoryKey: "minerals",
        country: "GB",
        currency: "GBP",
        premium: 120_000,
        answers: {},
        status: "submitted",
        documents: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }

  it("links an application in the member's own book", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const applicationId = await seedApplication(
      t,
      customer,
      "APP-OWNED",
    );

    await t.withIdentity({ subject: customer }).mutation(api.tickets.create, {
      ...NEW_TICKET,
      relatedType: "applications",
      relatedId: applicationId,
    });

    const ticketId = await t.run(
      async (ctx) => (await ctx.db.query("tickets").first())!._id,
    );
    const view = await t
      .withIdentity({ subject: customer })
      .query(api.tickets.get, { ticketId });

    expect(view.related).toMatchObject({
      type: "applications",
      reference: "APP-OWNED",
      title: "Mineral all-risk",
      status: "submitted",
    });
  });

  it("refuses an application outside the member's book", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const other = await seedUser(t, { email: "other@example.com" });
    const applicationId = await seedApplication(t, other, "APP-NOT-MINE");

    await expect(
      t.withIdentity({ subject: customer }).mutation(api.tickets.create, {
        ...NEW_TICKET,
        relatedType: "applications",
        relatedId: applicationId,
      }),
    ).rejects.toThrow(/belongs to you/i);
  });

  it("lets a broker link an application held by one of their customers", async () => {
    const t = test();
    const broker = await seedUser(t, {
      email: "broker@example.com",
      role: "broker",
    });
    const customer = await seedUser(t, { email: "customer@example.com" });
    const applicationId = await seedApplication(t, customer, "APP-BOOK");

    // The active assignment is what puts the application in the broker's book.
    await t.run(
      async (ctx) =>
        await ctx.db.insert("brokerAssignments", {
          brokerUserId: broker,
          customerUserId: customer,
          status: "active",
          assignedBy: broker,
          createdAt: Date.now(),
        }),
    );

    await t.withIdentity({ subject: broker }).mutation(api.tickets.create, {
      ...NEW_TICKET,
      relatedType: "applications",
      relatedId: applicationId,
    });

    const stored = await t.run(
      async (ctx) => await ctx.db.query("tickets").first(),
    );
    expect(stored).toMatchObject({
      relatedType: "applications",
      relatedId: applicationId,
    });
  });

  async function seedPolicy(
    t: Test,
    customerUserId: Awaited<ReturnType<typeof seedUser>>,
    applicationId: Awaited<ReturnType<typeof seedApplication>>,
    issuedBy: Awaited<ReturnType<typeof seedUser>>,
  ) {
    const application = await t.run(
      async (ctx) => await ctx.db.get(applicationId),
    );
    if (!application) throw new Error("The application fixture is missing.");
    const year = 365 * 24 * 60 * 60 * 1000;
    return await t.run(async (ctx) =>
      await ctx.db.insert("policies", {
        policyNumber: "POL-BOOK",
        customerUserId,
        applicationId,
        productId: application.productId,
        productCode: application.productCode,
        productVersion: application.productVersion,
        productName: application.productName,
        categoryKey: application.categoryKey,
        status: "active",
        insuredName: "Ada Lovelace",
        country: "GB",
        currency: "GBP",
        premium: 120_000,
        excess: 50_000,
        coverageLimit: 5_000_000,
        exclusions: [],
        benefits: [],
        wordingVersion: "2026.1",
        startDate: Date.now(),
        endDate: Date.now() + year,
        renewalDate: Date.now() + year - 30 * 24 * 60 * 60 * 1000,
        issuedBy,
        issuedAt: Date.now(),
        endorsements: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }

  it("lets a broker link a policy held by one of their customers", async () => {
    const t = test();
    const broker = await seedUser(t, {
      email: "broker@example.com",
      role: "broker",
    });
    const customer = await seedUser(t, { email: "customer@example.com" });
    const applicationId = await seedApplication(t, customer, "APP-POLICY");
    const policyId = await seedPolicy(t, customer, applicationId, broker);

    // Outside the book until the customer is assigned to the broker.
    await expect(
      t.withIdentity({ subject: broker }).mutation(api.tickets.create, {
        ...NEW_TICKET,
        relatedType: "policies",
        relatedId: policyId,
      }),
    ).rejects.toThrow(/belongs to you/i);

    await t.run(
      async (ctx) =>
        await ctx.db.insert("brokerAssignments", {
          brokerUserId: broker,
          customerUserId: customer,
          status: "active",
          assignedBy: broker,
          createdAt: Date.now(),
        }),
    );

    await t.withIdentity({ subject: broker }).mutation(api.tickets.create, {
      ...NEW_TICKET,
      category: "policy",
      relatedType: "policies",
      relatedId: policyId,
    });

    const stored = await t.run(
      async (ctx) => await ctx.db.query("tickets").first(),
    );
    expect(stored).toMatchObject({
      relatedType: "policies",
      relatedId: policyId,
    });

    const view = await t
      .withIdentity({ subject: broker })
      .query(api.tickets.get, { ticketId: stored!._id });
    expect(view.related).toMatchObject({
      type: "policies",
      reference: "POL-BOOK",
      status: "active",
    });
  });

  it("emails a receipt with the reference and the reply promise", async () => {
    const t = test();
    const customer = await seedUser(t, {
      email: "ada@example.com",
      name: "Ada Lovelace",
    });

    const { reference } = await t
      .withIdentity({ subject: customer })
      .mutation(api.tickets.create, NEW_TICKET);

    const receipt = await t.run(
      async (ctx) =>
        await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", customer))
          .first(),
    );

    expect(receipt).toMatchObject({
      type: "support.created",
      href: "/dashboard/support",
      relatedType: "tickets",
    });
    // The member needs the printed SUP reference, not the internal id.
    expect(receipt?.emailSubject).toContain(reference);
    expect(receipt?.emailText).toContain(reference);
    expect(receipt?.emailText).toContain("Hello Ada,");
    // The promise comes from Settings, whose default is 24 hours.
    expect(receipt?.emailText).toContain("within 24 hours");
  });

  async function seedQueueTicket(
    t: Test,
    userId: Awaited<ReturnType<typeof seedUser>>,
    overrides: {
      status?: "open" | "awaiting_customer" | "resolved" | "closed";
      priority?: "low" | "normal" | "high";
      assignedTo?: Awaited<ReturnType<typeof seedUser>>;
      createdAt?: number;
    } = {},
  ) {
    return await t.run(async (ctx) =>
      await ctx.db.insert("tickets", {
        reference: `SUP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        userId,
        category: "payment",
        subject: "Waiting in the queue",
        message: "This one has not been picked up yet.",
        status: overrides.status ?? "open",
        priority: overrides.priority ?? "normal",
        assignedTo: overrides.assignedTo,
        createdAt: overrides.createdAt ?? Date.now(),
        updatedAt: overrides.createdAt ?? Date.now(),
      }),
    );
  }

  it("lets staff claim and release a ticket, and keeps members out", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const admin = await seedUser(t, {
      email: "staff@example.com",
      role: "admin",
    });
    const ticketId = await seedQueueTicket(t, customer);

    await expect(
      t
        .withIdentity({ subject: customer })
        .mutation(api.tickets.assign, { ticketId, assigneeId: customer }),
    ).rejects.toThrow(/restricted to staff/i);

    // A member can never become the owner of a queue item.
    await expect(
      t
        .withIdentity({ subject: admin })
        .mutation(api.tickets.assign, { ticketId, assigneeId: customer }),
    ).rejects.toThrow(/assigned to staff/i);

    await t
      .withIdentity({ subject: admin })
      .mutation(api.tickets.assign, { ticketId, assigneeId: admin });
    expect(
      await t.run(async (ctx) => (await ctx.db.get(ticketId))?.assignedTo),
    ).toBe(admin);

    await t.withIdentity({ subject: admin }).mutation(api.tickets.assign, {
      ticketId,
    });
    // Releasing clears the owner; the runtimes differ on undefined vs null.
    expect(
      (await t.run(async (ctx) => (await ctx.db.get(ticketId))?.assignedTo)) ??
        null,
    ).toBeNull();
    expect(
      await t
        .withIdentity({ subject: admin })
        .query(api.tickets.queueSummary, {}),
    ).toMatchObject({ unassigned: 1 });
  });

  it("summarises the unassigned queue for staff only", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const admin = await seedUser(t, {
      email: "staff@example.com",
      role: "admin",
    });
    const oldest = Date.now() - 3 * 24 * 60 * 60 * 1000;

    await seedQueueTicket(t, customer, { priority: "high", createdAt: oldest });
    await seedQueueTicket(t, customer, { createdAt: oldest + 60_000 });
    await seedQueueTicket(t, customer, { assignedTo: admin });
    // Neither of these is work waiting for the support team.
    await seedQueueTicket(t, customer, { status: "awaiting_customer" });
    await seedQueueTicket(t, customer, { status: "resolved" });

    const summary = await t
      .withIdentity({ subject: admin })
      .query(api.tickets.queueSummary, {});

    expect(summary).toMatchObject({
      unassigned: 2,
      highPriority: 1,
      oldestUnassignedAt: oldest,
    });
    // The age is computed in the query so the dashboard never reads the clock
    // during a render.
    expect(summary.oldestUnassignedDays).toBeGreaterThanOrEqual(3);

    await expect(
      t.withIdentity({ subject: customer }).query(api.tickets.queueSummary, {}),
    ).rejects.toThrow(/restricted to staff/i);
  });

  it("limits how many tickets one member can open", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "customer@example.com" });
    const signedIn = t.withIdentity({ subject: customer });

    for (let attempt = 0; attempt < RATE_LIMITS.ticketPerUser.limit; attempt += 1) {
      await signedIn.mutation(api.tickets.create, NEW_TICKET);
    }

    await expect(
      signedIn.mutation(api.tickets.create, NEW_TICKET),
    ).rejects.toThrow(/Too many requests/i);
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

