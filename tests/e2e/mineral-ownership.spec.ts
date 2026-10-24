import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The mineral ownership controls on a customer's record.
 *
 * Convex is doubled out in this suite (see `tests/e2e/stubs`), so the test
 * proves the browser flow and the request each control sends: move an owned
 * mineral to another customer, attach an ownerless one, then detach it again.
 * The writes themselves are covered by `tests/minerals.test.ts`.
 */
const ADMIN_SESSION: E2ESession = {
  _id: "e2e-mineral-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "customers.manage", "policies.manage"],
};

/** Staff who can open customer records but cannot manage minerals. */
const LIMITED_SESSION: E2ESession = {
  _id: "e2e-limited-admin",
  name: "Support Admin",
  email: "support@example.com",
  role: "admin",
  permissions: ["customers.view"],
};

const CUSTOMER_ID = "e2e-customer-1";
const OTHER_CUSTOMER_ID = "e2e-customer-2";
const MINERAL_ID = "e2e-mineral-1";
const SHIPMENT_ID = "e2e-shipment-1";
const UNASSIGNED_MINERAL_ID = "e2e-mineral-2";
const UNASSIGNED_SHIPMENT_ID = "e2e-shipment-2";

const JOINED_AT = Date.UTC(2026, 0, 12);
const COVER_ENDS_AT = Date.UTC(2027, 0, 1);

