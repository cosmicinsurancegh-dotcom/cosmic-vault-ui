import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Platform roles. "user" and "member" are kept for backwards compatibility
// with accounts created before role-based access control was introduced; both
// resolve to the customer role.
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  CUSTOMER: "customer",
  BROKER: "broker",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.SUPER_ADMIN),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.CUSTOMER),
  v.literal(ROLES.BROKER),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const accountStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
);

export const verificationValidator = v.union(
  v.literal("unverified"),
  v.literal("pending"),
  v.literal("verified"),
);

export const productStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);

export const applicationStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("additional_info_required"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("withdrawn"),
);

export const policyStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("active"),
  v.literal("renewal_pending"),
  v.literal("expired"),
  v.literal("cancelled"),
  v.literal("suspended"),
);

export const claimStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("additional_info_required"),
  v.literal("under_assessment"),
  v.literal("approved"),
  v.literal("partially_approved"),
  v.literal("declined"),
  v.literal("payment_pending"),
  v.literal("paid"),
  v.literal("closed"),
);

export const transactionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("disputed"),
);

export const transactionTypeValidator = v.union(
  v.literal("premium"),
  v.literal("refund"),
  v.literal("settlement"),
  v.literal("adjustment"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
);

export const notificationEmailStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("skipped"),
  v.literal("failed"),
);

export const ticketStatusValidator = v.union(
  v.literal("open"),
  v.literal("awaiting_customer"),
  v.literal("resolved"),
  v.literal("closed"),
);

// Legacy coverage + quote validators used by the landing-page lead form.
export const coverageValidator = v.union(
  v.literal("health"),
  v.literal("home"),
  v.literal("auto"),
  v.literal("life"),
);
export type CoverageType = Infer<typeof coverageValidator>;

export const quoteStatusValidator = v.union(
  v.literal("in_review"),
  v.literal("quoted"),
  v.literal("active"),
);
export type QuoteStatus = Infer<typeof quoteStatusValidator>;

/**
 * Additive provenance metadata for records created by the protected demo seed
 * workflow (`convex/demoSeed.ts`). These fields are never read by authorization
 * logic: they only let the seed and its cleanup (and only those) find exactly
 * the rows they own. `demoKey` is stable per record so re-running the seed is
 * idempotent instead of duplicating rows.
 */
