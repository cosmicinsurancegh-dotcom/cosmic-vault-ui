import { useAuth } from "@/hooks/use-auth";
import {
  analyticsAllowed,
  CONSENT_CHANGED_EVENT,
  type CookieConsent,
} from "@/lib/consent";
import {
  capturePageview,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  syncAnalyticsConsentFromStorage,
} from "@/lib/posthog";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/**
 * Applies the cookie choice to PostHog, reports a page view per route, and
 * ties a recording to the signed-in user.
 *
 * Mounted above the router so it sees every navigation; it renders nothing.
 * Nothing is sent until the visitor allows analytics, and answering the banner
 * mid-visit takes effect immediately through `CONSENT_CHANGED_EVENT` - no
 * reload needed, in either direction.
 */
export function PostHogAnalytics() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [allowed, setAllowed] = useState(analyticsAllowed);
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    syncAnalyticsConsentFromStorage();

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsent>).detail;
      syncAnalyticsConsentFromStorage();
      setAllowed(detail?.analytics === true);
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    capturePageview(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    // Withdrawn consent drops the identity; granting it again re-identifies,
    // because this effect runs on the change.
    if (!allowed) {
      identifiedRef.current = null;
      return;
    }

    const userId = user?._id ? String(user._id) : null;

    if (!isAuthenticated || !userId) {
      if (identifiedRef.current) {
        resetAnalyticsUser();
        identifiedRef.current = null;
      }
      return;
    }

    if (identifiedRef.current === userId) return;
    identifyAnalyticsUser(userId, user?.role ?? undefined);
    identifiedRef.current = userId;
  }, [allowed, isAuthenticated, user?._id, user?.role]);

  return null;
}
