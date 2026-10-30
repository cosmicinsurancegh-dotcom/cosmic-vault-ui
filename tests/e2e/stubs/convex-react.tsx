/**
 * Test double for `convex/react` (aliased in the E2E Vite config).
 *
 * The browser suite exercises routing and UI flows only, so no socket is
 * opened and no deployment or credentials are required. Queries return
 * `undefined` - the same "still loading" state the real client reports before
 * the first response - while `users.currentUser` returns the stubbed session
 * so `useAuth()` can resolve.
 *
 * Canned results live in a store rather than a constant, and a mutation replays
 * its own write into it (`./writes`). A screen that changes a record and then
 * reads it back therefore sees the change without the page reloading, which is
 * the only way to assert what a dialog shows after a successful write.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { E2ERef } from "./api";
import {
  getFixtures,
  getSession,
  subscribeToFixtures,
  subscribeToSession,
} from "./session";
import { applyMutation } from "./writes";

export class ConvexReactClient {
  constructor(public readonly address: string) {}

  close(): void {}

  clearAuth(): void {}
}

export function ConvexProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useConvexAuth() {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSession,
    getSession,
  );
  return { isLoading: false, isAuthenticated: session !== null };
}

/**
 * Records the reference so a spec can see what a screen actually asked for. A
 * `"skip"` argument means no request is made (the real client does not
 * subscribe either), so the reference is not recorded for that state.
 */
function recordQuery(reference: E2ERef | undefined, args: unknown) {
  if (typeof window === "undefined" || !reference) return;
  if (args === "skip") return;
  const calls = (window.__E2E_QUERY_CALLS__ ??= []);
  if (!calls.includes(reference.__e2eQuery)) {
    calls.push(reference.__e2eQuery);
  }
}

export function useQuery(reference: E2ERef | undefined, args?: unknown) {
  recordQuery(reference, args);
  const session = useSyncExternalStore(
    subscribeToSession,
    getSession,
    getSession,
  );
  // Subscribing to the fixtures, not just reading them, is what lets a write
  // replace an entry and re-render the screens that read it.
  const fixtures = useSyncExternalStore(
    subscribeToFixtures,
    getFixtures,
    getFixtures,
  );
  if (reference?.__e2eQuery === "users.currentUser") return session;
  // A spec can supply canned data for the screens it opens; everything else
  // stays in the loading state the real client reports before its first reply.
  if (fixtures && reference && reference.__e2eQuery in fixtures) {
    return fixtures[reference.__e2eQuery];
  }
  return undefined;
}

/**
 * Records the call and answers with a success envelope. Specs assert on
 * `window.__E2E_MUTATIONS__` to prove a screen sent the right arguments; the
 * real write path is covered by the Convex unit tests. `notified` and
 * `isNewAccount` are read by the mineral assignment flows.
 *
 * A spec that needs the screen to render a specific result supplies a fixture
 * for that mutation (`"tickets.create": { ticketId, reference }`), the same way
 * `useAction` does; the envelope above remains the default.
 *
 * The write is then replayed into the fixture store (`./writes`), so a screen
 * that reads the record back sees what it just changed. The canned answer is
 * captured first, because that write can replace the entry it came from.
 *
 * A fixture holding `failWith` makes the mutation reject with that message
 * instead, and nothing is written - the shape a screen's catch block sees when
 * the server refuses. The attempt is still recorded in `__E2E_MUTATIONS__`.
 */
const FAILURE_KEY = "failWith";

/** The message a fixture asks this mutation to reject with, if any. */
function refusalOf(fixture: unknown): string | null {
  if (!fixture || typeof fixture !== "object") return null;
  const message = (fixture as Record<string, unknown>)[FAILURE_KEY];
  return typeof message === "string" ? message : null;
}

export function useMutation(reference?: E2ERef) {
  return useMemo(() => {
    return async (args?: unknown) => {
      if (typeof window === "undefined" || !reference) {
        return { notified: true, isNewAccount: false };
      }
      (window.__E2E_MUTATIONS__ ??= []).push({
        ref: reference.__e2eQuery,
        args,
      });
      const fixtures = getFixtures();
      const canned =
        fixtures && reference.__e2eQuery in fixtures
          ? fixtures[reference.__e2eQuery]
          : undefined;
      const refusal = refusalOf(canned);
      // A refused write leaves every fixture exactly as it was.
      if (refusal) throw new Error(refusal);
      applyMutation(reference.__e2eQuery, args);
      return canned ?? { notified: true, isNewAccount: false };
    };
  }, [reference]);
}

/**
 * Records the call and answers with the spec's fixture result for that action
 * (`"email.sendTest": { ... }`), or `undefined` - which is what a real action
 * that returns nothing reports. The action's own behaviour is covered by
 * convex-test; a spec only needs the answer the screen shows back.
 */
export function useAction(reference?: E2ERef) {
  return useMemo(() => {
    return async (args?: unknown) => {
      if (typeof window === "undefined" || !reference) return undefined;
      (window.__E2E_ACTIONS__ ??= []).push({
        ref: reference.__e2eQuery,
        args,
      });
      const fixtures = getFixtures();
      if (fixtures && reference.__e2eQuery in fixtures) {
        return fixtures[reference.__e2eQuery];
      }
      return undefined;
    };
  }, [reference]);
}

export function useConvex() {
  return useMemo(
    () => ({
      query: async () => null,
      mutation: async () => null,
      action: async () => null,
    }),
    [],
  );
}

/** Some screens read `useConvex().query`; keep the hook signature intact. */
export function usePaginatedQuery() {
  const loadMore = useCallback(async () => undefined, []);
  return { results: [], status: "Exhausted", isLoading: false, loadMore };
}
