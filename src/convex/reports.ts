import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import {
  PERMISSIONS,
  hasPermission,
  isStaffRole,
  requirePermission,
  requireStaff,
  requireViewer,
} from "./lib/authz";
import { DAY } from "./lib/refs";
import { getSettings } from "./lib/settings";

type Money = { currency: string; amount: number };

function sumByCurrency(rows: { currency: string; amount: number }[]): Money[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
  }
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

async function loadSnapshot(ctx: QueryCtx) {
  const [
    profiles,
    users,
    policies,
    applications,
    claims,
    transactions,
    documents,
    notifications,
    requests,
    brokers,
    assignments,
    quotes,
    audit,
    tickets,
  ] = await Promise.all([
    ctx.db.query("customerProfiles").take(500),
    ctx.db.query("users").take(500),
    ctx.db.query("policies").take(500),
    ctx.db.query("applications").take(500),
    ctx.db.query("claims").take(500),
    ctx.db.query("transactions").take(800),
    ctx.db.query("documents").take(300),
    ctx.db.query("notifications").take(300),
    ctx.db.query("policyRequests").take(300),
    ctx.db.query("brokerProfiles").take(200),
    ctx.db.query("brokerAssignments").take(300),
    ctx.db.query("quotations").take(300),
    ctx.db.query("auditLogs").take(300),
    ctx.db.query("tickets").take(300),
  ]);
  return {
    profiles,
    users,
    policies,
    applications,
    claims,
    transactions,
    documents,
    notifications,
    requests,
    brokers,
    assignments,
    quotes,
    audit,
    tickets,
  };
}

const OPEN_CLAIM_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_required",
  "under_assessment",
];
const OPEN_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_required",
];

