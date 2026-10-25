import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  PERMISSIONS,
  requirePermission,
  requireViewer,
  type Viewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import {
  inviteUser,
  normalizeInviteEmail,
  normalizeInviteName,
} from "./lib/invite";
import { notifyUser } from "./lib/notify";
import { ensureCustomerProfile, displayName } from "./lib/people";
import {
  cleanText,
  isValidEmail,
  money,
  parseDateInput,
  reference,
  requiredText,
} from "./lib/refs";
import {
  renderAssignmentEmail,
  renderShipmentStatusEmail,
} from "./lib/shipmentEmail";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "./lib/shipments";
import { getSettings } from "./lib/settings";
import {
  mineralCoverageValidator,
  mineralPolicyStatusValidator,
  shipmentStatusValidator,
} from "./schema";

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

function formatMoney(minorUnits: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return `${currency} ${(minorUnits / 100).toFixed(2)}`;
  }
}

function formatQuantity(quantity: number, unit: string) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Canonical origin for links in emails. */
function appUrl() {
  return (process.env.SITE_URL ?? "https://cosmicvault.co").replace(/\/+$/, "");
}

async function assertCurrency(
  ctx: MutationCtx,
  currency: string,
): Promise<void> {
  const settings = await getSettings(ctx);
  const record = await ctx.db
    .query("currencies")
    .withIndex("by_code", (q) => q.eq("code", currency))
    .unique();
  if (
    !record ||
    !record.active ||
    !settings.allowedCurrencies.includes(currency)
  ) {
    throw new Error("Choose a supported currency.");
  }
}

async function latestPolicy(
  ctx: QueryCtx | MutationCtx,
  mineralId: Id<"minerals">,
) {
  const policies = await ctx.db
    .query("mineralPolicies")
    .withIndex("by_mineral", (q) => q.eq("mineralId", mineralId))
    .order("desc")
    .take(5);
  return policies.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function toEmailMineral(mineral: Doc<"minerals">) {
  return {
    name: mineral.name,
    reference: mineral.reference,
    category: mineral.category,
    quantity: formatQuantity(mineral.quantity, mineral.unit),
    declaredValue: formatMoney(mineral.declaredValue, mineral.currency),
  };
}

function toEmailPolicy(policy: Doc<"mineralPolicies">) {
  return {
    policyNumber: policy.policyNumber,
    provider: policy.provider,
    coverage: COVERAGE_LABELS[policy.coverage] ?? policy.coverage,
    coverageLimit: formatMoney(policy.coverageLimit, policy.currency),
    endDate: formatDate(policy.endDate),
  };
}

function toEmailShipment(shipment: Doc<"shipments">) {
  return {
    reference: shipment.reference,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    origin: shipment.origin,
    destination: shipment.destination,
    departure: shipment.departureAt
      ? formatDate(shipment.departureAt)
      : undefined,
    eta: shipment.estimatedArrivalAt
      ? formatDate(shipment.estimatedArrivalAt)
      : undefined,
  };
}

/** Resolve the account a mineral is being assigned to, creating one on demand. */
async function resolveAssignee(
  ctx: MutationCtx,
  viewer: Viewer,
  assignment: {
    mode: "existing" | "new";
    userId?: Id<"users">;
    newUser?: { name: string; email: string };
  },
): Promise<{ userId: Id<"users">; isNewAccount: boolean }> {
  if (assignment.mode === "existing") {
    if (!assignment.userId) throw new Error("Choose an account to assign.");
    const user = await ctx.db.get(assignment.userId);
    if (!user) throw new Error("That account no longer exists.");
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("Choose a customer or broker account.");
    }
    return { userId: user._id, isNewAccount: false };
  }

  const name = normalizeInviteName(assignment.newUser?.name);
  const email = normalizeInviteEmail(assignment.newUser?.email);
  if (!isValidEmail(email))
    throw new Error("Please add a valid email address.");

  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .first();
  if (existing) {
    if (existing.role === "admin" || existing.role === "super_admin") {
      throw new Error("That email belongs to a staff account.");
    }
    if (existing.role === "broker") {
      throw new Error(
        "That email belongs to a broker account. Assign it by choosing the existing account.",
      );
    }
    return { userId: existing._id, isNewAccount: false };
  }

  // The invited row carries the verified marker, so the first emailed-code
  // sign-in links to it instead of creating a duplicate identity.
  const userId = await inviteUser(ctx, { name, email, role: "customer" });
  await ensureCustomerProfile(ctx, userId);
  await writeAudit(ctx, viewer, {
    action: "customer.invited",
    entityType: "customers",
    entityId: userId,
    after: { name, email, role: "customer" },
    reason: "Invited while assigning a mineral.",
  });
  return { userId, isNewAccount: true };
}

