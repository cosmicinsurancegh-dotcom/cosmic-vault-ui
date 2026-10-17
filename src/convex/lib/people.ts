import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { reference } from "./refs";
import { getSettings } from "./settings";

export function displayName(user: {
  name?: string;
  email?: string;
  isAnonymous?: boolean;
}) {
  if (user.name?.trim()) return user.name.trim();
  if (user.email) return user.email.split("@")[0];
  return "Vault member";
}

export async function getCustomerProfile(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("customerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function ensureCustomerProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const existing = await getCustomerProfile(ctx, userId);
  if (existing) return existing;

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found.");
  if (user.role === "admin" || user.role === "super_admin") {
    throw new Error("Staff accounts do not have customer profiles.");
  }
  if (user.role === "broker") {
    throw new Error("Broker accounts use a broker profile.");
  }

  const settings = await getSettings(ctx);
  const now = Date.now();
  const id = await ctx.db.insert("customerProfiles", {
    userId,
    reference: reference("CUS"),
    fullName: displayName(user),
    email: (user.email ?? "").toLowerCase(),
    country: "GB",
    currency: settings.defaultCurrency,
    locale: "en-GB",
    timezone: "Europe/London",
    preferredLanguage: "en",
    marketingOptIn: false,
    verificationStatus: "unverified",
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}
