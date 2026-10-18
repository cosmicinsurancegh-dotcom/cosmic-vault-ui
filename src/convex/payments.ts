import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  PERMISSIONS,
  isStaffRole,
  requirePermission,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { notifyStaff, notifyUser } from "./lib/notify";
import { reference, requiredText } from "./lib/refs";

const DAY = 24 * 60 * 60 * 1000;

const formatMoney = (amount: number, currency: string) =>
  `${(amount / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })} ${currency}`;

async function assertTransactionAccess(
  ctx: Parameters<typeof requireViewer>[0],
  viewer: Viewer,
  transaction: Doc<"transactions">,
) {
  if (transaction.customerUserId === viewer.user._id) return;
  if (isStaffRole(viewer.role)) {
    const allowed =
      viewer.role === "super_admin" ||
      viewer.permissions.includes(PERMISSIONS.PAYMENTS_VIEW) ||
      viewer.permissions.includes(PERMISSIONS.PAYMENTS_MANAGE);
    if (!allowed) throw new Error("You do not have permission to view transactions.");
    return;
  }
  throw new Error("You do not have access to this transaction.");
}

export const initiatePremium = mutation({
  args: {
    policyId: v.optional(v.id("policies")),
    applicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role !== "customer") {
      throw new Error("Premiums are paid from the customer account.");
    }
    if (!args.policyId && !args.applicationId) {
      throw new Error("Choose the application or policy this payment is for.");
    }

    let amount = 0;
    let currency = "";
    let customerUserId: Doc<"transactions">["customerUserId"] | undefined;
    let idempotencyKey = "";
    let label = "";

    if (args.applicationId) {
      const application = await ctx.db.get(args.applicationId);
      if (!application) throw new Error("Application not found.");
      if (application.customerUserId !== viewer.user._id) {
        throw new Error("You can only pay for your own application.");
      }
      if (application.status !== "approved") {
        throw new Error("The premium becomes payable once the application is approved.");
      }
      amount = application.premium;
      currency = application.currency;
      customerUserId = application.customerUserId;
      idempotencyKey = `premium:application:${application._id}`;
      label = `Premium for application ${application.reference}`;
    } else if (args.policyId) {
      const policy = await ctx.db.get(args.policyId);
      if (!policy) throw new Error("Policy not found.");
      if (policy.customerUserId !== viewer.user._id) {
        throw new Error("You can only pay for your own policy.");
      }
      if (policy.status === "cancelled") {
        throw new Error("This policy has been cancelled.");
      }
      amount = policy.premium;
      currency = policy.currency;
      customerUserId = policy.customerUserId;
      idempotencyKey = `premium:policy:${policy._id}`;
      label = `Premium for policy ${policy.policyNumber}`;
    }
    if (!customerUserId) throw new Error("Choose a payment subject.");

    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
      .first();
    if (existing) {
      if (existing.status === "succeeded") {
        throw new Error("This premium has already been paid. Check your receipts.");
      }
      return { transactionId: existing._id, reference: existing.reference };
    }

    const now = Date.now();
    const id = await ctx.db.insert("transactions", {
      reference: reference("PAY"),
      customerUserId,
      policyId: args.policyId,
      applicationId: args.applicationId,
      type: "premium",
      amount,
      currency,
      status: "pending",
      method: "bank_transfer",
      providerVerified: false,
      idempotencyKey,
      note: label,
      reconciled: false,
      dueDate: now + 7 * DAY,
      createdAt: now,
      updatedAt: now,
    });

    const created = (await ctx.db.get(id))!;
    await notifyUser(ctx, {
      userId: customerUserId,
      type: "payment.succeeded",
      title: "Payment instructions created",
      body: `Transfer ${formatMoney(amount, currency)} quoting ${created.reference}. Finance will confirm receipt before the policy or renewal proceeds.`,
      href: "/dashboard/payments",
      relatedType: "transactions",
      relatedId: id,
      dedupeKey: `payment-initiated:${id}`,
    });
    await notifyStaff(ctx, {
      type: "payment.succeeded",
      title: "Premium payment pending confirmation",
      body: `${label} - ${formatMoney(amount, currency)}.`,
      href: "/dashboard/admin/payments",
      relatedType: "transactions",
      relatedId: id,
      permission: PERMISSIONS.PAYMENTS_MANAGE,
    });
    return { transactionId: id, reference: created.reference };
  },
});

