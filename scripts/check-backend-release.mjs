#!/usr/bin/env node
/**
 * Refuses to publish the site when production does not serve the functions the
 * bundle calls.
 *
 * The failure this exists for: on 2026-10-30 a commit added
 * `tickets:queueSummary`, the site calling it was published about a minute
 * later, and the production deployment still ran the previous functions - every
 * staff dashboard load died on a masked `Server Error`. Site builds happen on
 * push; production functions are only published by a manual dispatch, so nothing
 * stopped the frontend from getting there first.
 *
 * The gate compares two lists of `<module>:<function>` names: what the site's
 * own source calls, and what the deployment says it serves. When something the
 * bundle needs is missing, the build fails and **names it** - "production does
 * not serve tickets:queueSummary" is a fix; a hash mismatch is an investigation.
 * It also means a convex change that adds no function the site calls (a comment,
 * an index, a helper) no longer holds back a release, which a whole-tree
 * fingerprint did.
 *
 * A name is not enough on its own. A commit can add an argument to a function
 * the site already calls and update the site to send it; the name matches, and
 * the published bundle still fails validation at runtime. So each function also
 * carries a digest of its argument and return validators
 * (`scripts/convex-signatures.mjs`), and a deployment that validates them
 * differently blocks the build by name too.
 *
 * Where the served list comes from: the `Deploy Convex functions` workflow reads
 * `convex function-spec` back from the deployment it just published, so the
 * stamp records what is actually running rather than what was meant to ship, and
 * stores it as `APP_FUNCTIONS`. `setup:release` returns it over the public HTTP
 * API (`src/convex/setup.ts`). That masked-error problem is why the list has to
 * be published rather than probed: "do you have that function?" is unanswerable
 * from outside, because a missing function and a throwing one look identical.
 *
 * The gate only runs for a Vercel production build (`VERCEL_ENV=production`). A
 * preview deploys a branch whose functions are by definition not in production
 * yet, so gating it would block every review.
 *
 * Usage:
 *   node scripts/check-backend-release.mjs               # gate a Vercel build
 *   node scripts/check-backend-release.mjs --production  # run the gate locally
 *   node scripts/check-backend-release.mjs --url <url>   # check another deployment
 *   node scripts/check-backend-release.mjs --served <spec.json>  # saved spec
 *
 * The script exits 0 when the build may publish, 1 when it may not.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { specSignatures, treeSignatures } from "./convex-signatures.mjs";

/**
 * Mirrors `DEFAULT_CONVEX_URL` in `src/lib/convexUrl.ts` - the deployment the
 * published bundle talks to, since Vercel builds without a `VITE_CONVEX_URL` of
 * its own. `tests/backendRelease.test.ts` fails if the two ever disagree, which
 * is what keeps this copy honest.
 */
export const DEFAULT_CONVEX_URL = "https://descriptive-ferret-801.convex.cloud";

/** The query that answers with the functions a deployment serves. */
export const RELEASE_QUERY = "setup:release";

/** Repository root, one level above this script's directory. */
const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const DEPLOYMENT_URL =
  /^https?:\/\/([a-z0-9-]+\.)*(convex\.cloud|convex\.site)(\/|$)/i;
const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

/** `api.tickets.queueSummary` and `internal.staff.list` in the site's source. */
const FUNCTION_REF = /\b(?:api|internal)\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;

/**
 * `api[module].fn` - the one shape the scan cannot resolve to a name. Reporting
 * it is the point: a build that cannot enumerate what it needs must not claim
 * the deployment serves it.
 */
const DYNAMIC_REF = /\b(?:api|internal)\s*\[/;

const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs)$/;
const NOT_SHIPPED = /\.(test|spec)\./;
const IGNORED_DIRECTORIES = new Set(["_generated", "node_modules"]);

/** How many names a failure spells out before summarising the rest. */
const MAX_NAMED = 12;

/**
 * The deployment this build's bundle will talk to, resolved the way the app
 * resolves it: a configured value only when it really is a deployment, and the
 * production deployment otherwise. `vite.config.ts` substitutes the same value
 * into a build given an unusable one.
 */
