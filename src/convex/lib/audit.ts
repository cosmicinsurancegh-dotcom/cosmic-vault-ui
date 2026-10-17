import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "./authz";

type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
};

/**
 * Append-only audit record. No mutation exposed to the client updates or
 * deletes audit rows; only privileged reads are exposed.
 */
export async function writeAudit(
  ctx: MutationCtx,
  viewer: Viewer,
  entry: AuditEntry,
) {
  await ctx.db.insert("auditLogs", {
    actorId: viewer.user._id,
    actorRole: viewer.role,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    reason: entry.reason,
    requestId: entry.requestId,
    at: Date.now(),
  });
}