export const initiatePolicyRenewal = mutation({
  args: { policyId: v.id("policies") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found.");
    if (policy.customerUserId !== viewer.user._id) {
      throw new Error("You can only renew your own policy.");
    }
    const pending = await ctx.db
      .query("policyRequests")
      .withIndex("by_policy", (q) => q.eq("policyId", policy._id))
      .take(50);
    const renewal = pending.find(
      (request) => request.kind === "renewal" && request.status === "pending",
    );
    if (!renewal) {
      throw new Error("Ask your advisor to open a renewal offer first.");
    }
    const existing = await ctx.db
      .query("transactions")
      .withIndex("by_idempotency", (q) =>
        q.eq("idempotencyKey", `renewal:${renewal._id}`),
      )
      .first();
    if (existing) return { transactionId: existing._id, reference: existing.reference };
    const now = Date.now();
    const id = await ctx.db.insert("transactions", {
      reference: reference("PAY"),
      customerUserId: policy.customerUserId,
      policyId: policy._id,
      type: "premium",
      amount: policy.premium,
      currency: policy.currency,
      status: "pending",
      method: "bank_transfer",
      providerVerified: false,
      idempotencyKey: `renewal:${renewal._id}`,
      note: `Renewal premium for ${policy.policyNumber}`,
      reconciled: false,
      dueDate: now + 7 * DAY,
      createdAt: now,
      updatedAt: now,
    });
    await notifyStaff(ctx, {
      type: "payment.succeeded",
      title: "Renewal payment pending",
      body: `${policy.policyNumber} - ${formatMoney(policy.premium, policy.currency)}.`,
      href: "/dashboard/admin/payments",
      relatedType: "transactions",
      relatedId: id,
      permission: PERMISSIONS.PAYMENTS_MANAGE,
    });
    return { transactionId: id, reference: (await ctx.db.get(id))!.reference };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    return await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
      .order("desc")
      .take(100);
  },
});

export const listStaff = query({
  args: {
    status: v.optional(v.string()),
    type: v.optional(v.string()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.PAYMENTS_VIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();
    let rows = await ctx.db.query("transactions").take(600);
    rows = rows.filter(
      (row) =>
        (!args.status || args.status === "all" || row.status === args.status) &&
        (!args.type || args.type === "all" || row.type === args.type) &&
        (!search ||
          row.reference.toLowerCase().includes(search) ||
          (row.providerRef ?? "").toLowerCase().includes(search) ||
          (row.note ?? "").toLowerCase().includes(search)),
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
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found.");
    await assertTransactionAccess(ctx, viewer, transaction);
    const [policy, application, claim] = await Promise.all([
      transaction.policyId ? ctx.db.get(transaction.policyId) : null,
      transaction.applicationId ? ctx.db.get(transaction.applicationId) : null,
      transaction.claimId ? ctx.db.get(transaction.claimId) : null,
    ]);
    return { transaction, policy, application, claim };
  },
});

export const mineByReference = query({
  args: { reference: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const row = await ctx.db
      .query("transactions")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference.trim().toUpperCase()))
      .first();
    if (!row) return null;
    // Return the same `null` as an unknown reference: distinguishing "not
    // yours" from "does not exist" would turn this lookup into an oracle for
    // other members' payment references.
    if (row.customerUserId !== viewer.user._id && !isStaffRole(viewer.role)) {
      return null;
    }
    return row;
  },
});

