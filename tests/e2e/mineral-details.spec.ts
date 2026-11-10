import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * Staff backfill the details a certificate prints from the mineral record, so a
 * holding taken in before its assay arrived can still issue a complete
 * certificate. The write is covered by `tests/minerals.test.ts`; this drives the
 * dialog and the request it sends.
 */
const ADMIN_SESSION: E2ESession = {
  _id: "e2e-details-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage"],
};

const MEMBER = {
  _id: "e2e-details-member",
  name: "Ada Vault",
  email: "ada@example.com",
};

const MINERAL_ID = "e2e-details-mineral-1";
const CREATED_AT = Date.UTC(2026, 4, 6);

const MINERAL = {
  _id: MINERAL_ID,
  name: "Aurum bar",
  reference: "CV-MIN-5001",
  category: "Gold",
  dimensions: "115 x 52 x 9 mm",
  purity: "999.9",
  grade: "24 ct",
  storageLocation: "Bay 4 · Shelf C",
  quantity: 1,
  unit: "kg",
  declaredValue: 7800000,
  currency: "GBP",
  status: "active",
  assignedUserId: MEMBER._id,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const FIXTURES: Record<string, unknown> = {
  // The page holds the register back until the currencies it offers resolve.
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    categories: [],
    currencies: [{ code: "GBP", name: "Pound sterling", active: true }],
  },
  "minerals.list": [
    { mineral: MINERAL, policy: null, shipment: null, assignee: MEMBER },
  ],
  "minerals.detail": {
    mineral: MINERAL,
    policy: null,
    policies: [],
    shipment: null,
    events: [],
    assignee: MEMBER,
  },
};

test.describe("mineral certificate details", () => {
  test("lets staff correct the details a certificate prints", async ({
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

    await page.goto("/dashboard/admin/minerals");
    await page.getByRole("button", { name: "Manage" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Aurum bar" }),
    ).toBeVisible();
    await expect(dialog.getByText("Certificate details")).toBeVisible();
    await expect(dialog.getByText("Purity 999.9")).toBeVisible();

    await dialog.getByRole("button", { name: "Edit details" }).click();
    // The form opens on what the record holds, not on blank fields.
    await expect(dialog.getByLabel("Dimensions")).toHaveValue(
      "115 x 52 x 9 mm",
    );
    await expect(dialog.getByLabel("Purity")).toHaveValue("999.9");
    await expect(dialog.getByLabel("Grade")).toHaveValue("24 ct");
    await expect(dialog.getByLabel("Storage bay")).toHaveValue(
      "Bay 4 · Shelf C",
    );

    await dialog.getByLabel("Dimensions").fill("120 x 50 x 8 mm");
    await dialog.getByLabel("Purity").fill("999.95");
    await dialog.getByLabel("Grade").fill("24 ct · LBMA Good Delivery");
    await dialog.getByLabel("Storage bay").fill("Bay 9 · Shelf D");
    await dialog.getByRole("button", { name: "Save details" }).click();

    await expect(page.getByText("Certificate details saved.")).toBeVisible();

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "minerals.updateDetails")?.args,
    ).toMatchObject({
      mineralId: MINERAL_ID,
      details: {
        dimensions: "120 x 50 x 8 mm",
        purity: "999.95",
        grade: "24 ct · LBMA Good Delivery",
        storageLocation: "Bay 9 · Shelf D",
      },
    });
  });
});
