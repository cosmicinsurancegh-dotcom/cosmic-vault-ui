import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isValidEmail, requiredText } from "./refs";

/**
 * Invitations.
 *
 * Cosmic Vault has no password hand-off: staff create the account record and
 * the owner proves the address by signing in with the emailed six-digit code.
 * The invited `users` row therefore starts with `emailVerificationTime` set,
 * which is what lets Convex Auth *link* the invitation to the account created
 * on first sign-in instead of creating a duplicate identity. Ownership is still
 * proven by that code, never by this record.
 */

export type InviteRole = "customer" | "broker" | "admin" | "super_admin";

export function normalizeInviteEmail(value: string | undefined) {
  return requiredText(value, "Email", 160).trim().toLowerCase();
}

export function assertInviteEmail(email: string) {
  if (!isValidEmail(email)) throw new Error("Please add a valid email address.");
  return email;
}

export function normalizeInviteName(value: string | undefined) {
  const name = requiredText(value, "Full name", 120);
  if (name.length < 2) throw new Error("Full name is too short.");
  return name;
}

export async function findUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
}

export async function inviteUser(
  ctx: MutationCtx,
  args: { name: string; email: string; role: InviteRole },
): Promise<Id<"users">> {
  const name = normalizeInviteName(args.name);
  const email = assertInviteEmail(normalizeInviteEmail(args.email));

  return await ctx.db.insert("users", {
    name,
    email,
    role: args.role,
    status: "active",
    emailVerificationTime: Date.now(),
    isAnonymous: false,
  });
}

/** Absolute sign-in address for invitation emails, when a site URL is configured. */
export function signInUrl() {
  const site = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  return site ? `${site}/auth` : "";
}

export function signInInstruction() {
  const url = signInUrl();
  const where = url ? url : "the member sign-in page";
  return `Open ${where} and enter this email address. We will send you a six-digit code - there is no password to remember.`;
}

/** Shared wording for the welcome email that accompanies an invitation. */
export function inviteMessage(args: {
  name: string;
  company: string;
  support: string;
  lines: string[];
}) {
  const first = args.name.trim().split(/\s+/)[0] || "there";
  const support = args.support.trim() || "our concierge";
  return {
    subject: `Your ${args.company} account is ready`,
    text: [
      `Hello ${first},`,
      "",
      ...args.lines,
      "",
      signInInstruction(),
      "",
      `Questions? Write to ${support}.`,
      "",
      args.company,
    ].join("\n"),
  };
}
