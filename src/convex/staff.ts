import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  ALL_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  PERMISSIONS,
  requirePermission,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { notifyUser } from "./lib/notify";
import { requiredText } from "./lib/refs";

async function superAdmins(ctx: Parameters<typeof requirePermission>[0]) {
  const users = await ctx.db.query("users").take(500);
  return users.filter((user) => user.role === "super_admin");
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    const users = await ctx.db.query("users").take(500);
    return users
      .filter((user) => user.role === "admin" || user.role === "super_admin")
      .map((user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status ?? "active",
        permissions: user.permissions ?? [],
        lastRoleChangeAt: user.lastRoleChangeAt,
      }));
  },
});

export const lookup = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    const email = args.email.trim().toLowerCase();
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

export const promote = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("super_admin")),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    if (viewer.role !== "super_admin") {
      throw new Error("Only a super admin can grant staff access.");
    }
    const email = requiredText(args.email, "Email", 160).toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error("No account exists for that email. Ask them to sign up first.");
    }
    if (user.role === "broker") {
      throw new Error("Broker accounts cannot be promoted to staff.");
    }
    const permissions =
      args.role === "super_admin"
        ? ALL_PERMISSIONS
        : (args.permissions ?? DEFAULT_ADMIN_PERMISSIONS);
    for (const permission of permissions) {
      if (!ALL_PERMISSIONS.includes(permission)) {
        throw new Error(`Unknown permission: ${permission}`);
      }
    }
    const now = Date.now();
    await ctx.db.patch(user._id, {
      role: args.role,
      permissions,
      status: "active",
      lastRoleChangeAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: "staff.role_granted",
      entityType: "users",
      entityId: user._id,
      before: { role: user.role ?? "customer", permissions: user.permissions ?? [] },
      after: { role: args.role, permissions },
      reason: "Staff access granted by super admin.",
    });
    await notifyUser(ctx, {
      userId: user._id,
      type: "account.security",
      title: "Staff access granted",
      body: `Your account now has the ${args.role.replace("_", " ")} role.`,
      href: "/dashboard",
      dedupeKey: `staff-promote:${user._id}:${now}`,
    });
    return true;
  },
});

export const setPermissions = mutation({
  args: { userId: v.id("users"), permissions: v.array(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    if (viewer.role !== "super_admin") {
      throw new Error("Only a super admin can change staff permissions.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Staff account not found.");
    if (user.role === "super_admin") {
      throw new Error("Super admins implicitly hold all permissions.");
    }
    if (user.role !== "admin") {
      throw new Error("Permissions apply to administrator accounts only.");
    }
    for (const permission of args.permissions) {
      if (!ALL_PERMISSIONS.includes(permission)) {
        throw new Error(`Unknown permission: ${permission}`);
      }
    }
    await ctx.db.patch(user._id, {
      permissions: [...new Set(args.permissions)],
      lastRoleChangeAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "staff.permissions_changed",
      entityType: "users",
      entityId: user._id,
      before: { permissions: user.permissions ?? [] },
      after: { permissions: args.permissions },
    });
    await notifyUser(ctx, {
      userId: user._id,
      type: "account.security",
      title: "Your staff permissions changed",
      body: "A super admin updated the permissions on your account. Changes apply immediately.",
      href: "/dashboard",
      dedupeKey: `staff-permissions:${user._id}:${Date.now()}`,
    });
    return true;
  },
});

export const revoke = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    if (viewer.role !== "super_admin") {
      throw new Error("Only a super admin can revoke staff access.");
    }
    if (args.userId === viewer.user._id) {
      throw new Error("You cannot revoke your own staff access.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Staff account not found.");
    if (user.role === "super_admin") {
      const admins = await superAdmins(ctx);
      if (admins.length <= 1) {
        throw new Error("At least one super admin must remain.");
      }
    }
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(user._id, {
      role: "customer",
      permissions: [],
      status: "active",
      lastRoleChangeAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "staff.access_revoked",
      entityType: "users",
      entityId: user._id,
      before: { role: user.role },
      after: { role: "customer" },
      reason,
    });
    await notifyUser(ctx, {
      userId: user._id,
      type: "account.security",
      title: "Staff access revoked",
      body: reason,
      href: "/dashboard/support",
      dedupeKey: `staff-revoke:${user._id}:${Date.now()}`,
    });
    return true;
  },
});

export const setStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("suspended")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.STAFF_MANAGE);
    if (viewer.role !== "super_admin") {
      throw new Error("Only a super admin can suspend staff accounts.");
    }
    if (args.userId === viewer.user._id) {
      throw new Error("You cannot suspend your own account.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Staff account not found.");
    if (user.role === "super_admin" && args.status === "suspended") {
      const admins = await superAdmins(ctx);
      if (admins.length <= 1) {
        throw new Error("At least one active super admin must remain.");
      }
    }
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(user._id, {
      status: args.status,
      suspendedReason: args.status === "suspended" ? reason : undefined,
    });
    await writeAudit(ctx, viewer, {
      action: `staff.${args.status === "suspended" ? "suspended" : "reinstated"}`,
      entityType: "users",
      entityId: user._id,
      before: { status: user.status ?? "active" },
      after: { status: args.status },
      reason,
    });
    return true;
  },
});
