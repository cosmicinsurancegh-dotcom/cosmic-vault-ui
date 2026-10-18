import { expect, test } from "./support/fixtures";
import { STALL_EMAIL } from "./stubs/session";

/**
 * The Convex client queues a mutation while it has no connection and never
 * rejects it, so before this deadline a stalled deployment left the email-code
 * button spinning on "Sending code" forever with no explanation. These tests
 * pin the browser-side fail-fast behaviour.
 */
test.describe("sign-in fails fast", () => {
  test("a code request that never answers stops spinning and says why", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/auth?returnTo=%2Fdashboard%2Fpolicies");
    await page.getByLabel("Email address").fill(STALL_EMAIL);
    await page.getByRole("button", { name: /continue with email/i }).click();

    // The request is in flight - the button reports progress, not a failure.
    await expect(
      page.getByRole("button", { name: /sending code/i }),
    ).toBeVisible();

    // Within the deadline the form recovers with an explanation...
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(/taking too long to respond/i, {
      timeout: 25_000,
    });
    // ...and the button is usable again, so the visitor can retry.
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeEnabled();

    // The attempt stays on /auth and keeps the requested destination.
    expect(new URL(page.url()).pathname).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
      "/dashboard/policies",
    );
  });
});
