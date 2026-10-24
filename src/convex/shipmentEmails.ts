import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getViewer, isStaffRole, PERMISSIONS, requirePermission } from "./lib/authz";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
import { cleanText, isValidEmail, requiredText } from "./lib/refs";
import { getSettings } from "./lib/settings";
import { renderShipmentUpdateEmail } from "./vault/shipmentEmail";

/**
 * Shipment progress email: data side.
 *
 * The mineral and shipment records live in the member's vault store, not in
 * Convex, so this module records the *delivery* of each status email and keeps
 * the rendered message for audit. The companion `shipmentEmailDelivery` action
 * runs in the Node runtime and actually hands the message to the provider.
 *
 * Delivery is staff-only: the recipient address arrives from the console, and
 * an endpoint that mails an arbitrary address on request would be a relay.
 */

const shipmentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("on_hold"),
  v.literal("in_transit"),
  v.literal("shipped"),
);

const shipmentEventValidator = v.object({
  status: shipmentStatusValidator,
  at: v.number(),
  note: v.optional(v.string()),
});

const sendArgs = {
  memberName: v.string(),
  memberEmail: v.string(),
  mineralName: v.string(),
  mineralType: v.string(),
  category: v.string(),
  vaultId: v.string(),
  weightLabel: v.string(),
  photoPath: v.optional(v.string()),
  trackingNumber: v.string(),
  carrier: v.string(),
  service: v.string(),
  origin: v.string(),
  destination: v.string(),
  originCity: v.string(),
  destinationCity: v.string(),
  estimatedDelivery: v.number(),
  status: shipmentStatusValidator,
  note: v.optional(v.string()),
  updatedAt: v.number(),
  events: v.array(shipmentEventValidator),
};

function requireTimestamp(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 4_102_444_800_000) {
    throw new Error(`${field} is not a valid date.`);
  }
  return value;
}

/** Permission gate for the Node action, which cannot read the database. */
export const sendGate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.VAULT_SHIP);
    return { userId: viewer.user._id, role: viewer.role };
  },
});

/**
 * Validate the operator's input, apply the rate limit and render the message.
 * Called by the action first, so a rejected update never reaches the provider.
 */
export const queue = internalMutation({
  args: { ...sendArgs, sentBy: v.id("users") },
  handler: async (ctx, args) => {
    const memberName = requiredText(args.memberName, "Recipient name", 120);
    const memberEmail = requiredText(args.memberEmail, "Recipient email", 254)
      .toLowerCase();
    if (!isValidEmail(memberEmail)) {
      throw new Error("Add a valid recipient email address.");
    }

    await enforceRateLimit(ctx, {
      scope: "shipment.email",
      identifier: args.sentBy,
      ...RATE_LIMITS.shipmentEmailPerUser,
    });

    const settings = await getSettings(ctx);
    const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
    const events = args.events
      .slice(0, 12)
      .map((event) => ({
        status: event.status,
        at: requireTimestamp(event.at, "Event time"),
        note: event.note ? cleanText(event.note, "Event note", 600) : undefined,
      }));

    const rendered = renderShipmentUpdateEmail({
      memberName,
      memberEmail,
      mineralName: requiredText(args.mineralName, "Mineral", 160),
      mineralType: requiredText(args.mineralType, "Mineral type", 80),
      category: requiredText(args.category, "Category", 80),
      vaultId: requiredText(args.vaultId, "Vault reference", 60),
      weightLabel: requiredText(args.weightLabel, "Weight", 40),
      photoPath: args.photoPath
        ? cleanText(args.photoPath, "Photo path", 200)
        : undefined,
      trackingNumber: requiredText(args.trackingNumber, "Tracking number", 80),
      carrier: requiredText(args.carrier, "Carrier", 80),
      service: requiredText(args.service, "Service", 120),
      origin: requiredText(args.origin, "Origin", 400),
      destination: requiredText(args.destination, "Destination", 400),
      originCity: requiredText(args.originCity, "Origin city", 80),
      destinationCity: requiredText(args.destinationCity, "Destination city", 80),
      estimatedDelivery: requireTimestamp(
        args.estimatedDelivery,
        "Estimated delivery",
      ),
      status: args.status,
      note: args.note ? cleanText(args.note, "Update note", 600) : undefined,
      updatedAt: requireTimestamp(args.updatedAt, "Update time"),
      events,
      trackingUrl: siteUrl ? `${siteUrl}/dashboard/shipments` : "",
      appOrigin: siteUrl || undefined,
      companyName: settings.companyName,
      supportEmail: settings.supportEmail,
    });

    const emailId = await ctx.db.insert("shipmentEmails", {
      trackingNumber: args.trackingNumber.trim(),
      mineralName: args.mineralName.trim(),
      ownerName: memberName,
      ownerEmail: memberEmail,
      shipmentStatus: args.status,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      deliveryStatus: "queued",
      attempts: 0,
      sentBy: args.sentBy,
      createdAt: Date.now(),
    });

    return {
      emailId,
      to: memberEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
  },
});

/** Record what the provider said, so staff can see failed deliveries. */
export const recordResult = internalMutation({
  args: {
    emailId: v.id("shipmentEmails"),
    deliveryStatus: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return;
    await ctx.db.patch(args.emailId, {
      deliveryStatus: args.deliveryStatus,
      attempts: email.attempts + 1,
      error: args.error,
      deliveredAt:
        args.deliveryStatus === "sent" ? Date.now() : email.deliveredAt,
    });
  },
});

/**
 * The latest delivery attempt for a consignment. Staff only - the row carries
 * the member's address, so it is not exposed to other signed-in accounts.
 */
export const lastForTracking = query({
  args: { trackingNumber: v.string() },
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx);
    if (!viewer || !isStaffRole(viewer.role)) return null;
    const email = await ctx.db
      .query("shipmentEmails")
      .withIndex("by_tracking", (q) =>
        q.eq("trackingNumber", args.trackingNumber.trim()),
      )
      .order("desc")
      .first();
    if (!email) return null;
    return {
      deliveryStatus: email.deliveryStatus,
      shipmentStatus: email.shipmentStatus,
      subject: email.subject,
      error: email.error,
      createdAt: email.createdAt,
      deliveredAt: email.deliveredAt,
    };
  },
});

