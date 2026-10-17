import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isStaffRole, type Viewer } from "./authz";

export async function activeBrokerAssignment(
  ctx: QueryCtx | MutationCtx,
  brokerUserId: Id<"users">,
  customerUserId: Id<"users">,
) {
  const assignments = await ctx.db
    .query("brokerAssignments")
    .withIndex("by_broker", (q) =>
      q.eq("brokerUserId", brokerUserId).eq("status", "active"),
    )
    .take(500);
  return assignments.find((assignment) => assignment.customerUserId === customerUserId);
}

export async function isBrokerAssigned(
  ctx: QueryCtx | MutationCtx,
  brokerUserId: Id<"users">,
  customerUserId: Id<"users">,
) {
  return Boolean(await activeBrokerAssignment(ctx, brokerUserId, customerUserId));
}

/** Staff with the given permission, the customer themselves, or their assigned broker. */
export async function assertCustomerAccess(
  ctx: QueryCtx | MutationCtx,
  viewer: Viewer,
  customerUserId: Id<"users">,
  permission: string,
) {
  if (viewer.user._id === customerUserId) return;
  if (isStaffRole(viewer.role)) {
    if (
      viewer.role === "super_admin" ||
      viewer.permissions.includes(permission)
    ) {
      return;
    }
    throw new Error("You do not have permission to view this customer.");
  }
  if (viewer.role === "broker") {
    if (await isBrokerAssigned(ctx, viewer.user._id, customerUserId)) return;
    throw new Error("This customer is not assigned to your brokerage.");
  }
  throw new Error("You do not have access to this record.");
}

export async function requireBrokerAssignment(
  ctx: QueryCtx | MutationCtx,
  viewer: Viewer,
  customerUserId: Id<"users">,
) {
  if (viewer.role !== "broker") {
    throw new Error("This action is only available to brokers.");
  }
  const assignment = await activeBrokerAssignment(
    ctx,
    viewer.user._id,
    customerUserId,
  );
  if (!assignment) {
    throw new Error(
      "This customer is not assigned to you. Ask an administrator to assign them first.",
    );
  }
  return assignment;
}

export function isOwner(viewer: Viewer, ownerUserId: Id<"users">) {
  return viewer.user._id === ownerUserId;
}
