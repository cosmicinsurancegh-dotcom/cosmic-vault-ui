import { convexTest } from "convex-test";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import schema from "../src/convex/schema";
import { internalAction } from "../src/convex/_generated/server";
import { api } from "../src/convex/_generated/api";

/**
 * Editing and deleting accounts.
 *
 * These run the real modules through `convex-test`, so the checks are the ones
 * the deployment performs: who may change an address or a password, that a
 * credential moves with the address instead of forking the identity, and that a
 * deleted account loses its way in while its policies, claims and payments stay
 * behind.
 *
 * The email adapter is a scheduled action that runs a mutation internally, which
 * convex-test cannot nest, so it is replaced by a no-op. Delivery itself is
 * covered by the adapter's own tests.
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
  "../src/convex/accountSecurity.ts": () =>
    import("../src/convex/accountSecurity"),
  "../src/convex/customers.ts": () => import("../src/convex/customers"),
  "../src/convex/auth.ts": () => import("../src/convex/auth"),
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
    verified?: boolean;
  },
) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("users", {
      name: user.name ?? user.email,
      email: user.email,
      role: user.role ?? "customer",
      status: "active",
      permissions: user.permissions,
      emailVerificationTime: user.verified === false ? undefined : Date.now(),
    }),
  );
}

async function seedProfile(t: Test, userId: Awaited<ReturnType<typeof seedUser>>) {
  return await t.run(async (ctx) =>
    await ctx.db.insert("customerProfiles", {
      userId,
      reference: "CUS-TEST",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+44 20 7946 0000",
      dateOfBirth: "1990-01-01",
      country: "GB",
      city: "London",
      addressLine: "1 Vault Street",
      postalCode: "EC1A 1AA",
      currency: "GBP",
      locale: "en-GB",
      timezone: "Europe/London",
      preferredLanguage: "en",
      marketingOptIn: true,
      verificationStatus: "verified",
      notes: "Prefers email.",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

async function credentialsFor(
  t: Test,
  userId: Awaited<ReturnType<typeof seedUser>>,
) {
  return await t.run(async (ctx) =>
    await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect(),
  );
}

async function auditFor(t: Test, action: string) {
  return await t.run(async (ctx) =>
    await ctx.db
      .query("auditLogs")
      .withIndex("by_action", (q) => q.eq("action", action))
      .collect(),
  );
}

describe("changing the sign-in email", () => {
  it("moves the credentials with the address, so the identity does not fork", async () => {
    const t = test();
    const user = await seedUser(t, { email: "ada@example.com" });
    await seedProfile(t, user);
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: user,
        provider: "password",
        providerAccountId: "ada@example.com",
        secret: "hashed",
      });
      await ctx.db.insert("authAccounts", {
        userId: user,
        provider: "email-otp",
        providerAccountId: "ada@example.com",
      });
    });

    const result = await t
      .withIdentity({ subject: user })
      .mutation(api.accountSecurity.changeEmail, { email: "Ada@New.example" });

    expect(result).toEqual({
      previous: "ada@example.com",
      email: "ada@new.example",
    });

    const stored = await t.run(async (ctx) => await ctx.db.get(user));
    expect(stored?.email).toBe("ada@new.example");

    const accounts = await credentialsFor(t, user);
    expect(accounts.map((account) => account.providerAccountId)).toEqual([
      "ada@new.example",
      "ada@new.example",
    ]);

    // The customer profile follows, so the console and the code route agree.
    const profile = await t.run((ctx) =>
      ctx.db
        .query("customerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user))
        .unique(),
    );
    expect(profile?.email).toBe("ada@new.example");

    const audit = await auditFor(t, "account.email_changed");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: user,
      entityType: "users",
      entityId: user,
      before: { email: "ada@example.com" },
      after: { email: "ada@new.example" },
    });
  });

  it("refuses an address another account already signs in with", async () => {
    const t = test();
    const user = await seedUser(t, { email: "ada@example.com" });
    const other = await seedUser(t, { email: "grace@example.com" });

    await expect(
      t
        .withIdentity({ subject: user })
        .mutation(api.accountSecurity.changeEmail, { email: "grace@example.com" }),
    ).rejects.toThrow(/already belongs to another account/i);

    const stored = await t.run(async (ctx) => await ctx.db.get(user));
    expect(stored?.email).toBe("ada@example.com");
    // Nothing was moved for the other account either.
    const untouched = await t.run(async (ctx) => await ctx.db.get(other));
    expect(untouched?.email).toBe("grace@example.com");
  });

  it("rejects a malformed address", async () => {
    const t = test();
    const user = await seedUser(t, { email: "ada@example.com" });

    await expect(
      t
        .withIdentity({ subject: user })
        .mutation(api.accountSecurity.changeEmail, { email: "not-an-address" }),
    ).rejects.toThrow(/valid email/i);
  });

  it("lets staff change a customer's address, recorded against the staff member", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, { email: "ada@example.com" });

    await t
      .withIdentity({ subject: admin })
      .mutation(api.accountSecurity.staffChangeEmail, {
        userId: customer,
        email: "ada@new.example",
      });

    const stored = await t.run(async (ctx) => await ctx.db.get(customer));
    expect(stored?.email).toBe("ada@new.example");

    const audit = await auditFor(t, "account.email_changed_by_staff");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: admin, entityId: customer });
  });

  it("keeps a customer out of another customer's email", async () => {
    const t = test();
    const customer = await seedUser(t, { email: "ada@example.com" });
    const other = await seedUser(t, { email: "grace@example.com" });

    await expect(
      t
        .withIdentity({ subject: customer })
        .mutation(api.accountSecurity.staffChangeEmail, {
          userId: other,
          email: "taken@example.com",
        }),
    ).rejects.toThrow(/restricted|permission/i);
  });
});

describe("staff setting a customer's password", () => {
  it("attaches a password to the existing identity and tells the customer", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, { email: "ada@example.com" });

    await t
      .withIdentity({ subject: admin })
      .action(api.accountSecurity.staffSetPassword, {
        userId: customer,
        password: "a fresh password",
      });

    const accounts = await credentialsFor(t, customer);
    const password = accounts.find((account) => account.provider === "password");
    expect(password?.providerAccountId).toBe("ada@example.com");
    // Stored hashed, never as typed.
    expect(password?.secret).toBeTruthy();
    expect(password?.secret).not.toBe("a fresh password");
    // And on the customer's identity, not a duplicate one.
    expect(password?.userId).toBe(customer);

    const audit = await auditFor(t, "account.password_reset_by_staff");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: admin, entityId: customer });

    const notice = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", customer))
        .collect(),
    );
    expect(notice.some((row) => row.title === "Your password was reset")).toBe(
      true,
    );
  });

  it("replaces a password that already exists", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, { email: "ada@example.com" });
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: customer,
        provider: "password",
        providerAccountId: "ada@example.com",
        secret: "previous-hash",
      });
    });

    await t
      .withIdentity({ subject: admin })
      .action(api.accountSecurity.staffSetPassword, {
        userId: customer,
        password: "another password",
      });

    const accounts = await credentialsFor(t, customer);
    const passwords = accounts.filter((account) => account.provider === "password");
    expect(passwords).toHaveLength(1);
    expect(passwords[0]?.secret).not.toBe("previous-hash");
  });

  it("refuses staff accounts and callers without the permission", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const anotherAdmin = await seedUser(t, {
      email: "other@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, { email: "ada@example.com" });

    await expect(
      t
        .withIdentity({ subject: admin })
        .action(api.accountSecurity.staffSetPassword, {
          userId: anotherAdmin,
          password: "a fresh password",
        }),
    ).rejects.toThrow(/staff management|staff password/i);

    await expect(
      t
        .withIdentity({ subject: customer })
        .action(api.accountSecurity.staffSetPassword, {
          userId: customer,
          password: "a fresh password",
        }),
    ).rejects.toThrow(/restricted|permission/i);

    expect(await credentialsFor(t, customer)).toHaveLength(0);
  });

  it("refuses an address the account has not confirmed", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, {
      email: "ada@example.com",
      verified: false,
    });

    await expect(
      t
        .withIdentity({ subject: admin })
        .action(api.accountSecurity.staffSetPassword, {
          userId: customer,
          password: "a fresh password",
        }),
    ).rejects.toThrow(/has not confirmed its email/i);
  });
});

describe("deleting an account", () => {
  it("removes the way in and the personal details, keeping the business records", async () => {
    const t = test();
    const user = await seedUser(t, { email: "ada@example.com" });
    await seedProfile(t, user);
    const session = await t.run(async (ctx) =>
      await ctx.db.insert("authSessions", {
        userId: user,
        expirationTime: Date.now() + 86_400_000,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("authRefreshTokens", {
        sessionId: session,
        expirationTime: Date.now() + 86_400_000,
      });
      await ctx.db.insert("authAccounts", {
        userId: user,
        provider: "password",
        providerAccountId: "ada@example.com",
        secret: "hashed",
      });
      await ctx.db.insert("authAccounts", {
        userId: user,
        provider: "email-otp",
        providerAccountId: "ada@example.com",
      });
      // A business record that must outlive the account.
      await ctx.db.insert("quotes", {
        userId: user,
        reference: "QUO-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        coverage: "home",
        status: "new",
      });
    });

    await t
      .withIdentity({ subject: user })
      .mutation(api.accountSecurity.closeAccount, {});

    const stored = await t.run(async (ctx) => await ctx.db.get(user));
    expect(stored).toMatchObject({
      name: "Closed account",
      status: "closed",
      permissions: [],
      role: "customer",
      email: `closed-${user}@closed.invalid`,
    });
    expect(stored?.closedAt).toBeTypeOf("number");
    expect(stored?.emailVerificationTime).toBeUndefined();

    // No credential, no session, no refresh token.
    expect(await credentialsFor(t, user)).toHaveLength(0);
    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user))
        .collect(),
    );
    expect(sessions).toHaveLength(0);
    const tokens = await t.run((ctx) =>
      ctx.db.query("authRefreshTokens").collect(),
    );
    expect(tokens).toHaveLength(0);

    // Personal details are gone; the profile row (and its reference) is not.
    const profile = await t.run((ctx) =>
      ctx.db
        .query("customerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user))
        .unique(),
    );
    expect(profile).toMatchObject({
      fullName: "Closed account",
      reference: "CUS-TEST",
      marketingOptIn: false,
    });
    expect(profile?.phone).toBeUndefined();
    expect(profile?.addressLine).toBeUndefined();
    expect(profile?.dateOfBirth).toBeUndefined();

    // The policy/quote record stays, still pointing at the (anonymised) account.
    const quotes = await t.run((ctx) => ctx.db.query("quotes").collect());
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.userId).toBe(user);

    // And the deletion itself is on the trail, with the reason.
    const audit = await auditFor(t, "account.closed");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: user, entityType: "users" });
    expect(audit[0]?.reason).toBeTruthy();
  });

  it("never deletes a super admin, even its own account", async () => {
    const t = test();
    const owner = await seedUser(t, {
      email: "owner@cosmicvault.test",
      role: "super_admin",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: owner,
        provider: "password",
        providerAccountId: "owner@cosmicvault.test",
        secret: "hashed",
      });
    });

    await expect(
      t
        .withIdentity({ subject: owner })
        .mutation(api.accountSecurity.closeAccount, { reason: "Leaving." }),
    ).rejects.toThrow(/super admin accounts cannot be deleted/i);

    const stored = await t.run(async (ctx) => await ctx.db.get(owner));
    expect(stored?.status).toBe("active");
    expect(await credentialsFor(t, owner)).toHaveLength(1);
    expect(await auditFor(t, "account.closed")).toHaveLength(0);
  });

  it("lets staff close a customer, recorded against the staff member", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const customer = await seedUser(t, { email: "ada@example.com" });
    await seedProfile(t, customer);

    await t
      .withIdentity({ subject: admin })
      .mutation(api.customers.closeAccount, {
        userId: customer,
        reason: "Customer called to close the account.",
      });

    const stored = await t.run(async (ctx) => await ctx.db.get(customer));
    expect(stored?.status).toBe("closed");

    const audit = await auditFor(t, "account.closed");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: admin, entityId: customer });
    expect(audit[0]?.reason).toBe("Customer called to close the account.");
  });

  it("keeps staff accounts and super admins out of the customer console's reach", async () => {
    const t = test();
    const admin = await seedUser(t, {
      email: "ops@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });
    const owner = await seedUser(t, {
      email: "owner@cosmicvault.test",
      role: "super_admin",
    });
    const colleague = await seedUser(t, {
      email: "other@cosmicvault.test",
      role: "admin",
      permissions: ["customers.manage"],
    });

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.customers.closeAccount, {
        userId: owner,
        reason: "Tidying up.",
      }),
    ).rejects.toThrow(/staff management|super admin/i);

    await expect(
      t.withIdentity({ subject: admin }).mutation(api.customers.closeAccount, {
        userId: colleague,
        reason: "Tidying up.",
      }),
    ).rejects.toThrow(/staff management/i);

    expect(
      (await t.run((ctx) => ctx.db.get(owner)))?.status,
    ).not.toBe("closed");
    expect((await auditFor(t, "account.closed"))).toHaveLength(0);
  });
});
