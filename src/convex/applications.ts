import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  PERMISSIONS,
  isStaffRole,
  requirePermission,
  requireSelfServiceRole,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { assertCustomerAccess, isBrokerAssigned } from "./lib/access";
import { writeAudit } from "./lib/audit";
import { validateUpload } from "./lib/files";
import { notifyStaff, notifyUser } from "./lib/notify";
import { ensureCustomerProfile } from "./lib/people";
import { priceProduct, validateAnswers } from "./lib/pricing";
import { addMonths, DAY, reference, requiredText } from "./lib/refs";
import type { Doc, Id as DocId } from "./_generated/dataModel";

export const documentInput = v.object({
  name: v.string(),
  key: v.string(),
  storageId: v.optional(v.id("_storage")),
  body: v.optional(v.string()),
});

type DocumentInput = {
  name: string;
  key: string;
  storageId?: Id<"_storage">;
  body?: string;
};

export async function assertApplicationAccess(
  ctx: Parameters<typeof assertCustomerAccess>[0],
  viewer: Viewer,
  application: Doc<"applications">,
  permission = PERMISSIONS.APPLICATIONS_REVIEW,
) {
  if (isStaffRole(viewer.role)) {
    await assertCustomerAccess(ctx, viewer, application.customerUserId, permission);
    return;
  }
  if (viewer.role === "broker") {
    if (
      application.brokerUserId === viewer.user._id ||
      (await isBrokerAssigned(ctx, viewer.user._id, application.customerUserId))
    ) {
      return;
    }
    throw new Error("This application is not assigned to your brokerage.");
  }
  if (application.customerUserId !== viewer.user._id) {
    throw new Error("You do not have access to this application.");
  }
}

async function cleanDocuments(
  ctx: Parameters<typeof validateUpload>[0],
  docs: DocumentInput[],
) {
  if (docs.length > 10) throw new Error("Attach at most 10 documents.");
  const cleaned = [];
  for (const doc of docs) {
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
    cleaned.push({ name, key, storageId: doc.storageId, body: doc.body?.trim(), size, contentType });
  }
  return cleaned;
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireSelfServiceRole(ctx);
    let rows: Doc<"applications">[] = [];
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
      rows = (await ctx.db.query("applications").order("desc").take(500))
        .filter(
          (application) =>
            application.brokerUserId === viewer.user._id ||
            customerIds.has(application.customerUserId),
        )
        .slice(0, 150);
    } else {
      rows = await ctx.db
        .query("applications")
        .withIndex("by_customer", (q) => q.eq("customerUserId", viewer.user._id))
        .order("desc")
        .take(100);
    }
    const people = await ctx.db.query("users").take(300);
    const names = new Map(people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]));
    return rows.map((row) => ({
      ...row,
      customerName: names.get(row.customerUserId) ?? "Customer",
    }));
  },
});

export const queue = query({
  args: {
    status: v.optional(v.string()),
    productId: v.optional(v.id("products")),
    country: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.APPLICATIONS_REVIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 10));
    const search = args.search?.trim().toLowerCase();

    let rows = await ctx.db.query("applications").take(500);
    rows = rows.filter(
      (row) =>
        (!args.status || args.status === "all" || row.status === args.status) &&
        (!args.productId || row.productId === args.productId) &&
        (!args.country || args.country === "all" || row.country === args.country) &&
        (!args.assignedTo || row.assignedTo === args.assignedTo) &&
        (!search ||
          row.reference.toLowerCase().includes(search) ||
          row.productName.toLowerCase().includes(search)),
    );
    rows.sort(
      (a, b) =>
        (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt),
    );

    const people = await ctx.db.query("users").take(500);
    const names = new Map(
      people.map((user) => [user._id, user.name ?? user.email ?? "Customer"]),
    );
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
      viewerId: viewer.user._id,
    };
  },
});

