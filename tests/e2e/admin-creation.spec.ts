import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

/**
 * The staff creation flows, rendered by the real pages and router. The Convex
 * client is the suite's double: this spec opts into canned results for just the
 * queries the screens need, so the dialogs mount with real option lists.
 * Submission is not exercised here - the server behaviour is covered by
 * convex-test in `tests/policies.test.ts`.
 */
const FIXTURES: Record<string, unknown> = {
  "customers.directory": {
    rows: [
      {
        _id: "profile-1",
        userId: "user-1",
        reference: "CUS-AAAAA",
        fullName: "Morgan Ellis",
        email: "morgan@example.com",
        country: "GB",
        createdAt: Date.UTC(2026, 9, 20),
        verificationStatus: "unverified",
        accountStatus: "active",
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
    hasMore: false,
  },
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    categories: [],
    currencies: [{ code: "GBP", name: "Pound sterling", active: true }],
  },
  "policies.listStaff": { rows: [], total: 0, page: 1, pageSize: 10, hasMore: false },
  "policies.requests": [],
  "policies.customerOptions": [
    {
      userId: "user-1",
      name: "Morgan Ellis",
      email: "morgan@example.com",
      reference: "CUS-AAAAA",
      country: "GB",
      currency: "GBP",
      hasProfile: true,
    },
  ],
  "policies.productOptions": [
    {
      _id: "product-1",
      name: "Mineral all-risk",
      code: "MINERAL-ALLRISK",
      version: 1,
      currency: "GBP",
      termMonths: 12,
      coverageLimit: 500_000_000,
      excess: 50_000,
      basePremium: 120_000,
      countries: ["GB"],
      renewalNoticeDays: 30,
      wordingVersion: "2026.1",
    },
  ],
  "settings.get": {
    companyName: "Cosmic Vault Insurance",
    supportEmail: "concierge@cosmicvault.co",
    defaultCurrency: "GBP",
    commissionEnabled: false,
    renewalNoticeDays: 30,
    claimSlaDays: 10,
    bankAccountName: "",
    bankIban: "",
    bankSortCode: "",
    bankSwift: "",
    allowedCurrencies: ["GBP"],
    emailTemplates: [],
  },
  "staff.list": [],
  "notifications.deliveryIssues": { failed: [], skipped: [] },
};

async function startAs(
  page: Page,
  session: { role: "super_admin" | "admin"; permissions: string[] },
) {
  await page.addInitScript(
    ({ fixtures, value }) => {
      window.__E2E_SESSION__ = {
        _id: `e2e-${value.role}`,
        name: "Vault Staff",
        email: "staff@example.com",
        role: value.role,
        permissions: value.permissions,
      };
      window.__E2E_FIXTURES__ = fixtures;
    },
    { fixtures: FIXTURES, value: session },
  );
  await page.goto("/dashboard");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
}

test.describe("admin creation flows", () => {
  test("a customer invitation can be started from the directory", async ({
    page,
  }) => {
    await startAs(page, { role: "super_admin", permissions: [] });
    await page.goto("/dashboard/admin/customers");

    await page.getByRole("button", { name: "New customer" }).click();
    await expect(
      page.getByRole("heading", { name: "Invite a customer" }),
    ).toBeVisible();

    await page.getByLabel("Full name").fill("Morgan Ellis");
    await page.getByLabel("Email address").fill("morgan@example.com");

    await expect(
      page.getByRole("button", { name: "Invite customer" }),
    ).toBeEnabled();
  });

  test("a policy can be started from the register", async ({ page }) => {
    await startAs(page, { role: "super_admin", permissions: [] });
    await page.goto("/dashboard/admin/policies");

    await page.getByRole("button", { name: "New policy" }).click();
    await expect(
      page.getByRole("heading", { name: "Issue a policy" }),
    ).toBeVisible();

    await page.getByLabel("Customer", { exact: true }).selectOption("user-1");
    await page.getByLabel("Published product").selectOption("product-1");

    // The product choice fills the premium and the derived term summary.
    await expect(page.getByLabel("Premium (GBP)")).toHaveValue("1200.00");
    await expect(page.getByText("Policy ends")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Issue policy" }),
    ).toBeEnabled();
  });

  test("only a super admin is offered the staff invitation", async ({ page }) => {
    await startAs(page, { role: "super_admin", permissions: [] });
    await page.goto("/dashboard/admin/settings");

    await expect(page.getByText("Create a staff account")).toBeVisible();
    await page.getByPlaceholder("Full name").last().fill("Noor Admin");
    await page.getByPlaceholder("name@example.com").fill("noor@example.com");
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

    await page.addInitScript(
      ({ fixtures }) => {
        window.__E2E_SESSION__ = {
          _id: "e2e-limited-admin",
          name: "Limited Admin",
          email: "limited@example.com",
          role: "admin",
          permissions: ["settings.manage", "staff.manage"],
        };
        window.__E2E_FIXTURES__ = fixtures;
      },
      { fixtures: FIXTURES },
    );
    await page.goto("/dashboard/admin/settings");
    await expect(page.getByText("Create a staff account")).toHaveCount(0);
  });
});
