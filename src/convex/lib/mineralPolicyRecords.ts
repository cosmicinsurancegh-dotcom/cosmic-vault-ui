import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "./authz";
import { normalizeRole } from "./authz";
import { displayName, ensureCustomerProfile, getCustomerProfile } from "./people";
import { reference } from "./refs";
import type { MineralCoverage } from "../schema";

/**
 * The member-facing records behind a mineral's cover.
 *
 * The vault records a mineral, the cover against it and the assignments that
 * move it; the member reads the same cover through the standard records every
 * other part of the platform uses - an approved application, an active policy,
 * its schedule and certificate, and the premium invoice. Without those rows a
 * member holding an insured mineral sees "No policies yet" on their dashboard
 * while `/dashboard/vault` shows the cover in full, and claims and payments
 * cannot see it at all.
 *
 * The cover (`mineralPolicies`) stays the source of truth: this module is the
 * only place that writes the mirror, and every mutation that touches a cover -
 * issuing it, moving it to another account, detaching it or deleting the
 * record - goes through `syncMemberPolicy` so the two can never disagree.
 */

/**
 * A product row is required: `policies.productId` (and `claims.productId`) point
 * at a product version, so a policy cannot exist without one. This anchor is
 * not sold from the catalogue - it carries no countries, no questions and no
 * rating factors - and the figures that matter are snapshotted onto each policy
 * from the cover itself.
 */
export const MINERAL_COVER_PRODUCT_CODE = "MIN-CUSTODY-01";
export const MINERAL_COVER_CATEGORY_KEY = "mineral";

export const COVERAGE_LABELS: Record<MineralCoverage, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

const MEMBER_STATUS: Record<
  Doc<"mineralPolicies">["status"],
  Doc<"policies">["status"]
