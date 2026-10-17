import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { CUSTOMER_SESSION, VALID_CODE } from "./stubs/session";

async function pathname(page: Page) {
  return new URL(page.url()).pathname;
}

async function startEmailSignIn(page: Page, email = "ada@example.com") {
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /continue with email/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /check your inbox/i,
  );
}

async function enterCode(page: Page, code: string) {
  const otp = page.locator("input[data-input-otp]");
  await otp.click();
  await otp.pressSequentially(code);
  await page.getByRole("button", { name: /verify & enter the vault/i }).click();
}

test.describe("sign-in redirect flow", () => {
  test("a signed-out visitor is sent to /auth and returned to the page they asked for", async ({
    page,
  }) => {
    await page.goto("/claims/track");

    // The protected link becomes a sign-in hand-off with the destination kept.
    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
      "/dashboard/claims",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /enter the/i,
    );

    await startEmailSignIn(page);
    await enterCode(page, VALID_CODE);

    await expect.poll(() => pathname(page)).toBe("/dashboard/claims");
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });

  test("the navbar sign-in link signs in and opens the dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Sign in", exact: true })
      .click();

    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");

    await page.getByRole("button", { name: /continue as guest/i }).click();
    await expect.poll(() => pathname(page)).toBe("/dashboard");
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });

  test("a wrong code keeps the visitor on /auth with returnTo intact", async ({
    page,
  }) => {
    await page.goto("/auth?returnTo=%2Fdashboard%2Fpolicies");
    await startEmailSignIn(page);
    await enterCode(page, "000000");

    await expect(
      page.getByText(/verification code you entered is incorrect/i),
    ).toBeVisible();
    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
      "/dashboard/policies",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /check your inbox/i,
    );
  });

  for (const returnTo of ["//evil.example/steal", "https://evil.example"]) {
    test(`returnTo ${returnTo} cannot send a signed-in visitor off-site`, async ({
      page,
    }) => {
      await page.goto(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      await page.getByRole("button", { name: /continue as guest/i }).click();

      await expect.poll(() => pathname(page)).toBe("/dashboard");
      expect(new URL(page.url()).hostname).toBe("127.0.0.1");
    });
  }

  test("an already signed-in visitor skips the form", async ({ page }) => {
    await page.addInitScript((session) => {
      window.__E2E_SESSION__ = session;
    }, CUSTOMER_SESSION);

    await page.goto("/auth?returnTo=%2Fdashboard%2Fdocuments");

    await expect.poll(() => pathname(page)).toBe("/dashboard/documents");
    await expect(page.getByLabel("Email address")).toHaveCount(0);
  });

  test("the dashboard gate explains the block and keeps the destination", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByText(/sign in to your insurance workspace/i),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");

    await page.getByRole("button", { name: /continue as guest/i }).click();
    await expect.poll(() => pathname(page)).toBe("/dashboard");
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });

  test("signed-in visitors get a vault link instead of sign-in", async ({
    page,
  }) => {
    await page.addInitScript((session) => {
      window.__E2E_SESSION__ = session;
    }, CUSTOMER_SESSION);

    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: /my vault/i })).toBeVisible();
    await expect(
      banner.getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveCount(0);

    await banner.getByRole("link", { name: /my vault/i }).click();
    await expect.poll(() => pathname(page)).toBe("/dashboard");
  });
});
