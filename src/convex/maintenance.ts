import { internalMutation } from "./_generated/server";
import { DAY } from "./lib/refs";
import { notifyUser } from "./lib/notify";
import { getSettings } from "./lib/settings";

/**
 * Daily operational maintenance. Every action is idempotent through dedupe keys,
 * so a retried cron run cannot duplicate notifications or expire a policy twice.
 */
export const daily = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const settings = await getSettings(ctx);
    let expired = 0;
    let reminders = 0;
    let overdue = 0;
    let rateLimitsPruned = 0;

    // Only active policies can expire or need a renewal reminder, so read the
    // status index instead of scanning every policy ever issued.
    const policies = await ctx.db
      .query("policies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1000);
    for (const policy of policies) {
      if (policy.status === "active" && policy.endDate < now) {
        await ctx.db.patch(policy._id, {
          status: "expired",
          updatedAt: now,
        });
        expired += 1;
        await notifyUser(ctx, {
          userId: policy.customerUserId,
          type: "policy.changed",
          title: `Policy ${policy.policyNumber} has expired`,
          body: "The policy term ended. Contact us to renew and avoid a gap in cover.",
          href: "/dashboard/policies",
          relatedType: "policies",
          relatedId: policy._id,
          dedupeKey: `policy-expired:${policy._id}:${policy.endDate}`,
        });
      }

      if (
        policy.status === "active" &&
        policy.endDate >= now &&
        policy.endDate <= now + settings.renewalNoticeDays * DAY
      ) {
        const days = Math.max(
          1,
          Math.ceil((policy.endDate - now) / DAY),
        );
        await notifyUser(ctx, {
          userId: policy.customerUserId,
          type: "renewal.approaching",
          title: `Policy ${policy.policyNumber} renews in ${days} days`,
          body: "Review the renewal terms and tell us whether you want to continue. Renewal does not happen automatically.",
          href: "/dashboard/policies",
          relatedType: "policies",
          relatedId: policy._id,
          dedupeKey: `renewal-reminder:${policy._id}:${policy.endDate}`,
        });
        reminders += 1;
      }
    }

    const pending = await ctx.db
      .query("transactions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);
    for (const transaction of pending) {
      if (transaction.dueDate && transaction.dueDate < now) {
        await notifyUser(ctx, {
          userId: transaction.customerUserId,
          type: "payment.failed",
          title: "Premium payment overdue",
          body: `Transaction ${transaction.reference} is past its due date. Contact support if you have already paid.`,
          href: "/dashboard/payments",
          relatedType: "transactions",
          relatedId: transaction._id,
          dedupeKey: `overdue-daily:${transaction._id}:${transaction.dueDate}`,
        });
        overdue += 1;
      }
    }

    // Rate-limit rows are tiny but permanent unless pruned. Anything whose
    // window closed a week ago can never be consulted again.
    const staleLimits = await ctx.db
      .query("rateLimits")
      .withIndex("by_windowStart", (q) =>
        q.lt("windowStart", now - 7 * DAY),
      )
      .take(500);
    for (const row of staleLimits) {
      await ctx.db.delete(row._id);
      rateLimitsPruned += 1;
    }

    return { expired, reminders, overdue, rateLimitsPruned };
  },
});
