import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeRole, type Viewer } from "./authz";
import { writeAudit } from "./audit";
import { notifyUser } from "./notify";
import { getCustomerProfile } from "./people";
import { isValidEmail, requiredText } from "./refs";
import { getSettings } from "./settings";

/**
 * Account-level self-service: the sign-in address, and deleting the account.
 *
 * These rules sit in one place because two very different callers need them -
 * the account holder on their own dashboard, and staff working a customer
 * record in the admin console - and the security rules must be identical:
 * an address belongs to one account, a super admin can never be deleted, and a
 * deleted account loses its credentials, its sessions and its personal details
 * while the business records it is attached to stay put.
 */

/** Auth provider ids whose account id *is* the email address. */
export const EMAIL_PROVIDERS = ["email-otp", "password"] as const;

export const PASSWORD_PROVIDER = "password";

/** Address a deleted account is reduced to; the domain cannot receive mail. */
const CLOSED_EMAIL_DOMAIN = "closed.invalid";

export function normalizeAccountEmail(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function assertAccountEmail(value: string | undefined) {
  const email = normalizeAccountEmail(value);
  if (!email || !isValidEmail(email)) {
    throw new Error("Add a valid email address.");
  }
  return email;
}

export function assertAccountPassword(value: string) {
  if (typeof value !== "string" || value.length < 8) {
    throw new Error("Use at least 8 characters for your password.");
  }
  return value;
}

export function closedEmail(userId: Id<"users">) {
  return `closed-${userId}@${CLOSED_EMAIL_DOMAIN}`;
}

/** The account that already holds an address, if any. */
async function emailOwner(
  ctx: MutationCtx,
  email: string,
  exceptUserId: Id<"users">,
): Promise<Id<"users"> | null> {
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (user && user._id !== exceptUserId) return user._id;

  /* A credential row can hold an address the users table has moved on from,
     and re-using it would merge two identities at the next sign-in. */
  for (const provider of EMAIL_PROVIDERS) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", provider).eq("providerAccountId", email),
      )
      .unique();
    if (account && account.userId !== exceptUserId) return account.userId;
  }
  return null;
}

export async function assertEmailAvailable(
  ctx: MutationCtx,
  email: string,
  exceptUserId: Id<"users">,
) {
  if (await emailOwner(ctx, email, exceptUserId)) {
    throw new Error(
      "That email address already belongs to another account. Use a different one.",
    );
  }
}

/**
 * Moves an account onto a new sign-in address.
 *
 * The credential rows move with it: leaving them on the old address would make
 * the next sign-in with the new one look like a brand-new person, and the
 * member would land in an empty dashboard while their policies stayed behind
 * on the old identity. Every record that copies the address is updated too, so
 * the console and the emails never disagree.
 */
export async function applyEmailChange(
  ctx: MutationCtx,
  args: {
    viewer: Viewer;
    user: Doc<"users">;
    email: string;
    /** Who made the change, for the audit wording. */
    source: "self" | "staff";
  },
) {
  const email = assertAccountEmail(args.email);
  await assertEmailAvailable(ctx, email, args.user._id);
  const previous = normalizeAccountEmail(args.user.email);

  for (const provider of EMAIL_PROVIDERS) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.user._id).eq("provider", provider),
      )
      .unique();
    if (account && normalizeAccountEmail(account.providerAccountId) === previous) {
      await ctx.db.patch(account._id, { providerAccountId: email });
    }
  }

  await ctx.db.patch(args.user._id, { email });

  const profile = await getCustomerProfile(ctx, args.user._id);
  if (profile) {
    await ctx.db.patch(profile._id, { email, updatedAt: Date.now() });
  }
  const broker = await ctx.db
    .query("brokerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", args.user._id))
    .unique();
  if (broker) {
    await ctx.db.patch(broker._id, { email, updatedAt: Date.now() });
  }

  await writeAudit(ctx, args.viewer, {
    action:
      args.source === "staff"
        ? "account.email_changed_by_staff"
        : "account.email_changed",
    entityType: "users",
    entityId: args.user._id,
    before: { email: previous },
    after: { email },
    reason:
      args.source === "staff" ? "Changed from the customer record." : undefined,
  });

  return { previous, email };
}

