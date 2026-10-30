import { CommandCentre } from "@/components/dashboard/CommandCentre";
import {
  CommandCentreSkeleton,
  DashboardSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import {
  Callout,
  EmptyState,
  LoadingState,
  MetricTile,
  MoneyByCurrency,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OperationsOverview } from "@/components/vault/OperationsOverview";
import { VaultHomeBand } from "@/components/vault/VaultHomeBand";
import { useAuth } from "@/hooks/use-auth";
import { useVaultActor } from "@/lib/vault/useVault";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { formatMoney, formatMoneyList, formatDate, daysUntil } from "@/lib/format";
import {
  STAFF_PERMISSIONS,
  can,
  isStaff,
  normalizeRole,
} from "@/lib/permissions";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Headset,
  LifeBuoy,
  Loader2,
  PackageSearch,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { actor: vaultActor } = useVaultActor();
  const role = normalizeRole(user?.role);
  const staff = isStaff(role);
  const canManageMinerals = can(
    user?.role,
    user?.permissions,
    STAFF_PERMISSIONS.POLICIES_MANAGE,
  );
  /* A guest can preview the vault from the operations side. Its home belongs to
     the vault, not to the insurance-wide Command Centre, which remains for
     signed-in staff with real permissions. */
  const demoOperations = Boolean(user?.isAnonymous) && vaultActor.role === "admin";
  const skipCustomerOverview = staff || demoOperations;
  const ensureBasics = useMutation(api.setup.ensureBasics);
  const [days] = useState(30);
  const [months, setMonths] = useState(6);
  const [renewalFor, setRenewalFor] = useState<{
    id: Id<"policies">;
    policyNumber: string;
    productName: string;
  } | null>(null);

  useEffect(() => {
    ensureBasics().catch(() => {
      // Reference data seeding is best-effort; actions still surface errors.
    });
  }, [ensureBasics]);

  const from = useMemo(
    () => new Date().getTime() - days * 24 * 60 * 60 * 1000,
    [days],
  );
  const overview = useQuery(
    api.reports.overview,
    skipCustomerOverview ? "skip" : { from },
  );
  // One snapshot serves both ranges, so 6M/12M switches without a refetch.
  const board = useQuery(api.reports.board, staff ? { months: 12 } : "skip");
  /* Reading the support queue needs the permission that opens it; the alert is
     simply absent for staff without it, rather than a failed query. */
  const canViewSupport = can(
    user?.role,
    user?.permissions,
    STAFF_PERMISSIONS.CUSTOMERS_VIEW,
  );
  const supportQueue = useQuery(
    api.tickets.queueSummary,
    staff && canViewSupport ? {} : "skip",
  );

  if (demoOperations) return <OperationsOverview />;

  if (staff) {
    if (board === undefined) return <CommandCentreSkeleton />;
    return (
      <CommandCentre
        board={board}
        months={months}
        onMonthsChange={setMonths}
        userName={user?.name}
        canManageMinerals={canManageMinerals}
        supportAlert={supportQueue}
      />
    );
  }

  if (overview === undefined) {
    return <DashboardSkeleton />;
  }

  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const firstName = (user?.name ?? "there").split(" ")[0];

  if (overview.kind === "customer") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={<>Member vault · {formatDate(new Date().getTime())}</>}
          title={`${greeting}, ${firstName}.`}
          description="Everything you're protecting, and every request in flight - reviewed by a person, never auto-approved."
          actions={
            <Button asChild className="h-10 rounded-[4px] px-5">
              <Link to="/dashboard/vault">
                Open my vault <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          }
        />

        <VaultHomeBand />

        {overview.infoRequests.length > 0 && (
          <Callout tone="warning" title="We need something from you">
            {overview.infoRequests.length} request
            {overview.infoRequests.length === 1 ? "" : "s"} are waiting for
            information.{" "}
            <Link
              to="/dashboard/applications"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Open applications
            </Link>{" "}
            or{" "}
            <Link
              to="/dashboard/claims"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              claims
            </Link>
            .
          </Callout>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Active policies"
            value={overview.metrics.activePolicies}
            helper="Currently in force"
            icon={ShieldCheck}
            to="/dashboard/policies"
          />
          <MetricTile
            label="Applications in review"
            value={overview.metrics.pendingApplications}
            helper="Manual underwriting"
            icon={ClipboardList}
            to="/dashboard/applications"
          />
          <MetricTile
            label="Open claims"
            value={overview.metrics.openClaims}
            helper="Decisions and settlement tracked separately"
            icon={LifeBuoy}
            to="/dashboard/claims"
          />
          <MetricTile
            label="Outstanding premium"
            value={formatMoneyList(overview.outstanding, "Nothing due")}
            helper={
              overview.metrics.pendingRequests
                ? `${overview.metrics.pendingRequests} servicing request(s) pending`
                : "Across all currencies"
            }
            icon={CircleDollarSign}
            to="/dashboard/payments"
          />
        </div>

        {overview.lapsedCover.length > 0 && (
          <Panel>
            <PanelHeader
              title="Cover no longer in force"
              description="Expired, suspended, or cancelled cover. Renewal never happens automatically - ask us before you rely on this protection."
              action={
                <Link
                  to="/dashboard/policies"
                  className="text-xs font-medium text-primary"
                >
                  Review policies
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {overview.lapsedCover.map((policy) => (
                <li
                  key={policy._id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {policy.productName}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {policy.categoryKey === "mineral" ? "Vault cover · " : ""}
                      {policy.policyNumber} · term to {formatDate(policy.endDate)}
                      {policy.suspensionReason
                        ? ` · ${policy.suspensionReason}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={policy.status} />
                    {policy.renewalRequested ? (
                      <span className="text-[0.62rem] font-medium text-muted-foreground">
                        Renewal requested
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-[4px] bg-transparent text-xs"
                        onClick={() =>
                          setRenewalFor({
                            id: policy._id,
                            policyNumber: policy.policyNumber,
                            productName: policy.productName,
                          })
                        }
                      >
                        Request renewal
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {renewalFor && (
          <RenewalDialog
            policy={renewalFor}
            onClose={() => setRenewalFor(null)}
          />
        )}

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Panel>
            <PanelHeader
              title="Your policies"
              description="Cover, premium, and dates. Documents live in your library."
              action={
                <Link
                  to="/dashboard/policies"
                  className="text-xs font-medium text-primary"
                >
                  View all
                </Link>
              }
            />
            {overview.recentPolicies.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No policies yet"
                description="Start with a quotation. An underwriter reviews every application personally before a policy is issued."
                action={
                  <Button asChild size="sm" className="rounded-[4px]">
                    <Link to="/dashboard/catalogue">Browse products</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {overview.recentPolicies.map((policy) => (
                  <li
                    key={policy._id}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {policy.productName}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {policy.policyNumber} · renews{" "}
                        {formatDate(policy.endDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-ink">
                        {formatMoney(policy.premium, policy.currency)}
                      </p>
                      <StatusPill status={policy.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Renewals & requests"
              description="Nothing renews automatically without your response."
            />
            {overview.renewals.length === 0 &&
            overview.infoRequests.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title="Nothing due"
                description="You'll be reminded here and by email before a renewal date."
              />
            ) : (
              <div className="divide-y divide-line">
                {overview.renewals.map((policy) => (
                  <div key={policy._id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-ink">
                        {policy.policyNumber}
                      </p>
                      <span className="text-[0.62rem] font-semibold text-amber-700 dark:text-amber-400">
                        {daysUntil(policy.endDate)} days
                      </span>
                    </div>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      {policy.productName} · ends {formatDate(policy.endDate)}
                    </p>
                  </div>
                ))}
                {overview.infoRequests.map((request) => (
                  <div key={request._id} className="px-5 py-3.5">
                    <p className="text-xs font-medium text-ink">
                      {"reference" in request ? request.reference : "Request"}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      Information required before review can continue.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Panel>
            <PanelHeader
              title="Recent documents"
              description="Certificates, schedules, receipts, and decision letters."
              action={
                <Link
                  to="/dashboard/documents"
                  className="text-xs font-medium text-primary"
                >
                  Library
                </Link>
              }
            />
            {overview.recentDocuments.length === 0 ? (
              <EmptyState icon={FileWarning} title="No documents yet" />
            ) : (
              <ul className="divide-y divide-line">
                {overview.recentDocuments.map((document) => (
                  <li key={document._id} className="px-5 py-3">
                    <p className="truncate text-xs font-medium text-ink">
                      {document.name}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                      {document.category} · {formatDate(document.issuedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent claims"
              description="Outcomes are recorded by authorised handlers."
            />
            {overview.recentClaims.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No claims"
                description="If something happens, submit a claim against an active policy. Submitting does not confirm cover."
                action={
                  <Button asChild size="sm" className="rounded-[4px]">
                    <Link to="/dashboard/claims">Submit a claim</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {overview.recentClaims.map((claim) => (
                  <li
                    key={claim._id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {claim.reference}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {claim.productName} · reported{" "}
                        {formatDate(claim.reportedAt)}
                      </p>
                    </div>
                    <StatusPill status={claim.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            {
              label: "Get a quotation",
              to: "/dashboard/catalogue",
              Icon: PackageSearch,
            },
            {
              label: "Pay premium",
              to: "/dashboard/payments",
              Icon: CircleDollarSign,
            },
            { label: "Submit a claim", to: "/dashboard/claims", Icon: LifeBuoy },
            { label: "Talk to support", to: "/dashboard/support", Icon: Headset },
          ].map(({ label, to, Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex items-center gap-2 rounded-[4px] border border-line bg-card px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-primary/40"
            >
              <Icon className="size-3.5 text-primary" /> {label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (overview.kind === "broker") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={<>Broker desk · {formatDate(new Date().getTime())}</>}
          title={`${greeting}, ${firstName}.`}
          description="Your assigned book only. Underwriting and claims decisions stay with authorised staff."
        />
        {!overview.profile && (
          <Callout tone="warning" title="Broker profile pending">
            Your account has broker access but no brokerage profile yet. Ask an
            administrator to complete your profile before submitting business.
          </Callout>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Assigned customers"
            value={overview.metrics.assignedCustomers}
            icon={Users}
            to="/dashboard/broker/customers"
          />
          <MetricTile
            label="Active policies"
            value={overview.metrics.activePolicies}
            icon={ShieldCheck}
            to="/dashboard/policies"
          />
          <MetricTile
            label="Open applications"
            value={overview.metrics.openApplications}
            icon={ClipboardList}
            to="/dashboard/applications"
          />
          <MetricTile
            label="Open quotations"
            value={overview.metrics.quotes}
            icon={Store}
            to="/dashboard/quotes"
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelHeader
              title="Renewal opportunities"
              description="Within the configured reminder window."
            />
            {overview.renewals.length === 0 ? (
              <EmptyState icon={BadgeCheck} title="No renewals due soon" />
            ) : (
              <ul className="divide-y divide-line">
                {overview.renewals.map((policy) => (
                  <li
                    key={policy._id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {policy.customerName} · {policy.policyNumber}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {policy.productName} · ends{" "}
                        {formatDate(policy.endDate)} (
                        {daysUntil(policy.endDate)} days)
                      </p>
                    </div>
                    <StatusPill status={policy.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader
              title="Commission"
              description="Versioned rate applied to confirmed active premiums."
            />
            <div className="px-5 py-6">
              {overview.commissionEnabled ? (
                <>
                  <MoneyByCurrency
                    values={overview.commission}
                    empty="No active premium yet"
                  />
                  <p className="mt-2 text-[0.68rem] text-muted-foreground">
                    Rate {overview.commissionRate}% · estimate only, not a
                    payment statement.
                  </p>
                </>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Commission features are disabled for this brokerage or by
                  company policy.
                </p>
              )}
            </div>
          </Panel>
        </div>
        <Panel>
          <PanelHeader
            title="Recent applications in your book"
            description="You can see status, but decisions are made by staff."
            action={
              <Link
                to="/dashboard/applications"
                className="text-xs font-medium text-primary"
              >
                View all
              </Link>
            }
          />
          {overview.recentApplications.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No applications yet"
              description="Start with a quotation for an assigned customer."
              action={
                <Button asChild size="sm" className="rounded-[4px]">
                  <Link to="/dashboard/catalogue">Start a quotation</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {overview.recentApplications.map((application) => (
                <li
                  key={application._id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {application.reference} · {application.customerName}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {application.productName}
                    </p>
                  </div>
                  <StatusPill status={application.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    );
  }

  return <LoadingState label="Loading your dashboard" />;
}

/** Asks the servicing team to put lapsed cover back in force. Nothing is
 *  reinstated until a person approves it, so the wording never promises it. */
function RenewalDialog({
  policy,
  onClose,
}: {
  policy: { id: Id<"policies">; policyNumber: string; productName: string };
  onClose: () => void;
}) {
  const requestChange = useMutation(api.policies.requestChange);
  const [details, setDetails] = useState(
    `Please renew my ${policy.productName} cover for a further 12 months.`,
  );
  const [pending, setPending] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[4px] border-line bg-background">
        <DialogHeader>
          <DialogTitle className="tracking-[-0.02em]">Request renewal</DialogTitle>
          <DialogDescription>
            {policy.productName} · {policy.policyNumber}. A person reviews this
            request - cover is not reinstated automatically, and a renewal
            premium only becomes due if it is approved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="renewal-details" className="text-[0.65rem]">
            Anything the team should know?
          </Label>
          <Textarea
            id="renewal-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="min-h-24 rounded-xl bg-card"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-[4px] bg-transparent"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="rounded-[4px]"
              disabled={pending || details.trim().length < 5}
              onClick={async () => {
                setPending(true);
                try {
                  await requestChange({
                    policyId: policy.id,
                    kind: "renewal",
                    details,
                  });
                  toast.success("Renewal request sent to the servicing team.");
                  onClose();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not send the request.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Send request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
