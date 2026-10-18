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
import { validateUpload } from "./lib/files";
import { notifyStaff, notifyUser } from "./lib/notify";
import { reference, requiredText } from "./lib/refs";

const documentInput = v.object({
  name: v.string(),
  key: v.string(),
  storageId: v.optional(v.id("_storage")),
  body: v.optional(v.string()),
});

async function assertClaimAccess(
  ctx: Parameters<typeof validateUpload>[0],
  viewer: Viewer,
  claim: Doc<"claims">,
) {
  if (claim.customerUserId === viewer.user._id) return;
  if (isStaffRole(viewer.role)) {
    const allowed =
      viewer.role === "super_admin" ||
      viewer.permissions.includes(PERMISSIONS.CLAIMS_REVIEW) ||
      viewer.permissions.includes(PERMISSIONS.CLAIMS_DECIDE);
    if (!allowed) throw new Error("You do not have permission to view claims.");
    return;
  }
  throw new Error("You do not have access to this claim.");
}

export const submit = mutation({
  args: {
    policyId: v.id("policies"),
    incidentDate: v.number(),
    location: v.string(),
    description: v.string(),
    amountClaimed: v.number(),
    documents: v.array(documentInput),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role !== "customer") {
      throw new Error("Claims can be submitted by the policyholder's customer account.");
    }
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found.");
    if (policy.customerUserId !== viewer.user._id) {
      throw new Error("You can only claim against your own policy.");
    }
    if (policy.status !== "active") {
      throw new Error("Claims can only be submitted against an active policy.");
    }
    const now = Date.now();
    if (args.incidentDate > now) {
      throw new Error("The incident date cannot be in the future.");
    }
    if (args.incidentDate < policy.startDate || args.incidentDate > policy.endDate) {
      throw new Error(
        `The incident date must fall within the policy term (${new Date(policy.startDate).toLocaleDateString()} – ${new Date(policy.endDate).toLocaleDateString()}).`,
      );
    }
    const location = requiredText(args.location, "Incident location", 200);
    const description = requiredText(args.description, "Incident description", 4000);
    if (description.length < 20) {
      throw new Error("Please describe what happened in at least 20 characters.");
    }
    if (!Number.isInteger(args.amountClaimed) || args.amountClaimed <= 0) {
      throw new Error("Enter the amount claimed.");
    }
    if (args.amountClaimed > policy.coverageLimit) {
      throw new Error(
        `The amount claimed cannot exceed the policy coverage limit (${(policy.coverageLimit / 100).toLocaleString()} ${policy.currency}).`,
      );
    }
    if (args.documents.length === 0) {
      throw new Error("Attach at least one piece of supporting evidence.");
    }
    if (args.documents.length > 10) {
      throw new Error("Attach at most 10 documents.");
    }

    const documents = [];
    const insertedDocumentIds: Doc<"documents">["_id"][] = [];
    for (const doc of args.documents) {
      const name = requiredText(doc.name, "Document name", 160);
      const key = requiredText(doc.key, "Document type", 80);
      if (!doc.storageId && !doc.body?.trim()) {
        throw new Error(`Attach a file for ${name}.`);
      }
      let size: number | undefined;
      let contentType = "text/plain";
      if (doc.storageId) {
        const meta = await validateUpload(ctx, doc.storageId);
        size = meta.size;
        contentType = meta.contentType;
      }
      documents.push({
        name,
        key,
        storageId: doc.storageId,
        body: doc.body?.trim(),
        addedBy: viewer.user._id,
        addedAt: now,
      });
      insertedDocumentIds.push(
        await ctx.db.insert("documents", {
          ownerUserId: policy.customerUserId,
          name,
          category: "claim",
          claimId: undefined,
          storageId: doc.storageId,
          body: doc.body?.trim(),
          contentType,
          size,
          version: 1,
          issuedAt: now,
          createdAt: now,
        }),
      );
    }

    const claimRef = reference("CLM");
    const claimId = await ctx.db.insert("claims", {
      reference: claimRef,
      policyId: policy._id,
      customerUserId: policy.customerUserId,
      productId: policy.productId,
      productName: policy.productName,
      country: policy.country,
      currency: policy.currency,
      incidentDate: args.incidentDate,
      location,
      description,
      amountClaimed: args.amountClaimed,
      status: "submitted",
      documents,
      reportedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Link the evidence rows to the claim now that it exists.
    for (const documentId of insertedDocumentIds) {
      await ctx.db.patch(documentId, { claimId });
    }

    await ctx.db.insert("claimEvents", {
      claimId,
      actorId: viewer.user._id,
      actorRole: "customer",
      kind: "status",
      message: "Claim submitted with supporting evidence.",
      toStatus: "submitted",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: policy.customerUserId,
      type: "claim.submitted",
      title: "Claim received",
      body: `Claim ${claimRef} is queued for review. This is not an admission of cover.`,
      href: "/dashboard/claims",
      relatedType: "claims",
      relatedId: claimId,
      dedupeKey: `claim-submitted:${claimId}`,
    });
    await notifyStaff(ctx, {
      type: "claim.submitted",
      title: `New claim ${claimRef}`,
      body: `${policy.productName} · ${(args.amountClaimed / 100).toLocaleString()} ${policy.currency} claimed.`,
      href: "/dashboard/admin/claims",
      relatedType: "claims",
      relatedId: claimId,
      permission: PERMISSIONS.CLAIMS_REVIEW,
    });
    return { claimId, reference: claimRef };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    return await ctx.db
      .query("claims")
      .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
      .order("desc")
      .take(100);
  },
});

export const queue = query({
  args: {
    status: v.optional(v.string()),
    country: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CLAIMS_REVIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();
    let rows = await ctx.db.query("claims").take(500);
    rows = rows.filter(
      (row) =>
        (!args.status || args.status === "all" || row.status === args.status) &&
        (!args.country || args.country === "all" || row.country === args.country) &&
        (!args.assignedTo || row.assignedTo === args.assignedTo) &&
        (!search ||
          row.reference.toLowerCase().includes(search) ||
          row.productName.toLowerCase().includes(search) ||
          row.location.toLowerCase().includes(search)),
    );
    rows.sort((a, b) => b.reportedAt - a.reportedAt);
    const people = await ctx.db.query("users").take(500);
    const names = new Map(people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]));
    const policies = await ctx.db.query("policies").take(500);
    const policyMap = new Map(policies.map((policy) => [policy._id, policy]));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize).map((row) => ({
        ...row,
        customerName: names.get(row.customerUserId) ?? "Customer",
        policyNumber: policyMap.get(row.policyId)?.policyNumber ?? "-",
      })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});

