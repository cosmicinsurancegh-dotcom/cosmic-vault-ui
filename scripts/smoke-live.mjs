/**
 * Post-deploy smoke check for the published site.
 *
 * Every check here exists because the failure it describes reached production:
 *
 *   - the published bundle was pointed at a backend that is not this app's
 *     deployment (Vercel had `VITE_CONVEX_URL` set to the site's own origin),
 *   - the deployment answered HTTP and `/version` but ran no function, so every
 *     screen failed with a bare "Server Error",
 *   - a missing `/assets/*` file was answered with `index.html`, so the browser
 *     refused it as a module and a stale tab pinned that HTML in its cache.
 *
 * It needs no dependencies: Node's built-in `fetch` is enough, so CI runs it
 * straight after a release without installing anything.
 *
 *   bun run smoke:live                 # check production once
 *   SMOKE_WAIT_SECONDS=600 bun run smoke:live   # wait for a deploy to land
 *   SMOKE_BASE_URL=http://localhost:4173 bun run smoke:live
 *
 * Exits 0 only when every check passes.
 */

import { readFile } from "node:fs/promises";

const BASE_URL = (
  process.env.SMOKE_BASE_URL ?? "https://cosmic-vault-ui.vercel.app"
).replace(/\/+$/, "");
const WAIT_SECONDS = Number(process.env.SMOKE_WAIT_SECONDS ?? "0");
const RETRY_MS = 15_000;
const TIMEOUT_MS = 15_000;

/**
 * Values that mean the build went wrong, even though the site renders: the
 * site's own origin inlined as a deployment URL, and the development
 * deployment, which serves different data.
 */
const WRONG_VALUES = ['"https://freebuff.com"', "avid-camel-675.convex.cloud"];

/** The deployment the bundle must target: whatever the app itself defaults to. */
async function expectedConvexUrl() {
  const configured = process.env.SMOKE_CONVEX_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const source = await readFile(
    new URL("../src/lib/convexUrl.ts", import.meta.url),
    "utf8",
  );
  const match = source.match(/DEFAULT_CONVEX_URL\s*=\s*"(https:[^"]+)"/);
  if (!match) {
    throw new Error(
      "could not read DEFAULT_CONVEX_URL from src/lib/convexUrl.ts",
    );
  }
  return match[1].replace(/\/+$/, "");
}

/** A request that gives up instead of hanging a CI job. */
function request(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function collect(convexUrl) {
  const results = [];
  const record = (name, detail) => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  /** The entry script the served HTML asks the browser to run. */
  let entry = null;

  try {
    const response = await request(`${BASE_URL}/`);
    const html = await response.text();
    entry = html.match(/assets\/index-[A-Za-z0-9._-]+\.js/)?.[0] ?? null;
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("text/html") || !entry) {
      fail(
        "site served",
        `${response.status} ${type || "no content type"}, entry script ${entry ?? "missing"}`,
      );
    } else {
      record("site served", `200 ${type} · ${entry}`);
    }
  } catch (error) {
    fail("site served", error instanceof Error ? error.message : String(error));
  }

  if (!entry) {
    fail(
      "bundle target",
      "site not served, so there is no entry script to check",
    );
  } else {
    try {
      const response = await request(`${BASE_URL}/${entry}`);
      const bundle = await response.text();
      const inlined = [
        ...new Set(
          [
            ...bundle.matchAll(
              /"(https:\/\/[a-z0-9.-]*\.convex\.(?:cloud|site))"/gi,
            ),
          ].map((match) => match[1]),
        ),
      ];
      const wrong = WRONG_VALUES.filter((value) => bundle.includes(value));

      if (!response.ok) {
        fail("bundle target", `${entry} answered ${response.status}`);
      } else if (wrong.length > 0) {
        fail("bundle target", `bundle contains ${wrong.join(", ")}`);
      } else if (!inlined.includes(convexUrl)) {
        fail(
          "bundle target",
          `bundle does not mention ${convexUrl}; found ${inlined.join(", ") || "no deployment URL"}`,
        );
      } else {
        record("bundle target", convexUrl);
      }
    } catch (error) {
      fail(
        "bundle target",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  try {
    const response = await request(`${convexUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "setup:health", args: {}, format: "json" }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      fail(
        "functions running",
        `${convexUrl} answered HTTP ${response.status}`,
      );
    } else if (payload?.status === "success" && payload?.value?.ok === true) {
      record("functions running", "setup:health answered");
    } else {
      fail(
        "functions running",
        `setup:health answered ${JSON.stringify(payload)}`,
      );
    }
  } catch (error) {
    fail(
      "functions running",
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const missing = `${BASE_URL}/assets/smoke-${Date.now().toString(36)}.js`;
    const response = await request(missing);
    const type = response.headers.get("content-type") ?? "";
    // The SPA rewrite must not swallow asset paths: an HTML answer here is what
    // produced "'text/html' is not a valid JavaScript MIME type".
    if (response.status === 404 && !type.includes("text/html")) {
      record("missing asset", `404 ${type || "no content type"}`);
    } else {
      fail(
        "missing asset",
        `answered ${response.status} ${type || "no content type"}`,
      );
    }
  } catch (error) {
    fail(
      "missing asset",
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const response = await request(`${BASE_URL}/dashboard`);
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.includes("text/html")) {
      record("app route", `200 ${type}`);
    } else {
      fail(
        "app route",
        `/dashboard answered ${response.status} ${type || "no content type"}`,
      );
    }
  } catch (error) {
    fail("app route", error instanceof Error ? error.message : String(error));
  }

  return results;
}

function report(results) {
  for (const { name, ok, detail } of results) {
    console.log(`${ok ? "✓" : "✗"} ${name.padEnd(17)} ${detail}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(
    failed === 0
      ? `\nAll ${results.length} checks passed against ${BASE_URL}`
      : `\n${failed} of ${results.length} checks failed against ${BASE_URL}`,
  );
  return failed === 0;
}

const convexUrl = await expectedConvexUrl();
const deadline = Date.now() + WAIT_SECONDS * 1000;

for (;;) {
  const results = await collect(convexUrl);
  const passed = results.every((result) => result.ok);

  if (passed || Date.now() + RETRY_MS > deadline) {
    process.exit(report(results) ? 0 : 1);
  }

  console.log(
    `… not healthy yet, retrying in ${Math.round(RETRY_MS / 1000)}s (${Math.max(
      0,
      Math.round((deadline - Date.now()) / 1000),
    )}s left)`,
  );
  await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
}
