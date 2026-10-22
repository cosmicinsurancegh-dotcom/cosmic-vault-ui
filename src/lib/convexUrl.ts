/**
 * The Convex deployment the browser talks to.
 *
 * `VITE_CONVEX_URL` is provided by the platform, but a wrong or missing value
 * is not harmless: a Convex client accepts any absolute URL, so a bad value
 * leaves every query, mutation and sign-in queued against a host that can never
 * answer. The symptom is a control that spins forever - the email-code button
 * sits on "Sending code" and no error is ever shown.
 *
 * Only a real Convex deployment URL is usable, so anything else falls back to
 * this project's deployment instead of shipping a dead app.
 */

/** This project's Convex deployment, used when the configured URL is unusable. */
export const DEFAULT_CONVEX_URL = "https://avid-camel-675.convex.cloud";

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
 * Convex deployment, otherwise `DEFAULT_CONVEX_URL`. Returns `null` only if
 * both are unusable, which is the case `MissingConvexConfig` reports.
 */
export function resolveConvexUrl(configured?: string | null): string | null {
  const candidate = configured?.trim();
  if (candidate && isConvexDeploymentUrl(candidate)) return candidate;
  return DEFAULT_CONVEX_URL || null;
}
