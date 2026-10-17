import { defineConfig, devices } from "@playwright/test";

const PORT = 4174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Browser end-to-end suite: real Chromium, the real app and router, with
 * Convex swapped for the doubles in `tests/e2e/stubs` (see
 * `tests/e2e/vite.e2e.config.ts`). Nothing here talks to a deployment.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "bunx vite --config tests/e2e/vite.e2e.config.ts",
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // The client is stubbed, but main.tsx only mounts the router when a
      // Convex URL is configured, so give it a placeholder.
      VITE_CONVEX_URL: `${BASE_URL}/e2e-convex`,
    },
  },
});
