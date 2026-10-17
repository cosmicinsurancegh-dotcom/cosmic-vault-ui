/**
 * Session state for the end-to-end stubs.
 *
 * This module is bundled into the app by `tests/e2e/vite.e2e.config.ts` (which
 * aliases `convex/react`, `@convex-dev/auth/react` and the generated api to the
 * files in this folder). Nothing here is imported by production code.
 *
 * A spec can start the browser already signed in by installing an init script:
 *
 *   await page.addInitScript(() => {
 *     window.__E2E_SESSION__ = { ... };
 *   });
 */
export type E2ESession = {
  _id: string;
  name: string;
  email: string;
  role: "customer" | "broker" | "admin" | "super_admin";
  permissions: string[];
};

declare global {
  interface Window {
    __E2E_SESSION__?: E2ESession | null;
  }
}

export const CUSTOMER_SESSION: E2ESession = {
  _id: "e2e-customer",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

export const ADMIN_SESSION: E2ESession = {
  _id: "e2e-admin",
  name: "Noor Vault",
  email: "noor@example.com",
  role: "super_admin",
  permissions: ["customers.view", "claims.review"],
};

export const VALID_CODE = "123456";

let session: E2ESession | null =
  typeof window === "undefined" ? null : (window.__E2E_SESSION__ ?? null);

const listeners = new Set<() => void>();

export function getSession(): E2ESession | null {
  return session;
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSession(next: E2ESession | null): void {
  session = next;
  for (const listener of listeners) listener();
}
