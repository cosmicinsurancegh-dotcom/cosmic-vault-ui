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
  // No member has asked for a shipment, so the request queue stays hidden.
  "minerals.shipmentRequests": [],
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
  // One delivery that landed and one the provider rejected, so the board can be
  // checked for both states without opening the settings panel.
  "minerals.emailLog": [
    {
      shipmentId: OWNED_SHIPMENT_ID,
      emailStatus: "sent",
      emailError: null,
      emailAttempts: 1,
      at: CREATED_AT + 3000,
      stalled: false,
    },
    {
      shipmentId: UNASSIGNED_SHIPMENT_ID,
      emailStatus: "failed",
      emailError: "Provider rejected the recipient address.",
      emailAttempts: 2,
      at: CREATED_AT + 4000,
      stalled: false,
    },
  ],
};

/**
 * The requests behind the current consignment: one the desk booked, and one it
 * turned down first. The board has to keep both, or staff cannot explain an
 * earlier decline when the member asks.
 */
const REQUEST_HISTORY = [
  {
    _id: "e2e-ship-request-2",
    mineralId: OWNED_MINERAL_ID,
    customerUserId: ADA_ID,
    destination: "Zurich vault",
    preferredDate: Date.UTC(2026, 2, 10, 12),
    status: "approved",
    shipmentId: OWNED_SHIPMENT_ID,
    decidedBy: ADMIN_SESSION._id,
    decisionNote: "Booked on our standard Zurich run.",
    decidedAt: CREATED_AT + 1000,
    createdAt: CREATED_AT - 8000,
    updatedAt: CREATED_AT + 1000,
  },
  {
    _id: "e2e-ship-request-1",
    mineralId: OWNED_MINERAL_ID,
    customerUserId: ADA_ID,
    destination: "Geneva vault",
    status: "declined",
    decidedBy: ADMIN_SESSION._id,
    decisionNote: "No courier cover to Geneva that week.",
    decidedAt: CREATED_AT - 9000,
    createdAt: CREATED_AT - 12000,
    updatedAt: CREATED_AT - 9000,
  },
];

/**
 * A consignment nobody has given a position yet. The rail names the place or
 * says it has none, so the row never states the status twice.
 */
const NO_LOCATION_SHIPMENT = { ...OWNED_SHIPMENT, currentLocation: undefined };

const NO_LOCATION_FIXTURES: Record<string, unknown> = {
  ...FIXTURES,
  "minerals.list": [
    {
      mineral: OWNED_MINERAL,
      policy: null,
      shipment: NO_LOCATION_SHIPMENT,
      assignee: { _id: ADA_ID, name: ADA.name, email: ADA.email },
    },
    {
      mineral: UNASSIGNED_MINERAL,
      policy: null,
      shipment: UNASSIGNED_SHIPMENT,
      assignee: null,
    },
  ],
};

const HISTORY_FIXTURES: Record<string, unknown> = {
  ...FIXTURES,
  "minerals.list": [
    {
      mineral: OWNED_MINERAL,
      policy: null,
      shipment: OWNED_SHIPMENT,
      assignee: { _id: ADA_ID, name: ADA.name, email: ADA.email },
      requests: REQUEST_HISTORY,
    },
    {
      mineral: UNASSIGNED_MINERAL,
      policy: null,
      shipment: UNASSIGNED_SHIPMENT,
      assignee: null,
      requests: [],
    },
  ],
};