export const get = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    await assertClaimAccess(ctx, viewer, claim);
    const [events, policy, customer, transactions] = await Promise.all([
      ctx.db
        .query("claimEvents")
        .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
        .order("asc")
        .take(200),
      ctx.db.get(claim.policyId),
      ctx.db
        .query("customerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", claim.customerUserId))
        .unique(),
      ctx.db
        .query("transactions")
        .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
        .order("desc")
        .take(20),
    ]);
    return {
      claim,
      policy,
      customer,
      transactions,
      events: isStaffRole(viewer.role)
        ? events
        : events.filter((event) => !event.internal),
      canReview:
        isStaffRole(viewer.role) &&
        (viewer.role === "super_admin" ||
          viewer.permissions.includes(PERMISSIONS.CLAIMS_REVIEW)),
      canDecide:
        isStaffRole(viewer.role) &&
        (viewer.role === "super_admin" ||
          viewer.permissions.includes(PERMISSIONS.CLAIMS_DECIDE)),
    };
  },
});

export const assign = mutation({
  args: { claimId: v.id("claims"), staffUserId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CLAIMS_REVIEW);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    const staff = await ctx.db.get(args.staffUserId);
    if (!staff || (staff.role !== "admin" && staff.role !== "super_admin")) {
      throw new Error("Assign claims to an active staff handler.");
    }
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      assignedTo: args.staffUserId,
      status: claim.status === "submitted" ? "under_review" : claim.status,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: `Assigned to ${staff.name ?? staff.email ?? "a handler"}.`,
      internal: true,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: args.staffUserId,
      type: "support.updated",
      title: `Claim ${claim.reference} assigned to you`,
      body: `${claim.productName} - review the evidence and record an assessment.`,
      href: "/dashboard/admin/claims",
      dedupeKey: `claim-assigned:${claim._id}:${args.staffUserId}`,
    });
    return true;
  },
});

