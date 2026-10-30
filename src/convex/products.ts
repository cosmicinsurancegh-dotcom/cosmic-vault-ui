import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  PERMISSIONS,
  hasPermission,
  requirePermission,
  requireViewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { priceProduct, validateAnswers } from "./lib/pricing";
import { cleanText, requiredText } from "./lib/refs";
import { getSettings } from "./lib/settings";

const ratingFactorValidator = v.object({
  key: v.string(),
  label: v.string(),
  help: v.optional(v.string()),
  options: v.array(
    v.object({
      value: v.string(),
      label: v.string(),
      multiplier: v.number(),
    }),
  ),
});

const questionValidator = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("number"),
    v.literal("date"),
    v.literal("select"),
    v.literal("textarea"),
  ),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
  help: v.optional(v.string()),
});

const documentValidator = v.object({
  key: v.string(),
  label: v.string(),
  required: v.boolean(),
});

const draftFields = {
  productId: v.optional(v.id("products")),
  code: v.string(),
  name: v.string(),
  categoryKey: v.string(),
  description: v.string(),
  targetCustomer: v.string(),
  countries: v.array(v.string()),
  currency: v.string(),
  basePremium: v.number(),
  termMonths: v.number(),
  excess: v.number(),
  coverageLimit: v.number(),
  exclusions: v.array(v.string()),
  benefits: v.array(v.string()),
  ratingFactors: v.array(ratingFactorValidator),
  questions: v.array(questionValidator),
  requiredDocuments: v.array(documentValidator),
  wordingVersion: v.string(),
  wording: v.string(),
  disclosures: v.string(),
  renewalNoticeDays: v.number(),
  cancellationNoticeDays: v.number(),
  effectiveFrom: v.number(),
};

async function latestVersion(ctx: MutationCtx, code: string) {
  const versions = await ctx.db
    .query("products")
    .withIndex("by_code", (q) => q.eq("code", code))
    .take(100);
  return versions.reduce((max, item) => Math.max(max, item.version), 0);
}

async function validateProduct(
  ctx: MutationCtx,
  args: {
    code: string;
    name: string;
    description: string;
    categoryKey: string;
    countries: string[];
    currency: string;
    basePremium: number;
    coverageLimit: number;
    wording: string;
    ratingFactors: { key: string; options: unknown[] }[];
    questions: { key: string }[];
  },
) {
  const code = args.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) {
    throw new Error("Product reference must be 3–32 characters: A–Z, 0–9, or hyphen.");
  }
  if (args.name.trim().length < 3) throw new Error("Product name is too short.");
  if (!args.description.trim()) throw new Error("Product description is required.");
  const category = await ctx.db
    .query("categories")
    .withIndex("by_key", (q) => q.eq("key", args.categoryKey))
    .unique();
  if (!category) throw new Error("Choose a valid insurance category.");
  if (args.countries.length === 0) {
    throw new Error("Select at least one supported country.");
  }
  for (const countryCode of args.countries) {
    const country = await ctx.db
      .query("countries")
      .withIndex("by_code", (q) => q.eq("code", countryCode))
      .unique();
    if (!country || !country.active) {
      throw new Error(`Country ${countryCode} is not active.`);
    }
  }
  const settings = await getSettings(ctx);
  const currency = await ctx.db
    .query("currencies")
    .withIndex("by_code", (q) => q.eq("code", args.currency))
    .unique();
  if (!currency || !settings.allowedCurrencies.includes(args.currency)) {
    throw new Error("Choose a currency supported by the platform.");
  }
  if (args.basePremium <= 0) throw new Error("Base premium must be greater than zero.");
  if (args.coverageLimit <= 0) throw new Error("Coverage limit must be greater than zero.");
  if (args.wording.trim().length < 20) {
    throw new Error("Policy wording is required before a product can be sold.");
  }
  const factorKeys = new Set<string>();
  for (const factor of args.ratingFactors) {
    if (factorKeys.has(factor.key)) throw new Error("Rating factor keys must be unique.");
    factorKeys.add(factor.key);
    if (factor.options.length < 1) {
      throw new Error(`Rating factor "${factor.key}" needs at least one option.`);
    }
  }
  const questionKeys = new Set<string>();
  for (const question of args.questions) {
    if (questionKeys.has(question.key)) throw new Error("Question keys must be unique.");
    questionKeys.add(question.key);
  }
  for (const factor of args.ratingFactors) {
    if (!questionKeys.has(factor.key)) {
      throw new Error(
        `Rating factor "${factor.key}" must also exist as an application question.`,
      );
    }
  }
  return code;
}

export const catalogue = query({
  args: { country: v.optional(v.string()), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireViewer(ctx, { allowSuspended: true });
    let products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(200);
    const now = Date.now();
    products = products.filter(
      (product) =>
        product.effectiveFrom <= now &&
        /* A product with no markets is not for sale anywhere. The cover anchor
           the vault issues against is exactly that, so it must never reach the
           catalogue the member browses - including when no country is asked
           for, which is how the page opens. */
        product.countries.length > 0 &&
        (!args.country || product.countries.includes(args.country)) &&
        (!args.category ||
          args.category === "all" ||
          product.categoryKey === args.category),
    );
    products.sort((a, b) => a.name.localeCompare(b.name));
    const categories = await ctx.db.query("categories").take(50);
    return { products, categories: categories.filter((item) => item.active) };
  },
});

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);
    const products = await ctx.db.query("products").take(300);
    return products.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    if (product.status !== "published" && !hasPermission(viewer, PERMISSIONS.PRODUCTS_MANAGE)) {
      throw new Error("This product is not published.");
    }
    const versions = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", product.code))
      .take(50);
    return {
      product,
      versions: versions
        .map((item) => ({
          _id: item._id,
          version: item.version,
          status: item.status,
          publishedAt: item.publishedAt,
          effectiveFrom: item.effectiveFrom,
        }))
        .sort((a, b) => b.version - a.version),
    };
  },
});