const FIXTURES: Record<string, unknown> = {
  "customers.directory": {
    rows: [
      {
        _id: CUSTOMER_ID,
        userId: CUSTOMER_ID,
        fullName: "Ada Vault",
        email: "ada@example.com",
        reference: "CV-CUST-1001",
        country: "GB",
        createdAt: JOINED_AT,
        verificationStatus: "verified",
        accountStatus: "active",
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
  },
  "customers.detail": {
    user: {
      _id: CUSTOMER_ID,
      name: "Ada Vault",
      email: "ada@example.com",
      role: "customer",
      status: "active",
    },
    profile: {
      userId: CUSTOMER_ID,
      reference: "CV-CUST-1001",
      fullName: "Ada Vault",
      email: "ada@example.com",
      country: "GB",
      currency: "GBP",
      locale: "en-GB",
      timezone: "Europe/London",
      preferredLanguage: "en",
      marketingOptIn: false,
      verificationStatus: "verified",
      createdAt: JOINED_AT,
      updatedAt: JOINED_AT,
    },
    applications: [],
    policies: [],
    claims: [],
    transactions: [],
    documents: [],
    tickets: [],
    audit: [],
    assignments: [],
  },
  "customers.brokerOptions": [],
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    currencies: [
      {
        code: "GBP",
        name: "Pound sterling",
        symbol: "£",
        minorUnits: 2,
        active: true,
      },
    ],
    categories: [],
  },
  "minerals.forOwner": [
    {
      mineral: {
        _id: MINERAL_ID,
        name: "Aurum bar",
        reference: "MIN-1001",
        category: "Precious metals",
        quantity: 12.5,
        unit: "kg",
        declaredValue: 25_000_000,
        currency: "GBP",
        status: "active",
        assignedUserId: CUSTOMER_ID,
        createdAt: JOINED_AT,
        updatedAt: JOINED_AT,
      },
      policy: {
        _id: "e2e-policy-1",
        policyNumber: "CV-MIN-2026-014",
        coverage: "cargo_transit",
        coverageLimit: 30_000_000,
        currency: "GBP",
        endDate: COVER_ENDS_AT,
      },
      shipment: {
        _id: SHIPMENT_ID,
        reference: "SHP-1001",
        origin: "Zurich, CH",
        destination: "London, GB",
        status: "in_transit",
      },
      shipments: [
        {
          _id: SHIPMENT_ID,
          reference: "SHP-1001",
          origin: "Zurich, CH",
          destination: "London, GB",
          status: "in_transit",
        },
      ],
    },
  ],
  "minerals.assigneeOptions": [
    {
      userId: CUSTOMER_ID,
      name: "Ada Vault",
      email: "ada@example.com",
      role: "customer",
      reference: "CV-CUST-1001",
      status: "active",
    },
    {
      userId: OTHER_CUSTOMER_ID,
      name: "Tomas Berg",
      email: "tomas@example.com",
      role: "customer",
      reference: "CV-CUST-1002",
      status: "active",
    },
  ],
  "minerals.unassigned": [
    {
      mineral: {
        _id: UNASSIGNED_MINERAL_ID,
        name: "Silver ingot",
        reference: "MIN-1002",
        category: "Precious metals",
        quantity: 4,
        unit: "kg",
        declaredValue: 4_200_000,
        currency: "GBP",
        status: "active",
        createdAt: JOINED_AT,
        updatedAt: JOINED_AT,
      },
      shipment: {
        _id: UNASSIGNED_SHIPMENT_ID,
        reference: "SHP-1002",
        origin: "Zurich, CH",
        destination: "London, GB",
        status: "preparing",
      },
      shipments: [
        {
          _id: UNASSIGNED_SHIPMENT_ID,
          reference: "SHP-1002",
          origin: "Zurich, CH",
          destination: "London, GB",
          status: "preparing",
        },
      ],
    },
  ],
};

const REGISTER_MINERAL = {
  _id: MINERAL_ID,
  name: "Aurum bar",
  reference: "MIN-1001",
  category: "Precious metals",
  quantity: 12.5,
  unit: "kg",
  declaredValue: 25_000_000,
  currency: "GBP",
  status: "active",
  assignedUserId: CUSTOMER_ID,
  createdAt: JOINED_AT,
  updatedAt: JOINED_AT,
};

const REGISTER_POLICY = {
  _id: "e2e-policy-1",
  policyNumber: "CV-MIN-2026-014",
  provider: "Cosmic Vault Insurance",
  coverage: "cargo_transit",
  coverageLimit: 30_000_000,
  currency: "GBP",
  startDate: JOINED_AT,
  endDate: COVER_ENDS_AT,
  status: "active",
};

const REGISTER_SHIPMENT = {
  _id: SHIPMENT_ID,
  reference: "SHP-1001",
  carrier: "Brink's Global Services",
  trackingNumber: "BGS-918273",
  origin: "Zurich, CH",
  destination: "London, GB",
  status: "in_transit",
  currentLocation: "Basel, CH",
  estimatedArrivalAt: COVER_ENDS_AT,
  createdAt: JOINED_AT,
};

const REGISTER_ASSIGNEE = {
  _id: CUSTOMER_ID,
  name: "Ada Vault",
  email: "ada@example.com",
};

const REGISTER_FIXTURES: Record<string, unknown> = {
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    currencies: [
      {
        code: "GBP",
        name: "Pound sterling",
        symbol: "£",
        minorUnits: 2,
        active: true,
      },
    ],
    categories: [],
  },
  "minerals.list": [
    {
      mineral: REGISTER_MINERAL,
      policy: REGISTER_POLICY,
      shipment: REGISTER_SHIPMENT,
      assignee: REGISTER_ASSIGNEE,
    },
  ],
  "minerals.detail": {
    mineral: REGISTER_MINERAL,
    policy: REGISTER_POLICY,
    policies: [REGISTER_POLICY],
    shipment: REGISTER_SHIPMENT,
    events: [
      {
        _id: "e2e-event-1",
        status: "in_transit",
        location: "Basel, CH",
        note: "Loaded onto the armoured convoy.",
        createdAt: JOINED_AT,
      },
    ],
    assignee: REGISTER_ASSIGNEE,
  },
  "minerals.assigneeOptions": [
    {
      userId: CUSTOMER_ID,
      name: "Ada Vault",
      email: "ada@example.com",
      role: "customer",
      reference: "CV-CUST-1001",
      status: "active",
    },
    {
      userId: OTHER_CUSTOMER_ID,
      name: "Tomas Berg",
      email: "tomas@example.com",
      role: "customer",
      reference: "CV-CUST-1002",
      status: "active",
    },
  ],
};