/**
 * Deletes an account: credentials and sessions are destroyed, personal details
 * are replaced, and the row itself is kept - marked closed - so policies,
 * claims and payments still resolve to something.
 *
 * Super admins are never deletable, by anyone, including themselves: a
 * deployment that loses its last super admin can no longer grant access to
 * anyone.
 */
export async function closeAccountRecord(
  ctx: MutationCtx,
  viewer: Viewer,
  target: Doc<"users">,
  reason: string,
) {
  if (normalizeRole(target.role) === "super_admin") {
    throw new Error(
      "Super admin accounts cannot be deleted. Hand the role to another account first.",
    );
  }

  const now = Date.now();
  const settings = await getSettings(ctx);
  const name = target.name?.split(" ")[0] ?? "there";

  /* Confirm to the address while it is still on the record: the notification
     hands the provider the address it was queued with, so it survives even
     though the account is anonymised in this same transaction. */
  await notifyUser(ctx, {
    userId: target._id,
    type: "account.security",
    title: "Your account has been closed",
    body:
      reason.trim() || "Your account was deleted. Personal details were removed.",
    href: "/",
    dedupeKey: `account-closed:${target._id}`,
    subject: `Your ${settings.companyName} account has been closed`,
    text: [
      `Hello ${name},`,
      "",
      `Your ${settings.companyName} account has been deleted and its sign-in credentials removed.`,
      "Policies, claims and payment records are retained for the period the law requires, and they no longer contain your personal details.",
      "",
      `If this was not you, write to ${settings.supportEmail} straight away.`,
      "",
      settings.companyName,
    ].join("\n"),
  });

  /* Every credential, not just the email ones: a leftover anonymous account
     would still be a way back into the identity. */
  const accounts = await ctx.db
    .query("authAccounts")
    .filter((q) => q.eq(q.field("userId"), target._id))
    .collect();
  for (const account of accounts) await ctx.db.delete(account._id);

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", target._id))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }

  const profile = await getCustomerProfile(ctx, target._id);
  if (profile) {
    await ctx.db.patch(profile._id, {
      fullName: "Closed account",
      email: closedEmail(target._id),
      phone: undefined,
      dateOfBirth: undefined,
      city: undefined,
      addressLine: undefined,
      postalCode: undefined,
      notes: undefined,
      marketingOptIn: false,
      updatedAt: now,
    });
  }

  const broker = await ctx.db
    .query("brokerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", target._id))
    .unique();
  if (broker) {
    await ctx.db.patch(broker._id, {
      contactName: "Closed account",
      email: closedEmail(target._id),
      phone: undefined,
      status: "suspended",
      updatedAt: now,
    });
    const assignments = await ctx.db
      .query("brokerAssignments")
      .withIndex("by_broker", (q) =>
        q.eq("brokerUserId", target._id).eq("status", "active"),
      )
      .collect();
    for (const assignment of assignments) {
      await ctx.db.patch(assignment._id, { status: "revoked", revokedAt: now });
    }
  }

  const handedOver = await ctx.db
    .query("brokerAssignments")
    .withIndex("by_customer", (q) =>
      q.eq("customerUserId", target._id).eq("status", "active"),
    )
    .collect();
  for (const assignment of handedOver) {
    await ctx.db.patch(assignment._id, { status: "revoked", revokedAt: now });
  }

  await ctx.db.patch(target._id, {
    name: "Closed account",
    email: closedEmail(target._id),
    image: undefined,
    emailVerificationTime: undefined,
    status: "closed",
    closedAt: now,
    /* Privileges do not outlive the account, whoever pressed delete. */
    role: "customer",
    permissions: [],
    suspendedReason: undefined,
    isAnonymous: false,
  });

  await writeAudit(ctx, viewer, {
    action: "account.closed",
    entityType: "users",
    entityId: target._id,
    before: { email: normalizeAccountEmail(target.email), role: target.role },
    after: { status: "closed" },
    reason: requiredText(reason, "Reason", 500),
  });

  return true;
}
