import {
  ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_SIGN_OUT_MS,
  isIdle,
} from "@/lib/idleSignOut";
import { useEffect, useRef } from "react";

/**
 * Input that proves a person is still at the keyboard or mouse. Scroll and
 * wheel are included because reading a long ledger is activity too, and
 * `keydown` covers typing into a form without touching the pointer.
 */
const ACTIVITY_EVENTS = [
  "keydown",
  "pointerdown",
  "mousemove",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/**
 * Calls `onIdle` once after `timeoutMs` with no sign of use.
 *
 * A background tab keeps the last activity it saw, so coming back to a window
 * that sat idle past the deadline ends the session rather than pretending the
 * break did not happen. Recording is throttled, and the interval only compares
 * timestamps, so an idle page stays cheap.
 */
export function useIdleSignOut(
  onIdle: () => void,
  timeoutMs: number = IDLE_SIGN_OUT_MS,
): void {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    let lastActivity = Date.now();
    let lastRecorded = lastActivity;
    let fired = false;

    const record = () => {
      if (fired) return;
      const now = Date.now();
      if (now - lastRecorded < ACTIVITY_THROTTLE_MS) return;
      lastActivity = now;
      lastRecorded = now;
    };

    const check = () => {
      if (fired) return;
      if (!isIdle(lastActivity, Date.now(), timeoutMs)) return;
      fired = true;
      onIdleRef.current();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, record, { passive: true });
    }
    document.addEventListener("visibilitychange", check);

    const interval = window.setInterval(
      check,
      Math.min(IDLE_CHECK_INTERVAL_MS, timeoutMs),
    );

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, record);
      }
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
    };
  }, [timeoutMs]);
}
