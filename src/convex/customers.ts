import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  PERMISSIONS,
  requirePermission,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { closeAccountRecord } from "./lib/account";
import { assertCustomerAccess } from "./lib/access";
import {
  assertInviteEmail,
  findUserByEmail,
  inviteMessage,
  inviteUser,
  normalizeInviteEmail,
  normalizeInviteName,
} from "./lib/invite";
import { notifyUser } from "./lib/notify";
import { ensureCustomerProfile, getCustomerProfile } from "./lib/people";
import { cleanText, isValidEmail, requiredText } from "./lib/refs";
import { getSettings } from "./lib/settings";

const verification = v.union(
  v.literal("unverified"),
  v.literal("pending"),
  v.literal("verified"),
);

async function assertCountryAndCurrency(
  ctx: Parameters<typeof getSettings>[0],
  country: string | undefined,
  currency: string | undefined,
) {
  if (country) {
    const record = await ctx.db
      .query("countries")
      .withIndex("by_code", (q) => q.eq("code", country))
      .unique();
    if (!record || !record.active) {
      throw new Error("Choose a supported country.");
    }
  }
  if (currency) {
    const allowed = (await getSettings(ctx)).allowedCurrencies;
    const record = await ctx.db
      .query("currencies")
      .withIndex("by_code", (q) => q.eq("code", currency))
      .unique();
    if (!record || !record.active || !allowed.includes(currency)) {
      throw new Error("Choose a supported currency.");
    }
  }
}

export const invite = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    country: v.string(),
    currency: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    const email = assertInviteEmail(normalizeInviteEmail(args.email));
    const existing = await findUserByEmail(ctx, email);
    if (existing) {
      if (existing.role === "admin" || existing.role === "super_admin") {
        throw new Error("That email belongs to a staff account.");
      }
      if (existing.role === "broker") {
        throw new Error(
          "That email already has a broker account. Add it from the Brokers screen.",
        );
      }
      throw new Error(
        "That email already has an account. Open it in the directory instead of inviting it again.",
      );
    }
    await assertCountryAndCurrency(ctx, args.country, args.currency);
    const name = normalizeInviteName(args.name);

    const userId = await inviteUser(ctx, { name, email, role: "customer" });
    const profile = await ensureCustomerProfile(ctx, userId);
    await ctx.db.patch(profile._id, {
      fullName: name,
      email,
      country: args.country,
      currency: args.currency,
      notes: cleanText(args.notes, "Notes", 2000) || undefined,
      updatedAt: Date.now(),
    });

    await writeAudit(ctx, viewer, {
      action: "customer.invited",
      entityType: "customers",
      entityId: userId,
      after: { name, email, country: args.country, currency: args.currency },
      reason: "Invited from the customer directory.",
    });

    const settings = await getSettings(ctx);
    const message = inviteMessage({
      name,
      company: settings.companyName,
      support: settings.supportEmail,
      lines: [
        `An account has been created for you at ${settings.companyName} with this email address.`,
        "",
        `Your customer reference is ${profile.reference}.`,
        "If you were not expecting this, reply to this message and our concierge will close the account.",
      ],
    });
    await notifyUser(ctx, {
      userId,
      type: "account.welcome",
      title: "Your Cosmic Vault account is ready",
      body: `Your customer reference is ${profile.reference}. Sign in with this email address to receive a one-time code.`,
      href: "/dashboard",
      relatedType: "customers",
      relatedId: userId,
      dedupeKey: `customer-invite:${userId}`,
      subject: message.subject,
      text: message.text,
    });

    return { userId, reference: profile.reference };
  },
});

