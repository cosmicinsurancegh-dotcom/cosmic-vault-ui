import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getSettings } from "./settings";

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
    createdAt: Date.now(),
  });

  if (canEmail) {
    await ctx.scheduler.runAfter(0, internal.email.deliver, {
      notificationId: id,
      to: user.email!,
      subject: args.subject ?? render(template?.subject ?? args.title, values),
      text:
        args.text ?? render(template?.body ?? "{{title}}\n\n{{body}}", values),
      html: args.html,
    });
  }

  return id;
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
