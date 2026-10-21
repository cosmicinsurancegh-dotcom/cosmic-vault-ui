import type { MutationCtx } from "../_generated/server";

/**
 * Server-side rate limiting for public and abuse-prone mutations.
 *
 * The counters live in the `rateLimits` table rather than in memory, so the
 * limit holds across every Convex backend instance that serves a deployment.
 * Each call runs inside the caller's mutation, which Convex executes as a
 * serialisable transaction: concurrent consume calls on the same key conflict,
 * retry, and therefore cannot both slip under the limit.
 *
 * Fixed windows are intentional. They are cheap (one indexed row per key),
 * easy to reason about, and a burst at a window boundary is acceptable for the
 * operations guarded here (quote requests, upload URLs).
 */

export type RateLimitRule = {
  /** Stable name for the operation, e.g. `quote.request`. */
  scope: string;
  /** Who/what is being limited: user id, email, or a global bucket name. */
  identifier: string;
  /** Allowed calls inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

function retryMessage(remainingMs: number) {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Too many requests. Please try again in about ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

/**
 * Consume one unit of the rule's budget, or throw a user-facing error when the
 * window is exhausted. Throwing means the caller's mutation is rolled back, so
 * a rejected request never leaves a partial write behind.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  rule: RateLimitRule,
): Promise<void> {
  const key = `${rule.scope}:${rule.identifier}`;
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key,
      windowStart: now,
      count: 1,
    });
    return;
  }

  const elapsed = now - existing.windowStart;
  if (elapsed >= rule.windowMs || elapsed < 0) {
    // Expired window (or a clock that moved backwards): start a fresh window.
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return;
  }

  if (existing.count >= rule.limit) {
    throw new Error(
      retryMessage(existing.windowStart + rule.windowMs - now),
    );
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

/** Rules are kept here so tests and docs share the same numbers. */
export const RATE_LIMITS = {
  /** A single email address may ask for a quote three times per 10 minutes. */
  quotePerEmail: { limit: 3, windowMs: 10 * 60_000 },
  /** Deployment-wide ceiling so a botnet cannot fill the leads table. */
  quoteGlobal: { limit: 240, windowMs: 10 * 60_000 },
  /** Signed-in members get their own bucket, independent of the email one. */
  quotePerUser: { limit: 10, windowMs: 10 * 60_000 },
  /** Upload URLs are cheap to mint; cap how many a member can create per hour. */
  uploadUrlPerUser: { limit: 60, windowMs: 60 * 60_000 },
  /** One operator can move many consignments in a session, so the ceiling is
   *  generous - it exists to bound a stuck client, not to pace real work. */
  shipmentEmailPerUser: { limit: 40, windowMs: 10 * 60_000 },
} as const;