export function resolveDeploymentUrl(configured = process.env.VITE_CONVEX_URL) {
  const candidate = configured?.trim();
  if (candidate && (DEPLOYMENT_URL.test(candidate) || LOCAL_URL.test(candidate))) {
    return candidate.replace(/\/+$/, "");
  }
  return DEFAULT_CONVEX_URL;
}

/**
 * The source with its comments removed, so a reference written in prose - this
 * repository documents its own `api.x.y` calls in comments - is not mistaken for
 * a dependency the bundle has. Strings are left alone, including the `//` in a
 * URL: a `//` only starts a comment outside a quoted or template literal.
 */
export function stripComments(source) {
  let out = "";
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (quote) {
      out += character;
      if (character === "\\") {
        out += next ?? "";
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      out += character;
      continue;
    }
    if (character === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    out += character;
  }
  return out;
}

/** Every file Vite ships: `src`, minus the backend, codegen and tests. */
async function siteFiles(root) {
  const srcDirectory = path.join(root, "src");
  const convexDirectory = path.join(srcDirectory, "convex");
  const found = [];
  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name) || absolute === convexDirectory) {
          continue;
        }
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SOURCE_FILE.test(entry.name) || NOT_SHIPPED.test(entry.name)) continue;
      found.push(absolute);
    }
  };
  await walk(srcDirectory);
  return found.sort();
}

/**
 * The `<module>:<function>` names the site's source calls, and the files that
 * index the api object instead of naming a function.
 */
export async function siteFunctionRefs(root = DEFAULT_ROOT) {
  const refs = new Set();
  const dynamic = [];
  for (const file of await siteFiles(root)) {
    const source = stripComments(await readFile(file, "utf8"));
    for (const match of source.matchAll(FUNCTION_REF)) {
      refs.add(`${match[1]}:${match[2]}`);
    }
    if (DYNAMIC_REF.test(source)) dynamic.push(path.relative(root, file));
  }
  return { refs: [...refs].sort(), dynamic: dynamic.sort() };
}

/** Joins names for a log line, keeping a long list readable. */
function nameList(names) {
  if (names.length <= MAX_NAMED) return names.join(", ");
  const shown = names.slice(0, MAX_NAMED).join(", ");
  return `${shown} and ${names.length - MAX_NAMED} more`;
}

/**
 * The verdict, separated from the network call so it can be tested without a
 * deployment. `served` is `null` when the deployment has never published its
 * function list, which counts as behind: an unstamped deployment cannot be
 * shown to serve this build, and assuming it does is how the site got ahead.
 */
export function decide({
  environment,
  required,
  served,
  signatures,
  expected,
  dynamic = [],
}) {
  if (environment !== "production") {
    return {
      ok: true,
      missing: [],
      detail: `Not a production build (VERCEL_ENV=${environment || "unset"}); the release gate is off.`,
    };
  }
  if (dynamic.length > 0) {
    return {
      ok: false,
      missing: [],
      detail: `The site indexes the api object dynamically (${nameList(dynamic)}), so the functions it calls cannot be listed - and a build that cannot list them cannot check them.`,
    };
  }
  if (!Array.isArray(served)) {
    return {
      ok: false,
      missing: [],
      detail:
        "The production deployment has not published the functions it serves, so it cannot be shown to serve this build.",
    };
  }
  if (required.length === 0) {
    return {
      ok: false,
      missing: [],
      detail:
        "No api references were found in the site's source, so there is nothing to check - which means the scan is looking in the wrong place.",
    };
  }
  const available = new Set(served);
  const missing = required.filter((name) => !available.has(name)).sort();
  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      changed: [],
      detail: `The production deployment does not serve ${missing.length} function${missing.length === 1 ? "" : "s"} this build calls: ${nameList(missing)}.`,
    };
  }

  const unknown = required.filter((name) => expected?.[name] === undefined).sort();
  if (unknown.length > 0) {
    return {
      ok: false,
      missing: [],
      changed: [],
      detail: `This build's own signatures could not be read for ${nameList(unknown)}, so whether production matches them cannot be checked.`,
    };
  }

  if (!signatures || typeof signatures !== "object") {
    return {
      ok: false,
      missing: [],
      changed: [],
      detail:
        "The production deployment has not published what its functions validate, so it cannot be shown to match this build's calls.",
    };
  }

  const changed = required
    .filter((name) => signatures[name] !== expected[name])
    .sort();
  if (changed.length > 0) {
    return {
      ok: false,
      missing: [],
      changed,
      detail: `The production deployment validates ${changed.length} function${changed.length === 1 ? "" : "s"} this build calls differently: ${nameList(changed)}. An argument or return value changed since the functions were published.`,
    };
  }

  return {
    ok: true,
    missing: [],
    changed: [],
    detail: `The production deployment serves all ${required.length} functions this build calls, with matching argument and return shapes.`,
  };
}

