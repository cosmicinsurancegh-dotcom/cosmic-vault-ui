import { FOOTER_COLUMNS } from "../../src/lib/navigation";
import { expect, expectRoute, test } from "./support/fixtures";

/** Footer links that are not part of a column (quick links, legal bar, notes). */
const STANDALONE_DESTINATIONS = [
  "/#review",
  "/support/contact",
  "/legal/terms",
  "/legal/privacy",
  "/legal/regulatory",
];

test.describe("footer", () => {
  test("renders every configured column and destination", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();

    for (const column of FOOTER_COLUMNS) {
      await expect(
        footer.getByRole("navigation", { name: column.title }),
      ).toBeVisible();

      for (const link of column.links) {
        await expect(
          footer.locator(`a[href="${link.href}"]`).first(),
          `footer column "${column.title}" should link to ${link.href}`,
        ).toBeVisible();
      }
    }

    for (const href of STANDALONE_DESTINATIONS) {
      await expect(
        footer.locator(`a[href="${href}"]`).first(),
        `footer should also link to ${href}`,
      ).toBeVisible();
    }
  });

  test("every footer link navigates", async ({ page }) => {
    await page.goto("/");

    const links = page.getByRole("contentinfo").getByRole("link");
    await expect(links.first()).toBeVisible();
    const total = await links.count();
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href") ?? ""),
    );

    expect(total).toBeGreaterThanOrEqual(
      FOOTER_COLUMNS.reduce((sum, column) => sum + column.links.length, 0),
    );
    expect(
      hrefs.filter((href) => !href.startsWith("/")).length,
      "the footer should only link to in-app routes",
    ).toBe(0);

    for (let index = 0; index < total; index += 1) {
      const link = links.nth(index);
      const href = hrefs[index];
      const label = (await link.innerText()).replace(/\s+/g, " ").trim();

      if (href.includes("#")) {
        // In-page anchors keep the marketing shell mounted.
        await link.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe("/");
        expect(new URL(page.url()).hash).toBe(`#${href.split("#")[1]}`);
      } else if (href.startsWith("/dashboard")) {
        // Member routes render the application shell without this footer.
        await link.click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(href);
        await page.goto("/");
      } else {
        await link.click();
        await expectRoute(page, href);
        await expect.poll(() => page.getByRole("contentinfo").count()).toBe(1);
      }

      expect(label, `footer link ${index} should have a text label`).not.toBe(
        "",
      );
    }
  });
});