export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const profile = await ensureCustomerProfile(ctx, viewer.user._id);
    return profile._id;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (viewer.role === "admin" || viewer.role === "super_admin") {
      return { user: viewer.user, profile: null };
    }
    const profile = await getCustomerProfile(ctx, viewer.user._id);
    return { user: viewer.user, profile };
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.string(),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    country: v.string(),
    city: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    currency: v.string(),
    locale: v.string(),
    timezone: v.string(),
    preferredLanguage: v.string(),
    marketingOptIn: v.boolean(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const profile = await ensureCustomerProfile(ctx, viewer.user._id);
    const fullName = requiredText(args.fullName, "Full name", 120);
    if (fullName.length < 2) throw new Error("Full name is too short.");
    await assertCountryAndCurrency(ctx, args.country, args.currency);

    const dateOfBirth = cleanText(args.dateOfBirth, "Date of birth", 32) || undefined;
    if (dateOfBirth && Number.isNaN(Date.parse(dateOfBirth))) {
      throw new Error("Date of birth must be a valid date.");
    }

    const before = {
      fullName: profile.fullName,
      country: profile.country,
      currency: profile.currency,
      phone: profile.phone,
    };
    await ctx.db.patch(profile._id, {
      fullName,
      phone: cleanText(args.phone, "Phone", 32) || undefined,
      dateOfBirth,
      country: args.country,
      city: cleanText(args.city, "City", 80) || undefined,
      addressLine: cleanText(args.addressLine, "Address", 200) || undefined,
      postalCode: cleanText(args.postalCode, "Postal code", 24) || undefined,
      currency: args.currency,
      locale: cleanText(args.locale, "Locale", 16) || "en-GB",
      timezone: cleanText(args.timezone, "Timezone", 64) || "UTC",
      preferredLanguage: cleanText(args.preferredLanguage, "Language", 16) || "en",
      marketingOptIn: args.marketingOptIn,
      updatedAt: Date.now(),
    });
    if (viewer.user.name !== fullName) {
      await ctx.db.patch(viewer.user._id, { name: fullName });
    }
    const identityChanged =
      before.fullName !== fullName ||
      before.country !== args.country ||
      before.currency !== args.currency;
    if (identityChanged) {
      await writeAudit(ctx, viewer, {
        action: "customer.profile_updated",
        entityType: "customers",
        entityId: viewer.user._id,
        before,
        after: { fullName, country: args.country, currency: args.currency },
      });
    }
    return profile._id;
  },
});

export const directory = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    country: v.optional(v.string()),
    verificationStatus: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();

    const [profiles, users] = await Promise.all([
      ctx.db.query("customerProfiles").take(500),
      ctx.db.query("users").take(500),
    ]);
    const userMap = new Map(users.map((user) => [user._id, user]));

    let rows = profiles.map((profile) => ({
      ...profile,
      accountStatus: userMap.get(profile.userId)?.status ?? "active",
      isAnonymous: userMap.get(profile.userId)?.isAnonymous ?? false,
    }));

    if (search) {
      const matchingPolicy = await ctx.db
        .query("policies")
        .withIndex("by_number", (q) => q.eq("policyNumber", search.toUpperCase()))
        .first();
      rows = rows.filter(
        (row) =>
          row.fullName.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          row.reference.toLowerCase().includes(search) ||
          (matchingPolicy && row.userId === matchingPolicy.customerUserId),
      );
    }
    if (args.status && args.status !== "all") {
      rows = rows.filter((row) => row.accountStatus === args.status);
    }
    if (args.country && args.country !== "all") {
      rows = rows.filter((row) => row.country === args.country);
    }
    if (args.verificationStatus && args.verificationStatus !== "all") {
      rows = rows.filter(
        (row) => row.verificationStatus === args.verificationStatus,
      );
    }

    rows.sort((a, b) => b.createdAt - a.createdAt);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});

