import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { coverageValidator } from "./schema";

/**
 * Record a quote request from the landing page or the member vault.
 * Works for signed-out visitors too — the lead is simply not linked to a
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
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();

    if (name.length < 2) {
      throw new Error("Please add your full name.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please add a valid email address.");
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
      plan: args.plan,
      message: args.message?.trim() || undefined,
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
