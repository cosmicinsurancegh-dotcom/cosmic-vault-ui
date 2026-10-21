import { EmptyState, PageHeader, Panel } from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminMineralDialog } from "@/components/vault/AdminMineralDialog";
import { MineralVisual } from "@/components/vault/MineralVisual";
import { InsuranceBadge, ShippingStatusBadge } from "@/components/vault/StatusBadges";
import { VaultActivityFeed } from "@/components/vault/VaultActivityFeed";
import { VaultPulse } from "@/components/vault/VaultPulse";
import { VaultSkeleton } from "@/components/vault/VaultSkeleton";
import { downloadCsv, formatDate, formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { resetDemoStore } from "@/lib/vault/store";
import { useVaultActor, useVaultData, useVaultMineral } from "@/lib/vault/useVault";
import type { Mineral } from "@/lib/vault/types";
import {
  INSURANCE_STATUS_META,
  MINERAL_TYPES,
  SHIPPING_STATUSES,
  SHIPPING_STATUS_META,
  formatWeight,
  insuranceStatus,
} from "@/lib/vault/types";
import {
  ArrowUpRight,
  BadgeCheck,
  Download,
  Gem,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

type SortKey = "value_desc" | "updated_desc" | "name_asc" | "owner_asc";

function OperationsBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-primary/20 bg-card text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <div>
          <p className="text-[0.72rem] font-semibold text-ink">
            Operations preview · demonstration data
          </p>
          <p className="mt-0.5 text-[0.64rem] leading-5 text-muted-foreground">
            You are viewing every client record with administrator controls. Changes
            are visible immediately in the member view.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 rounded-[4px] bg-card px-3 text-[0.65rem]"
        onClick={onBack}
      >
        Member view
        <ArrowUpRight className="size-3" />
      </Button>
    </div>
  );
}

