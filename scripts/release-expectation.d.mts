/** Types for `scripts/release-expectation.mjs`, so `vite.config.ts` can import it. */
export function releaseExpectation(root?: string): Promise<{
  called: Record<string, string>;
  dynamic: string[];
}>;