export const overview = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    const now = Date.now();
    const from = args.from ?? now - 30 * DAY;
    const to = args.to ?? now;
    const settings = await getSettings(ctx);

    if (viewer.role === "customer") {
      /* Read the member's own rows by index rather than filtering a capped
         snapshot of the whole tables. The snapshot is loaded in creation
         order, so once the deployment holds more rows than it loads, a newly
         issued policy, invoice or document falls outside it and the member's
         own dashboard hides their own cover: the tile reads zero while the
         Policies page lists the policy. */
      const [
        myPolicies,
        myApps,
        myClaims,
        myTransactions,
        myDocs,
        myNotifications,
        myRequests,
      ] = await Promise.all([
        ctx.db
          .query("policies")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", viewer.user._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("applications")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", viewer.user._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("claims")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", viewer.user._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("transactions")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", viewer.user._id),
          )
          .order("desc")
          .take(200),
        ctx.db
          .query("documents")
          .withIndex("by_owner", (q) =>
            q.eq("ownerUserId", viewer.user._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", viewer.user._id))
          .order("desc")
          .take(50),
        ctx.db
          .query("policyRequests")
          .withIndex("by_customer", (q) =>
            q.eq("customerUserId", viewer.user._id),
          )
          .order("desc")
          .take(50),
      ]);
      const outstanding = myTransactions.filter(
        (tx) => tx.type === "premium" && tx.status === "pending",
      );
      /* A cover the member has already asked us to renew says so on the card
         instead of offering the same request twice. */
      const pendingRenewals = new Set(
        myRequests
          .filter(
            (request) =>
              request.status === "pending" && request.kind === "renewal",
          )
          .map((request) => request.policyId),
      );
      return {
        kind: "customer" as const,
        defaultCurrency: settings.defaultCurrency,
        metrics: {
          activePolicies: myPolicies.filter((policy) => policy.status === "active").length,
          pendingApplications: myApps.filter((app) =>
            OPEN_APPLICATION_STATUSES.includes(app.status),
          ).length,
          openClaims: myClaims.filter((claim) =>
            OPEN_CLAIM_STATUSES.includes(claim.status),
          ).length,
          pendingRequests: myRequests.filter((request) => request.status === "pending").length,
        },
        outstanding: sumByCurrency(
          outstanding.map((tx) => ({ currency: tx.currency, amount: tx.amount })),
        ),
        renewals: myPolicies
          .filter(
            (policy) =>
              policy.status === "active" &&
              policy.endDate <= now + settings.renewalNoticeDays * DAY,
          )
          .sort((a, b) => a.endDate - b.endDate)
          .slice(0, 5),
        recentPolicies: myPolicies
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5),
        /* Cover that is no longer in force. It leaves the active count, which
           is correct - and without somewhere to land, a lapsed vault policy
           would disappear from the overview entirely and be findable only two
           pages away. */
        lapsedCover: myPolicies
          .filter(
            (policy) =>
              policy.status === "expired" ||
              policy.status === "suspended" ||
              policy.status === "cancelled",
          )
          .sort((a, b) => b.endDate - a.endDate)
          .slice(0, 5)
          .map((policy) => ({
            _id: policy._id,
            policyNumber: policy.policyNumber,
            productName: policy.productName,
            categoryKey: policy.categoryKey,
            status: policy.status,
            endDate: policy.endDate,
            suspensionReason: policy.suspensionReason ?? null,
            renewalRequested: pendingRenewals.has(policy._id),
          })),
        infoRequests: [
          ...myApps.filter((app) => app.status === "additional_info_required"),
          ...myClaims.filter((claim) => claim.status === "additional_info_required"),
        ].slice(0, 5),
        recentDocuments: myDocs.sort((a, b) => b.issuedAt - a.issuedAt).slice(0, 6),
        notifications: myNotifications.slice(0, 5),
        unreadNotifications: myNotifications.filter((item) => !item.readAt).length,
        recentClaims: myClaims.sort((a, b) => b.reportedAt - a.reportedAt).slice(0, 5),
        recentTransactions: myTransactions
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5),
      };
    }

    const snapshot = await loadSnapshot(ctx);
    const names = new Map(
      snapshot.users.map((user) => [user._id, user.name ?? user.email ?? "Customer"]),
    );

    if (viewer.role === "broker") {
      const profile = snapshot.brokers.find(
        (broker) => broker.userId === viewer.user._id,
      );
      const myAssignments = snapshot.assignments.filter(
        (assignment) =>
          assignment.brokerUserId === viewer.user._id && assignment.status === "active",
      );
      const customerIds = new Set(
        myAssignments.map((assignment) => assignment.customerUserId),
      );
      const myPolicies = snapshot.policies.filter((policy) =>
        customerIds.has(policy.customerUserId),
      );
      const myApps = snapshot.applications.filter((app) =>
        customerIds.has(app.customerUserId),
      );
      const myQuotes = snapshot.quotes.filter(
        (quote) => quote.brokerUserId === viewer.user._id,
      );
      const commissionEnabled =
        settings.commissionEnabled && (profile?.commissionEnabled ?? false);
      const rate = profile?.commissionRate ?? 0;
      return {
        kind: "broker" as const,
        defaultCurrency: settings.defaultCurrency,
        profile,
        metrics: {
          assignedCustomers: customerIds.size,
          activePolicies: myPolicies.filter((policy) => policy.status === "active").length,
          openApplications: myApps.filter((app) =>
            ["draft", ...OPEN_APPLICATION_STATUSES].includes(app.status),
          ).length,
          quotes: myQuotes.filter((quote) => quote.status === "quoted").length,
        },
        commissionEnabled,
        commissionRate: rate,
        commission: commissionEnabled
          ? sumByCurrency(
              myPolicies
                .filter((policy) => policy.status === "active")
                .map((policy) => ({
                  currency: policy.currency,
                  amount: Math.round(policy.premium * (rate / 100)),
                })),
            )
          : [],
        renewals: myPolicies
          .filter(
            (policy) =>
              policy.status === "active" &&
              policy.endDate <= now + settings.renewalNoticeDays * DAY,
          )
          .sort((a, b) => a.endDate - b.endDate)
          .slice(0, 8)
          .map((policy) => ({
            ...policy,
            customerName: names.get(policy.customerUserId) ?? "Customer",
          })),
        recentApplications: myApps
          .sort((a, b) => (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt))
          .slice(0, 6)
          .map((app) => ({
            ...app,
            customerName: names.get(app.customerUserId) ?? "Customer",
          })),
      };
    }

    const staff = await requireStaff(ctx);
    const canSeeMoney = hasPermission(staff, PERMISSIONS.PAYMENTS_VIEW);
    const canSeeAudit = hasPermission(staff, PERMISSIONS.AUDIT_VIEW);
    const inPeriod = (at?: number) => Boolean(at && at >= from && at <= to);
    const premiumReceived = snapshot.transactions.filter(
      (tx) =>
        tx.type === "premium" &&
        tx.status === "succeeded" &&
        inPeriod(tx.createdAt),
    );
    const outstanding = snapshot.transactions.filter(
      (tx) => tx.type === "premium" && tx.status === "pending",
    );
    const refunds = snapshot.transactions.filter(
      (tx) => tx.type === "refund" && tx.status === "succeeded" && inPeriod(tx.createdAt),
    );
    const settlements = snapshot.transactions.filter(
      (tx) => tx.type === "settlement" && tx.status === "succeeded" && inPeriod(tx.createdAt),
    );

    const overdueClaims = snapshot.claims.filter(
      (claim) =>
        OPEN_CLAIM_STATUSES.includes(claim.status) &&
        claim.reportedAt < now - settings.claimSlaDays * DAY,
    );
    const overduePremiums = outstanding.filter(
      (tx) => tx.dueDate !== undefined && tx.dueDate < now,
    );
    const unassignedApplications = snapshot.applications.filter(
      (app) => OPEN_APPLICATION_STATUSES.includes(app.status) && !app.assignedTo,
    );

    return {
      kind: "admin" as const,
      defaultCurrency: settings.defaultCurrency,
      period: { from, to },
      metrics: {
        customers: snapshot.profiles.length,
        activePolicies: snapshot.policies.filter((policy) => policy.status === "active").length,
        awaitingApplications: snapshot.applications.filter((app) =>
          OPEN_APPLICATION_STATUSES.includes(app.status),
        ).length,
        approvedApplications: snapshot.applications.filter(
          (app) => app.decision === "approved" && inPeriod(app.decidedAt),
        ).length,
        declinedApplications: snapshot.applications.filter(
          (app) => app.decision === "declined" && inPeriod(app.decidedAt),
        ).length,
        claimsAwaiting: snapshot.claims.filter((claim) =>
          OPEN_CLAIM_STATUSES.includes(claim.status),
        ).length,
        claimsInfoRequired: snapshot.claims.filter(
          (claim) => claim.status === "additional_info_required",
        ).length,
        claimsDecided: snapshot.claims.filter((claim) => inPeriod(claim.decidedAt)).length,
        claimsPaid: snapshot.claims.filter((claim) => inPeriod(claim.paidAt)).length,
        policiesExpiringSoon: snapshot.policies.filter(
          (policy) =>
            policy.status === "active" &&
            policy.endDate <= now + settings.renewalNoticeDays * DAY,
        ).length,
        pendingPolicyRequests: snapshot.requests.filter(
          (request) => request.status === "pending",
        ).length,
        openTickets: snapshot.tickets.filter(
          (ticket) => ticket.status === "open" || ticket.status === "awaiting_customer",
        ).length,
      },
      money: {
        premiumReceived: canSeeMoney
          ? sumByCurrency(premiumReceived.map((tx) => ({ currency: tx.currency, amount: tx.amount })))
          : [],
        outstanding: canSeeMoney
          ? sumByCurrency(outstanding.map((tx) => ({ currency: tx.currency, amount: tx.amount })))
          : [],
        refunds: canSeeMoney
          ? sumByCurrency(refunds.map((tx) => ({ currency: tx.currency, amount: tx.amount })))
          : [],
        settlements: canSeeMoney
          ? sumByCurrency(settlements.map((tx) => ({ currency: tx.currency, amount: tx.amount })))
          : [],
        canSeeMoney,
      },
      recentCustomers: snapshot.profiles
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6),
      recentPolicies: snapshot.policies
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6)
        .map((policy) => ({
          ...policy,
          customerName: names.get(policy.customerUserId) ?? "Customer",
        })),
      recentApplications: snapshot.applications
        .sort((a, b) => (b.submittedAt ?? b.createdAt) - (a.submittedAt ?? a.createdAt))
        .slice(0, 6)
        .map((app) => ({
          ...app,
          customerName: names.get(app.customerUserId) ?? "Customer",
        })),
      recentActivity: canSeeAudit
        ? [...snapshot.audit].sort((a, b) => b.at - a.at).slice(0, 8)
        : [],
      alerts: [
        {
          key: "overdue-claims",
          label: "Claims past the SLA clock",
          count: overdueClaims.length,
          href: "/dashboard/admin/claims?status=under_review",
          severity: overdueClaims.length > 0 ? "critical" : "ok",
        },
        {
          key: "overdue-premiums",
          label: "Overdue premium invoices",
          count: overduePremiums.length,
          href: "/dashboard/admin/payments?status=pending",
          severity: overduePremiums.length > 0 ? "critical" : "ok",
        },
        {
          key: "unassigned-applications",
          label: "Applications without a reviewer",
          count: unassignedApplications.length,
          href: "/dashboard/admin/applications?status=submitted",
          severity: unassignedApplications.length > 0 ? "warning" : "ok",
        },
        {
          key: "pending-requests",
          label: "Policy servicing requests awaiting approval",
          count: snapshot.requests.filter((request) => request.status === "pending").length,
          href: "/dashboard/admin/policies",
          severity: "warning",
        },
      ],
    };
  },
});