> = {
  draft: "draft",
  active: "active",
  expired: "expired",
  cancelled: "cancelled",
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function quantity(amount: number, unit: string) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(amount)} ${unit}`;
}

function isoDate(at: number) {
  return new Date(at).toISOString().slice(0, 10);
}

/** Find-or-create the anchor product the member-facing policy points at. */
export async function ensureMineralCoverProduct(
  ctx: MutationCtx,
): Promise<Doc<"products">> {
  const existing = await ctx.db
    .query("products")
    .withIndex("by_code", (q) => q.eq("code", MINERAL_COVER_PRODUCT_CODE))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("products", {
    code: MINERAL_COVER_PRODUCT_CODE,
    name: "Vault mineral custody cover",
    categoryKey: MINERAL_COVER_CATEGORY_KEY,
    description:
      "The cover the vault desk records against a mineral held in custody. Issued with the assignment rather than sold from the catalogue; the provider, number, limit, premium and term are on each policy schedule.",
    targetCustomer: "Members holding minerals in the vault.",
    // No markets and no questions: this is a referential anchor, so it never
    // appears in the catalogue (which filters by country) or a quotation.
    countries: [],
    currency: "GBP",
    basePremium: 0,
    termMonths: 12,
    excess: 0,
    coverageLimit: 0,
    exclusions: [],
    benefits: [],
    ratingFactors: [],
    questions: [],
    requiredDocuments: [],
    wordingVersion: "1.0",
    wording:
      "Cover is recorded by the vault desk against the mineral named in the schedule, on the provider's terms. The schedule states the provider, the cover type, the limit, the premium and the term that apply; nothing outside those terms is insured. Claims are assessed by an authorised handler and paid only after a recorded decision and settlement.",
    disclosures:
      "This product record exists so a policy can be issued against it. It is not offered for sale and cannot be quoted for.",
    // Never sold, so never published: archiving keeps it out of the catalogue
    // and out of the "is the catalogue ready" check on a fresh deployment.
    status: "archived",
    version: 1,
    effectiveFrom: now,
    renewalNoticeDays: 30,
    cancellationNoticeDays: 14,
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

/**
 * The documents an issued policy carries. Deliberately short: the desk records
 * a provider, a number, a limit, a premium and a term, so the schedule states
 * exactly that rather than inventing wording the provider never issued.
 */
export function buildMineralPolicyDocuments(args: {
  mineral: Doc<"minerals">;
  cover: Doc<"mineralPolicies">;
  customerName: string;
  country: string;
}): { name: string; body: string }[] {
  const { mineral, cover, customerName } = args;
  const coverage = COVERAGE_LABELS[cover.coverage];

  const schedule = [
    `POLICY SCHEDULE - ${cover.policyNumber}`,
    "",
    `Insured mineral: ${mineral.name} (${mineral.reference})`,
    `Category: ${mineral.category}`,
    `Quantity: ${quantity(mineral.quantity, mineral.unit)}`,
    `Declared value: ${money(mineral.declaredValue, mineral.currency)}`,
    "",
    `Policyholder: ${customerName}`,
    `Jurisdiction: ${args.country}`,
    `Provider: ${cover.provider}`,
    `Cover: ${coverage}`,
    `Cover limit: ${money(cover.coverageLimit, cover.currency)}`,
    `Premium: ${money(cover.premium, cover.currency)}`,
    `Term: ${isoDate(cover.startDate)} to ${isoDate(cover.endDate)}`,
    cover.notes ? ["", `Notes: ${cover.notes}`].join("\n") : "",
    "",
    "The cover recorded here is the cover the vault desk holds on file. It is read with the provider's own terms.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const certificate = [
    `CERTIFICATE OF INSURANCE - ${cover.policyNumber}`,
    "",
    `This certifies that ${customerName} holds ${coverage.toLowerCase()} cover with ${cover.provider} for ${mineral.name} (${mineral.reference}) from ${isoDate(cover.startDate)} to ${isoDate(cover.endDate)}.`,
    `Policy number: ${cover.policyNumber}`,
    `Cover limit: ${money(cover.coverageLimit, cover.currency)}`,
    `Declared value: ${money(mineral.declaredValue, mineral.currency)}`,
    "",
    "Cover is subject to the provider's terms and the schedule issued with it.",
  ].join("\n");

  return [
    { name: `${cover.policyNumber} - policy schedule`, body: schedule },
    { name: `${cover.policyNumber} - certificate`, body: certificate },
  ];
}

type OwnerContext = {
  ownerUserId: Id<"users">;
  customerName: string;
  country: string;
};

/**
 * The policyholder details for an account that can own cover. A broker may hold
 * a mineral directly, and brokers have no customer profile, so their account
 * name is used instead of creating one.
 */
async function ownerContext(
  ctx: MutationCtx,
  ownerUserId: Id<"users">,
): Promise<OwnerContext> {
  const owner = await ctx.db.get(ownerUserId);
  if (!owner) {
    throw new Error("The account this mineral belongs to no longer exists.");
  }
  const profile =
    normalizeRole(owner.role) === "broker"
      ? await getCustomerProfile(ctx, ownerUserId)
      : await ensureCustomerProfile(ctx, ownerUserId);
  return {
    ownerUserId,
    customerName: profile?.fullName ?? displayName(owner),
    country: profile?.country ?? "GB",
  };
}

/**
 * Writes the application, policy, documents and premium invoice for a cover
 * that has never been mirrored. `policies.create` follows the same shape for a
 * policy issued by hand: the application records how cover was sold, and the
 * premium is raised as a receivable so finance sees it whether or not it has
 * been paid yet.
 */
async function insertMemberRecords(
  ctx: MutationCtx,
  args: {
    viewer: Viewer;
    mineral: Doc<"minerals">;
    cover: Doc<"mineralPolicies">;
    owner: OwnerContext;
    now: number;
    /** False when repairing history, which reconstructs paperwork only. */
    raiseInvoice?: boolean;
  },
) {
  const { viewer, mineral, cover, owner, now } = args;
  const product = await ensureMineralCoverProduct(ctx);
  const coverLabel = COVERAGE_LABELS[cover.coverage];

  const applicationId = await ctx.db.insert("applications", {
    reference: reference("APP"),
    customerUserId: owner.ownerUserId,
    productId: product._id,
    productCode: product.code,
    productVersion: product.version,
    productName: product.name,
    categoryKey: MINERAL_COVER_CATEGORY_KEY,
    country: owner.country,
    currency: cover.currency,
    premium: cover.premium,
    answers: {
      source: "mineral_issue",
      mineral: mineral.name,
      mineralReference: mineral.reference,
      provider: cover.provider,
      cover: coverLabel,
    },
    status: "approved",
    submittedAt: now,
    assignedTo: viewer.user._id,
    decision: "approved",
    decisionReason:
      "Recorded by the vault desk with the mineral assignment; no application was filed.",
    decidedBy: viewer.user._id,
    decidedAt: now,
    termsAcceptedAt: now,
    documents: [],
    createdAt: now,
    updatedAt: now,
  });

  const policyId = await ctx.db.insert("policies", {
    // The provider's own number: it is what the value email quotes, and the
    // number the member will quote back to the desk.
    policyNumber: cover.policyNumber,
    customerUserId: owner.ownerUserId,
    applicationId,
    productId: product._id,
    productCode: product.code,
    productVersion: product.version,
    productName: product.name,
    categoryKey: MINERAL_COVER_CATEGORY_KEY,
    status: MEMBER_STATUS[cover.status],
    insuredName: owner.customerName,
    country: owner.country,
    currency: cover.currency,
    premium: cover.premium,
    excess: product.excess,
    coverageLimit: cover.coverageLimit,
    exclusions: [],
    benefits: [
      `${mineral.name} (${mineral.reference}) held in custody`,
      `Cover type: ${coverLabel}`,
      `Declared value: ${money(mineral.declaredValue, mineral.currency)}`,
      `Provider: ${cover.provider}`,
    ],
    wordingVersion: product.wordingVersion,
    startDate: cover.startDate,
    endDate: cover.endDate,
    renewalDate: cover.endDate,
    issuedBy: viewer.user._id,
    issuedAt: now,
    endorsements: [],
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(applicationId, { policyId, updatedAt: now });
  await ctx.db.patch(cover._id, { policyId, updatedAt: now });

  for (const document of buildMineralPolicyDocuments({
    mineral,
    cover,
    customerName: owner.customerName,
    country: owner.country,
  })) {
    await ctx.db.insert("documents", {
      ownerUserId: owner.ownerUserId,
      name: document.name,
      category: "policy",
      policyId,
      body: document.body,
      contentType: "text/plain",
      version: product.version,
      issuedBy: viewer.user._id,
      issuedAt: now,
      createdAt: now,
    });
  }

  /* No premium, no receivable: a zero-premium cover truthfully shows nothing
     due rather than a payment instruction for nothing. An expired or cancelled
     cover raises nothing either - it is history, and billing that premium now
     would post an invoice whose due date is years in the past. */
  let invoiceId: Id<"transactions"> | null = null;
  if (
    cover.premium > 0 &&
    cover.status === "active" &&
    args.raiseInvoice !== false
  ) {
    invoiceId = await ctx.db.insert("transactions", {
      reference: reference("INV"),
      customerUserId: owner.ownerUserId,
      policyId,
      applicationId,
      type: "premium",
      amount: cover.premium,
      currency: cover.currency,
      status: "pending",
      method: "bank_transfer",
      providerVerified: false,
      idempotencyKey: `mineral-issue:${policyId}`,
      note: `Premium for ${cover.policyNumber}, vault cover for ${mineral.name}`,
      reconciled: false,
      dueDate: cover.startDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  await ctx.db.insert("applicationEvents", {
    applicationId,
    actorId: viewer.user._id,
    actorRole: viewer.role,
    kind: "decision",
    message: `Policy ${cover.policyNumber} recorded with ${mineral.name} (${mineral.reference}) by the vault desk.`,
    toStatus: "approved",
    internal: false,
    createdAt: now,
  });

  return { applicationId, policyId, invoiceId };
}

/** Moves every member-facing record of a cover to a different account. */
async function moveMemberRecords(
  ctx: MutationCtx,
  args: {
    policyId: Id<"policies">;
    applicationId: Id<"applications">;
    from: Id<"users">;
    to: Id<"users">;
    owner: OwnerContext;
    now: number;
  },
) {
  const { policyId, applicationId, from, to, owner, now } = args;

  await ctx.db.patch(policyId, {
    customerUserId: to,
    insuredName: owner.customerName,
    country: owner.country,
    updatedAt: now,
  });
  await ctx.db.patch(applicationId, {
    customerUserId: to,
    country: owner.country,
    updatedAt: now,
  });

  const documents = await ctx.db
    .query("documents")
    .withIndex("by_policy", (q) => q.eq("policyId", policyId))
    .collect();
  for (const document of documents) {
    if (document.ownerUserId !== to) {
      await ctx.db.patch(document._id, { ownerUserId: to });
    }
  }

  /* An invoice the finance team has already settled belongs to the account
     that paid it; only the outstanding one follows the mineral. */
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_policy", (q) => q.eq("policyId", policyId))
    .collect();
  for (const transaction of transactions) {
    if (transaction.customerUserId !== to && transaction.status === "pending") {
      await ctx.db.patch(transaction._id, {
        customerUserId: to,
        updatedAt: now,
      });
    }
  }

  return {
    documents: documents.length,
    previousOwner: from,
  };
}

/**
 * Brings the member-facing records in line with a cover: issuing them the first
 * time, then keeping status, premium, limit, dates and owner in step. `status`
 * is normally taken straight from the cover; `suspended` is only used when the
 * mineral leaves the account, because cover for a holding the member no longer
 * has must not read as active or support a claim.
 */
export async function syncMemberPolicy(
  ctx: MutationCtx,
  args: {
    viewer: Viewer;
    mineral: Doc<"minerals">;
    cover: Doc<"mineralPolicies">;
    ownerUserId: Id<"users">;
    now: number;
    overrideStatus?: "suspended";
    reason?: string;
    /** False when repairing history, which reconstructs paperwork only. */
    raiseInvoice?: boolean;
  },
): Promise<{
  policyId: Id<"policies">;
  applicationId: Id<"applications">;
  created: boolean;
  movedFrom: Id<"users"> | null;
}> {
  const { viewer, mineral, cover, ownerUserId, now } = args;
  const owner = await ownerContext(ctx, ownerUserId);
  const status = args.overrideStatus ?? MEMBER_STATUS[cover.status];

  const existingPolicy = cover.policyId
    ? await ctx.db.get(cover.policyId)
    : null;
  const existingApplication = existingPolicy
    ? await ctx.db.get(existingPolicy.applicationId)
    : null;

  // A cover with no mirror, or one whose records were removed underneath it,
  // is issued afresh rather than patched.
  if (!existingPolicy || !existingApplication) {
    const created = await insertMemberRecords(ctx, {
      viewer,
      mineral,
      cover,
      owner,
      now,
      raiseInvoice: args.raiseInvoice,
    });
    if (args.overrideStatus === "suspended") {
      await ctx.db.patch(created.policyId, {
        status: "suspended",
        suspendedAt: now,
        suspensionReason:
          args.reason ?? "The mineral is no longer assigned to this account.",
        updatedAt: now,
      });
    }
    return {
      policyId: created.policyId,
      applicationId: created.applicationId,
      created: true,
      movedFrom: null,
    };
  }

  const movedFrom =
    existingPolicy.customerUserId !== ownerUserId
      ? existingPolicy.customerUserId
      : null;
  if (movedFrom) {
    await moveMemberRecords(ctx, {
      policyId: existingPolicy._id,
      applicationId: existingApplication._id,
      from: movedFrom,
      to: ownerUserId,
      owner,
      now,
    });
  }

  await ctx.db.patch(existingPolicy._id, {
    status,
    premium: cover.premium,
    coverageLimit: cover.coverageLimit,
    currency: cover.currency,
    startDate: cover.startDate,
    endDate: cover.endDate,
    renewalDate: cover.endDate,
    ...(status === "suspended"
      ? {
          suspendedAt: now,
          suspensionReason:
            args.reason ?? "The mineral is no longer assigned to this account.",
        }
      : { suspendedAt: undefined, suspensionReason: undefined }),
    updatedAt: now,
  });

  // A raised premium is reflected on the outstanding invoice; a settled one is
  // an accounting record and is left exactly as finance confirmed it.
  const outstanding = await ctx.db
    .query("transactions")
    .withIndex("by_policy", (q) => q.eq("policyId", existingPolicy._id))
    .collect();
  const pendingInvoice = outstanding.find(
    (transaction) =>
      transaction.type === "premium" && transaction.status === "pending",
  );
  if (pendingInvoice && pendingInvoice.amount !== cover.premium) {
    await ctx.db.patch(pendingInvoice._id, {
      amount: cover.premium,
      currency: cover.currency,
      updatedAt: now,
    });
  } else if (
    !pendingInvoice &&
    cover.premium > 0 &&
    cover.status === "active" &&
    args.raiseInvoice !== false &&
    outstanding.length === 0
  ) {
    await ctx.db.insert("transactions", {
      reference: reference("INV"),
      customerUserId: ownerUserId,
      policyId: existingPolicy._id,
      applicationId: existingApplication._id,
      type: "premium",
      amount: cover.premium,
      currency: cover.currency,
      status: "pending",
      method: "bank_transfer",
      providerVerified: false,
      idempotencyKey: `mineral-issue:${existingPolicy._id}`,
      note: `Premium for ${cover.policyNumber}, vault cover for ${mineral.name}`,
      reconciled: false,
      dueDate: cover.startDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    policyId: existingPolicy._id,
    applicationId: existingApplication._id,
    created: false,
    movedFrom,
  };
}

/**
 * Deletes a cover's member-facing records. Only used when the mineral record
 * itself is being removed as one that should never have existed - the audit
 * entry written by the caller is what survives, so the counts returned here go
 * into it.
 */
export async function removeMemberPolicyRecords(
  ctx: MutationCtx,
  args: { policyId: Id<"policies">; applicationId: Id<"applications"> },
) {
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
    .collect();
  const transactions = await ctx.db
    .query("transactions")
    .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
    .collect();
  const applicationEvents = await ctx.db
    .query("applicationEvents")
    .withIndex("by_application", (q) =>
      q.eq("applicationId", args.applicationId),
    )
    .collect();

  for (const document of documents) await ctx.db.delete(document._id);
  for (const transaction of transactions) await ctx.db.delete(transaction._id);
  for (const event of applicationEvents) await ctx.db.delete(event._id);
  await ctx.db.delete(args.applicationId);
  await ctx.db.delete(args.policyId);

  return {
    documents: documents.length,
    transactions: transactions.length,
    applicationEvents: applicationEvents.length,
  };
}