export const addDocument = mutation({
  args: { claimId: v.id("claims"), document: documentInput },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (claim.customerUserId !== viewer.user._id) {
      throw new Error("You can only add evidence to your own claim.");
    }
    if (["closed", "declined", "paid"].includes(claim.status)) {
      throw new Error("Evidence can no longer be added to this claim.");
    }
    const name = requiredText(args.document.name, "Document name", 160);
    const key = requiredText(args.document.key, "Document type", 80);
    if (!args.document.storageId && !args.document.body?.trim()) {
      throw new Error(`Attach a file for ${name}.`);
    }
    const now = Date.now();
    let contentType = "text/plain";
    let size: number | undefined;
    if (args.document.storageId) {
      const meta = await validateUpload(ctx, args.document.storageId);
      contentType = meta.contentType;
      size = meta.size;
    }
    await ctx.db.patch(claim._id, {
      documents: [
        ...claim.documents,
        {
          name,
          key,
          storageId: args.document.storageId,
          body: args.document.body?.trim(),
          addedBy: viewer.user._id,
          addedAt: now,
        },
      ],
      updatedAt: now,
    });
    await ctx.db.insert("documents", {
      ownerUserId: claim.customerUserId,
      name,
      category: "claim",
      claimId: claim._id,
      storageId: args.document.storageId,
      body: args.document.body?.trim(),
      contentType,
      size,
      version: 1,
      issuedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: "customer",
      kind: "document",
      message: `Uploaded ${name}.`,
      internal: false,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "claim.status_changed",
      title: `New evidence on ${claim.reference}`,
      body: `${name} was uploaded.`,
      href: "/dashboard/admin/claims",
      relatedType: "claims",
      relatedId: claim._id,
      permission: PERMISSIONS.CLAIMS_REVIEW,
    });
    return true;
  },
});

export const requestInfo = mutation({
  args: { claimId: v.id("claims"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CLAIMS_REVIEW);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (["declined", "paid", "closed"].includes(claim.status)) {
      throw new Error("This claim already has a final outcome.");
    }
    const message = requiredText(args.message, "Information request", 2000);
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      status: "additional_info_required",
      infoRequest: message,
      infoRequestAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "info_request",
      message,
      fromStatus: claim.status,
      toStatus: "additional_info_required",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: claim.customerUserId,
      type: "claim.status_changed",
      title: "Evidence needed for your claim",
      body: message,
      href: "/dashboard/claims",
      relatedType: "claims",
      relatedId: claim._id,
      dedupeKey: `claim-info:${claim._id}:${now}`,
    });
    await writeAudit(ctx, viewer, {
      action: "claim.info_requested",
      entityType: "claims",
      entityId: claim._id,
      reason: message,
    });
    return true;
  },
});

export const respond = mutation({
  args: { claimId: v.id("claims"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (claim.customerUserId !== viewer.user._id) {
      throw new Error("You can only respond to your own claim.");
    }
    if (claim.status !== "additional_info_required") {
      throw new Error("This claim is not waiting for information.");
    }
    const message = requiredText(args.message, "Response", 3000);
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      status: "under_review",
      customerResponse: message,
      infoRequest: undefined,
      infoRequestAt: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: "customer",
      kind: "note",
      message,
      fromStatus: "additional_info_required",
      toStatus: "under_review",
      internal: false,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "claim.status_changed",
      title: `Customer responded on ${claim.reference}`,
      body: message,
      href: "/dashboard/admin/claims",
      relatedType: "claims",
      relatedId: claim._id,
      permission: PERMISSIONS.CLAIMS_REVIEW,
    });
    return true;
  },
});

