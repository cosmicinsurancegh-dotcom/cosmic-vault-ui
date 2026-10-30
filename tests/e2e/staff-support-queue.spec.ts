import type { Page } from "@playwright/test";
import { expect, STAFF_BOARD, test } from "./support/fixtures";
import { ADMIN_SESSION, CUSTOMER_SESSION } from "./stubs/session";
import type { E2ESession } from "./stubs/session";

/**
 * Staff support coverage: who owns each ticket in the queue, and the dashboard
 * warning callout that turns "nobody has picked this up" into something an
 * agent sees without opening the queue.
 *
 * The queue's owner column and the alert read the same field from opposite
 * directions - `staffList` returns `assigneeName` per row, `queueSummary`
 * returns counts - so a ticket that loses its owner has to show up in both.
 * The assignment rules and the summary arithmetic are covered by
 * tests/security.test.ts; this spec checks what the screens draw from them.
 */
const DAY = 24 * 60 * 60 * 1000;
const UPDATED_AT = Date.UTC(2026, 9, 28);
const AGENT = "Sam Osei";

/** One row as `tickets.staffList` returns it: the ticket plus its names. */
function queueRow({
  id,
  reference,
  subject,
  category,
  priority,
  assigneeName,
}: {
  id: string;
  reference: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high";
  assigneeName: string | null;
}) {
  return {
    _id: id,
    reference,
    userId: CUSTOMER_SESSION._id,
    category,
    subject,
    status: "open",
    priority,
    createdAt: UPDATED_AT - 2 * DAY,
    updatedAt: UPDATED_AT,
    customerName: CUSTOMER_SESSION.name,
    assigneeName,
  };
}

const QUEUE_ROWS = [
  queueRow({
    id: "e2e-queue-ticket-owned",
    reference: "SUP-7H3QZ",
    subject: "Claim decision questions",
    category: "claim",
    priority: "high",
    assigneeName: AGENT,
  }),
  queueRow({
    id: "e2e-queue-ticket-unowned",
    reference: "SUP-2MB7X",
    subject: "Statement does not match my payments",
    category: "payment",
    priority: "normal",
    assigneeName: null,
  }),
];

async function signIn(
  page: Page,
  session: E2ESession,
  fixtures: Record<string, unknown>,
) {
  await page.addInitScript(
    ({ session, canned }) => {
      window.__E2E_SESSION__ = session;
      window.__E2E_FIXTURES__ = canned;
      window.__E2E_QUERY_CALLS__ = [];
    },
    { session, canned: fixtures },
  );
}

/** Every status change the dialog has sent, in order. */
async function statusCalls(page: Page) {
  const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
  return mutations.filter((call) => call.ref === "tickets.setStatus");
}

/** Every claim the dialog has sent, in order. */
async function assignCalls(page: Page) {
  const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
  return mutations.filter((call) => call.ref === "tickets.assign");
}

/** Every reply the dialog has sent, in order. */
async function replyCalls(page: Page) {
  const mutations = await page.evaluate(() => window.__E2E_MUTATIONS__ ?? []);
  return mutations.filter((call) => call.ref === "tickets.reply");
}

