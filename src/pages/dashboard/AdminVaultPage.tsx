import {
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
  Panel,
  StatusPill,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignMineralDialog } from "@/components/vault/AssignMineralDialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { useAuth } from "@/hooks/use-auth";
import { downloadCsv, formatDate, formatMoney, formatMoneyList } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useQuery } from "convex/react";
import {
  ArrowRightLeft,
  Download,
  Gem,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type SortKey = "value_desc" | "updated_desc" | "name_asc" | "owner_asc";
type InsuranceFilter = "all" | "active" | "none" | "expired";
type ShippingFilter = "all" | "in_vault" | ShipmentStatus;

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

/**
 * The staff vault floor, backed by the live mineral register.
 *
 * Ownership is held on the mineral, so assigning a record here carries its
 * insurance policy and every shipment with it. The server audits the move,
 * emails the new owner and notifies the previous one.
 */
export default function AdminVaultPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const canManage = can(
    user?.role,
    user?.permissions,
    STAFF_PERMISSIONS.POLICIES_MANAGE,
  );
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [insurance, setInsurance] = useState<InsuranceFilter>("all");
  const [shipping, setShipping] = useState<ShippingFilter>("all");
  const [sort, setSort] = useState<SortKey>("value_desc");
  const [assigningId, setAssigningId] = useState<Id<"minerals"> | null>(null);

  const rows = useQuery(api.minerals.list, canManage ? {} : "skip");

  const owners = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string }>();
    for (const row of rows ?? []) {
      if (!row.assignee || map.has(row.assignee._id)) continue;
      map.set(row.assignee._id, {
        id: row.assignee._id,
        name: row.assignee.name,
        email: row.assignee.email,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => {
        if (owner === "unassigned" && row.mineral.assignedUserId) return false;
        if (
          owner !== "all" &&
          owner !== "unassigned" &&
          row.mineral.assignedUserId !== owner
        ) {
          return false;
        }
        if (insurance === "none" && row.policy) return false;
        if (insurance === "active" && row.policy?.status !== "active")
          return false;
        if (insurance === "expired" && row.policy?.status !== "expired")
          return false;
        if (shipping === "in_vault" && row.shipment) return false;
        if (
          shipping !== "all" &&
          shipping !== "in_vault" &&
          row.shipment?.status !== shipping
        ) {
          return false;
        }
        if (!query) return true;
        return [
          row.mineral.name,
          row.mineral.reference,
          row.mineral.category,
          row.assignee?.name ?? "",
          row.assignee?.email ?? "",
          row.policy?.policyNumber ?? "",
          row.shipment?.reference ?? "",
          row.shipment?.trackingNumber ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sort === "name_asc")
          return a.mineral.name.localeCompare(b.mineral.name);
        if (sort === "owner_asc")
          return (a.assignee?.name ?? "").localeCompare(
            b.assignee?.name ?? "",
          );
        if (sort === "updated_desc") return b.mineral.updatedAt - a.mineral.updatedAt;
        return b.mineral.declaredValue - a.mineral.declaredValue;
      });
  }, [insurance, owner, rows, search, shipping, sort]);

  const metrics = useMemo(() => {
    const list = rows ?? [];
    const insured = list.filter((row) => row.policy?.status === "active");
    const byCurrency = new Map<string, number>();
    for (const row of insured) {
      if (!row.policy) continue;
      byCurrency.set(
        row.policy.currency,
        (byCurrency.get(row.policy.currency) ?? 0) + row.policy.coverageLimit,
      );
    }
    return {
      stored: list.length,
      insuredCount: insured.length,
      insuredValue: [...byCurrency.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      activeShipments: list.filter(
        (row) =>
          row.shipment &&
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
      pendingShipments: list.filter(
        (row) => row.shipment?.status === "preparing",
      ).length,
      clients: new Set(
        list.flatMap((row) => (row.assignee ? [row.assignee._id] : [])),
      ).size,
    };
  }, [rows]);

  const assigning =
    (rows ?? []).find((row) => row.mineral._id === assigningId) ?? null;

  const exportRegister = () => {
    downloadCsv(
      "cosmic-vault-register.csv",
      [
        { key: "mineral", label: "Mineral" },
        { key: "reference", label: "Reference" },
        { key: "category", label: "Category" },
        { key: "quantity", label: "Quantity" },
        { key: "value", label: "Declared value" },
        { key: "currency", label: "Currency" },
        { key: "owner", label: "Owner" },
        { key: "email", label: "Owner email" },
        { key: "policy", label: "Policy number" },
        { key: "coverage", label: "Coverage" },
        { key: "coverLimit", label: "Cover limit" },
        { key: "policyStatus", label: "Policy status" },
        { key: "shipment", label: "Shipment reference" },
        { key: "carrier", label: "Carrier" },
        { key: "tracking", label: "Tracking number" },
        { key: "shipping", label: "Shipping status" },
        { key: "updated", label: "Updated" },
      ],
      filtered.map((row) => ({
        mineral: row.mineral.name,
        reference: row.mineral.reference,
        category: row.mineral.category,
        quantity: `${row.mineral.quantity} ${row.mineral.unit}`,
        value: row.mineral.declaredValue,
        currency: row.mineral.currency,
        owner: row.assignee?.name ?? "Unassigned",
        email: row.assignee?.email ?? "",
        policy: row.policy?.policyNumber ?? "None",
        coverage: row.policy
          ? (COVERAGE_LABELS[row.policy.coverage] ?? row.policy.coverage)
          : "",
        coverLimit: row.policy?.coverageLimit ?? "",
        policyStatus: row.policy?.status ?? "",
        shipment: row.shipment?.reference ?? "",
        carrier: row.shipment?.carrier ?? "",
        tracking: row.shipment?.trackingNumber ?? "",
        shipping: row.shipment
          ? SHIPMENT_STATUS_LABELS[row.shipment.status]
          : "In vault",
        updated: formatDate(row.mineral.updatedAt),
      })),
    );
    toast.success("Vault register exported.");
  };

  if (authLoading) return <LoadingState label="Loading the vault" />;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vault operations"
          title="The vault floor."
          description="This ledger reads the live mineral register and is limited to staff who can manage mineral records."
        />
        <Panel>
          <EmptyState
            icon={Gem}
            title="Access restricted"
            description="Ask a super admin to grant you the 'Issue & service policies' permission to view and assign vault records."
          />
        </Panel>
      </div>
    );
  }

  if (rows === undefined) return <LoadingState label="Loading the vault" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            Vault operations
            <span className="size-1 rounded-[4px] bg-primary/60" />
            Live ledger
          </>
        }
        title="The vault floor."
        description="Every mineral in custody with the policy attached to it and the shipment in progress. Assigning a record moves the mineral, its insurance and every consignment to the customer or broker who owns it."
        actions={
          <>
            <Button
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
              onClick={exportRegister}
            >
              <Download className="size-3.5" />
              Export register
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
              onClick={() => navigate("/dashboard/admin/minerals")}
            >
              <Gem className="size-3.5" />
              Mineral register
            </Button>
            <Button
              className="h-10 rounded-[4px] px-4"
              onClick={() => navigate("/dashboard/admin/shipments")}
            >
              <Truck className="size-3.5" />
              Shipment control
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Minerals stored"
          value={metrics.stored}
          helper={`${metrics.clients} ${metrics.clients === 1 ? "client" : "clients"}`}
          icon={Gem}
        />
        <MetricTile
          label="Insured value"
          value={formatMoneyList(metrics.insuredValue, "None")}
          helper={`${metrics.insuredCount} active ${metrics.insuredCount === 1 ? "policy" : "policies"}`}
          icon={ShieldCheck}
        />
        <MetricTile
          label="Active shipments"
          value={metrics.activeShipments}
          helper="Not delivered or cancelled"
          icon={Truck}
        />
        <MetricTile
          label="Pending shipments"
          value={metrics.pendingShipments}
          helper="Awaiting collection or packing"
          icon={PackageCheck}
        />
      </div>

      <Panel>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search all minerals"
              placeholder="Search mineral, owner, policy or tracking number"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="h-9 max-w-[190px] rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All clients</option>
              <option value="unassigned">Unassigned</option>
              {owners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by insurance"
              value={insurance}
              onChange={(event) =>
                setInsurance(event.target.value as InsuranceFilter)
              }
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All insurance</option>
              <option value="active">Insured</option>
              <option value="none">No policy</option>
              <option value="expired">Expired</option>
            </select>
            <select
              aria-label="Filter by shipping"
              value={shipping}
              onChange={(event) =>
                setShipping(event.target.value as ShippingFilter)
              }
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All shipping</option>
              <option value="in_vault">In vault</option>
              {SHIPMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SHIPMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort minerals"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="value_desc">Value · high to low</option>
              <option value="updated_desc">Recently updated</option>
              <option value="name_asc">Name · A to Z</option>
              <option value="owner_asc">Owner · A to Z</option>
            </select>
          </div>
        </div>

        <div className="border-b border-line bg-ice/20 px-4 py-2 text-[0.6rem] text-muted-foreground">
          {filtered.length} of {rows.length} records · assigning a record moves
          its policy and shipments with it
        </div>

        <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_130px_130px_110px_90px] gap-3 border-b border-line px-5 py-2.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
          <span>Mineral</span>
          <span>Owner</span>
          <span className="text-right">Value</span>
          <span>Insurance</span>
          <span>Shipping</span>
          <span>Updated</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="No records match."
            description="Adjust the filters or search a different owner, policy or tracking number."
            action={
              <Button
                size="sm"
                variant="outline"
                className="rounded-[4px] bg-transparent"
                onClick={() => {
                  setSearch("");
                  setOwner("all");
                  setInsurance("all");
                  setShipping("all");
                }}
              >
                Show every record
              </Button>
            }
          />
        ) : (
          <div>
            {filtered.map((row) => {
              const { mineral, policy, shipment, assignee } = row;
              return (
                <article
                  key={mineral._id}
                  className="grid gap-3 border-b border-line/70 px-4 py-3.5 last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_130px_130px_110px_90px] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                      {mineral.name}
                    </p>
                    <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                      {mineral.reference} · {mineral.category} ·{" "}
                      {mineral.quantity.toLocaleString("en-GB")} {mineral.unit}
                    </p>
                  </div>

                  <div className="min-w-0">
                    {assignee ? (
                      <>
                        <p className="truncate text-[0.68rem] font-medium text-ink">
                          {assignee.name}
                        </p>
                        <p className="truncate text-[0.58rem] text-muted-foreground">
                          {assignee.email}
                        </p>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[0.58rem] font-semibold text-amber-700 dark:text-amber-400">
                        <UserRoundPlus className="size-3" />
                        Unassigned
                      </span>
                    )}
                  </div>

                  <div className="lg:text-right">
                    <p className="text-[0.7rem] font-semibold tabular-nums text-ink">
                      {formatMoney(mineral.declaredValue, mineral.currency)}
                    </p>
                    <p className="mt-0.5 text-[0.55rem] text-muted-foreground lg:hidden">
                      Declared value
                    </p>
                  </div>

                  <div className="min-w-0">
                    {policy ? (
                      <span className="flex items-center gap-2">
                        <StatusPill status={policy.status} />
                        <span className="truncate text-[0.58rem] text-muted-foreground">
                          {policy.policyNumber}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex rounded-[4px] border border-line bg-muted/60 px-2 py-0.5 text-[0.6rem] font-semibold text-muted-foreground">
                        No policy
                      </span>
                    )}
                    {policy && (
                      <p className="mt-0.5 truncate text-[0.55rem] text-muted-foreground">
                        {COVERAGE_LABELS[policy.coverage] ?? policy.coverage} ·
                        ends {formatDate(policy.endDate)}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    {shipment ? (
                      <>
                        <StatusPill status={shipment.status} />
                        <p className="mt-0.5 truncate text-[0.55rem] text-muted-foreground">
                          {shipment.reference} · {shipment.origin} →{" "}
                          {shipment.destination}
                        </p>
                      </>
                    ) : (
                      <span className="inline-flex rounded-[4px] border border-line bg-muted/60 px-2 py-0.5 text-[0.6rem] font-semibold text-muted-foreground">
                        In vault
                      </span>
                    )}
                  </div>

                  <p className="text-[0.6rem] text-muted-foreground">
                    {formatDate(mineral.updatedAt)}
                  </p>

                  <div className="lg:text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-[4px] bg-transparent px-2.5 text-[0.62rem]"
                      onClick={() => setAssigningId(mineral._id)}
                    >
                      <ArrowRightLeft className="size-3" />
                      {assignee ? "Reassign" : "Assign"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <p className="px-1 text-[0.6rem] leading-5 text-muted-foreground">
        Ownership is held on the mineral, so the insurance policy and every
        shipment attached to it travel with the record. Each assignment is
        written to the audit log, the new owner is emailed and the previous owner
        is told in-app. Nothing leaves the vault without a record of who moved
        it.
      </p>

      <AssignMineralDialog
        key={assigning?.mineral._id ?? "none"}
        open={Boolean(assigning)}
        onOpenChange={(open) => !open && setAssigningId(null)}
        mineralId={assigning?.mineral._id ?? null}
        mineralName={assigning?.mineral.name ?? ""}
        mineralReference={assigning?.mineral.reference ?? ""}
        currentAssigneeId={assigning?.mineral.assignedUserId}
        shipmentCount={assigning?.shipment ? 1 : 0}
      />
    </div>
  );
}