export const detail = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    await assertCustomerAccess(
      ctx,
      viewer,
      args.userId,
      PERMISSIONS.CUSTOMERS_VIEW,
    );

    const user = await ctx.db.get(args.userId);
    const profile = await getCustomerProfile(ctx, args.userId);
    const staff = viewer.role === "admin" || viewer.role === "super_admin";

    const [applications, policies, claims, transactions, documents, tickets] =
      await Promise.all([
        ctx.db
          .query("applications")
          .withIndex("by_customer", (q) => q.eq("customerUserId", args.userId))
          .order("desc")
          .take(25),
        ctx.db
          .query("policies")
          .withIndex("by_customer", (q) => q.eq("customerUserId", args.userId))
          .order("desc")
          .take(25),
        ctx.db
          .query("claims")
          .withIndex("by_customer", (q) => q.eq("customerUserId", args.userId))
          .order("desc")
          .take(25),
        ctx.db
          .query("transactions")
          .withIndex("by_customer", (q) => q.eq("customerUserId", args.userId))
          .order("desc")
          .take(25),
        ctx.db
          .query("documents")
          .withIndex("by_owner", (q) => q.eq("ownerUserId", args.userId))
          .order("desc")
          .take(25),
        ctx.db
          .query("tickets")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .order("desc")
          .take(10),
      ]);

    /* Two streams: the customer record's own history, and the account-level
       events (email changes, closures, password resets) recorded against the
       user, which is what a deleted account leaves behind. */
    const audit = staff
      ? (
          await Promise.all(
            ["customers", "users"].map((entityType) =>
              ctx.db
                .query("auditLogs")
                .withIndex("by_entity", (q) =>
                  q.eq("entityType", entityType).eq("entityId", args.userId),
                )
                .order("desc")
                .take(20),
            ),
          )
        )
          .flat()
          .sort((a, b) => b.at - a.at)
          .slice(0, 20)
      : [];

    const assignments = staff
      ? await ctx.db
          .query("brokerAssignments")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", args.userId).eq("status", "active"),
          )
          .take(5)
      : [];

    return {
      user,
      profile,
      applications,
      policies,
      claims,
      transactions,
      documents,
      tickets,
      audit,
      assignments,
    };
  },
});

export const updateStaff = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.string(),
    phone: v.optional(v.string()),
    country: v.string(),
    city: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    verificationStatus: verification,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Customer not found.");
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("Use staff management to edit staff accounts.");
    }
    const profile = await getCustomerProfile(ctx, args.userId);
    if (!profile) throw new Error("This account has no customer profile yet.");
    await assertCountryAndCurrency(ctx, args.country, undefined);
    const fullName = requiredText(args.fullName, "Full name", 120);

    const before = {
      fullName: profile.fullName,
      country: profile.country,
      phone: profile.phone,
      verificationStatus: profile.verificationStatus,
      notes: profile.notes,
    };
    await ctx.db.patch(profile._id, {
      fullName,
      phone: cleanText(args.phone, "Phone", 32) || undefined,
      country: args.country,
      city: cleanText(args.city, "City", 80) || undefined,
      addressLine: cleanText(args.addressLine, "Address", 200) || undefined,
      postalCode: cleanText(args.postalCode, "Postal code", 24) || undefined,
      verificationStatus: args.verificationStatus,
      notes: cleanText(args.notes, "Notes", 2000) || undefined,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "customer.updated_by_staff",
      entityType: "customers",
      entityId: args.userId,
      before,
      after: {
        fullName,
        country: args.country,
        phone: args.phone,
        verificationStatus: args.verificationStatus,
        notes: args.notes,
      },
    });
    return true;
  },
});

/**
 * Closing a customer's account from the console, on their request.
 *
 * Same routine as the holder's own deletion: credentials and sessions are
 * destroyed and the personal details are replaced, while policies, claims and
 * payments stay attached to the (now anonymised) record. Staff accounts are out
 * of scope here - that is staff management - and a super admin is never
 * deletable.
 */
export const closeAccount = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Customer not found.");
    if (target.role === "admin" || target.role === "super_admin") {
      throw new Error("Use staff management to close a staff account.");
    }
    if (target.status === "closed") throw new Error("That account is already closed.");

    const reason = requiredText(args.reason, "Reason", 500);
    await closeAccountRecord(ctx, viewer, target, reason);
    return true;
  },
});

