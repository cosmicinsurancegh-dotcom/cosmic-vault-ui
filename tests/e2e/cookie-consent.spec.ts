import type { Locator, Page } from "@playwright/test";
import {
  CONSENT_STORAGE_KEY,
  expect,
  test,
  type ConsentState,
} from "./support/fixtures";
import { CUSTOMER_SESSION } from "./stubs/session";

/**
 * The shared fixture records a consent decision so the panel never covers the
 * footer or the sidebar in other scenarios. These tests start without one, so
 * the panel asks on the first visit exactly as a new visitor sees it.
 */
test.use({ consent: "unanswered" satisfies ConsentState });

/** The panel waits for the page to settle before it asks. */
const PROMPT_DELAY_MS = 1800;

const panel = (page: Page) =>
  page.getByRole("dialog", { name: /your call on cookies/i });

async function readStoredConsent(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }, CONSENT_STORAGE_KEY);
}

test.describe("cookie consent", () => {
  test("asks on a first visit and remembers an essential-only choice", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/no advertising or cross-site/i);

    // Nothing optional starts expanded: the simple choice comes first.
    await expect(dialog.getByText("Strictly necessary")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Essential only" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Cookie preferences saved")).toBeVisible();

    const stored = await readStoredConsent(page);
    expect(stored).toMatchObject({
      version: 1,
      essential: true,
      preferences: false,
      analytics: false,
    });
    expect(typeof stored?.decidedAt).toBe("string");

    // A recorded answer is not asked again on the next visit.
    await page.reload();
    await page.waitForTimeout(PROMPT_DELAY_MS + 600);
    await expect(panel(page)).toHaveCount(0);
  });

  test("saving preferences keeps them, and the footer reopens the panel", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = panel(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Manage preferences" }).click();
    await expect(
      dialog.getByRole("button", { name: "Hide details" }),
    ).toBeVisible();
    await expect(dialog.getByText("Strictly necessary")).toBeVisible();
    await expect(dialog.getByText("None in use")).toBeVisible();

    const preferences = dialog.getByRole("switch", {
      name: "Remember interface preferences",
    });
    await expect(preferences).toBeChecked();

    // The details view saves the switch as it stands.
    await dialog.getByRole("button", { name: "Save choices" }).click();
    await expect(dialog).toHaveCount(0);

    expect(await readStoredConsent(page)).toMatchObject({
      preferences: true,
      analytics: false,
    });

    // The footer entry reopens the same panel with the saved answer in view.
    await page
      .getByRole("contentinfo")
      .getByRole("button", { name: "Cookie settings" })
      .click();

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Hide details" }),
    ).toBeVisible();
    await expect(dialog.getByText("Strictly necessary")).toBeVisible();

    // Escape dismisses without recording anything new.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await readStoredConsent(page)).toMatchObject({
      preferences: true,
    });
  });
});

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

async function box(locator: Locator, what: string) {
  const value = await locator.boundingBox();
  if (!value) throw new Error(`${what} should be laid out`);
  return value;
}

test.describe("dashboard placement", () => {
  test.use({ consent: "answered" });

  /** The sidebar rail; it is only rendered from the `lg` breakpoint up. */
  const rail = (page: Page) => page.locator("aside").first();

  const signOutButton = (page: Page) =>
    page.getByRole("button", { name: "Sign out" }).first();

  /** Signs in as a member, lands on the dashboard and opens the panel. */
  async function openDashboardPanel(page: Page) {
    await page.addInitScript((session) => {
      window.__E2E_SESSION__ = session;
    }, CUSTOMER_SESSION);
    await page.goto("/dashboard");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    // The dashboard reopens the panel through the same event as the footer.
    await page.evaluate(() =>
      window.dispatchEvent(new Event("cv:cookie-prompt")),
    );

    const dialog = panel(page);
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /**
   * The dashboard's rail publishes its width once it has mounted, which is a
   * frame after the panel can open, so the panel's inset settles a beat later
   * than its first appearance. Polling waits for that layout without hiding a
   * panel that is permanently misplaced.
   */
  async function expectPanelOutsideRail(page: Page, dialog: Locator) {
    await expect
      .poll(async () => {
        const dialogBox = await box(dialog, "the panel");
        const railBox = await box(rail(page), "the sidebar rail");
        return Math.round(dialogBox.x - (railBox.x + railBox.width));
      }, { message: "the panel should sit outside the sidebar rail" })
      .toBeGreaterThanOrEqual(0);
  }

  test("the panel opens clear of the sidebar sign-out control", async ({
    page,
  }) => {
    const dialog = await openDashboardPanel(page);
    await expectPanelOutsideRail(page, dialog);

    const signOut = signOutButton(page);
    await expect(signOut).toBeVisible();

    const dialogBox = await box(dialog, "the panel");
    const signOutBox = await box(signOut, "the sign-out control");
    expect(
      overlaps(dialogBox, signOutBox),
      "the panel should sit clear of the sidebar's account card",
    ).toBe(false);

    // And the control is genuinely usable while the panel is open.
    await signOut.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  test("the panel keeps clear when the rail is collapsed", async ({ page }) => {
    const dialog = await openDashboardPanel(page);
    await expectPanelOutsideRail(page, dialog);

    const expanded = await box(dialog, "the panel");
    const expandedRail = await box(rail(page), "the sidebar rail");

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();

    // The rail narrows, and the panel follows it rather than staying at the
    // expanded offset, still clear of the account card at its foot.
    await expect
      .poll(async () => (await rail(page).boundingBox())?.width ?? Infinity)
      .toBeLessThan(expandedRail.width);
    await expectPanelOutsideRail(page, dialog);

    const collapsed = await box(dialog, "the panel");
    expect(collapsed.x).toBeLessThan(expanded.x);

    const signOut = signOutButton(page);
    await expect(signOut).toBeVisible();
    expect(
      overlaps(collapsed, await box(signOut, "the sign-out control")),
      "the panel should sit clear of the collapsed rail's account card",
    ).toBe(false);

    // The collapsed rail's sign-out is still reachable with the panel open.
    await signOut.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });
});