/**
 * What the deployment says it serves, over the credential-free HTTP API. A
 * failed probe throws rather than returning an empty list: "could not ask" must
 * never be reported as "nothing is there".
 */
export async function readRelease(url) {
  const response = await fetch(`${url}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: RELEASE_QUERY, args: {}, format: "json" }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}.`);
  }
  const body = await response.json();
  if (body?.status !== "success") {
    throw new Error(
      `${url} did not answer ${RELEASE_QUERY} (${body?.errorMessage ?? "no error message"}).`,
    );
  }
  const functions = body.value?.functions ?? null;
  if (
    functions !== null &&
    (!Array.isArray(functions) || functions.some((name) => typeof name !== "string"))
  ) {
    throw new Error(
      `${url} answered ${RELEASE_QUERY} with something that is not a function list.`,
    );
  }
  const signatures = body.value?.signatures ?? null;
  if (
    signatures !== null &&
    (typeof signatures !== "object" ||
      Array.isArray(signatures) ||
      Object.values(signatures).some((digest) => typeof digest !== "string"))
  ) {
    throw new Error(
      `${url} answered ${RELEASE_QUERY} with something that is not a signature stamp.`,
    );
  }
  return { functions, signatures };
}

/**
 * A saved `convex function-spec` document, read the way the deploy workflow
 * reads it: the same digest of the same validators, without a deployment.
 */
async function readServedFile(file) {
  const stamp = specSignatures(JSON.parse(await readFile(file, "utf8")));
  return { functions: Object.keys(stamp), signatures: stamp };
}

function flag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const HOW_TO_RELEASE =
  "Publish the functions first: run `Deploy Convex functions` from main with target=prod and confirm=deploy-prod, then rebuild the site (the workflow triggers Vercel's deploy hook when VERCEL_DEPLOY_HOOK_URL is set).";

async function main() {
  const requested = process.argv.includes("--production")
    ? "production"
    : (process.env.VERCEL_ENV ?? "development");
  if (requested !== "production") {
    console.log(
      `[release] Not a production build (VERCEL_ENV=${process.env.VERCEL_ENV || "unset"}); skipping the release gate.`,
    );
    return 0;
  }

  const url = flag("--url") ?? resolveDeploymentUrl();
  const { refs, dynamic } = await siteFunctionRefs();

  let expected;
  try {
    expected = await treeSignatures();
  } catch (error) {
    console.error(
      `[release] Cannot read this build's function signatures: ${error instanceof Error ? error.message : error}`,
    );
    console.error(
      "[release] Every module under src/convex has to load for its arguments and return values to be compared. Fix the module that failed, or the dependency it is missing, and rebuild.",
    );
    return 1;
  }

  let release;
  const servedFile = flag("--served");
  if (servedFile) {
    release = await readServedFile(servedFile);
  } else {
    try {
      release = await readRelease(url);
    } catch (error) {
      console.error(
        `[release] Cannot ask ${url} which functions it serves: ${error instanceof Error ? error.message : error}`,
      );
      console.error(`[release] ${HOW_TO_RELEASE}`);
      return 1;
    }
  }

  const verdict = decide({
    environment: requested,
    required: refs,
    served: release.functions,
    signatures: release.signatures,
    expected,
    dynamic,
  });
  if (verdict.ok) {
    console.log(`[release] ${verdict.detail}`);
    return 0;
  }
  console.error(`[release] Refusing to publish the site: ${verdict.detail}`);
  console.error(`[release] ${HOW_TO_RELEASE}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[release] ${error instanceof Error ? error.stack : error}`);
      process.exitCode = 1;
    });
}
