import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";

/**
 * Password sign-in is additive: every account starts passwordless with an
 * emailed code, and a password can be attached later from the profile page.
 *
 * These helpers only ever touch the current user's own credential, and only
 * once the account's email has been verified by a code, which is what makes
 * attaching a password to an existing email-code identity safe.
 */
const PASSWORD_PROVIDER = "password";

function normalizeEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

async function passwordAccountFor(ctx: QueryCtx, email: string) {
  if (!email) return null;
  return await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", email),
    )
    .unique();
}

export const passwordStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { hasPassword: false };
    const user = await ctx.db.get(userId);
    const email = normalizeEmail(user?.email);
    const account = await passwordAccountFor(ctx, email);
    return { hasPassword: account !== null && account.userId === userId };
  },
});

/**
 * Internal view of the credential state used by the `setPassword` action.
 * Actions cannot read the database directly, so the lookups live here.
 */
export const credentialState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        signedIn: false,
        email: "",
        verified: false,
        hasPassword: false,
        ownsPassword: false,
      };
    }
    const user = await ctx.db.get(userId);
    const email = normalizeEmail(user?.email);
    const verified = user?.emailVerificationTime !== undefined;
    const account = await passwordAccountFor(ctx, email);
    return {
      signedIn: true,
      email,
      verified,
      hasPassword: account !== null,
      ownsPassword: account?.userId === userId,
    };
  },
});

export const setPassword = action({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    if (args.password.length < 8) {
      throw new Error("Use at least 8 characters for your password.");
    }
    const state = await ctx.runQuery(
      internal.accountSecurity.credentialState,
      {},
    );
    if (!state.signedIn) {
      throw new Error("Sign in before setting a password.");
    }
    if (!state.email || !state.verified) {
      throw new Error(
        "Verify your email with a sign-in code before setting a password.",
      );
    }
    if (state.hasPassword && !state.ownsPassword) {
      throw new Error(
        "That email address already has a password on another account.",
      );
    }
    if (state.hasPassword) {
      await modifyAccountCredentials(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: state.email, secret: args.password },
      });
    } else {
      await createAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: state.email, secret: args.password },
        profile: { email: state.email },
        shouldLinkViaEmail: true,
      });
    }
    return { ok: true };
  },
});
