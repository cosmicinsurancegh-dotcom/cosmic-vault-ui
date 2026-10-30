import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The band on a member's home reads the same live minerals as `/dashboard/vault`.
 * This spec drives the real page against the Convex double: the totals come from
 * the assigned records, the featured holdings are the highest declared values,
 * an empty account gets an invitation, and no screen can load a sample
 * collection into the browser any more.
 */
const MEMBER_SESSION: E2ESession = {
  _id: "e2e-band-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const MEMBER_ID = MEMBER_SESSION._id;
const CREATED_AT = Date.UTC(2026, 5, 2);
const ENDS_AT = Date.UTC(2027, 5, 2);
const ETA = Date.UTC(2026, 5, 20);

const OVERVIEW = {
  kind: "customer",
  defaultCurrency: "GBP",
  metrics: {
    activePolicies: 0,
    pendingApplications: 0,
    openClaims: 0,
    pendingRequests: 0,
  },
  outstanding: [],
  renewals: [],
  recentPolicies: [],
  // The home page lists lapsed cover under its own panel; the query always
  // returns the array, so the fixture has to carry it too.
  lapsedCover: [],
  infoRequests: [],
  recentDocuments: [],
  recentClaims: [],
  recentTransactions: [],
  notifications: [],
  unreadNotifications: 0,
};

const ROWS = [
  {
    mineral: {
      _id: "e2e-band-vault-1",
      name: "Aurum bar",
      reference: "CV-MIN-7001",
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
    policy: {
      _id: "e2e-band-policy-1",
      mineralId: "e2e-band-vault-1",
      policyNumber: "POL-7001",
      provider: "Lloyd's of London",
      coverage: "all_risk",
      coverageLimit: 9000000,
      premium: 45000,
      currency: "GBP",
      startDate: CREATED_AT,
      endDate: ENDS_AT,
      status: "active",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    shipment: {
      _id: "e2e-band-shipment-1",
      mineralId: "e2e-band-vault-1",
      reference: "CV-SHP-7001",
      carrier: "Brink's",
      trackingNumber: "BR-7701-01",
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
    events: [],
  },
  {
    mineral: {
      _id: "e2e-band-vault-2",
      name: "Silver ingot",
      reference: "CV-MIN-7002",
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
    shipment: null,
    events: [],
  },
];

/**
 * One holding, uncovered, carrying the longest money string the band renders.
 * This is the shape that pushed the panel's content past its own edge: a
 * `truncate` name is nowrap, so an auto grid track sized itself to the name
 * plus the untruncated value and the money was clipped on a phone.
 */
const LONG_VALUE_ROWS = [
  {
    mineral: {
      _id: "e2e-band-vault-long",
      name: "Emerald Green Jadeites",
      reference: "CV-MIN-7003",
      category: "Precious stones",
      quantity: 1,
      unit: "ct",
      declaredValue: 940000000,
      currency: "USD",
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

/**
 * The band is one responsive panel; the narrow, phone, tablet and desktop
 * breakpoints restack the same three columns and change how the featured tile
 * is sized, so each has to be checked for content pushed past the panel's own
 * edge.
 */
const VIEWPORTS = [
  { name: "narrow", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

/**
 * A covered holding with a nine-figure value, so the same money string renders
 * in all three places the band can show one: the heading's covered total, the
 * declared figure, and the register row.
 */
const LONG_COVERED_ROWS = [
  {
    mineral: {
      _id: "e2e-band-vault-covered",
      name: "Emerald Green Jadeites",
      reference: "CV-MIN-7004",
      category: "Precious stones",
      quantity: 1,
      unit: "ct",
      declaredValue: 940000000,
      currency: "USD",
      status: "active",
      assignedUserId: MEMBER_ID,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    policy: {
      _id: "e2e-band-policy-covered",
      mineralId: "e2e-band-vault-covered",
      policyNumber: "POL-7004",
      provider: "Lloyd's of London",
      coverage: "all_risk",
      coverageLimit: 940000000,
      premium: 45000,
      currency: "USD",
      startDate: CREATED_AT,
      endDate: ENDS_AT,
      status: "active",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    shipment: null,
    events: [],
  },
];

/**
 * Two covered holdings in different currencies, so the declared total is long
 * enough to wrap on a narrow row.
 */
const MIXED_CURRENCY_ROWS = [
  ...LONG_COVERED_ROWS,
  {
    mineral: {
      _id: "e2e-band-vault-gbp",
      name: "Aurum bar",
      reference: "CV-MIN-7005",
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
    policy: {
      _id: "e2e-band-policy-gbp",
      mineralId: "e2e-band-vault-gbp",
      policyNumber: "POL-7005",
      provider: "Lloyd's of London",
      coverage: "all_risk",
      coverageLimit: 7800000,
      premium: 45000,
      currency: "GBP",
      startDate: CREATED_AT,
      endDate: ENDS_AT,
      status: "active",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    shipment: null,
    events: [],
  },
];

/**
 * Rebuild the rendered lines of a node one character at a time, so a separator
 * left at the end of a line can be seen as such.
 */
function renderedLines(node: Element) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const lines = new Map<number, string>();
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const content = text as Text;
    for (let index = 0; index < content.length; index += 1) {
      const range = document.createRange();
      range.setStart(content, index);
      range.setEnd(content, index + 1);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      const top = Math.round(rect.top);
      lines.set(top, (lines.get(top) ?? "") + content.data[index]);
    }
  }
  return [...lines.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, line]) => line);
}

async function startSignedIn(page: Page, rows: unknown = ROWS) {
  await page.addInitScript(
    ({ session, fixtures }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
    },
    {
      session: MEMBER_SESSION,
      fixtures: { "minerals.mine": rows, "reports.overview": OVERVIEW },
    },
  );
}

test.describe("member home vault band", () => {
  test("summarises the holdings staff assigned, not a local sample", async ({
    page,
  }) => {
    await startSignedIn(page);
    await page.goto("/dashboard");

    const band = page.locator("section").filter({ hasText: "Vault holdings" });

    await expect(
      band.getByRole("heading", { level: 2, name: /2 objects\./ }),
    ).toBeVisible();
    // Only the insured record contributes cover (£90,000.00).
    await expect(band.getByText("£90,000.00")).toBeVisible();
    await expect(band.getByText("of 2")).toBeVisible();
    // Declared values add up across every holding (£78,000 + £1,800).
    await expect(band.getByText("£79,800.00")).toBeVisible();
    await expect(band.getByText("shipment", { exact: true })).toBeVisible();

    // The two featured tiles are the live records with their shipping state.
    await expect(band.getByText("Aurum bar")).toBeVisible();
    await expect(band.getByText("In transit")).toBeVisible();
    await expect(band.getByText("Silver ingot")).toBeVisible();
    await expect(band.getByText("In vault")).toBeVisible();

    // The demonstration collection is gone, and nothing was written locally.
    await expect(
      page.getByRole("button", { name: /Load demonstration collection/ }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => window.localStorage.getItem("cosmic-vault.minerals.v1")),
    ).toBeNull();

    expect(
      await page.evaluate(() => window.__E2E_QUERY_CALLS__ ?? []),
    ).toContain("minerals.mine");
  });

  for (const viewport of VIEWPORTS) {
    test(`keeps every element inside the panel at ${viewport.name} width`, async ({
      page,
    }) => {
      await startSignedIn(page, LONG_VALUE_ROWS);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      const band = page.locator("section").filter({ hasText: "Vault holdings" });
      // The longest string on the band is the value that used to be clipped.
      await expect(band.getByText("US$9,400,000.00").first()).toBeVisible();

      /* Nothing in normal flow may cross the panel's padding box. The decorative
         glow is absolutely positioned and meant to bleed, so it is excluded. */
      const offenders = await band.evaluate((node) => {
        const styles = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        const left = box.left + parseFloat(styles.paddingLeft);
        const right = box.right - parseFloat(styles.paddingRight);
        const rows: { tag: string; overshoot: number }[] = [];
        node.querySelectorAll("*").forEach((child) => {
          const style = getComputedStyle(child);
          // Hidden nodes report a zero rect, which would read as off-panel.
          if (style.position === "absolute" || style.display === "none") return;
          const rect = child.getBoundingClientRect();
          const overshoot = Math.max(rect.right - right, left - rect.left);
          if (overshoot > 1) {
            rows.push({
              tag: child.tagName.toLowerCase(),
              overshoot: Math.round(overshoot),
            });
          }
        });
        return rows;
      });

      expect(offenders).toEqual([]);
    });
  }

  for (const viewport of VIEWPORTS) {
    test(`keeps each money value on one line at ${viewport.name} width`, async ({
      page,
    }) => {
      await startSignedIn(page, LONG_COVERED_ROWS);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      const band = page.locator("section").filter({ hasText: "Vault holdings" });
      // The declared row always carries the exact figure; the heading goes
      // compact on phones, so its copy of the string is hidden there.
      await expect(
        band.locator("dd").filter({ hasText: "US$9,400,000.00" }),
      ).toBeVisible();

      /* A Range reports one rect per line it covers, so a value broken across
         lines shows up as more than one distinct top. These strings hold no
         spaces, so the only way to break one is a style that allows breaking
         mid-figure — the tempting shortcut to an overflow fix. */
      const report = await band.evaluate((node) => {
        // Phones show compact figures, so a trailing K/M/B is part of a value.
        const single = String.raw`(?:[A-Z]{0,3}\$|[$£€¥₹])\s?\d[\d,]*(?:\.\d+)?[KMBkmb]?`;
        const money = new RegExp(String.raw`^${single}(?:\s*·\s*${single})*$`);
        const wrapped: { text: string; lines: number }[] = [];
        let measured = 0;
        node.querySelectorAll("*").forEach((child) => {
          // Only leaves render a value; a wrapper's text is not one string.
          if (child.children.length > 0) return;
          const text = (child.textContent ?? "").trim();
          if (!money.test(text)) return;
          if (getComputedStyle(child).display === "none") return;
          const range = document.createRange();
          range.selectNodeContents(child);
          const tops = new Set<number>();
          for (const rect of range.getClientRects()) {
            if (rect.width === 0 || rect.height === 0) continue;
            tops.add(Math.round(rect.top));
          }
          measured += 1;
          if (tops.size > 1) wrapped.push({ text, lines: tops.size });
        });
        return { wrapped, measured };
      });

      // The heading, the declared total and the register row all carry it. A
      // lower count would mean the selector missed and nothing was checked.
      expect(report.measured).toBeGreaterThanOrEqual(3);
      expect(report.wrapped).toEqual([]);
    });
  }

  test("keeps a featured row legible on a 320px screen", async ({ page }) => {
    await startSignedIn(page, LONG_VALUE_ROWS);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/dashboard");

    const band = page.locator("section").filter({ hasText: "Vault holdings" });
    const row = band.locator("ul > li > a").first();
    await expect(row).toBeVisible();

    /* Under 17.5rem of register the value drops to its own line so the name
       keeps the whole column; sharing the row left it about two words wide and
       cut the identifying end of the name off. Readability here means the name
       owns the row's width, the value sits below it in full, and the state word
       survives — each of which a narrow-screen regression could take away
       without overflowing anything. */
    const metrics = await row.evaluate((link) => {
      const panel = link.closest("section") as HTMLElement;
      const box = panel.getBoundingClientRect();
      const panelStyles = getComputedStyle(panel);
      const innerRight = box.right - parseFloat(panelStyles.paddingRight);

      const name = link.querySelector(".line-clamp-2") as HTMLElement | null;
      const leaves = [...link.querySelectorAll("span")].filter(
        (span) => span.children.length === 0,
      );
      const state = leaves.find((span) => span.textContent?.trim() === "In vault");
      const values = leaves.filter((span) =>
        /(?:[A-Z]{0,3}\$|[$£€¥₹])\s?\d[\d,]*\.\d{2}/.test(span.textContent ?? ""),
      );
      const money = values[values.length - 1];
      const nameBox = name?.getBoundingClientRect();
      const moneyBox = money?.getBoundingClientRect();
      const stateBox = state?.getBoundingClientRect();

      return {
        rowWidth: Math.round(link.getBoundingClientRect().width),
        rowHeight: Math.round(link.getBoundingClientRect().height),
        nameWidth: nameBox ? Math.round(nameBox.width) : 0,
        nameBottom: nameBox ? Math.round(nameBox.bottom) : 0,
        moneyWidth: moneyBox ? Math.round(moneyBox.width) : 0,
        moneyTop: moneyBox ? Math.round(moneyBox.top) : 0,
        moneyRight: moneyBox ? Math.round(moneyBox.right) : 0,
        innerRight: Math.round(innerRight),
        stateWidth: stateBox ? Math.round(stateBox.width) : 0,
      };
    });

    // 44px is the smallest comfortable touch target for the row's link.
    expect(metrics.rowHeight).toBeGreaterThanOrEqual(44);
    // The name owns most of the row. Sharing it with the value left ~30%.
    expect(metrics.nameWidth).toBeGreaterThan(metrics.rowWidth * 0.6);
    // The value sits on its own line rather than beside the name.
    expect(metrics.moneyTop).toBeGreaterThanOrEqual(metrics.nameBottom - 1);
    // The value renders in full inside the panel, not clipped by its edge.
    expect(metrics.moneyWidth).toBeGreaterThan(0);
    expect(metrics.moneyRight).toBeLessThanOrEqual(metrics.innerRight);
    // Custody state is the last thing that may go, so it has to be there.
    expect(metrics.stateWidth).toBeGreaterThan(0);
  });

  /* Both widths matter: the declared total strands the dot at 320 and the
     heading does at 340, so each one checks the other's failure case. */
  for (const width of [320, 340]) {
    test(`breaks totals between amounts, never at the dot (${width}px)`, async ({
      page,
    }) => {
      await startSignedIn(page, MIXED_CURRENCY_ROWS);
      await page.setViewportSize({ width, height: 640 });
      await page.goto("/dashboard");

      const band = page.locator("section").filter({ hasText: "Vault holdings" });
      // Two currencies, so both totals have to wrap at this width.
      const declaredTotal = band
        .locator("dd")
        .filter({ hasText: "US$9,400,000.00" });
      await expect(declaredTotal).toBeVisible();
      await expect(declaredTotal).toContainText("£78,000.00");

      const heading = band.getByRole("heading", { level: 2 });
      const declared = declaredTotal;

      for (const total of [heading, declared]) {
        const lines = await total.evaluate(renderedLines);
        // The total wrapped, so there is a line break for the dot to fall foul of.
        expect(lines.length).toBeGreaterThan(1);
        const dangling = lines.filter((line) => line.trimEnd().endsWith("·"));
        expect(dangling).toEqual([]);
      }
    });
  }

  /* The heading carries the whole claim: count, both totals and the phrase.
     At 1.5rem it ran to four lines in a 248px panel; three is the ceiling. */
  for (const width of [320, 340]) {
    test(`keeps the covered heading to three lines (${width}px)`, async ({
      page,
    }) => {
      await startSignedIn(page, MIXED_CURRENCY_ROWS);
      await page.setViewportSize({ width, height: 640 });
      await page.goto("/dashboard");

      const heading = page
        .locator("section")
        .filter({ hasText: "Vault holdings" })
        .getByRole("heading", { level: 2 });
      await expect(heading).toBeVisible();

      /* Read the lines that actually render. The heading keeps a compact and
         an exact value in the DOM and shows one, so textContent cannot tell
         which the reader sees; rendered rects can. */
      const lines = await heading.evaluate(renderedLines);
      const text = lines.join(" ");
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(text).toContain("US$9.4m");
      expect(text).toContain("£78k");
      expect(text).toContain("under cover.");
      expect(text).not.toContain("US$9,400,000.00");
    });
  }

  test("keeps a single-currency total exact in the heading", async ({ page }) => {
    await startSignedIn(page, LONG_COVERED_ROWS);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/dashboard");

    const heading = page
      .locator("section")
      .filter({ hasText: "Vault holdings" })
      .getByRole("heading", { level: 2 });
    await expect(heading).toBeVisible();

    // Abbreviating a lone amount would cost precision for no gain.
    const text = (await heading.evaluate(renderedLines)).join(" ");
    expect(text).toContain("US$9,400,000.00");
    expect(text).not.toContain("US$9.4m");
  });

  test("matches the totals on the member vault page", async ({ page }) => {
    await startSignedIn(page);
    await page.goto("/dashboard");
    const band = page.locator("section").filter({ hasText: "Vault holdings" });
    await expect(band.getByText("£90,000.00")).toBeVisible();

    await page.goto("/dashboard/vault");
    await expect(page.getByText("Insured value")).toBeVisible();
    await expect(page.getByText("£90,000.00", { exact: true })).toBeVisible();
    await expect(page.getByText("1 insured · 1 without cover")).toBeVisible();
  });

  test("invites an empty account to open the vault", async ({ page }) => {
    await startSignedIn(page, []);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "The first object makes the record.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the vault" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Talk to the vault desk" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Load demonstration collection/ }),
    ).toHaveCount(0);
  });
});
