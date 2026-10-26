import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Title set by `usePageMeta` on the designed 404 route. */
export const NOT_FOUND_TITLE = "Page not found · Cosmic Vault";

/**
 * Headline rendered by the designed 404 route. The catch-all route lives inside
 * the public shell, so a broken link still shows a styled page with a level-one
 * heading - the heading and the "Error 404" eyebrow are what tell the two apart.
 */
export const NOT_FOUND_HEADING = "This page has drifted out of orbit.";

/**
 * The consent panel opens over the bottom-left corner after a short pause and
 * covers the footer columns and the sidebar sign-out control. Scenarios here
 * navigate like a returning visitor by default, so the suite records a
 * decision up front and the panel stays closed. `localStorage` is written from
 * an init script so it is in place before the app's first render. A spec that
 * drives the panel itself opts out with `test.use({ consent: "unanswered" })`.
 */
export type ConsentState = "answered" | "unanswered";

export const CONSENT_STORAGE_KEY = "cv.cookie-consent.v1";
const CONSENT_RECORD = {
  version: 1,
  essential: true,
  preferences: false,
  analytics: false,
  decidedAt: new Date().toISOString(),
};

/**
 * Console errors the app logs deliberately. A rejected sign-in is part of the
 * flow the suite drives, and `Auth.tsx` reports it with `console.error`. Every
 * other console error still fails the test.
 */
const EXPECTED_CONSOLE_ERRORS = [
  /OTP verification error/i,
  /Email sign-in error/i,
  /Password sign-in error/i,
  /Password verification error/i,
  /Password reset error/i,
  /Resend code error/i,
];

/**
 * Base test that fails if the page throws while it is being driven,
 * so a crashed route can never hide behind a passing URL assertion.
 */
export const test = base.extend<{
  runtimeErrors: string[];
  consent: ConsentState;
}>({
  consent: ["answered", { option: true }],
  runtimeErrors: [
    async ({ page, consent }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(`pageerror: ${error.message}`);
      });
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (EXPECTED_CONSOLE_ERRORS.some((pattern) => pattern.test(text)))
          return;
        errors.push(`console: ${text}`);
      });

      // The app reads prefers-reduced-motion (framer-motion's useReducedMotion)
      // to skip its entry animations. Menus that are mid-animation never count
      // as "stable" for a real click, so the suite runs with the preference on.
      await page.emulateMedia({ reducedMotion: "reduce" });

      // The dashboard probes the deployment over the Convex HTTP API, so it can
      // explain a backend that answers but runs no functions. Answer as a
      // healthy deployment here to keep the notice out of unrelated scenarios;
      // a spec that wants the failure registers its own route, which Playwright
      // matches first.
      await page.route("**/api/query", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "success",
            value: { ok: true },
          }),
        }),
      );

      // The app sets `scroll-behavior: smooth` globally. Playwright waits for
      // an element's box to hold still before clicking, and animated scrolling
      // makes that wait restart indefinitely, so tests scroll instantly.
      await page.addInitScript(() => {
        const disableSmoothScroll = () => {
          const style = document.createElement("style");
          style.textContent = "html { scroll-behavior: auto !important; }";
          document.head?.append(style);
        };
        if (document.head) disableSmoothScroll();
        else document.addEventListener("DOMContentLoaded", disableSmoothScroll);
      });

      if (consent === "answered") {
        await page.addInitScript(
          ({ key, record }) => {
            try {
              window.localStorage.setItem(key, record);
            } catch {
              // Storage can be unavailable in a sandboxed frame; the panel
              // would simply ask again, which no scenario here depends on.
            }
          },
          {
            key: CONSENT_STORAGE_KEY,
            record: JSON.stringify(CONSENT_RECORD),
          },
        );
      }

      await use(errors);

      expect(
        errors,
        `the browser reported errors while browsing:\n${errors.join("\n")}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Asserts the app really rendered the destination: the URL is the expected
 * path, a level-one heading is on screen, and the page is not the 404 route.
 */
export async function expectRoute(page: Page, pathname: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `expected to land on ${pathname}`,
    })
    .toBe(pathname);

  // The URL changes before the new route renders, so wait for a signal that
  // only the destination can produce: every public page calls `usePageMeta`,
  // which rewrites the canonical link from an effect once it has mounted.
  // Without this the checks below can run against the page we just left, which
  // lets a link that lands on the 404 route pass.
  const expectedCanonical = `${new URL(page.url()).origin}${pathname}`;
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .querySelector('link[rel="canonical"]')
              ?.getAttribute("href") ?? "",
        ),
      { message: `the page for ${pathname} should have rendered` },
    )
    .toBe(expectedCanonical);

  const heading = page
    .getByRole("main")
    .getByRole("heading", { level: 1 })
    .first();
  await expect(heading).toBeVisible();
  await expect(heading).not.toHaveText(NOT_FOUND_HEADING);
  await expect(page.getByText("Error 404", { exact: true })).toHaveCount(0);

  await expect
    .poll(() => page.title(), { message: "route should set a page title" })
    .not.toBe(NOT_FOUND_TITLE);
}
