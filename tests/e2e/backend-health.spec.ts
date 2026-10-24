import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { CUSTOMER_SESSION } from "./stubs/session";

/**
 * The health notice exists for one opaque failure: a deployment that answers
 * HTTP and `/version`, yet runs no function, so every query fails with a bare
 * "Server Error". These scenarios answer the probe the way each broken backend
 * does and check what the dashboard says, without needing a deployment.
 */
async function startSignedIn(page: Page) {
  await page.addInitScript((session) => {
    window.__E2E_SESSION__ = session;
  }, CUSTOMER_SESSION);
}

/** Registers after the fixture's healthy route, so Playwright matches this one. */
async function answerProbe(
  page: Page,
  body: unknown,
  status = 200,
) {
  await page.route("**/api/query", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

test.describe("backend health notice", () => {
  test("explains a deployment that answers but runs no functions", async ({
    page,
  }) => {
    await startSignedIn(page);
    // The exact answer the production deployment gave on 24 Oct 2026.
    await answerProbe(page, {
      status: "error",
      errorMessage: "[Request ID: e2e-dead] Server Error",
    });

    await page.goto("/dashboard");

    const notice = page.getByRole("alert");
    await expect(notice).toBeVisible();
    await expect(
      notice.getByText("The backend is not serving this app."),
    ).toBeVisible();
    await expect(
      notice.getByText(/Deploy Convex functions workflow/),
    ).toBeVisible();
    await expect(notice.getByText("Server Error", { exact: true })).toBeVisible();
    await expect(
      notice.getByRole("button", { name: "Check again" }),
    ).toBeVisible();
  });

  test("does not pin a verdict on one failed probe", async ({ page }) => {
    await startSignedIn(page);
    // A deployment restarting or mid-deploy answers the first call with an
    // error and the next one normally; the notice must not latch on the first.
    let calls = 0;
    await page.route("**/api/query", (route) => {
      calls += 1;
      const body =
        calls === 1
          ? { status: "error", errorMessage: "[Request ID: e2e-flaky] Server Error" }
          : { status: "success", value: { ok: true } };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(calls).toBeGreaterThan(1);
  });

  test("names a paused deployment and says what to do", async ({ page }) => {
    await startSignedIn(page);
    await answerProbe(page, {
      status: "error",
      errorMessage:
        "[Request ID: e2e-paused] Cannot run functions while this deployment is paused. Resume the deployment in the dashboard settings to allow functions to run.",
    });

    await page.goto("/dashboard");

    const notice = page.getByRole("alert");
    await expect(
      notice.getByText("The Convex deployment is paused."),
    ).toBeVisible();
    await expect(notice.getByText(/Resume it in the Convex dashboard/)).toBeVisible();
  });

  test("explains an unreachable deployment", async ({ page }) => {
    await startSignedIn(page);
    // An HTML body, the way a plain host answers an unknown /api/query path. A
    // 5xx or an aborted request would also land in the console-error guard the
    // shared fixture applies to every scenario.
    await answerProbe(page, "<!doctype html><title>not convex</title>");

    await page.goto("/dashboard");

    await expect(
      page.getByRole("alert").getByText("This dashboard cannot reach Convex."),
    ).toBeVisible();
  });

  test("stays quiet when the backend works and outside the dashboard", async ({
    page,
  }) => {
    await startSignedIn(page);
    // The fixture answers the probe as a healthy deployment.

    await page.goto("/dashboard");
    await expect(page.getByText("The backend is not serving this app.")).toHaveCount(
      0,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
