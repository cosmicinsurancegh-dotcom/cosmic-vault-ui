import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIGN_IN_TIMEOUT_MS,
  SignInTimeoutError,
  isSignInTimeout,
  signInFailureMessage,
  withSignInTimeout,
} from "../src/lib/signInTimeout";

/**
 * The Convex client never rejects a call made while it has no connection, so a
 * stalled deployment used to leave the sign-in button spinning forever. These
 * tests pin the browser-side deadline that turns that into a shown error.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe("withSignInTimeout", () => {
  it("resolves a request that answers in time", async () => {
    await expect(withSignInTimeout(Promise.resolve("sent"), 100)).resolves.toBe(
      "sent",
    );
  });

  it("passes a rejection through unchanged", async () => {
    const failure = new Error("Could not send the sign-in code (HTTP 400)");
    await expect(withSignInTimeout(Promise.reject(failure), 100)).rejects.toBe(
      failure,
    );
  });

  it("rejects a request that never settles", async () => {
    vi.useFakeTimers();
    const pending = withSignInTimeout(new Promise<never>(() => {}), 5_000);
    const assertion =
      expect(pending).rejects.toBeInstanceOf(SignInTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(isSignInTimeout(await pending.catch((error) => error))).toBe(true);
  });

  it("does not fire after a fast request has resolved", async () => {
    vi.useFakeTimers();
    let settled = false;
    const pending = withSignInTimeout(Promise.resolve("ok"), 1_000).finally(
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    // The timer must have been cleared: running the clock past the deadline
    // must not reject anything or keep the process alive.
    expect(vi.getTimerCount()).toBe(0);
    await expect(pending).resolves.toBe("ok");
  });

  it("defaults to a 15 second deadline", () => {
    expect(SIGN_IN_TIMEOUT_MS).toBe(15_000);
  });
});

describe("signInFailureMessage", () => {
  it("explains a timeout instead of blaming the code", () => {
    const message = signInFailureMessage(
      new SignInTimeoutError(SIGN_IN_TIMEOUT_MS),
      "The verification code you entered is incorrect.",
    );
    expect(message).toMatch(/taking too long to respond/i);
    expect(message).not.toMatch(/incorrect/i);
  });

  it("keeps the specific message for a real rejection", () => {
    expect(
      signInFailureMessage(
        new Error("Invalid code"),
        "The verification code you entered is incorrect.",
      ),
    ).toBe("The verification code you entered is incorrect.");
  });
});