export const get = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);

    const [events, product, customer, policy, transactions] = await Promise.all([
      ctx.db
        .query("applicationEvents")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", application._id),
        )
        .order("asc")
        .take(200),
      ctx.db.get(application.productId),
      ensureProfileRead(ctx, application.customerUserId),
      ctx.db
        .query("policies")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", application._id),
        )
        .first(),
      ctx.db
        .query("transactions")
        .withIndex("by_application", (q) =>
          q.eq("applicationId", application._id),
        )
        .order("desc")
        .take(20),
    ]);

    const visibleEvents = isStaffRole(viewer.role)
      ? events
      : events.filter((event) => !event.internal);

    return {
      application,
      events: visibleEvents,
      product,
      customer,
      policy,
      transactions,
      canReview:
        isStaffRole(viewer.role) &&
        (viewer.role === "super_admin" ||
          viewer.permissions.includes(PERMISSIONS.APPLICATIONS_REVIEW)),
      canIssue:
        isStaffRole(viewer.role) &&
        (viewer.role === "super_admin" ||
          viewer.permissions.includes(PERMISSIONS.POLICIES_MANAGE)),
    };
  },
});

async function ensureProfileRead(
  ctx: import("./_generated/server").QueryCtx | import("./_generated/server").MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("customerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export const updateDraft = mutation({
  args: { applicationId: v.id("applications"), answers: v.any() },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);
    if (application.status !== "draft") {
      throw new Error("Submitted applications can only be changed through an information request.");
    }
    const product = await ctx.db.get(application.productId);
    if (!product) throw new Error("Product not found.");
    const answers = validateAnswers(
      product,
      (args.answers ?? {}) as Record<string, string | number>,
    );
    const breakdown = priceProduct(product, answers);
    await ctx.db.patch(application._id, {
      answers,
      premium: breakdown.premium,
      updatedAt: Date.now(),
    });
    return { premium: breakdown.premium };
  },
});

export const addDocument = mutation({
  args: {
    applicationId: v.id("applications"),
    document: documentInput,
  },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);
    if (
      application.status !== "draft" &&
      application.status !== "additional_info_required"
    ) {
      throw new Error("Documents can no longer be added to this application.");
    }
    if (application.documents.length >= 10) {
      throw new Error("This application already has the maximum of 10 documents.");
    }
    const [cleaned] = await cleanDocuments(ctx, [args.document]);
    const now = Date.now();
    if (!cleaned) throw new Error("Attach a document.");
    await ctx.db.patch(application._id, {
      documents: [
        ...application.documents,
        {
          name: cleaned.name,
          key: cleaned.key,
          storageId: cleaned.storageId,
          body: cleaned.body,
          addedBy: viewer.user._id,
          addedAt: now,
        },
      ],
      updatedAt: now,
    });
    await ctx.db.insert("documents", {
      ownerUserId: application.customerUserId,
      name: cleaned.name,
      category: "application",
      applicationId: application._id,
      storageId: cleaned.storageId,
      body: cleaned.body,
      contentType: cleaned.contentType,
      size: cleaned.size,
      version: 1,
      issuedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "document",
      message: `Uploaded ${cleaned.name}.`,
      internal: false,
      createdAt: now,
    });
    return true;
  },
});