test.describe("staff support queue", () => {
  test("names the owner of each ticket, and flags the ones without one", async ({
    page,
  }) => {
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
    });
    await page.goto("/dashboard/admin/support");

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);

    // A taken ticket names the agent, not the customer who raised it.
    await expect(
      rows.nth(0).getByText(`Owner: ${AGENT}`, { exact: true }),
    ).toBeVisible();
    await expect(rows.nth(0).getByText("SUP-7H3QZ")).toBeVisible();
    await expect(rows.nth(0).getByText(CUSTOMER_SESSION.name)).toBeVisible();

    // An unclaimed one says so where the owner would be.
    await expect(
      rows.nth(1).getByText("Unassigned", { exact: true }),
    ).toBeVisible();
    await expect(rows.nth(1).getByText("SUP-2MB7X")).toBeVisible();
    await expect(
      rows.nth(1).getByText(`Owner: ${AGENT}`, { exact: true }),
    ).toHaveCount(0);

    // Both rows stay actionable, whatever their owner.
    await expect(
      rows.nth(1).getByRole("button", { name: "Open", exact: true }),
    ).toBeVisible();
  });

  /**
   * A claim has to reach three places at once: the thread's owner strip, the
   * queue row behind it, and the dashboard's unassigned count - which is a
   * different query with no direct link to the mutation.
   */
  test("claiming a ticket moves the owner and the dashboard count", async ({
    page,
  }) => {
    const claimed = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": {
        ticket: claimed,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
      "tickets.queueSummary": {
        unassigned: 3,
        highPriority: 1,
        oldestUnassignedAt: Date.UTC(2026, 9, 24),
        oldestUnassignedDays: 4,
      },
      "reports.board": STAFF_BOARD,
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Assign to me" }).click();

    // Thread and queue row both name the new owner, with no reload between.
    await expect(
      dialog.getByRole("button", { name: "Release" }),
    ).toBeVisible();
    await expect(
      row.getByText(`Owner: ${ADMIN_SESSION.name}`, { exact: true }),
    ).toBeVisible();

    // The dashboard is a separate screen reading a separate query.
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Overview" }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");

    const alert = page
      .getByText("2 support tickets are waiting without an owner")
      .locator("..");
    await expect(alert).toBeVisible();
    // This ticket was normal priority, so the urgent count holds at one.
    await expect(alert).toContainText("1 of them is high priority.");
    await expect(alert).toContainText("The oldest has waited 4 days.");
  });

  /**
   * The status control is the one write that ends the conversation: once a
   * ticket is closed the dialog stops offering a reply at all. Resolving first
   * keeps the composer, so the same control has to do two different things - and
   * both are drawn from `tickets.get` in the heading and `tickets.staffList` in
   * the row behind it.
   */
  test("moves a ticket to resolved, then closed, from the thread", async ({
    page,
  }) => {
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    // The Status column, which is a pill beside the row's own "Open" button.
    const statusCell = row.locator("td").nth(5);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const control = dialog.getByLabel("Ticket status");

    // Both surfaces start on the status the fixture gave them.
    await expect(dialog.getByRole("heading", { name: /Open/ })).toBeVisible();
    await expect(statusCell).toHaveText("Open");

    await control.selectOption("resolved");

    await expect.poll(() => statusCalls(page)).toEqual([
      {
        ref: "tickets.setStatus",
        args: { ticketId: target._id, status: "resolved" },
      },
    ]);
    await expect(page.getByText("Ticket status updated.")).toBeVisible();

    // The write reached the heading pill and the queue row, not just the select.
    await expect(
      dialog.getByRole("heading", { name: /Resolved/ }),
    ).toBeVisible();
    await expect(control).toHaveValue("resolved");
    await expect(statusCell).toHaveText("Resolved");

    // Resolved is still workable: the reply box and the control are both there.
    await expect(
      dialog.getByPlaceholder("Write a reply…"),
    ).toBeVisible();

    await control.selectOption("closed");

    await expect.poll(() => statusCalls(page)).toEqual([
      {
        ref: "tickets.setStatus",
        args: { ticketId: target._id, status: "resolved" },
      },
      {
        ref: "tickets.setStatus",
        args: { ticketId: target._id, status: "closed" },
      },
    ]);
    await expect(dialog.getByRole("heading", { name: /Closed/ })).toBeVisible();
    await expect(statusCell).toHaveText("Closed");

    // Closing takes the composer away, so nothing offers a reply to a closed
    // ticket - including the control that just did it.
    await expect(dialog.getByPlaceholder("Write a reply…")).toHaveCount(0);
    await expect(dialog.getByLabel("Ticket status")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Reply", exact: true }),
    ).toHaveCount(0);
  });

  /**
   * The member's card is the third surface for the same field, and the only one
   * fed by `tickets.mine` - a query no staff screen reads. Both statuses an
   * agent sets have to reach it, in order, or the customer keeps seeing the old
   * pill - and nothing else on that screen refreshes between the two writes, so
   * the second one is checked against a card that already carries the first.
   * The stamp beside the pill has to move too: a card that says "resolved" but
   * still carries last week's date reads as stale rather than updated.
   */
  test("moves the member's card through resolved, then closed", async ({
    page,
  }) => {
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.mine": [target],
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
    });
    /* Starting on the member's own list, so the card's stamp can be read before
       any write. The fixture's timestamp is two days old, so "after" is not the
       same string however quickly the test runs. */
    await page.goto("/dashboard/support");

    /** The member's card, addressed by the subject it is headed with. */
    const card = () =>
      page.getByText(target.subject, { exact: true }).locator("..");
    /** The card's meta line, which carries the "updated" stamp. */
    const meta = () => page.getByText(/SUP-2MB7X · payment · updated/);
    const metaBefore = await meta().textContent();

    // The admin rail's own support link goes to the queue, not to this list.
    await page.getByRole("link", { name: "Support", exact: true }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/admin/support");

    /** The queue row's own button - the status cell reads the same words. */
    const openTicket = () =>
      page
        .locator("tbody tr")
        .nth(1)
        .getByRole("button", { name: "Open", exact: true })
        .click();

    await openTicket();
    await page
      .getByRole("dialog")
      .getByLabel("Ticket status")
      .selectOption("resolved");
    await expect(page.getByText("Ticket status updated.")).toBeVisible();

    /* The member's list is a client-side route away, so the stub's store - not
       just the screen - has to carry the write. Clicking through instead of
       reloading is also what a member's open tab would do. */
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Open support" }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/support");

    // The card's own pill, from the query the queue never read - and its stamp
    // moved off the fixture's date to the moment of the write.
    await expect(card().getByText("Resolved", { exact: true })).toBeVisible();
    await expect(card().getByText("Open", { exact: true })).toHaveCount(0);
    await expect(meta()).not.toHaveText(metaBefore ?? "");

    // Back to the queue in the same window, so the second write lands in the
    // store this card is reading from.
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/admin/support");

    await openTicket();
    const dialog = page.getByRole("dialog");
    // The control opens on the status the first write left behind.
    await expect(dialog.getByLabel("Ticket status")).toHaveValue("resolved");
    await dialog.getByLabel("Ticket status").selectOption("closed");
    await expect.poll(() => statusCalls(page)).toHaveLength(2);
    await expect(dialog.getByRole("heading", { name: /Closed/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Open support" }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/support");

    // The same card now shows the second status, and no trace of the first.
    await expect(card().getByText("Closed", { exact: true })).toBeVisible();
    await expect(card().getByText("Resolved", { exact: true })).toHaveCount(0);
  });

  /**
   * A refused status change. The stub raises the message the fixture names and
   * skips the replay, so none of the three surfaces may move - and the control
   * has to fall back to the status the ticket still has rather than keeping the
   * one the agent tried.
   */
  test("leaves the ticket alone when a status change is refused", async ({
    page,
  }) => {
    const refusal = "You cannot close a ticket while it is waiting on finance.";
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.mine": [target],
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
      "tickets.setStatus": { failWith: refusal },
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    const statusCell = row.locator("td").nth(5);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const control = dialog.getByLabel("Ticket status");

    await control.selectOption("resolved");

    await expect(page.getByText(refusal)).toBeVisible();
    // The attempt is on the record, so "refused" is never mistaken for "never
    // tried" - and the payload is the one that was refused.
    await expect.poll(() => statusCalls(page)).toEqual([
      {
        ref: "tickets.setStatus",
        args: { ticketId: target._id, status: "resolved" },
      },
    ]);

    // Nothing moved: the control is back on the status the ticket still has,
    // and the thread's pill and the queue row agree with it.
    await expect(control).toHaveValue("open");
    await expect(dialog.getByRole("heading", { name: /Open/ })).toBeVisible();
    await expect(statusCell).toHaveText("Open");

    // The member's card, from the query no staff screen reads, is untouched.
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Open support" }).first().click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/dashboard/support");
    const card = page.getByText(target.subject, { exact: true }).locator("..");
    await expect(card.getByText("Open", { exact: true })).toBeVisible();
    await expect(card.getByText("Resolved", { exact: true })).toHaveCount(0);
  });

  /**
   * A refused claim. The write touches the owner strip, the queue row and the
   * dashboard's unassigned count, so a refusal has to leave all three where they
   * were - a count that dropped on a failed claim would hide a ticket nobody
   * owns.
   */
  test("leaves the owner and the dashboard count alone when a claim is refused", async ({
    page,
  }) => {
    const refusal = "That staff account cannot take tickets.";
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
      "tickets.queueSummary": {
        unassigned: 3,
        highPriority: 1,
        oldestUnassignedAt: Date.UTC(2026, 9, 24),
        oldestUnassignedDays: 4,
      },
      "reports.board": STAFF_BOARD,
      "tickets.assign": { failWith: refusal },
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Assign to me" }).click();

    await expect(page.getByText(refusal)).toBeVisible();
    await expect.poll(() => assignCalls(page)).toEqual([
      {
        ref: "tickets.assign",
        args: { ticketId: target._id, assigneeId: ADMIN_SESSION._id },
      },
    ]);

    // Still unclaimed, in the strip and in the row behind it.
    await expect(dialog.getByText("Unassigned", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Assign to me" }),
    ).toBeVisible();
    await expect(
      row.getByText("Unassigned", { exact: true }),
    ).toBeVisible();

    // And the alert still counts it as waiting: nothing was taken off the pile.
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Overview" }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    const alert = page
      .getByText("3 support tickets are waiting without an owner")
      .locator("..");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("1 of them is high priority.");
  });

  /**
   * A refused staff reply. A successful answer hands the ticket back to the
   * customer, so a failed one must not: no message may be appended, the text
   * stays in the box, and both the thread's pill and the queue row keep saying
   * the ticket is still open.
   */
  test("keeps a staff reply in the box and the ticket open when it is refused", async ({
    page,
  }) => {
    const refusal =
      "This ticket is closed. Open a new ticket if you need more help.";
    const draft = "Refund confirmed - closing this out today.";
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [
          {
            _id: "e2e-queue-message-1",
            ticketId: target._id,
            authorId: CUSTOMER_SESSION._id,
            authorRole: "customer",
            body: "My statement does not match the payments I made.",
            internal: false,
            createdAt: UPDATED_AT - DAY,
          },
        ],
        isStaff: true,
        related: null,
      },
      "tickets.reply": { failWith: refusal },
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    const statusCell = row.locator("td").nth(5);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const box = dialog.getByPlaceholder("Write a reply…");

    // One message from the member to start with.
    await expect(dialog.getByText("You", { exact: true })).toHaveCount(1);

    await box.fill(draft);
    await dialog.getByRole("button", { name: "Reply", exact: true }).click();

    await expect(page.getByText(refusal)).toBeVisible();
    await expect.poll(() => replyCalls(page)).toEqual([
      {
        ref: "tickets.reply",
        args: { ticketId: target._id, body: draft, internal: false },
      },
    ]);

    // Nothing was appended, and the text is still there to send again.
    await expect(dialog.getByText("You", { exact: true })).toHaveCount(1);
    await expect(dialog.getByText("Support", { exact: true })).toHaveCount(0);
    await expect(box).toHaveValue(draft);

    // A failed answer does not hand the ticket to the customer.
    await expect(dialog.getByRole("heading", { name: /Open/ })).toBeVisible();
    await expect(statusCell).toHaveText("Open");
  });

  /**
   * A reply is activity on the ticket, so the queue's own columns have to move
   * with it: the status the staff answer leaves behind, and the timestamp an
   * agent sorts by. Both live in `tickets.staffList`, a different query from the
   * thread the reply was written into.
   */
  test("a staff reply moves the queue row's status and updated column", async ({
    page,
  }) => {
    const target = QUEUE_ROWS[1];
    await signIn(page, ADMIN_SESSION, {
      "tickets.staffList": {
        rows: QUEUE_ROWS,
        total: QUEUE_ROWS.length,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      "tickets.get": {
        ticket: target,
        user: {
          _id: CUSTOMER_SESSION._id,
          name: CUSTOMER_SESSION.name,
          email: CUSTOMER_SESSION.email,
        },
        assignee: null,
        messages: [],
        isStaff: true,
        related: null,
      },
    });
    await page.goto("/dashboard/admin/support");

    const row = page.locator("tbody tr").nth(1);
    const statusCell = row.locator("td").nth(5);
    const updatedCell = row.locator("td").nth(4);
    await expect(statusCell).toHaveText("Open");
    const updatedBefore = await updatedCell.textContent();

    await row.getByRole("button", { name: "Open", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByPlaceholder("Write a reply…")
      .fill("The second charge was refunded this morning - please confirm.");
    await dialog.getByRole("button", { name: "Reply", exact: true }).click();

    // A staff answer hands the ticket back to the customer, in both views.
    await expect(
      dialog.getByRole("heading", { name: /Awaiting customer/ }),
    ).toBeVisible();
    await expect(statusCell).toHaveText("Awaiting customer");
    await expect(updatedCell).not.toHaveText(updatedBefore ?? "");
  });
});

test.describe("dashboard support alert", () => {
  /** The callout is addressed by its own title, then scoped to its container. */
  async function openAlert(
    page: Page,
    session: E2ESession,
    summary: Record<string, unknown>,
  ) {
    await signIn(page, session, {
      "reports.board": STAFF_BOARD,
      "tickets.queueSummary": summary,
    });
    await page.goto("/dashboard");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
    return page;
  }

  test("counts the unassigned tickets and hands over the queue", async ({
    page,
  }) => {
    await openAlert(page, ADMIN_SESSION, {
      unassigned: 3,
      highPriority: 1,
      oldestUnassignedAt: Date.UTC(2026, 9, 24),
      oldestUnassignedDays: 4,
    });

    const alert = page
      .getByText("3 support tickets are waiting without an owner")
      .locator("..");
    await expect(alert).toBeVisible();

    // The two facts that decide what an agent picks up first: urgency and age.
    await expect(alert).toContainText("1 of them is high priority.");
    await expect(alert).toContainText("The oldest has waited 4 days.");
    await expect(alert).toContainText(
      "Take one from the queue so it is not missed.",
    );
    await expect(
      alert.getByRole("link", { name: /Open support queue/ }),
    ).toHaveAttribute("href", "/dashboard/admin/support");
  });

  test("speaks in the singular for one ticket that arrived today", async ({
    page,
  }) => {
    await openAlert(page, ADMIN_SESSION, {
      unassigned: 1,
      highPriority: 0,
      oldestUnassignedAt: Date.UTC(2026, 9, 30),
      oldestUnassignedDays: 0,
    });

    const alert = page
      .getByText("1 support ticket is waiting without an owner")
      .locator("..");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("The oldest arrived today.");

    // Nothing is urgent, so the priority sentence is left out entirely.
    await expect(alert).not.toContainText("high priority");
  });

  test("stays away when every ticket has an owner", async ({ page }) => {
    await openAlert(page, ADMIN_SESSION, {
      unassigned: 0,
      highPriority: 0,
      oldestUnassignedAt: null,
      oldestUnassignedDays: null,
    });

    await expect(page.getByText(/waiting without an owner/)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Open support queue/ }),
    ).toHaveCount(0);
  });

  /**
   * The queue needs `customers.view`; staff without it get no alert rather
   * than a rejected query, so the dashboard must not even ask.
   */
  test("is not requested by staff who cannot read the queue", async ({
    page,
  }) => {
    await openAlert(
      page,
      {
        _id: "e2e-claims-admin",
        name: "Claims Only",
        email: "claims@example.com",
        role: "admin",
        permissions: ["claims.review"],
      },
      {
        unassigned: 5,
        highPriority: 2,
        oldestUnassignedAt: Date.UTC(2026, 9, 25),
        oldestUnassignedDays: 5,
      },
    );

    await expect(page.getByText(/waiting without an owner/)).toHaveCount(0);
    const calls = await page.evaluate(() => window.__E2E_QUERY_CALLS__ ?? []);
    expect(calls).not.toContain("tickets.queueSummary");
  });
});
