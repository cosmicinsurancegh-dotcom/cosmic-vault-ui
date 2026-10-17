/**
 * Test double for `@/convex/_generated/api`.
 *
 * The real module is a `anyApi` proxy whose function references cannot be
 * inspected, so the stubs could not tell `users.currentUser` apart from a list
 * query. These references carry their own name instead, which lets
 * `tests/e2e/stubs/convex-react.tsx` return the signed-in user for
 * `currentUser` and `undefined` (the "loading" state every page already
 * handles) for everything else.
 */
export type E2ERef = { readonly __e2eQuery: string };

function tableProxy(table: string): Record<string, E2ERef> {
  return new Proxy({} as Record<string, E2ERef>, {
    get(_target, fn) {
      if (typeof fn !== "string") return undefined;
      return Object.freeze({ __e2eQuery: `${table}.${fn}` });
    },
  });
}

export const api = new Proxy({} as Record<string, Record<string, E2ERef>>, {
  get(_target, table) {
    if (typeof table !== "string") return undefined;
    return tableProxy(table);
  },
});

export const internal = api;

export const components = new Proxy({} as Record<string, unknown>, {
  get() {
    return () => ({});
  },
});