export const submit = mutation({
  args: { applicationId: v.id("applications"), termsAccepted: v.boolean() },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);
    if (application.status !== "draft") {
      throw new Error("This application has already been submitted.");
    }
    if (!args.termsAccepted) {
      throw new Error("Accept the policy terms and disclosures before submitting.");
    }
    if (viewer.role === "broker" && !application.consentRecordedAt) {
      throw new Error("Record the customer's consent before submitting on their behalf.");
    }
    const product = await ctx.db.get(application.productId);
    if (!product) throw new Error("Product not found.");
    const provided = new Set(application.documents.map((doc) => doc.key));
    const missing = product.requiredDocuments.filter(
      (doc) => doc.required && !provided.has(doc.key),
    );
    if (missing.length > 0) {
      throw new Error(
        `Upload the required documents first: ${missing.map((doc) => doc.label).join(", ")}.`,
      );
    }
    await ensureCustomerProfile(ctx, application.customerUserId);

    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: "submitted",
      submittedAt: now,
      termsAcceptedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: "Application submitted for manual underwriting.",
      fromStatus: "draft",
      toStatus: "submitted",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: application.customerUserId,
      type: "application.submitted",
      title: "Application received",
      body: `Application ${application.reference} is queued for manual underwriting.`,
      href: "/dashboard/applications",
      relatedType: "applications",
      relatedId: application._id,
      dedupeKey: `application-submitted:${application._id}`,
    });
    await notifyStaff(ctx, {
      type: "application.submitted",
      title: `New application ${application.reference}`,
      body: `${application.productName} submitted for underwriting.`,
      href: "/dashboard/admin/applications",
      relatedType: "applications",
      relatedId: application._id,
      permission: PERMISSIONS.APPLICATIONS_REVIEW,
    });
    return true;
  },
});

export const assign = mutation({
  args: { applicationId: v.id("applications"), staffUserId: v.id("users") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.APPLICATIONS_REVIEW);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    const staff = await ctx.db.get(args.staffUserId);
    if (!staff || (staff.role !== "admin" && staff.role !== "super_admin")) {
      throw new Error("Assign applications to an active staff reviewer.");
    }
    const now = Date.now();
    await ctx.db.patch(application._id, {
      assignedTo: args.staffUserId,
      status:
        application.status === "submitted" ? "under_review" : application.status,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "assignment",
      message: `Assigned to ${staff.name ?? staff.email ?? "a reviewer"}.`,
      internal: true,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: args.staffUserId,
      type: "support.updated",
      title: `Application ${application.reference} assigned to you`,
      body: `${application.productName} is ready for underwriting review.`,
      href: "/dashboard/admin/applications",
      dedupeKey: `application-assigned:${application._id}:${args.staffUserId}`,
    });
    return true;
  },
});

export const requestInfo = mutation({
  args: { applicationId: v.id("applications"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.APPLICATIONS_REVIEW);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    if (["approved", "declined", "withdrawn"].includes(application.status)) {
      throw new Error("This application already has a final outcome.");
    }
    const message = requiredText(args.message, "Information request", 2000);
    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: "additional_info_required",
      infoRequest: message,
      infoRequestAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "info_request",
      message,
      fromStatus: application.status,
      toStatus: "additional_info_required",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: application.customerUserId,
      type: "application.info_requested",
      title: "More information needed",
      body: message,
      href: "/dashboard/applications",
      relatedType: "applications",
      relatedId: application._id,
      dedupeKey: `application-info:${application._id}:${now}`,
    });
    await writeAudit(ctx, viewer, {
      action: "application.info_requested",
      entityType: "applications",
      entityId: application._id,
      reason: message,
    });
    return true;
  },
});

export const respond = mutation({
  args: { applicationId: v.id("applications"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);
    if (application.status !== "additional_info_required") {
      throw new Error("This application is not waiting for information.");
    }
    const message = requiredText(args.message, "Response", 3000);
    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: "under_review",
      customerResponse: message,
      infoRequest: undefined,
      infoRequestAt: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "note",
      message,
      fromStatus: "additional_info_required",
      toStatus: "under_review",
      internal: false,
      createdAt: now,
    });
    await notifyStaff(ctx, {
      type: "application.submitted",
      title: `Customer responded on ${application.reference}`,
      body: message,
      href: "/dashboard/admin/applications",
      relatedType: "applications",
      relatedId: application._id,
      permission: PERMISSIONS.APPLICATIONS_REVIEW,
    });
    return true;
  },
});

