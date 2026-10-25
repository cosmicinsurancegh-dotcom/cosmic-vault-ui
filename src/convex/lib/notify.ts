import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getSettings } from "./settings";

/**
 * A queued email with no provider result after this long is treated as stalled:
 * the scheduled delivery never reported back, so the message was never sent.
 * Normal sends answer within seconds.
 */
export const STALLED_EMAIL_MS = 5 * 60_000;

type NotifyArgs = {
  userId: Id<"users">;
  type: string;
  title: string;
  body: string;
  href?: string;
  relatedType?: string;
  relatedId?: string;
  /** Stable key so retried workflows never double-notify. */
  dedupeKey?: string;
  email?: boolean;
  /** Designed-email overrides; the settings template is used when omitted. */
  subject?: string;
  text?: string;
  html?: string;
};

function render(template: string, values: Record<string, string>) {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => values[key] ?? "",
  );
}

/**
 * Creates an in-app notification and queues an email delivery attempt.
 * The email adapter is best-effort and records skipped/failed attempts rather
 * than failing the business operation that triggered the notification.
 */
export async function notifyUser(
  ctx: MutationCtx,
  args: NotifyArgs,
): Promise<Id<"notifications"> | null> {
  const dedupeKey =
    args.dedupeKey ??
    `${args.type}:${args.relatedId ?? "general"}:${args.userId}`;

  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_dedupe", (q) => q.eq("dedupeKey", dedupeKey))
    .first();
  if (existing) return existing._id;

  const user = await ctx.db.get(args.userId);
  if (!user) return null;

  const canEmail =
    args.email !== false && Boolean(user.email) && !user.isAnonymous;
  const settings = await getSettings(ctx);
  const template = settings.emailTemplates.find(
    (item) => item.key === args.type,
  );
  const name = user.name?.split(" ")[0] ?? "there";
  const values = {
    name,
    title: args.title,
    body: args.body,
    reference: args.relatedId ?? "",
    company: settings.companyName,
  };

  /* Rendered once: the same wording is stored and handed to the provider. */
  const subject =
    args.subject ?? render(template?.subject ?? args.title, values);
  const text =
    args.text ?? render(template?.body ?? "{{title}}\n\n{{body}}", values);
  const html = args.html;

  const id = await ctx.db.insert("notifications", {
    userId: args.userId,
    type: args.type,
    title: args.title,
    body: args.body,
    href: args.href,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
    dedupeKey,
    emailStatus: canEmail ? "queued" : "skipped",
    emailAttempts: 0,
    /* The queued message is kept so a retry resends the same email. */
    ...(canEmail
      ? {
          emailSubject: subject,
          emailText: text,
          ...(html ? { emailHtml: html } : {}),
          emailQueuedAt: Date.now(),
        }
      : {}),
    createdAt: Date.now(),
  });

  if (canEmail) {
    await ctx.scheduler.runAfter(0, internal.email.deliver, {
      notificationId: id,
      to: user.email!,
      subject,
      text,
      html,
    });
  }

  return id;
}

/**
 * Queues another delivery of a notification's email and returns the address it
 * is going to.
 *
 * The message recorded when the notification was created is resent verbatim,
 * branded HTML included, because the designed consignment emails are not built
 * from a settings template - re-rendering one would send a different email than
 * the one that failed. Rows queued before the message was kept fall back to the
 * template, which is the best that can be done for them.
 *
 * Shared by the settings panel and the dispatch board so both resend the same
 * way; only the permission that gets you there differs.
 */
export async function requeueNotificationEmail(
  ctx: MutationCtx,
  notification: Doc<"notifications">,
): Promise<string> {
  const user = await ctx.db.get(notification.userId);
  if (!user?.email) throw new Error("This recipient has no email address.");

  const settings = await getSettings(ctx);
  const template = settings.emailTemplates.find(
    (item) => item.key === notification.type,
  );
  const values = {
    name: user.name?.split(" ")[0] ?? "there",
    title: notification.title,
    body: notification.body,
    reference: notification.relatedId ?? "",
    company: settings.companyName,
  };

  const subject =
    notification.emailSubject ??
    render(template?.subject ?? notification.title, values);
  const text =
    notification.emailText ??
    render(template?.body ?? "{{title}}\n\n{{body}}", values);
  const html = notification.emailHtml;

  await ctx.db.patch(notification._id, {
    emailStatus: "queued",
    emailError: undefined,
    emailSubject: subject,
    emailText: text,
    ...(html ? { emailHtml: html } : {}),
    /* The attempt that is now in flight, so it is not read as stalled. */
    emailQueuedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.email.deliver, {
    notificationId: notification._id,
    to: user.email,
    subject,
    text,
    html,
  });

  return user.email;
}

/** Notify every administrator, optionally only those holding a permission. */
export async function notifyStaff(
  ctx: MutationCtx,
  args: Omit<NotifyArgs, "userId" | "dedupeKey"> & { permission?: string },
) {
  const staff = await ctx.db.query("users").take(200);
  const recipients = staff.filter((user) => {
    if (user.role !== "admin" && user.role !== "super_admin") return false;
    if (user.isAnonymous) return false;
    if (args.permission && user.role !== "super_admin") {
      return (user.permissions ?? []).includes(args.permission);
    }
    return true;
  });

  await Promise.all(
    recipients.map((user) =>
      notifyUser(ctx, {
        ...args,
        userId: user._id,
        dedupeKey: `${args.type}:${args.relatedId ?? "general"}:${user._id}`,
      }),
    ),
  );
}
