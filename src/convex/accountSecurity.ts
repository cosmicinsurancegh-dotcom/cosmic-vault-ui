import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  applyEmailChange,
  assertAccountPassword,
  closeAccountRecord,
  closedEmail,
  normalizeAccountEmail,
  PASSWORD_PROVIDER,
} from "./lib/account";
import {
  hasPermission,
  normalizeRole,
  PERMISSIONS,
  requirePermission,
  requireViewer,
  viewerForUser,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { normalizeInviteName } from "./lib/invite";
import { notifyUser } from "./lib/notify";
import { getCustomerProfile } from "./lib/people";
import { cleanText } from "./lib/refs";

/**
 * Password sign-in is additive: every account starts passwordless with an
 * emailed code, and a password can be attached later from the profile page.
 *
 * These helpers only ever touch the current user's own credential, and only
 * once the account's email has been verified by a code, which is what makes
 * attaching a password to an existing email-code identity safe.
 */
const normalizeEmail = normalizeAccountEmail;

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
    }    return { ok: true };
  },
});

/**
 * The display name on the account. Customers keep the fuller record on their
 * customer profile; this is what a staff account - which has no profile - edits
 * from its own dashboard.
 */
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const name = normalizeInviteName(args.name);
    if (name === viewer.user.name) return true;

    await ctx.db.patch(viewer.user._id, { name });
    const profile = await getCustomerProfile(ctx, viewer.user._id);
    if (profile) {
      await ctx.db.patch(profile._id, { fullName: name, updatedAt: Date.now() });
    }
    const broker = await ctx.db
      .query("brokerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
      .unique();
    if (broker) {
      await ctx.db.patch(broker._id, {
        contactName: name,
        updatedAt: Date.now(),
      });
    }
    await writeAudit(ctx, viewer, {
      action: "account.name_changed",
      entityType: "users",
      entityId: viewer.user._id,
      before: { name: viewer.user.name },
      after: { name },
    });
    return true;
  },
});

/**
 * The signed-in account changing its own sign-in address.
 *
 * There is no code round-trip: the account is already authenticated, and the
 * credential rows move with the address so the same policies stay behind it.
 * The confirmation goes to the address it now holds, which is also how a typo
 * is noticed - it is the address the next sign-in code is sent to.
 */
export const changeEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.user.status === "closed") {
      throw new Error("This account is closed.");
    }
    const change = await applyEmailChange(ctx, {
      viewer,
      user: viewer.user,
      email: args.email,
      source: "self",
    });
    await notifyUser(ctx, {
      userId: viewer.user._id,
      type: "account.security",
      title: "Your sign-in email changed",
      body: `Your account now signs in with ${change.email}.`,
      href: "/dashboard/profile",
      dedupeKey: `account-email:${viewer.user._id}:${change.email}`,
      subject: "Your sign-in email changed",
      text: [
        `This is now the address your sign-in codes are sent to: ${change.email}`,
        "",
        "If you did not make this change, reply to this message or contact support straight away.",
      ].join("\n"),
    });
    return change;
  },
});

/**
 * Staff changing a customer's sign-in address from the customer record.
 *
 * The customer is told at the new address, because they are the one who has to
 * use it at the next sign-in.
 */
export const staffChangeEmail = mutation({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Account not found.");
    if (target.role === "admin" || target.role === "super_admin") {
      throw new Error("Use staff management to change a staff email address.");
    }
    if (target.status === "closed") throw new Error("That account is closed.");

    const change = await applyEmailChange(ctx, {
      viewer,
      user: target,
      email: args.email,
      source: "staff",
    });
    await notifyUser(ctx, {
      userId: target._id,
      type: "account.security",
      title: "Your sign-in email changed",
      body: `An administrator changed your sign-in address to ${change.email}.`,
      href: "/dashboard/profile",
      dedupeKey: `account-email:${target._id}:${change.email}`,
      subject: "Your sign-in email changed",
      text: [
        `An administrator changed the address your account signs in with to ${change.email}.`,
        "",
        "If you did not ask for this, contact support straight away.",
      ].join("\n"),
    });
    return change;
  },
});

