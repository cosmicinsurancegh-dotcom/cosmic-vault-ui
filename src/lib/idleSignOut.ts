/**
 * Idle sign-out.
 *
 * A vault session left open on a shared or unattended machine should not stay
 * signed in indefinitely, so the dashboard closes it after a stretch with no
 * input. The deadline and the clock check live here, away from React, so the
 * rule can be tested without a browser.
 */

/** How long the dashboard waits with no input before closing the session. */
export const IDLE_SIGN_OUT_MS = 30 * 60_000;

/**
 * Activity is recorded at most this often: a mousemove fires far more often
 * than the session needs to know, and the timer only checks the clock every
 * `IDLE_CHECK_INTERVAL_MS` anyway.
 */
export const ACTIVITY_THROTTLE_MS = 5_000;

/** How often the mounted hook compares the clock with the last activity. */
export const IDLE_CHECK_INTERVAL_MS = 30_000;

/**
 * True when `now` is at least `timeoutMs` past `lastActivity`. A clock that
 * moved backwards (a laptop waking from sleep, an NTP correction) reports
 * "active" rather than ending the session on bad arithmetic.
 */
export function isIdle(
  lastActivity: number,
  now: number = Date.now(),
  timeoutMs: number = IDLE_SIGN_OUT_MS,
): boolean {
  if (!Number.isFinite(lastActivity) || !Number.isFinite(now)) return true;
  if (now < lastActivity) return false;
  return now - lastActivity >= timeoutMs;
}
