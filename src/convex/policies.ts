import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  PERMISSIONS,
  isStaffRole,
  requirePermission,
  requireSelfServiceRole,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { isBrokerAssigned } from "./lib/access";
import { writeAudit } from "./lib/audit";
import { notifyStaff, notifyUser } from "./lib/notify";
import { addMonths, DAY, reference, requiredText } from "./lib/refs";

async function assertPolicyAccess(
  ctx: Parameters<typeof isBrokerAssigned>[0],
  viewer: Viewer,
  policy: Doc<"policies">,
) {
  if (isStaffRole(viewer.role)) {
    const allowed =
      viewer.role === "super_admin" ||
      [
        PERMISSIONS.POLICIES_MANAGE,
        PERMISSIONS.CLAIMS_REVIEW,
        PERMISSIONS.PAYMENTS_VIEW,
        PERMISSIONS.APPLICATIONS_REVIEW,
        PERMISSIONS.CUSTOMERS_VIEW,
      ].some((permission) => viewer.permissions.includes(permission));
    if (!allowed) throw new Error("You do not have permission to view policies.");
    return;
  }
  if (policy.customerUserId === viewer.user._id) return;
  if (
    viewer.role === "broker" &&
    (policy.brokerUserId === viewer.user._id ||
      (await isBrokerAssigned(ctx, viewer.user._id, policy.customerUserId)))
  ) {
    return;
  }
  throw new Error("You do not have access to this policy.");
}

export const mine = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    let rows: Doc<"policies">[] = [];
    if (viewer.role === "broker") {
      const assignments = await ctx.db
        .query("brokerAssignments")
        .withIndex("by_broker", (q) =>
          q.eq("brokerUserId", viewer.user._id).eq("status", "active"),
        )
        .take(300);
      const customerIds = new Set(
        assignments.map((assignment) => assignment.customerUserId),
      );
      rows = (await ctx.db.query("policies").order("desc").take(500))
        .filter(
          (policy) =>
            policy.brokerUserId === viewer.user._id ||
            customerIds.has(policy.customerUserId),
        )
        .slice(0, 150);
    } else {
      rows = await ctx.db
        .query("policies")
        .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
        .order("desc")
        .take(150);
    }
    if (args.status && args.status !== "all") {
      rows = rows.filter((row) => row.status === args.status);
    }
    return rows;
  },
});

export const listStaff = query({
  args: {
    status: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    country: v.optional(v.string()),
    search: v.optional(v.string()),
    expiringSoon: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();
    const soon = Date.now() + 60 * DAY;

    let rows = await ctx.db.query("policies").take(500);
    rows = rows.filter(
      (row) =>
        (!args.status || args.status === "all" || row.status === args.status) &&
        (!args.productId || row.productId === args.productId) &&
        (!args.country || args.country === "all" || row.country === args.country) &&
        (!args.expiringSoon ||
          (row.status === "active" && row.endDate <= soon)) &&
        (!search ||
          row.policyNumber.toLowerCase().includes(search) ||
          row.insuredName.toLowerCase().includes(search) ||
          row.productName.toLowerCase().includes(search)),
    );
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const people = await ctx.db.query("users").take(500);
    const names = new Map(people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize).map((row) => ({
        ...row,
        customerName: names.get(row.customerUserId) ?? "Customer",
      })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});

export const get = query({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found.");
    await assertPolicyAccess(ctx, viewer, policy);

    const [product, documents, requests, transactions, claims, customer, broker] =
      await Promise.all([
        ctx.db.get(policy.productId),
        ctx.db
          .query("documents")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .order("desc")
          .take(50),
        ctx.db
          .query("policyRequests")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .order("desc")
          .take(20),
        ctx.db
          .query("transactions")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .order("desc")
          .take(30),
        ctx.db
          .query("claims")
          .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
          .order("desc")
          .take(20),
        ctx.db
          .query("customerProfiles")
          .withIndex("by_user", (q) => q.eq("userId", policy.customerUserId))
          .unique(),
        policy.brokerUserId ? ctx.db.get(policy.brokerUserId) : null,
      ]);

    return {
      policy,
      product,
      documents,
      requests,
      transactions,
      claims,
      customer,
      broker,
      viewerRole: viewer.role,
    };
  },
});

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireSelfServiceRole(ctx);
    const requests = await ctx.db
      .query("policyRequests")
      .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
      .order("desc")
      .take(50);
    const policies = await ctx.db
      .query("policies")
      .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
      .take(100);
    const policyMap = new Map(policies.map((policy) => [policy._id, policy]));
    return requests.map((request) => ({
      ...request,
      policyNumber: policyMap.get(request.policyId)?.policyNumber ?? "—",
      productName: policyMap.get(request.policyId)?.productName ?? "Policy",
    }));
  },
});

