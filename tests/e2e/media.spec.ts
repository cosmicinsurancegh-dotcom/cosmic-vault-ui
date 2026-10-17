import { expect, test } from "./support/fixtures";

/**
 * The marketing shell is now image-led: every public page carries photography
 * from `public/images`, and cover cards zoom on hover. A missing file or a
 * broken `Media` wrapper would still leave every navigation test green, so these
 * checks assert the photographs are actually decoded by the browser.
 */
const PHOTOGRAPHIC_ROUTES = [
  "/",
  "/cover",
  "/cover/home",
  "/how-it-works",
  "/claims",
  "/help",
  "/faqs",
  "/quote",
  "/about",
  "/auth",
  "/this-route-does-not-exist",
];

test("every public page renders its photography", async ({ page }) => {
  for (const route of PHOTOGRAPHIC_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("load");

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll("img")].filter(
                (img) => img.complete && img.naturalWidth > 0,
              ).length,
          ),
        { message: `${route} should render at least one photograph` },
      )
      .toBeGreaterThan(0);

    const broken = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.getAttribute("src")),
    );
    expect(broken, `${route} has broken images`).toEqual([]);
  }
});

test("cover cards zoom their photograph on hover", async ({ page }) => {
  await page.goto("/cover");
  const card = page.locator("main a[href='/cover/home']").first();
  await expect(card).toBeVisible();

  const image = card.locator("img").first();
  // Tailwind v4 compiles scale utilities to the standalone `scale` property,
  // so reading `transform` would never observe the zoom.
  const readScale = () => image.evaluate((node) => getComputedStyle(node).scale);
  const rest = await readScale();

  await card.hover();
  await expect.poll(readScale).not.toBe(rest);
});

test("the mega menu feature card shows a photograph", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Cover", exact: true }).hover();

  const panel = page.getByRole("region", { name: "Cover menu" });
  await expect(panel).toBeVisible();
  await expect
    .poll(() =>
      panel.evaluate((node) =>
        [...node.querySelectorAll("img")].some(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
});
