import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import { releaseExpectation } from "./scripts/release-expectation.mjs";
import { DEFAULT_CONVEX_URL, isConvexDeploymentUrl } from "./src/lib/convexUrl";

/**
 * Vercel supplies `VITE_CONVEX_URL` itself, and a value that is not a Convex
 * deployment - the site's own origin, say - makes the client refuse to connect
 * and render the configuration screen: a reachable site with no working
 * dashboard. Substituting this project's deployment here keeps the published
 * build usable and leaves the mistake in the build log, while a corrected
 * environment variable always wins. The app's own check is unchanged.
 */
const configuredConvexUrl = process.env.VITE_CONVEX_URL;
if (configuredConvexUrl && !isConvexDeploymentUrl(configuredConvexUrl)) {
  console.warn(
    `[vite] VITE_CONVEX_URL="${configuredConvexUrl}" is not a Convex deployment; building against ${DEFAULT_CONVEX_URL}.`,
  );
  process.env.VITE_CONVEX_URL = DEFAULT_CONVEX_URL;
}

/**
 * The functions this bundle calls, each with the digest of the argument and
 * return validators it was compiled against, inlined so the dashboard can tell
 * a deployment that is behind from one that is not (`src/lib/releaseSkew.ts`).
 *
 * The capture is the one the publish gate reads, so what the banner expects and
 * what the gate required are the same list. A capture that fails does not fail
 * the build: a production build already refuses to publish when it cannot
 * capture this, and a bundle that cannot say what it expects should say nothing
 * rather than guess.
 */
async function captureReleaseExpectation(): Promise<string> {
  try {
    const { called, dynamic } = await releaseExpectation();
    if (dynamic.length > 0) {
      console.warn(
        `[vite] The site indexes the api object in ${dynamic.join(", ")}, so the dashboard's release check covers only the functions it names.`,
      );
    }
    return JSON.stringify(called);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(
      `[vite] Could not capture the functions this build calls (${detail}); the dashboard will not report a release skew.`,
    );
    return "null";
  }
}

/**
 * The same capture, as a file beside the bundle.
 *
 * The dashboard needs it compiled in - it describes the bundle that is running,
 * before any request. `scripts/smoke-live.mjs` needs it as something it can
 * fetch from the published site, because it runs after the release and has to
 * describe the bytes being served rather than this checkout. One capture from
 * one build feeds both, so the verdict in the dashboard and the verdict in CI
 * cannot be about two different lists.
 */
function releaseManifest(expectation: string): Plugin {
  return {
    name: "release-manifest",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "release.json",
        source: `${expectation}\n`,
      });
    },
  };
}

/**
 * The commit this bundle was built from, written beside the bundle.
 *
 * `scripts/deploy-status.mjs` has to answer a question the commit's Vercel
 * status cannot: is the production domain serving the build Vercel made for
 * this commit? A preview deployment posts the same "Deployment has completed"
 * as a production one, so on 2026-11-10 every push reported a finished
 * deployment while the domain kept serving a build from 2026-11-01. Stamping
 * the commit Vercel built lets that check ask the domain rather than a status
 * that cannot tell the two apart.
 *
 * No stamp is written when the build cannot see the commit
 * (`VERCEL_GIT_COMMIT_SHA`): the field stays `null`, because a guessed stamp
 * would vouch for bytes it does not describe.
 */
function buildStamp(): Plugin {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  return {
    name: "build-stamp",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "release-commit.json",
        source: `${JSON.stringify({ commit })}\n`,
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async (): Promise<UserConfig> => {
  const expectation = await captureReleaseExpectation();
  return {
    define: {
      "import.meta.env.VITE_RELEASE_EXPECTATION": expectation,
    },
    plugins: [
      react(),
      vlyPlugin(),
      tailwindcss(),
      releaseManifest(expectation),
      buildStamp(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      // Force a single copy of React across all packages (including vlyPlugin).
      // Without this, @vly-ai/integrations can resolve its own React copy, which
      // triggers "Invalid hook call" errors at runtime.
      dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
    },
    build: {
      // Enable source maps for better debugging (disable in production if needed)
      sourcemap: false,
      // Optimize chunk splitting
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching and lazy loading
          manualChunks: {
            // Vendor chunks for large libraries
            "react-vendor": ["react", "react-dom", "react-router"],
            // Large UI library chunks
            "radix-ui": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-collapsible",
              "@radix-ui/react-context-menu",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-hover-card",
              "@radix-ui/react-label",
              "@radix-ui/react-menubar",
              "@radix-ui/react-navigation-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
            ],
            // Heavy optional libraries - separate chunks for better lazy loading
            "framer-motion": ["framer-motion"],
            charts: ["recharts"],
            forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          },
          // Optimize chunk size
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
      // Increase chunk size warning limit for better chunking
      chunkSizeWarningLimit: 1000,
      // Target modern browsers for better optimization
      target: "esnext",
      // Minify options - using esbuild (faster than terser)
      minify: "esbuild",
    },
    // Optimize dependencies
    optimizeDeps: {
      // Only scan the app entry HTML; avoids crawling unrelated *.html files
      // if a legacy snapshot accidentally contains leaked package folders.
      entries: ["index.html"],
      include: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-dom/client",
        "react-router",
        "@convex-dev/auth/react",
        "framer-motion",
        // vlyPlugin() injects this import at serve time, so the dep scanner
        // never sees it. Without it here the first page load discovers it,
        // re-optimizes and full-reloads the preview mid-screenshot.
        "@vly-ai/integrations",
      ],
    },
    // Performance hints
    server: {
      allowedHosts: true,
      // Bind to all interfaces so the browser runtime's server-ready event fires.
      host: true,
      port: 5173,
      // Keep HMR on, but disable full-screen error overlay
      hmr: {
        overlay: false,
      },
    },
  };
});