export const note = mutation({
  args: { claimId: v.id("claims"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CLAIMS_REVIEW);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    const message = requiredText(args.message, "Note", 2000);
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "note",
      message,
      internal: true,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const decide = mutation({
  args: {
    claimId: v.id("claims"),
    decision: v.union(
      v.literal("approved"),
      v.literal("partially_approved"),
      v.literal("declined"),
    ),
    approvedAmount: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CLAIMS_DECIDE);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (claim.decision) {
      throw new Error("A claim decision has already been recorded.");
    }
    if (!["submitted", "under_review", "under_assessment", "additional_info_required"].includes(claim.status)) {
      throw new Error("This claim is not in a reviewable state.");
    }
    const reason = requiredText(args.reason, "Decision reason", 2000);
    const approvedAmount =
      args.decision === "declined" ? 0 : Math.round(args.approvedAmount ?? 0);
    if (args.decision !== "declined" && approvedAmount <= 0) {
      throw new Error("Enter the approved settlement amount.");
    }
    if (approvedAmount > claim.amountClaimed) {
      throw new Error("The approved amount cannot exceed the amount claimed.");
    }
    const now = Date.now();
    const status =
      args.decision === "declined" ? "declined" : "payment_pending";
    await ctx.db.patch(claim._id, {
      status,
      decision: args.decision,
      approvedAmount,
      decisionReason: reason,
      decidedBy: viewer.user._id,
      decidedAt: now,
      assignedTo: claim.assignedTo ?? viewer.user._id,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "decision",
      message: `${args.decision.replace("_", " ")} - ${reason}`,
      fromStatus: claim.status,
      toStatus: status,
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: claim.customerUserId,
      type: args.decision === "declined" ? "claim.status_changed" : "claim.settled",
      title:
        args.decision === "declined"
          ? "Claim decision recorded"
          : "Claim approved - settlement pending",
      body:
        args.decision === "declined"
          ? `Claim ${claim.reference} was declined. Reason: ${reason}. You can raise a complaint from the claim page.`
          : `Claim ${claim.reference} was ${args.decision === "partially_approved" ? "partially approved" : "approved"} for ${(approvedAmount / 100).toLocaleString()} ${claim.currency}. The decision and settlement are tracked separately; payment has not yet been made.`,
      href: "/dashboard/claims",
      relatedType: "claims",
      relatedId: claim._id,
      dedupeKey: `claim-decided:${claim._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: "claim.decided",
      entityType: "claims",
      entityId: claim._id,
      before: { status: claim.status },
      after: { status, decision: args.decision, approvedAmount },
      reason,
    });
    return true;
  },
});

export const close = mutation({
  args: { claimId: v.id("claims"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CLAIMS_DECIDE);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (claim.status === "closed") return true;
    if (!["paid", "declined"].includes(claim.status)) {
      throw new Error("Only paid or declined claims can be closed.");
    }
    const reason = requiredText(args.reason, "Closure reason", 1000);
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      status: "closed",
      closedAt: now,
      closureReason: reason,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: `Claim closed: ${reason}`,
      fromStatus: claim.status,
      toStatus: "closed",
      internal: false,
      createdAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: "claim.closed",
      entityType: "claims",
      entityId: claim._id,
      reason,
    });
    await notifyUser(ctx, {
      userId: claim.customerUserId,
      type: "claim.status_changed",
      title: `Claim ${claim.reference} closed`,
      body: reason,
      href: "/dashboard/claims",
      relatedType: "claims",
      relatedId: claim._id,
      dedupeKey: `claim-closed:${claim._id}`,
    });
    return true;
  },
});

export const dispute = mutation({
  args: { claimId: v.id("claims"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found.");
    if (claim.customerUserId !== viewer.user._id) {
      throw new Error("You can only dispute your own claim.");
    }
    if (!claim.decision) {
      throw new Error("You can raise a complaint once a decision is recorded.");
    }
    if (claim.decidedAt && claim.decidedAt < Date.now() - 90 * 24 * 60 * 60 * 1000) {
      throw new Error("The complaint window for this decision has closed. Contact support.");
    }
    const message = requiredText(args.message, "Complaint details", 3000);
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      disputeMessage: message,
      updatedAt: now,
    });
    await ctx.db.insert("claimEvents", {
      claimId: claim._id,
      actorId: viewer.user._id,
      actorRole: "customer",
      kind: "decision",
      message: `Complaint raised: ${message}`,
      internal: false,
      createdAt: now,
    });
    const ticketRef = reference("SUP");
    const ticketId = await ctx.db.insert("tickets", {
      reference: ticketRef,
      userId: claim.customerUserId,
      category: "complaint",
      subject: `Complaint about claim ${claim.reference}`,
      message,
      status: "open",
      priority: "high",
      relatedType: "claims",
      relatedId: claim._id,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("ticketMessages", {
      ticketId,
      authorId: viewer.user._id,
      authorRole: "customer",
      body: message,
      internal: false,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "support.updated",
      title: `Complaint raised on ${claim.reference}`,
      body: message,
      href: "/dashboard/admin/support",
      relatedType: "tickets",
      relatedId: ticketId,
      permission: PERMISSIONS.CLAIMS_REVIEW,
    });
    await writeAudit(ctx, viewer, {
      action: "claim.dispute_raised",
      entityType: "claims",
      entityId: claim._id,
      reason: message,
    });
    return { ticketReference: ticketRef };
  },
});
