import { readConsent } from "@/lib/consent";
import posthog from "posthog-js";

/**
 * PostHog analytics and Session Replay.
 *
 * Two rules shape this module:
 *
 * 1. Nothing leaves the device until the visitor allows analytics in the
 *    cookie banner. The SDK is initialised opted out, and only `optIn()` -
 *    called from `syncAnalyticsConsent` - starts capture and recording. The
 *    stored consent record is the single source of truth, so a declined
 *    visitor also has the SDK's own storage cleared on a later opt-out.
 * 2. A replay of an insurance screen is a recording of somebody's paperwork.
 *    Inputs are masked, all on-screen text is masked, and network performance
 *    capture is off, so a replay shows the journey (clicks, screens, timings)
 *    rather than the contents of a claim or an application.
 *
 * Keys are read from the Vite env (`VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`).
 * Without a key the module is inert: it initialises nothing, opens no socket
 * and the rest of the app behaves exactly as before.
 */

const projectKey = (
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? ""
).trim();

/** EU cloud by default: the platform holds UK/EU policy records. */
const apiHost =
  ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "").trim() ||
  "https://eu.i.posthog.com";

export const posthogConfigured = Boolean(projectKey);

/**
 * The steps of the journey a replay is linked to. Named once here so the
 * recorder and the dashboards that read them cannot drift apart.
 */
export const JOURNEY_EVENTS = {
  signInCompleted: "sign_in_completed",
  quotationCreated: "quotation_created",
  applicationSubmitted: "application_submitted",
} as const;

let initialised = false;
/** Mirrors the stored analytics consent; false until the visitor allows it. */
let allowed = false;

/** The client, initialised on first use, or `null` when no key is set. */
function client(): typeof posthog | null {
  if (!posthogConfigured) return null;

  if (!initialised) {
    posthog.init(projectKey, {
      api_host: apiHost,
      // Opted out from the first line: no event, no recording and no cookie
      // until `syncAnalyticsConsent(true)` is called with a stored choice.
      opt_out_capturing_by_default: true,
      respect_dnt: true,
      // Routes are reported one pageview at a time from the router, which is
      // the only place that knows a single-page navigation happened.
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: "identified_only",
      // Request bodies and timings would carry form payloads; the journey is
      // already described by the events and the replay.
      capture_performance: false,
      session_recording: {
        maskAllInputs: true,
        // The replay shows layout and clicks, never the text on the screen.
        maskTextSelector: "*",
        blockClass: "ph-no-capture",
        // Request bodies and headers stay out of the replay as well.
        recordBody: false,
        recordHeaders: false,
        // Query strings can carry a returnTo or a reference; keep them out.
        maskCapturedNetworkRequestFn: (request) => {
          if (request.name) request.name = request.name.split("?")[0];
          return request;
        },
      },
    });
    initialised = true;
  }

  return posthog;
}

/**
 * Applies the visitor's stored choice. Called on first paint and whenever the
 * banner saves a new answer, so allowing analytics mid-visit starts recording
 * without a reload and declining stops it immediately.
 */
export function syncAnalyticsConsent(next: boolean) {
  const analytics = client();
  if (!analytics) return;

  if (next === allowed) return;
  allowed = next;

  if (next) {
    analytics.opt_in_capturing();
    analytics.startSessionRecording();
    return;
  }

  analytics.stopSessionRecording();
  analytics.opt_out_capturing();
  // Drop the identifiers the allowed period left behind.
  analytics.reset();
}

/** Reads the stored choice and applies it. */
export function syncAnalyticsConsentFromStorage() {
  syncAnalyticsConsent(readConsent()?.analytics === true);
}

/** True when a key is set and the visitor has allowed analytics. */
export function analyticsActive(): boolean {
  return posthogConfigured && allowed;
}

/**
 * Records one journey event. A no-op unless analytics is configured and
 * allowed, so call sites never need to ask.
 */
export function captureJourneyEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
) {
  if (!analyticsActive()) return;
  client()?.capture(event, properties);
}

/** Records a page view for the current route. */
export function capturePageview(path: string) {
  captureJourneyEvent("$pageview", { path });
}

/**
 * Ties a replay to the signed-in user. Only the internal user id and the role
 * are sent: no email address, name or policy reference.
 */
export function identifyAnalyticsUser(userId: string, role?: string) {
  if (!analyticsActive()) return;
  client()?.identify(userId, role ? { role } : undefined);
}

/** Clears the identified user without waiting for consent to change. */
export function resetAnalyticsUser() {
  if (!analyticsActive()) return;
  client()?.reset();
}
