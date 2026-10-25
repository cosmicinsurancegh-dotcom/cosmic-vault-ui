import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The "Add a mineral" dialog records a holding, not a consignment: mineral,
 * policy, then the member who owns it. Only the current step is mounted, each
 * step gates its own Next button, and the save button exists on the last step
 * alone. A shipment is booked later, from the member's request (see
 * shipment-request.spec.ts), so this spec also asserts the save sends no
 * shipment block.
 */
const FIXTURES: Record<string, unknown> = {
  "minerals.list": [],
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    categories: [],
    currencies: [{ code: "GBP", name: "Pound sterling", active: true }],
  },
  "minerals.assigneeOptions": [
    {
      userId: "user-1",
      name: "Morgan Ellis",
      email: "morgan@example.com",
      role: "customer",
    },
  ],
};

const OPS_ADMIN: E2ESession = {
  _id: "e2e-ops-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage"],
};

async function openWizard(page: Page) {
  await page.addInitScript(
    ({ fixtures, session }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
      window.__E2E_MUTATIONS__ = [];
    },
    { fixtures: FIXTURES, session: OPS_ADMIN },
  );
  await page.goto("/dashboard/admin/minerals");
  await page.getByRole("button", { name: "Add mineral" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Add a mineral" }),
  ).toBeVisible();
  return dialog;
}

async function fillMineralStep(dialog: Locator) {
  await dialog.getByLabel("Mineral name").fill("Gold bullion, 999.9");
  await dialog.getByLabel("Category").fill("Precious metals");
  await dialog.getByLabel("Declared value").fill("250000");
}

async function fillPolicyStep(dialog: Locator) {
  await dialog.getByLabel("Policy number").fill("CV-MIN-ROLL-2026-014");
  await dialog.getByLabel("Provider").fill("Cosmic Vault Insurance");
  await dialog.getByLabel("Cover limit (GBP)").fill("500000");
}

test.describe("add mineral wizard", () => {
  test("walks the three steps and saves against an existing member", async ({
    page,
  }) => {
    const dialog = await openWizard(page);

    // Step 1: nothing from the later steps is mounted yet, and Next waits for
    // the fields this step needs.
    await expect(dialog.getByLabel("Mineral name")).toBeVisible();
    await expect(dialog.getByLabel("Policy number")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Back" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(
      dialog.getByText(
        "Complete the required fields on this step to continue.",
      ),
    ).toBeVisible();

    await fillMineralStep(dialog);
    await expect(dialog.getByRole("button", { name: "Next" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Next" }).click();

    // Step 2.
    await expect(dialog.getByLabel("Policy number")).toBeVisible();
    await expect(dialog.getByLabel("Mineral name")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Next" })).toBeDisabled();
    await fillPolicyStep(dialog);
    await dialog.getByRole("button", { name: "Next" }).click();

    // Step 3: the save button only exists here, and it needs an owner.
    await expect(dialog.getByLabel("Member")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Next" })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Add mineral" }),
    ).toBeDisabled();

    // Shipment details are not part of recording a holding.
    await expect(dialog.getByLabel("Carrier")).toHaveCount(0);
    await expect(dialog.getByLabel("Origin")).toHaveCount(0);

    // Back keeps what was typed.
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog.getByLabel("Provider")).toHaveValue(
      "Cosmic Vault Insurance",
    );
    await dialog.getByRole("button", { name: "Next" }).click();

    await dialog.getByLabel("Member").selectOption("user-1");
    await expect(
      dialog.getByRole("button", { name: "Add mineral" }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Add mineral" }).click();

    await expect(
      page.getByText("Mineral recorded. The assigned member has been emailed."),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const args = mutations.find((call) => call.ref === "minerals.create")?.args;
    expect(args).toMatchObject({
      mineral: {
        name: "Gold bullion, 999.9",
        category: "Precious metals",
        quantity: 1,
        unit: "kg",
        currency: "GBP",
      },
      policy: {
        policyNumber: "CV-MIN-ROLL-2026-014",
        provider: "Cosmic Vault Insurance",
        coverage: "cargo_transit",
      },
      assignment: { mode: "existing", userId: "user-1" },
    });
    // A shipment is requested by the member later, never at creation.
    expect(args).not.toHaveProperty("shipment");

    // Reopening starts from the first step with an empty form.
    await page.getByRole("button", { name: "Add mineral" }).first().click();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByLabel("Mineral name")).toBeVisible();
    await expect(reopened.getByLabel("Mineral name")).toHaveValue("");
  });

  test("creates the owner from an email address on the member step", async ({
    page,
  }) => {
    const dialog = await openWizard(page);

    await fillMineralStep(dialog);
    await dialog.getByRole("button", { name: "Next" }).click();
    await fillPolicyStep(dialog);
    await dialog.getByRole("button", { name: "Next" }).click();

    await dialog.getByRole("button", { name: "Create a new member" }).click();
    await expect(
      dialog.getByRole("button", { name: "Add mineral" }),
    ).toBeDisabled();

    await dialog.getByLabel("Full name").fill("Rae Receiver");
    await dialog.getByLabel("Email").fill("rae@example.com");
    await expect(
      dialog.getByRole("button", { name: "Add mineral" }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Add mineral" }).click();

    await expect(
      page.getByText("Mineral recorded. The assigned member has been emailed."),
    ).toBeVisible();

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "minerals.create")?.args,
    ).toMatchObject({
      assignment: {
        mode: "new",
        newUser: { name: "Rae Receiver", email: "rae@example.com" },
      },
    });
  });
});
