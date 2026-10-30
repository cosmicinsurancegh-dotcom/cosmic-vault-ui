import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { ADMIN_SESSION, CUSTOMER_SESSION } from "./stubs/session";
import type { E2ESession } from "./stubs/session";

/**
 * The support thread: the record a request was filed about, and the staff
 * member who owns it.
 *
 * Both halves come back from `tickets.get`, so the spec supplies that query's
 * result and asserts what the dialog renders - which is where the two screens
 * disagree most easily, since the customer's dialog has no owner strip and the
 * linked record's "Open" link has to leave for a screen the viewer can reach.
 * Writing a ticket, resolving the record and the permission gate are covered by
 * tests/security.test.ts.
 */
const CREATED_AT = Date.UTC(2026, 9, 21);
const UPDATED_AT = Date.UTC(2026, 9, 28);

const TICKET_ID = "e2e-thread-ticket-1";

const OTHER_STAFF = { _id: "e2e-staff-sam", name: "Sam Osei" };

const TICKET = {
  _id: TICKET_ID,
  reference: "SUP-4TQ2M",
  userId: CUSTOMER_SESSION._id,
  category: "payment",
  subject: "Premium taken twice in October",
  status: "open",
  priority: "normal",
  relatedType: "transactions",
  relatedId: "e2e-thread-payment-1",
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

/** What `tickets.get` resolves the linked payment to. `title` is the payment
 *  type, and the amount stays in minor units for the client to format. */
const RELATED_PAYMENT = {
  type: "transactions",
  reference: "TXN-8842",
  title: "Premium",
  status: "succeeded",
  amount: 450_000,
  currency: "GBP",
};

const MESSAGE = {
  _id: "e2e-thread-message-1",
  ticketId: TICKET_ID,
  authorId: CUSTOMER_SESSION._id,
  authorRole: "customer",
  body: "The October premium was taken twice. Please refund the second charge.",
  internal: false,
  createdAt: CREATED_AT,
};

/** The `tickets.get` result, with the owner as the thread resolves it. */
function ticketDetail({
  staff,
  assignee = null,
  assignedTo,
}: {
  staff: boolean;
  assignee?: { _id: string; name: string } | null;
  assignedTo?: string;
}) {
  return {
    ticket: { ...TICKET, assignedTo },
    user: {
      _id: CUSTOMER_SESSION._id,
      name: CUSTOMER_SESSION.name,
      email: CUSTOMER_SESSION.email,
    },
    assignee,
    messages: [MESSAGE],
    isStaff: staff,
    related: RELATED_PAYMENT,
  };
}

async function signIn(
  page: Page,
  session: E2ESession,
  fixtures: Record<string, unknown>,
) {
  await page.addInitScript(
    ({ session, canned }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = canned;
      window.__E2E_MUTATIONS__ = [];
      window.__E2E_QUERY_CALLS__ = [];
    },
    { session, canned: fixtures },
  );
}

/** Every call the thread has sent for one mutation, in order. */
async function calls(page: Page, ref: string) {
  const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
  return mutations.filter((call) => call.ref === ref);
}

async function assignCalls(page: Page) {
  return calls(page, "tickets.assign");
}

test.describe("support thread", () => {
  test("shows the member the payment their request is about", async ({
    page,
  }) => {
    await signIn(page, CUSTOMER_SESSION, {
      "tickets.mine": [TICKET],
      "tickets.get": ticketDetail({ staff: false }),
    });
    await page.goto("/dashboard/support");
    await page.getByRole("button", { name: "Open thread" }).click();
    const dialog = page.getByRole("dialog");

    await expect(
      dialog.getByRole("heading", { name: /SUP-4TQ2M/ }),
    ).toBeVisible();
    await expect(dialog.getByText(MESSAGE.body)).toBeVisible();

    // The row names the record type, then its reference and what it was for, so
    // the member never has to guess which payment the thread means.
    await expect(dialog.getByText("Payment", { exact: true })).toBeVisible();
    await expect(dialog.getByText("TXN-8842", { exact: true })).toBeVisible();
    await expect(dialog.getByText("· Premium", { exact: true })).toBeVisible();
    await expect(dialog.getByText("· £4,500.00", { exact: true })).toBeVisible();
    // `succeeded` reads as "Confirmed" everywhere else in the app.
    await expect(dialog.getByText("Confirmed", { exact: true })).toBeVisible();

    // The link leaves for the screen this viewer can actually open.
    await expect(dialog.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/dashboard/payments",
    );

    // A member's own thread has no owner to show or change.
    await expect(dialog.getByText("Owner", { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /Assign to me|Take over|Release/ }),
    ).toHaveCount(0);
  });

  test("lets staff claim an unassigned ticket from its thread", async ({
    page,
  }) => {
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: [
          { ...TICKET, customerName: CUSTOMER_SESSION.name, assigneeName: null },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": ticketDetail({ staff: true }),
    });
    await page.goto("/dashboard/admin/support");

    // The queue flags the ticket as nobody's before it is even opened.
    await expect(page.getByText("Unassigned", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Owner", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText("Unassigned", { exact: true }),
    ).toBeVisible();

    // Staff reach the linked record on the staff screen, not the member's.
    await expect(dialog.getByRole("link", { name: /Open/ })).toHaveAttribute(
      "href",
      "/dashboard/admin/payments",
    );

    await dialog.getByRole("button", { name: "Assign to me" }).click();

    await expect
      .poll(() => assignCalls(page))
      .toEqual([
        { ref: "tickets.assign", args: { ticketId: TICKET_ID, assigneeId: ADMIN_SESSION._id } },
      ]);
    await expect(page.getByText("Ticket assigned to you.")).toBeVisible();

    // The stub replays the write, so the strip and the queue row behind it
    // both name the new owner without a reload.
    await expect(
      dialog.getByText(ADMIN_SESSION.name, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Release" }),
    ).toBeVisible();
    await expect(
      page
        .locator("tbody tr")
        .nth(0)
        .getByText(`Owner: ${ADMIN_SESSION.name}`, { exact: true }),
    ).toBeVisible();
  });

  test("shows who holds the ticket and takes it over from them", async ({
    page,
  }) => {
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: [
          {
            ...TICKET,
            customerName: CUSTOMER_SESSION.name,
            assigneeName: OTHER_STAFF.name,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      // A ticket somebody else is on: staff can take it over, not release it.
      "tickets.get": ticketDetail({
        staff: true,
        assignedTo: OTHER_STAFF._id,
        assignee: OTHER_STAFF,
      }),
    });
    await page.goto("/dashboard/admin/support");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Sam Osei", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Take over" }).click();

    await expect
      .poll(() => assignCalls(page))
      .toEqual([
        { ref: "tickets.assign", args: { ticketId: TICKET_ID, assigneeId: ADMIN_SESSION._id } },
      ]);
    await expect(page.getByText("Ticket assigned to you.")).toBeVisible();

    // Taking over replaces the previous agent, rather than adding a second.
    await expect(
      dialog.getByText(ADMIN_SESSION.name, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Sam Osei", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("tbody tr")
        .nth(0)
        .getByText(`Owner: ${ADMIN_SESSION.name}`, { exact: true }),
    ).toBeVisible();
  });

  test("releases a ticket the viewer owns back to the queue", async ({
    page,
  }) => {
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: [
          {
            ...TICKET,
            customerName: CUSTOMER_SESSION.name,
            assigneeName: ADMIN_SESSION.name,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": ticketDetail({
        staff: true,
        assignedTo: ADMIN_SESSION._id,
        assignee: { _id: ADMIN_SESSION._id, name: ADMIN_SESSION.name },
      }),
    });
    await page.goto("/dashboard/admin/support");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText(ADMIN_SESSION.name, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Release" }).click();

    // Releasing omits the assignee, which is how the mutation says "nobody".
    await expect.poll(() => assignCalls(page)).toEqual([
      { ref: "tickets.assign", args: { ticketId: TICKET_ID } },
    ]);
    await expect(page.getByText("Ticket returned to the queue.")).toBeVisible();

    // Released: the strip goes back to looking unclaimed, in both places.
    await expect(
      dialog.getByText("Unassigned", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Assign to me" }),
    ).toBeVisible();
    await expect(
      page
        .locator("tbody tr")
        .nth(0)
        .getByText("Unassigned", { exact: true }),
    ).toBeVisible();
  });

  test("shows the member's reply in the thread as soon as it is sent", async ({
    page,
  }) => {
    const reply =
      "Thank you - the second charge was refunded this morning, please confirm.";
    await signIn(page, CUSTOMER_SESSION, {
      "tickets.mine": [TICKET],
      "tickets.get": ticketDetail({ staff: false }),
    });
    await page.goto("/dashboard/support");
    await page.getByRole("button", { name: "Open thread" }).click();
    const dialog = page.getByRole("dialog");

    // One message from the member to start with.
    await expect(dialog.getByText("You", { exact: true })).toHaveCount(1);

    // The list card behind the dialog carries the same "updated" stamp.
    const card = page.getByText(/· payment · updated/);
    const cardBefore = await card.textContent();

    const box = dialog.getByPlaceholder("Write a reply…");
    await box.fill(reply);
    await dialog.getByRole("button", { name: "Reply", exact: true }).click();

    await expect.poll(() => calls(page, "tickets.reply")).toEqual([
      { ref: "tickets.reply", args: { ticketId: TICKET_ID, body: reply, internal: false } },
    ]);
    await expect(page.getByText("Reply sent.")).toBeVisible();

    // The stub replays the write: the reply is in the thread, at the end,
    // without a reload - and the box is empty, ready for the next one.
    await expect(dialog.getByText(reply)).toBeVisible();
    await expect(dialog.getByText("You", { exact: true })).toHaveCount(2);
    await expect(box).toHaveValue("");

    // The card's stamp moved with the reply instead of going stale.
    await expect(card).not.toHaveText(cardBefore ?? "");
  });

  test("keeps a staff internal note in the thread and off the member's view", async ({
    page,
  }) => {
    const note = "Refund confirmed by finance - closing after this reply.";
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: [
          { ...TICKET, customerName: CUSTOMER_SESSION.name, assigneeName: null },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": ticketDetail({ staff: true }),
    });
    await page.goto("/dashboard/admin/support");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("checkbox", { name: /Internal note/ }).check();
    await dialog.getByPlaceholder("Write a reply…").fill(note);
    await dialog.getByRole("button", { name: "Reply", exact: true }).click();

    await expect
      .poll(() => calls(page, "tickets.reply"))
      .toEqual([
        { ref: "tickets.reply", args: { ticketId: TICKET_ID, body: note, internal: true } },
      ]);

    // The flag survives the write, so the note is styled as internal, and the
    // ticket is now waiting on the customer.
    await expect(dialog.getByText(note)).toBeVisible();
    await expect(dialog.getByText("Internal note", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: /Awaiting customer/ }),
    ).toBeVisible();
  });

  /**
   * A refused write. The stub raises the message the fixture names, and skips
   * the replay: a screen must not look as though it succeeded.
   */
  test("keeps the member's text when a reply is refused", async ({ page }) => {
    const refusal =
      "This ticket is closed. Open a new ticket if you need more help.";
    const reply = "Any update on the second charge?";
    await signIn(page, CUSTOMER_SESSION, {
      "tickets.mine": [TICKET],
      "tickets.get": ticketDetail({ staff: false }),
      "tickets.reply": { failWith: refusal },
    });
    await page.goto("/dashboard/support");
    await page.getByRole("button", { name: "Open thread" }).click();
    const dialog = page.getByRole("dialog");

    const box = dialog.getByPlaceholder("Write a reply…");
    await box.fill(reply);
    await dialog.getByRole("button", { name: "Reply", exact: true }).click();

    await expect(page.getByText(refusal)).toBeVisible();
    // Nothing was appended - still the one message from the member - and the
    // text stays put, so retrying costs nothing.
    await expect(dialog.getByText("You", { exact: true })).toHaveCount(1);
    await expect(box).toHaveValue(reply);
  });

  test("leaves the owner alone when a claim is refused", async ({ page }) => {
    const refusal = "That staff account cannot take tickets.";
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: [
          { ...TICKET, customerName: CUSTOMER_SESSION.name, assigneeName: null },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": ticketDetail({ staff: true }),
      "tickets.assign": { failWith: refusal },
    });
    await page.goto("/dashboard/admin/support");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByRole("button", { name: "Assign to me" }).click();

    await expect(page.getByText(refusal)).toBeVisible();
    // The strip and the queue row are untouched: the write never happened.
    await expect(
      dialog.getByText("Unassigned", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Assign to me" }),
    ).toBeVisible();
    await expect(
      page
        .locator("tbody tr")
        .nth(0)
        .getByText("Unassigned", { exact: true }),
    ).toBeVisible();

    // The attempt is still recorded, so a spec can tell "never tried" from
    // "tried and refused".
    await expect.poll(() => assignCalls(page)).toEqual([
      { ref: "tickets.assign", args: { ticketId: TICKET_ID, assigneeId: ADMIN_SESSION._id } },
    ]);
  });
});
