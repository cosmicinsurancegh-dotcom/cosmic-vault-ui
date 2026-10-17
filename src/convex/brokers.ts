import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  PERMISSIONS,
  requirePermission,
  requireViewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { notifyUser } from "./lib/notify";
import { cleanText, isValidEmail, requiredText } from "./lib/refs";
import { getSettings } from "./lib/settings";

async function brokerProfileFor(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("brokerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (viewer.role !== "broker") return null;
    const profile = await brokerProfileFor(ctx, viewer.user._id);
    if (!profile) return null;
    const assignments = await ctx.db
      .query("brokerAssignments")
      .withIndex("by_broker", (q) =>
        q.eq("brokerUserId", viewer.user._id).eq("status", "active"),
      )
      .take(200);
    const settings = await getSettings(ctx);
    return {
      profile,
      assignedCustomerCount: assignments.length,
      commissionEnabled: settings.commissionEnabled && profile.commissionEnabled,
    };
  },
});

export const myCustomers = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (viewer.role !== "broker") throw new Error("Broker access only.");
    const assignments = await ctx.db
      .query("brokerAssignments")
      .withIndex("by_broker", (q) =>
        q.eq("brokerUserId", viewer.user._id).eq("status", "active"),
      )
      .take(200);
    if (assignments.length === 0) return [];

    const profiles = await ctx.db.query("customerProfiles").take(500);
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
    const policies = await ctx.db.query("policies").take(500);
    const applications = await ctx.db.query("applications").take(500);
    const claims = await ctx.db.query("claims").take(500);
    const [settings, brokerProfile] = await Promise.all([
      getSettings(ctx),
      brokerProfileFor(ctx, viewer.user._id),
    ]);
    const commissionRate = brokerProfile?.commissionRate ?? 0;
    const commissionEnabled =
      settings.commissionEnabled && (brokerProfile?.commissionEnabled ?? false);

    return assignments.map((assignment) => {
      const profile = profileMap.get(assignment.customerUserId);
      const customerPolicies = policies.filter(
        (policy) => policy.customerUserId === assignment.customerUserId,
      );
      const customerApps = applications.filter(
        (app) => app.customerUserId === assignment.customerUserId,
      );
      const commissionByCurrency = new Map<string, number>();
      if (commissionEnabled) {
        for (const policy of customerPolicies.filter(
          (item) => item.status === "active",
        )) {
          commissionByCurrency.set(
            policy.currency,
            (commissionByCurrency.get(policy.currency) ?? 0) +
              Math.round(policy.premium * (commissionRate / 100)),
          );
        }
      }
      const commission = commissionEnabled
        ? [...commissionByCurrency.entries()].map(([currency, amount]) => ({
            currency,
            amount,
          }))
        : null;
      return {
        assignment,
        profile,
        activePolicies: customerPolicies.filter((policy) => policy.status === "active").length,
        openApplications: customerApps.filter((app) =>
          ["submitted", "under_review", "additional_info_required", "draft"].includes(app.status),
        ).length,
        openClaims: claims.filter(
          (claim) =>
            claim.customerUserId === assignment.customerUserId &&
            !["paid", "declined", "closed"].includes(claim.status),
        ).length,
        nextRenewal: customerPolicies
          .filter((policy) => policy.status === "active")
          .sort((a, b) => a.endDate - b.endDate)[0]?.endDate,
        commission,
      };
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const [users, profiles, assignments, applications, policies] = await Promise.all([
      ctx.db.query("users").take(500),
      ctx.db.query("brokerProfiles").take(200),
      ctx.db.query("brokerAssignments").take(500),
      ctx.db.query("applications").take(500),
      ctx.db.query("policies").take(500),
    ]);
    const userMap = new Map(users.map((user) => [user._id, user]));
    return profiles.map((profile) => {
      const brokerUser = userMap.get(profile.userId);
      return {
        ...profile,
        accountStatus: brokerUser?.status ?? "active",
        assignedCustomers: assignments.filter(
          (assignment) =>
            assignment.brokerUserId === profile.userId &&
            assignment.status === "active",
        ).length,
        applications: applications.filter(
          (application) => application.brokerUserId === profile.userId,
        ).length,
        policies: policies.filter(
          (policy) => policy.brokerUserId === profile.userId,
        ).length,
        activePolicies: policies.filter(
          (policy) =>
            policy.brokerUserId === profile.userId && policy.status === "active",
        ).length,
      };
    });
  },
});

export const createProfile = mutation({
  args: {
    email: v.string(),
    orgName: v.string(),
    contactName: v.string(),
    phone: v.optional(v.string()),
    countries: v.array(v.string()),
    agreementRef: v.optional(v.string()),
    commissionEnabled: v.optional(v.boolean()),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const email = args.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new Error("Enter a valid broker email address.");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error(
        "No account exists for that email. Ask the broker to sign up first, then add them here.",
      );
    }
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("Staff accounts cannot also be brokers.");
    }
    const existing = await brokerProfileFor(ctx, user._id);
    if (existing) throw new Error("This account already has a broker profile.");

    const now = Date.now();
    const orgName = requiredText(args.orgName, "Brokerage name", 160);
    await ctx.db.patch(user._id, {
      role: "broker",
      status: "active",
      lastRoleChangeAt: now,
    });
    const id = await ctx.db.insert("brokerProfiles", {
      userId: user._id,
      reference: `BRK-${user._id.slice(-6).toUpperCase()}`,
      orgName,
      contactName: requiredText(args.contactName, "Contact name", 120),
      email,
      phone: cleanText(args.phone, "Phone", 32) || undefined,
      countries: args.countries,
      status: "active",
      agreementRef: cleanText(args.agreementRef, "Agreement reference", 120) || undefined,
      commissionEnabled: args.commissionEnabled ?? false,
      commissionRate: Math.max(0, Math.min(30, args.commissionRate ?? 0)),
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: "broker.created",
      entityType: "brokerProfiles",
      entityId: id,
      before: { role: user.role ?? "customer" },
      after: { role: "broker", orgName },
    });
    await notifyUser(ctx, {
      userId: user._id,
      type: "account.security",
      title: "Your broker access is active",
      body: `${orgName} can now access a broker workspace. You will only see customers assigned to your brokerage.`,
      href: "/dashboard",
      dedupeKey: `broker-created:${id}`,
    });
    return { brokerProfileId: id };
  },
});

