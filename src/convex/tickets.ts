import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  PERMISSIONS,
  isStaffRole,
  normalizeRole,
  requirePermission,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { notifyStaff, notifyUser } from "./lib/notify";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
import { DAY, reference, requiredText } from "./lib/refs";
import { getSettings } from "./lib/settings";

const CATEGORIES = [
  "policy",
  "claim",
  "payment",
  "application",
  "account",
  "complaint",
  "other",
];

/** The payment types a ticket can point at, worded for the thread. */
const TRANSACTION_LABELS: Record<string, string> = {
  premium: "Premium",
  refund: "Refund",
  settlement: "Settlement",
  adjustment: "Adjustment",
};

/** What a ticket was filed about, resolved for display. Amounts stay in minor
 *  units and are formatted by the client. */
type RelatedRecord = {
  type: "policies" | "claims" | "applications" | "transactions";
  reference: string;
  title: string;
  status: string;
  amount?: number;
  currency?: string;
};

/** The linked record needs the same permission as its own screen. */
const RELATED_PERMISSIONS: Record<RelatedRecord["type"], string> = {
  policies: PERMISSIONS.POLICIES_MANAGE,
  claims: PERMISSIONS.CLAIMS_REVIEW,
  applications: PERMISSIONS.APPLICATIONS_REVIEW,
  transactions: PERMISSIONS.PAYMENTS_VIEW,
};

/** The record types a ticket may be linked to. */
const RELATED_TYPES = [
  "policies",
  "claims",
  "applications",
  "transactions",
] as const;
type RelatedType = (typeof RELATED_TYPES)[number];

/** One message for a record that is missing and for one that is somebody
 *  else's, so a refusal never says whether the id exists. */
const NOT_YOURS =
  "You can only link a policy, claim, application or payment that belongs to you.";

/** Whether a customer is in this broker's book right now. */
async function customerInBrokerBook(
  ctx: QueryCtx | MutationCtx,
  brokerUserId: Id<"users">,
  customerUserId: Id<"users">,
) {
  const assignments = await ctx.db
    .query("brokerAssignments")
    .withIndex("by_broker", (q) =>
      q.eq("brokerUserId", brokerUserId).eq("status", "active"),
    )
    .take(300);
  return assignments.some(
    (assignment) => assignment.customerUserId === customerUserId,
  );
}

/**
 * Whether an application sits in this person's book: their own, issued by them
 * as the broker, or their customer's - the same rule `applications.mine` lists
 * by, so the picker and the check agree.
 */
async function applicationInBook(
  ctx: QueryCtx | MutationCtx,
  application: Doc<"applications">,
  userId: Id<"users">,
) {
  if (application.customerUserId === userId) return true;
  if (application.brokerUserId === userId) return true;
  return await customerInBrokerBook(ctx, userId, application.customerUserId);
}

/**
 * The policy equivalent. `policies.mine` also lists cover held by a broker's
 * assigned customers, so the link check has to accept it too - otherwise the
 * picker offers records that creation then refuses.
 */
async function policyInBook(
  ctx: QueryCtx | MutationCtx,
  policy: Doc<"policies">,
  userId: Id<"users">,
) {
  if (policy.customerUserId === userId) return true;
  if (policy.brokerUserId === userId) return true;
  return await customerInBrokerBook(ctx, userId, policy.customerUserId);
}

/**
 * Validates the record a ticket may be linked to and normalises it. Both halves
 * come from the client, so an unknown type is refused, and the record is looked
 * up and checked against the caller's own book rather than trusted.
 */
