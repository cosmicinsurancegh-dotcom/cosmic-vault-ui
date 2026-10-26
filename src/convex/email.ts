"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { deliveryFailure } from "./lib/delivery";

/**
 * Transactional email adapter. Delivery is attempted through the platform
 * integration gateway when VLY_INTEGRATION_KEY is configured on the Convex
 * deployment. Missing configuration is recorded as "skipped" (never silent)
 * and provider errors as "failed" so staff can retry from the admin console.
 * A 2xx whose body reports the message as failed counts as a failure too, so a
 * message the gateway refuses is never recorded as delivered.
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
      const { emailSender } = await import("./lib/sender");
      /* Read at send time, so a change in Settings applies to the next email
         - including the assignment notices queued by a mutation. */
      const sender = await ctx.runQuery(internal.settings.emailSender, {});
      const result = await vly.email.send({
        from: emailSender(sender),
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

      /* The gateway answers 2xx with its verdict in the body, so the provider's
         own status decides this, not the transport code. */
      const failure = deliveryFailure(result);
      if (failure) {
        await ctx.runMutation(internal.notifications.recordEmailResult, {
          notificationId: args.notificationId,
          status: "failed",
          error: failure,
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

export type TestEmailResult = {
  status: "sent" | "failed" | "skipped";
  error: string | null;
  /** Where it went: the signed-in staff member's own address. */
  to: string;
  /** The From header it was stamped with, so the console can show it. */
  from: string;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? "&amp;",
  );
}

/**
 * The test message staff send themselves from Settings.
 *
 * A stored "sent" row only proves the gateway answered, so it cannot show
 * whether mail reaches an inbox at all - which is exactly how a broken sender
 * went unnoticed. This puts the saved From in front of a real inbox, hands the
 * gateway's verdict back to the console rather than recording it against a
 * notification, and writes the attempt to the audit trail. It takes no
 * arguments: the recipient comes from the session, so it can only ever mail the
 * person who pressed the button.
 */
export const sendTest = action({
  args: {},
  handler: async (ctx): Promise<TestEmailResult> => {
    const target = await ctx.runQuery(internal.settings.testEmailTarget, {});
    const { emailSender } = await import("./lib/sender");
    const from = emailSender(target);
    const company = target.companyName.trim() || "Cosmic Vault Insurance";

    /*
     * Every attempt is audited, so the trail records who verified delivery, from
     * which address, and what the gateway answered. The write is local; if it
     * failed the message has still been sent, so the outcome is reported rather
     * than replaced by an error that would invite a second send.
     */
    const record = async (
      result: TestEmailResult,
    ): Promise<TestEmailResult> => {
      try {
        await ctx.runMutation(internal.settings.recordTestEmail, {
          actorId: target.actorId,
          to: result.to,
          from: result.from,
          status: result.status,
          error: result.error ?? undefined,
        });
      } catch (error) {
        console.error("Could not audit the test email", error);
      }
      return result;
    };

    if (!target.to) {
      return await record({
        status: "skipped",
        error: "Your account has no email address to send the test to.",
        to: target.to,
        from,
      });
    }

    if (!process.env.VLY_INTEGRATION_KEY) {
      return await record({
        status: "skipped",
        error: "Email provider not configured (VLY_INTEGRATION_KEY missing).",
        to: target.to,
        from,
      });
    }

    const subject = `Test email from ${company}`;
    const text = [
      `This is a test message from ${company}.`,
      "",
      "It leaves with the sender saved in Settings, so it shows exactly what every notification and consignment email is sent from.",
      "",
      `From: ${from}`,
      `To: ${target.to}`,
      "",
      "If this arrived in spam, that is what your customers are seeing: the sender address is not authenticated for the domain the gateway sends from.",
      "",
      company,
      target.supportEmail,
    ].join("\n");

    const rows = [
      ["From", from],
      ["To", target.to],
    ]
      .map(
        ([label, value]) =>
          `<tr><td style="padding:9px 0;border-top:1px solid #e4e9f3;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5b6478;">${escapeHtml(
            label,
          )}</td><td align="right" style="padding:9px 0;border-top:1px solid #e4e9f3;font-size:12px;font-weight:600;color:#0f172a;">${escapeHtml(
            value,
          )}</td></tr>`,
      )
      .join("");

    const html = `<div style="margin:0;padding:24px 12px;background-color:#eef1f7;">
  <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e9f3;border-radius:4px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
    <div style="background-color:#071227;padding:16px 24px;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#ffffff;">${escapeHtml(
      company,
    )}</div>
    <div style="padding:24px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#2f6bf0;">Test message</p>
      <h1 style="margin:10px 0 0;font-size:22px;line-height:28px;font-weight:600;color:#0f172a;">Email delivery is working</h1>
      <p style="margin:12px 0 0;font-size:13px;line-height:21px;color:#5b6478;">This is the message every notification and consignment email is sent from. It landed in an inbox, so the delivery path from this deployment is sound.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>
      <p style="margin:16px 0 0;font-size:11px;line-height:18px;color:#8b94a8;">If it arrived in spam, that is what your customers are seeing: the sender address is not authenticated for the domain the gateway sends from.</p>
    </div>
  </div>
</div>`;

    try {
      const { vly } = await import("./lib/vly");
      const result = await vly.email.send({
        from,
        to: target.to,
        subject,
        text,
        html,
      });

      const failure = deliveryFailure(result);
      if (failure) {
        return await record({
          status: "failed",
          error: failure,
          to: target.to,
          from,
        });
      }
      return await record({
        status: "sent",
        error: null,
        to: target.to,
        from,
      });
    } catch (error) {
      return await record({
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown delivery error.",
        to: target.to,
        from,
      });
    }
  },
});
