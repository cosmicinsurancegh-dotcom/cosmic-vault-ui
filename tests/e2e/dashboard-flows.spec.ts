import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { CUSTOMER_SESSION } from "./stubs/session";

/**
 * Dashboard coverage: a signed-in customer can open every route in their nav,
 * and the role/permission gates keep them out of staff areas. The Convex stub
 * returns no data, so each page must render its own loading state - that is
 * proof the route module mounted rather than the shell sitting on a 404.
 */
async function startSignedIn(page: Page, session = CUSTOMER_SESSION) {
  await page.addInitScript((value) => {
    window.__E2E_SESSION__ = value;
  }, session);
  await page.goto("/dashboard");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
}

const CUSTOMER_ROUTES: { path: string; ready: string }[] = [
  { path: "/dashboard/catalogue", ready: "Loading the catalogue" },
  { path: "/dashboard/quotes", ready: "Loading quotations" },
  { path: "/dashboard/applications", ready: "Loading applications" },
  { path: "/dashboard/policies", ready: "Loading policies" },
  { path: "/dashboard/minerals", ready: "Loading your minerals" },
  { path: "/dashboard/claims", ready: "Loading claims" },
  { path: "/dashboard/payments", ready: "Loading payments" },
  { path: "/dashboard/documents", ready: "Loading documents" },
  { path: "/dashboard/support", ready: "Loading support" },
  { path: "/dashboard/profile", ready: "Loading profile" },
];

test.describe("customer dashboard", () => {
  test("every route in the sidebar opens and renders its own screen", async ({
    page,
  }) => {
    await startSignedIn(page);

    for (const route of CUSTOMER_ROUTES) {
      await page.goto(route.path);
      await expect.poll(() => new URL(page.url()).pathname).toBe(route.path);
      await expect(page.getByText(route.ready, { exact: false })).toBeVisible();
      await expect(page.getByText("Page not found")).toHaveCount(0);
      await expect(page.getByText("Preview runtime error")).toHaveCount(0);
      // The dashboard shell is still around the route, not a bare page.
      await expect(
        page.getByRole("button", { name: /sign out/i }).first(),
      ).toBeVisible();
    }
  });

  test("sidebar navigation moves between screens without a reload", async ({
    page,
  }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: /continue as guest/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    await page.getByRole("link", { name: "Policies" }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/policies");
    await expect(page.getByText(/loading policies/i)).toBeVisible();

    await page.getByRole("link", { name: "Overview" }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    // Signing out returns to the public site and drops the session.
    await page
      .getByRole("button", { name: /sign out/i })
      .first()
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("a customer cannot open a staff-only screen", async ({ page }) => {
    await startSignedIn(page);

    await page.goto("/dashboard/admin/claims");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    // The staff screen never mounts; the customer lands on their own overview.
    await expect(page.getByText(/claims queue/i)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /sign out/i }).first(),
    ).toBeVisible();
  });
});

test.describe("staff permissions", () => {
  test("an admin without the permission sees the access gate", async ({
    page,
  }) => {
    await startSignedIn(page, {
      _id: "e2e-limited-admin",
      name: "Limited Admin",
      email: "limited@example.com",
      role: "admin",
      permissions: ["customers.view"],
    });

    await page.goto("/dashboard/admin/settings");
    await expect(page.getByText("Access restricted")).toBeVisible();
    await expect(
      page.getByText(/does not include the permission/i),
    ).toBeVisible();
  });

  test("an admin with the permission sees the screen", async ({ page }) => {
    await startSignedIn(page, {
      _id: "e2e-limited-admin",
      name: "Limited Admin",
      email: "limited@example.com",
      role: "admin",
      permissions: ["customers.view"],
    });

    await page.goto("/dashboard/admin/customers");
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/admin/customers");
    await expect(page.getByText(/loading customers/i)).toBeVisible();
    await expect(page.getByText("Access restricted")).toHaveCount(0);
  });

  test("the mineral console is gated on policies.manage", async ({ page }) => {
    await startSignedIn(page, {
      _id: "e2e-limited-admin",
      name: "Limited Admin",
      email: "limited@example.com",
      role: "admin",
      permissions: ["customers.view"],
    });

    await page.goto("/dashboard/admin/minerals");
    await expect(page.getByText("Access restricted")).toBeVisible();

    await startSignedIn(page, {
      _id: "e2e-ops-admin",
      name: "Ops Admin",
      email: "ops@example.com",
      role: "admin",
      permissions: ["customers.view", "policies.manage"],
    });
    await page.goto("/dashboard/admin/minerals");
    await expect(page.getByText(/loading minerals/i)).toBeVisible();
    await expect(page.getByText("Access restricted")).toHaveCount(0);
  });
});
