import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
import { cleanText, isValidEmail, requiredText } from "./lib/refs";
import { coverageValidator } from "./schema";

/**
 * Record a quote request from the landing page or the member vault.
 * Works for signed-out visitors too - the lead is simply not linked to a
 * member until they sign in and request a quote from their vault.
 */
export const requestQuote = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    coverage: coverageValidator,
    plan: v.optional(v.string()),
    message: v.optional(v.string()),
    monthlyEstimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // This mutation is reachable by signed-out visitors, so every field is
    // bounded on the server before anything is written. A landing-page form is
    // the easiest write path to abuse, which is why the caps and the rate
    // limits live here rather than in the React dialog.
    const name = requiredText(args.name, "Full name", 120);
    const email = requiredText(args.email, "Email address", 254).toLowerCase();
    if (name.length < 2) {
      throw new Error("Please add your full name.");
    }
    if (!isValidEmail(email)) {
      throw new Error("Please add a valid email address.");
    }
    const plan = args.plan ? cleanText(args.plan, "Plan", 80) || undefined : undefined;
    const message = args.message
      ? cleanText(args.message, "Message", 2000) || undefined
      : undefined;
    if (
      args.monthlyEstimate !== undefined &&
      (!Number.isFinite(args.monthlyEstimate) ||
        args.monthlyEstimate < 0 ||
        args.monthlyEstimate > 100_000_000)
    ) {
      throw new Error("That monthly estimate looks invalid.");
    }

    await enforceRateLimit(ctx, {
      scope: "quote.global",
      identifier: "all",
      ...RATE_LIMITS.quoteGlobal,
    });
    await enforceRateLimit(ctx, {
      scope: "quote.email",
      identifier: email,
      ...RATE_LIMITS.quotePerEmail,
    });
    if (userId) {
      await enforceRateLimit(ctx, {
        scope: "quote.user",
        identifier: userId,
        ...RATE_LIMITS.quotePerUser,
      });
    }

    const reference = `CV-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random()
      .toString(36)
      .toUpperCase()
      .slice(2, 4)}`;

    await ctx.db.insert("quotes", {
      userId: userId ?? undefined,
      reference,
      name,
      email,
      coverage: args.coverage,
      plan,
      message,
      status: "in_review",
      monthlyEstimate: args.monthlyEstimate,
    });

    return { reference };
  },
});

/**
 * All quote requests belonging to the signed-in member, newest first.
 * Requests sent from the landing page before signing up are matched by email
 * so a new member still finds their first quote waiting in the vault.
 */
export const myQuotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const [own, user] = await Promise.all([
      ctx.db
        .query("quotes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(30),
      ctx.db.get(userId),
    ]);

    let byEmail: typeof own = [];
    if (user?.email) {
      byEmail = await ctx.db
        .query("quotes")
        .withIndex("by_email", (q) => q.eq("email", user.email!.toLowerCase()))
        .order("desc")
        .take(30);
    }

    const merged = new Map(
      [...own, ...byEmail.filter((quote) => !quote.userId)].map((quote) => [
        quote._id,
        quote,
      ]),
    );

    return [...merged.values()]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 30);
  },
});
