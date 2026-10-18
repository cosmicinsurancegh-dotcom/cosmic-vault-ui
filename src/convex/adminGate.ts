import { internalQuery } from "./_generated/server";
import { PERMISSIONS, requirePermission } from "./lib/authz";

/**
 * Staff gate for Convex actions.
 *
 * Actions cannot read the database directly, and `"use node"` modules may only
 * define actions - so the permission check lives here and is called by actions
 * with `ctx.runQuery(internal.adminGate.staffGate, {})`.
 */
export const staffGate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    return { userId: viewer.user._id, role: viewer.role };
  },
});
