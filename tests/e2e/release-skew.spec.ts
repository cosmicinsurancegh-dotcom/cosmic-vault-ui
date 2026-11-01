import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { CUSTOMER_SESSION } from "./stubs/session";
import { E2E_RELEASE_EXPECTATION } from "./stubs/release";

/**
 * The publish gate stops a bundle from being released ahead of its functions,
 * but a deployment can be replaced or rolled back underneath a bundle that is
 * already published. From inside the app that looks like every other backend
 * failure: a masked `Server Error` on a call nobody can name. These scenarios
 * answer `setup:release` the way a backend that is behind does, and check that
 * the dashboard says which functions and what to do.
 */
async function startSignedIn(page: Page) {
  await page.addInitScript((session) => {
    window.__E2E_SESSION__ = session;
  }, CUSTOMER_SESSION);
}

/**
 * Answers the health probe as healthy and `setup:release` with `stamp`. Both go
 * to `/api/query`, so the path in the request body is what separates them.
 */
async function answerRelease(page: Page, stamp: unknown) {
  const asked: string[] = [];
  await page.route("**/api/query", (route) => {
    const request = route.request().postDataJSON() as { path?: string } | null;
    const path = request?.path ?? "";
    asked.push(path);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        value: path === "setup:release" ? stamp : { ok: true },
      }),
    });
  });
  return asked;
}

test.describe("release skew notice", () => {
  test("names the functions a deployment is behind on", async ({ page }) => {
    await startSignedIn(page);
    await answerRelease(page, {
      functions: ["policies:list", "vault:list"],
      signatures: {
        "policies:list": E2E_RELEASE_EXPECTATION["policies:list"],
        "vault:list": "1111111111",
      },
    });

    await page.goto("/dashboard");

    const notice = page.getByRole("alert");
    await expect(
      notice.getByText("This site is ahead of the backend it talks to."),
    ).toBeVisible();
    await expect(notice).toContainText(
      "1 the deployment does not serve",
    );
    await expect(notice).toContainText("not published: tickets:queueSummary");
    await expect(notice).toContainText("Deploy Convex functions, target: prod");
  });

  test("names a function whose shape changed", async ({ page }) => {
    await startSignedIn(page);
    await answerRelease(page, {
      functions: ["policies:list", "tickets:queueSummary"],
      signatures: {
        "policies:list": E2E_RELEASE_EXPECTATION["policies:list"],
        "tickets:queueSummary": "9999999999",
      },
    });

    await page.goto("/dashboard");

    const notice = page.getByRole("alert");
    await expect(notice).toContainText(
      "1 it validates differently than this build does",
    );
    await expect(notice).toContainText("different shape: tickets:queueSummary");
  });

  test("stays quiet when the deployment serves what the bundle was built for", async ({
    page,
  }) => {
    await startSignedIn(page);
    const asked = await answerRelease(page, {
      functions: Object.keys(E2E_RELEASE_EXPECTATION),
      signatures: { ...E2E_RELEASE_EXPECTATION },
    });

    await page.goto("/dashboard");

    // Wait for the check to have run, so "no banner" means "the answer matched"
    // rather than "nothing has been asked yet".
    await expect
      .poll(() => asked.filter((path) => path === "setup:release").length)
      .toBeGreaterThan(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("says nothing when the backend cannot be asked", async ({ page }) => {
    await startSignedIn(page);
    // A deployment from before `setup:release` answered every failure the same
    // way, so the notice must not accuse it of being behind.
    await page.route("**/api/query", (route) => {
      const request = route.request().postDataJSON() as { path?: string } | null;
      const body =
        request?.path === "setup:release"
          ? { status: "error", errorMessage: "[Request ID: e2e-old] Server Error" }
          : { status: "success", value: { ok: true } };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