export const note = mutation({
  args: { applicationId: v.id("applications"), message: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.APPLICATIONS_REVIEW);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    const message = requiredText(args.message, "Note", 2000);
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
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
    applicationId: v.id("applications"),
    decision: v.union(v.literal("approved"), v.literal("declined")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.APPLICATIONS_REVIEW);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    if (application.decision) {
      throw new Error("A final underwriting decision has already been recorded.");
    }
    if (!["submitted", "under_review", "additional_info_required"].includes(application.status)) {
      throw new Error("This application is not in a reviewable state.");
    }
    const reason = requiredText(args.reason, "Decision reason", 2000);
    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: args.decision,
      decision: args.decision,
      decisionReason: reason,
      decidedBy: viewer.user._id,
      decidedAt: now,
      assignedTo: application.assignedTo ?? viewer.user._id,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "decision",
      message: `${args.decision === "approved" ? "Approved" : "Declined"}: ${reason}`,
      fromStatus: application.status,
      toStatus: args.decision,
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: application.customerUserId,
      type: args.decision === "approved" ? "application.approved" : "application.declined",
      title: args.decision === "approved" ? "Application approved" : "Application declined",
      body:
        args.decision === "approved"
          ? `${application.reference} was approved by an underwriter. Complete the premium payment so the policy can be issued.`
          : `${application.reference} was declined. Reason: ${reason}`,
      href: "/dashboard/applications",
      relatedType: "applications",
      relatedId: application._id,
      dedupeKey: `application-decided:${application._id}`,
    });
    await writeAudit(ctx, viewer, {
      action: "application.decided",
      entityType: "applications",
      entityId: application._id,
      before: { status: application.status },
      after: { status: args.decision, decision: args.decision },
      reason,
    });
    return true;
  },
});