export const requests = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    let rows = await ctx.db.query("policyRequests").take(300);
    if (args.status && args.status !== "all") {
      rows = rows.filter((row) => row.status === args.status);
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const policies = await ctx.db.query("policies").take(300);
    const policyMap = new Map(policies.map((policy) => [policy._id, policy]));
    const people = await ctx.db.query("users").take(300);
    const names = new Map(people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]));
    return rows.map((row) => {
      const policy = policyMap.get(row.policyId);
      return {
        ...row,
        policyNumber: policy?.policyNumber ?? "—",
        productName: policy?.productName ?? "Policy",
        customerName: names.get(row.customerUserId) ?? "Customer",
        policy,
      };
    });
  },
});

export const requestChange = mutation({
  args: {
    policyId: v.id("policies"),
    kind: v.union(
      v.literal("endorsement"),
      v.literal("cancellation"),
      v.literal("renewal"),
      v.literal("suspension"),
    ),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found.");
    await assertPolicyAccess(ctx, viewer, policy);
    if (policy.status === "cancelled" || policy.status === "expired") {
      throw new Error("This policy is no longer active.");
    }
    const details = requiredText(args.details, "Request details", 2000);
    const existing = await ctx.db
      .query("policyRequests")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .take(50);
    if (existing.some((request) => request.status === "pending" && request.kind === args.kind)) {
      throw new Error("A request of this type is already awaiting a decision.");
    }
    const now = Date.now();
    const id = await ctx.db.insert("policyRequests", {
      policyId: policy._id,
      customerUserId: policy.customerUserId,
      kind: args.kind,
      details,
      status: "pending",
      requestedBy: viewer.user._id,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "policy.changed",
      title: `${args.kind} request for ${policy.policyNumber}`,
      body: details,
      href: "/dashboard/admin/policies",
      relatedType: "policyRequests",
      relatedId: id,
      permission: PERMISSIONS.POLICIES_MANAGE,
    });
    await writeAudit(ctx, viewer, {
      action: `policy.request_${args.kind}`,
      entityType: "policyRequests",
      entityId: id,
      after: { policyId: policy._id, kind: args.kind, details },
    });
    return { requestId: id };
  },
});