const BOARD_CATEGORY_LABELS: Record<string, string> = {
  motor: "Motor",
  health: "Health",
  home: "Home",
  travel: "Travel",
  life: "Life",
  business: "Business",
};

const OPEN_CLAIM_SET = new Set([
  "submitted",
  "under_review",
  "additional_info_required",
  "under_assessment",
  "payment_pending",
]);

function categoryLabel(key: string) {
  return (
    BOARD_CATEGORY_LABELS[key] ??
    key.replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}

function monthBuckets(now: number, months: number) {
  const current = new Date(now);
  return Array.from({ length: months }, (_, index) => {
    const offset = index - (months - 1);
    const start = Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() + offset,
      1,
    );
    const end = Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() + offset + 1,
      1,
    ) - 1;
    return {
      start,
      end,
      label: new Date(start).toLocaleDateString("en-GB", {
        month: "short",
        timeZone: "UTC",
      }),
      premium: 0,
      claims: 0,
      collected: 0,
      newBusiness: 0,
      policies: 0,
      ratio: 0,
    };
  });
}

/** A claim is "incurred" at its approved amount once decided, at the claimed
 *  amount while it is still open, and at zero when it has been declined. */
function incurredAmount(claim: {
  status: string;
  amountClaimed: number;
  approvedAmount?: number;
}) {
  if (claim.status === "declined") return 0;
  return claim.approvedAmount ?? claim.amountClaimed;
}

/**
 * One role-scoped read for the dashboard board. Staff see the company book,
 * brokers see only their assigned customers, customers see only their own
 * records. Every monetary series is filtered to the reporting currency so
 * currencies are never silently added together.
 */
