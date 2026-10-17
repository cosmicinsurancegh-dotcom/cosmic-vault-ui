import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PERMISSIONS, requirePermission, requireViewer } from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { cleanText, isValidEmail, requiredText } from "./lib/refs";
import { DEFAULT_TEMPLATES, ensureSettings, getSettings } from "./lib/settings";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    return await getSettings(ctx);
  },
});

export const publicInfo = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (!viewer) return null;
    const settings = await getSettings(ctx);
    return {
      companyName: settings.companyName,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      commissionEnabled: settings.commissionEnabled,
      bankAccountName: settings.bankAccountName,
      bankIban: settings.bankIban,
      bankSortCode: settings.bankSortCode,
      bankSwift: settings.bankSwift,
    };
  },
});

export const update = mutation({
  args: {
    companyName: v.string(),
    supportEmail: v.string(),
    defaultCurrency: v.string(),
    commissionEnabled: v.boolean(),
    renewalNoticeDays: v.number(),
    claimSlaDays: v.number(),
    bankAccountName: v.optional(v.string()),
    bankIban: v.optional(v.string()),
    bankSortCode: v.optional(v.string()),
    bankSwift: v.optional(v.string()),
    allowedCurrencies: v.array(v.string()),
    emailTemplates: v.array(
      v.object({ key: v.string(), subject: v.string(), body: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const settings = await ensureSettings(ctx);
    const email = requiredText(args.supportEmail, "Support email", 160).toLowerCase();
    if (!isValidEmail(email)) throw new Error("Enter a valid support email address.");
    if (args.allowedCurrencies.length === 0) {
      throw new Error("Keep at least one supported currency.");
    }
    const currencies = await ctx.db.query("currencies").take(50);
    const known = new Set(currencies.map((currency) => currency.code));
    for (const code of args.allowedCurrencies) {
      if (!known.has(code)) throw new Error(`${code} is not a configured currency.`);
    }
    if (!args.allowedCurrencies.includes(args.defaultCurrency)) {
      throw new Error("The default currency must be one of the supported currencies.");
    }
    const keys = new Set<string>();
    for (const template of args.emailTemplates) {
      const key = requiredText(template.key, "Template key", 80);
      if (keys.has(key)) throw new Error("Template keys must be unique.");
      keys.add(key);
      requiredText(template.subject, "Template subject", 200);
      requiredText(template.body, "Template body", 5000);
    }

    const before = {
      companyName: settings.companyName,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      commissionEnabled: settings.commissionEnabled,
      renewalNoticeDays: settings.renewalNoticeDays,
      claimSlaDays: settings.claimSlaDays,
      allowedCurrencies: settings.allowedCurrencies,
    };
    await ctx.db.patch(settings._id, {
      companyName: requiredText(args.companyName, "Company name", 160),
      supportEmail: email,
      defaultCurrency: args.defaultCurrency,
      commissionEnabled: args.commissionEnabled,
      renewalNoticeDays: Math.max(1, Math.min(180, Math.round(args.renewalNoticeDays))),
      claimSlaDays: Math.max(1, Math.min(90, Math.round(args.claimSlaDays))),
      bankAccountName: cleanText(args.bankAccountName, "Bank account name", 160) || undefined,
      bankIban: cleanText(args.bankIban, "IBAN", 64) || undefined,
      bankSortCode: cleanText(args.bankSortCode, "Sort code", 24) || undefined,
      bankSwift: cleanText(args.bankSwift, "SWIFT/BIC", 24) || undefined,
      allowedCurrencies: args.allowedCurrencies,
      emailTemplates: args.emailTemplates.map((template) => ({
        key: template.key,
        subject: template.subject,
        body: cleanText(template.body, "Template body", 5000),
      })),
      updatedAt: Date.now(),
      updatedBy: viewer.user._id,
    });
    await writeAudit(ctx, viewer, {
      action: "settings.updated",
      entityType: "settings",
      entityId: settings._id,
      before,
      after: {
        companyName: args.companyName,
        supportEmail: email,
        defaultCurrency: args.defaultCurrency,
        commissionEnabled: args.commissionEnabled,
        renewalNoticeDays: args.renewalNoticeDays,
        claimSlaDays: args.claimSlaDays,
        allowedCurrencies: args.allowedCurrencies,
      },
    });
    return true;
  },
});

export const resetTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const settings = await ensureSettings(ctx);
    await ctx.db.patch(settings._id, {
      emailTemplates: DEFAULT_TEMPLATES,
      updatedAt: Date.now(),
      updatedBy: viewer.user._id,
    });
    await writeAudit(ctx, viewer, {
      action: "settings.templates_reset",
      entityType: "settings",
      entityId: settings._id,
    });
    return true;
  },
});
