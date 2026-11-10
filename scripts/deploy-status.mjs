/**
 * Gate a release on the deployment Vercel actually started.
 *
 * Vercel builds `main` through its Git integration, not through this repo's
 * workflows, so nothing here used to notice when a build never happened: the
 * push lands, the commit status turns `failure`, and the live site is still the
 * previous deployment, which passes every smoke check happily.
 *
 * The one that bit us was the Hobby plan's author rule - it refuses to build a
 * commit whose author is not the owner of the Vercel project:
 *
 *   "Git author <login> must have access to the project on Vercel to create
 *    deployments."
 *
 * This reads the commit's status contexts, waits for the `Vercel – …` one to
 * leave `pending`, and writes what it found to the run summary, so the reason
 * is on the run page instead of only in the Vercel dashboard. A blocked or
 * failed build fails the job.
 *
 * A finished build is not yet a release. A preview deployment posts the same
 * `Deployment has completed` as a production one, so on 2026-11-10 every push
 * reported a finished deployment while https://cosmic-vault-ui.vercel.app kept
 * serving a build from 2026-11-01 - the shape a project takes when its
 * Production Branch is not the branch being pushed. The build stamps the commit
 * Vercel built beside the bundle (`vite.config.ts`, `release-commit.json`), so
 * this asks the domain which commit it serves before vouching for the release.
 *
 *   GITHUB_REPOSITORY=owner/repo GITHUB_SHA=$(git rev-parse HEAD) \
 *     bun run deploy:status
 *
 *   VERCEL_WAIT_SECONDS=600 bun run deploy:status   # wait for the build
 *
 * `GITHUB_TOKEN` is optional for a public repository; in Actions it comes from
 * `github.token` and needs the `statuses: read` permission.
 *
 * Exits 0 only when the deployment for this commit succeeded.
 */

import { appendFile } from "node:fs/promises";

const API = "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const REPO = process.env.GITHUB_REPOSITORY ?? "";
const SHA = process.env.GITHUB_SHA ?? "";
const WAIT_SECONDS = Number(process.env.VERCEL_WAIT_SECONDS ?? "0");
const RETRY_MS = 10_000;
const TIMEOUT_MS = 15_000;

/**
 * The domain this vouches for: the one people use. `SMOKE_BASE_URL` is honoured
 * too, so a run pointed at another origin checks that origin on both halves.
 */
const BASE_URL = (
  process.env.DEPLOY_BASE_URL ??
  process.env.SMOKE_BASE_URL ??
  "https://cosmic-vault-ui.vercel.app"
).replace(/\/+$/, "");
/** How long the domain may take to switch over once the build turns green. */
const SERVED_WAIT_SECONDS = Number(
  process.env.DEPLOY_SERVED_WAIT_SECONDS ?? "120",
);

/** Where the fix for a blocked build is written down. */
const HOSTING_RULE =
  "https://github.com/" +
  (REPO || "<repo>") +
  "/blob/main/README.md#which-commits-vercel-will-build";

/** A request that gives up instead of hanging a CI job. */
function request(path) {
  return fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cosmic-vault-deploy-status",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
}

/**
 * Which commit the domain stamped beside its bundle.
 *
 * The stamp is written by the build itself (`vite.config.ts`), so this answers
 * "what is being served" rather than "what did Vercel do". A domain still on an
 * older deployment answers with that deployment's commit - or, when that build
 * predates the stamp, with the SPA rewrite's `index.html`.
 */
async function servedCommit() {
  const response = await fetch(`${BASE_URL}/release-commit.json`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("json")) {
    throw new Error(
      `/release-commit.json answered ${response.status} ${type || "no content type"}`,
    );
  }
  const payload = await response.json().catch(() => null);
  const commit = payload?.commit;
  if (typeof commit !== "string" || commit === "") {
    throw new Error("/release-commit.json names no commit");
  }
  return commit;
}

/**
 * Waits for the domain to serve this commit, and says why it does not.
 *
 * The build turning green is when the switch starts, not when it is done, so
 * this retries for a bounded time. Everything it cannot prove fails: a domain
 * that will not say what it serves cannot vouch for the release.
 */
