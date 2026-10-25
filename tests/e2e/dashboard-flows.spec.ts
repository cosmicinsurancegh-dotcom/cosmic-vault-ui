import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { ADMIN_SESSION, CUSTOMER_SESSION } from "./stubs/session";

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

/**
 * A minimal staff snapshot for `reports.board`: enough shape for the Command
 * Centre to render its header, pulse and empty line cards. Without it the
 * overview stops at its skeleton and the header never mounts.
 */
const STAFF_BOARD: Record<string, unknown> = {
  scope: "company",
  currency: "GBP",
  months: 12,
  asOf: Date.UTC(2026, 9, 25),
  canSeeMoney: true,
  otherCurrencies: 0,
  kpis: {
    premiumInForce: 120000,
    activePolicies: 24,
    openClaims: 2,
    renewalsDue: 3,
    pendingApplications: 1,
    customers: 40,
    collected: 90000,
    newBusiness: 15000,
    claimsInWindow: 8000,
    lossRatio: 12,
    avgPremium: 5000,
    newBusinessChange: 10,
    claimsChange: -4,
  },
  monthly: Array.from({ length: 12 }, (_, index) => ({
    label: `${index + 1}/2026`,
    premium: 10000,
    claims: 500,
    collected: 7500,
    newBusiness: 1200,
    policies: 2,
    ratio: 5,
  })),
  lines: [],
  claimsMix: [],
  plans: [],
  recentClaims: [],
  alerts: [],
};

/**
 * The Command Centre speaks three ways: the company book, a broker's book and
 * a member's own cover, each with its own primary action. The header row is the
 * same markup in all three, so each variant has to keep its controls level.
 */
const HEADER_SCOPES = [
  { scope: "company", primary: "Review underwriting" },
  { scope: "book", primary: "New quotation" },
  { scope: "member", primary: "Explore cover" },
] as const;

test.describe("staff command centre", () => {
  for (const variant of HEADER_SCOPES) {
    test(`the ${variant.scope} header controls share one height on one row`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ session, fixtures }) => {
          window.__E2E_SESSION__ = session;
          window.__E2E_FIXTURES__ = fixtures;
        },
        {
          session: ADMIN_SESSION,
          fixtures: {
            "reports.board": { ...STAFF_BOARD, scope: variant.scope },
          },
        },
      );

      await page.goto("/dashboard");
      await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

      /* The range switch, "Add mineral" and the primary action are one control
         row: same height, same baseline, so the row reads as a single group. */
      const range = page.getByRole("group", { name: "Chart range" });
      await expect(range).toBeVisible();
      /* Scoped to the header row: the empty state repeats the primary action. */
      const row = range.locator("..");
      const controls = [
        range,
        row.getByRole("link", { name: "Add mineral" }),
        row.getByRole("link", { name: variant.primary }),
      ];
      for (const control of controls) await expect(control).toBeVisible();

      const boxes = await Promise.all(
        controls.map((item) => item.boundingBox()),
      );
      const heights = boxes.map((box) => Math.round(box?.height ?? 0));
      const offsets = boxes.map((box) => Math.round(box?.y ?? -1));
      expect(heights).toEqual([40, 40, 40]);
      expect(new Set(offsets).size).toBe(1);
    });
  }
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

  /**
   * The payments route is shared between customers and staff. Its "my
   * applications" and "my policy requests" queries are self-service only, so
   * the page has to skip them for a staff viewer instead of letting the
   * rejected query break the screen.
   */
  test("a staff member can open the shared payments route", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.__E2E_SESSION__ = {
        _id: "e2e-ops-admin",
        name: "Ops Admin",
        email: "ops@example.com",
        role: "admin",
        permissions: ["payments.view"],
      };
      window.__E2E_FIXTURES__ = { "payments.mine": [] };
    });
    await page.goto("/dashboard/payments");

    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/payments");
    await expect(
      page.getByText("Every amount, accounted for.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Loading payments")).toHaveCount(0);
    await expect(page.getByText("Preview runtime error")).toHaveCount(0);
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
