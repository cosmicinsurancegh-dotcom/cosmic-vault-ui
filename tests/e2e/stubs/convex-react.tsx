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

export function useQuery(reference: E2ERef | undefined) {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSession,
    getSession,
  );
  if (reference?.__e2eQuery === "users.currentUser") return session;
  return undefined;
}

const noop = async () => undefined;

export function useMutation() {
  return useMemo(() => noop, []);
}

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