async function resolveRelatedLink(
  ctx: MutationCtx,
  viewer: Viewer,
  relatedType?: string,
  relatedId?: string,
): Promise<{ relatedType?: RelatedType; relatedId?: string }> {
  if (!relatedType && !relatedId) return {};
  if (!relatedType || !relatedId) {
    throw new Error("Choose both the record type and the record, or neither.");
  }
  if (!RELATED_TYPES.includes(relatedType as RelatedType)) {
    throw new Error("That kind of record cannot be linked to a ticket.");
  }

  const type = relatedType as RelatedType;

  if (type === "policies") {
    const policyId = ctx.db.normalizeId("policies", relatedId);
    const policy = policyId ? await ctx.db.get(policyId) : null;
    if (
      !policyId ||
      !policy ||
      !(await policyInBook(ctx, policy, viewer.user._id))
    ) {
      throw new Error(NOT_YOURS);
    }
    return { relatedType: type, relatedId: policyId };
  }

  if (type === "claims") {
    const claimId = ctx.db.normalizeId("claims", relatedId);
    const claim = claimId ? await ctx.db.get(claimId) : null;
    if (!claimId || !claim || claim.customerUserId !== viewer.user._id) {
      throw new Error(NOT_YOURS);
    }
    return { relatedType: type, relatedId: claimId };
  }

  if (type === "applications") {
    const applicationId = ctx.db.normalizeId("applications", relatedId);
    const application = applicationId
      ? await ctx.db.get(applicationId)
      : null;
    if (
      !applicationId ||
      !application ||
      !(await applicationInBook(ctx, application, viewer.user._id))
    ) {
      throw new Error(NOT_YOURS);
    }
    return { relatedType: type, relatedId: applicationId };
  }

  const transactionId = ctx.db.normalizeId("transactions", relatedId);
  const transaction = transactionId ? await ctx.db.get(transactionId) : null;
  if (!transactionId || !transaction || transaction.customerUserId !== viewer.user._id) {
    throw new Error(NOT_YOURS);
  }
  return { relatedType: type, relatedId: transactionId };
}

/**
 * Resolves the record a ticket was filed about. `relatedId` is whatever the
 * creator sent, so ownership is re-checked here rather than trusted: a ticket
 * must never become a way to read another customer's policy, claim or payment.
 */
async function relatedRecord(
  ctx: QueryCtx,
  ticket: Doc<"tickets">,
): Promise<RelatedRecord | null> {
  if (!ticket.relatedId) return null;

  if (ticket.relatedType === "policies") {
    const policyId = ctx.db.normalizeId("policies", ticket.relatedId);
    const policy = policyId ? await ctx.db.get(policyId) : null;
    if (!policy || !(await policyInBook(ctx, policy, ticket.userId))) {
      return null;
    }
    return {
      type: "policies",
      reference: policy.policyNumber,
      title: policy.productName,
      status: policy.status,
    };
  }

  if (ticket.relatedType === "claims") {
    const claimId = ctx.db.normalizeId("claims", ticket.relatedId);
    const claim = claimId ? await ctx.db.get(claimId) : null;
    if (!claim || claim.customerUserId !== ticket.userId) return null;
    return {
      type: "claims",
      reference: claim.reference,
      title: claim.productName,
      status: claim.status,
    };
  }

  if (ticket.relatedType === "applications") {
    const applicationId = ctx.db.normalizeId("applications", ticket.relatedId);
    const application = applicationId
      ? await ctx.db.get(applicationId)
      : null;
    if (
      !application ||
      !(await applicationInBook(ctx, application, ticket.userId))
    ) {
      return null;
    }
    return {
      type: "applications",
      reference: application.reference,
      title: application.productName,
      status: application.status,
    };
  }

  if (ticket.relatedType === "transactions") {
    const transactionId = ctx.db.normalizeId("transactions", ticket.relatedId);
    const transaction = transactionId ? await ctx.db.get(transactionId) : null;
    if (!transaction || transaction.customerUserId !== ticket.userId) return null;
    return {
      type: "transactions",
      reference: transaction.reference,
      title: TRANSACTION_LABELS[transaction.type] ?? transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
    };
  }

  return null;
}

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
    await enforceRateLimit(ctx, {
      scope: "ticket.create",
      identifier: viewer.user._id,
      ...RATE_LIMITS.ticketPerUser,
    });
    const related = await resolveRelatedLink(
      ctx,
      viewer,
      args.relatedType,
      args.relatedId,
    );
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
      relatedType: related.relatedType,
      relatedId: related.relatedId,
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

    /*
     * The receipt. It is written out rather than rendered from a settings
     * template because `{{reference}}` in a template resolves to the record id
     * the notification points at, which is the internal ticket id - the member
     * needs the printed SUP reference. The reply promise comes from Settings,
     * so operations can move it without a deploy.
     */
    const settings = await getSettings(ctx);
    const responseHours = settings.supportResponseHours;
    const replyWithin = `${responseHours} hour${responseHours === 1 ? "" : "s"}`;
    const firstName = viewer.user.name?.trim().split(/\s+/)[0] || "there";
    await notifyUser(ctx, {
      userId: viewer.user._id,
      type: "support.created",
      title: `We received ${referenceValue}`,
      body: `We aim to reply within ${replyWithin}.`,
      href: "/dashboard/support",
      relatedType: "tickets",
      relatedId: ticketId,
      subject: `We received your support request ${referenceValue}`,
      text: [
        `Hello ${firstName},`,
        "",
        `Thanks for getting in touch. Your request is with the support team as ${referenceValue}.`,
        `About: ${subject}`,
        "",
        `We aim to reply within ${replyWithin}. You can follow the conversation in your dashboard under Support - replies arrive there, and by email.`,
        "",
        settings.companyName,
      ].join("\n"),
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
        /* Null until somebody takes it, which is what the dashboard counts. */
        assigneeName: row.assignedTo
          ? (names.get(row.assignedTo) ?? "Staff")
          : null,
      })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});

