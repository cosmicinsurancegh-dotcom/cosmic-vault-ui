/**
 * The Convex deployment the browser talks to.
 *
 * `VITE_CONVEX_URL` is provided by the platform, but a wrong or missing value
 * is not harmless: a Convex client accepts any absolute URL, so a bad value
 * leaves every query, mutation and sign-in queued against a host that can never
 * answer. The symptom is a control that spins forever - the email-code button
 * sits on "Sending code" and no error is ever shown.
 *
 * A configured value is therefore used only when it really is a Convex
 * deployment. Anything else - a platform domain, a relative path, a typo - is
 * reported as a configuration error instead of being swapped for another host,
 * because guessing hides the mistake: the published build then queries a
 * deployment that serves no functions and every screen fails with an opaque
 * "Server Error".
 */

/**
 * This project's production Convex deployment, used when the environment
 * supplies no URL. The published site is built without a `VITE_CONVEX_URL` of
 * its own, so this is the backend it talks to; local work points at its own
 * deployment in `.env.local`.
 *
 * A reachable host is not a working backend: this deployment answered `/version`
 * while every function call failed, which the browser reports as an opaque
 * "Server Error". Publish the functions with the `Deploy Convex functions`
 * workflow (target `prod`) before treating the site as live.
 */
export const DEFAULT_CONVEX_URL = "https://descriptive-ferret-801.convex.cloud";

// Convex Cloud deployment URLs, plus the local dev server `convex dev` prints.
const DEPLOYMENT_URL =
  /^https?:\/\/([a-z0-9-]+\.)*(convex\.cloud|convex\.site)(\/|$)/i;
const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

/**
 * True when `value` is something a Convex client can actually connect to.
 * Extend `DEPLOYMENT_URL` if the deployment is ever served from a custom
 * domain.
 */
export function isConvexDeploymentUrl(
  value: string | undefined | null,
): boolean {
  const candidate = value?.trim();
  if (!candidate) return false;
  return DEPLOYMENT_URL.test(candidate) || LOCAL_URL.test(candidate);
}

/**
 * Resolves the Convex URL for the client: the configured value when it is a
 * Convex deployment, this project's production deployment when nothing is
 * configured, and `null` when the configured value is unusable. `null` renders
 * the configuration screen, which is the only honest answer - the app cannot
 * reach a backend it was never given.
 */
export function resolveConvexUrl(configured?: string | null): string | null {
  const candidate = configured?.trim();
  if (candidate) return isConvexDeploymentUrl(candidate) ? candidate : null;
  return DEFAULT_CONVEX_URL || null;
}