export const withdraw = mutation({
  args: { applicationId: v.id("applications"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    await assertApplicationAccess(ctx, viewer, application);
    if (["approved", "declined", "withdrawn"].includes(application.status)) {
      throw new Error("This application already has a final outcome.");
    }
    const reason = requiredText(args.reason, "Reason", 500);
    const now = Date.now();
    await ctx.db.patch(application._id, {
      status: "withdrawn",
      withdrawnAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: `Withdrawn: ${reason}`,
      fromStatus: application.status,
      toStatus: "withdrawn",
      internal: false,
      createdAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: "application.withdrawn",
      entityType: "applications",
      entityId: application._id,
      reason,
    });
    return true;
  },
});

export const issuePolicy = mutation({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found.");
    if (application.status !== "approved") {
      throw new Error("Only approved applications can be issued.");
    }
    if (application.policyId) {
      throw new Error("A policy has already been issued for this application.");
    }

    const premiumPayments = await ctx.db
      .query("transactions")
      .withIndex("by_application", (q) => q.eq("applicationId", application._id))
      .take(50);
    const confirmed = premiumPayments.find(
      (tx) => tx.type === "premium" && tx.status === "succeeded",
    );
    if (!confirmed) {
      throw new Error(
        "The premium has not been confirmed. Record or reconcile the payment before issuing the policy.",
      );
    }

    const product = await ctx.db.get(application.productId);
    if (!product) throw new Error("The product version is no longer available.");
    const customer = await ensureProfileRead(ctx, application.customerUserId);
    const now = Date.now();
    const startDate = now;
    const endDate = addMonths(startDate, product.termMonths);
    const renewalDate = endDate - product.renewalNoticeDays * DAY;
    const policyNumber = reference("POL");

    const policyId = await ctx.db.insert("policies", {
      policyNumber,
      customerUserId: application.customerUserId,
      brokerUserId: application.brokerUserId,
      applicationId: application._id,
      productId: product._id,
      productCode: product.code,
      productVersion: product.version,
      productName: product.name,
      categoryKey: product.categoryKey,
      status: "active",
      insuredName: customer?.fullName ?? "Policyholder",
      country: application.country,
      currency: application.currency,
      premium: application.premium,
      excess: product.excess,
      coverageLimit: product.coverageLimit,
      exclusions: product.exclusions,
      benefits: product.benefits,
      wordingVersion: product.wordingVersion,
      startDate,
      endDate,
      renewalDate,
      issuedBy: viewer.user._id,
      issuedAt: now,
      endorsements: [],
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(application._id, {
      policyId,
      updatedAt: now,
    });

    const money = (amount: number) =>
      `${(amount / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })} ${application.currency}`;
    const schedule = [
      `POLICY SCHEDULE — ${policyNumber}`,
      "",
      `Product: ${product.name} (version ${product.version})`,
      `Policyholder: ${customer?.fullName ?? "Policyholder"}`,
      `Insured country: ${application.country}`,
      `Term: ${new Date(startDate).toISOString().slice(0, 10)} to ${new Date(endDate).toISOString().slice(0, 10)}`,
      `Premium: ${money(application.premium)}`,
      `Coverage limit: ${money(product.coverageLimit)}`,
      `Excess: ${money(product.excess)}`,
      "",
      "Benefits:",
      ...product.benefits.map((benefit) => `• ${benefit}`),
      "",
      "Exclusions:",
      ...product.exclusions.map((exclusion) => `• ${exclusion}`),
      "",
      `Wording version: ${product.wordingVersion}`,
      "",
      "This schedule must be read with the policy wording.",
    ].join("\n");
    const certificate = [
      `CERTIFICATE OF INSURANCE — ${policyNumber}`,
      "",
      `This certifies that ${customer?.fullName ?? "the policyholder"} is insured under ${product.name} from ${new Date(startDate).toISOString().slice(0, 10)} to ${new Date(endDate).toISOString().slice(0, 10)}.`,
      `Policy number: ${policyNumber}`,
      `Application: ${application.reference}`,
      `Premium: ${money(application.premium)}`,
      "",
      "Cover is subject to the policy wording, schedule, exclusions, and excess.",
    ].join("\n");

    for (const [name, body] of [
      [`${policyNumber} — policy schedule`, schedule],
      [`${policyNumber} — certificate`, certificate],
      [`${policyNumber} — policy wording v${product.wordingVersion}`, `${product.wording}\n\n${product.disclosures}`],
    ] as const) {
      await ctx.db.insert("documents", {
        ownerUserId: application.customerUserId,
        name,
        category: "policy",
        policyId,
        body,
        contentType: "text/plain",
        version: product.version,
        issuedBy: viewer.user._id,
        issuedAt: now,
        createdAt: now,
      });
    }

    await ctx.db.insert("applicationEvents", {
      applicationId: application._id,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: `Policy ${policyNumber} issued.`,
      toStatus: "approved",
      internal: false,
      createdAt: now,
    });
    await notifyUser(ctx, {
      userId: application.customerUserId,
      type: "policy.issued",
      title: "Your policy is issued",
      body: `Policy ${policyNumber} is active. Your schedule, certificate, and wording are in your document library.`,
      href: "/dashboard/policies",
      relatedType: "policies",
      relatedId: policyId,
      dedupeKey: `policy-issued:${policyId}`,
    });
    if (application.brokerUserId) {
      await notifyUser(ctx, {
        userId: application.brokerUserId,
        type: "policy.issued",
        title: `Policy ${policyNumber} issued`,
        body: `${product.name} has been issued for your assigned customer.`,
        href: "/dashboard/policies",
        relatedType: "policies",
        relatedId: policyId,
        dedupeKey: `policy-issued-broker:${policyId}`,
      });
    }
    await writeAudit(ctx, viewer, {
      action: "policy.issued",
      entityType: "policies",
      entityId: policyId,
      after: { policyNumber, applicationId: application._id, premium: application.premium },
    });
    return { policyId, policyNumber };
  },
});

export async function loadApplicationPolicy(
  ctx: Parameters<typeof ensureCustomerProfile>[0],
  applicationId: DocId<"applications">,
) {
  return await ctx.db
    .query("policies")
    .withIndex("by_application", (q) => q.eq("applicationId", applicationId))
    .first();
}
