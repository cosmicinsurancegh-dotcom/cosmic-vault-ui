import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * Editing and deleting an account from the dashboards.
 *
 * Convex is doubled out here (see `tests/e2e/stubs`), so these assertions are
 * about the browser flow and the request each control sends: the email dialog
 * posts the new address, deleting the account posts the reason and drops the
 * session, and a super admin is told the deletion is not available instead of
 * being offered a button the server would refuse. The writes themselves are
 * covered by `tests/account.test.ts`.
 */
const CUSTOMER_ID = "e2e-account-customer";

const CUSTOMER: E2ESession = {
  _id: CUSTOMER_ID,
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const SUPER_ADMIN: E2ESession = {
  _id: "e2e-account-owner",
  name: "Noor Vault",
  email: "noor@example.com",
  role: "super_admin",
  permissions: [],
};

const ADMIN: E2ESession = {
  _id: "e2e-account-admin",
  name: "Ops Admin",
  email: "ops@example.com",
  role: "admin",
  permissions: ["customers.view", "customers.manage"],
};

const JOINED_AT = Date.UTC(2026, 0, 12);

function profileFor(session: E2ESession) {
  return {
    userId: session._id,
    reference: "CV-CUST-1001",
    fullName: session.name,
    email: session.email,
    phone: "+44 20 7946 0000",
    country: "GB",
    city: "London",
    currency: "GBP",
    locale: "en-GB",
    timezone: "Europe/London",
    preferredLanguage: "en",
    marketingOptIn: false,
    verificationStatus: "verified",
    createdAt: JOINED_AT,
    updatedAt: JOINED_AT,
  };
}

const REFERENCE_DATA = {
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
};

/** Fixtures for the account holder's own profile page. */
function profileFixtures(
  session: E2ESession,
  options: { hasPassword?: boolean; profile?: unknown } = {},
) {
  return {
    "customers.me": {
      user: {
        _id: session._id,
        name: session.name,
        email: session.email,
        role: session.role,
        status: "active",
        emailVerificationTime: JOINED_AT,
      },
      profile: options.profile === undefined ? profileFor(session) : options.profile,
    },
    "setup.referenceData": REFERENCE_DATA,
    "brokers.myProfile": null,
    "accountSecurity.passwordStatus": {
      hasPassword: options.hasPassword ?? false,
    },
  };
}

async function openProfile(
  page: Page,
  session: E2ESession,
  fixtures: Record<string, unknown>,
) {
  await page.addInitScript(
    ({ session, fixtures }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = fixtures;
      window.__E2E_MUTATIONS__ = [];
      window.__E2E_ACTIONS__ = [];
    },
    { session, fixtures },
  );
  await page.goto("/dashboard/profile");
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/dashboard/profile");
}

function mutations(page: Page) {
  return page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
}

test.describe("account editing and deletion", () => {
  test("a customer changes the address their codes are sent to", async ({
    page,
  }) => {
    await openProfile(page, CUSTOMER, profileFixtures(CUSTOMER));

    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Account & sign-in" }),
    ).toBeVisible();
    await expect(main.getByText("ada@example.com", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Change email" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Change your sign-in email"),
    ).toBeVisible();

    await dialog.getByLabel("New email address").fill("ada@new.example");
    await dialog.getByRole("button", { name: "Save email" }).click();

    await expect(page.getByText("Sign-in email updated.")).toBeVisible();
    expect(await mutations(page)).toContainEqual({
      ref: "accountSecurity.changeEmail",
      args: { email: "ada@new.example" },
    });
  });

  test("a customer deletes their own account and is signed out", async ({
    page,
  }) => {
    await openProfile(page, CUSTOMER, profileFixtures(CUSTOMER));

    await page.getByRole("button", { name: "Delete my account" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Delete your account?")).toBeVisible();

    await dialog
      .getByLabel(/anything you want us to know/i)
      .fill("Moving to another insurer.");
    await dialog.getByRole("button", { name: "Delete my account" }).click();

    // The request carries the reason the audit trail records.
    await expect
      .poll(async () => await mutations(page))
      .toContainEqual({
        ref: "accountSecurity.closeAccount",
        args: { reason: "Moving to another insurer." },
      });

    // Deleting signs the account out and returns it to the public site.
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  test("a super admin is told the account cannot be deleted", async ({
    page,
  }) => {
    await openProfile(
      page,
      SUPER_ADMIN,
      profileFixtures(SUPER_ADMIN, { profile: null }),
    );

    // The staff dashboard, not the customer one: no customer profile exists.
    await expect(
      page.getByRole("main").getByText("Your staff account."),
    ).toBeVisible();
    await expect(
      page.getByText(/super admin accounts cannot be deleted/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete my account" }),
    ).toHaveCount(0);

    // The rest of the account is still editable.
    await expect(page.getByRole("button", { name: "Change email" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set a password" }),
    ).toBeVisible();
  });

  test("an administrator edits their own name from the staff dashboard", async ({
    page,
  }) => {
    await openProfile(page, ADMIN, profileFixtures(ADMIN, { profile: null }));

    const name = page.getByLabel("Full name");
    await expect(name).toHaveValue("Ops Admin");
    await name.fill("Ops Administrator");
    await page.getByRole("button", { name: "Save details" }).click();

    await expect(page.getByText("Details saved.")).toBeVisible();
    expect(await mutations(page)).toContainEqual({
      ref: "accountSecurity.updateName",
      args: { name: "Ops Administrator" },
    });
  });

  test("staff change a customer's email and password from the record", async ({
    page,
  }) => {
    const fixtures: Record<string, unknown> = {
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
        profile: profileFor(CUSTOMER),
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
      "setup.referenceData": REFERENCE_DATA,
      "minerals.forOwner": [],
    };

    await page.addInitScript(
      ({ session, fixtures }) => {
        window.__E2E_SESSION__ = session;
        window.__E2E_FIXTURES__ = fixtures;
        window.__E2E_MUTATIONS__ = [];
        window.__E2E_ACTIONS__ = [];
      },
      { session: ADMIN, fixtures },
    );
    await page.goto("/dashboard/admin/customers");
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/admin/customers");

    await page.getByRole("button", { name: "Open" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Sign-in credentials")).toBeVisible();

    const email = dialog.getByLabel("Sign-in email");
    await expect(email).toHaveValue("ada@example.com");
    await email.fill("ada@new.example");
    await dialog.getByRole("button", { name: "Change email" }).click();
    await expect
      .poll(async () => await mutations(page))
      .toContainEqual({
        ref: "accountSecurity.staffChangeEmail",
        args: { userId: CUSTOMER_ID, email: "ada@new.example" },
      });

    await dialog.getByLabel("New password").fill("a fresh password");
    await dialog.getByRole("button", { name: "Set password" }).click();
    await expect
      .poll(async () => await page.evaluate(() => window.__E2E_ACTIONS__ ?? []))
      .toContainEqual({
        ref: "accountSecurity.staffSetPassword",
        args: { userId: CUSTOMER_ID, password: "a fresh password" },
      });

    // Deleting asks for a reason first, and confirms before writing.
    await dialog
      .getByPlaceholder(/reason \(recorded on the audit trail\)/i)
      .fill("Customer asked us to close it.");
    await dialog.getByRole("button", { name: "Delete account" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(
      confirm.getByText("Delete this customer's account?"),
    ).toBeVisible();
    await confirm.getByRole("button", { name: "Delete account" }).click();

    await expect
      .poll(async () => await mutations(page))
      .toContainEqual({
        ref: "customers.closeAccount",
        args: { userId: CUSTOMER_ID, reason: "Customer asked us to close it." },
      });
  });
});
