import type { Page } from "@playwright/test";
import { dateIn, expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * A phone gets one stacked card per record instead of the register-style table,
 * on every staff screen that has one.
 *
 * The two forms must never coexist in the DOM: `RecordCardList` renders below
 * `md` and nowhere else, so a wider screen shows the table alone. That rule
 * matters beyond layout - a CSS-hidden duplicate made text queries ambiguous
 * for the rest of the suite - so the desktop sweep pins it down for each page.
 */
const STAFF: E2ESession = {
  _id: "e2e-mobile-staff",
  name: "Noor Vault",
  email: "noor@example.com",
  role: "super_admin",
  permissions: [
    "customers.view",
    "customers.manage",
    "products.manage",
    "applications.review",
    "policies.manage",
    "claims.review",
    "payments.view",
    "brokers.manage",
    "reports.view",
    "audit.view",
  ],
};

const AT = Date.UTC(2026, 9, 24);

/**
 * One record per screen, so a card count of 1 is unambiguous. Keys are the
 * query reference names the stub matches on (`table.fn`); a screen only reads
 * the entries it asks for.
 */
const FIXTURES: Record<string, unknown> = {
  "minerals.list": [
    {
      mineral: {
        _id: "e2e-mobile-mineral",
        name: "Sovereign 1 kg Gold Bar",
        reference: "CV-MIN-1042",
        category: "Precious metals",
        quantity: 1000,
        unit: "g",
        declaredValue: 786400,
        currency: "GBP",
        status: "active",
        assignedUserId: null,
      },
      policy: {
        _id: "e2e-mobile-policy",
        policyNumber: "CV-MIN-ROLL-1426",
        provider: "Cosmic Vault Insurance",
        endDate: dateIn(365),
        status: "active",
      },
      shipment: {
        _id: "e2e-mobile-shipment",
        status: "in_transit",
        origin: "Berlin",
        destination: "London",
      },
      request: null,
      assignee: null,
    },
  ],
  "claims.queue": {
    rows: [
      {
        _id: "e2e-mobile-claim",
        reference: "CV-CLM-2044",
        assignedTo: "e2e-staff-1",
        customerName: "Alexandra Montgomery-Wells",
        policyNumber: "CV-MIN-ROLL-1426",
        amountClaimed: 450000,
        currency: "GBP",
        incidentDate: AT,
        status: "under_review",
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  },
  "customers.directory": {
    rows: [
      {
        _id: "e2e-mobile-customer",
        userId: "e2e-mobile-user",
        fullName: "Alexandra Montgomery-Wells",
        email: "alexandra@example.com",
        reference: "CV-CUS-0007",
        country: "GB",
        createdAt: AT,
        verificationStatus: "verified",
        accountStatus: "active",
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    hasMore: false,
  },
  "tickets.staffList": {
    rows: [
      {
        _id: "e2e-mobile-ticket",
        subject: "Add a second name to the policy",
        reference: "CV-TKT-3080",
        customerName: "Alexandra Montgomery-Wells",
        category: "policy",
        assigneeName: null,
        priority: "normal",
        updatedAt: AT,
        status: "open",
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    hasMore: false,
  },
  "products.listStaff": [
    {
      _id: "e2e-mobile-product",
      name: "Household Contents",
      code: "HOME-CONTENTS-01",
      categoryKey: "home",
      version: 3,
      basePremium: 18500,
      currency: "GBP",
      countries: ["GB"],
      updatedAt: AT,
      status: "draft",
      termMonths: 12,
      excess: 25000,
      coverageLimit: 5000000,
      exclusions: [],
      benefits: [],
      wordingVersion: "3.0",
      wording: "",
      disclosures: "",
      renewalNoticeDays: 30,
      cancellationNoticeDays: 14,
      effectiveFrom: AT,
      ratingFactors: {},
      questions: [],
      requiredDocuments: [],
    },
  ],
  "applications.queue": {
    rows: [
      {
        _id: "e2e-mobile-application",
        reference: "CV-APP-3300",
        assignedTo: null,
        customerName: "Alexandra Montgomery-Wells",
        productName: "Household Contents",
        country: "GB",
        premium: 18500,
        currency: "GBP",
        submittedAt: AT,
        createdAt: AT,
        status: "under_review",
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  },
  "policies.listStaff": {
    rows: [
      {
        _id: "e2e-mobile-listed-policy",
        policyNumber: "CV-POL-9001",
        issuedAt: AT,
        customerName: "Alexandra Montgomery-Wells",
        productName: "Household Contents",
        premium: 18500,
        currency: "GBP",
        endDate: dateIn(365),
        status: "active",
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    hasMore: false,
  },
  "payments.listStaff": {
    rows: [
      {
        _id: "e2e-mobile-transaction",
        reference: "CV-TXN-5010",
        providerRef: "pi_3Xk1",
        customerName: "Alexandra Montgomery-Wells",
        type: "premium",
        amount: 45000,
        currency: "GBP",
        method: "bank_transfer",
        createdAt: AT,
        status: "pending",
      },
    ],
    page: 1,
    pageSize: 10,
    total: 1,
    hasMore: false,
  },
  "brokers.list": [
    {
      _id: "e2e-mobile-broker",
      orgName: "Meridian Fine Art Brokers",
      reference: "CV-BRK-0003",
      email: "desk@meridian.example",
      contactName: "Priya Raman",
      countries: ["GB", "IE"],
      assignedCustomers: 12,
      applications: 3,
      activePolicies: 9,
      status: "active",
    },
  ],
  "reports.generate": {
    report: "policies",
    generatedAt: AT,
    columns: [
      { key: "policyNumber", label: "Policy" },
      { key: "customer", label: "Customer" },
      { key: "premium", label: "Premium" },
    ],
    rows: [
      {
        policyNumber: "CV-POL-9001",
        customer: "Alexandra Montgomery-Wells",
        premium: "£1,250.00",
      },
    ],
    totals: { policies: 1 },
    basis: "Written premium recognised on issue.",
    currency: "GBP",
  },
  "audit.list": {
    rows: [
      {
        _id: "e2e-mobile-audit",
        action: "policy.issued",
        actorName: "Noor Vault",
        actorRole: "super_admin",
        at: AT,
        entityType: "policies",
        entityId: "e2e-mobile-listed-policy",
        reason: "Compliance check passed",
        before: null,
        after: { status: "active" },
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasMore: false,
  },
  "setup.referenceData": {
    countries: [{ code: "GB", name: "United Kingdom" }],
    categories: [],
    currencies: [{ code: "GBP", name: "Pound sterling", active: true }],
  },
};

type StaffPage = {
  /** The screen, as a person would name it. */
  label: string;
  path: string;
  /** Text only this screen's one fixture record can produce. */
  identity: string;
  /** A second field, proving the cards carry the table's columns. */
  field: string;
  /** The per-row action, when the table has one. */
  action?: string;
};

const PAGES: StaffPage[] = [
  {
    label: "the mineral register",
    path: "/dashboard/admin/minerals",
    identity: "Sovereign 1 kg Gold Bar",
    field: "In transit · Berlin → London",
    action: "Manage",
  },
  {
    label: "the customer directory",
    path: "/dashboard/admin/customers",
    identity: "Alexandra Montgomery-Wells",
    field: "CV-CUS-0007",
    action: "Open",
  },
  {
    label: "the support queue",
    path: "/dashboard/admin/support",
    identity: "Add a second name to the policy",
    field: "CV-TKT-3080",
    action: "Open",
  },
  {
    label: "the product catalogue",
    path: "/dashboard/admin/products",
    identity: "Household Contents",
    field: "HOME-CONTENTS-01",
    action: "Publish",
  },
  {
    label: "the underwriting queue",
    path: "/dashboard/admin/applications",
    identity: "CV-APP-3300",
    field: "Unassigned",
    action: "Review",
  },
  {
    label: "the policy register",
    path: "/dashboard/admin/policies",
    identity: "CV-POL-9001",
    field: "Alexandra Montgomery-Wells",
    action: "Open",
  },
  {
    label: "the claims queue",
    path: "/dashboard/admin/claims",
    identity: "CV-CLM-2044",
    field: "Alexandra Montgomery-Wells",
    action: "Review",
  },
  {
    label: "the payments register",
    path: "/dashboard/admin/payments",
    identity: "CV-TXN-5010",
    field: "£450.00",
    action: "Manage",
  },
  {
    label: "the broker register",
    path: "/dashboard/admin/brokers",
    identity: "Meridian Fine Art Brokers",
    field: "CV-BRK-0003",
    action: "Manage",
  },
  {
    label: "the reports register",
    path: "/dashboard/admin/reports",
    identity: "CV-POL-9001",
    field: "£1,250.00",
  },
  {
    label: "the audit log",
    path: "/dashboard/admin/audit",
    identity: "policy.issued",
    field: "Compliance check passed",
  },
];

async function startSignedIn(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(
    ({ session, fixtures }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
    },
    { session: STAFF, fixtures: FIXTURES },
  );
}

/** The stacked cards, identified by the label/value list inside each one. */
function recordCards(page: Page) {
  return page.locator("ul li").filter({ has: page.locator("dl") });
}

async function sidewaysScroll(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

test.describe("staff tables on a phone", () => {
  for (const staffPage of PAGES) {
    test(`${staffPage.label} shows one card per record and never scrolls sideways`, async ({
      page,
    }) => {
      await startSignedIn(page, 390);
      await page.goto(staffPage.path);

      const cards = recordCards(page);
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText(staffPage.identity);
      await expect(cards.first()).toContainText(staffPage.field);
      if (staffPage.action) {
        await expect(
          cards.first().getByRole("button", { name: staffPage.action }),
        ).toBeVisible();
      }

      // The table is still mounted, but it is not what a phone shows.
      await expect(page.locator("table").first()).toBeHidden();
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }
});

test("a desktop width shows the table and no cards on any of the screens", async ({
  page,
}) => {
  await startSignedIn(page, 1440);

  for (const staffPage of PAGES) {
    await page.goto(staffPage.path);

    const table = page.locator("table").first();
    await expect(table, staffPage.label).toBeVisible();
    await expect(table, staffPage.label).toContainText(staffPage.identity);
    await expect(recordCards(page), staffPage.label).toHaveCount(0);
  }
});