export const quote = mutation({
  args: {
    productId: v.id("products"),
    answers: v.any(),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    const staff = hasPermission(viewer, PERMISSIONS.PRODUCTS_MANAGE);
    if (product.status !== "published" && !staff) {
      throw new Error("This product is not available for sale.");
    }
    if (!product.countries.includes(args.country)) {
      throw new Error("This product is not available in the selected country.");
    }
    const answers = validateAnswers(
      product,
      (args.answers ?? {}) as Record<string, string | number>,
    );
    const breakdown = priceProduct(product, answers);
    return { product, answers, breakdown };
  },
});

export const saveDraft = mutation({
  args: draftFields,
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);
    const code = await validateProduct(ctx, args);
    const now = Date.now();

    let existing: Doc<"products"> | null = null;
    if (args.productId) {
      existing = await ctx.db.get(args.productId);
      if (!existing) throw new Error("Product not found.");
      if (existing.status !== "draft") {
        throw new Error(
          "Published versions are immutable. Save changes as a new draft version.",
        );
      }
    }
    if (!existing) {
      const sameCodePublished = await ctx.db
        .query("products")
        .withIndex("by_code", (q) => q.eq("code", code))
        .take(50);
      if (sameCodePublished.some((item) => item.status === "draft")) {
        throw new Error("A draft already exists for this product reference.");
      }
    }

    const payload = {
      code,
      name: requiredText(args.name, "Product name", 120),
      categoryKey: args.categoryKey,
      description: requiredText(args.description, "Description", 2000),
      targetCustomer: cleanText(args.targetCustomer, "Target customer", 500),
      countries: [...new Set(args.countries)],
      currency: args.currency,
      basePremium: Math.round(args.basePremium),
      termMonths: Math.max(1, Math.min(120, Math.round(args.termMonths))),
      excess: Math.round(args.excess),
      coverageLimit: Math.round(args.coverageLimit),
      exclusions: args.exclusions.map((item) => cleanText(item, "Exclusion", 300)).filter(Boolean),
      benefits: args.benefits.map((item) => cleanText(item, "Benefit", 300)).filter(Boolean),
      ratingFactors: args.ratingFactors,
      questions: args.questions,
      requiredDocuments: args.requiredDocuments,
      wordingVersion: requiredText(args.wordingVersion, "Wording version", 40),
      wording: requiredText(args.wording, "Policy wording", 20000),
      disclosures: cleanText(args.disclosures, "Disclosures", 5000),
      renewalNoticeDays: Math.max(1, Math.min(180, Math.round(args.renewalNoticeDays))),
      cancellationNoticeDays: Math.max(0, Math.min(180, Math.round(args.cancellationNoticeDays))),
      effectiveFrom: args.effectiveFrom || now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      await writeAudit(ctx, viewer, {
        action: "products.draft_updated",
        entityType: "products",
        entityId: existing._id,
        after: { name: payload.name, basePremium: payload.basePremium },
      });
      return { productId: existing._id };
    }

    const version = (await latestVersion(ctx, code)) + 1;
    const id = await ctx.db.insert("products", {
      ...payload,
      status: "draft",
      version,
      createdBy: viewer.user._id,
      createdAt: now,
    });
    await writeAudit(ctx, viewer, {
      action: "products.draft_created",
      entityType: "products",
      entityId: id,
      after: { code, version },
    });
    return { productId: id };
  },
});

export const publish = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    if (product.status !== "draft") throw new Error("Only draft versions can be published.");
    if (product.coverageLimit <= 0 || product.basePremium <= 0) {
      throw new Error("Coverage and premium must be configured before publication.");
    }
    if (product.countries.length === 0) {
      throw new Error("Add at least one supported country before publication.");
    }
    if (product.wording.trim().length < 20) {
      throw new Error("Policy wording is required before publication.");
    }

    const sameCode = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", product.code))
      .take(50);
    const now = Date.now();
    for (const sibling of sameCode) {
      if (sibling._id !== product._id && sibling.status === "published") {
        await ctx.db.patch(sibling._id, { status: "archived", updatedAt: now });
      }
    }
    await ctx.db.patch(product._id, {
      status: "published",
      publishedBy: viewer.user._id,
      publishedAt: now,
      updatedAt: now,
      effectiveFrom: product.effectiveFrom || now,
    });
    await writeAudit(ctx, viewer, {
      action: "products.published",
      entityType: "products",
      entityId: product._id,
      before: { status: "draft", version: product.version },
      after: { status: "published", version: product.version, effectiveFrom: product.effectiveFrom },
    });
    return true;
  },
});

export const archive = mutation({
  args: { productId: v.id("products"), reason: v.string() },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    if (product.status === "archived") return true;
    const reason = requiredText(args.reason, "Reason", 500);
    await ctx.db.patch(product._id, {
      status: "archived",
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, viewer, {
      action: "products.archived",
      entityType: "products",
      entityId: product._id,
      before: { status: product.status },
      after: { status: "archived" },
      reason,
    });
    return true;
  },
});
