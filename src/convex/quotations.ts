import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  PERMISSIONS,
  isStaffRole,
  requireSelfServiceRole,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { assertCustomerAccess, requireBrokerAssignment } from "./lib/access";
import { writeAudit } from "./lib/audit";
import { notifyUser } from "./lib/notify";
import { ensureCustomerProfile } from "./lib/people";
import { priceProduct, validateAnswers } from "./lib/pricing";
import { DAY, reference, requiredText } from "./lib/refs";

async function assertQuotationAccess(
  ctx: Parameters<typeof assertCustomerAccess>[0],
  viewer: Viewer,
  customerUserId: Parameters<typeof assertCustomerAccess>[2],
) {
  if (isStaffRole(viewer.role)) {
    await assertCustomerAccess(
      ctx,
      viewer,
      customerUserId,
      PERMISSIONS.APPLICATIONS_REVIEW,
    );
    return;
  }
  await assertCustomerAccess(
    ctx,
    viewer,
    customerUserId,
    PERMISSIONS.CUSTOMERS_VIEW,
  );
}

export const create = mutation({
  args: {
    productId: v.id("products"),
    country: v.string(),
    answers: v.any(),
    customerUserId: v.optional(v.id("users")),
    consentConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const now = Date.now();

    let customerUserId = viewer.user._id;
    let brokerUserId: typeof viewer.user._id | undefined;
    if (viewer.role === "broker") {
      if (!args.customerUserId) {
        throw new Error("Choose the customer this quotation is for.");
      }
      if (!args.consentConfirmed) {
        throw new Error("Record the customer's consent before creating a quotation.");
      }
      await requireBrokerAssignment(ctx, viewer, args.customerUserId);
      customerUserId = args.customerUserId;
      brokerUserId = viewer.user._id;
    }

    const customer = await ctx.db.get(customerUserId);
    if (!customer) throw new Error("Customer not found.");
    await ensureCustomerProfile(ctx, customerUserId);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    if (product.status !== "published") {
      throw new Error("This product is not available for sale.");
    }
    if (product.effectiveFrom > now) {
      throw new Error("This product is not effective yet.");
    }
    if (!product.countries.includes(args.country)) {
      throw new Error("This product is not available in the selected country.");
    }

    const answers = validateAnswers(
      product,
      (args.answers ?? {}) as Record<string, string | number>,
    );
    const breakdown = priceProduct(product, answers);

    const id = await ctx.db.insert("quotations", {
      reference: reference("QTE"),
      customerUserId,
      brokerUserId,
      productId: product._id,
      productCode: product.code,
      productVersion: product.version,
      productName: product.name,
      country: args.country,
      currency: product.currency,
      answers,
      premium: breakdown.premium,
      breakdown,
      status: "quoted",
      expiresAt: now + 30 * DAY,
      createdBy: viewer.user._id,
      consentAt: viewer.role === "broker" ? now : undefined,
      createdAt: now,
    });

    if (viewer.role === "broker") {
      await writeAudit(ctx, viewer, {
        action: "quotation.created_for_customer",
        entityType: "quotations",
        entityId: id,
        after: { customerUserId, productId: product._id, premium: breakdown.premium },
        reason: "Broker-assisted quotation with recorded customer consent.",
      });
      await notifyUser(ctx, {
        userId: customerUserId,
        type: "support.updated",
        title: "Your broker prepared a quotation",
        body: `${product.name} - ${breakdown.premium / 100} ${product.currency} per year. Review it in your dashboard before applying.`,
        href: "/dashboard/quotes",
        dedupeKey: `broker-quote:${id}`,
      });
    }

    return { quotationId: id, reference: (await ctx.db.get(id))!.reference };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireSelfServiceRole(ctx);
    const rows =
      viewer.role === "broker"
        ? await ctx.db
            .query("quotations")
            .withIndex("by_broker", (q) => q.eq("brokerUserId", viewer.user._id))
            .order("desc")
            .take(100)
        : await ctx.db
            .query("quotations")
            .withIndex("by_customer", (q) =>
              q.eq("customerUserId", viewer.user._id),
            )
            .order("desc")
            .take(100);
    return rows;
  },
});

export const get = query({
  args: { quotationId: v.id("quotations") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const quotation = await ctx.db.get(args.quotationId);
    if (!quotation) throw new Error("Quotation not found.");
    await assertQuotationAccess(ctx, viewer, quotation.customerUserId);
    const product = await ctx.db.get(quotation.productId);
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_customer", (q) =>
        q.eq("customerUserId", quotation.customerUserId),
      )
      .take(200);
    return {
      quotation,
      product,
      application: applications.find(
        (application) => application.quotationId === quotation._id,
      ),
    };
  },
});

export const convertToApplication = mutation({
  args: { quotationId: v.id("quotations") },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const quotation = await ctx.db.get(args.quotationId);
    if (!quotation) throw new Error("Quotation not found.");
    if (quotation.customerUserId !== viewer.user._id && quotation.brokerUserId !== viewer.user._id) {
      throw new Error("You do not have access to this quotation.");
    }
    if (quotation.status !== "quoted") {
      throw new Error("This quotation can no longer be converted.");
    }
    if (quotation.expiresAt < Date.now()) {
      await ctx.db.patch(quotation._id, { status: "expired" });
      throw new Error("This quotation has expired. Request a new one.");
    }

    const existing = await ctx.db
      .query("applications")
      .withIndex("by_customer", (q) =>
        q.eq("customerUserId", quotation.customerUserId),
      )
      .take(200);
    const match = existing.find(
      (application) => application.quotationId === quotation._id,
    );
    if (match) return { applicationId: match._id, reference: match.reference };

    const product = await ctx.db.get(quotation.productId);
    if (!product) throw new Error("The quoted product no longer exists.");
    const profile = await ensureCustomerProfile(ctx, quotation.customerUserId);
    const now = Date.now();

    const applicationId = await ctx.db.insert("applications", {
      reference: reference("APP"),
      quotationId: quotation._id,
      customerUserId: quotation.customerUserId,
      brokerUserId: quotation.brokerUserId,
      productId: product._id,
      productCode: product.code,
      productVersion: product.version,
      productName: product.name,
      categoryKey: product.categoryKey,
      country: quotation.country,
      currency: quotation.currency,
      premium: quotation.premium,
      answers: quotation.answers,
      status: "draft",
      documents: [],
      consentRecordedAt: quotation.consentAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(quotation._id, { status: "accepted" });
    const created = await ctx.db.get(applicationId);

    await ctx.db.insert("applicationEvents", {
      applicationId,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      kind: "status",
      message: `Draft application created from quotation ${quotation.reference} for ${profile.fullName}.`,
      toStatus: "draft",
      internal: false,
      createdAt: now,
    });

    return { applicationId, reference: created!.reference };
  },
});

export const withdraw = mutation({
  args: { quotationId: v.id("quotations"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireSelfServiceRole(ctx);
    const quotation = await ctx.db.get(args.quotationId);
    if (!quotation) throw new Error("Quotation not found.");
    if (
      quotation.customerUserId !== viewer.user._id &&
      quotation.brokerUserId !== viewer.user._id
    ) {
      throw new Error("You do not have access to this quotation.");
    }
    if (quotation.status !== "quoted") {
      throw new Error("Only open quotations can be withdrawn.");
    }
    await ctx.db.patch(quotation._id, { status: "withdrawn" });
    await writeAudit(ctx, viewer, {
      action: "quotation.withdrawn",
      entityType: "quotations",
      entityId: quotation._id,
      reason: requiredText(args.reason, "Reason", 300),
    });
    return true;
  },
});
