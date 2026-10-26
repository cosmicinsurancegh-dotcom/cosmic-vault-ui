import type { Locator, Page } from "@playwright/test";
import { NAV_SECTIONS } from "../../src/lib/navigation";
import { expect, expectRoute, test } from "./support/fixtures";

/**
 * Member destinations render the application shell, which has no marketing
 * footer and no canonical metadata of its own. The navigation test confirms
 * the URL rather than running the public-page assertions against them.
 */
const MEMBER_PREFIX = "/dashboard";

/**
 * Public links that hand a signed-out visitor to the sign-in screen and keep
 * their destination in `returnTo`, instead of rendering a public page at the
 * linked path. The hand-off itself is covered by `auth-redirect.spec.ts`.
 */
const SIGN_IN_HANDOFF: Record<string, string> = {
  "/claims/track": "/dashboard/claims",
  "/claims/policy-documents": "/dashboard/documents",
};

const primaryNav = (page: Page) =>
  page.getByRole("navigation", { name: "Primary" });

/**
 * Opens a panel with the keyboard. Focus + Enter is how the menu is designed
 * to open for keyboard and assistive-technology users, and unlike hover it
 * cannot be closed by a stray pointer crossing the grace period.
 */
async function openMenu(trigger: Locator) {
  await trigger.focus();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

test.describe("mega-menu", () => {
  test("the landing page renders the public shell", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /held\.\s*sealed\.\s*covered\./i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("hovering a trigger opens the panel and the grace period closes it", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = primaryNav(page).getByRole("button", {
      name: "The vault",
      exact: true,
    });
    const panel = page.getByRole("region", { name: "The vault menu" });

    await trigger.hover();
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Moving away closes it once the 160ms grace period expires.
    await page.mouse.move(5, 700);
    await expect(panel).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  for (const section of NAV_SECTIONS) {
    test(`${section.label}: every link navigates`, async ({ page }) => {
      await page.goto("/");

      const trigger = primaryNav(page).getByRole("button", {
        name: section.label,
        exact: true,
      });
      const panel = page.locator(`#mega-${section.id}`);
      const panelRegion = page.getByRole("region", {
        name: `${section.label} menu`,
      });

      const expectedCount =
        section.groups.reduce((total, group) => total + group.links.length, 0) +
        1 + // feature primary
        (section.feature.secondary ? 1 : 0) +
        1; // "section overview" in the panel footer

      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-haspopup", "true");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toHaveCount(0);

      await openMenu(trigger);
      await expect(panelRegion).toBeVisible();
      await expect(panelRegion.getByRole("link")).toHaveCount(expectedCount);

      const links = panelRegion.getByRole("link");

      for (let index = 0; index < expectedCount; index += 1) {
        const link = links.nth(index);
        const href = await link.getAttribute("href");
        const label = (await link.innerText()).replace(/\s+/g, " ").trim();

        expect(
          href,
          `${section.label} link ${index} (${label}) needs an internal href`,
        ).toMatch(/^\/[^/]/);

        const destination = href?.split("#")[0] || "/";
        const hash = href?.includes("#") ? `#${href.split("#")[1]}` : null;

        // The panel closes on pointer movement and on route change, and the
        // click is the last pointer action of the loop, so re-open and retry if
        // the menu closed underneath it.
        await expect(async () => {
          if (!(await panelRegion.isVisible())) await openMenu(trigger);
          await links.nth(index).click({ timeout: 5_000 });
        }, `${label} should be clickable from the open menu`).toPass({
          timeout: 30_000,
        });

        if (destination in SIGN_IN_HANDOFF) {
          await expect
            .poll(() => new URL(page.url()).pathname, {
              message: `${label} should open the sign-in hand-off`,
            })
            .toBe("/auth");
          expect(
            new URL(page.url()).searchParams.get("returnTo"),
            `${label} should keep its destination for after sign-in`,
          ).toBe(SIGN_IN_HANDOFF[destination]);
          await page.goto("/");
        } else if (destination.startsWith(MEMBER_PREFIX)) {
          // A signed-out visitor is handed to the one sign-in page with the
          // member destination kept for after sign-in, exactly like the
          // navbar's own sign-in link.
          await expect
            .poll(() => new URL(page.url()).pathname, {
              message: `${label} should open the sign-in hand-off`,
            })
            .toBe("/auth");
          expect(
            new URL(page.url()).searchParams.get("returnTo"),
            `${label} should keep its destination for after sign-in`,
          ).toBe(destination);
          // The application shell has no public navigation to continue from.
          await page.goto("/");
        } else {
          await expectRoute(page, destination);
          if (hash) {
            expect(new URL(page.url()).hash, `${label} should keep its anchor`).toBe(hash);
          }
        }

        await expect(
          panel,
          `${section.label} menu should close after choosing ${label}`,
        ).toHaveCount(0);

        if (index < expectedCount - 1) {
          await openMenu(trigger);
          await expect(panelRegion).toBeVisible();
        }
      }
    });

    test(`${section.label}: keyboard opens, focuses and closes the menu`, async ({
      page,
    }) => {
      await page.goto("/");

      const trigger = primaryNav(page).getByRole("button", {
        name: section.label,
        exact: true,
      });
      const panelRegion = page.getByRole("region", {
        name: `${section.label} menu`,
      });

      await openMenu(trigger);
      await expect(panelRegion).toBeVisible();

      // Focus moves into the panel so keyboard users continue from there.
      await expect(panelRegion.getByRole("link").first()).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(panelRegion).toHaveCount(0);
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
    });
  }
});
