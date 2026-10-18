/**
 * Cookie consent state.
 *
 * Only one optional category exists today: interface preferences (the theme
 * and a little dashboard layout state). Nothing on the platform advertises or
 * tracks across sites, so analytics is recorded as declined and shown locked
 * off in the banner.
 *
 * Choices are kept for 180 days, after which the banner asks again. A decision
 * is stamped with its date so an old record can be recognised as stale rather
 * than trusted forever.
 */

export const CONSENT_STORAGE_KEY = "cv.cookie-consent.v1";
export const CONSENT_VERSION = 1;
export const CONSENT_REVIEW_AFTER_DAYS = 180;

/** Keys written only when interface preferences are allowed. */
const OPTIONAL_STORAGE_KEYS = [
  "theme",
  "cosmic-vault-dashboard-rail",
  "cosmic-vault-sidebar-collapsed",
];

/** Fired by the footer (or anywhere else) to reopen the preferences panel. */
export const CONSENT_PROMPT_EVENT = "cv:cookie-prompt";
/** Fired after a choice is saved, so any listener can react. */
export const CONSENT_CHANGED_EVENT = "cv:cookie-consent-changed";

export type CookieConsent = {
  version: typeof CONSENT_VERSION;
  essential: true;
  /** Theme and minor interface state stored in localStorage. */
  preferences: boolean;
  /** No analytics tooling is configured, so this is always false. */
  analytics: false;
  /** ISO timestamp of the decision. */
  decidedAt: string;
};

/** The categories the banner can honestly show. */
export const CONSENT_CATEGORIES = {
  essential: {
    label: "Strictly necessary",
    description:
      "A session cookie keeps you signed in after verifying a one-time code. Without it, every page would sign you out.",
  },
  preferences: {
    label: "Interface preferences",
    description:
      "Local storage remembers your light or dark theme and small layout choices, so the vault opens the way you left it.",
  },
  analytics: {
    label: "Analytics and advertising",
    description:
      "None configured. No advertising cookies, cross-site pixels, or third-party analytics are loaded on this platform.",
  },
} as const;

export function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.decidedAt !== "string") return null;

    const decidedAt = new Date(parsed.decidedAt).getTime();
    if (!Number.isFinite(decidedAt)) return null;

    const ageInDays = (Date.now() - decidedAt) / 86_400_000;
    if (ageInDays < 0 || ageInDays > CONSENT_REVIEW_AFTER_DAYS) return null;

    return {
      version: CONSENT_VERSION,
      essential: true,
      preferences: parsed.preferences === true,
      analytics: false,
      decidedAt: parsed.decidedAt,
    };
  } catch {
    return null;
  }
}

/** True when the visitor has allowed interface preferences to be stored. */
export function preferencesAllowed(): boolean {
  return readConsent()?.preferences === true;
}

/**
 * Removes optional storage when preferences are declined. The current theme
 * stays applied for this visit, but the choice is not carried forward.
 */
export function forgetOptionalStorage() {
  if (typeof window === "undefined") return;
  for (const key of OPTIONAL_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable; there is nothing to clear in that case.
    }
  }
}

/** Persist the theme once interface preferences have been allowed. */
export function rememberTheme(theme: string) {
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Nothing to do.
  }
}

/** next-themes writes on setTheme, so drop the key again after a toggle when
 * preferences have not been allowed. */
export function forgetThemePreference() {
  if (typeof window === "undefined" || preferencesAllowed()) return;
  try {
    window.localStorage.removeItem("theme");
  } catch {
    // Nothing to do.
  }
}

export function writeConsent(preferences: boolean): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    essential: true,
    preferences,
    analytics: false,
    decidedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Private mode or a full quota should not break the page; the choice still
    // applies for this visit because the banner closes either way.
  }

  if (!preferences) forgetOptionalStorage();

  window.dispatchEvent(
    new CustomEvent<CookieConsent>(CONSENT_CHANGED_EVENT, { detail: consent }),
  );
  return consent;
}

/** Reopen the banner from anywhere, e.g. the footer's cookie settings link. */
export function requestCookieSettings() {
  window.dispatchEvent(new Event(CONSENT_PROMPT_EVENT));
}