export const confirm = mutation({
  args: {
    transactionId: v.id("transactions"),
    providerRef: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PAYMENTS_MANAGE);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.status === "succeeded") {
      throw new Error("This transaction is already confirmed. Duplicate confirmation blocked.");
    }
    if (transaction.status === "refunded") {
      throw new Error("This transaction has been refunded.");
    }
    const providerRef = requiredText(args.providerRef, "Provider reference", 160);
    const now = Date.now();
    await ctx.db.patch(transaction._id, {
      status: "succeeded",
      providerRef,
      providerVerified: true,
      reconciled: true,
      reconciledBy: viewer.user._id,
      reconciledAt: now,
      note: args.note ? `${transaction.note ?? ""} ${args.note}`.trim() : transaction.note,
      failureReason: undefined,
      updatedAt: now,
    });

    const label = transaction.note ?? transaction.reference;
    const receiptId = await ctx.db.insert("documents", {
      ownerUserId: transaction.customerUserId,
      name: `${transaction.reference} - receipt`,
      category: "receipt",
      policyId: transaction.policyId,
      applicationId: transaction.applicationId,
      claimId: transaction.claimId,
      body: [
        "PAYMENT RECEIPT",
        "",
        `Receipt: ${transaction.reference}`,
        `Amount: ${formatMoney(transaction.amount, transaction.currency)}`,
        `Confirmed on: ${new Date(now).toISOString()}`,
        `Provider reference: ${providerRef}`,
        `For: ${label}`,
        "",
        "Confirmed by the finance team after reconciliation of the received funds.",
      ].join("\n"),
      contentType: "text/plain",
      version: 1,
      issuedBy: viewer.user._id,
      issuedAt: now,
      createdAt: now,
    });

    await notifyUser(ctx, {
      userId: transaction.customerUserId,
      type: "payment.succeeded",
      title: "Payment confirmed",
      body: `${formatMoney(transaction.amount, transaction.currency)} was confirmed for ${label}. Receipt ${transaction.reference} is available in your documents.`,
      href: "/dashboard/payments",
      relatedType: "transactions",
      relatedId: transaction._id,
      dedupeKey: `payment-confirmed:${transaction._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: "payment.confirmed",
      entityType: "transactions",
      entityId: transaction._id,
      before: { status: transaction.status },
      after: { status: "succeeded", providerRef, receiptId },
      reason: args.note,
    });
    return true;
  },
});

export const fail = mutation({
  args: { transactionId: v.id("transactions"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PAYMENTS_MANAGE);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.status === "succeeded") {
      throw new Error("Confirmed payments cannot be marked failed. Use a refund instead.");
    }
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(transaction._id, {
      status: "failed",
      failureReason: reason,
      updatedAt: Date.now(),
    });
    await notifyUser(ctx, {
      userId: transaction.customerUserId,
      type: "payment.failed",
      title: "Payment not confirmed",
      body: `${transaction.reference} could not be confirmed: ${reason}`,
      href: "/dashboard/payments",
      relatedType: "transactions",
      relatedId: transaction._id,
      dedupeKey: `payment-failed:${transaction._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: "payment.failed",
      entityType: "transactions",
      entityId: transaction._id,
      reason,
    });
    return true;
  },
});

