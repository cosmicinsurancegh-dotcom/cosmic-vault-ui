/**
 * The verdict on a release skew: does the deployment serve what this build
 * calls, with the shapes this build was made for?
 *
 * Plain JavaScript, shared by both places that ask the question:
 *
 *   - `src/lib/releaseSkew.ts`, which the published bundle uses to warn in the
 *     dashboard, and
 *   - `scripts/smoke-live.mjs`, which checks the published site from outside
 *     after a release without installing anything.
 *
 * It lives here rather than in the app because the smoke check runs with no
 * dependencies (`node scripts/smoke-live.mjs` on a bare runner), and one rule
 * with two callers is the point: the incident this guards against - the site
 * published about a minute ahead of `tickets.queueSummary` on 2026-10-30, every
 * staff dashboard load dying on a masked `Server Error` - was a disagreement
 * about what a build needs.
 *
 * `payload` is the `value` of a `setup:release` response: the signatures map,
 * or - on a deployment stamped before shapes were recorded - a bare list of
 * function names, which can still answer the name half.
 */

/**
 * @param {Record<string, string> | null | undefined} expected
 *   The functions the build calls, each with the digest of the argument and
 *   return validators it was compiled against.
 * @param {unknown} payload What the deployment says it serves.
 * @returns {{ state: "match", checked: number }
 *   | { state: "skew", missing: string[], changed: string[] }
 *   | { state: "unknown", detail: string }}
 */
export function compareRelease(expected, payload) {
  const required = expected ?? {};
  const wanted = Object.keys(required).sort();
  if (wanted.length === 0) {
    return {
      state: "unknown",
      detail: "This build did not record the functions it calls.",
    };
  }
  if (payload === null || typeof payload !== "object") {
    return {
      state: "unknown",
      detail: "The deployment did not answer with a release stamp.",
    };
  }

  /** A stamp parsed from JSON: a plain object whose values are all strings. */
  const isStringMap = (value) =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string");

  const body = /** @type {{ functions?: unknown, signatures?: unknown }} */ (
    payload
  );
  // Absent is a deployment stamped before shapes were recorded - it can still
  // answer by name. Present but unreadable is a stamp that cannot be trusted at
  // all, and reading half of it would be worse than saying nothing.
  if (
    body.signatures !== undefined &&
    body.signatures !== null &&
    !isStringMap(body.signatures)
  ) {
    return {
      state: "unknown",
      detail: "The deployment's release stamp is not a map of function shapes.",
    };
  }
  const signatures = isStringMap(body.signatures) ? body.signatures : null;
  const served = Array.isArray(body.functions)
    ? body.functions.filter((name) => typeof name === "string")
    : null;

  if (!signatures && !served) {
    return {
      state: "unknown",
      detail: "The deployment has not published the functions it serves.",
    };
  }

  const available = new Set(signatures ? Object.keys(signatures) : served ?? []);
  const missing = wanted.filter((name) => !available.has(name));
  // A name with no shape is a shape that cannot be checked, so a bare name list
  // reports what is missing and claims nothing about the rest.
  const changed = signatures
    ? wanted.filter(
        (name) => available.has(name) && signatures[name] !== required[name],
      )
    : [];

  if (missing.length === 0 && changed.length === 0) {
    return { state: "match", checked: wanted.length };
  }
  return { state: "skew", missing, changed };
}
