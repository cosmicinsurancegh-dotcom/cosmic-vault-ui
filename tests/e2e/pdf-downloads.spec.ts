import type { Download } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * Dashboard documents leave as PDFs, not spreadsheets.
 *
 * The register is driven through the staff vault floor, and the certificate and
 * assay report through a member's own vault, so each scenario clicks the control
 * a person uses and asserts on the file the browser actually saved.
 */

const ADMIN_SESSION: E2ESession = {
  _id: "e2e-pdf-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "policies.manage", "vault.manage"],
};

const MEMBER_SESSION: E2ESession = {
  _id: "e2e-pdf-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const CREATED_AT = Date.UTC(2026, 4, 6);
const ENDS_AT = Date.UTC(2027, 4, 6);

const POLICY = {
  _id: "e2e-pdf-policy-1",
  mineralId: "e2e-pdf-mineral-1",
  policyNumber: "POL-8801",
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
};

const MINERAL = {
  _id: "e2e-pdf-mineral-1",
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
  assignedUserId: MEMBER_SESSION._id,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const ADMIN_FIXTURES: Record<string, unknown> = {
  "minerals.list": [
    {
      mineral: MINERAL,
      policy: POLICY,
      shipment: null,
      assignee: {
        _id: MEMBER_SESSION._id,
        name: MEMBER_SESSION.name,
        email: MEMBER_SESSION.email,
      },
    },
  ],
};

const MEMBER_FIXTURES: Record<string, unknown> = {
  "minerals.mine": [
    {
      mineral: MINERAL,
      policy: POLICY,
      shipment: null,
      request: null,
      requests: [],
      events: [],
    },
  ],
};

/** The bytes and Latin-1 text of a file the browser saved. */
async function savedFile(download: Download) {
  const file = await download.path();
  expect(file, "the browser should keep the downloaded file on disk").toBeTruthy();
  const bytes = await readFile(file as string);
  // Latin-1 maps one byte to one character, so a PDF's uncompressed text
  // streams can be searched without a parser.
  return { bytes, text: bytes.toString("latin1") };
}

/** A file a member or broker can open: a real PDF, not a renamed table. */
function expectPdf({ bytes, text }: { bytes: Buffer; text: string }) {
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(text).toMatch(/%%EOF\s*$/);
  expect(text).toContain("COSMIC VAULT");
  expect(text).toMatch(/Page 1 of \d+/);
}

test.describe("dashboard PDF downloads", () => {
  test("exports the staff vault register as a PDF", async ({ page }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: ADMIN_SESSION, fixtures: ADMIN_FIXTURES },
    );

    await page.goto("/dashboard/admin/vault");
    await expect(
      page.getByRole("heading", { name: "The vault floor." }),
    ).toBeVisible();
    await expect(page.getByText("Aurum bar")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export register" }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("cosmic-vault-register.pdf");

    const saved = await savedFile(download);
    expectPdf(saved);
    // The register's seventeen columns wrap long cell values across lines, so
    // the assertions read the document's full-width lines and a short cell.
    expect(saved.text).toContain("Vault register");
    expect(saved.text).toContain("1 of 1 records");
    expect(saved.text).toContain("GENERATED");
    expect(saved.text).toContain("GBP");
    // A spreadsheet saved under a .pdf name is the bug this guards against.
    expect(saved.text.startsWith("Mineral,Reference")).toBe(false);
  });

  test("downloads a member's certificate and assay report as PDFs", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
      },
      { session: MEMBER_SESSION, fixtures: MEMBER_FIXTURES },
    );

    await page.goto("/dashboard/vault");
    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening), Ada\./,
      }),
    ).toBeVisible();

    const holding = page.locator("section").filter({ hasText: "CV-MIN-5001" });
    await holding.getByRole("button", { name: "Certificate" }).click();

    const certificateDialog = page.getByRole("dialog");
    await expect(
      certificateDialog.getByRole("heading", {
        name: "One object. One permanent record.",
      }),
    ).toBeVisible();

    const [certificate] = await Promise.all([
      page.waitForEvent("download"),
      certificateDialog.getByRole("button", { name: "Download summary" }).click(),
    ]);

    expect(certificate.suggestedFilename()).toBe("CV-MIN-5001-certificate.pdf");
    const certificateFile = await savedFile(certificate);
    expectPdf(certificateFile);
    expect(certificateFile.text).toContain("Certificate of Authenticity");
    expect(certificateFile.text).toContain("Aurum bar");
    expect(certificateFile.text).toContain("Ada Vault");
    // The details recorded at intake print on the certificate.
    expect(certificateFile.text).toContain("115 x 52 x 9 mm");
    expect(certificateFile.text).toContain("999.9");
    expect(certificateFile.text).toContain("24 ct");
    expect(certificateFile.text).toContain("Bay 4");

    await page.keyboard.press("Escape");
    await expect(certificateDialog).toHaveCount(0);

    await holding.getByRole("button", { name: "Assay report" }).click();

    const assayDialog = page.getByRole("dialog");
    await expect(
      assayDialog.getByRole("heading", {
        name: "Independent verification of the object in custody.",
      }),
    ).toBeVisible();

    const [assay] = await Promise.all([
      page.waitForEvent("download"),
      assayDialog.getByRole("button", { name: "Download summary" }).click(),
    ]);

    expect(assay.suggestedFilename()).toBe("CV-MIN-5001-assay.pdf");
    const assayFile = await savedFile(assay);
    expectPdf(assayFile);
    expect(assayFile.text).toContain("Assay & Appraisal Report");
    expect(assayFile.text).toContain("CV-MIN-5001");
  });
});
