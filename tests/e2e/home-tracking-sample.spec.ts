import { expect, test } from "./support/fixtures";

/**
 * The release-tracking card on the homepage is an illustration of how the five
 * release stages read - it is not a live member shipment. That has to be said
 * on the card itself, twice: a "Sample" label on the record before any of its
 * details are read, and a plain sentence under the stages. Without them the
 * reference, carrier, times and destination look like a real consignment.
 */
test.describe("homepage release tracking sample", () => {
  test("labels the record as a sample illustration", async ({ page }) => {
    await page.goto("/");

    const card = page.locator("#tracking");
    await expect(card).toBeVisible();

    // The label sits with the record identity, not somewhere else on the card.
    const recordLabel = card
      .locator("p")
      .filter({ hasText: "Release record" })
      .first();
    await expect(recordLabel, "the card should name the record").toBeVisible();
    await expect(
      recordLabel.getByText("Sample", { exact: true }),
      "the release record should carry a Sample label",
    ).toBeVisible();

    // And the card says in words what that label means.
    await expect(
      card.getByText(/Illustration only\./),
      "the card should disclose that it is an illustration",
    ).toBeVisible();
    await expect(
      card.getByText(/are placeholders, not a live shipment\./),
      "the card should say the details are placeholders",
    ).toBeVisible();
  });

  test("keeps the sample label on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const card = page.locator("#tracking");
    await expect(card).toBeVisible();
    await expect(
      card.getByText("Sample", { exact: true }),
      "the Sample label should survive the narrow header",
    ).toBeVisible();
    await expect(card.getByText(/Illustration only\./)).toBeVisible();
  });
});