/**
 * How much of the support queue has nobody on it, for the staff dashboard.
 *
 * Only `open` tickets count: a ticket waiting on the customer is not work the
 * support team can pick up. `take(400)` matches the queue's own scan window, so
 * the alert and the queue agree on what "unassigned" means up to that size.
 */
export const queueSummary = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const open = await ctx.db
      .query("tickets")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .take(400);
    const unassigned = open.filter((ticket) => !ticket.assignedTo);
    const oldest = unassigned.length
      ? Math.min(...unassigned.map((ticket) => ticket.createdAt))
      : null;
    return {
      unassigned: unassigned.length,
      highPriority: unassigned.filter((ticket) => ticket.priority === "high")
        .length,
      oldestUnassignedAt: oldest,
      /* Age is computed here rather than in the render, where reading the
         clock would make the component impure. */
      oldestUnassignedDays:
        oldest === null
          ? null
          : Math.max(0, Math.floor((Date.now() - oldest) / DAY)),
    };
  },
});

/**
 * Claims a ticket for a staff member, or puts it back in the queue when the
 * assignee is omitted. The support queue needs only `customers.view`, so any
 * agent who can read the queue can take work off it - without that, the
 * unassigned count could only ever grow.
 */
export const assign = mutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    if (args.assigneeId) {
      const assignee = await ctx.db.get(args.assigneeId);
      if (!assignee || !isStaffRole(normalizeRole(assignee.role))) {
        throw new Error("Tickets can only be assigned to staff.");
      }
      if (assignee.status === "suspended" || assignee.status === "closed") {
        throw new Error("That staff account cannot take tickets.");
      }
    }
    /* Touching the owner deliberately leaves `updatedAt` alone: claiming a
       ticket is not activity on it, and moving it would reorder the queue. */
    await ctx.db.patch(ticket._id, { assignedTo: args.assigneeId });
    return true;
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
    const assignee = ticket.assignedTo
      ? await ctx.db.get(ticket.assignedTo)
      : null;
    const relatedPermission =
      ticket.relatedType === "policies" ||
      ticket.relatedType === "claims" ||
      ticket.relatedType === "applications" ||
      ticket.relatedType === "transactions"
        ? RELATED_PERMISSIONS[ticket.relatedType]
        : undefined;
    const related =
      !staff || !relatedPermission || viewer.permissions.includes(relatedPermission)
        ? await relatedRecord(ctx, ticket)
        : null;
    return {
      ticket,
      user,
      assignee,
      messages: staff ? messages : messages.filter((message) => !message.internal),
      isStaff: staff,
      related,
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
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_VIEW);
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
