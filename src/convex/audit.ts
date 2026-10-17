import { v } from "convex/values";
import { query } from "./_generated/server";
import { PERMISSIONS, requirePermission } from "./lib/authz";

export const list = query({
  args: {
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.AUDIT_VIEW);
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(5, args.pageSize ?? 20));
    const action = args.action?.trim().toLowerCase();

    let rows = await ctx.db.query("auditLogs").order("desc").take(1000);
    rows = rows.filter(
      (row) =>
        (!args.entityType || args.entityType === "all" || row.entityType === args.entityType) &&
        (!args.entityId || row.entityId === args.entityId) &&
        (!args.actorId || row.actorId === args.actorId) &&
        (!action || row.action.toLowerCase().includes(action)),
    );
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);

    const actorIds = [...new Set(paged.map((row) => row.actorId))];
    const actors = await Promise.all(actorIds.map((id) => ctx.db.get(id)));
    const names = new Map(
      actors.filter(Boolean).map((actor) => [actor!._id, actor!.name ?? actor!.email ?? "Staff"]),
    );

    return {
      rows: paged.map((row) => ({
        ...row,
        actorName: names.get(row.actorId) ?? "Staff",
      })),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  },
});
