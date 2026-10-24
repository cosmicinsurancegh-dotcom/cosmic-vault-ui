/**
 * Test double for `convex/react` (aliased in the E2E Vite config).
 *
 * The browser suite exercises routing and UI flows only, so no socket is
 * opened and no deployment or credentials are required. Queries return
 * `undefined` - the same "still loading" state the real client reports before
 * the first response - while `users.currentUser` returns the stubbed session
 * so `useAuth()` can resolve.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { E2ERef } from "./api";
import { getSession, subscribeToSession } from "./session";

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
  if (reference?.__e2eQuery === "users.currentUser") return session;
  // A spec can supply canned data for the screens it opens; everything else
  // stays in the loading state the real client reports before its first reply.
  const fixtures =
    typeof window === "undefined" ? null : (window.__E2E_FIXTURES__ ?? null);
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
 */
export function useMutation(reference?: E2ERef) {
  return useMemo(() => {
    return async (args?: unknown) => {
      if (typeof window !== "undefined" && reference) {
        (window.__E2E_MUTATIONS__ ??= []).push({
          ref: reference.__e2eQuery,
          args,
        });
      }
      return { notified: true, isNewAccount: false };
    };
  }, [reference]);
}

const noop = async () => undefined;

export function useAction() {
  return useMemo(() => noop, []);
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
