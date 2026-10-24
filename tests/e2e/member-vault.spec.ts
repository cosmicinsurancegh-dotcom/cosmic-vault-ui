import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The member vault now reads the minerals staff assign to the account, so this
 * spec drives the real page against the Convex double: assigned holdings with
 * their insurance and shipment events, the filters, and the empty state.
 */
const MEMBER_SESSION: E2ESession = {
  _id: "e2e-vault-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const MEMBER_ID = MEMBER_SESSION._id;
const CREATED_AT = Date.UTC(2026, 5, 2);
const ENDS_AT = Date.UTC(2027, 5, 2);
const ETA = Date.UTC(2026, 5, 20);

const POLICY = {
  _id: "e2e-member-policy-1",
  mineralId: "e2e-member-vault-1",
  policyNumber: "POL-9001",
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
};

const ROWS = [
  {
    mineral: {
      _id: "e2e-member-vault-1",
      name: "Aurum bar",
      reference: "CV-MIN-5001",
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
    policy: POLICY,
    shipment: {
      _id: "e2e-member-vault-shipment-1",
      mineralId: "e2e-member-vault-1",
      reference: "CV-SHP-5001",
      carrier: "Brink's",
      trackingNumber: "BR-5510-07",
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
    events: [
      {
        _id: "e2e-member-vault-event-1",
        status: "in_transit",
        location: "Basel, CH",
        note: "Cleared customs in Basel.",
        createdAt: CREATED_AT + 2000,
      },
    ],
  },
  {
    mineral: {
      _id: "e2e-member-vault-2",
      name: "Silver ingot",
      reference: "CV-MIN-5002",
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
    { session: MEMBER_SESSION, fixtures: { "minerals.mine": rows } },
  );
}

test.describe("member vault", () => {
  test("shows the minerals assigned by staff with their cover and shipment", async ({
    page,
  }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/vault");

    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening), Ada\./,
      }),
    ).toBeVisible();

    const aurum = page.locator("section").filter({ hasText: "CV-MIN-5001" });
    const silver = page.locator("section").filter({ hasText: "CV-MIN-5002" });

    await expect(aurum.getByText("Aurum bar")).toBeVisible();
    await expect(aurum.getByText("POL-9001")).toBeVisible();
    await expect(aurum.getByText(/cover limit/)).toBeVisible();
    await expect(aurum.getByText("CV-SHP-5001")).toBeVisible();
    await expect(aurum.getByText(/London vault → Zurich vault/)).toBeVisible();
    await expect(aurum.getByText(/Cleared customs in Basel\./)).toBeVisible();

    await expect(silver.getByText("Silver ingot")).toBeVisible();
    await expect(
      silver.getByText("No policy has been recorded for this mineral."),
    ).toBeVisible();
    await expect(
      silver.getByText("Held in the vault. No consignment has been arranged."),
    ).toBeVisible();

    await expect(page.getByText(/of 2 insured/)).toBeVisible();

    // Members never get staff controls.
    await expect(
      page.getByRole("button", { name: "Assign", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Access restricted")).toHaveCount(0);

    // Insurance filter.
    await page.getByLabel("Filter by insurance status").selectOption("uninsured");
    await expect(aurum).toHaveCount(0);
    await expect(silver.getByText("Silver ingot")).toBeVisible();
    await page.getByLabel("Filter by insurance status").selectOption("all");

    // Search across policy and tracking details.
    await page.getByLabel("Search minerals").fill("BR-5510");
    await expect(aurum.getByText("Aurum bar")).toBeVisible();
    await expect(silver).toHaveCount(0);
  });

  test("explains an empty vault", async ({ page }) => {
    await startSignedIn(page, []);
    await page.goto("/dashboard/vault");

    await expect(page.getByText("No minerals assigned yet.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Talk to the vault desk" }),
    ).toBeVisible();
  });

  test("filters by shipping status", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/vault");

    const aurum = page.locator("section").filter({ hasText: "CV-MIN-5001" });
    const silver = page.locator("section").filter({ hasText: "CV-MIN-5002" });

    await page.getByLabel("Filter by shipping status").selectOption("in_vault");
    await expect(silver.getByText("Silver ingot")).toBeVisible();
    await expect(aurum).toHaveCount(0);

    await page.getByLabel("Filter by shipping status").selectOption("all");
    await expect(aurum.getByText("Aurum bar")).toBeVisible();
  });
});