export const board = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const viewerRole = viewer.role;
    const staff = isStaffRole(viewerRole);
    if (!staff) {
      throw new Error("This dashboard is restricted to staff.");
    }
    const settings = await getSettings(ctx);
    const snapshot = await loadSnapshot(ctx);
    const now = Date.now();
    const months = Math.min(24, Math.max(3, Math.round(args.months ?? 6)));
    const currency = settings.defaultCurrency;
    const canSeeMoney = staff
      ? hasPermission(viewer, PERMISSIONS.PAYMENTS_VIEW)
      : true;

    const names = new Map(
      snapshot.users.map((user) => [
        user._id,
        user.name ?? user.email ?? "Customer",
      ]),
    );

    const assignedCustomerIds =
      viewer.role === "broker"
        ? new Set(
            snapshot.assignments
              .filter(
                (assignment) =>
                  assignment.brokerUserId === viewer.user._id &&
                  assignment.status === "active",
              )
              .map((assignment) => assignment.customerUserId),
          )
        : null;

    const scopedPolicies = staff
      ? snapshot.policies
      : viewer.role === "broker"
        ? snapshot.policies.filter(
            (policy) =>
              policy.brokerUserId === viewer.user._id ||
              assignedCustomerIds?.has(policy.customerUserId),
          )
        : snapshot.policies.filter(
            (policy) => policy.customerUserId === viewer.user._id,
          );

    const scopedPolicyIds = new Set(scopedPolicies.map((policy) => policy._id));

    const scopedClaims = staff
      ? snapshot.claims
      : viewer.role === "broker"
        ? snapshot.claims.filter((claim) => scopedPolicyIds.has(claim.policyId))
        : snapshot.claims.filter(
            (claim) => claim.customerUserId === viewer.user._id,
          );

    const scopedTransactions = staff
      ? snapshot.transactions
      : viewer.role === "broker"
        ? snapshot.transactions.filter(
            (tx) => tx.policyId !== undefined && scopedPolicyIds.has(tx.policyId),
          )
        : snapshot.transactions.filter(
            (tx) => tx.customerUserId === viewer.user._id,
          );

    const scopedApplications = staff
      ? snapshot.applications
      : viewer.role === "broker"
        ? snapshot.applications.filter((app) =>
            assignedCustomerIds?.has(app.customerUserId),
          )
        : snapshot.applications.filter(
            (app) => app.customerUserId === viewer.user._id,
          );

    const moneyPolicies = scopedPolicies.filter(
      (policy) => policy.currency === currency,
    );
    const moneyClaims = scopedClaims.filter(
      (claim) => claim.currency === currency,
    );
    const moneyTransactions = scopedTransactions.filter(
      (tx) => tx.currency === currency,
    );
    const otherCurrencies = new Set(
      [...scopedPolicies, ...scopedClaims, ...scopedTransactions]
        .map((row) => row.currency)
        .filter((code) => code !== currency),
    ).size;

    const buckets = monthBuckets(now, months);
    const firstBucket = buckets[0];

    for (const bucket of buckets) {
      for (const policy of moneyPolicies) {
        const wasLive =
          policy.startDate <= bucket.end &&
          policy.endDate >= bucket.start &&
          !["draft", "pending_approval", "cancelled"].includes(policy.status);
        if (wasLive) bucket.premium += policy.premium / 100;
        if (policy.startDate >= bucket.start && policy.startDate <= bucket.end) {
          bucket.policies += 1;
          bucket.newBusiness += policy.premium / 100;
        }
      }
      for (const claim of moneyClaims) {
        if (claim.reportedAt >= bucket.start && claim.reportedAt <= bucket.end) {
          bucket.claims += incurredAmount(claim) / 100;
        }
      }
      for (const tx of moneyTransactions) {
        if (
          tx.type === "premium" &&
          tx.status === "succeeded" &&
          tx.createdAt >= bucket.start &&
          tx.createdAt <= bucket.end
        ) {
          bucket.collected += tx.amount / 100;
        }
      }
      bucket.premium = Math.round(bucket.premium);
      bucket.claims = Math.round(bucket.claims);
      bucket.collected = Math.round(bucket.collected);
      bucket.newBusiness = Math.round(bucket.newBusiness);
      bucket.ratio =
        bucket.premium > 0
          ? Math.round((bucket.claims / (bucket.premium / 12)) * 100)
          : 0;
    }
    if (!canSeeMoney) {
      for (const bucket of buckets) {
        bucket.premium = 0;
        bucket.claims = 0;
        bucket.collected = 0;
        bucket.newBusiness = 0;
        bucket.ratio = 0;
      }
    }
    const monthly = buckets.map((bucket) => ({
      label: bucket.label,
      premium: bucket.premium,
      claims: bucket.claims,
      collected: bucket.collected,
      newBusiness: bucket.newBusiness,
      policies: bucket.policies,
      ratio: bucket.ratio,
    }));

    const livePolicies = moneyPolicies.filter(
      (policy) =>
        policy.status === "active" || policy.status === "renewal_pending",
    );
    const premiumInForce = canSeeMoney
      ? Math.round(
          livePolicies.reduce((total, policy) => total + policy.premium / 100, 0),
        )
      : 0;
    const activePolicies = livePolicies.length;
    const claimsInWindow = canSeeMoney
      ? Math.round(
          moneyClaims
            .filter((claim) => claim.reportedAt >= firstBucket.start)
            .reduce((total, claim) => total + incurredAmount(claim) / 100, 0),
        )
      : 0;
    const earnedPremium = premiumInForce * (months / 12);
    const lossRatio =
      canSeeMoney && earnedPremium > 0
        ? Math.round((claimsInWindow / earnedPremium) * 100)
        : 0;
    const collected = canSeeMoney
      ? Math.round(
          moneyTransactions
            .filter(
              (tx) =>
                tx.type === "premium" &&
                tx.status === "succeeded" &&
                tx.createdAt >= firstBucket.start,
            )
            .reduce((total, tx) => total + tx.amount / 100, 0),
        )
      : 0;
    const newBusiness = canSeeMoney
      ? Math.round(
          moneyPolicies
            .filter((policy) => policy.startDate >= firstBucket.start)
            .reduce((total, policy) => total + policy.premium / 100, 0),
        )
      : 0;

    const priorStart = (() => {
      const date = new Date(firstBucket.start);
      return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() - months,
        1,
      );
    })();
    const priorClaims = canSeeMoney
      ? moneyClaims
          .filter(
            (claim) =>
              claim.reportedAt >= priorStart &&
              claim.reportedAt < firstBucket.start,
          )
          .reduce((total, claim) => total + incurredAmount(claim) / 100, 0)
      : 0;
    const priorBusiness = canSeeMoney
      ? moneyPolicies
          .filter(
            (policy) =>
              policy.startDate >= priorStart &&
              policy.startDate < firstBucket.start,
          )
          .reduce((total, policy) => total + policy.premium / 100, 0)
      : 0;
    const percentChange = (current: number, prior: number) =>
      prior > 0 ? Math.round(((current - prior) / prior) * 100) : null;

    const lineMap = new Map<
      string,
      {
        key: string;
        label: string;
        activePolicies: number;
        policies: number;
        premium: number;
      }
    >();
    for (const policy of moneyPolicies) {
      const key = policy.categoryKey || "other";
      const row = lineMap.get(key) ?? {
        key,
        label: categoryLabel(key),
        activePolicies: 0,
        policies: 0,
        premium: 0,
      };
      row.policies += 1;
      if (
        policy.status === "active" ||
        policy.status === "renewal_pending"
      ) {
        row.activePolicies += 1;
        if (canSeeMoney) row.premium += policy.premium / 100;
      }
      lineMap.set(key, row);
    }
    const lines = [...lineMap.values()]
      .filter((line) => line.activePolicies > 0 || line.premium > 0)
      .map((line) => ({
        ...line,
        premium: Math.round(line.premium),
        share:
          premiumInForce > 0
            ? Math.round((line.premium / premiumInForce) * 100)
            : 0,
      }))
      .sort((a, b) => b.premium - a.premium || b.policies - a.policies)
      .slice(0, 4);

    const claimsMix = [
      {
        key: "settled",
        label: "Settled",
        value: moneyClaims.filter((claim) =>
          ["approved", "partially_approved", "paid", "closed"].includes(
            claim.status,
          ),
        ).length,
      },
      {
        key: "open",
        label: "In review",
        value: moneyClaims.filter((claim) => OPEN_CLAIM_SET.has(claim.status))
          .length,
      },
      {
        key: "declined",
        label: "Declined",
        value: moneyClaims.filter((claim) => claim.status === "declined")
          .length,
      },
    ].filter((row) => row.value > 0);

    const openClaims = scopedClaims.filter((claim) =>
      OPEN_CLAIM_SET.has(claim.status),
    ).length;
    const renewalsDue = scopedPolicies.filter(
      (policy) =>
        (policy.status === "active" || policy.status === "renewal_pending") &&
        policy.endDate <= now + settings.renewalNoticeDays * DAY,
    ).length;
    const pendingApplications = scopedApplications.filter((app) =>
      OPEN_APPLICATION_STATUSES.includes(app.status),
    ).length;
    const customers = staff
      ? snapshot.profiles.length
      : viewer.role === "broker"
        ? (assignedCustomerIds?.size ?? 0)
        : 1;

    const plans = livePolicies
      .slice()
      .sort((a, b) => a.endDate - b.endDate)
      .slice(0, 4)
      .map((policy) => ({
        id: policy._id,
        policyNumber: policy.policyNumber,
        productName: policy.productName,
        categoryKey: policy.categoryKey,
        categoryLabel: categoryLabel(policy.categoryKey),
        customerName:
          viewer.role === "customer"
            ? undefined
            : (names.get(policy.customerUserId) ?? "Customer"),
        premium: canSeeMoney ? Math.round(policy.premium / 100) : 0,
        currency: policy.currency,
        startDate: policy.startDate,
        endDate: policy.endDate,
        status: policy.status,
      }));

    const recentClaims = scopedClaims
      .slice()
      .sort((a, b) => b.reportedAt - a.reportedAt)
      .slice(0, 4)
      .map((claim) => ({
        id: claim._id,
        reference: claim.reference,
        productName: claim.productName,
        customerName:
          viewer.role === "customer"
            ? undefined
            : (names.get(claim.customerUserId) ?? "Customer"),
        status: claim.status,
        amount: canSeeMoney ? Math.round(claim.amountClaimed / 100) : 0,
        currency: claim.currency,
        reportedAt: claim.reportedAt,
      }));

    const alerts = staff
      ? [
          {
            key: "claims-sla",
            label: "Claims past the SLA clock",
            count: scopedClaims.filter(
              (claim) =>
                OPEN_CLAIM_SET.has(claim.status) &&
                claim.reportedAt < now - settings.claimSlaDays * DAY,
            ).length,
            href: "/dashboard/admin/claims",
            severity: "critical" as const,
          },
          {
            key: "premium-overdue",
            label: "Overdue premium invoices",
            count: moneyTransactions.filter(
              (tx) =>
                tx.type === "premium" &&
                tx.status === "pending" &&
                tx.dueDate !== undefined &&
                tx.dueDate < now,
            ).length,
            href: "/dashboard/admin/payments",
            severity: "critical" as const,
          },
          {
            key: "unassigned",
            label: "Applications without a reviewer",
            count: scopedApplications.filter(
              (app) =>
                OPEN_APPLICATION_STATUSES.includes(app.status) && !app.assignedTo,
            ).length,
            href: "/dashboard/admin/applications",
            severity: "warning" as const,
          },
          {
            key: "renewals",
            label: "Renewals inside the notice window",
            count: renewalsDue,
            href: "/dashboard/admin/policies",
            severity: "warning" as const,
          },
        ]
      : [
          {
            key: "renewals",
            label: `Renewals in the next ${settings.renewalNoticeDays} days`,
            count: renewalsDue,
            href: viewer.role === "broker" ? "/dashboard/policies" : "/dashboard/policies",
            severity: "warning" as const,
          },
          {
            key: "claims",
            label: "Claims being reviewed",
            count: openClaims,
            href: viewer.role === "broker" ? "/dashboard/policies" : "/dashboard/claims",
            severity: "info" as const,
          },
          {
            key: "applications",
            label: "Applications in underwriting",
            count: pendingApplications,
            href: "/dashboard/applications",
            severity: "info" as const,
          },
        ];

    return {
      scope: staff ? ("company" as const) : viewer.role === "broker" ? ("book" as const) : ("member" as const),
      currency,
      months,
      asOf: now,
      canSeeMoney,
      otherCurrencies,
      kpis: {
        premiumInForce,
        activePolicies,
        openClaims,
        renewalsDue,
        pendingApplications,
        customers,
        collected,
        newBusiness,
        claimsInWindow,
        lossRatio,
        avgPremium:
          activePolicies > 0
            ? Math.round(premiumInForce / activePolicies)
            : 0,
        newBusinessChange: percentChange(newBusiness, priorBusiness),
        claimsChange: percentChange(claimsInWindow, priorClaims),
      },
      lines,
      monthly,
      claimsMix,
      plans,
      recentClaims,
      alerts,
    };
  },
});