export const create = mutation({
  args: {
    mineral: v.object({
      name: v.string(),
      category: v.string(),
      description: v.optional(v.string()),
      quantity: v.number(),
      unit: v.string(),
      declaredValue: v.number(),
      currency: v.string(),
    }),
    policy: v.object({
      policyNumber: v.string(),
      provider: v.string(),
      coverage: mineralCoverageValidator,
      coverageLimit: v.number(),
      premium: v.number(),
      startDate: v.string(),
      endDate: v.string(),
      status: mineralPolicyStatusValidator,
      notes: v.optional(v.string()),
    }),
    shipment: v.object({
      carrier: v.string(),
      trackingNumber: v.optional(v.string()),
      origin: v.string(),
      destination: v.string(),
      departureAt: v.optional(v.string()),
      estimatedArrivalAt: v.optional(v.string()),
      status: shipmentStatusValidator,
      currentLocation: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
    assignment: v.object({
      mode: v.union(v.literal("existing"), v.literal("new")),
      userId: v.optional(v.id("users")),
      newUser: v.optional(v.object({ name: v.string(), email: v.string() })),
    }),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);

    const name = requiredText(args.mineral.name, "Mineral name", 120);
    const category = requiredText(args.mineral.category, "Category", 80);
    const unit = requiredText(args.mineral.unit, "Unit", 16);
    if (!Number.isFinite(args.mineral.quantity) || args.mineral.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }
    const declaredValue = money(args.mineral.declaredValue, "Declared value");
    await assertCurrency(ctx, args.mineral.currency);

    const policyNumber = requiredText(
      args.policy.policyNumber,
      "Policy number",
      60,
    );
    const provider = requiredText(args.policy.provider, "Policy provider", 120);
    const coverageLimit = money(args.policy.coverageLimit, "Cover limit");
    const premium = money(args.policy.premium, "Premium");
    if (coverageLimit <= 0)
      throw new Error("Cover limit must be greater than zero.");
    const startDate = parseDateInput(args.policy.startDate, "Cover start date");
    const endDate = parseDateInput(args.policy.endDate, "Cover end date");
    if (endDate <= startDate) {
      throw new Error("Cover end date must be after the start date.");
    }
    const duplicatePolicy = await ctx.db
      .query("mineralPolicies")
      .withIndex("by_number", (q) => q.eq("policyNumber", policyNumber))
      .first();
    if (duplicatePolicy) {
      throw new Error("A policy with that number already exists.");
    }

    const carrier = requiredText(args.shipment.carrier, "Carrier", 120);
    const origin = requiredText(args.shipment.origin, "Origin", 120);
    const destination = requiredText(
      args.shipment.destination,
      "Destination",
      120,
    );
    const departureAt = args.shipment.departureAt
      ? parseDateInput(args.shipment.departureAt, "Departure date")
      : undefined;
    const estimatedArrivalAt = args.shipment.estimatedArrivalAt
      ? parseDateInput(args.shipment.estimatedArrivalAt, "Estimated arrival")
      : undefined;
    if (
      departureAt !== undefined &&
      estimatedArrivalAt !== undefined &&
      estimatedArrivalAt < departureAt
    ) {
      throw new Error("Estimated arrival must be after departure.");
    }

    const { userId, isNewAccount } = await resolveAssignee(
      ctx,
      viewer,
      args.assignment,
    );

    const now = Date.now();
    const mineralId = await ctx.db.insert("minerals", {
      reference: reference("MIN"),
      name,
      category,
      description:
        cleanText(args.mineral.description, "Description", 2000) || undefined,
      quantity: args.mineral.quantity,
      unit,
      declaredValue,
      currency: args.mineral.currency,
      status: "active",
      assignedUserId: userId,
      assignedAt: now,
      assignedBy: viewer.user._id,
      createdBy: viewer.user._id,
      createdAt: now,
      updatedAt: now,
    });

    const policyId = await ctx.db.insert("mineralPolicies", {
      mineralId,
      policyNumber,
      provider,
      coverage: args.policy.coverage,
      coverageLimit,
      premium,
      currency: args.mineral.currency,
      startDate,
      endDate,
      status: args.policy.status,
      notes: cleanText(args.policy.notes, "Policy notes", 2000) || undefined,
      createdBy: viewer.user._id,
      createdAt: now,
      updatedAt: now,
    });

    const shipmentId = await ctx.db.insert("shipments", {
      mineralId,
      reference: reference("SHP"),
      carrier,
      trackingNumber:
        cleanText(args.shipment.trackingNumber, "Tracking number", 80) ||
        undefined,
      origin,
      destination,
      departureAt,
      estimatedArrivalAt,
      status: args.shipment.status,
      currentLocation:
        cleanText(args.shipment.currentLocation, "Current location", 120) ||
        undefined,
      notes:
        cleanText(args.shipment.notes, "Shipment notes", 2000) || undefined,
      assignedUserId: userId,
      createdBy: viewer.user._id,
      lastStatusAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("shipmentEvents", {
      shipmentId,
      mineralId,
      status: args.shipment.status,
      location:
        cleanText(args.shipment.currentLocation, "Current location", 120) ||
        undefined,
      note: "Mineral recorded and shipment created.",
      actorId: viewer.user._id,
      actorRole: viewer.role,
      createdAt: now,
    });

    await writeAudit(ctx, viewer, {
      action: "mineral.created",
      entityType: "minerals",
      entityId: mineralId,
      after: {
        name,
        category,
        quantity: args.mineral.quantity,
        unit,
        declaredValue,
        currency: args.mineral.currency,
        policyNumber,
        shipmentStatus: args.shipment.status,
        assignedUserId: userId,
        newAccount: isNewAccount,
      },
    });

    const [mineral, policy, shipment] = await Promise.all([
      ctx.db.get(mineralId),
      ctx.db.get(policyId),
      ctx.db.get(shipmentId),
    ]);
    const assignedUser = await ctx.db.get(userId);
    const settings = await getSettings(ctx);

    if (mineral && assignedUser) {
      const email = renderAssignmentEmail({
        recipientName: (assignedUser.name ?? displayName(assignedUser)).split(
          " ",
        )[0],
        isNewAccount,
        companyName: settings.companyName,
        supportEmail: settings.supportEmail,
        appUrl: appUrl(),
        mineral: toEmailMineral(mineral),
        policy: policy ? toEmailPolicy(policy) : undefined,
        shipment: shipment ? toEmailShipment(shipment) : undefined,
      });
      await notifyUser(ctx, {
        userId,
        type: "mineral.assigned",
        title: `${name} has been added to your vault`,
        body: `${name} (${mineral.reference}) was assigned to you by ${settings.companyName}. Shipment ${shipment?.reference ?? ""} is ${SHIPMENT_STATUS_LABELS[args.shipment.status].toLowerCase()}.`,
        href: "/dashboard/minerals",
        relatedType: "minerals",
        relatedId: mineralId,
        dedupeKey: `mineral.assigned:${mineralId}:${userId}`,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    }

    return {
      mineralId,
      shipmentId,
      policyId,
      assignedUserId: userId,
      isNewAccount,
    };
  },
});

/**
 * Move a mineral that is already on record — together with every shipment
 * attached to it — to another customer or broker. Creation only binds an owner
 * once; this is the correction path for a record recorded against the wrong
 * account, and it keeps both member dashboards accurate.
 */
export const reassign = mutation({
  args: {
    mineralId: v.id("minerals"),
    assignment: v.object({
      mode: v.union(v.literal("existing"), v.literal("new")),
      userId: v.optional(v.id("users")),
      newUser: v.optional(v.object({ name: v.string(), email: v.string() })),
    }),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const mineral = await ctx.db.get(args.mineralId);
    if (!mineral) throw new Error("Mineral not found.");

    // Reuse the creation rules: staff can never own a mineral, an existing
    // email is reused, and an unknown email becomes an invited customer.
    const { userId, isNewAccount } = await resolveAssignee(
      ctx,
      viewer,
      args.assignment,
    );
    if (!isNewAccount && mineral.assignedUserId === userId) {
      throw new Error("This mineral is already assigned to that account.");
    }

    const previousUserId = mineral.assignedUserId;
    const previousUser = previousUserId
      ? await ctx.db.get(previousUserId)
      : null;
    const note = cleanText(args.note, "Note", 500) || undefined;
    const now = Date.now();

    await ctx.db.patch(mineral._id, {
      assignedUserId: userId,
      assignedAt: now,
      assignedBy: viewer.user._id,
      updatedAt: now,
    });

    // Shipments carry a denormalised owner so a member's consignments can be
    // read without walking every mineral. Ownership always follows the mineral.
    const shipments = await ctx.db
      .query("shipments")
      .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
      .take(100);
    for (const shipment of shipments) {
      await ctx.db.patch(shipment._id, {
        assignedUserId: userId,
        updatedBy: viewer.user._id,
        updatedAt: now,
      });
    }

    const assignedUser = await ctx.db.get(userId);
    await writeAudit(ctx, viewer, {
      action: "mineral.reassigned",
      entityType: "minerals",
      entityId: mineral._id,
      before: {
        assignedUserId: previousUserId ?? null,
        ownerName: previousUser ? displayName(previousUser) : null,
        ownerEmail: previousUser?.email ?? null,
      },
      after: {
        assignedUserId: userId,
        ownerName: assignedUser ? displayName(assignedUser) : null,
        ownerEmail: assignedUser?.email ?? null,
        shipments: shipments.map((shipment) => shipment._id),
        newAccount: isNewAccount,
      },
      reason: note,
    });

    const settings = await getSettings(ctx);
    const policy = await latestPolicy(ctx, mineral._id);
    const latestShipment =
      [...shipments].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    const updated: Doc<"minerals"> = {
      ...mineral,
      assignedUserId: userId,
      assignedAt: now,
      assignedBy: viewer.user._id,
      updatedAt: now,
    };

    if (assignedUser) {
      const email = renderAssignmentEmail({
        recipientName: (assignedUser.name ?? displayName(assignedUser)).split(
          " ",
        )[0],
        isNewAccount,
        companyName: settings.companyName,
        supportEmail: settings.supportEmail,
        appUrl: appUrl(),
        mineral: toEmailMineral(updated),
        policy: policy ? toEmailPolicy(policy) : undefined,
        shipment: latestShipment ? toEmailShipment(latestShipment) : undefined,
      });
      await notifyUser(ctx, {
        userId,
        type: "mineral.assigned",
        title: `${mineral.name} has been added to your vault`,
        body: `${mineral.name} (${mineral.reference}) was assigned to you by ${settings.companyName}.${latestShipment ? ` Shipment ${latestShipment.reference} is ${SHIPMENT_STATUS_LABELS[latestShipment.status].toLowerCase()}.` : ""}`,
        href: "/dashboard/minerals",
        relatedType: "minerals",
        relatedId: mineral._id,
        // The timestamp keeps a record that moves back to a previous owner
        // from being swallowed by the assignment notification already queued.
        dedupeKey: `mineral.reassigned:${mineral._id}:${userId}:${now}`,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    }

    if (previousUserId && previousUserId !== userId) {
      await notifyUser(ctx, {
        userId: previousUserId,
        type: "mineral.unassigned",
        title: `${mineral.name} has moved to another account`,
        body: `${mineral.name} (${mineral.reference}) is no longer assigned to you. Contact ${settings.supportEmail} if this is unexpected.`,
        href: "/dashboard/minerals",
        relatedType: "minerals",
        relatedId: mineral._id,
        dedupeKey: `mineral.unassigned:${mineral._id}:${previousUserId}:${now}`,
        // A record leaving a vault is an in-app notice, not an email.
        email: false,
      });
    }

    return {
      mineralId: mineral._id,
      assignedUserId: userId,
      previousUserId: previousUserId ?? null,
      shipmentIds: shipments.map((shipment) => shipment._id),
      isNewAccount,
      notified: Boolean(assignedUser?.email) && !assignedUser?.isAnonymous,
    };
  },
});

/**
 * Return a mineral to the unassigned pool. The record, its policy and every
 * shipment stay on file; only ownership is cleared, so the mineral becomes an
 * attach candidate again. The previous owner is told in their dashboard.
 */
export const detach = mutation({
  args: {
    mineralId: v.id("minerals"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const mineral = await ctx.db.get(args.mineralId);
    if (!mineral) throw new Error("Mineral not found.");

    const previousUserId = mineral.assignedUserId;
    if (!previousUserId) {
      throw new Error("This mineral is not assigned to anyone.");
    }
    const previousUser = await ctx.db.get(previousUserId);
    const note = cleanText(args.note, "Note", 500) || undefined;
    const now = Date.now();

    await ctx.db.patch(mineral._id, {
      assignedUserId: undefined,
      assignedAt: undefined,
      assignedBy: undefined,
      updatedAt: now,
    });

    const shipments = await ctx.db
      .query("shipments")
      .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
      .take(100);
    for (const shipment of shipments) {
      await ctx.db.patch(shipment._id, {
        assignedUserId: undefined,
        updatedBy: viewer.user._id,
        updatedAt: now,
      });
    }

    await writeAudit(ctx, viewer, {
      action: "mineral.detached",
      entityType: "minerals",
      entityId: mineral._id,
      before: {
        assignedUserId: previousUserId,
        ownerName: previousUser ? displayName(previousUser) : null,
        ownerEmail: previousUser?.email ?? null,
      },
      after: {
        assignedUserId: null,
        shipments: shipments.map((shipment) => shipment._id),
      },
      reason: note,
    });

    if (previousUser) {
      const settings = await getSettings(ctx);
      await notifyUser(ctx, {
        userId: previousUserId,
        type: "mineral.unassigned",
        title: `${mineral.name} has been removed from your vault`,
        body: `${mineral.name} (${mineral.reference}) is no longer assigned to you. Contact ${settings.supportEmail} if this is unexpected.`,
        href: "/dashboard/minerals",
        relatedType: "minerals",
        relatedId: mineral._id,
        dedupeKey: `mineral.detached:${mineral._id}:${previousUserId}:${now}`,
        // Removing a record from a vault is an in-app notice, not an email.
        email: false,
      });
    }

    return {
      mineralId: mineral._id,
      previousUserId,
      shipmentIds: shipments.map((shipment) => shipment._id),
    };
  },
});

/**
 * The publish dialog converts the date staff picked into a timestamp. The range
 * is guarded so a mistyped year cannot move a consignment out of living memory.
 */
function readEstimatedArrival(value: number | undefined) {
  if (value === undefined) return undefined;
  const at = Math.round(value);
  if (
    !Number.isFinite(at) ||
    at < Date.UTC(2000, 0, 1) ||
    at > Date.UTC(2100, 0, 1)
  ) {
    throw new Error("Enter a valid estimated delivery date.");
  }
  return at;
}

export const updateShipmentStatus = mutation({
  args: {
    shipmentId: v.id("shipments"),
    status: shipmentStatusValidator,
    location: v.optional(v.string()),
    note: v.optional(v.string()),
    /** A new delivery estimate; `null` clears it, omit it to leave it alone. */
    estimatedArrivalAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const viewer = await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const shipment = await ctx.db.get(args.shipmentId);
    if (!shipment) throw new Error("Shipment not found.");
    const mineral = await ctx.db.get(shipment.mineralId);
    if (!mineral)
      throw new Error("The mineral for this shipment no longer exists.");
    if (shipment.status === args.status) {
      throw new Error(
        `This shipment is already ${SHIPMENT_STATUS_LABELS[args.status].toLowerCase()}.`,
      );
    }

    const now = Date.now();
    const location =
      cleanText(args.location, "Location", 120) || shipment.currentLocation;
    const note = cleanText(args.note, "Note", 2000) || undefined;
    const clearingEstimate = args.estimatedArrivalAt === null;
    const requestedEta =
      typeof args.estimatedArrivalAt === "number"
        ? args.estimatedArrivalAt
        : undefined;
    const estimatedArrivalAt = clearingEstimate
      ? undefined
      : (readEstimatedArrival(requestedEta) ?? shipment.estimatedArrivalAt);
    if (
      estimatedArrivalAt !== undefined &&
      shipment.departureAt !== undefined &&
      estimatedArrivalAt < shipment.departureAt
    ) {
      throw new Error("Estimated arrival must be after departure.");
    }

    await ctx.db.patch(shipment._id, {
      status: args.status,
      currentLocation: location,
      updatedAt: now,
      lastStatusAt: now,
      updatedBy: viewer.user._id,
      /* Clearing writes `undefined`, which removes the field from the record. */
      ...(estimatedArrivalAt === undefined
        ? clearingEstimate
          ? { estimatedArrivalAt: undefined }
          : {}
        : { estimatedArrivalAt }),
    });

    const eventId = await ctx.db.insert("shipmentEvents", {
      shipmentId: shipment._id,
      mineralId: shipment.mineralId,
      status: args.status,
      fromStatus: shipment.status,
      location,
      note,
      actorId: viewer.user._id,
      actorRole: viewer.role,
      createdAt: now,
    });

    await writeAudit(ctx, viewer, {
      action: "shipment.status_changed",
      entityType: "shipments",
      entityId: shipment._id,
      before: {
        status: shipment.status,
        location: shipment.currentLocation,
        estimatedArrivalAt: shipment.estimatedArrivalAt,
      },
      after: {
        status: args.status,
        location,
        /* `null` records the removal, so it reads apart from an untouched date. */
        estimatedArrivalAt: clearingEstimate ? null : estimatedArrivalAt,
      },
      reason: note,
    });

    let notified = false;
    // The mineral is the source of truth for ownership; the shipment's copy is
    // kept in step by `reassign`, and covers records written before it existed.
    const ownerId = mineral.assignedUserId ?? shipment.assignedUserId;
    if (ownerId) {
      const user = await ctx.db.get(ownerId);
      if (user) {
        const settings = await getSettings(ctx);
        const policy = await latestPolicy(ctx, mineral._id);
        const updated: Doc<"shipments"> = {
          ...shipment,
          status: args.status,
          currentLocation: location,
          estimatedArrivalAt,
          updatedAt: now,
          lastStatusAt: now,
        };
        const email = renderShipmentStatusEmail({
          recipientName: (user.name ?? displayName(user)).split(" ")[0],
          updatedAt: formatDateTime(now),
          status: args.status,
          previousStatus: shipment.status as ShipmentStatus,
          location,
          note,
          companyName: settings.companyName,
          supportEmail: settings.supportEmail,
          appUrl: appUrl(),
          mineral: toEmailMineral(mineral),
          policy: policy ? toEmailPolicy(policy) : undefined,
          shipment: toEmailShipment(updated),
        });
        await notifyUser(ctx, {
          userId: user._id,
          type: "shipment.status_changed",
          title: `${mineral.name} is ${SHIPMENT_STATUS_LABELS[args.status].toLowerCase()}`,
          body: `${shipment.reference} · ${shipment.origin} → ${shipment.destination}.${note ? ` ${note}` : ""}`,
          href: "/dashboard/minerals",
          relatedType: "shipments",
          relatedId: shipment._id,
          dedupeKey: `shipment.status:${eventId}:${user._id}`,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        notified = Boolean(user.email) && !user.isAnonymous;
      }
    }

    return { eventId, notified };
  },
});

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const [minerals, policies, shipments, users] = await Promise.all([
      ctx.db.query("minerals").order("desc").take(300),
      ctx.db.query("mineralPolicies").take(600),
      ctx.db.query("shipments").take(600),
      ctx.db.query("users").take(500),
    ]);

    const userMap = new Map(users.map((user) => [user._id, user]));
    const search = args.search?.trim().toLowerCase();

    const rows = minerals
      .filter((mineral) => {
        if (!search) return true;
        const assignee = mineral.assignedUserId
          ? userMap.get(mineral.assignedUserId)
          : undefined;
        return (
          mineral.name.toLowerCase().includes(search) ||
          mineral.reference.toLowerCase().includes(search) ||
          mineral.category.toLowerCase().includes(search) ||
          (assignee?.name ?? "").toLowerCase().includes(search) ||
          (assignee?.email ?? "").toLowerCase().includes(search)
        );
      })
      .map((mineral) => {
        const policy =
          policies
            .filter((item) => item.mineralId === mineral._id)
            .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        const shipment =
          shipments
            .filter((item) => item.mineralId === mineral._id)
            .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        const assignee = mineral.assignedUserId
          ? userMap.get(mineral.assignedUserId)
          : undefined;
        return {
          mineral,
          policy,
          shipment,
          assignee: assignee
            ? {
                _id: assignee._id,
                name: displayName(assignee),
                email: assignee.email ?? "",
              }
            : null,
        };
      });

    return rows;
  },
});

export const detail = query({
  args: { mineralId: v.id("minerals") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const mineral = await ctx.db.get(args.mineralId);
    if (!mineral) return null;
    const [policies, shipments, assignee] = await Promise.all([
      ctx.db
        .query("mineralPolicies")
        .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
        .order("desc")
        .take(10),
      ctx.db
        .query("shipments")
        .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
        .order("desc")
        .take(10),
      mineral.assignedUserId ? ctx.db.get(mineral.assignedUserId) : null,
    ]);
    const shipment = shipments[0] ?? null;
    const events = shipment
      ? await ctx.db
          .query("shipmentEvents")
          .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
          .order("desc")
          .take(25)
      : [];
    return {
      mineral,
      policy: policies[0] ?? null,
      policies,
      shipment,
      events,
      assignee: assignee
        ? {
            _id: assignee._id,
            name: displayName(assignee),
            email: assignee.email ?? "",
          }
        : null,
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    if (viewer.role === "admin" || viewer.role === "super_admin") return [];

    const minerals = await ctx.db
      .query("minerals")
      .withIndex("by_assigned", (q) => q.eq("assignedUserId", viewer.user._id))
      .order("desc")
      .take(50);

    return await Promise.all(
      minerals.map(async (mineral) => {
        const [policies, shipments] = await Promise.all([
          ctx.db
            .query("mineralPolicies")
            .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
            .order("desc")
            .take(5),
          ctx.db
            .query("shipments")
            .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
            .order("desc")
            .take(5),
        ]);
        const shipment = shipments[0] ?? null;
        const events = shipment
          ? await ctx.db
              .query("shipmentEvents")
              .withIndex("by_shipment", (q) => q.eq("shipmentId", shipment._id))
              .order("desc")
              .take(20)
          : [];
        return {
          mineral,
          policy: policies[0] ?? null,
          shipment,
          events,
        };
      }),
    );
  },
});

/**
 * Minerals that no account owns yet, offered from a customer record so staff
 * can attach an existing holding to the customer in front of them. Convex does
 * not index missing optional fields, so this filters the register instead of
 * querying `by_assigned`.
 */
export const unassigned = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const minerals = await ctx.db.query("minerals").order("desc").take(300);
    const rows = minerals
      .filter((mineral) => !mineral.assignedUserId)
      .slice(0, 100);

    return await Promise.all(
      rows.map(async (mineral) => {
        const shipments = await ctx.db
          .query("shipments")
          .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
          .order("desc")
          .take(5);
        const shipment =
          shipments.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        return { mineral, shipment, shipments };
      }),
    );
  },
});

/**
 * Minerals owned by one account, for the staff customer record. Scoped by the
 * customer's `_id` rather than reusing `list`, so the detail view can show a
 * single customer's holdings without loading the whole register.
 */
export const forOwner = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const owner = await ctx.db.get(args.userId);
    if (!owner) throw new Error("That account no longer exists.");

    const minerals = await ctx.db
      .query("minerals")
      .withIndex("by_assigned", (q) => q.eq("assignedUserId", args.userId))
      .order("desc")
      .take(50);

    return await Promise.all(
      minerals.map(async (mineral) => {
        const [policies, shipments] = await Promise.all([
          ctx.db
            .query("mineralPolicies")
            .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
            .order("desc")
            .take(5),
          ctx.db
            .query("shipments")
            .withIndex("by_mineral", (q) => q.eq("mineralId", mineral._id))
            .order("desc")
            .take(5),
        ]);
        const policy =
          policies.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        const shipment =
          shipments.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        return { mineral, policy, shipment, shipments };
      }),
    );
  },
});

export const assigneeOptions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Scoped to the mineral console: staff who can bind cover may pick the
    // member an asset belongs to, without exposing the full customer directory.
    await requirePermission(ctx, PERMISSIONS.POLICIES_MANAGE);
    const [users, profiles] = await Promise.all([
      ctx.db.query("users").take(500),
      ctx.db.query("customerProfiles").take(500),
    ]);
    const profileMap = new Map(
      profiles.map((profile) => [profile.userId, profile]),
    );
    const search = args.search?.trim().toLowerCase();

    return users
      .filter((user) => user.role !== "admin" && user.role !== "super_admin")
      .filter((user) => {
        if (!search) return true;
        return (
          (user.name ?? "").toLowerCase().includes(search) ||
          (user.email ?? "").toLowerCase().includes(search)
        );
      })
      .slice(0, 200)
      .map((user) => ({
        userId: user._id,
        name: displayName(user),
        email: user.email ?? "",
        role: user.role ?? "customer",
        reference: profileMap.get(user._id)?.reference ?? "",
        status: user.status ?? "active",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