/**
 * The target of a staff password reset, with the checks that make it safe to
 * touch another person's credential.
 *
 * Actions cannot read the database, so authorisation lives here and runs
 * against the caller's own session: the permission is the console's customer
 * permission, staff accounts are out of bounds, and the address must already be
 * confirmed, because attaching a password to an unconfirmed address would let
 * the linking step mint a second identity.
 */
export const staffPasswordTarget = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.CUSTOMERS_MANAGE);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Account not found.");
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("Use staff management to reset a staff password.");
    }
    if (user.status === "closed") throw new Error("That account is closed.");
    const email = normalizeEmail(user.email);
    if (!email) throw new Error("This account has no email address.");
    if (user.emailVerificationTime === undefined) {
      throw new Error(
        "This account has not confirmed its email address yet, so a password cannot be attached to it.",
      );
    }
    const account = await passwordAccountFor(ctx, email);
    if (account && account.userId !== user._id) {
      throw new Error(
        "That email address already has a password on another account.",
      );
    }
    return { email, hasPassword: account !== null };
  },
});

/**
 * Records a staff password reset: who did it, on whose account, when.
 *
 * The actor arrives from the action (which has the session) because an internal
 * mutation cannot read one - the row still names the real person, and the
 * account holder is told their password changed.
 */
export const recordStaffPasswordReset = internalMutation({
  args: { userId: v.id("users"), actorId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get(args.actorId);
    if (!actor) throw new Error("Please sign in to continue.");
    const viewer = viewerForUser(actor);
    if (!hasPermission(viewer, PERMISSIONS.CUSTOMERS_MANAGE)) {
      throw new Error("Password resets are restricted to staff with customer access.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) return null;

    await writeAudit(ctx, viewer, {
      action: "account.password_reset_by_staff",
      entityType: "users",
      entityId: target._id,
      after: { passwordChanged: true },
      reason: "New password set from the customer record.",
    });
    await notifyUser(ctx, {
      userId: target._id,
      type: "account.security",
      title: "Your password was reset",
      body: "An administrator set a new password on your account. Ask them for it, then change it from your profile.",
      href: "/dashboard/profile",
      dedupeKey: `staff-password:${target._id}:${Date.now()}`,
      subject: "Your password was reset",
      text: [
        "An administrator set a new password on your account.",
        "",
        "Ask them for it, then change it from Profile & account so only you know it.",
      ].join("\n"),
    });
    return true;
  },
});

/**
 * A staff member setting a new password on a customer's account - the console's
 * "set password" action, for a customer who has lost access.
 */
export const staffSetPassword = action({
  args: { userId: v.id("users"), password: v.string() },
  /* Annotated: the target query lives in this same module, and its type would
     otherwise be inferred from this action's return type and back again. */
  handler: async (ctx, args): Promise<{ ok: boolean; email: string }> => {
    const password = assertAccountPassword(args.password);
    const actorId = await getAuthUserId(ctx);
    if (actorId === null) throw new Error("Please sign in to continue.");

    const target: { email: string; hasPassword: boolean } =
      await ctx.runQuery(internal.accountSecurity.staffPasswordTarget, {
        userId: args.userId,
      });

    if (target.hasPassword) {
      await modifyAccountCredentials(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: target.email, secret: password },
      });
    } else {
      await createAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: target.email, secret: password },
        profile: { email: target.email },
        shouldLinkViaEmail: true,
      });
    }

    await ctx.runMutation(internal.accountSecurity.recordStaffPasswordReset, {
      userId: args.userId,
      actorId,
    });
    return { ok: true, email: target.email };
  },
});

/**
 * Deleting your own account from your dashboard.
 *
 * A super admin cannot: the deployment would lose the only role able to hand
 * access back out.
 */
export const closeAccount = mutation({
  args: { reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (normalizeRole(viewer.user.role) === "super_admin") {
      throw new Error(
        "Super admin accounts cannot be deleted. Hand the role to another account first.",
      );
    }
    const reason =
      cleanText(args.reason, "Reason", 500) ||
      "Deleted by the account holder from their dashboard.";

    /* The address is captured for the confirmation before it is anonymised. */
    const email = normalizeEmail(viewer.user.email);
    await closeAccountRecord(ctx, viewer, viewer.user, reason);
    return { email, tombstone: closedEmail(viewer.user._id) };
  },
});

