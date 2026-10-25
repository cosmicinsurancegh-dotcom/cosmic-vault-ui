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
  // The register carries the current shipment; the detail record carries its history.
  "minerals.detail": {
    mineral: OWNED_MINERAL,
    policy: null,
    policies: [],
    shipment: OWNED_SHIPMENT,
    events: [
      {
        _id: "e2e-ship-event-1",
        shipmentId: OWNED_SHIPMENT_ID,
        mineralId: OWNED_MINERAL_ID,
        status: "in_transit",
        fromStatus: "preparing",
        location: "Basel, CH",
        note: "Cleared customs in Basel.",
        actorId: ADMIN_SESSION._id,
        actorRole: "admin",
        createdAt: CREATED_AT + 2000,
      },
      {
        _id: "e2e-ship-event-2",
        shipmentId: OWNED_SHIPMENT_ID,
        mineralId: OWNED_MINERAL_ID,
        status: "preparing",
        location: "London vault",
        note: "Packed under dual control.",
        actorId: ADMIN_SESSION._id,
        actorRole: "admin",
        createdAt: CREATED_AT,
      },
    ],
    assignee: { _id: ADA_ID, name: ADA.name, email: ADA.email },
  },
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
      page.getByText("Assigned. The new owner has been emailed."),
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

  test("opens live tracking with the consignment's history", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });

    await expect(row.getByText("Ada Vault · ada@example.com")).toBeVisible();
    await row
      .getByRole("button", { name: "Show live tracking for CV-SHP-2001" })
      .click();

    const panel = page.locator("#live-e2e-ship-1");
    await expect(
      panel.getByRole("heading", { name: "Live shipment tracking" }),
    ).toBeVisible();
    await expect(panel.getByLabel("Milestones for CV-SHP-2001")).toBeVisible();
    // The history is read only for the row that is open.
    await expect(panel.getByText("Cleared customs in Basel.")).toBeVisible();
    await expect(panel.getByText("Packed under dual control.")).toBeVisible();

    // Staff controls stay on the row, outside the tracking panel.
    await expect(
      row.getByLabel("Update shipment status for Aurum bar"),
    ).toHaveValue("in_transit");
    await expect(
      row.getByRole("button", { name: "Reassign", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#live-e2e-ship-2")).toHaveCount(0);
  });

  test("publishes a status change with its location, note and estimate", async ({
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

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    await row
      .getByLabel("Update shipment status for Aurum bar")
      .selectOption("delivered");

    // The select stages the change: nothing is published until it is confirmed.
    expect(await page.evaluate(() => window.__E2E_MUTATIONS__ ?? [])).toEqual(
      [],
    );

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Publish a status change" }),
    ).toBeVisible();
    await expect(dialog.getByLabel("New status")).toHaveValue("delivered");
    await dialog.getByLabel("Location").fill("Zurich vault");
    await dialog.getByLabel("Estimated delivery").fill("2026-04-02");
    await dialog
      .getByLabel("Note for the owner")
      .fill("Handed to the customer at the vault desk.");
    await dialog.getByRole("button", { name: "Publish update" }).click();

    await expect(page.getByText("Aurum bar is now delivered.")).toBeVisible();
    await expect(dialog).toHaveCount(0);

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const update = calls.filter(
      (call) => call.ref === "minerals.updateShipmentStatus",
    );
    expect(update).toHaveLength(1);
    expect(update[0]?.args).toEqual({
      shipmentId: OWNED_SHIPMENT_ID,
      status: "delivered",
      location: "Zurich vault",
      note: "Handed to the customer at the vault desk.",
      // The date input is read on the machine's clock, like the desk displays it.
      estimatedArrivalAt: new Date(2026, 3, 2).getTime(),
    });
  });

  test("leaves the estimate alone when the date is untouched", async ({
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

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    await row
      .getByLabel("Update shipment status for Aurum bar")
      .selectOption("out_for_delivery");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Estimated delivery")).not.toHaveValue("");
    await dialog.getByRole("button", { name: "Publish update" }).click();
    await expect(
      page.getByText("Aurum bar is now out for delivery."),
    ).toBeVisible();

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const update = calls.filter(
      (call) => call.ref === "minerals.updateShipmentStatus",
    );
    expect(update).toHaveLength(1);
    expect(update[0]?.args).toEqual({
      shipmentId: OWNED_SHIPMENT_ID,
      status: "out_for_delivery",
    });
  });

  test("clears the estimate when staff tick no estimate", async ({ page }) => {
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
      .selectOption("customs_hold");

    const dialog = page.getByRole("dialog");
    const eta = dialog.getByLabel("Estimated delivery");
    await expect(eta).not.toHaveValue("");
    await dialog.getByLabel("No estimate").click();

    // The stored date is withdrawn, so the input cannot suggest keeping it.
    await expect(eta).toHaveValue("");
    await expect(eta).toBeDisabled();

    // Unticking puts the stored date back; ticking again withdraws it.
    await dialog.getByLabel("No estimate").click();
    await expect(eta).not.toHaveValue("");
    await expect(eta).toBeEnabled();
    await dialog.getByLabel("No estimate").click();
    await expect(eta).toBeDisabled();
    await dialog.getByRole("button", { name: "Publish update" }).click();
    await expect(
      page.getByText("Aurum bar is now held at customs."),
    ).toBeVisible();

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const update = calls.filter(
      (call) => call.ref === "minerals.updateShipmentStatus",
    );
    expect(update).toHaveLength(1);
    expect(update[0]?.args).toEqual({
      shipmentId: OWNED_SHIPMENT_ID,
      status: "customs_hold",
      // `null` tells the server to remove the estimate.
      estimatedArrivalAt: null,
    });
  });

  test("cancelling the publish dialog sends nothing", async ({ page }) => {
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
    const select = row.getByLabel("Update shipment status for Aurum bar");
    await select.selectOption("customs_hold");

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    // The row falls back to the published status, not the staged one.
    await expect(select).toHaveValue("in_transit");
    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(calls).toEqual([]);
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

    const queries = await page.evaluate(() => window.__E2E_QUERY_CALLS__ ?? []);
    expect(queries.filter((ref) => ref.startsWith("minerals."))).toEqual([]);
  });
});