export const setSuspension = mutation({
  args: {
    userId: v.id("users"),
    suspended: v.boolean(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    if (args.userId === viewer.user._id) {
      throw new Error("You cannot suspend your own account.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Customer not found.");
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("Staff accounts are managed through staff controls.");
    }
    const reason = requiredText(args.reason, "Reason", 500);

    await ctx.db.patch(args.userId, {
      status: args.suspended ? "suspended" : "active",
      suspendedReason: args.suspended ? reason : undefined,
    });
    await writeAudit(ctx, viewer, {
      action: args.suspended ? "customer.suspended" : "customer.reinstated",
      entityType: "customers",
      entityId: args.userId,
      before: { status: user.status ?? "active" },
      after: { status: args.suspended ? "suspended" : "active" },
      reason,
    });
    await notifyUser(ctx, {
      userId: args.userId,
      type: "account.security",
      title: args.suspended ? "Your account has been suspended" : "Your account has been reinstated",
      body: args.suspended
        ? `An administrator suspended your account. Reason: ${reason}. Existing policies and financial records are unaffected. Contact support to appeal.`
        : "Your account is active again. You can now sign in and manage your cover.",
      dedupeKey: `suspension:${args.userId}:${Date.now()}`,
      href: "/dashboard/support",
    });
    return true;
  },
});

export const assignBroker = mutation({
  args: {
    customerUserId: v.id("users"),
    brokerUserId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const [customer, broker] = await Promise.all([
      ctx.db.get(args.customerUserId),
      ctx.db.get(args.brokerUserId),
    ]);
    if (!customer || customer.role === "admin" || customer.role === "super_admin") {
      throw new Error("Choose a customer account.");
    }
    if (!broker || broker.role !== "broker") {
      throw new Error("Choose a broker account.");
    }
    const existing = await ctx.db
      .query("brokerAssignments")
      .withIndex("by_broker", (q) =>
        q.eq("brokerUserId", args.brokerUserId).eq("status", "active"),
      )
      .take(500);
    if (
      existing.some(
        (assignment) => assignment.customerUserId === args.customerUserId,
      )
    ) {
      throw new Error("This customer is already assigned to that broker.");
    }
    const id = await ctx.db.insert("brokerAssignments", {
      brokerUserId: args.brokerUserId,
      customerUserId: args.customerUserId,
      status: "active",
      assignedBy: viewer.user._id,
      note: cleanText(args.note, "Note", 500) || undefined,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "broker.customer_assigned",
      entityType: "brokerAssignments",
      entityId: id,
      after: {
        brokerUserId: args.brokerUserId,
        customerUserId: args.customerUserId,
      },
    });
    await notifyUser(ctx, {
      userId: args.brokerUserId,
      type: "support.updated",
      title: "A customer was assigned to you",
      body: `${customer.name ?? customer.email ?? "A customer"} can now be serviced by your brokerage.`,
      href: "/dashboard/broker/customers",
      dedupeKey: `broker-assignment:${id}`,
    });
    await notifyUser(ctx, {
      userId: args.customerUserId,
      type: "account.security",
      title: "A broker now supports your account",
      body: `${broker.name ?? "A broker"} was assigned to help with your cover. You can still contact us directly at any time.`,
      href: "/dashboard/support",
      dedupeKey: `customer-broker-assignment:${id}`,
    });
    return id;
  },
});

export const brokerOptions = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const [users, profiles] = await Promise.all([
      ctx.db.query("users").take(300),
      ctx.db.query("brokerProfiles").take(200),
    ]);
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
    return users
      .filter((user) => user.role === "broker")
      .map((user) => ({
        userId: user._id,
        name: user.name ?? user.email ?? "Broker",
        email: user.email ?? "",
        orgName: profileMap.get(user._id)?.orgName ?? "Brokerage",
        status: profileMap.get(user._id)?.status ?? "active",
      }));
  },
});

export const lookupByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const email = args.email.trim().toLowerCase();
    if (!isValidEmail(email)) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role ?? "customer",
      status: user.status ?? "active",
    };
  },
});

export type CustomerRow = Doc<"customerProfiles"> & {
  accountStatus: string;
  isAnonymous: boolean;
};

export async function canViewCustomer(viewer: Viewer, userId: string) {
  return viewer.user._id === userId || viewer.role !== "customer";
}
