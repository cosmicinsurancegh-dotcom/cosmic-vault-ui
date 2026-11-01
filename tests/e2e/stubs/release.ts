/**
 * What the E2E bundle says it was built against.
 *
 * The real build inlines this from the source (`scripts/release-expectation.mjs`
 * through `vite.config.ts`), so it changes with the code. The suite pins it to
 * a fixed pair instead: a scenario can then answer `setup:release` with a stamp
 * that matches, one that is missing a function, or one that changed a shape,
 * and check what the dashboard says - none of which should depend on which
 * functions the site happens to call today.
 */
export const E2E_RELEASE_EXPECTATION: Record<string, string> = {
  "tickets:queueSummary": "0f1e2d3c4b",
  "policies:list": "5a6b7c8d9e",
};
