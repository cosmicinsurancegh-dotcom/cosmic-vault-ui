import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ROLES } from "../schema";

/** Granular staff permissions. Enforced on the server for every action. */
export const PERMISSIONS = {
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  PRODUCTS_MANAGE: "products.manage",
  APPLICATIONS_REVIEW: "applications.review",
  POLICIES_MANAGE: "policies.manage",
  CLAIMS_REVIEW: "claims.review",
  CLAIMS_DECIDE: "claims.decide",
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  REFUNDS_APPROVE: "refunds.approve",
  BROKERS_MANAGE: "brokers.manage",
  REPORTS_VIEW: "reports.view",
  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
  STAFF_MANAGE: "staff.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS);

/** Conservative default for administrators. Financial/refund/system rights
 *  must be granted explicitly by a super admin. */
export const DEFAULT_ADMIN_PERMISSIONS: string[] = [
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.APPLICATIONS_REVIEW,
  PERMISSIONS.POLICIES_MANAGE,
  PERMISSIONS.CLAIMS_REVIEW,
  PERMISSIONS.CLAIMS_DECIDE,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.BROKERS_MANAGE,
  PERMISSIONS.REPORTS_VIEW,
];

export type NormalizedRole = "super_admin" | "admin" | "customer" | "broker";

export type Viewer = {
  user: Doc<"users">;
  role: NormalizedRole;
  permissions: string[];
  suspended: boolean;
};

export function normalizeRole(role?: string | null): NormalizedRole {
  if (role === ROLES.SUPER_ADMIN) return "super_admin";
  if (role === ROLES.ADMIN) return "admin";
  if (role === ROLES.BROKER) return "broker";
  return "customer";
}

export async function getViewer(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const role = normalizeRole(user.role);
  const permissions =
    role === "super_admin"
      ? ALL_PERMISSIONS
      : role === "admin"
        ? (user.permissions ?? DEFAULT_ADMIN_PERMISSIONS)
        : role === "broker"
          ? ["broker.workspace"]
          : ["customer.self"];

  return {
    user,
    role,
    permissions,
    suspended: user.status === "suspended",
  };
}

export async function requireViewer(
  ctx: QueryCtx | MutationCtx,
  options: { allowSuspended?: boolean; message?: string } = {},
): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) {
    throw new Error(options.message ?? "Please sign in to continue.");
  }
  if (viewer.suspended && !options.allowSuspended) {
    throw new Error(
      "This account is suspended. Contact support if you believe this is a mistake.",
    );
  }
  return viewer;
}

export function isStaffRole(role: NormalizedRole) {
  return role === "admin" || role === "super_admin";
}

export function hasPermission(viewer: Viewer, permission: string) {
  return viewer.role === "super_admin" || viewer.permissions.includes(permission);
}

export async function requireStaff(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (!isStaffRole(viewer.role)) {
    throw new Error("This action is restricted to staff.");
  }
  return viewer;
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: string,
  message = "You do not have permission to perform this action.",
): Promise<Viewer> {
  const viewer = await requireStaff(ctx);
  if (!hasPermission(viewer, permission)) {
    throw new Error(message);
  }
  return viewer;
}

export async function requireCustomer(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "customer") {
    throw new Error("This action is only available to customer accounts.");
  }
  return viewer;
}

/** Brokers and customers both act on their own book of business. Staff never
 *  use customer-scoped mutations. */
export async function requireSelfServiceRole(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "customer" && viewer.role !== "broker") {
    throw new Error("This action is only available to customers and brokers.");
  }
  return viewer;
}
