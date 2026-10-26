"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { deliveryFailure } from "./lib/delivery";

/**
 * Shipment progress email: delivery side.
 *
 * Runs in the Convex Node runtime so the provider credential stays on the
 * server. The action is idempotent enough for a manual retry: every attempt is
 * a new row, and `shipmentEmails.lastForTracking` shows the most recent result.
 * As in `email.deliver`, a 2xx whose body reports the message as failed is
 * recorded as a failure so the row is never marked delivered by mistake.
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

export type ShipmentEmailDeliveryResult = {
  deliveryStatus: "sent" | "failed" | "skipped";
  error: string | null;
};

export const sendUpdate = action({
  args: {
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
    /** A Mapbox route image, resolved in the staff browser. */
    mapUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ShipmentEmailDeliveryResult> => {
    const gate = await ctx.runQuery(internal.shipmentEmails.sendGate, {});
    const queued = await ctx.runMutation(internal.shipmentEmails.queue, {
      ...args,
      sentBy: gate.userId,
    });

    const providerKey = process.env.VLY_INTEGRATION_KEY;
    if (!providerKey) {
      const error =
        "Email provider not configured (VLY_INTEGRATION_KEY missing).";
      await ctx.runMutation(internal.shipmentEmails.recordResult, {
        emailId: queued.emailId,
        deliveryStatus: "skipped",
        error,
      });
      return { deliveryStatus: "skipped", error };
    }

    try {
      const { vly } = await import("./lib/vly");
      const { emailSender } = await import("./lib/sender");
      /* Read at send time, so the sender the admin set in Settings is the one
         this consignment update arrives from. */
      const sender = await ctx.runQuery(internal.settings.emailSender, {});
      const result = await vly.email.send({
        from: emailSender(sender),
        to: queued.to,
        subject: queued.subject,
        text: queued.text,
        html: queued.html,
      });

      const failure = deliveryFailure(result);
      if (failure) {
        await ctx.runMutation(internal.shipmentEmails.recordResult, {
          emailId: queued.emailId,
          deliveryStatus: "failed",
          error: failure,
        });
        return { deliveryStatus: "failed", error: failure };
      }

      await ctx.runMutation(internal.shipmentEmails.recordResult, {
        emailId: queued.emailId,
        deliveryStatus: "sent",
      });
      return { deliveryStatus: "sent", error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown delivery error.";
      await ctx.runMutation(internal.shipmentEmails.recordResult, {
        emailId: queued.emailId,
        deliveryStatus: "failed",
        error: message,
      });
      return { deliveryStatus: "failed", error: message };
    }
  },
});