export const updateProfile = mutation({
  args: {
    brokerProfileId: v.id("brokerProfiles"),
    orgName: v.string(),
    contactName: v.string(),
    phone: v.optional(v.string()),
    countries: v.array(v.string()),
    agreementRef: v.optional(v.string()),
    commissionEnabled: v.boolean(),
    commissionRate: v.number(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const profile = await ctx.db.get(args.brokerProfileId);
    if (!profile) throw new Error("Broker not found.");
    const before = {
      orgName: profile.orgName,
      contactName: profile.contactName,
      countries: profile.countries,
      agreementRef: profile.agreementRef,
      commissionEnabled: profile.commissionEnabled,
      commissionRate: profile.commissionRate,
    };
    await ctx.db.patch(profile._id, {
      orgName: requiredText(args.orgName, "Brokerage name", 160),
      contactName: requiredText(args.contactName, "Contact name", 120),
      phone: cleanText(args.phone, "Phone", 32) || undefined,
      countries: args.countries,
      agreementRef: cleanText(args.agreementRef, "Agreement reference", 120) || undefined,
      commissionEnabled: args.commissionEnabled,
      commissionRate: Math.max(0, Math.min(30, args.commissionRate)),
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "broker.updated",
      entityType: "brokerProfiles",
      entityId: profile._id,
      before,
      after: {
        orgName: args.orgName,
        contactName: args.contactName,
        countries: args.countries,
        agreementRef: args.agreementRef,
        commissionEnabled: args.commissionEnabled,
        commissionRate: args.commissionRate,
      },
    });
    return true;
  },
});

export const setStatus = mutation({
  args: {
    brokerProfileId: v.id("brokerProfiles"),
    status: v.union(v.literal("active"), v.literal("suspended")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const profile = await ctx.db.get(args.brokerProfileId);
    if (!profile) throw new Error("Broker not found.");
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(profile._id, { status: args.status, updatedAt: Date.now() });
    await ctx.db.patch(profile.userId, {
      status: args.status === "active" ? "active" : "suspended",
      suspendedReason: args.status === "active" ? undefined : reason,
    });
    await writeAudit(ctx, viewer, {
      action: `broker.${args.status === "active" ? "reinstated" : "suspended"}`,
      entityType: "brokerProfiles",
      entityId: profile._id,
      before: { status: profile.status },
      after: { status: args.status },
      reason,
    });
    await notifyUser(ctx, {
      userId: profile.userId,
      type: "account.security",
      title: `Broker access ${args.status}`,
      body: args.status === "active" ? "Your broker access has been restored." : reason,
      href: "/dashboard/support",
      dedupeKey: `broker-status:${profile._id}:${args.status}:${Date.now()}`,
    });
    return true;
  },
});

export const updateSelf = mutation({
  args: { contactName: v.string(), phone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role !== "broker") throw new Error("Broker access only.");
    const profile = await brokerProfileFor(ctx, viewer.user._id);
    if (!profile) throw new Error("Broker profile not found.");
    await ctx.db.patch(profile._id, {
      contactName: requiredText(args.contactName, "Contact name", 120),
      phone: cleanText(args.phone, "Phone", 32) || undefined,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const assignments = query({
  args: { brokerProfileId: v.optional(v.id("brokerProfiles")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    let brokerUserId: Id<"users"> | undefined;
    if (args.brokerProfileId) {
      const profile = await ctx.db.get(args.brokerProfileId);
      brokerUserId = profile?.userId;
    }
    const rows = brokerUserId
      ? await ctx.db
          .query("brokerAssignments")
          .withIndex("by_broker", (q) => q.eq("brokerUserId", brokerUserId))
          .take(300)
      : await ctx.db.query("brokerAssignments").take(400);
    const profiles = await ctx.db.query("customerProfiles").take(500);
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
    return rows.map((row) => ({
      ...row,
      customerName: profileMap.get(row.customerUserId)?.fullName ?? "Customer",
      customerReference: profileMap.get(row.customerUserId)?.reference ?? "—",
      customerCountry: profileMap.get(row.customerUserId)?.country ?? "—",
    }));
  },
});

export const revokeAssignment = mutation({
  args: { assignmentId: v.id("brokerAssignments"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.BROKERS_MANAGE);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found.");
    if (assignment.status === "revoked") return true;
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(assignment._id, {
      status: "revoked",
      revokedAt: Date.now(),
      note: reason,
    });
    await writeAudit(ctx, viewer, {
      action: "broker.assignment_revoked",
      entityType: "brokerAssignments",
      entityId: assignment._id,
      before: { status: "active" },
      after: { status: "revoked" },
      reason,
    });
    await notifyUser(ctx, {
      userId: assignment.brokerUserId,
      type: "support.updated",
      title: "Customer assignment revoked",
      body: reason,
      href: "/dashboard/broker/customers",
      dedupeKey: `assignment-revoked:${assignment._id}`,
    });
    return true;
  },
});