export const refund = mutation({
  args: {
    transactionId: v.id("transactions"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.REFUNDS_APPROVE);
    const original = await ctx.db.get(args.transactionId);
    if (!original) throw new Error("Transaction not found.");
    if (original.status !== "succeeded") {
      throw new Error("Only confirmed transactions can be refunded.");
    }
    if (original.type === "refund") {
      throw new Error("Refund transactions cannot be refunded again.");
    }
    const reason = requiredText(args.reason, "Refund reason", 1000);
    const amount = Math.round(args.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("Enter a valid refund amount.");
    }
    const previous = await ctx.db
      .query("transactions")
      .withIndex("by_idempotency", (q) =>
        q.eq("idempotencyKey", `refund:${original._id}`),
      )
      .first();
    if (previous) {
      throw new Error("A refund has already been recorded for this transaction.");
    }
    if (amount > original.amount) {
      throw new Error("The refund cannot exceed the original amount.");
    }

    const now = Date.now();
    const refundId = await ctx.db.insert("transactions", {
      reference: reference("REF"),
      customerUserId: original.customerUserId,
      policyId: original.policyId,
      applicationId: original.applicationId,
      claimId: original.claimId,
      type: "refund",
      amount,
      currency: original.currency,
      status: "succeeded",
      method: original.method,
      providerRef: original.providerRef,
      providerVerified: original.providerVerified,
      idempotencyKey: `refund:${original._id}`,
      note: reason,
      recordedBy: viewer.user._id,
      reconciled: true,
      reconciledBy: viewer.user._id,
      reconciledAt: now,
      refundOf: original._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(original._id, {
      status: amount >= original.amount ? "refunded" : original.status,
      updatedAt: now,
    });
    await ctx.db.insert("documents", {
      ownerUserId: original.customerUserId,
      name: `${reference("REF")} - refund confirmation`,
      category: "receipt",
      policyId: original.policyId,
      applicationId: original.applicationId,
      claimId: original.claimId,
      body: `REFUND CONFIRMATION\n\nOriginal transaction: ${original.reference}\nRefund amount: ${formatMoney(amount, original.currency)}\nReason: ${reason}\nRecorded: ${new Date(now).toISOString()}`,
      contentType: "text/plain",
      version: 1,
      issuedBy: viewer.user._id,
      issuedAt: now,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: original.customerUserId,
      type: "payment.succeeded",
      title: "Refund recorded",
      body: `${formatMoney(amount, original.currency)} was refunded against ${original.reference}. Reason: ${reason}`,
      href: "/dashboard/payments",
      relatedType: "transactions",
      relatedId: refundId,
      dedupeKey: `refund:${refundId}`,
    });
    await writeAudit(ctx, viewer, {
      action: "payment.refunded",
      entityType: "transactions",
      entityId: refundId,
      before: { original: original._id, amount: original.amount },
      after: { amount, refundOf: original._id },
      reason,
    });
    return { refundId };
  },
});

export const recordSettlement = mutation({
  args: {
    claimId: v.id("claims"),
    providerRef: v.string(),
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("card"),
      v.literal("manual"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PAYMENTS_MANAGE);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (!claim.decision || claim.decision === "declined") {
      throw new Error("A settlement can only follow an approved claim decision.");
    }
    if (!claim.approvedAmount || claim.approvedAmount <= 0) {
      throw new Error("This claim has no approved settlement amount.");
    }
    if (claim.status === "paid") {
      throw new Error("A settlement has already been recorded for this claim.");
    }
    const providerRef = requiredText(args.providerRef, "Payment reference", 160);
    const now = Date.now();
    const settlementId = await ctx.db.insert("transactions", {
      reference: reference("SET"),
      customerUserId: claim.customerUserId,
      policyId: claim.policyId,
      claimId: claim._id,
      type: "settlement",
      amount: claim.approvedAmount,
      currency: claim.currency,
      status: "succeeded",
      method: args.method,
      providerRef,
      providerVerified: args.method !== "manual",
      idempotencyKey: `settlement:${claim._id}`,
      note: args.note?.trim() || `Claim settlement for ${claim.reference}`,
      recordedBy: viewer.user._id,
      reconciled: true,
      reconciledBy: viewer.user._id,
      reconciledAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(claim._id, {
      status: "paid",
      settlementRef: providerRef,
      paidAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "settlement",
      message: `Settlement of ${formatMoney(claim.approvedAmount, claim.currency)} recorded (${args.method}, ref ${providerRef}).`,
      fromStatus: claim.status,
      toStatus: "paid",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: claim.customerUserId,
      type: "claim.settled",
      title: "Settlement payment recorded",
      body: `${formatMoney(claim.approvedAmount, claim.currency)} was recorded against claim ${claim.reference}.`,
      href: "/dashboard/claims",
      relatedType: "claims",
      relatedId: claim._id,
      dedupeKey: `claim-settled:${claim._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: "claim.settlement_recorded",
      entityType: "claims",
      entityId: claim._id,
      after: { settlementId, amount: claim.approvedAmount, providerRef },
      reason: args.note,
    });
    return { settlementId };
  },
});

export const markOutstanding = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PAYMENTS_MANAGE);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.status !== "pending") {
      throw new Error("Only pending transactions can be marked overdue.");
    }
    await ctx.db.patch(transaction._id, {
      dueDate: Date.now() - DAY,
      updatedAt: Date.now(),
    });
    await notifyUser(ctx, {
      userId: transaction.customerUserId,
      type: "payment.failed",
      title: "Premium overdue",
      body: `${transaction.reference} is now overdue. Contact support if you have already paid.`,
      href: "/dashboard/payments",
      relatedType: "transactions",
      relatedId: transaction._id,
      dedupeKey: `overdue:${transaction._id}:${Date.now()}`,
    });
    await writeAudit(ctx, viewer, {
      action: "payment.marked_overdue",
      entityType: "transactions",
      entityId: transaction._id,
    });
    return true;
  },
});