function AdminRow({
  mineral,
  onOpen,
}: {
  mineral: Mineral;
  onOpen: (mineral: Mineral) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(mineral)}
      className="group grid w-full gap-3 border-b border-line/70 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-primary/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:px-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_110px_130px_130px_82px] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <MineralVisual
          mineral={mineral}
          className="aspect-square size-11 shrink-0 rounded-[4px]"
          overlay={false}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-ink">{mineral.name}</p>
            {mineral.shipping?.currentStatus === "on_hold" && (
              <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title="Shipment on hold" />
            )}
          </div>
          <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
            {mineral.vaultId} · {mineral.type} · {formatWeight(mineral.weight, mineral.unit)}
          </p>
          <p className="mt-0.5 truncate text-[0.55rem] text-muted-foreground/80">
            {mineral.storageLocation}
          </p>
        </div>
      </div>

      <div className="min-w-0 pl-14 lg:pl-0">
        <p className="truncate text-[0.68rem] font-medium text-ink">
          {mineral.ownerName}
        </p>
        <p className="truncate text-[0.58rem] text-muted-foreground">
          {mineral.ownerEmail}
        </p>
        <p className="mt-0.5 text-[0.52rem] uppercase tracking-[0.1em] text-muted-foreground/75">
          {mineral.ownerReference}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pl-14 lg:block lg:pl-0 lg:text-right">
        <span className="text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Value
        </span>
        <div>
          <p className="text-[0.7rem] font-semibold tabular-nums text-ink">
            {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
          </p>
          <p className="mt-0.5 text-[0.55rem] text-muted-foreground">
            {mineral.category}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pl-14 lg:block lg:pl-0">
        <span className="text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Insurance
        </span>
        <InsuranceBadge mineral={mineral} />
      </div>

      <div className="flex items-center justify-between gap-2 pl-14 lg:block lg:pl-0">
        <span className="text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Shipping
        </span>
        {mineral.shipping ? (
          <ShippingStatusBadge status={mineral.shipping.currentStatus} />
        ) : (
          <span className="inline-flex rounded-[4px] border border-line bg-muted/60 px-2 py-0.5 text-[0.6rem] font-semibold text-muted-foreground">
            In vault
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pl-14 lg:block lg:pl-0 lg:text-right">
        <span className="text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
          Updated
        </span>
        <div>
          <p className="text-[0.6rem] text-muted-foreground">
            {formatDate(mineral.updatedAt)}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[0.58rem] font-semibold text-primary">
            Manage
            <ArrowUpRight className="size-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

export default function AdminVaultPage() {
  const navigate = useNavigate();
  const {
    actor,
    isLoading,
    canSwitchDemoRole,
    setDemoOperations,
  } = useVaultActor();
  const { ready, minerals, metrics, activities } = useVaultData(actor);
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [type, setType] = useState("all");
  const [insurance, setInsurance] = useState("all");
  const [shipping, setShipping] = useState("all");
  const [sort, setSort] = useState<SortKey>("value_desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMineral = useVaultMineral(actor, selectedId);

  const owners = useMemo(
    () =>
      [...new Map(minerals.map((mineral) => [mineral.ownerId, mineral])).values()]
        .map((mineral) => ({
          id: mineral.ownerId,
          name: mineral.ownerName,
          email: mineral.ownerEmail,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [minerals],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = minerals.filter((mineral) => {
      if (owner !== "all" && mineral.ownerId !== owner) return false;
      if (type !== "all" && mineral.type !== type) return false;
      if (insurance !== "all" && insuranceStatus(mineral) !== insurance) return false;
      if (shipping === "in_vault") {
        if (mineral.shipping) return false;
      } else if (
        shipping !== "all" &&
        mineral.shipping?.currentStatus !== shipping
      ) {
        return false;
      }
      if (!query) return true;
      return [
        mineral.name,
        mineral.vaultId,
        mineral.certificateNumber,
        mineral.ownerName,
        mineral.ownerEmail,
        mineral.type,
        mineral.storageLocation,
        mineral.shipping?.trackingNumber ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    return rows.sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "owner_asc") return a.ownerName.localeCompare(b.ownerName);
      if (sort === "updated_desc") return b.updatedAt - a.updatedAt;
      return b.estimatedValue - a.estimatedValue;
    });
  }, [insurance, minerals, owner, search, shipping, sort, type]);

  if (isLoading) return <VaultSkeleton />;
  if (!ready) return <VaultSkeleton />;
  if (actor.role !== "admin") return <Navigate to="/dashboard/vault" replace />;

  const exportRegister = () => {
    downloadCsv(
      "cosmic-vault-admin-register.csv",
      [
        { key: "owner", label: "Owner" },
        { key: "email", label: "Owner email" },
        { key: "vaultId", label: "Vault ID" },
        { key: "name", label: "Mineral" },
        { key: "type", label: "Type" },
        { key: "weight", label: "Weight" },
        { key: "dimensions", label: "Dimensions" },
        { key: "purity", label: "Purity" },
        { key: "value", label: "Appraised value" },
        { key: "currency", label: "Currency" },
        { key: "location", label: "Location" },
        { key: "insurance", label: "Insurance" },
        { key: "policy", label: "Policy number" },
        { key: "shipping", label: "Shipping" },
        { key: "tracking", label: "Tracking number" },
      ],
      filtered.map((mineral) => ({
        owner: mineral.ownerName,
        email: mineral.ownerEmail,
        vaultId: mineral.vaultId,
        name: mineral.name,
        type: mineral.type,
        weight: formatWeight(mineral.weight, mineral.unit),
        dimensions: mineral.dimensions,
        purity: mineral.purity,
        value: mineral.estimatedValue,
        currency: mineral.currency,
        location: mineral.storageLocation,
        insurance: INSURANCE_STATUS_META[insuranceStatus(mineral)].label,
        policy: mineral.insurancePolicy?.policyNumber ?? "None",
        shipping: mineral.shipping
          ? SHIPPING_STATUS_META[mineral.shipping.currentStatus].longLabel
          : "In vault",
        tracking: mineral.shipping?.trackingNumber ?? "",
      })),
    );
    toast.success("Vault register exported.");
  };

  return (
    <div className="space-y-6">
      {canSwitchDemoRole && (
        <OperationsBar
          onBack={() => {
            setDemoOperations(false);
            navigate("/dashboard/vault");
          }}
        />
      )}

      <PageHeader
        eyebrow={
          <>
            Vault operations
            <span className="size-1 rounded-[4px] bg-primary/60" />
            {actor.isDemo ? "Demonstration ledger" : "Live ledger"}
          </>
        }
        title="The vault floor."
        description="Every object in custody, the policy attached to it, and every movement in progress. Client records, insurance assignments and tracking status all live here."
        actions={
          <>
            {actor.isDemo && (
              <Button
                variant="outline"
                className="h-10 rounded-[4px] bg-card px-4"
                onClick={() => {
                  resetDemoStore(actor);
                  toast.success("Demonstration vault reset.");
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset demo
              </Button>
            )}
            <Button
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
              onClick={exportRegister}
            >
              <Download className="size-3.5" />
              Export register
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

      <VaultPulse
        items={[
          {
            label: "Minerals stored",
            value: metrics.holdings,
            helper: `${metrics.clientCount} ${
              metrics.clientCount === 1 ? "client" : "clients"
            } · ${metrics.uninsuredCount} without active cover`,
            icon: Gem,
          },
          {
            label: "Insured value",
            value: formatMoneyValue(metrics.totalInsuredValue, metrics.currency),
            helper: `${metrics.insuredCount} active ${
              metrics.insuredCount === 1 ? "policy" : "policies"
            }`,
            icon: ShieldCheck,
          },
          {
            label: "Active shipments",
            value: metrics.activeShipments,
            helper: `${metrics.onHoldShipments} on hold · ${metrics.deliveredShipments} delivered`,
            icon: Truck,
            tone: metrics.onHoldShipments > 0 ? "warning" : "default",
          },
          {
            label: "Pending shipments",
            value: metrics.pendingShipments,
            helper: "Awaiting collection or packing",
            icon: PackageCheck,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[4px] border border-line bg-card px-4 py-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Appraised book
            </p>
            <Wallet className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">
            {formatMoneyValue(metrics.totalAppraisedValue, metrics.currency)}
          </p>
          <p className="mt-1 text-[0.6rem] text-muted-foreground">
            Across every stored mineral
          </p>
        </div>
        <div className="rounded-[4px] border border-line bg-card px-4 py-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Cover gap
            </p>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">
            {metrics.uninsuredCount} without cover
          </p>
          <p className="mt-1 text-[0.6rem] text-muted-foreground">
            {metrics.uninsuredCount === 0
              ? "Every record has active cover"
              : "Uninsured or awaiting underwriter sign-off"}
          </p>
        </div>
        <div className="rounded-[4px] border border-line bg-card px-4 py-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Delivery complete
            </p>
            <BadgeCheck className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">
            {metrics.deliveredShipments}
          </p>
          <p className="mt-1 text-[0.6rem] text-muted-foreground">
            Shipped / delivered with proof of receipt
          </p>
        </div>
      </div>

      <div className="rounded-[4px] border border-line bg-card">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search all minerals"
              placeholder="Search mineral, owner, vault ID, tracking number"
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
              {owners.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All types</option>
              {MINERAL_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by insurance"
              value={insurance}
              onChange={(event) => setInsurance(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All insurance</option>
              <option value="active">Insured</option>
              <option value="uninsured">Not insured</option>
              <option value="pending">Pending</option>
            </select>
            <select
              aria-label="Filter by shipping"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
              className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
            >
              <option value="all">All shipping</option>
              <option value="in_vault">In vault</option>
              {SHIPPING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SHIPPING_STATUS_META[status].label}
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ice/20 px-4 py-2">
          <p className="text-[0.6rem] text-muted-foreground">
            {filtered.length} of {minerals.length} records
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[0.55rem] text-muted-foreground">
            {(["active", "uninsured", "pending"] as const).map((status) => (
              <span key={status} className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    "size-1.5 rounded-[4px]",
                    INSURANCE_STATUS_META[status].dot,
                  )}
                />
                {INSURANCE_STATUS_META[status].label}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_110px_130px_130px_82px] gap-3 border-b border-line px-5 py-2.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
          <span>Mineral</span>
          <span>Owner</span>
          <span className="text-right">Value</span>
          <span>Insurance</span>
          <span>Shipping</span>
          <span className="text-right">Updated</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="No records match."
            description="Adjust the filters or search a different owner, vault ID or tracking number."
          />
        ) : (
          <div>
            {filtered.map((mineral) => (
              <AdminRow
                key={mineral.id}
                mineral={mineral}
                onOpen={(next) => setSelectedId(next.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <VaultActivityFeed
          activities={activities}
          limit={8}
          showOwner
          onOpenMineral={(id) => setSelectedId(id)}
        />
        <Panel>
          <div className="px-5 pt-5">
            <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
              Operations queue
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Records that need a person, not a report.
            </p>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {[
              {
                label: "Shipments on hold",
                count: metrics.onHoldShipments,
                helper: "Operational or customs check",
              },
              {
                label: "Without active cover",
                count: metrics.uninsuredCount,
                helper: "Uninsured or awaiting sign-off",
              },
              {
                label: "Pending shipments",
                count: metrics.pendingShipments,
                helper: "Awaiting collection or packing",
              },
            ].map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[0.68rem] font-medium text-ink">{item.label}</p>
                  <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
                    {item.helper}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    item.count > 0 ? "text-ink" : "text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={() => {
                setSort("updated_desc");
                setInsurance("all");
                setShipping("on_hold");
                setSearch("");
                setOwner("all");
                setType("all");
              }}
              className="text-[0.62rem] font-semibold text-primary"
            >
              Show shipments on hold
            </button>
          </div>
        </Panel>
      </div>

      {selectedMineral && (
        <AdminMineralDialog
          key={selectedMineral.id}
          mineral={selectedMineral}
          actor={actor}
          open={Boolean(selectedMineral)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}
