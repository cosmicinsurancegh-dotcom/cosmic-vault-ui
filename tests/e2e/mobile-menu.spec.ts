import { NAV_SECTIONS } from "../../src/lib/navigation";
import { expect, test } from "./support/fixtures";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation", () => {
  test("the drawer lists every section and follows a link", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();

    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    for (const section of NAV_SECTIONS) {
      await expect(
        drawer.getByRole("button", { name: section.label, exact: true }),
      ).toBeVisible();
    }

    await drawer.getByRole("button", { name: "Cover", exact: true }).click();
    await expect(
      drawer.getByRole("link", { name: /All insurance products/ }),
    ).toBeVisible();

    await drawer.getByRole("link", { name: /Motor insurance/ }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/cover/motor");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await expect(drawer).toHaveCount(0);
  });

  test("the drawer sign-in entry hands off to /auth", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const drawer = page.getByRole("dialog");
    await drawer.getByRole("link", { name: /sign in to your vault/i }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");
  });
});
