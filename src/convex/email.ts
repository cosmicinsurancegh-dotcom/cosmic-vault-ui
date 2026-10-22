"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Transactional email adapter. Delivery is attempted through the platform
 * integration gateway when VLY_INTEGRATION_KEY is configured on the Convex
 * deployment. Missing configuration is recorded as "skipped" (never silent)
 * and provider errors as "failed" so staff can retry from the admin console.
 */
export const deliver = internalAction({
  args: {
    notificationId: v.id("notifications"),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    /** A designed template. Falls back to the text-to-HTML wrapper. */
    html: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = process.env.VLY_INTEGRATION_KEY;
    if (!key) {
      await ctx.runMutation(internal.notifications.recordEmailResult, {
        notificationId: args.notificationId,
        status: "skipped",
        error: "Email provider not configured (VLY_INTEGRATION_KEY missing).",
      });
      return { delivered: false, reason: "not_configured" };
    }

    try {
      const { vly } = await import("./lib/vly");
      const result = await vly.email.send({
        to: args.to,
        subject: args.subject,
        text: args.text,
        html:
          args.html ??
          `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;color:#0d1730">${args.text
            .split("\n\n")
            .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
            .join("")}</div>`,
      });

      if (!result.success) {
        await ctx.runMutation(internal.notifications.recordEmailResult, {
          notificationId: args.notificationId,
          status: "failed",
          error: result.error ?? "Provider rejected the message.",
        });
        return { delivered: false, reason: "provider_error" };
      }

      await ctx.runMutation(internal.notifications.recordEmailResult, {
        notificationId: args.notificationId,
        status: "sent",
      });
      return { delivered: true };
    } catch (error) {
      await ctx.runMutation(internal.notifications.recordEmailResult, {
        notificationId: args.notificationId,
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown delivery error.",
      });
      return { delivered: false, reason: "exception" };
    }
  },
});
