import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  PERMISSIONS,
  isStaffRole,
  requirePermission,
  requireViewer,
} from "./lib/authz";
import { notifyStaff, notifyUser } from "./lib/notify";
import { reference, requiredText } from "./lib/refs";

const CATEGORIES = [
  "policy",
  "claim",
  "payment",
  "application",
  "account",
  "complaint",
  "other",
];

export const create = mutation({
  args: {
    category: v.string(),
    subject: v.string(),
    message: v.string(),
    relatedType: v.optional(v.string()),
    relatedId: v.optional(v.string()),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    ),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (!CATEGORIES.includes(args.category)) {
      throw new Error("Choose a valid enquiry category.");
    }
    const subject = requiredText(args.subject, "Subject", 160);
    const message = requiredText(args.message, "Message", 4000);
    if (message.length < 10) {
      throw new Error("Please add a little more detail (at least 10 characters).");
    }
    const now = Date.now();
    const referenceValue = reference("SUP");
    const ticketId = await ctx.db.insert("tickets", {
      reference: referenceValue,
      userId: viewer.user._id,
      category: args.category,
      subject,
      message,
      status: "open",
      priority:
        args.category === "complaint"
          ? "high"
          : (args.priority ?? "normal"),
      relatedType: args.relatedType,
      relatedId: args.relatedId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("ticketMessages", {
      ticketId,
      authorId: viewer.user._id,
      authorRole: viewer.role,
      body: message,
      internal: false,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "support.updated",
      title: `${args.category === "complaint" ? "Complaint" : "Support ticket"} ${referenceValue}`,
      body: subject,
      href: "/dashboard/admin/support",
      relatedType: "tickets",
      relatedId: ticketId,
      permission: PERMISSIONS.CUSTOMERS_VIEW,
    });
    return { ticketId, reference: referenceValue };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    return await ctx.db
      .query("tickets")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .order("desc")
      .take(100);
  },
});

export const staffList = query({
  args: {
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();
    let rows = await ctx.db.query("tickets").take(400);
    rows = rows.filter(
      (row) =>
        (!args.status || args.status === "all" || row.status === args.status) &&
        (!search ||
          row.reference.toLowerCase().includes(search) ||
          row.subject.toLowerCase().includes(search)),
    );
    rows.sort(
      (a, b) =>
        (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
        b.updatedAt - a.updatedAt,
    );
    const people = await ctx.db.query("users").take(400);
    const names = new Map(people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize).map((row) => ({
        ...row,
        customerName: names.get(row.userId) ?? "Customer",
      })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});

export const get = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    const staff = isStaffRole(viewer.role);
    if (!staff && ticket.userId !== viewer.user._id) {
      throw new Error("You do not have access to this ticket.");
    }
    if (
      staff &&
      viewer.role !== "super_admin" &&
      !viewer.permissions.includes(PERMISSIONS.CUSTOMERS_VIEW)
    ) {
      throw new Error("You do not have permission to view support tickets.");
    }
    const messages = await ctx.db
      .query("ticketMessages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
      .order("asc")
      .take(200);
    const user = await ctx.db.get(ticket.userId);
    return {
      ticket,
      user,
      messages: staff ? messages : messages.filter((message) => !message.internal),
      isStaff: staff,
    };
  },
});

export const reply = mutation({
  args: {
    ticketId: v.id("tickets"),
    body: v.string(),
    internal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    const staff = isStaffRole(viewer.role);
    if (!staff && ticket.userId !== viewer.user._id) {
      throw new Error("You do not have access to this ticket.");
    }
    if (ticket.status === "closed") {
      throw new Error("This ticket is closed. Open a new ticket if you need more help.");
    }
    const body = requiredText(args.body, "Message", 3000);
    const internal = staff && args.internal === true;
    const now = Date.now();
    await ctx.db.insert("ticketMessages", {
      ticketId: ticket._id,
      authorId: viewer.user._id,
      authorRole: viewer.role,
      body,
      internal,
      createdAt: now,
    });
    await ctx.db.patch(ticket._id, {
      status: staff ? "awaiting_customer" : "open",
      updatedAt: now,
    });
    if (!internal) {
      if (staff) {
        await notifyUser(ctx, {
          userId: ticket.userId,
          type: "support.updated",
          title: `Reply on ticket ${ticket.reference}`,
          body,
          href: "/dashboard/support",
          relatedType: "tickets",
          relatedId: ticket._id,
          dedupeKey: `ticket-reply:${ticket._id}:${now}`,
        });
      } else {
        await notifyStaff(ctx, {
          type: "support.updated",
          title: `Customer replied on ${ticket.reference}`,
          body,
          href: "/dashboard/admin/support",
          relatedType: "tickets",
          relatedId: ticket._id,
          permission: PERMISSIONS.CUSTOMERS_VIEW,
        });
      }
    }
    return true;
  },
});

export const setStatus = mutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.union(
      v.literal("open"),
      v.literal("awaiting_customer"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    await ctx.db.patch(ticket._id, { status: args.status, updatedAt: Date.now() });
    if (args.status === "resolved" || args.status === "closed") {
      await notifyUser(ctx, {
        userId: ticket.userId,
        type: "support.updated",
        title: `Ticket ${ticket.reference} ${args.status}`,
        body:
          args.status === "resolved"
            ? "Your support ticket has been marked resolved. Reply if anything is still outstanding."
            : "Your support ticket has been closed.",
        href: "/dashboard/support",
        relatedType: "tickets",
        relatedId: ticket._id,
        dedupeKey: `ticket-status:${ticket._id}:${args.status}`,
      });
    }
    return true;
  },
});
