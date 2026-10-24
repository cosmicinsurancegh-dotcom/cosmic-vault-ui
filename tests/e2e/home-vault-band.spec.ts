import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The band on a member's home reads the same live minerals as `/dashboard/vault`.
 * This spec drives the real page against the Convex double: the totals come from
 * the assigned records, the featured holdings are the highest declared values,
 * an empty account gets an invitation, and no screen can load a sample
 * collection into the browser any more.
 */
const MEMBER_SESSION: E2ESession = {
  _id: "e2e-band-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const MEMBER_ID = MEMBER_SESSION._id;
const CREATED_AT = Date.UTC(2026, 5, 2);
const ENDS_AT = Date.UTC(2027, 5, 2);
const ETA = Date.UTC(2026, 5, 20);

const OVERVIEW = {
  kind: "customer",
  defaultCurrency: "GBP",
  metrics: {
    activePolicies: 0,
    pendingApplications: 0,
    openClaims: 0,
    pendingRequests: 0,
  },
  outstanding: [],
  renewals: [],
  recentPolicies: [],
  infoRequests: [],
  recentDocuments: [],
  recentClaims: [],
  recentTransactions: [],
  notifications: [],
  unreadNotifications: 0,
};

const ROWS = [
  {
    mineral: {
      _id: "e2e-band-vault-1",
      name: "Aurum bar",
      reference: "CV-MIN-7001",
      category: "Gold",
      quantity: 1,
      unit: "kg",
      declaredValue: 7800000,
      currency: "GBP",
      status: "active",
      assignedUserId: MEMBER_ID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    policy: {
      _id: "e2e-band-policy-1",
      mineralId: "e2e-band-vault-1",
      policyNumber: "POL-7001",
      provider: "Lloyd's of London",
      coverage: "all_risk",
      coverageLimit: 9000000,
      premium: 45000,
      currency: "GBP",
      startDate: CREATED_AT,
      endDate: ENDS_AT,
      status: "active",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    shipment: {
      _id: "e2e-band-shipment-1",
      mineralId: "e2e-band-vault-1",
      reference: "CV-SHP-7001",
      carrier: "Brink's",
      trackingNumber: "BR-7701-01",
      origin: "London vault",
      destination: "Zurich vault",
      status: "in_transit",
      currentLocation: "Basel, CH",
      estimatedArrivalAt: ETA,
      assignedUserId: MEMBER_ID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      lastStatusAt: CREATED_AT,
    },
    events: [],
  },
  {
    mineral: {
      _id: "e2e-band-vault-2",
      name: "Silver ingot",
      reference: "CV-MIN-7002",
      category: "Silver",
      quantity: 2,
      unit: "kg",
      declaredValue: 180000,
      currency: "GBP",
      status: "active",
      assignedUserId: MEMBER_ID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    policy: null,
    shipment: null,
    events: [],
  },
];

async function startSignedIn(page: Page, rows: unknown = ROWS) {
  await page.addInitScript(
    ({ session, fixtures }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
    },
    {
      session: MEMBER_SESSION,
      fixtures: { "minerals.mine": rows, "reports.overview": OVERVIEW },
    },
  );
}

test.describe("member home vault band", () => {
  test("summarises the holdings staff assigned, not a local sample", async ({
    page,
  }) => {
    await startSignedIn(page);
    await page.goto("/dashboard");

    const band = page.locator("section").filter({ hasText: "Vault holdings" });

    await expect(
      band.getByRole("heading", { level: 2, name: /2 objects\./ }),
    ).toBeVisible();
    // Only the insured record contributes cover (£90,000.00).
    await expect(band.getByText("£90,000.00")).toBeVisible();
    await expect(band.getByText("of 2")).toBeVisible();
    // Declared values add up across every holding (£78,000 + £1,800).
    await expect(band.getByText("£79,800.00")).toBeVisible();
    await expect(band.getByText("shipment", { exact: true })).toBeVisible();

    // The two featured tiles are the live records with their shipping state.
    await expect(band.getByText("Aurum bar")).toBeVisible();
    await expect(band.getByText("In transit")).toBeVisible();
    await expect(band.getByText("Silver ingot")).toBeVisible();
    await expect(band.getByText("In vault")).toBeVisible();

    // The demonstration collection is gone, and nothing was written locally.
    await expect(
      page.getByRole("button", { name: /Load demonstration collection/ }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => window.localStorage.getItem("cosmic-vault.minerals.v1")),
    ).toBeNull();

    expect(
      await page.evaluate(() => window.__E2E_QUERY_CALLS__ ?? []),
    ).toContain("minerals.mine");
  });

  test("matches the totals on the member vault page", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard");
    const band = page.locator("section").filter({ hasText: "Vault holdings" });
    await expect(band.getByText("£90,000.00")).toBeVisible();

    await page.goto("/dashboard/vault");
    await expect(page.getByText("Insured value")).toBeVisible();
    await expect(page.getByText("£90,000.00", { exact: true })).toBeVisible();
    await expect(page.getByText("1 insured · 1 without cover")).toBeVisible();
  });

  test("invites an empty account to open the vault", async ({ page }) => {
    await startSignedIn(page, []);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "The first object makes the record.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the vault" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Talk to the vault desk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Load demonstration collection/ }),
    ).toHaveCount(0);
  });
});
