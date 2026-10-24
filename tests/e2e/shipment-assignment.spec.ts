import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The staff shipment console reads the live mineral register, so this spec
 * drives the real page against the Convex double: assign an ownerless
 * consignment, publish a status change, cancel safely, and prove the screen is
 * gated for staff who cannot manage mineral records.
 */
const ADMIN_SESSION: E2ESession = {
  _id: "e2e-shipment-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage", "vault.manage"],
};

/** Staff who can reach the vault console but cannot manage minerals. */
const VAULT_ONLY_SESSION: E2ESession = {
  _id: "e2e-vault-only",
  name: "Vault Keeper",
  email: "vault@example.com",
  role: "admin",
  permissions: ["vault.manage"],
};

const OWNED_MINERAL_ID = "e2e-ship-mineral-1";
const UNASSIGNED_MINERAL_ID = "e2e-ship-mineral-2";
const OWNED_SHIPMENT_ID = "e2e-ship-1";
const UNASSIGNED_SHIPMENT_ID = "e2e-ship-2";
const ADA_ID = "e2e-user-ada";
const TOMAS_ID = "e2e-user-tomas";

const CREATED_AT = Date.UTC(2026, 2, 4);
const ETA = Date.UTC(2026, 2, 18);

const ADA = {
  _id: ADA_ID,
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  status: "active",
};

const OWNED_MINERAL = {
  _id: OWNED_MINERAL_ID,
  name: "Aurum bar",
  reference: "CV-MIN-1001",
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
  reference: "CV-MIN-1002",
  category: "Silver",
  quantity: 2,
  unit: "kg",
  declaredValue: 180000,
  currency: "GBP",
  status: "active",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const OWNED_SHIPMENT = {
  _id: OWNED_SHIPMENT_ID,
  mineralId: OWNED_MINERAL_ID,
  reference: "CV-SHP-2001",
  carrier: "Brink's",
  trackingNumber: "BR-4471-88",
  origin: "London vault",
  destination: "Zurich vault",
  status: "in_transit",
  currentLocation: "Basel, CH",
  estimatedArrivalAt: ETA,
  assignedUserId: ADA_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  lastStatusAt: CREATED_AT,
};

const UNASSIGNED_SHIPMENT = {
  _id: UNASSIGNED_SHIPMENT_ID,
  mineralId: UNASSIGNED_MINERAL_ID,
  reference: "CV-SHP-2002",
  carrier: "Malca-Amit",
  trackingNumber: "MA-9021-14",
  origin: "London vault",
  destination: "Antwerp vault",
  status: "preparing",
  currentLocation: "London vault",
  estimatedArrivalAt: ETA,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  lastStatusAt: CREATED_AT,
};

const FIXTURES: Record<string, unknown> = {
  "minerals.list": [
    {
      mineral: OWNED_MINERAL,
      policy: null,
      shipment: OWNED_SHIPMENT,
      assignee: { _id: ADA_ID, name: ADA.name, email: ADA.email },
    },
    {
      mineral: UNASSIGNED_MINERAL,
      policy: null,
      shipment: UNASSIGNED_SHIPMENT,
      assignee: null,
    },
  ],
  "minerals.assigneeOptions": [
    {
      userId: ADA_ID,
      name: ADA.name,
      email: ADA.email,
      role: "customer",
      reference: "CV-CUST-1001",
      status: "active",
    },
    {
      userId: TOMAS_ID,
      name: "Tomas Berg",
      email: "tomas@example.com",
      role: "customer",
      reference: "CV-CUST-1002",
      status: "active",
    },
  ],
};

test.describe("staff shipment control", () => {
  test("assigns an ownerless consignment to an account", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");

    await expect(
      page.getByRole("heading", { name: "Every consignment, under control." }),
    ).toBeVisible();
    await expect(page.getByText("CV-SHP-2001")).toBeVisible();
    await expect(page.getByText("CV-SHP-2002")).toBeVisible();
    const row = page.locator("article").filter({ hasText: "CV-SHP-2002" });
    await expect(row.getByText("Unassigned")).toBeVisible();
    await row.getByRole("button", { name: "Assign", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Assign this consignment" }),
    ).toBeVisible();
    await dialog.getByLabel("New owner").selectOption(TOMAS_ID);
    await dialog
      .getByLabel("Reason for the assignment")
      .fill("Intake sheet named the wrong client.");
    await dialog
      .getByRole("button", { name: "Assign to this account" })
      .click();

    await expect(
      page.getByText("Consignment assigned. The new owner has been emailed."),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const reassign = calls.filter((call) => call.ref === "minerals.reassign");
    expect(reassign).toHaveLength(1);
    expect(reassign[0]?.args).toEqual({
      mineralId: UNASSIGNED_MINERAL_ID,
      assignment: { mode: "existing", userId: TOMAS_ID },
      note: "Intake sheet named the wrong client.",
    });
  });

  test("cancelling the assign dialog sends nothing", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2002" });
    await row.getByRole("button", { name: "Assign", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New owner").selectOption(TOMAS_ID);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(calls).toEqual([]);
  });

  test("publishes a shipment status change for the owner", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    await row
      .getByLabel("Update shipment status for Aurum bar")
      .selectOption("delivered");

    await expect(
      page.getByText("Aurum bar is now delivered."),
    ).toBeVisible();

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const update = calls.filter(
      (call) => call.ref === "minerals.updateShipmentStatus",
    );
    expect(update).toHaveLength(1);
    expect(update[0]?.args).toEqual({
      shipmentId: OWNED_SHIPMENT_ID,
      status: "delivered",
    });
  });

  test("staff without policies.manage get no consignment data", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_QUERY_CALLS__ = [];
      },
      { session: VAULT_ONLY_SESSION },
    );

    await page.goto("/dashboard/admin/shipments");

    await expect(page.getByText("Access restricted")).toBeVisible();
    await expect(page.getByText("CV-SHP-2001")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Assign", exact: true }),
    ).toHaveCount(0);

    const queries = await page.evaluate(
      () => window.__E2E_QUERY_CALLS__ ?? [],
    );
    expect(queries.filter((ref) => ref.startsWith("minerals."))).toEqual([]);
  });
});
