import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Vite config used only by the Playwright suite.
 *
 * It serves the real application, but swaps the Convex client, Convex Auth and
 * the generated api for the doubles in `tests/e2e/stubs`. That keeps the tests
 * deterministic (no deployment, no credentials, no network) while still
 * rendering and routing the actual pages.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));

const stub = (file: string) =>
  fileURLToPath(new URL(`./stubs/${file}`, import.meta.url));

export default defineConfig({
  root,
  /**
   * Keep Vite's dependency optimiser out of `node_modules/.vite`: the preview
   * dev server owns that folder, and this config resolves different modules
   * (Convex is aliased to the test doubles). Sharing the cache rewrote the
   * preview's optimiser metadata and left the running preview serving 504
   * "Outdated Optimize Dep" responses — a blank page.
   */
  cacheDir: fileURLToPath(new URL("../../node_modules/.vite-e2e", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // Most specific first: the generated api is reached through `@/` too.
      { find: /^@\/convex\/_generated\/api$/, replacement: stub("api.ts") },
      { find: /^convex\/react$/, replacement: stub("convex-react.tsx") },
      {
        find: /^@convex-dev\/auth\/react$/,
        replacement: stub("convex-auth-react.tsx"),
      },
      { find: /^@\//, replacement: `${root}src/` },
    ],
    // One React copy, same as the app config (duplicate copies break hooks).
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
    hmr: false,
  },
});
