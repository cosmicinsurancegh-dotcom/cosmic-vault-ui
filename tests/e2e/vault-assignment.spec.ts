import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The staff vault floor now reads the live mineral register, so this spec
 * drives the real page against the Convex double: the record list with its
 * insurance and shipping, assignment of a mineral with everything attached,
 * the cancel path, and the permission gate.
 */
const ADMIN_SESSION: E2ESession = {
  _id: "e2e-vault-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage", "vault.manage"],
};

const LIMITED_SESSION: E2ESession = {
  _id: "e2e-vault-limited",
  name: "Vault Keeper",
  email: "vault@example.com",
  role: "admin",
  permissions: ["vault.manage"],
};

const ADA_ID = "e2e-vault-ada";
const TOMAS_ID = "e2e-vault-tomas";
const OWNED_MINERAL_ID = "e2e-vault-mineral-1";
const UNASSIGNED_MINERAL_ID = "e2e-vault-mineral-2";
const CREATED_AT = Date.UTC(2026, 4, 6);
const ETA = Date.UTC(2026, 4, 24);

const ADA = { _id: ADA_ID, name: "Ada Vault", email: "ada@example.com" };

const OWNED_MINERAL = {
  _id: OWNED_MINERAL_ID,
  name: "Aurum bar",
  reference: "CV-MIN-4001",
  category: "Gold",
  quantity: 1,
  unit: "kg",
  declaredValue: 7800000,
  currency: "GBP",
  status: "active",
  assignedUserId: ADA_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const UNASSIGNED_MINERAL = {
  _id: UNASSIGNED_MINERAL_ID,
  name: "Silver ingot",
  reference: "CV-MIN-4002",
  category: "Silver",
  quantity: 2,
  unit: "kg",
  declaredValue: 180000,
  currency: "GBP",
  status: "active",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const POLICY = {
  _id: "e2e-vault-policy-1",
  mineralId: OWNED_MINERAL_ID,
  policyNumber: "POL-8801",
  provider: "Lloyd's of London",
  coverage: "all_risk",
  coverageLimit: 9000000,
  premium: 45000,
  currency: "GBP",
  startDate: CREATED_AT,
  endDate: Date.UTC(2027, 4, 6),
  status: "active",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const SHIPMENT = {
  _id: "e2e-vault-shipment-1",
  mineralId: OWNED_MINERAL_ID,
  reference: "CV-SHP-4001",
  carrier: "Brink's",
  trackingNumber: "BR-9910-22",
  origin: "London vault",
  destination: "Zurich vault",
  status: "in_transit",
  currentLocation: "Paris, FR",
  estimatedArrivalAt: ETA,
  assignedUserId: ADA_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  lastStatusAt: CREATED_AT,
};

const FIXTURES: Record<string, unknown> = {
  "minerals.list": [
    {
      mineral: OWNED_MINERAL,
      policy: POLICY,
      shipment: SHIPMENT,
      assignee: ADA,
    },
    {
      mineral: UNASSIGNED_MINERAL,
      policy: null,
      shipment: null,
      assignee: null,
    },
  ],
  "minerals.assigneeOptions": [
    {
      userId: ADA_ID,
      name: ADA.name,
      email: ADA.email,
      role: "customer",
      reference: "CV-CUST-4001",
      status: "active",
    },
    {
      userId: TOMAS_ID,
      name: "Tomas Berg",
      email: "tomas@example.com",
      role: "customer",
      reference: "CV-CUST-4002",
      status: "active",
    },
  ],
};

test.describe("staff vault floor", () => {
  test("assigns a mineral with its insurance and shipping to a customer", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/vault");

    await expect(
      page.getByRole("heading", { name: "The vault floor." }),
    ).toBeVisible();
    await expect(page.getByText("Aurum bar")).toBeVisible();
    await expect(page.getByText("POL-8801")).toBeVisible();
    await expect(page.getByText("CV-SHP-4001")).toBeVisible();

    const unassignedRow = page
      .locator("article")
      .filter({ hasText: "Silver ingot" });
    await expect(unassignedRow.getByText("Unassigned")).toBeVisible();
    await expect(unassignedRow.getByText("No policy")).toBeVisible();
    await expect(unassignedRow.getByText("In vault")).toBeVisible();

    // The insurance filter narrows the register to records without a policy.
    await page.getByLabel("Filter by insurance").selectOption("none");
    await expect(page.getByText("Aurum bar")).toHaveCount(0);
    await expect(page.getByText("Silver ingot")).toBeVisible();
    await page.getByLabel("Filter by insurance").selectOption("all");

    await unassignedRow
      .getByRole("button", { name: "Assign", exact: true })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Assign this mineral" }),
    ).toBeVisible();
    await dialog.getByLabel("New owner").selectOption(TOMAS_ID);
    await dialog
      .getByLabel("Reason for the assignment")
      .fill("Intake recorded against the wrong account.");
    await dialog
      .getByRole("button", { name: "Assign to this account" })
      .click();

    await expect(
      page.getByText("Assigned. The new owner has been emailed."),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const reassign = calls.filter((call) => call.ref === "minerals.reassign");
    expect(reassign).toHaveLength(1);
    expect(reassign[0]?.args).toEqual({
      mineralId: UNASSIGNED_MINERAL_ID,
      assignment: { mode: "existing", userId: TOMAS_ID },
      note: "Intake recorded against the wrong account.",
    });
  });

  test("reassigning an owned record explains what moves with it", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/vault");
    const ownedRow = page.locator("article").filter({ hasText: "Aurum bar" });
    await ownedRow.getByRole("button", { name: "Reassign" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/1 consignment/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(calls).toEqual([]);
  });

  test("staff without policies.manage get no vault data", async ({ page }) => {
    await page.addInitScript(
      ({ session }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_QUERY_CALLS__ = [];
      },
      { session: LIMITED_SESSION },
    );

    await page.goto("/dashboard/admin/vault");

    await expect(page.getByText("Access restricted")).toBeVisible();
    await expect(page.getByText("Aurum bar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Assign", exact: true }),
    ).toHaveCount(0);

    const queries = await page.evaluate(
      () => window.__E2E_QUERY_CALLS__ ?? [],
    );
    expect(queries.filter((ref) => ref.startsWith("minerals."))).toEqual([]);
  });
});
