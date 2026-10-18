import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  PERMISSIONS,
  isStaffRole,
  requireViewer,
} from "./lib/authz";
import { validateUpload } from "./lib/files";
import { enforceRateLimit, RATE_LIMITS } from "./lib/rateLimit";
import { requiredText } from "./lib/refs";

const categoryValidator = v.union(
  v.literal("policy"),
  v.literal("invoice"),
  v.literal("receipt"),
  v.literal("claim"),
  v.literal("endorsement"),
  v.literal("application"),
  v.literal("other"),
);

function canStaffRead(viewer: Awaited<ReturnType<typeof requireViewer>>) {
  if (viewer.role === "super_admin") return true;
  return [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.POLICIES_MANAGE,
    PERMISSIONS.CLAIMS_REVIEW,
    PERMISSIONS.APPLICATIONS_REVIEW,
  ].some((permission) => viewer.permissions.includes(permission));
}

export const mine = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    let rows = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", viewer.user._id))
      .order("desc")
      .take(200);
    if (args.category && args.category !== "all") {
      rows = rows.filter((row) => row.category === args.category);
    }
    return rows;
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found.");
    const isOwner = document.ownerUserId === viewer.user._id;
    if (!isOwner && !(isStaffRole(viewer.role) && canStaffRead(viewer))) {
      throw new Error("You do not have access to this document.");
    }
    const url = document.storageId
      ? await ctx.storage.getUrl(document.storageId)
      : null;
    if (document.storageId && !url) {
      throw new Error("This document is temporarily unavailable. Please try again.");
    }
    return { document, url };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    // Convex storage only charges for files that are attached to a record, but
    // minting URLs still costs a function call and an unauthenticated script
    // cannot do it at all. Signed-in members get a generous hourly cap.
    await enforceRateLimit(ctx, {
      scope: "upload.url",
      identifier: viewer.user._id,
      ...RATE_LIMITS.uploadUrlPerUser,
    });
    return await ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    category: categoryValidator,
    policyId: v.optional(v.id("policies")),
    claimId: v.optional(v.id("claims")),
    applicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role === "admin" || viewer.role === "super_admin") {
      throw new Error("Upload documents from the customer portal.");
    }
    const name = requiredText(args.name, "Document name", 160);
    const meta = await validateUpload(ctx, args.storageId);

    if (args.policyId) {
      const policy = await ctx.db.get(args.policyId);
      if (!policy || policy.customerUserId !== viewer.user._id) {
        throw new Error("You can only attach documents to your own policy.");
      }
    }
    if (args.claimId) {
      const claim = await ctx.db.get(args.claimId);
      if (!claim || claim.customerUserId !== viewer.user._id) {
        throw new Error("You can only attach documents to your own claim.");
      }
    }
    if (args.applicationId) {
      const application = await ctx.db.get(args.applicationId);
      if (!application || application.customerUserId !== viewer.user._id) {
        throw new Error("You can only attach documents to your own application.");
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("documents", {
      ownerUserId: viewer.user._id,
      name,
      category: args.category,
      policyId: args.policyId,
      claimId: args.claimId,
      applicationId: args.applicationId,
      storageId: args.storageId,
      contentType: meta.contentType,
      size: meta.size,
      version: 1,
      issuedAt: now,
      createdAt: now,
    });
    return { documentId: id };
  },
});

export const forRecord = query({
  args: {
    applicationId: v.optional(v.id("applications")),
    claimId: v.optional(v.id("claims")),
    policyId: v.optional(v.id("policies")),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (!isStaffRole(viewer.role) || !canStaffRead(viewer)) {
      throw new Error("This document view is restricted to authorised staff.");
    }
    if (args.applicationId) {
      return await ctx.db
        .query("documents")
        .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
        .order("desc")
        .take(100);
    }
    if (args.claimId) {
      return await ctx.db
        .query("documents")
        .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
        .order("desc")
        .take(100);
    }
    if (args.policyId) {
      return await ctx.db
        .query("documents")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .order("desc")
        .take(100);
    }
    return [];
  },
});

export type DocumentRow = Doc<"documents">;
