import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The shipment request loop: a member sees the mineral and policy assigned to
 * them, asks for a shipment from a popup, and the logistics desk answers that
 * request by booking the consignment with its own carrier, route and dates.
 *
 * Both halves run against the Convex double, so the spec asserts on the
 * mutations each screen sends; the write path itself is covered by
 * tests/minerals.test.ts.
 */
const MEMBER: E2ESession = {
  _id: "e2e-request-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const ADMIN: E2ESession = {
  _id: "e2e-request-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage"],
};

const CREATED_AT = Date.UTC(2026, 9, 2);
const PREFERRED = Date.UTC(2026, 10, 2);

const MINERAL = {
  _id: "e2e-request-mineral-1",
  name: "Aurum bar",
  reference: "CV-MIN-4101",
  category: "Gold",
  quantity: 1,
  unit: "kg",
  declaredValue: 7_800_000,
  currency: "GBP",
  status: "active",
  assignedUserId: MEMBER._id,
  assignedAt: CREATED_AT,
  createdBy: ADMIN._id,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const POLICY = {
  _id: "e2e-request-policy-1",
  mineralId: MINERAL._id,
  policyNumber: "CV-MIN-ROLL-8801",
  provider: "Lloyd's of London",
  coverage: "all_risk",
  coverageLimit: 9_000_000,
  premium: 45_000,
  currency: "GBP",
  startDate: CREATED_AT,
  endDate: Date.UTC(2027, 9, 2),
  status: "active",
  createdBy: ADMIN._id,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const REQUEST = {
  _id: "e2e-request-1",
  mineralId: MINERAL._id,
  customerUserId: MEMBER._id,
  destination: "Zurich, CH",
  preferredDate: PREFERRED,
  notes: "Deliver to the Zurich vault, please.",
  status: "pending",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

async function signIn(
  page: Page,
  session: E2ESession,
  fixtures: Record<string, unknown>,
) {
  await page.addInitScript(
    ({ session: stubSession, fixtures: stubFixtures }) => {
      window.__E2E_SESSION__ = stubSession;
      window.__E2E_FIXTURES__ = stubFixtures;
      window.__E2E_MUTATIONS__ = [];
    },
    { session, fixtures },
  );
}

test.describe("shipment requests", () => {
  test("a member requests a shipment for a mineral in their vault", async ({
    page,
  }) => {
    await signIn(page, MEMBER, {
      "minerals.mine": [
        {
          mineral: MINERAL,
          policy: POLICY,
          shipment: null,
          request: null,
          events: [],
        },
      ],
    });
    await page.goto("/dashboard/minerals");

    // The mineral and the policy assigned to them are on the dashboard.
    await expect(page.getByText("Aurum bar")).toBeVisible();
    await expect(page.getByText("CV-MIN-ROLL-8801")).toBeVisible();
    await expect(page.getByText("No shipment recorded yet.")).toBeVisible();

    await page.getByRole("button", { name: "Request shipment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Request a shipment" }),
    ).toBeVisible();

    await expect(
      dialog.getByRole("button", { name: "Send request" }),
    ).toBeDisabled();
    await dialog.getByLabel("Destination").fill("Zurich, CH");
    await dialog.getByLabel("Preferred shipping date").fill("2026-11-02");
    await dialog.getByLabel("Notes (optional)").fill("Use the west gate.");
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText("Request sent.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "minerals.requestShipment")?.args,
    ).toMatchObject({
      mineralId: MINERAL._id,
      destination: "Zurich, CH",
      preferredDate: "2026-11-02",
      notes: "Use the west gate.",
    });
  });

  test("keeps the answered requests in the member's history", async ({
    page,
  }) => {
    const declined = {
      ...REQUEST,
      _id: "e2e-request-declined",
      status: "declined",
      decisionNote: "Cover lapsed before that date.",
      decidedAt: CREATED_AT + 3000,
    };
    const approved = {
      ...REQUEST,
      _id: "e2e-request-approved",
      destination: "Basel, CH",
      preferredDate: null,
      status: "approved",
      shipmentId: "e2e-request-shipment-old",
      createdAt: CREATED_AT - 7 * 24 * 60 * 60 * 1000,
      updatedAt: CREATED_AT - 7 * 24 * 60 * 60 * 1000,
      decidedAt: CREATED_AT - 6 * 24 * 60 * 60 * 1000,
    };

    await signIn(page, MEMBER, {
      "minerals.mine": [
        {
          mineral: MINERAL,
          policy: POLICY,
          shipment: null,
          request: declined,
          requests: [declined, approved],
          events: [],
        },
      ],
    });
    await page.goto("/dashboard/minerals");

    await expect(page.getByText("Request history")).toBeVisible();
    await expect(
      page.getByText("Your last request was declined:"),
    ).toBeVisible();
    await expect(page.getByText("Basel, CH")).toBeVisible();
    // The history entry carries the decision and the reason beside it.
    await expect(
      page.getByText(/^Requested .*Cover lapsed before that date\.$/),
    ).toBeVisible();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(page.getByText("Declined", { exact: true })).toBeVisible();

    // A declined request leaves the mineral free to ask again.
    await expect(
      page.getByRole("button", { name: "Request shipment" }),
    ).toBeVisible();
  });

  test("a mineral already moving offers no request button", async ({
    page,
  }) => {
    await signIn(page, MEMBER, {
      "minerals.mine": [
        {
          mineral: MINERAL,
          policy: POLICY,
          shipment: {
            _id: "e2e-request-shipment-1",
            mineralId: MINERAL._id,
            reference: "CV-SHP-4101",
            carrier: "Brink's",
            origin: "London vault",
            destination: "Zurich vault",
            status: "in_transit",
            currentLocation: "Basel, CH",
            assignedUserId: MEMBER._id,
            createdAt: CREATED_AT,
            updatedAt: CREATED_AT,
            lastStatusAt: CREATED_AT,
          },
          request: null,
          events: [],
        },
      ],
    });
    await page.goto("/dashboard/minerals");

    await expect(
      page.getByText("This consignment is already moving."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Request shipment" }),
    ).toHaveCount(0);
  });

  test("the desk books the requested consignment", async ({ page }) => {
    await signIn(page, ADMIN, {
      "minerals.list": [],
      "minerals.shipmentRequests": [
        {
          request: REQUEST,
          mineral: MINERAL,
          requester: {
            _id: MEMBER._id,
            name: MEMBER.name,
            email: MEMBER.email,
          },
        },
      ],
    });
    await page.goto("/dashboard/admin/shipments");

    // The pending request is on the dispatch board with what the member asked.
    await expect(
      page.getByRole("heading", { name: "Shipment requests" }),
    ).toBeVisible();
    await expect(page.getByText("Zurich, CH")).toBeVisible();
    await expect(
      page.getByText("Deliver to the Zurich vault, please."),
    ).toBeVisible();
    await expect(page.getByText("ada@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Set up shipment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Book the requested shipment" }),
    ).toBeVisible();
    // The member's destination is the starting point, not the whole booking.
    await expect(dialog.getByLabel("Destination")).toHaveValue("Zurich, CH");

    await expect(
      dialog.getByRole("button", { name: "Book shipment" }),
    ).toBeDisabled();
    await dialog.getByLabel("Carrier").fill("Malca-Amit");
    await dialog.getByLabel("Origin").fill("London, GB");
    await dialog.getByLabel("Tracking number (optional)").fill("MA-44021");
    await dialog.getByRole("button", { name: "Book shipment" }).click();

    await expect(page.getByText("Shipment booked.")).toBeVisible();

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "minerals.fulfilShipmentRequest")
        ?.args,
    ).toMatchObject({
      requestId: REQUEST._id,
      shipment: {
        carrier: "Malca-Amit",
        origin: "London, GB",
        destination: "Zurich, CH",
        trackingNumber: "MA-44021",
        status: "preparing",
      },
    });
  });

  test("declining asks for a reason before it is sent", async ({ page }) => {
    await signIn(page, ADMIN, {
      "minerals.list": [],
      "minerals.shipmentRequests": [
        {
          request: REQUEST,
          mineral: MINERAL,
          requester: {
            _id: MEMBER._id,
            name: MEMBER.name,
            email: MEMBER.email,
          },
        },
      ],
    });
    await page.goto("/dashboard/admin/shipments");

    // The board's request filters also say "Declined", so this targets the
    // panel's own action by its exact label.
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    // A destructive confirmation is an alert dialog, not a plain dialog.
    const dialog = page.getByRole("alertdialog");
    await expect(
      dialog.getByRole("heading", { name: "Decline this shipment request?" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Decline request" }),
    ).toBeDisabled();

    await dialog.getByLabel("Reason").fill("Cover lapsed before that date.");
    await dialog.getByRole("button", { name: "Decline request" }).click();
    await expect(page.getByText("Request declined.")).toBeVisible();

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "minerals.declineShipmentRequest")
        ?.args,
    ).toMatchObject({
      requestId: REQUEST._id,
      note: "Cover lapsed before that date.",
    });
  });
});