async function verifyServed() {
  const deadline = Date.now() + SERVED_WAIT_SECONDS * 1000;
  let served = null;
  let detail = "";

  for (;;) {
    try {
      served = await servedCommit();
      if (served.toLowerCase() === SHA.toLowerCase()) {
        console.log(
          `✓ served build      ${BASE_URL} serves ${SHA.slice(0, 7)}`,
        );
        return { ok: true, served, detail: "" };
      }
      detail =
        `${BASE_URL} serves ${served.slice(0, 7)}, not ${SHA.slice(0, 7)}: ` +
        "Vercel built this commit, but the domain is on another deployment. A " +
        'preview build posts the same "Deployment has completed" as a ' +
        "production one, so check the project's Production Branch " +
        "(Settings -> Git) and redeploy or promote this deployment.";
    } catch (error) {
      detail =
        `${BASE_URL} did not say which build it serves (${error instanceof Error ? error.message : String(error)}), so the release cannot be vouched for: ` +
        "a build that cannot see VERCEL_GIT_COMMIT_SHA stamps no commit, and a " +
        "domain on a build older than the stamp answers index.html here.";
    }

    if (Date.now() + RETRY_MS > deadline) return { ok: false, served, detail };

    console.log(
      `… ${BASE_URL} does not serve ${SHA.slice(0, 7)} yet (${Math.max(
        0,
        Math.round((deadline - Date.now()) / 1000),
      )}s left)`,
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}

/**
 * Every `Vercel – <project>` context on the commit, newest first. The combined
 * endpoint already collapses repeats, but sorting keeps this correct if Vercel
 * ever posts one context per environment.
 */
function vercelStatuses(statuses) {
  return statuses
    .filter((status) => (status.context ?? "").toLowerCase().startsWith("vercel"))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

async function readStatus() {
  // The list endpoint, not `/status`: that one keeps only the newest entry per
  // context, and Vercel posts the refusal as a second status on the same
  // context - the part worth reading.
  const response = await request(
    `/repos/${REPO}/commits/${SHA}/statuses?per_page=100`,
  );
  if (response.status === 404) return { missing: true, statuses: [] };
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} for ${SHA}`);
  }
  const payload = await response.json();
  return { missing: false, statuses: Array.isArray(payload) ? payload : [] };
}

/**
 * Why a build did not happen, in words a reader can act on. Vercel posts the
 * refusal in a second status (`Git author … must have access`), so every
 * description on the commit is checked, not only the generic "blocked" one.
 */
function explain(notes) {
  const text = notes.join(" ").toLowerCase();
  const lines = [];

  if (
    text.includes("must have access") ||
    text.includes("did not have contributing access")
  ) {
    lines.push(
      "Vercel refused the push because the commit author is not the owner of the",
      "Vercel project. On the Hobby plan there is a single member, so only commits",
      "authored by that account are built. Commit as the owner (this repo sets",
      "`user.email` to the owner's GitHub noreply address) and push again.",
      `See ${HOSTING_RULE}`,
    );
  } else if (text.includes("paused")) {
    lines.push(
      "The deployment is paused - check the project's usage and billing in Vercel.",
    );
  } else if (text.includes("cancel")) {
    lines.push("Vercel cancelled the build; push a new commit or redeploy from Vercel.");
  }

  return lines;
}

function report({ outcome, status, detail, notes = [], served = null }) {
  const state = status?.state ?? "missing";
  // A successful build needs no explanation; its notes are just "Vercel is
  // deploying your app" and "Deployment has completed". Neither does a stale
  // one: its news is what the domain serves, not what Vercel said.
  const relevant = outcome === "succeeded" || outcome === "stale" ? [] : notes;
  console.log(
    `${outcome === "succeeded" ? "✓" : "✗"} vercel build      ${state}${
      status?.description ? ` - ${status.description}` : ""
    }`,
  );
  if (status?.target_url) console.log(`  deployment        ${status.target_url}`);
  if (served) console.log(`  serving           ${served.slice(0, 7)}`);
  for (const note of relevant) {
    if (note !== status?.description) console.log(`  github says       ${note}`);
  }
  if (detail) console.log(`  ${detail}`);
  for (const line of explain(relevant)) console.log(`  ${line}`);

  const lines = [
    `## ${
      outcome === "succeeded"
        ? "Vercel deployment succeeded"
        : outcome === "blocked"
          ? "Vercel deployment was blocked"
          : outcome === "pending"
            ? "Vercel deployment did not finish"
            : outcome === "stale"
              ? "Vercel built the commit, but the domain serves another build"
              : "Vercel never started a deployment"
    }`,
    "",
    `- Commit: \`${SHA.slice(0, 7)}\``,
    `- Status: \`${state}\`${status?.description ? ` - ${status.description}` : ""}`,
  ];
  if (served) lines.push(`- Serving: \`${served.slice(0, 7)}\``);
  if (status?.target_url) lines.push(`- Deployment: ${status.target_url}`);
  for (const note of relevant) {
    if (note !== status?.description) lines.push(`- GitHub says: ${note}`);
  }
  if (detail) lines.push("", detail);

  const why = explain(relevant);
  if (why.length > 0) lines.push("", ...why);
  lines.push("");

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    return appendFile(summary, `${lines.join("\n")}\n`);
  }
  return Promise.resolve();
}

async function main() {
  if (!REPO || !SHA) {
    console.error(
      "Set GITHUB_REPOSITORY (owner/repo) and GITHUB_SHA (the commit that was deployed).",
    );
    process.exit(1);
  }

  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let latest = null;
  let notes = [];
  let missing = false;

  for (;;) {
    const result = await readStatus();
    missing = result.missing;
    const vercel = vercelStatuses(result.statuses);
    latest = vercel[0] ?? null;
    notes = [...new Set(vercel.map((status) => status.description).filter(Boolean))];

    if (latest && latest.state !== "pending") break;
    if (Date.now() + RETRY_MS > deadline) break;

    console.log(
      `… waiting for the Vercel build (${Math.max(
        0,
        Math.round((deadline - Date.now()) / 1000),
      )}s left)`,
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }

  if (!latest) {
    await report({
      outcome: "missing",
      status: null,
      detail: missing
        ? `GitHub has no statuses for ${SHA}; the commit may not be on the default branch.`
        : `No \`Vercel\` status context on ${SHA} after ${WAIT_SECONDS}s. The Git integration may be disconnected, or the deploy never started.`,
    });
    process.exit(1);
  }

  if (latest.state === "pending") {
    await report({
      outcome: "pending",
      status: latest,
      notes,
      detail: `Still building after ${WAIT_SECONDS}s. The live site is likely the previous deployment, so the smoke check cannot vouch for this commit.`,
    });
    process.exit(1);
  }

  if (latest.state !== "success") {
    await report({ outcome: "blocked", status: latest, notes });
    process.exit(1);
  }

  // The status proves Vercel built the commit. It does not prove the domain
  // serves it, which is the half that leaves a release silently behind.
  const served = await verifyServed();
  if (!served.ok) {
    await report({
      outcome: "stale",
      status: latest,
      served: served.served,
      detail: served.detail,
    });
    process.exit(1);
  }

  await report({
    outcome: "succeeded",
    status: latest,
    notes,
    served: served.served,
  });
  process.exit(0);
}

await main();
