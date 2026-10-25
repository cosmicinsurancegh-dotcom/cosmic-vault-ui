import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { PERMISSIONS, requirePermission, requireViewer } from "./lib/authz";
import {
  notifyUser,
  requeueNotificationEmail,
  STALLED_EMAIL_MS,
} from "./lib/notify";

const STALLED_MINUTES = Math.round(STALLED_EMAIL_MS / 60_000);

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
    /*
     * A queued row means the delivery action was scheduled but never reported
     * back. That is the one failure nobody sees otherwise: nothing failed, so
     * it never reaches the lists above, and the member simply gets no email.
     * Anything still queued well past a normal send is treated as stalled.
     */
    const queued = await ctx.db
      .query("notifications")
      .withIndex("by_email_status", (q) => q.eq("emailStatus", "queued"))
      .order("desc")
      .take(50);
    const stalledBefore = Date.now() - STALLED_EMAIL_MS;
    const stalled = queued.filter(
      (notification) =>
        (notification.emailQueuedAt ?? notification.createdAt) < stalledBefore,
    );
    return { failed, skipped, stalled, stalledAfterMinutes: STALLED_MINUTES };
  },
});

export const retryEmail = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found.");

    // The queued message is resent as it was recorded, so a retry delivers the
    // email the member was promised rather than a template re-render.
    await requeueNotificationEmail(ctx, notification);

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
