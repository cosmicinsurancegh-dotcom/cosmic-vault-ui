export const STAFF_PERMISSIONS = {
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
  VAULT_MANAGE: "vault.manage",
  VAULT_SHIP: "vault.ship",
} as const;

export const PERMISSION_LABELS: Record<string, string> = {
  "customers.view": "View customers",
  "customers.manage": "Manage customers",
  "products.manage": "Manage products & pricing",
  "applications.review": "Review applications",
  "policies.manage": "Issue & service policies",
  "claims.review": "Review claims",
  "claims.decide": "Decide claims",
  "payments.view": "View payments",
  "payments.manage": "Confirm & reconcile payments",
  "refunds.approve": "Approve refunds",
  "brokers.manage": "Manage brokers",
  "reports.view": "Generate reports",
  "audit.view": "View audit log",
  "settings.manage": "Manage system settings",
  "staff.manage": "Manage staff & roles",
  "vault.manage": "Manage mineral records & insurance",
  "vault.ship": "Initiate & update shipments",
};

export function normalizeRole(role?: string | null) {
  if (role === "super_admin") return "super_admin" as const;
  if (role === "admin") return "admin" as const;
  if (role === "broker") return "broker" as const;
  return "customer" as const;
}

export function can(
  role: string | undefined,
  permissions: string[] | undefined,
  permission: string,
) {
  const normalized = normalizeRole(role);
  if (normalized === "super_admin") return true;
  if (normalized !== "admin") return false;
  return (permissions ?? []).includes(permission);
}

export function isStaff(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "super_admin";
}
