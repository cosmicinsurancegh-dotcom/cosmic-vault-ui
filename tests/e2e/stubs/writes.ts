/**
 * The mutations the Convex double replays against its own fixtures.
 *
 * The double records a mutation and answers it; without this, a screen that
 * writes and then reads the same record back keeps showing the version it was
 * given at load, so a spec could only assert the request, never the result.
 * The support thread needs it three times: its owner strip displays the field
 * `tickets.assign` changes, its message list displays what `tickets.reply`
 * appends, and its heading pill displays what `tickets.setStatus` sets.
 *
 * `writes.ts` deliberately models only what a spec observes. A reference with
 * no entry here stays a pure recording, exactly as before, and the authoritative
 * write path - permission checks, staff-only assignees, queue scoping - is
 * covered by tests/security.test.ts rather than re-implemented here. The one
 * check it does repeat is record existence: a write naming a ticket no screen
 * holds throws "Ticket not found." the way the real mutation does, so a stray id
 * cannot pass for a success.
 */
import { getFixtures, getSession, setFixtures } from "./session";

type AssignArgs = { ticketId: string; assigneeId?: string };
type ReplyArgs = { ticketId: string; body: string; internal?: boolean };
type StatusArgs = { ticketId: string; status: string };

/** A row as `tickets.staffList` returns it, narrowed to what a write touches. */
type StaffRow = {
  _id: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  assigneeName?: string | null;
  updatedAt?: number;
};

/** One message as `tickets.get` returns it. */
type TicketMessage = {
  _id: string;
  ticketId: string;
  authorId: string;
  authorRole: string;
  body: string;
  internal: boolean;
  createdAt: number;
};

/** The `tickets.get` result, narrowed to what a write touches. */
type TicketDetail = {
  ticket: {
    _id: string;
    priority?: string;
    assignedTo?: string;
    status?: string;
    updatedAt?: number;
  };
  assignee: { _id: string; name?: string; email?: string } | null;
  messages?: TicketMessage[];
};

/** `tickets.queueSummary`, narrowed to the counts an assignment moves. */
type QueueSummary = { unassigned: number; highPriority?: number };

/**
 * Claims a ticket for a staff member, or returns it to the queue when the
 * assignee is omitted - the same two outcomes the real mutation has.
 */
function assignTicket({ ticketId, assigneeId }: AssignArgs) {
  const session = getSession();
  const fixtures = getFixtures();
  if (!fixtures || !session) return;

  const detail = fixtures["tickets.get"] as Partial<TicketDetail> | undefined;
  const detailTicket =
    detail?.ticket?._id === ticketId ? detail.ticket : undefined;
  const list = fixtures["tickets.staffList"] as
    | { rows?: StaffRow[] }
    | undefined;
  const rows = list?.rows ?? [];
  const row = rows.find((candidate) => candidate._id === ticketId);
  /* Neither screen holds this ticket. The real mutation rejects an id it
     cannot find, so a spec that sends a stray one gets the same refusal
     instead of a write that quietly succeeds against nothing. */
  if (!detailTicket && !row) throw new Error("Ticket not found.");

  const previousOwner = detailTicket?.assignedTo ?? row?.assignedTo;
  const priority = detailTicket?.priority ?? row?.priority;

  /* Who the ticket now belongs to. The viewer is the only person a screen ever
     assigns to, so their session supplies the name; anybody else falls back to
     the name the queue already had, or to "Staff" as `staffList` does. */
  const owner = !assigneeId
    ? null
    : assigneeId === session._id
      ? { _id: session._id, name: session.name, email: session.email }
      : previousOwner === assigneeId && row?.assigneeName
        ? { _id: assigneeId, name: row.assigneeName }
        : { _id: assigneeId, name: "Staff" };

  const next = { ...fixtures };

  if (detailTicket) {
    next["tickets.get"] = {
      ...detail,
      ticket: { ...detailTicket, assignedTo: assigneeId },
      assignee: owner,
    };
  }

  if (row) {
    next["tickets.staffList"] = {
      ...list,
      rows: rows.map((candidate) =>
        candidate._id === ticketId
          ? {
              ...candidate,
              assignedTo: assigneeId,
              assigneeName: owner?.name ?? null,
            }
          : candidate,
      ),
    };
  }

  /* The dashboard counts what the queue shows, so the same write has to move
     the alert - otherwise claiming a ticket leaves it overcounting. The age
     fields stay as the spec set them: they come from the clock, not the row. */
  const summary = fixtures["tickets.queueSummary"] as
    | Partial<QueueSummary>
    | undefined;
  if (summary && typeof summary.unassigned === "number") {
    const wasUnowned = !previousOwner;
    const isUnowned = !assigneeId;
    if (wasUnowned !== isUnowned) {
      const step = isUnowned ? 1 : -1;
      next["tickets.queueSummary"] = {
        ...summary,
        unassigned: Math.max(0, summary.unassigned + step),
        highPriority: Math.max(
          0,
          (summary.highPriority ?? 0) + (priority === "high" ? step : 0),
        ),
      };
    }
  }

  setFixtures(next);
}

/** The `_id` a listed row carries, if it has one. */
function ticketIdOf(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const id = (row as { _id?: unknown })._id;
  return typeof id === "string" ? id : undefined;
}

