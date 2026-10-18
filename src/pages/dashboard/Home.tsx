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
  Timeline,
  DateCell,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { formatMoney, formatMoneyList, formatDate, daysUntil } from "@/lib/format";
import { normalizeRole, can, STAFF_PERMISSIONS } from "@/lib/permissions";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Headset,
  LifeBuoy,
  PackageSearch,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const ensureBasics = useMutation(api.setup.ensureBasics);
  const seedCatalogue = useMutation(api.setup.seedStarterCatalogue);
  const [days, setDays] = useState(30);

  useEffect(() => {
    ensureBasics().catch(() => {
      // Reference data seeding is best-effort; actions still surface errors.
    });
  }, [ensureBasics]);

  const from = useMemo(() => Date.now() - days * 24 * 60 * 60 * 1000, [days]);
  const overview = useQuery(api.reports.overview, { from });

  if (overview === undefined) {
    return <LoadingState label="Loading your dashboard" />;
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
          eyebrow={<>Member vault · {formatDate(Date.now())}</>}
          title={`${greeting}, ${firstName}.`}
          description="Everything you're protecting, and every request in flight - reviewed by a person, never auto-approved."
          actions={
            <Button asChild className="h-10 rounded-full px-5">
              <Link to="/dashboard/catalogue">
                Browse products <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          }
        />

        {overview.infoRequests.length > 0 && (
          <Callout tone="warning" title="We need something from you">
            {overview.infoRequests.length} request{overview.infoRequests.length === 1 ? "" : "s"} are
            waiting for information.{" "}
            <Link to="/dashboard/applications" className="font-medium text-primary underline-offset-2 hover:underline">
              Open applications
            </Link>{" "}
            or{" "}
            <Link to="/dashboard/claims" className="font-medium text-primary underline-offset-2 hover:underline">
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
            helper={overview.metrics.pendingRequests ? `${overview.metrics.pendingRequests} servicing request(s) pending` : "Across all currencies"}
            icon={CircleDollarSign}
            to="/dashboard/payments"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <Panel>
            <PanelHeader
              title="Your policies"
              description="Cover, premium, and dates. Documents live in your library."
              action={
                <Link to="/dashboard/policies" className="text-xs font-medium text-primary">
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
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/dashboard/catalogue">Browse products</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {overview.recentPolicies.map((policy) => (
                  <li key={policy._id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{policy.productName}</p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {policy.policyNumber} · renews {formatDate(policy.endDate)}
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
            {overview.renewals.length === 0 && overview.infoRequests.length === 0 ? (
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
                      <p className="text-xs font-medium text-ink">{policy.policyNumber}</p>
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
                <Link to="/dashboard/documents" className="text-xs font-medium text-primary">
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
                    <p className="truncate text-xs font-medium text-ink">{document.name}</p>
                    <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                      {document.category} · {formatDate(document.issuedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Recent claims" description="Outcomes are recorded by authorised handlers." />
            {overview.recentClaims.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No claims"
                description="If something happens, submit a claim against an active policy. Submitting does not confirm cover."
                action={
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/dashboard/claims">Submit a claim</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {overview.recentClaims.map((claim) => (
                  <li key={claim._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">{claim.reference}</p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {claim.productName} · reported {formatDate(claim.reportedAt)}
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
            { label: "Get a quotation", to: "/dashboard/catalogue", Icon: PackageSearch },
            { label: "Pay premium", to: "/dashboard/payments", Icon: CircleDollarSign },
            { label: "Submit a claim", to: "/dashboard/claims", Icon: LifeBuoy },
            { label: "Talk to support", to: "/dashboard/support", Icon: Headset },
          ].map(({ label, to, Icon }) => (
            <Link
              key={to}
              to={to}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-primary/40"
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
          eyebrow={<>Broker desk · {formatDate(Date.now())}</>}
          title={`${greeting}, ${firstName}.`}
          description="Your assigned book only. Underwriting and claims decisions stay with authorised staff."
        />
        {!overview.profile && (
          <Callout tone="warning" title="Broker profile pending">
            Your account has broker access but no brokerage profile yet. Ask an administrator to
            complete your profile before submitting business.
          </Callout>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Assigned customers" value={overview.metrics.assignedCustomers} icon={Users} to="/dashboard/broker/customers" />
          <MetricTile label="Active policies" value={overview.metrics.activePolicies} icon={ShieldCheck} to="/dashboard/policies" />
          <MetricTile label="Open applications" value={overview.metrics.openApplications} icon={ClipboardList} to="/dashboard/applications" />
          <MetricTile label="Open quotations" value={overview.metrics.quotes} icon={Store} to="/dashboard/quotes" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Renewal opportunities" description="Within the configured reminder window." />
            {overview.renewals.length === 0 ? (
              <EmptyState icon={BadgeCheck} title="No renewals due soon" />
            ) : (
              <ul className="divide-y divide-line">
                {overview.renewals.map((policy) => (
                  <li key={policy._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {policy.customerName} · {policy.policyNumber}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {policy.productName} · ends {formatDate(policy.endDate)} ({daysUntil(policy.endDate)} days)
                      </p>
                    </div>
                    <StatusPill status={policy.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader title="Commission" description="Versioned rate applied to confirmed active premiums." />
            <div className="px-5 py-6">
              {overview.commissionEnabled ? (
                <>
                  <MoneyByCurrency values={overview.commission} empty="No active premium yet" />
                  <p className="mt-2 text-[0.68rem] text-muted-foreground">
                    Rate {overview.commissionRate}% · estimate only, not a payment statement.
                  </p>
                </>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Commission features are disabled for this brokerage or by company policy.
                </p>
              )}
            </div>
          </Panel>
        </div>
        <Panel>
          <PanelHeader
            title="Recent applications in your book"
            description="You can see status, but decisions are made by staff."
            action={<Link to="/dashboard/applications" className="text-xs font-medium text-primary">View all</Link>}
          />
          {overview.recentApplications.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No applications yet"
              description="Start with a quotation for an assigned customer."
              action={<Button asChild size="sm" className="rounded-full"><Link to="/dashboard/catalogue">Start a quotation</Link></Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {overview.recentApplications.map((application) => (
                <li key={application._id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {application.reference} · {application.customerName}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{application.productName}</p>
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

  const canSeed = can(role, user?.permissions, STAFF_PERMISSIONS.PRODUCTS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<>Operations · {formatDate(Date.now())}</>}
        title={`${greeting}, ${firstName}.`}
        description="Live operational picture from the database. Every card opens the underlying records."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="period" className="text-xs text-muted-foreground">
              Period
            </label>
            <select
              id="period"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-9 rounded-full border border-line bg-card px-3 text-xs text-ink"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>12 months</option>
            </select>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Customers" value={overview.metrics.customers} helper="Registered customer profiles" icon={Users} to="/dashboard/admin/customers" />
        <MetricTile label="Active policies" value={overview.metrics.activePolicies} helper="In force now" icon={ShieldCheck} to="/dashboard/admin/policies?status=active" />
        <MetricTile label="Awaiting underwriting" value={overview.metrics.awaitingApplications} helper="Manual review queue" icon={ClipboardList} to="/dashboard/admin/applications?status=submitted" />
        <MetricTile label="Claims awaiting review" value={overview.metrics.claimsAwaiting} helper={`${overview.metrics.claimsInfoRequired} awaiting customer info`} icon={LifeBuoy} to="/dashboard/admin/claims" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Premium received"
          value={<MoneyByCurrency values={overview.money.premiumReceived} empty="-" />}
          helper={`Confirmed in the last ${days} days · by currency`}
          icon={CircleDollarSign}
          to="/dashboard/admin/payments?status=succeeded"
        />
        <MetricTile
          label="Outstanding premiums"
          value={<MoneyByCurrency values={overview.money.outstanding} empty="-" />}
          helper="Pending invoices, not receipts"
          icon={FileWarning}
          to="/dashboard/admin/payments?status=pending"
        />
        <MetricTile
          label="Claims settled"
          value={<MoneyByCurrency values={overview.money.settlements} empty="-" />}
          helper={`${overview.metrics.claimsPaid} paid in period`}
          icon={BadgeCheck}
          to="/dashboard/admin/claims?status=paid"
        />
        <MetricTile label="Policies expiring" value={overview.metrics.policiesExpiringSoon} helper="Within the renewal reminder window" icon={AlertTriangle} to="/dashboard/admin/policies?expiring=1" />
      </div>

      {!canSeed ? null : overview.metrics.activePolicies === 0 ? (
        <Callout tone="info" title="Set up your catalogue">
          Products are configured and published by staff before customers can buy. Load the starter
          catalogue to review, edit, and publish real product records - or create your own from
          Products.
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full"
              onClick={async () => {
                try {
                  const result = await seedCatalogue();
                  toast.success(
                    result.created
                      ? `${result.created} starter products created and published.`
                      : "Starter products already exist.",
                  );
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not seed the catalogue.");
                }
              }}
            >
              Load starter catalogue
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/dashboard/admin/products">Manage products</Link>
            </Button>
          </div>
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Panel>
          <PanelHeader title="Operational alerts" description="Overdue work is highlighted, never hidden." />
          <div className="divide-y divide-line">
            {overview.alerts.map((alert) => (
              <Link key={alert.key} to={alert.href} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-primary/[0.03]">
                <div className="flex items-center gap-3">
                  <span
                    className={
                      alert.severity === "critical"
                        ? "size-2 rounded-full bg-destructive"
                        : alert.severity === "warning"
                          ? "size-2 rounded-full bg-amber-500"
                          : "size-2 rounded-full bg-emerald-500"
                    }
                  />
                  <p className="text-xs font-medium text-ink">{alert.label}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{alert.count}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent customers" action={<Link to="/dashboard/admin/customers" className="text-xs font-medium text-primary">Directory</Link>} />
          {overview.recentCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" />
          ) : (
            <ul className="divide-y divide-line">
              {overview.recentCustomers.map((profile) => (
                <li key={profile._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">{profile.fullName}</p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {profile.reference} · {profile.country}
                    </p>
                  </div>
                  <DateCell value={profile.createdAt} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Panel>
          <PanelHeader title="Recent policies" action={<Link to="/dashboard/admin/policies" className="text-xs font-medium text-primary">Policy register</Link>} />
          {overview.recentPolicies.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No policies issued yet" />
          ) : (
            <ul className="divide-y divide-line">
              {overview.recentPolicies.map((policy) => (
                <li key={policy._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {policy.policyNumber} · {policy.customerName}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {policy.productName} · {formatMoney(policy.premium, policy.currency)}
                    </p>
                  </div>
                  <StatusPill status={policy.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Recent administrative activity" description="Audit trail entries visible to your permissions." />
          <div className="px-5 py-5">
            <Timeline
              items={overview.recentActivity.map((entry) => ({
                body: entry.action.replace(/[._]/g, " "),
                at: entry.at,
                internal: false,
              }))}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
