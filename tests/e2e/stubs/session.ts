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
    /**
     * Canned query results, keyed by the reference name (`table.fn`). A spec
     * opts in per test, so the default "still loading" behaviour stays intact
     * for every other screen. The stub reads this once into its own store, so a
     * write can replace an entry without a reload - see `getFixtures`.
     */
    __E2E_FIXTURES__?: Record<string, unknown> | null;
    /**
     * Every query reference the app has subscribed to since the page loaded,
     * in the order it first asked for each one. A spec uses this to prove a
     * screen does (or does not) request data in a given state, which the
     * "loading" return value alone cannot show.
     */
    __E2E_QUERY_CALLS__?: string[];
    /**
     * Every mutation the app has called since the page loaded, with the
     * reference name and arguments. Mutations are otherwise no-ops, so a spec
     * uses this to prove the screen sent the right request.
     */
    __E2E_MUTATIONS__?: { ref: string; args: unknown }[];
    /**
     * Every action the app has called since the page loaded. Actions are
     * otherwise no-ops unless the spec supplies a fixture result for one, so a
     * spec uses this to prove the screen asked for the right thing.
     */
    __E2E_ACTIONS__?: { ref: string; args: unknown }[];
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

/**
 * Address whose sign-in request never answers, mirroring a deployment that is
 * unreachable while the Convex client queues the call. Used to prove the app
 * fails fast instead of spinning on "Sending code" forever.
 */
export const STALL_EMAIL = "stall@example.com";

/** The only password the stub accepts for `signIn("password", ...)`. */
export const TEST_PASSWORD = "correct horse battery";

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

/**
 * Canned query results, as a store rather than a constant.
 *
 * The page seeds `window.__E2E_FIXTURES__` from an init script, so that is the
 * starting value; `tests/e2e/stubs/writes.ts` then replaces entries as the
 * screen mutates them. Queries subscribe here, which is what lets a dialog show
 * the record it just changed instead of waiting for a reload. `null` and
 * `undefined` stay distinct on purpose: `undefined` means "not read yet".
 */
let fixtures: Record<string, unknown> | null | undefined;
const fixtureListeners = new Set<() => void>();

export function getFixtures(): Record<string, unknown> | null {
  if (fixtures === undefined) {
    fixtures =
      typeof window === "undefined" ? null : (window.__E2E_FIXTURES__ ?? null);
  }
  return fixtures;
}

export function subscribeToFixtures(listener: () => void): () => void {
  fixtureListeners.add(listener);
  return () => {
    fixtureListeners.delete(listener);
  };
}

/** Replaces the whole map; callers build a new object so subscribers see a
 *  new snapshot reference and re-render. */
export function setFixtures(next: Record<string, unknown> | null): void {
  fixtures = next;
  for (const listener of fixtureListeners) listener();
}