const demoFields = {
  isDemo: v.optional(v.boolean()),
  seedBatch: v.optional(v.string()),
  seededAt: v.optional(v.number()),
  demoKey: v.optional(v.string()),
};

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      // Granular permissions for staff roles. Super admins implicitly hold all
      // permissions; admins fall back to a conservative default set.
      permissions: v.optional(v.array(v.string())),
      status: v.optional(accountStatusValidator),
      suspendedReason: v.optional(v.string()),
      lastRoleChangeAt: v.optional(v.number()),
      ...demoFields,
    })
      .index("email", ["email"]) // index for the email. do not remove or modify
      // Super admin lookups must not depend on scanning a prefix of the table:
      // `setup.status` / `setup.bootstrap` decide whether the founding claim is
      // still open, so they read this index instead of `users.take(n)`.
      .index("by_role", ["role"]),

    // Quote requests created from the landing page or the member vault.
    quotes: defineTable({
      userId: v.optional(v.id("users")),
      reference: v.string(),
      name: v.string(),
      email: v.string(),
      coverage: coverageValidator,
      plan: v.optional(v.string()),
      message: v.optional(v.string()),
      status: quoteStatusValidator,
      monthlyEstimate: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_email", ["email"]),

    /**
     * Fixed-window rate limit counters for public and abuse-prone operations.
     * Convex mutations are serialisable transactions, so the read-modify-write
     * in `lib/rateLimit` is enforced across every server instance. Rows are
     * pruned by the daily maintenance cron once their window is long past.
     */
    rateLimits: defineTable({
      key: v.string(), // `${scope}:${identifier}`
      windowStart: v.number(),
      count: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_windowStart", ["windowStart"]),

    /** Reference data ------------------------------------------------------ */
    countries: defineTable({
      code: v.string(),
      name: v.string(),
      currency: v.string(),
      region: v.string(),
      dialCode: v.optional(v.string()),
      active: v.boolean(),
    })
      .index("by_code", ["code"])
      .index("by_active", ["active"]),

    currencies: defineTable({
      code: v.string(),
      name: v.string(),
      symbol: v.string(),
      minorUnits: v.number(),
      active: v.boolean(),
    }).index("by_code", ["code"]),

    categories: defineTable({
      key: v.string(),
      name: v.string(),
      description: v.string(),
      sortOrder: v.number(),
      active: v.boolean(),
    }).index("by_key", ["key"]),

    settings: defineTable({
      key: v.string(),
      companyName: v.string(),
      supportEmail: v.string(),
      defaultCurrency: v.string(),
      commissionEnabled: v.boolean(),
      renewalNoticeDays: v.number(),
      claimSlaDays: v.number(),
      bankAccountName: v.optional(v.string()),
      bankIban: v.optional(v.string()),
      bankSortCode: v.optional(v.string()),
      bankSwift: v.optional(v.string()),
      allowedCurrencies: v.array(v.string()),
      emailTemplates: v.array(
        v.object({
          key: v.string(),
          subject: v.string(),
          body: v.string(),
        }),
      ),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_key", ["key"]),

    /** People -------------------------------------------------------------- */
    customerProfiles: defineTable({
      userId: v.id("users"),
      reference: v.string(),
      fullName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      dateOfBirth: v.optional(v.string()),
      country: v.string(),
      city: v.optional(v.string()),
      addressLine: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      currency: v.string(),
      locale: v.string(),
      timezone: v.string(),
      preferredLanguage: v.string(),
      marketingOptIn: v.boolean(),
      verificationStatus: verificationValidator,
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_user", ["userId"])
      .index("by_reference", ["reference"])
      .index("by_country", ["country"])
      .index("by_email", ["email"]),

    brokerProfiles: defineTable({
      userId: v.id("users"),
      reference: v.string(),
      orgName: v.string(),
      contactName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      countries: v.array(v.string()),
      status: v.union(v.literal("active"), v.literal("suspended")),
      agreementRef: v.optional(v.string()),
      commissionEnabled: v.boolean(),
      commissionRate: v.number(), // percent, 0-100
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

    brokerAssignments: defineTable({
      brokerUserId: v.id("users"),
      customerUserId: v.id("users"),
      status: v.union(v.literal("active"), v.literal("revoked")),
      assignedBy: v.id("users"),
      note: v.optional(v.string()),
      createdAt: v.number(),
      revokedAt: v.optional(v.number()),
      ...demoFields,
    })
      .index("by_broker", ["brokerUserId", "status"])
      .index("by_customer", ["customerUserId", "status"]),

    /** Products ------------------------------------------------------------ */
    products: defineTable({
      code: v.string(),
      name: v.string(),
      categoryKey: v.string(),
      description: v.string(),
      targetCustomer: v.string(),
      countries: v.array(v.string()),
      currency: v.string(),
      basePremium: v.number(), // minor units per year
      termMonths: v.number(),
      excess: v.number(), // minor units
      coverageLimit: v.number(), // minor units
      exclusions: v.array(v.string()),
      benefits: v.array(v.string()),
      ratingFactors: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          help: v.optional(v.string()),
          options: v.array(
            v.object({
              value: v.string(),
              label: v.string(),
              multiplier: v.number(),
            }),
          ),
        }),
      ),
      questions: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          type: v.union(
            v.literal("text"),
            v.literal("number"),
            v.literal("date"),
            v.literal("select"),
            v.literal("textarea"),
          ),
          required: v.boolean(),
          options: v.optional(v.array(v.string())),
          help: v.optional(v.string()),
        }),
      ),
      requiredDocuments: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          required: v.boolean(),
        }),
      ),
      wordingVersion: v.string(),
      wording: v.string(),
      disclosures: v.string(),
      status: productStatusValidator,
      version: v.number(),
      effectiveFrom: v.number(),
      renewalNoticeDays: v.number(),
      cancellationNoticeDays: v.number(),
      createdBy: v.id("users"),
      publishedBy: v.optional(v.id("users")),
      publishedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_code", ["code"])
      .index("by_status", ["status"])
      .index("by_category", ["categoryKey"])
      .index("by_country", ["countries"])
      .index("by_code_version", ["code", "version"]),

    /** Quotations and applications ---------------------------------------- */
    quotations: defineTable({
      reference: v.string(),
      customerUserId: v.id("users"),
      brokerUserId: v.optional(v.id("users")),
      productId: v.id("products"),
      productCode: v.string(),
      productVersion: v.number(),
      productName: v.string(),
      country: v.string(),
      currency: v.string(),
      answers: v.any(),
      premium: v.number(), // minor units, annual
      breakdown: v.any(),
      status: v.union(
        v.literal("quoted"),
        v.literal("accepted"),
        v.literal("expired"),
        v.literal("withdrawn"),
      ),
      expiresAt: v.number(),
      createdBy: v.id("users"),
      consentAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_customer", ["customerUserId"])
      .index("by_broker", ["brokerUserId"])
      .index("by_reference", ["reference"])
      .index("by_product", ["productId"]),

    applications: defineTable({
      reference: v.string(),
      quotationId: v.optional(v.id("quotations")),
      customerUserId: v.id("users"),
      brokerUserId: v.optional(v.id("users")),
      productId: v.id("products"),
      productCode: v.string(),
      productVersion: v.number(),
      productName: v.string(),
      categoryKey: v.string(),
      country: v.string(),
      currency: v.string(),
      premium: v.number(),
      answers: v.any(),
      status: applicationStatusValidator,
      submittedAt: v.optional(v.number()),
      assignedTo: v.optional(v.id("users")),
      decision: v.optional(
        v.union(v.literal("approved"), v.literal("declined")),
      ),
      decisionReason: v.optional(v.string()),
      decidedBy: v.optional(v.id("users")),
      decidedAt: v.optional(v.number()),
      infoRequest: v.optional(v.string()),
      infoRequestAt: v.optional(v.number()),
      customerResponse: v.optional(v.string()),
      withdrawnAt: v.optional(v.number()),
      termsAcceptedAt: v.optional(v.number()),
      consentRecordedAt: v.optional(v.number()),
      documents: v.array(
        v.object({
          name: v.string(),
          key: v.string(),
          storageId: v.optional(v.id("_storage")),
          body: v.optional(v.string()),
          addedBy: v.id("users"),
          addedAt: v.number(),
        }),
      ),
      policyId: v.optional(v.id("policies")),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_customer", ["customerUserId"])
      .index("by_broker", ["brokerUserId"])
      .index("by_status", ["status"])
      .index("by_assigned", ["assignedTo"])
      .index("by_product", ["productId"])
      .index("by_reference", ["reference"]),

    applicationEvents: defineTable({
      applicationId: v.id("applications"),
      actorId: v.id("users"),
      actorRole: v.string(),
      kind: v.union(
        v.literal("status"),
        v.literal("note"),
        v.literal("decision"),
        v.literal("info_request"),
        v.literal("document"),
        v.literal("assignment"),
      ),
      message: v.string(),
      fromStatus: v.optional(v.string()),
      toStatus: v.optional(v.string()),
      internal: v.boolean(),
      createdAt: v.number(),
      ...demoFields,
    }).index("by_application", ["applicationId"]),

    /** Policies ------------------------------------------------------------ */
    policies: defineTable({
      policyNumber: v.string(),
      customerUserId: v.id("users"),
      brokerUserId: v.optional(v.id("users")),
      applicationId: v.id("applications"),
      productId: v.id("products"),
      productCode: v.string(),
      productVersion: v.number(),
      productName: v.string(),
      categoryKey: v.string(),
      status: policyStatusValidator,
      insuredName: v.string(),
      country: v.string(),
      currency: v.string(),
      premium: v.number(),
      excess: v.number(),
      coverageLimit: v.number(),
      exclusions: v.array(v.string()),
      benefits: v.array(v.string()),
      wordingVersion: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      renewalDate: v.number(),
      issuedBy: v.id("users"),
      issuedAt: v.number(),
      cancelledAt: v.optional(v.number()),
      cancelReason: v.optional(v.string()),
      suspendedAt: v.optional(v.number()),
      suspensionReason: v.optional(v.string()),
      endorsements: v.array(
        v.object({
          summary: v.string(),
          at: v.number(),
          by: v.id("users"),
          requestId: v.optional(v.id("policyRequests")),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_customer", ["customerUserId"])
      .index("by_broker", ["brokerUserId"])
      .index("by_status", ["status"])
      .index("by_number", ["policyNumber"])
      .index("by_end_date", ["endDate"])
      .index("by_application", ["applicationId"]),

    policyRequests: defineTable({
      policyId: v.id("policies"),
      customerUserId: v.id("users"),
      kind: v.union(
        v.literal("endorsement"),
        v.literal("cancellation"),
        v.literal("renewal"),
        v.literal("suspension"),
      ),
      details: v.string(),
      status: requestStatusValidator,
      requestedBy: v.id("users"),
      decidedBy: v.optional(v.id("users")),
      decisionNote: v.optional(v.string()),
      decidedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_policy", ["policyId"])
      .index("by_customer", ["customerUserId"])
      .index("by_status", ["status"]),

    /** Claims -------------------------------------------------------------- */
    claims: defineTable({
      reference: v.string(),
      policyId: v.id("policies"),
      customerUserId: v.id("users"),
      productId: v.id("products"),
      productName: v.string(),
      country: v.string(),
      currency: v.string(),
      incidentDate: v.number(),
      location: v.string(),
      description: v.string(),
      amountClaimed: v.number(),
      status: claimStatusValidator,
      assignedTo: v.optional(v.id("users")),
      decision: v.optional(
        v.union(
          v.literal("approved"),
          v.literal("partially_approved"),
          v.literal("declined"),
        ),
      ),
      approvedAmount: v.optional(v.number()),
      decisionReason: v.optional(v.string()),
      decidedBy: v.optional(v.id("users")),
      decidedAt: v.optional(v.number()),
      infoRequest: v.optional(v.string()),
      infoRequestAt: v.optional(v.number()),
      customerResponse: v.optional(v.string()),
      settlementRef: v.optional(v.string()),
      paidAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      closureReason: v.optional(v.string()),
      disputeMessage: v.optional(v.string()),
      documents: v.array(
        v.object({
          name: v.string(),
          key: v.string(),
          storageId: v.optional(v.id("_storage")),
          body: v.optional(v.string()),
          addedBy: v.id("users"),
          addedAt: v.number(),
        }),
      ),
      reportedAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_customer", ["customerUserId"])
      .index("by_policy", ["policyId"])
      .index("by_status", ["status"])
      .index("by_assigned", ["assignedTo"])
      .index("by_reference", ["reference"]),

    claimEvents: defineTable({
      claimId: v.id("claims"),
      actorId: v.id("users"),
      actorRole: v.string(),
      kind: v.union(
        v.literal("status"),
        v.literal("note"),
        v.literal("decision"),
        v.literal("info_request"),
        v.literal("document"),
        v.literal("settlement"),
      ),
      message: v.string(),
      fromStatus: v.optional(v.string()),
      toStatus: v.optional(v.string()),
      internal: v.boolean(),
      createdAt: v.number(),
      ...demoFields,
    }).index("by_claim", ["claimId"]),

    /** Money --------------------------------------------------------------- */
    transactions: defineTable({
      reference: v.string(),
      customerUserId: v.id("users"),
      policyId: v.optional(v.id("policies")),
      applicationId: v.optional(v.id("applications")),
      claimId: v.optional(v.id("claims")),
      type: transactionTypeValidator,
      amount: v.number(), // minor units, always positive
      currency: v.string(),
      status: transactionStatusValidator,
      method: v.union(
        v.literal("bank_transfer"),
        v.literal("card"),
        v.literal("manual"),
      ),
      providerRef: v.optional(v.string()),
      providerVerified: v.boolean(),
      idempotencyKey: v.optional(v.string()),
      note: v.optional(v.string()),
      recordedBy: v.optional(v.id("users")),
      reconciled: v.boolean(),
      reconciledBy: v.optional(v.id("users")),
      reconciledAt: v.optional(v.number()),
      failureReason: v.optional(v.string()),
      refundOf: v.optional(v.id("transactions")),
      dueDate: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      ...demoFields,
    })
      .index("by_customer", ["customerUserId"])
      .index("by_policy", ["policyId"])
      .index("by_application", ["applicationId"])
      .index("by_claim", ["claimId"])
      .index("by_status", ["status"])
      .index("by_reference", ["reference"])
      .index("by_idempotency", ["idempotencyKey"])
      .index("by_type", ["type"]),

    /** Documents ----------------------------------------------------------- */
    documents: defineTable({
      ownerUserId: v.id("users"),
      name: v.string(),
      category: v.union(
        v.literal("policy"),
        v.literal("invoice"),
        v.literal("receipt"),
        v.literal("claim"),
        v.literal("endorsement"),
        v.literal("application"),
        v.literal("other"),
      ),
      policyId: v.optional(v.id("policies")),
      claimId: v.optional(v.id("claims")),
      applicationId: v.optional(v.id("applications")),
      storageId: v.optional(v.id("_storage")),
      body: v.optional(v.string()),
      contentType: v.string(),
      size: v.optional(v.number()),
      version: v.number(),
      issuedBy: v.optional(v.id("users")),
      issuedAt: v.number(),
      createdAt: v.number(),
      ...demoFields,
    })
      .index("by_owner", ["ownerUserId"])
      .index("by_policy", ["policyId"])
      .index("by_claim", ["claimId"])
      .index("by_application", ["applicationId"]),

    /** Notifications ------------------------------------------------------- */
    notifications: defineTable({
      userId: v.id("users"),
      type: v.string(),
      title: v.string(),
      body: v.string(),
      href: v.optional(v.string()),
      relatedType: v.optional(v.string()),
      relatedId: v.optional(v.string()),
      dedupeKey: v.string(),
      readAt: v.optional(v.number()),
      emailStatus: notificationEmailStatusValidator,
      emailAttempts: v.number(),
      emailError: v.optional(v.string()),
      createdAt: v.number(),
      ...demoFields,
    })
      .index("by_user", ["userId"])
      .index("by_dedupe", ["dedupeKey"])
      .index("by_email_status", ["emailStatus"]),

    /** Support ------------------------------------------------------------- */
    tickets: defineTable({
      reference: v.string(),
      userId: v.id("users"),
      category: v.string(),
      subject: v.string(),
      message: v.string(),
      status: ticketStatusValidator,
      priority: v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
      ),
      relatedType: v.optional(v.string()),
      relatedId: v.optional(v.string()),
      assignedTo: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_reference", ["reference"]),

    ticketMessages: defineTable({
      ticketId: v.id("tickets"),
      authorId: v.id("users"),
      authorRole: v.string(),
      body: v.string(),
      internal: v.boolean(),
      createdAt: v.number(),
    }).index("by_ticket", ["ticketId"]),

    /** Audit --------------------------------------------------------------- */
    auditLogs: defineTable({
      actorId: v.id("users"),
      actorRole: v.string(),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      before: v.optional(v.any()),
      after: v.optional(v.any()),
      reason: v.optional(v.string()),
      requestId: v.optional(v.string()),
      at: v.number(),
      ...demoFields,
    })
      .index("by_entity", ["entityType", "entityId"])
      .index("by_actor", ["actorId"])
      .index("by_action", ["action"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