/**
 * Appends a reply to the thread and moves the ticket the way the real mutation
 * does: staff answers leave it waiting on the customer, anything else reopens
 * it, and `updatedAt` follows both.
 *
 * `tickets.get` is not the only place the ticket is shown - the member's list
 * card and the staff queue's row both carry the same status and timestamp - so
 * the write follows it there too, and only for that one row in each list.
 */
function replyToTicket({ ticketId, body, internal }: ReplyArgs) {
  const session = getSession();
  const fixtures = getFixtures();
  if (!fixtures || !session) return;

  const detail = fixtures["tickets.get"] as Partial<TicketDetail> | undefined;
  const detailTicket =
    detail?.ticket?._id === ticketId ? detail.ticket : undefined;
  // Nothing has this thread open, so there is no list to append to.
  if (!detail || !detailTicket) return;

  const messages = detail.messages ?? [];
  const staff = session.role === "admin" || session.role === "super_admin";
  const status = staff ? "awaiting_customer" : "open";
  const now = Date.now();

  const next: Record<string, unknown> = {
    ...fixtures,
    "tickets.get": {
      ...detail,
      ticket: { ...detailTicket, status, updatedAt: now },
      messages: [
        ...messages,
        {
          _id: `e2e-reply-${messages.length + 1}`,
          ticketId,
          authorId: session._id,
          authorRole: session.role,
          body,
          // Only staff can write an internal note; the real mutation ignores
          // the flag from anybody else rather than refusing the reply.
          internal: staff && internal === true,
          createdAt: now,
        },
      ],
    },
  };

  const mine = fixtures["tickets.mine"];
  if (Array.isArray(mine) && mine.some((row) => ticketIdOf(row) === ticketId)) {
    next["tickets.mine"] = mine.map((row) =>
      ticketIdOf(row) === ticketId ? { ...row, status, updatedAt: now } : row,
    );
  }

  /* The queue reads the same two fields from its own query, in its own columns
     - Status and Updated - so a reply that skipped this row would leave the
     agent looking at a ticket the thread says has already moved. */
  const list = fixtures["tickets.staffList"] as
    | { rows?: StaffRow[] }
    | undefined;
  const rows = list?.rows ?? [];
  if (list && rows.some((row) => row._id === ticketId)) {
    next["tickets.staffList"] = {
      ...list,
      rows: rows.map((row) =>
        row._id === ticketId ? { ...row, status, updatedAt: now } : row,
      ),
    };
  }

  setFixtures(next);
}

/**
 * Moves a ticket to another status. Three screens draw that field from three
 * different queries - the thread's heading pill from `tickets.get`, the queue's
 * row from `tickets.staffList`, and the member's card from `tickets.mine` - so
 * all three are patched, and `updatedAt` follows as the real mutation sets it.
 * The member's list is the one no staff screen reads: skipping it would leave
 * the customer looking at a status the agent has already moved on from.
 */
function changeTicketStatus({ ticketId, status }: StatusArgs) {
  const fixtures = getFixtures();
  if (!fixtures) return;

  const detail = fixtures["tickets.get"] as Partial<TicketDetail> | undefined;
  const detailTicket =
    detail?.ticket?._id === ticketId ? detail.ticket : undefined;
  const list = fixtures["tickets.staffList"] as
    | { rows?: StaffRow[] }
    | undefined;
  const rows = list?.rows ?? [];
  const row = rows.find((candidate) => candidate._id === ticketId);
  const mine = fixtures["tickets.mine"];
  const mineRows = Array.isArray(mine) ? mine : [];
  // No screen holds this ticket, so the status write has nothing to move - and
  // the real mutation refuses an id it cannot find rather than reporting
  // success, which is what a spec sending a stray id should see.
  if (!detailTicket && !row && !mineRows.some((r) => ticketIdOf(r) === ticketId))
    throw new Error("Ticket not found.");

  const now = Date.now();
  const next: Record<string, unknown> = { ...fixtures };

  if (detailTicket) {
    next["tickets.get"] = {
      ...detail,
      ticket: { ...detailTicket, status, updatedAt: now },
    };
  }

  if (row && list) {
    next["tickets.staffList"] = {
      ...list,
      rows: rows.map((candidate) =>
        candidate._id === ticketId
          ? { ...candidate, status, updatedAt: now }
          : candidate,
      ),
    };
  }

  if (Array.isArray(mine) && mineRows.some((r) => ticketIdOf(r) === ticketId)) {
    next["tickets.mine"] = mineRows.map((candidate) =>
      ticketIdOf(candidate) === ticketId
        ? { ...candidate, status, updatedAt: now }
        : candidate,
    );
  }

  setFixtures(next);
}

const WRITES: Record<string, (args: unknown) => void> = {
  "tickets.assign": (args) => assignTicket(args as AssignArgs),
  "tickets.reply": (args) => replyToTicket(args as ReplyArgs),
  "tickets.setStatus": (args) => changeTicketStatus(args as StatusArgs),
};

/** Applies a mutation's effect to the fixtures, if this stub models it. */
export function applyMutation(ref: string, args: unknown): void {
  WRITES[ref]?.(args);
}
