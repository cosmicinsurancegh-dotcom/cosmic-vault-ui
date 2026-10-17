import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { PERMISSIONS, requirePermission, requireViewer } from "./lib/authz";
import { notifyUser } from "./lib/notify";
import { getSettings } from "./lib/settings";

export const mine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const limit = Math.max(1, Math.min(100, args.limit ?? 30));
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .order("desc")
      .take(limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .take(100);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== viewer.user._id) {
      throw new Error("Notification not found.");
    }
    if (!notification.readAt) {
      await ctx.db.patch(notification._id, { readAt: Date.now() });
    }
    return true;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .filter((q) => q.eq(q.field("readAt"), undefined))
      .take(100);
    const now = Date.now();
    await Promise.all(
      unread.map((item) => ctx.db.patch(item._id, { readAt: now })),
    );
    return unread.length;
  },
});

export const deliveryIssues = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const failed = await ctx.db
      .query("notifications")
      .withIndex("by_email_status", (q) => q.eq("emailStatus", "failed"))
      .order("desc")
      .take(50);
    const skipped = await ctx.db
      .query("notifications")
      .withIndex("by_email_status", (q) => q.eq("emailStatus", "skipped"))
      .order("desc")
      .take(20);
    return { failed, skipped };
  },
});

export const retryEmail = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found.");
    const user = await ctx.db.get(notification.userId);
    if (!user?.email) throw new Error("This recipient has no email address.");

    const settings = await getSettings(ctx);
    const template = settings.emailTemplates.find(
      (item) => item.key === notification.type,
    );
    const values = {
      name: user.name?.split(" ")[0] ?? "there",
      title: notification.title,
      body: notification.body,
      reference: notification.relatedId ?? "",
      company: settings.companyName,
    };
    const render = (value: string) =>
      value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key as keyof typeof values] ?? "");

    await ctx.db.patch(notification._id, {
      emailStatus: "queued",
      emailError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.email.deliver, {
      notificationId: notification._id,
      to: user.email,
      subject: render(template?.subject ?? notification.title),
      text: render(template?.body ?? "{{title}}\n\n{{body}}"),
    });
    await notifyUser(ctx, {
      userId: viewer.user._id,
      type: "support.updated",
      title: "Email delivery retried",
      body: `A new delivery attempt was queued for notification ${notification._id}.`,
      dedupeKey: `retry:${notification._id}:${Date.now()}`,
      email: false,
    });
    return true;
  },
});

export const recordEmailResult = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    status: v.union(
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return;
    await ctx.db.patch(notification._id, {
      emailStatus: args.status,
      emailAttempts: notification.emailAttempts + 1,
      emailError: args.error,
    });
  },
});
