import type { MutationCtx, QueryCtx } from "../_generated/server";

export type EmailTemplate = { key: string; subject: string; body: string };

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    key: "application.submitted",
    subject: "We received your application {{reference}}",
    body: "Hello {{name}},\n\nYour application {{reference}} has been received and is queued for manual underwriting. We will contact you if anything else is needed.\n\nCosmic Vault",
  },
  {
    key: "application.approved",
    subject: "Application {{reference}} approved",
    body: "Hello {{name}},\n\nGood news: application {{reference}} has been approved. {{title}}\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "application.declined",
    subject: "Decision on application {{reference}}",
    body: "Hello {{name}},\n\nA decision has been recorded on application {{reference}}.\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "application.info_requested",
    subject: "Information needed for application {{reference}}",
    body: "Hello {{name}},\n\nWe need a little more information before we can finish reviewing application {{reference}}.\n\n{{body}}\n\nPlease sign in to respond.\n\nCosmic Vault",
  },
  {
    key: "policy.issued",
    subject: "Your policy {{reference}} is issued",
    body: "Hello {{name}},\n\nPolicy {{reference}} has been issued and your documents are ready in your vault.\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "policy.changed",
    subject: "Update to policy {{reference}}",
    body: "Hello {{name}},\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "renewal.approaching",
    subject: "Policy {{reference}} is due for renewal",
    body: "Hello {{name}},\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "payment.succeeded",
    subject: "Payment received — {{reference}}",
    body: "Hello {{name}},\n\nWe have confirmed your payment. {{body}}\n\nCosmic Vault",
  },
  {
    key: "payment.failed",
    subject: "Payment could not be confirmed — {{reference}}",
    body: "Hello {{name}},\n\n{{body}}\n\nPlease sign in to review the transaction.\n\nCosmic Vault",
  },
  {
    key: "claim.submitted",
    subject: "Claim {{reference}} received",
    body: "Hello {{name}},\n\nWe have received claim {{reference}}. A claims handler will review it and contact you if more evidence is needed.\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "claim.status_changed",
    subject: "Update on claim {{reference}}",
    body: "Hello {{name}},\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "claim.settled",
    subject: "Settlement recorded for claim {{reference}}",
    body: "Hello {{name}},\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "support.updated",
    subject: "Update on support ticket {{reference}}",
    body: "Hello {{name}},\n\n{{body}}\n\nCosmic Vault",
  },
  {
    key: "account.security",
    subject: "Security notice for your account",
    body: "Hello {{name}},\n\n{{body}}\n\nIf this was not you, contact support immediately.\n\nCosmic Vault",
  },
];

export const DEFAULT_SETTINGS = {
  key: "global",
  companyName: "Cosmic Vault Insurance",
  supportEmail: "concierge@cosmicvault.co",
  defaultCurrency: "GBP",
  commissionEnabled: false,
  renewalNoticeDays: 30,
  claimSlaDays: 10,
  bankAccountName: "Cosmic Vault Insurance Ltd",
  bankIban: "GB00 VAUL 0000 0000 0000 00",
  bankSortCode: "00-00-00",
  bankSwift: "VAULTGB2L",
  allowedCurrencies: ["GBP", "EUR", "USD", "AED", "SGD"],
  emailTemplates: DEFAULT_TEMPLATES,
};

export async function getSettings(ctx: QueryCtx | MutationCtx) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  return existing
    ? { ...DEFAULT_SETTINGS, ...existing, key: "global" }
    : { ...DEFAULT_SETTINGS, updatedAt: Date.now(), updatedBy: undefined };
}

export async function ensureSettings(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("settings", {
    ...DEFAULT_SETTINGS,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id))!;
}
