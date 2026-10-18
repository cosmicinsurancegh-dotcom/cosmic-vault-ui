/**
 * Sign-in calls must fail fast.
 *
 * The Convex client queues a mutation while it has no connection and never
 * rejects it, so a stopped deployment, a blocked network or an unusable
 * deployment URL leaves the sign-in button spinning on "Sending code" forever
 * with no explanation. The gateway that sends codes already gives up after 10
 * seconds; this is the browser-side counterpart.
 */

/** Long enough for a slow gateway round-trip, short enough to feel responsive. */
export const SIGN_IN_TIMEOUT_MS = 15_000;

export class SignInTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `The sign-in service did not respond within ${Math.round(
        timeoutMs / 1000,
      )} seconds.`,
    );
    this.name = "SignInTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function isSignInTimeout(error: unknown): error is SignInTimeoutError {
  return error instanceof SignInTimeoutError;
}

/**
 * Rejects with `SignInTimeoutError` when `request` has not settled in time.
 * The original request keeps running (a Convex mutation cannot be cancelled),
 * so the caller must only reset its own UI state - never retry automatically,
 * which could send a second code.
 */
export function withSignInTimeout<T>(
  request: Promise<T>,
  timeoutMs: number = SIGN_IN_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SignInTimeoutError(timeoutMs));
    }, timeoutMs);

    request.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Message for a failed sign-in attempt. Timeouts get their own wording so the
 * visitor does not read it as "wrong password" or "wrong code".
 */
export function signInFailureMessage(error: unknown, fallback: string): string {
  if (isSignInTimeout(error)) {
    return "Sign-in is taking too long to respond. Check your connection, then try again.";
  }
  return fallback;
}
