import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { CUSTOMER_SESSION, TEST_PASSWORD, VALID_CODE } from "./stubs/session";

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

/**
 * Types the six digits and stops there: a completed code submits itself, with
 * no Enter and no button press. The destination (or the error) is asserted by
 * the caller.
 */
async function enterCode(page: Page, code: string) {
  const otp = page.locator("input[data-input-otp]");
  await otp.click();
  await otp.pressSequentially(code);
}

async function choosePasswordMethod(page: Page) {
  await page.getByRole("button", { name: "Password", exact: true }).click();
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

    await startEmailSignIn(page);
    await enterCode(page, VALID_CODE);

    await expect.poll(() => pathname(page)).toBe("/dashboard");
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });

  test("/login and /signup open the same sign-in page", async ({ page }) => {
    await page.goto("/login?returnTo=%2Fdashboard%2Fpolicies");

    await expect.poll(() => pathname(page)).toBe("/auth");
    let url = new URL(page.url());
    expect(url.searchParams.get("returnTo")).toBe("/dashboard/policies");
    expect(url.searchParams.get("mode")).toBe("signin");
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // The guest entry is gone from the one sign-in page.
    await expect(
      page.getByRole("button", { name: /continue as guest/i }),
    ).toHaveCount(0);

    await page.goto("/signup?returnTo=%2Fdashboard");

    await expect.poll(() => pathname(page)).toBe("/auth");
    url = new URL(page.url());
    expect(url.searchParams.get("returnTo")).toBe("/dashboard");
    expect(url.searchParams.get("mode")).toBe("signup");
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /create your/i,
    );
  });

  test("the chosen sign-in method survives a reload", async ({ page }) => {
    await page.goto("/auth?returnTo=%2Fdashboard");
    await choosePasswordMethod(page);

    // The address is updated from an effect of the click, so wait for it.
    await expect
      .poll(() => new URL(page.url()).searchParams.get("method"))
      .toBe("password");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Password", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("method")).toBe("password");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");

    // Switching back is remembered on the next reload too.
    await page.getByRole("button", { name: "Email code", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("method"))
      .toBe("code");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Email code", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  });

  test("the password method signs in with the account password", async ({
    page,
  }) => {
    await page.goto("/auth?returnTo=%2Fdashboard%2Fpolicies");
    await choosePasswordMethod(page);

    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in with password/i }).click();

    await expect.poll(() => pathname(page)).toBe("/dashboard/policies");
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });

  test("a password account confirms an emailed code before it is usable", async ({
    page,
  }) => {
    await page.goto("/auth?returnTo=%2Fdashboard");
    await page.getByRole("button", { name: /create account/i }).click();
    await choosePasswordMethod(page);

    await page.getByLabel("Email address").fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /create my account/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /check your inbox/i,
    );
    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");

    await enterCode(page, VALID_CODE);
    await expect.poll(() => pathname(page)).toBe("/dashboard");
  });

  test("a wrong password keeps the visitor on /auth with a helpful message", async ({
    page,
  }) => {
    await page.goto("/auth");
    await choosePasswordMethod(page);

    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByLabel("Password", { exact: true }).fill("not the password");
    await page.getByRole("button", { name: /sign in with password/i }).click();

    await expect(
      page.getByText(/email and password don't match/i),
    ).toBeVisible();
    await expect.poll(() => pathname(page)).toBe("/auth");
  });

  test("the sixth digit signs in without Enter or a button press", async ({
    page,
  }) => {
    await page.goto("/auth?returnTo=%2Fdashboard%2Fdocuments");
    await startEmailSignIn(page);
    await enterCode(page, VALID_CODE);

    await expect.poll(() => pathname(page)).toBe("/dashboard/documents");
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

  test("a rejected code clears the field so the next code signs in", async ({
    page,
  }) => {
    await page.goto("/auth?returnTo=%2Fdashboard");
    await startEmailSignIn(page);
    await enterCode(page, "000000");

    const otp = page.locator("input[data-input-otp]");
    await expect(
      page.getByText(/verification code you entered is incorrect/i),
    ).toBeVisible();
    await expect(otp).toHaveValue("");

    // Retyping is all it takes: the corrected code submits itself.
    await enterCode(page, VALID_CODE);
    await expect.poll(() => pathname(page)).toBe("/dashboard");
  });

  for (const returnTo of ["//evil.example/steal", "https://evil.example"]) {
    test(`returnTo ${returnTo} cannot send a signed-in visitor off-site`, async ({
      page,
    }) => {
      await page.goto(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
      await startEmailSignIn(page);
      await enterCode(page, VALID_CODE);

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

  test("a protected dashboard link opens the one sign-in page", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /enter the/i,
    );
  });

  test("a mineral update link returns the reader to their minerals after signing in", async ({
    page,
  }) => {
    // Shipment emails link to /dashboard/minerals (see convex/lib/shipmentEmail.ts).
    // Signing in from that link must land back on the minerals page, not the
    // dashboard root.
    await page.goto("/dashboard/minerals");

    await expect.poll(() => pathname(page)).toBe("/auth");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
      "/dashboard/minerals",
    );

    await startEmailSignIn(page);
    await enterCode(page, VALID_CODE);

    await expect.poll(() => pathname(page)).toBe("/dashboard/minerals");
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