test.describe("staff shipment control", () => {
  test("shows every request behind a consignment, answered or declined", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: ADMIN_SESSION, fixtures: HISTORY_FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");

    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    await expect(row.getByText("Request history")).toBeVisible();

    // Both decisions are on the consignment, newest first, with the reason the
    // member was sent.
    await expect(
      row.getByText(/Zurich vault · preferred/).first(),
    ).toBeVisible();
    await expect(
      row.getByText(/Booked on our standard Zurich run/),
    ).toBeVisible();
    await expect(row.getByText("Geneva vault")).toBeVisible();
    await expect(
      row.getByText(/No courier cover to Geneva that week/),
    ).toBeVisible();
    await expect(row.getByText("Approved", { exact: true })).toBeVisible();
    await expect(row.getByText("Declined", { exact: true })).toBeVisible();

    // A mineral with no requests keeps its row quiet.
    const other = page.locator("article").filter({ hasText: "CV-SHP-2002" });
    await expect(other.getByText("Request history")).toHaveCount(0);

    // The history is reference material, not a shortcut into live tracking.
    await row.getByText("Geneva vault").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The board narrows to the consignments carrying a decision, and counts
    // what each choice would leave.
    const requests = page.getByRole("group", {
      name: "Filter by request state",
    });
    await expect(
      requests.getByRole("button", { name: "Approved (1)" }),
    ).toBeVisible();
    await expect(
      requests.getByRole("button", { name: "Pending (0)" }),
    ).toBeVisible();

    await requests.getByRole("button", { name: "Approved (1)" }).click();
    await expect(page.getByText("CV-SHP-2001")).toBeVisible();
    await expect(page.getByText("CV-SHP-2002")).toHaveCount(0);

    await requests.getByRole("button", { name: "Pending (0)" }).click();
    await expect(page.getByText("No consignments match.")).toBeVisible();

    await page.getByRole("button", { name: "Show every consignment" }).click();
    await expect(page.getByText("CV-SHP-2002")).toBeVisible();
  });

  test("shows whether each consignment's last email reached its owner", async ({
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

    const owned = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    await expect(owned.getByText("Email sent")).toBeVisible();

    // A rejected send is visible on the board itself, with the reason on hover.
    const other = page.locator("article").filter({ hasText: "CV-SHP-2002" });
    await expect(other.getByText("Email failed")).toBeVisible();
    await expect(
      other.locator("p[title*='Provider rejected the recipient address']"),
    ).toBeVisible();

    // The count is in the board's summary, above the list, so the problem is
    // known before scrolling: one failed, one delivered.
    const issues = page.getByText("Last email failed or stalled").locator("..");
    await expect(issues).toContainText("1");
  });

  test("resends a failed email from the row that failed", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");

    // A delivered email offers no resend, so nobody emails an owner twice.
    const delivered = page
      .locator("article")
      .filter({ hasText: "CV-SHP-2001" });
    await expect(delivered.getByText("Email sent")).toBeVisible();
    await expect(
      delivered.getByRole("button", { name: /^Resend/ }),
    ).toHaveCount(0);

    // The rejected one can be retried where its failure is shown.
    const failed = page.locator("article").filter({ hasText: "CV-SHP-2002" });
    await failed
      .getByRole("button", { name: "Resend the last email for CV-SHP-2002" })
      .click();

    await expect(page.getByText("Email queued again.")).toBeVisible();

    const calls = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    const resend = calls.filter(
      (call) => call.ref === "minerals.resendShipmentEmail",
    );
    expect(resend).toHaveLength(1);
    expect(resend[0]?.args).toEqual({ shipmentId: UNASSIGNED_SHIPMENT_ID });
  });

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

    // Staff controls stay on the row, outside the tracking dialog. The status
    // is written once, as the dot and word on the left, so the row offers the
    // action rather than a second copy of the value.
    await expect(
      row.getByRole("button", { name: "Change status for Aurum bar" }),
    ).toBeVisible();
    await expect(row.locator("select")).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: "Reassign", exact: true }),
    ).toBeVisible();

    await row
      .getByRole("button", { name: "Open live tracking for CV-SHP-2001" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // The open record is in the address, so the view can be shared.
    await expect(page).toHaveURL(/shipment=e2e-ship-1/);

    const panel = page.locator("#live-e2e-ship-1");
    await expect(
      panel.getByRole("heading", { name: "Live shipment tracking" }),
    ).toBeVisible();
    await expect(panel.getByLabel("Milestones for CV-SHP-2001")).toBeVisible();
    // The history is read only for the row that is open.
    await expect(panel.getByText("Cleared customs in Basel.")).toBeVisible();
    await expect(panel.getByText("Packed under dual control.")).toBeVisible();

    // The dialog is modal, so it goes away before the board is used again.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#live-e2e-ship-1")).toHaveCount(0);
    await expect(page).not.toHaveURL(/shipment=/);

    // The whole card opens the same view as its button.
    await row.getByText("CV-SHP-2001").click();
    await expect(panel).toBeVisible();
  });

  test("names the position, or says it has none, instead of the status", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: ADMIN_SESSION, fixtures: NO_LOCATION_FIXTURES },
    );

    await page.goto("/dashboard/admin/shipments");
    const row = page.locator("article").filter({ hasText: "CV-SHP-2001" });
    const rail = row.getByLabel("Route from London vault to Zurich vault");

    // The intermediate station answers "where is it", so an unrecorded place
    // is said plainly rather than filled in with the status.
    await expect(rail.getByText("No location recorded")).toBeVisible();
    await expect(rail.getByText("In transit")).toHaveCount(0);
    // The status therefore appears once on the row: the dot and its word.
    await expect(row.getByText("In transit", { exact: true })).toHaveCount(1);
  });

  test("opens live tracking straight from a shared link", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    // A link to one consignment opens its tracking view on arrival.
    await page.goto("/dashboard/admin/shipments?shipment=e2e-ship-1");

    const panel = page.locator("#live-e2e-ship-1");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Live shipment tracking" }),
    ).toBeVisible();
    await expect(panel.getByLabel("Milestones for CV-SHP-2001")).toBeVisible();
    await expect(panel.getByText("Cleared customs in Basel.")).toBeVisible();

    // Closing drops the record from the address, leaving the plain board.
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/shipment=/);
    await expect(page.getByLabel("Search consignments")).toBeVisible();
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
      .getByRole("button", { name: "Change status for Aurum bar" })
      .click();

    // Opening the dialog changes nothing: the status is chosen inside it, and
    // nothing is published until it is confirmed.
    expect(await page.evaluate(() => window.__E2E_MUTATIONS__ ?? [])).toEqual(
      [],
    );

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Publish a status change" }),
    ).toBeVisible();
    // The status it already has is no change, so it is not on offer.
    await expect(dialog.getByText("In transit", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("New status")).not.toHaveValue("in_transit");
    await dialog.getByLabel("New status").selectOption("delivered");
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
      .getByRole("button", { name: "Change status for Aurum bar" })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New status").selectOption("out_for_delivery");
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
      .getByRole("button", { name: "Change status for Aurum bar" })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New status").selectOption("customs_hold");
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
    await row
      .getByRole("button", { name: "Change status for Aurum bar" })
      .click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New status").selectOption("customs_hold");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    // Cancelling discards the choice: the row still shows the published status,
    // not the one that was picked and never sent.
    await expect(row.getByText("Held at customs")).toHaveCount(0);
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
