import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The member tracking desk now reads the same Convex shipments staff work
 * from. This spec drives the real page against the Convex double: live
 * journeys with their events, the status and search filters, the empty state,
 * and the absence of any staff control.
 */
const MEMBER_SESSION: E2ESession = {
  _id: "e2e-shipment-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const MEMBER_ID = MEMBER_SESSION._id;
const CREATED_AT = Date.UTC(2026, 3, 2);
const ETA = Date.UTC(2026, 3, 20);
const DELIVERED_AT = Date.UTC(2026, 3, 9);

const POLICY = {
  _id: "e2e-ship-policy-1",
  mineralId: "e2e-member-mineral-1",
  policyNumber: "POL-7721",
  provider: "Lloyd's of London",
  coverage: "all_risk",
  coverageLimit: 9000000,
  premium: 45000,
  currency: "GBP",
  startDate: CREATED_AT,
  endDate: Date.UTC(2027, 3, 2),
  status: "active",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const ROWS = [
  {
    mineral: {
      _id: "e2e-member-mineral-1",
      name: "Aurum bar",
      reference: "CV-MIN-3001",
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
      _id: "e2e-member-shipment-1",
      mineralId: "e2e-member-mineral-1",
      reference: "CV-SHP-3001",
      carrier: "Brink's",
      trackingNumber: "BR-4471-88",
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
        _id: "e2e-member-event-1",
        status: "in_transit",
        location: "Basel, CH",
        note: "Cleared customs in Basel.",
        createdAt: CREATED_AT + 1000,
      },
      {
        _id: "e2e-member-event-2",
        status: "preparing",
        location: "London vault",
        note: "Packed under dual control.",
        createdAt: CREATED_AT,
      },
    ],
  },
  {
    mineral: {
      _id: "e2e-member-mineral-2",
      name: "Silver ingot",
      reference: "CV-MIN-3002",
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
    shipment: {
      _id: "e2e-member-shipment-2",
      mineralId: "e2e-member-mineral-2",
      reference: "CV-SHP-3002",
      carrier: "Malca-Amit",
      trackingNumber: "MA-9021-14",
      origin: "London vault",
      destination: "Antwerp vault",
      status: "delivered",
      currentLocation: "Antwerp vault",
      estimatedArrivalAt: ETA,
      assignedUserId: MEMBER_ID,
      createdAt: CREATED_AT,
      updatedAt: DELIVERED_AT,
      lastStatusAt: DELIVERED_AT,
    },
    events: [
      {
        _id: "e2e-member-event-3",
        status: "delivered",
        location: "Antwerp vault",
        note: "Signed for by T. Berg.",
        createdAt: DELIVERED_AT,
      },
    ],
  },
  {
    // Held in the vault: the shipments desk lists journeys, not holdings.
    mineral: {
      _id: "e2e-member-mineral-3",
      name: "Opal cabochon",
      reference: "CV-MIN-3003",
      category: "Opal",
      quantity: 1,
      unit: "ct",
      declaredValue: 240000,
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

async function startSignedIn(page: Page) {
  await page.addInitScript(
    ({ session, fixtures }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
    },
    { session: MEMBER_SESSION, fixtures: { "minerals.mine": ROWS } },
  );
}

test.describe("member shipment tracking", () => {
  test("shows live journeys, events and working filters", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/shipments");

    await expect(
      page.getByRole("heading", { name: "Every movement, on the record." }),
    ).toBeVisible();
    await expect(page.getByText("BR-4471-88")).toBeVisible();
    await expect(page.getByText("MA-9021-14")).toBeVisible();
    // The route is drawn as a dispatch board, so its ends carry the place names
    // and the rail itself names the whole journey for assistive technology.
    await expect(
      page.getByLabel("Route from London vault to Zurich vault"),
    ).toBeVisible();
    await expect(page.getByText("Zurich vault", { exact: true })).toBeVisible();
    await expect(page.getByText(/Cleared customs in Basel\./)).toBeVisible();
    await expect(page.getByText(/Signed for by T\. Berg\./)).toBeVisible();

    // Holdings without a consignment stay on the minerals page.
    await expect(page.getByText("Opal cabochon")).toHaveCount(0);

    // Members never get the staff controls.
    await expect(page.getByLabel(/Update shipment status/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Assign", exact: true }),
    ).toHaveCount(0);

    // Status filter.
    await page.getByRole("button", { name: "In transit (1)" }).click();
    await expect(page.getByText("BR-4471-88")).toBeVisible();
    await expect(page.getByText("MA-9021-14")).toHaveCount(0);

    // Search inside the filtered set, then reset from the empty state.
    await page.getByLabel("Search shipments").fill("silver");
    await expect(page.getByText("No shipments match.")).toBeVisible();
    await page.getByRole("button", { name: "Show every movement" }).click();
    await expect(page.getByText("MA-9021-14")).toBeVisible();
  });

  test("searches by carrier and tracking number", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/shipments");

    await page.getByLabel("Search shipments").fill("MA-9021");
    await expect(page.getByText("MA-9021-14")).toBeVisible();
    await expect(page.getByText("BR-4471-88")).toHaveCount(0);

    await page.getByLabel("Search shipments").fill("malca");
    await expect(page.getByText("MA-9021-14")).toBeVisible();
  });

  test("opens live tracking in a dialog from the row or the card", async ({
    page,
  }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/shipments");

    // Row actions stay available without opening the record.
    await page.getByRole("button", { name: "Actions for CV-SHP-3001" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Show live tracking" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const toggle = page.getByRole("button", {
      name: "Open live tracking for CV-SHP-3001",
    });
    await expect(toggle).toHaveAttribute("aria-haspopup", "dialog");
    await toggle.click();

    const panel = page.locator("#live-e2e-member-shipment-1");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: "Live shipment tracking" }),
    ).toBeVisible();
    await expect(panel.getByLabel("Milestones for CV-SHP-3001")).toBeVisible();
    await expect(panel.getByText("Transport mode")).toBeVisible();
    await expect(
      panel.getByText("Brink's", { exact: true }).first(),
    ).toBeVisible();
    await expect(panel.getByText("Shipment details")).toBeVisible();
    await expect(panel.getByText("Gold", { exact: true })).toBeVisible();
    await expect(panel.getByText("Cover", { exact: true })).toBeVisible();
    await expect(panel.getByText("Lloyd's of London")).toBeVisible();
    await expect(panel.getByText("Progress updates")).toBeVisible();
    await expect(panel.getByText("Cleared customs in Basel.")).toBeVisible();

    // The live view fits its card at desk width and the map keeps its height.
    await expect(panel.locator(".shipment-map")).toBeVisible();
    const layout = await panel.evaluate((node) => ({
      overflow: node.scrollWidth - node.clientWidth,
      mapHeight: Math.round(
        document.querySelector(".shipment-map")?.getBoundingClientRect()
          .height ?? 0,
      ),
    }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.mapHeight).toBeGreaterThan(200);

    // One consignment at a time: the dialog names the row it belongs to.
    await expect(
      page.getByRole("dialog").getByText("Live tracking for CV-SHP-3001"),
    ).toBeAttached();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The whole card is the target, not just the arrow button.
    const row = page.locator("article").filter({ hasText: "CV-SHP-3001" });
    await row.getByText("CV-SHP-3001").click();
    await expect(panel).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A control inside the card does its own job instead of opening the record.
    await page.getByRole("button", { name: "Actions for CV-SHP-3001" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Copy tracking number" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "View my minerals" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("wears the same route rail on the minerals page", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard/minerals");

    // The member's record view reads the same rail as the tracking desk.
    const rail = page.getByLabel("Route from London vault to Zurich vault");
    await expect(rail).toBeVisible();
    await expect(rail.getByText("Origin")).toBeVisible();
    await expect(rail.getByText("Position")).toBeVisible();
    await expect(rail.getByText("Destination")).toBeVisible();
    await expect(rail.getByText("Basel, CH", { exact: true })).toBeVisible();
    await expect(rail.getByText("Brink's", { exact: true })).toBeVisible();
  });

  test("explains an empty tracking desk", async ({ page }) => {
    await page.addInitScript(
      ({ session }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = { "minerals.mine": [] };
      },
      { session: MEMBER_SESSION },
    );
    await page.goto("/dashboard/shipments");

    await expect(page.getByText("Nothing is moving right now.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View my minerals" }),
    ).toBeVisible();
  });
});
