import {
  Callout,
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
  Panel,
  StatusPill,
  TableShell,
  Td,
  Th,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { formatDate, formatMoneyList, daysUntil } from "@/lib/format";
import { useQuery } from "convex/react";
import { Users, Wallet } from "lucide-react";
import { Link } from "react-router";

export function BrokerCustomersPage() {
  const customers = useQuery(api.brokers.myCustomers);
  const commission = useQuery(api.brokers.myProfile);

  if (customers === undefined) return <LoadingState label="Loading your book" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Broker desk"
        title="Your assigned book."
        description="You can only see customers explicitly assigned to your brokerage. Ask an administrator to add or revoke assignments."
        actions={
          <Button asChild className="h-10 rounded-full px-5">
            <Link to="/dashboard/catalogue">Start a quotation</Link>
          </Button>
        }
      />

      {commission?.commissionEnabled && (
        <Callout tone="info" title="Commission">
          {commission.profile.commissionRate}% of confirmed active premium, estimated. Commission is
          never computed from unconfirmed payments.
        </Callout>
      )}

      {customers.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Users}
            title="No customers assigned"
            description="An administrator must assign customers to your brokerage before you can quote or apply on their behalf."
          />
        </Panel>
      ) : (
        <Panel>
          <TableShell>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Country</Th>
                <Th>Active policies</Th>
                <Th>Open applications</Th>
                <Th>Open claims</Th>
                <Th>Next renewal</Th>
                <Th>Commission (est.)</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {customers.map((row) => (
                <tr key={row.assignment._id} className="transition-colors hover:bg-primary/[0.02]">
                  <Td>
                    <p className="text-xs font-medium text-ink">
                      {row.profile?.fullName ?? "Customer"}
                    </p>
                    <p className="text-[0.62rem] text-muted-foreground">
                      {row.profile?.reference ?? "-"} · {row.profile?.email ?? "-"}
                    </p>
                  </Td>
                  <Td>{row.profile?.country ?? "-"}</Td>
                  <Td>{row.activePolicies}</Td>
                  <Td>{row.openApplications}</Td>
                  <Td>{row.openClaims}</Td>
                  <Td>
                    {row.nextRenewal
                      ? `${formatDate(row.nextRenewal)} (${daysUntil(row.nextRenewal)}d)`
                      : "-"}
                  </Td>
                  <Td>
                    {row.commission !== null ? formatMoneyList(row.commission, "None") : "Disabled"}
                  </Td>
                  <Td className="text-right">
                    <Button asChild size="sm" variant="outline" className="h-8 rounded-full bg-transparent px-3">
                      <Link to="/dashboard/quotes">Quote</Link>
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      )}

      <Callout tone="warning" title="Authority limits">
        Brokers create quotations and submit applications with recorded customer consent. Underwriting
        decisions, claim outcomes, pricing changes, and refunds remain with authorised staff.
      </Callout>
    </div>
  );
}

export function BrokerReportsPage() {
  const overview = useQuery(api.reports.overview, {});
  const customers = useQuery(api.brokers.myCustomers);

  if (overview === undefined || overview.kind !== "broker") {
    return <LoadingState label="Loading broker performance" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Broker reporting"
        title="Your activity, measured honestly."
        description="Based on assigned customers, quotations, applications, and confirmed policies. Decisions and payments are made by the insurer."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Assigned customers" value={overview.metrics.assignedCustomers} icon={Users} to="/dashboard/broker/customers" />
        <MetricTile label="Active policies" value={overview.metrics.activePolicies} />
        <MetricTile label="Open quotations" value={overview.metrics.quotes} to="/dashboard/quotes" />
        <MetricTile label="Open applications" value={overview.metrics.openApplications} to="/dashboard/applications" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Commission estimate</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {overview.commissionEnabled
                ? `${overview.commissionRate}% of confirmed active premiums, by currency.`
                : "Commission features are not enabled for your brokerage."}
            </p>
          </div>
          <div className="px-5 py-5">
            {overview.commissionEnabled ? (
              <p className="text-lg font-semibold text-ink">
                {formatMoneyList(overview.commission, "No confirmed premium yet")}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="size-3.5" /> Not applicable
              </p>
            )}
            <p className="mt-2 text-[0.65rem] leading-5 text-muted-foreground">
              Estimates use recorded policy premium and the versioned rate on your broker profile.
              They are not a payment statement or invoice.
            </p>
          </div>
        </Panel>

        <Panel>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Renewal opportunities</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Within the configured reminder window, across your assigned book.
            </p>
          </div>
          {overview.renewals.length === 0 ? (
            <EmptyState icon={Users} title="No renewals due" />
          ) : (
            <ul className="divide-y divide-line">
              {overview.renewals.map((policy) => (
                <li key={policy._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {policy.customerName} · {policy.policyNumber}
                    </p>
                    <p className="text-[0.62rem] text-muted-foreground">
                      {policy.productName} · ends {formatDate(policy.endDate)}
                    </p>
                  </div>
                  <StatusPill status={policy.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Book snapshot</h2>
        </div>
        {customers === undefined ? (
          <LoadingState label="Loading book" />
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No assigned customers" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Active policies</Th>
                <Th>Open applications</Th>
                <Th>Next renewal</Th>
                <Th>Commission (est.)</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((row) => (
                <tr key={row.assignment._id}>
                  <Td>{row.profile?.fullName ?? "Customer"}</Td>
                  <Td>{row.activePolicies}</Td>
                  <Td>{row.openApplications}</Td>
                  <Td>{row.nextRenewal ? formatDate(row.nextRenewal) : "-"}</Td>
                  <Td>{row.commission !== null ? formatMoneyList(row.commission, "None") : "Disabled"}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}