export const decideRequest = mutation({
  args: {
    requestId: v.id("policyRequests"),
    decision: v.union(v.literal("approved"), v.literal("declined")),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found.");
    if (request.status !== "pending") {
      throw new Error("This request has already been decided.");
    }
    const policy = await ctx.db.get(request.policyId);
    if (!policy) throw new Error("Policy not found.");
    const note = requiredText(args.note, "Decision note", 2000);
    const now = Date.now();

    await ctx.db.patch(request._id, {
      status: args.decision,
      decidedBy: viewer.user._id,
      decisionNote: note,
      decidedAt: now,
    });

    let summary = `Request ${args.decision}: ${note}`;
    if (args.decision === "approved") {
      if (request.kind === "cancellation") {
        await ctx.db.patch(policy._id, {
          status: "cancelled",
          cancelledAt: now,
          cancelReason: request.details,
          updatedAt: now,
          endorsements: [
            ...policy.endorsements,
            { summary: `Cancelled: ${request.details}`, at: now, by: viewer.user._id, requestId: request._id },
          ],
        });
        summary = `Policy ${policy.policyNumber} cancelled. Reason: ${request.details}`;
      } else if (request.kind === "suspension") {
        await ctx.db.patch(policy._id, {
          status: "suspended",
          suspendedAt: now,
          suspensionReason: request.details,
          updatedAt: now,
          endorsements: [
            ...policy.endorsements,
            { summary: `Suspended: ${request.details}`, at: now, by: viewer.user._id, requestId: request._id },
          ],
        });
        summary = `Policy ${policy.policyNumber} suspended. ${request.details}`;
      } else if (request.kind === "renewal") {
        const newEnd = addMonths(Math.max(policy.endDate, now), 12);
        await ctx.db.patch(policy._id, {
          status: "active",
          endDate: newEnd,
          renewalDate: newEnd - 30 * DAY,
          updatedAt: now,
          endorsements: [
            ...policy.endorsements,
            { summary: `Renewed to ${new Date(newEnd).toISOString().slice(0, 10)}`, at: now, by: viewer.user._id, requestId: request._id },
          ],
        });
        await ctx.db.insert("transactions", {
          reference: reference("INV"),
          customerUserId: policy.customerUserId,
          policyId: policy._id,
          type: "premium",
          amount: policy.premium,
          currency: policy.currency,
          status: "pending",
          method: "bank_transfer",
          providerVerified: false,
          idempotencyKey: `renewal:${request._id}`,
          note: `Renewal premium for ${policy.policyNumber}`,
          reconciled: false,
          dueDate: newEnd,
          createdAt: now,
          updatedAt: now,
        });
        summary = `Policy ${policy.policyNumber} renewed to ${new Date(newEnd).toISOString().slice(0, 10)}. A renewal premium is now due.`;
      } else {
        await ctx.db.patch(policy._id, {
          updatedAt: now,
          endorsements: [
            ...policy.endorsements,
            { summary: `Endorsement: ${request.details}`, at: now, by: viewer.user._id, requestId: request._id },
          ],
        });
        summary = `Endorsement approved on ${policy.policyNumber}: ${request.details}`;
      }

      await ctx.db.insert("documents", {
        ownerUserId: policy.customerUserId,
        name: `${policy.policyNumber} — ${request.kind} endorsement`,
        category: "endorsement",
        policyId: policy._id,
        body: `ENDORSEMENT\n\nPolicy: ${policy.policyNumber}\nRequest: ${request.kind}\nEffective: ${new Date(now).toISOString()}\n\n${request.details}\n\nApproved by staff. ${note}`,
        contentType: "text/plain",
        version: policy.endorsements.length + 2,
        issuedBy: viewer.user._id,
        issuedAt: now,
        createdAt: now,
      });
    }

    await notifyUser(ctx, {
      userId: policy.customerUserId,
      type: "policy.changed",
      title: `Policy request ${args.decision}`,
      body: summary,
      href: "/dashboard/policies",
      relatedType: "policyRequests",
      relatedId: request._id,
      dedupeKey: `policy-request:${request._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: `policy.request_${args.decision}`,
      entityType: "policyRequests",
      entityId: request._id,
      before: { status: "pending" },
      after: { status: args.decision, policyStatus: request.kind === "cancellation" && args.decision === "approved" ? "cancelled" : policy.status },
      reason: note,
    });
    return true;
  },
});

export const setStatus = mutation({
  args: {
    policyId: v.id("policies"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found.");
    if (policy.status === args.status) return true;
    const reason = requiredText(args.reason, "Reason", 1000);
    const now = Date.now();
    await ctx.db.patch(policy._id, {
      status: args.status,
      cancelledAt: args.status === "cancelled" ? now : policy.cancelledAt,
      cancelReason: args.status === "cancelled" ? reason : policy.cancelReason,
      suspendedAt: args.status === "suspended" ? now : policy.suspendedAt,
      suspensionReason: args.status === "suspended" ? reason : policy.suspensionReason,
      updatedAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: `policy.status_${args.status}`,
      entityType: "policies",
      entityId: policy._id,
      before: { status: policy.status },
      after: { status: args.status },
      reason,
    });
    await notifyUser(ctx, {
      userId: policy.customerUserId,
      type: "policy.changed",
      title: `Policy ${policy.policyNumber} updated`,
      body: `Status changed to ${args.status}. ${reason}`,
      href: "/dashboard/policies",
      relatedType: "policies",
      relatedId: policy._id,
      dedupeKey: `policy-status:${policy._id}:${args.status}:${now}`,
    });
    return true;
  },
});
