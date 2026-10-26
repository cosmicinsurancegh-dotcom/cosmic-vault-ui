import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_SIGN_OUT_MS,
  isIdle,
} from "../src/lib/idleSignOut";

/**
 * The vault closes an idle session. These tests pin the deadline arithmetic
 * the dashboard hook relies on, including the clock stepping backwards when a
 * machine wakes from sleep.
 */
describe("isIdle", () => {
  it("keeps a session that saw input inside the deadline", () => {
    const now = 1_700_000_000_000;
    expect(isIdle(now - 60_000, now)).toBe(false);
    expect(isIdle(now - IDLE_SIGN_OUT_MS + 1, now)).toBe(false);
  });

  it("closes the session at and after the deadline", () => {
    const now = 1_700_000_000_000;
    expect(isIdle(now - IDLE_SIGN_OUT_MS, now)).toBe(true);
    expect(isIdle(now - IDLE_SIGN_OUT_MS - 1, now)).toBe(true);
  });

  it("does not end a session on a clock that stepped backwards", () => {
    expect(isIdle(5_000, 1_000)).toBe(false);
  });

  it("treats an unusable timestamp as idle", () => {
    expect(isIdle(Number.NaN, 1_000)).toBe(true);
    expect(isIdle(1_000, Number.NaN)).toBe(true);
  });

  it("honours a caller-supplied deadline", () => {
    expect(isIdle(1_000, 2_000, 1_000)).toBe(true);
    expect(isIdle(1_000, 1_999, 1_000)).toBe(false);
  });

  it("waits half an hour by default and checks more often than it fires", () => {
    expect(IDLE_SIGN_OUT_MS).toBe(30 * 60_000);
    expect(ACTIVITY_THROTTLE_MS).toBeLessThan(IDLE_CHECK_INTERVAL_MS);
    expect(IDLE_CHECK_INTERVAL_MS).toBeLessThan(IDLE_SIGN_OUT_MS);
  });
});

/**
 * The rule only matters if the signed-in shell mounts it, so the dashboard
 * itself is checked rather than trusting the hook to be wired up by hand.
 */
describe("dashboard idle sign-out wiring", () => {
  const layout = readFileSync(
    "src/pages/dashboard/DashboardLayout.tsx",
    "utf8",
  );

  it("mounts the idle hook", () => {
    expect(layout).toMatch(/useIdleSignOut\(/);
  });

  it("closes the session with the auth sign-out", () => {
    expect(layout).toMatch(/const handleIdleSignOut[\s\S]*signOut\(\)/);
  });
});
