import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import type { E2ESession } from "./stubs/session";

/**
 * The new support request form: a member links the record their question is
 * about, and the dialog turns into a confirmation that hands out the printed
 * reference instead of closing on them.
 *
 * Everything runs against the Convex double, so the spec asserts on the
 * mutation the form sends and on the result the screen is given back; the
 * write path, ownership rules and reference printing are covered by
 * tests/security.test.ts.
 */
const MEMBER: E2ESession = {
  _id: "e2e-support-member",
  name: "Ada Vault",
  email: "ada@example.com",
  role: "customer",
  permissions: [],
};

const CREATED_AT = Date.UTC(2026, 9, 21);

const POLICY = {
  _id: "e2e-support-policy-1",
  policyNumber: "CV-LON-7714",
  productName: "Mineral all-risk",
  status: "active",
  customerUserId: MEMBER._id,
  currency: "GBP",
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const CLAIM = {
  _id: "e2e-support-claim-1",
  reference: "CLM-3301",
  productName: "Mineral all-risk",
  status: "submitted",
  customerUserId: MEMBER._id,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

/** `amount` is in minor units, so the picker shows £4,500.00. */
const PAYMENT = {
  _id: "e2e-support-payment-1",
  reference: "TXN-8842",
  customerUserId: MEMBER._id,
  type: "payment",
  amount: 450_000,
  currency: "GBP",
  status: "succeeded",
  method: "card",
  providerVerified: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

/** What the stub answers for `tickets.create`, mirroring the real return. */
const CREATED = { ticketId: "e2e-support-ticket-1", reference: "SUP-9F2KQ" };

const SUBJECT = "Premium charged twice in October";
const MESSAGE =
  "The October premium was taken twice from the account on file. Please refund the second charge.";

async function openForm(page: Page, fixtures: Record<string, unknown>) {
  await page.addInitScript(
    ({ session, canned }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = canned;
      window.__E2E_MUTATIONS__ = [];
      window.__E2E_QUERY_CALLS__ = [];
    },
    { session: MEMBER, canned: fixtures },
  );
  await page.goto("/dashboard/support");
  await page.getByRole("button", { name: "New request" }).click();
  return page.getByRole("dialog");
}

test.describe("support request form", () => {
  test("links a payment and confirms with the printed reference", async ({
    page,
  }) => {
    const dialog = await openForm(page, {
      "tickets.mine": [],
      "policies.mine": [POLICY],
      "claims.mine": [CLAIM],
      "applications.mine": [],
      "payments.mine": [PAYMENT],
      "tickets.create": CREATED,
    });

    await expect(
      dialog.getByRole("heading", { name: "New support request" }),
    ).toBeVisible();

    // Nothing is linked until a type is chosen, so the record field is absent.
    await expect(dialog.getByLabel("Record")).toHaveCount(0);
    await dialog.getByLabel("Related to").selectOption("transactions");

    // Every payment is identified by its reference and its amount.
    const record = dialog.getByLabel("Record");
    await expect(record.locator("option")).toHaveText([
      "Choose…",
      "TXN-8842 · £4,500.00",
    ]);

    await record.selectOption(PAYMENT._id);
    await dialog.getByLabel("Subject").fill(SUBJECT);
    await dialog.getByLabel("How can we help?").fill(MESSAGE);
    await dialog.getByRole("button", { name: "Send request" }).click();

    // The form becomes a receipt rather than closing on the member.
    await expect(
      dialog.getByRole("heading", { name: "Request received" }),
    ).toBeVisible();
    await expect(dialog.getByText(CREATED.reference)).toBeVisible();
    await expect(
      dialog.getByText("The support queue has been notified."),
    ).toBeVisible();
    await expect(dialog.getByLabel("Subject")).toHaveCount(0);

    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(
      mutations.find((call) => call.ref === "tickets.create")?.args,
    ).toMatchObject({
      category: "policy",
      subject: SUBJECT,
      message: MESSAGE,
      relatedType: "transactions",
      relatedId: PAYMENT._id,
    });

    // "Open thread" hands the new ticket to the thread dialog.
    await dialog.getByRole("button", { name: "Open thread" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__E2E_QUERY_CALLS__ ?? []))
      .toContain("tickets.get");
    await expect(page.getByText("Loading ticket")).toBeVisible();

    // Reopening starts from a blank form, not the previous receipt.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "New request" }).click();
    const reopened = page.getByRole("dialog");
    await expect(
      reopened.getByRole("heading", { name: "New support request" }),
    ).toBeVisible();
    await expect(reopened.getByLabel("Subject")).toHaveValue("");
    await expect(reopened.getByLabel("Related to")).toHaveValue("");
  });

  test("asks for the record when the type is set but nothing is chosen", async ({
    page,
  }) => {
    const dialog = await openForm(page, {
      "tickets.mine": [],
      "policies.mine": [POLICY],
      "claims.mine": [],
      "applications.mine": [],
      "payments.mine": [],
      "tickets.create": CREATED,
    });

    await dialog.getByLabel("Related to").selectOption("applications");
    // The empty state is shown once the list has loaded, beside the picker.
    await expect(
      dialog.getByText("You have no applications yet."),
    ).toBeVisible();
    await expect(dialog.getByLabel("Record").locator("option")).toHaveText([
      "Choose…",
    ]);

    await dialog.getByLabel("Subject").fill(SUBJECT);
    await dialog.getByLabel("How can we help?").fill(MESSAGE);
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(
      dialog.getByRole("alert").filter({
        hasText: "Choose the record this is about",
      }),
    ).toBeVisible();
    // The dialog stays on the form and nothing was written.
    await expect(
      dialog.getByRole("heading", { name: "New support request" }),
    ).toBeVisible();
    const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
    expect(mutations.find((call) => call.ref === "tickets.create")).toBe(
      undefined,
    );
  });
});
