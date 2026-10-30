import { describe, expect, it, vi } from "vitest";
import type { E2ESession } from "./e2e/stubs/session";

/**
 * The Convex double's write-through layer, called directly.
 *
 * Every screen sends the `_id` it just rendered, so an end-to-end spec cannot
 * produce a stray one: a dialog without a record shows its loading state and
 * sends nothing. Reaching the guard therefore means calling the stub the way
 * the double does, which is what these cases do.
 *
 * The stub keeps its fixture store in module state and reads it from
 * `window.__E2E_FIXTURES__` on first use, so each case installs a window and
 * loads a fresh copy of the module.
 */
const SESSION: E2ESession = {
  _id: "e2e-admin",
  name: "Noor Vault",
  email: "noor@example.com",
  role: "super_admin",
  permissions: ["customers.view"],
};

async function loadStub(fixtures: Record<string, unknown>) {
  Object.assign(globalThis, {
    window: { __E2E_SESSION__: SESSION, __E2E_FIXTURES__: fixtures },
  });
  vi.resetModules();
  const writes = await import("./e2e/stubs/writes");
  const session = await import("./e2e/stubs/session");
  return { applyMutation: writes.applyMutation, getFixtures: session.getFixtures };
}

describe("stub ticket writes", () => {
  it("refuses a status change for a ticket no screen holds", async () => {
    const { applyMutation } = await loadStub({
      "tickets.staffList": { rows: [] },
      "tickets.mine": [],
      "tickets.get": null,
    });

    expect(() =>
      applyMutation("tickets.setStatus", {
        ticketId: "e2e-missing",
        status: "resolved",
      }),
    ).toThrow("Ticket not found.");
  });

  it("refuses an assignment for a ticket no screen holds", async () => {
    const { applyMutation } = await loadStub({
      "tickets.get": { ticket: { _id: "e2e-other" }, assignee: null, messages: [] },
    });

    expect(() =>
      applyMutation("tickets.assign", {
        ticketId: "e2e-missing",
        assigneeId: SESSION._id,
      }),
    ).toThrow("Ticket not found.");
  });

  it("still replays both writes for a ticket the screens hold", async () => {
    const { applyMutation, getFixtures } = await loadStub({
      "tickets.get": {
        ticket: { _id: "e2e-ticket", status: "open" },
        assignee: null,
        messages: [],
      },
      "tickets.mine": [{ _id: "e2e-ticket", status: "open", updatedAt: 1 }],
    });

    expect(() =>
      applyMutation("tickets.setStatus", {
        ticketId: "e2e-ticket",
        status: "closed",
      }),
    ).not.toThrow();
    expect(() =>
      applyMutation("tickets.assign", {
        ticketId: "e2e-ticket",
        assigneeId: SESSION._id,
      }),
    ).not.toThrow();

    const after = getFixtures() as {
      "tickets.get": { ticket: { status?: string; assignedTo?: string } };
      "tickets.mine": { status?: string }[];
    };
    expect(after["tickets.mine"]).toMatchObject([{ status: "closed" }]);
    expect(after["tickets.get"].ticket).toMatchObject({
      status: "closed",
      assignedTo: SESSION._id,
    });
  });

  it("leaves a reference it does not model as a pure recording", async () => {
    const { applyMutation } = await loadStub({});

    // The guard belongs to the top-level record the write looks up, not to the
    // recording itself: an unmodelled reference is still logged and answered.
    expect(() =>
      applyMutation("tickets.archive", { ticketId: "e2e-missing" }),
    ).not.toThrow();
  });
});