test.describe("mineral ownership from a customer record", () => {
  test("moves, attaches and detaches a mineral with the right requests", async ({
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

    await page.goto("/dashboard/admin/customers");
    await page
      .getByRole("row", { name: /Ada Vault/ })
      .getByRole("button", { name: "Open" })
      .click();

    const customer = page.getByRole("dialog");
    await expect(customer.getByText("Minerals & shipments")).toBeVisible();
    await expect(customer.getByText("Aurum bar")).toBeVisible();

    // 1. Move the owned mineral to another customer.
    await customer.getByRole("button", { name: "Move", exact: true }).click();
    await customer.getByLabel("New owner").selectOption(OTHER_CUSTOMER_ID);
    await customer
      .getByLabel("Reason for the move")
      .fill("Client moved to another broker.");
    await customer.getByRole("button", { name: "Move mineral" }).click();

    const moveConfirm = page.getByRole("alertdialog");
    await expect(
      moveConfirm.getByText("Move this record to another customer?"),
    ).toBeVisible();
    await moveConfirm.getByRole("button", { name: "Move record" }).click();
    await expect(
      page.getByText("Mineral moved. The new owner has been emailed."),
    ).toBeVisible();

    // 2. Attach an ownerless mineral to this customer.
    await customer
      .getByRole("button", { name: "Attach mineral", exact: true })
      .click();
    await customer
      .getByLabel("Unassigned mineral")
      .selectOption(UNASSIGNED_MINERAL_ID);
    await customer
      .getByLabel("Reason for attaching")
      .fill("Matched the vault intake.");
    await customer
      .getByRole("button", { name: "Attach to this customer" })
      .click();

    const attachConfirm = page.getByRole("alertdialog");
    await expect(attachConfirm.getByText("Attach this mineral?")).toBeVisible();
    await attachConfirm
      .getByRole("button", { name: "Attach mineral", exact: true })
      .click();
    await expect(
      page.getByText("Mineral attached. The customer has been emailed."),
    ).toBeVisible();

    // 3. Detach the owned mineral back to the unassigned pool.
    await customer.getByRole("button", { name: "Detach", exact: true }).click();

    const detachConfirm = page.getByRole("alertdialog");
    await expect(detachConfirm.getByText("Detach this mineral?")).toBeVisible();
    await detachConfirm
      .getByLabel("Reason for detaching")
      .fill("Ownership dispute under review.");
    await detachConfirm
      .getByRole("button", { name: "Detach mineral" })
      .click();
    await expect(
      page.getByText("Aurum bar is back in the unassigned pool."),
    ).toBeVisible();

    const mutations = await page.evaluate(
      () => window.__E2E_MUTATIONS__ ?? [],
    );

    const move = mutations.find(
      (call) =>
        call.ref === "minerals.reassign" &&
        (call.args as { note?: string }).note ===
          "Client moved to another broker.",
    );
    expect(move?.args).toMatchObject({
      mineralId: MINERAL_ID,
      assignment: { mode: "existing", userId: OTHER_CUSTOMER_ID },
    });

    const attach = mutations.find(
      (call) =>
        call.ref === "minerals.reassign" &&
        (call.args as { note?: string }).note === "Matched the vault intake.",
    );
    expect(attach?.args).toMatchObject({
      mineralId: UNASSIGNED_MINERAL_ID,
      assignment: { mode: "existing", userId: CUSTOMER_ID },
    });

    const detach = mutations.find((call) => call.ref === "minerals.detach");
    expect(detach?.args).toMatchObject({
      mineralId: MINERAL_ID,
      note: "Ownership dispute under review.",
    });

    await expect(customer.getByText("Preview runtime error")).toHaveCount(0);
  });

  test("cancelling a move or detach sends nothing", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: FIXTURES },
    );

    await page.goto("/dashboard/admin/customers");
    await page
      .getByRole("row", { name: /Ada Vault/ })
      .getByRole("button", { name: "Open" })
      .click();

    const customer = page.getByRole("dialog");
    await expect(customer.getByText("Aurum bar")).toBeVisible();

    // Abandon a move at the confirmation step.
    await customer.getByRole("button", { name: "Move", exact: true }).click();
    await customer.getByLabel("New owner").selectOption(OTHER_CUSTOMER_ID);
    await customer.getByRole("button", { name: "Move mineral" }).click();

    const moveConfirm = page.getByRole("alertdialog");
    await expect(
      moveConfirm.getByText("Move this record to another customer?"),
    ).toBeVisible();
    await moveConfirm.getByRole("button", { name: "Cancel" }).click();
    await expect(moveConfirm).toHaveCount(0);
    await expect(customer.getByText("Move Aurum bar")).toBeVisible();

    // Close the panel itself as well, so the next action starts clean.
    await customer
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(customer.getByText("Move Aurum bar")).toHaveCount(0);

    // Abandon a detach at the confirmation step.
    await customer.getByRole("button", { name: "Detach", exact: true }).click();
    const detachConfirm = page.getByRole("alertdialog");
    await expect(detachConfirm.getByText("Detach this mineral?")).toBeVisible();
    await detachConfirm.getByRole("button", { name: "Cancel" }).click();
    await expect(detachConfirm).toHaveCount(0);

    const mutations = await page.evaluate(
      () => window.__E2E_MUTATIONS__ ?? [],
    );
    expect(mutations).toEqual([]);
  });

  test("a staff account without policies.manage never sees the owner controls", async ({
    page,
  }) => {
    // Serve the mineral fixtures too: if the gate ever came off, the section
    // would render real holdings and its controls would fail the assertions
    // below, instead of only ever showing a loading state.
    const limitedFixtures: Record<string, unknown> = {
      "customers.directory": FIXTURES["customers.directory"],
      "customers.detail": FIXTURES["customers.detail"],
      "customers.brokerOptions": FIXTURES["customers.brokerOptions"],
      "setup.referenceData": FIXTURES["setup.referenceData"],
      "minerals.forOwner": FIXTURES["minerals.forOwner"],
      "minerals.assigneeOptions": FIXTURES["minerals.assigneeOptions"],
      "minerals.unassigned": FIXTURES["minerals.unassigned"],
    };

    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_QUERY_CALLS__ = [];
      },
      { session: LIMITED_SESSION, fixtures: limitedFixtures },
    );

    await page.goto("/dashboard/admin/customers");
    await page
      .getByRole("row", { name: /Ada Vault/ })
      .getByRole("button", { name: "Open" })
      .click();

    const customer = page.getByRole("dialog");
    await expect(customer.getByText("Audit history")).toBeVisible();
    await expect(customer.getByText("Minerals & shipments")).toHaveCount(0);
    await expect(
      customer.getByRole("button", { name: "Move", exact: true }),
    ).toHaveCount(0);
    await expect(
      customer.getByRole("button", { name: "Detach", exact: true }),
    ).toHaveCount(0);
    await expect(
      customer.getByRole("button", { name: "Attach mineral", exact: true }),
    ).toHaveCount(0);

    const queries = await page.evaluate(
      () => window.__E2E_QUERY_CALLS__ ?? [],
    );
    expect(queries.filter((ref) => ref.startsWith("minerals."))).toEqual([]);
    await expect(customer.getByText("Preview runtime error")).toHaveCount(0);
  });

  test("reassigns from the mineral register to an existing or new account", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
      },
      { session: ADMIN_SESSION, fixtures: REGISTER_FIXTURES },
    );

    await page.goto("/dashboard/admin/minerals");
    await expect(page.getByText("Aurum bar").first()).toBeVisible();
    await page.getByRole("button", { name: "Manage" }).click();

    const register = page.getByRole("dialog");
    await expect(register.getByText("Change owner")).toBeVisible();

    // Existing account.
    await register.getByLabel("New owner").selectOption(OTHER_CUSTOMER_ID);
    await register
      .getByLabel("Reason for the change (optional)")
      .fill("Moved after a broker transfer.");
    await register.getByRole("button", { name: "Reassign mineral" }).click();

    const existingConfirm = page.getByRole("alertdialog");
    await expect(
      existingConfirm.getByText("Reassign this mineral?"),
    ).toBeVisible();
    await existingConfirm
      .getByRole("button", { name: "Reassign", exact: true })
      .click();
    await expect(
      page.getByText("Reassigned. The new owner has been emailed.").last(),
    ).toBeVisible();

    // New member from an email address.
    await register
      .getByRole("button", { name: "Create a new member" })
      .click();
    await register.getByLabel("Full name").fill("Rae Receiver");
    await register.getByLabel("Email").fill("rae@example.com");
    await register.getByRole("button", { name: "Reassign mineral" }).click();

    const newConfirm = page.getByRole("alertdialog");
    await expect(newConfirm.getByText("Reassign this mineral?")).toBeVisible();
    await newConfirm
      .getByRole("button", { name: "Reassign", exact: true })
      .click();
    await expect(
      page.getByText("Reassigned. The new owner has been emailed.").last(),
    ).toBeVisible();

    const mutations = await page.evaluate(
      () => window.__E2E_MUTATIONS__ ?? [],
    );
    const reassignments = mutations.filter(
      (call) => call.ref === "minerals.reassign",
    );
    expect(reassignments).toHaveLength(2);
    expect(reassignments[0].args).toMatchObject({
      mineralId: MINERAL_ID,
      assignment: { mode: "existing", userId: OTHER_CUSTOMER_ID },
      note: "Moved after a broker transfer.",
    });
    expect(reassignments[1].args).toMatchObject({
      mineralId: MINERAL_ID,
      assignment: {
        mode: "new",
        newUser: { name: "Rae Receiver", email: "rae@example.com" },
      },
    });

    await expect(register.getByText("Preview runtime error")).toHaveCount(0);
  });
});