export const generate = query({
  args: {
    report: v.string(),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    productId: v.optional(v.id("products")),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    await requirePermission(ctx, PERMISSIONS.REPORTS_VIEW);
    const snapshot = await loadSnapshot(ctx);
    const settings = await getSettings(ctx);
    const now = Date.now();
    const from = args.from ?? now - 30 * DAY;
    const to = args.to ?? now;
    const names = new Map(
      snapshot.users.map((user) => [user._id, user.name ?? user.email ?? "Customer"]),
    );
    const productMap = new Map<string, string>();
    for (const policy of snapshot.policies) productMap.set(policy.productId, policy.productName);
    const countryFilter = args.country && args.country !== "all" ? args.country : undefined;
    const productFilter = args.productId;
    const inRange = (at?: number) => Boolean(at && at >= from && at <= to);

    type Row = Record<string, string | number>;
    let columns: { key: string; label: string }[] = [];
    let rows: Row[] = [];
    let totals: Record<string, string | number> = {};
    let basis = "";

    switch (args.report) {
      case "customers": {
        columns = [
          { key: "reference", label: "Customer reference" },
          { key: "name", label: "Name" },
          { key: "country", label: "Country" },
          { key: "email", label: "Email" },
          { key: "status", label: "Verification" },
          { key: "created", label: "Registered" },
        ];
        rows = snapshot.profiles
          .filter((profile) => inRange(profile.createdAt) && (!countryFilter || profile.country === countryFilter))
          .map((profile) => ({
            reference: profile.reference,
            name: profile.fullName,
            country: profile.country,
            email: profile.email,
            status: profile.verificationStatus,
            created: new Date(profile.createdAt).toISOString().slice(0, 10),
          }));
        totals = { customers: rows.length };
        basis = "Customer registration records created within the selected period.";
        break;
      }
      case "policies": {
        columns = [
          { key: "policyNumber", label: "Policy" },
          { key: "product", label: "Product" },
          { key: "customer", label: "Customer" },
          { key: "country", label: "Country" },
          { key: "status", label: "Status" },
          { key: "premium", label: "Premium" },
          { key: "currency", label: "Currency" },
          { key: "endDate", label: "End date" },
        ];
        rows = snapshot.policies
          .filter(
            (policy) =>
              inRange(policy.startDate) &&
              (!countryFilter || policy.country === countryFilter) &&
              (!productFilter || policy.productId === productFilter),
          )
          .map((policy) => ({
            policyNumber: policy.policyNumber,
            product: policy.productName,
            customer: names.get(policy.customerUserId) ?? "Customer",
            country: policy.country,
            status: policy.status,
            premium: policy.premium / 100,
            currency: policy.currency,
            endDate: new Date(policy.endDate).toISOString().slice(0, 10),
          }));
        const byCurrency = new Map<string, number>();
        for (const policy of snapshot.policies.filter(
          (item) =>
            inRange(item.startDate) &&
            (!countryFilter || item.country === countryFilter) &&
            (!productFilter || item.productId === productFilter),
        )) {
          byCurrency.set(
            policy.currency,
            (byCurrency.get(policy.currency) ?? 0) + policy.premium / 100,
          );
        }
        totals = {
          policies: rows.length,
          premiumByCurrency: [...byCurrency.entries()]
            .map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`)
            .join(" · "),
        };
        basis = "Policies by start date in the selected period.";
        break;
      }
      case "applications": {
        columns = [
          { key: "reference", label: "Application" },
          { key: "customer", label: "Customer" },
          { key: "product", label: "Product" },
          { key: "country", label: "Country" },
          { key: "status", label: "Status" },
          { key: "decision", label: "Decision" },
          { key: "submitted", label: "Submitted" },
          { key: "decided", label: "Decided" },
        ];
        rows = snapshot.applications
          .filter(
            (app) =>
              inRange(app.submittedAt ?? app.createdAt) &&
              (!countryFilter || app.country === countryFilter) &&
              (!productFilter || app.productId === productFilter),
          )
          .map((app) => ({
            reference: app.reference,
            customer: names.get(app.customerUserId) ?? "Customer",
            product: app.productName,
            country: app.country,
            status: app.status,
            decision: app.decision ?? "-",
            submitted: app.submittedAt ? new Date(app.submittedAt).toISOString().slice(0, 10) : "-",
            decided: app.decidedAt ? new Date(app.decidedAt).toISOString().slice(0, 10) : "-",
          }));
        totals = {
          applications: rows.length,
          approved: rows.filter((row) => row.decision === "approved").length,
          declined: rows.filter((row) => row.decision === "declined").length,
        };
        basis = "Applications by submission date (drafts use creation date).";
        break;
      }
      case "claims": {
        columns = [
          { key: "reference", label: "Claim" },
          { key: "customer", label: "Customer" },
          { key: "product", label: "Product" },
          { key: "status", label: "Status" },
          { key: "claimed", label: "Claimed" },
          { key: "approved", label: "Approved" },
          { key: "currency", label: "Currency" },
          { key: "reported", label: "Reported" },
        ];
        rows = snapshot.claims
          .filter(
            (claim) =>
              inRange(claim.reportedAt) &&
              (!countryFilter || claim.country === countryFilter) &&
              (!productFilter || claim.productId === productFilter),
          )
          .map((claim) => ({
            reference: claim.reference,
            customer: names.get(claim.customerUserId) ?? "Customer",
            product: claim.productName,
            status: claim.status,
            claimed: claim.amountClaimed / 100,
            approved: (claim.approvedAmount ?? 0) / 100,
            currency: claim.currency,
            reported: new Date(claim.reportedAt).toISOString().slice(0, 10),
          }));
        const claimedBy = new Map<string, number>();
        const approvedBy = new Map<string, number>();
        for (const claim of snapshot.claims.filter(
          (item) =>
            inRange(item.reportedAt) &&
            (!countryFilter || item.country === countryFilter) &&
            (!productFilter || item.productId === productFilter),
        )) {
          claimedBy.set(claim.currency, (claimedBy.get(claim.currency) ?? 0) + claim.amountClaimed / 100);
          approvedBy.set(claim.currency, (approvedBy.get(claim.currency) ?? 0) + (claim.approvedAmount ?? 0) / 100);
        }
        totals = {
          claims: rows.length,
          claimedByCurrency: [...claimedBy.entries()].map(([c, a]) => `${c} ${a.toLocaleString()}`).join(" · "),
          approvedByCurrency: [...approvedBy.entries()].map(([c, a]) => `${c} ${a.toLocaleString()}`).join(" · "),
        };
        basis = "Claims by report date. Approved amounts reflect recorded decisions, not settled payments.";
        break;
      }
      case "premiums":
      case "outstanding":
      case "refunds": {
        const status = args.report === "outstanding" ? "pending" : "succeeded";
        const type =
          args.report === "refunds" ? "refund" : args.report === "premiums" ? "premium" : "premium";
        columns = [
          { key: "reference", label: "Transaction" },
          { key: "customer", label: "Customer" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount" },
          { key: "currency", label: "Currency" },
          { key: "method", label: "Method" },
          { key: "created", label: "Date" },
        ];
        rows = snapshot.transactions
          .filter((tx) => tx.type === type && tx.status === status && inRange(tx.createdAt))
          .map((tx) => ({
            reference: tx.reference,
            customer: names.get(tx.customerUserId) ?? "Customer",
            type: tx.type,
            status: tx.status,
            amount: tx.amount / 100,
            currency: tx.currency,
            method: tx.method,
            created: new Date(tx.createdAt).toISOString().slice(0, 10),
          }));
        const byCurrency = new Map<string, number>();
        for (const tx of snapshot.transactions.filter(
          (item) => item.type === type && item.status === status && inRange(item.createdAt),
        )) {
          byCurrency.set(tx.currency, (byCurrency.get(tx.currency) ?? 0) + tx.amount / 100);
        }
        totals = {
          transactions: rows.length,
          byCurrency: [...byCurrency.entries()]
            .map(([c, a]) => `${c} ${a.toLocaleString()}`)
            .join(" · "),
        };
        basis =
          args.report === "outstanding"
            ? "Pending premium invoices created in the period. These are not receipts."
            : args.report === "refunds"
              ? "Recorded refunds. Refunds are not netted against premium receipts."
              : "Confirmed premium receipts only. Transactions remain separated by currency.";
        break;
      }
      case "renewals": {
        columns = [
          { key: "policyNumber", label: "Policy" },
          { key: "customer", label: "Customer" },
          { key: "product", label: "Product" },
          { key: "status", label: "Status" },
          { key: "endDate", label: "End date" },
          { key: "renewalDate", label: "Renewal date" },
          { key: "premium", label: "Premium" },
          { key: "currency", label: "Currency" },
        ];
        rows = snapshot.policies
          .filter(
            (policy) =>
              policy.endDate >= from &&
              policy.endDate <= to + 90 * DAY &&
              (!countryFilter || policy.country === countryFilter) &&
              (!productFilter || policy.productId === productFilter),
          )
          .sort((a, b) => a.endDate - b.endDate)
          .map((policy) => ({
            policyNumber: policy.policyNumber,
            customer: names.get(policy.customerUserId) ?? "Customer",
            product: policy.productName,
            status: policy.status,
            endDate: new Date(policy.endDate).toISOString().slice(0, 10),
            renewalDate: new Date(policy.renewalDate).toISOString().slice(0, 10),
            premium: policy.premium / 100,
            currency: policy.currency,
          }));
        totals = { policies: rows.length };
        basis = "Policies whose end date falls in the period (plus the next 90 days).";
        break;
      }
      case "broker_activity": {
        columns = [
          { key: "broker", label: "Brokerage" },
          { key: "contact", label: "Contact" },
          { key: "status", label: "Status" },
          { key: "customers", label: "Assigned customers" },
          { key: "quotes", label: "Quotations" },
          { key: "applications", label: "Applications" },
          { key: "policies", label: "Policies" },
          { key: "commission", label: "Commission (est.)" },
        ];
        rows = snapshot.brokers.map((broker) => {
          const assigned = snapshot.assignments.filter(
            (assignment) =>
              assignment.brokerUserId === broker.userId && assignment.status === "active",
          ).length;
          const apps = snapshot.applications.filter(
            (app) => app.brokerUserId === broker.userId && inRange(app.createdAt),
          );
          const brokerPolicies = snapshot.policies.filter(
            (policy) => policy.brokerUserId === broker.userId && inRange(policy.startDate),
          );
          const commission = settings.commissionEnabled && broker.commissionEnabled
            ? brokerPolicies
                .filter((policy) => policy.status === "active")
                .reduce((total, policy) => total + Math.round(policy.premium * (broker.commissionRate / 100)), 0) / 100
            : 0;
          return {
            broker: broker.orgName,
            contact: broker.contactName,
            status: broker.status,
            customers: assigned,
            quotes: snapshot.quotes.filter(
              (quote) => quote.brokerUserId === broker.userId && inRange(quote.createdAt),
            ).length,
            applications: apps.length,
            policies: brokerPolicies.length,
            commission: commission.toLocaleString(),
          };
        });
        totals = { brokers: rows.length };
        basis =
          "Broker activity by record creation date. Commission uses the recorded, versioned broker rate and confirmed policy premiums; it is an estimate, not a payment run.";
        break;
      }
      case "staff_workload": {
        columns = [
          { key: "name", label: "Staff member" },
          { key: "role", label: "Role" },
          { key: "openApplications", label: "Open applications" },
          { key: "openClaims", label: "Open claims" },
          { key: "overdueApplications", label: "Applications over 5 days" },
          { key: "pendingRequests", label: "Policy requests" },
        ];
        rows = snapshot.users
          .filter((user) => user.role === "admin" || user.role === "super_admin")
          .map((user) => {
            const openApps = snapshot.applications.filter(
              (app) =>
                app.assignedTo === user._id &&
                OPEN_APPLICATION_STATUSES.includes(app.status),
            );
            return {
              name: user.name ?? user.email ?? "Staff",
              role: user.role as string,
              openApplications: openApps.length,
              openClaims: snapshot.claims.filter(
                (claim) =>
                  claim.assignedTo === user._id &&
                  OPEN_CLAIM_STATUSES.includes(claim.status),
              ).length,
              overdueApplications: openApps.filter(
                (app) => (app.submittedAt ?? app.createdAt) < now - 5 * DAY,
              ).length,
              pendingRequests: snapshot.requests.filter(
                (request) => request.decidedBy === user._id,
              ).length,
            };
          });
        totals = { staff: rows.length };
        basis = "Live workload per staff member at the time this report was generated.";
        break;
      }
      default:
        throw new Error("Unknown report type.");
    }

    return {
      report: args.report,
      period: { from, to },
      currency: settings.defaultCurrency,
      columns,
      rows,
      totals,
      basis,
      generatedAt: now,
    };
  },
});
