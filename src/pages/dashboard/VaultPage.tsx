import {
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MineralCard } from "@/components/vault/MineralCard";
import { MineralDetailDialog } from "@/components/vault/MineralDetailDialog";
import { VaultActivityFeed } from "@/components/vault/VaultActivityFeed";
import { VaultPulse } from "@/components/vault/VaultPulse";
import { VaultSkeleton } from "@/components/vault/VaultSkeleton";
import {
  downloadCsv,
  formatDate,
  formatMoneyValue,
} from "@/lib/format";
import { seedDemoCollection } from "@/lib/vault/store";
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
  CalendarClock,
  Download,
  Gem,
  Headset,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

type SortKey = "value_desc" | "value_asc" | "deposit_desc" | "name_asc";

const EMPTY_FILTERS = {
  search: "",
  type: "all",
  insurance: "all",
  shipping: "all",
  sort: "value_desc" as SortKey,
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function isRenewalDue(policy: Mineral["insurancePolicy"]) {
  return (
    policy?.status === "active" &&
    policy.endDate < Date.now() + 90 * 24 * 60 * 60 * 1000
  );
}

function DemoBar({
  onSwitch,
}: {
  onSwitch: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-primary/20 bg-card text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <div>
          <p className="text-[0.72rem] font-semibold text-ink">
            Demonstration vault · member view
          </p>
          <p className="mt-0.5 text-[0.64rem] leading-5 text-muted-foreground">
            Fictional records for Noor Haddad. Switch to the operations view to see
            the same data as an administrator.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 rounded-[4px] bg-card px-3 text-[0.65rem]"
        onClick={onSwitch}
      >
        Operations view
        <ArrowUpRight className="size-3" />
      </Button>
    </div>
  );
}

function CoverHealth({
  minerals,
  onFilterUninsured,
}: {
  minerals: Mineral[];
  onFilterUninsured: () => void;
}) {
  const insured = minerals.filter((mineral) => insuranceStatus(mineral) === "active");
  const pending = minerals.filter((mineral) => insuranceStatus(mineral) === "pending");
  const uninsured = minerals.filter((mineral) => !mineral.insurancePolicy);
  const renewals = minerals
    .filter((mineral) => isRenewalDue(mineral.insurancePolicy))
    .sort(
      (a, b) =>
        (a.insurancePolicy?.endDate ?? 0) - (b.insurancePolicy?.endDate ?? 0),
    );
  const percent = minerals.length
    ? Math.round((insured.length / minerals.length) * 100)
    : 0;

  return (
    <Panel>
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
              Cover health
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Active policies across the collection.
            </p>
          </div>
          <span className="rounded-[4px] border border-line bg-ice/50 px-2 py-0.5 text-[0.56rem] font-semibold tabular-nums text-ink">
            {percent}%
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between text-[0.6rem] text-muted-foreground">
          <span>
            <span className="font-semibold text-ink">{insured.length}</span> of{" "}
            {minerals.length} insured
          </span>
          <span>{formatMoneyValue(
            insured.reduce(
              (total, mineral) => total + (mineral.insurancePolicy?.coverageAmount ?? 0),
              0,
            ),
            minerals[0]?.currency ?? "GBP",
          )}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[4px] bg-ink/[0.07] dark:bg-white/10">
          <div
            className="h-full rounded-[4px] bg-emerald-500 transition-[width] duration-700"
            style={{ width: `${Math.max(3, percent)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 divide-y divide-line border-t border-line">
        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="inline-flex items-center gap-2 text-[0.66rem] text-muted-foreground">
            <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            Awaiting cover
          </span>
          <span className="text-[0.68rem] font-semibold tabular-nums text-ink">
            {uninsured.length + pending.length}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="inline-flex items-center gap-2 text-[0.66rem] text-muted-foreground">
            <CalendarClock className="size-3.5 text-primary" />
            Renewals in 90 days
          </span>
          <span className="text-[0.68rem] font-semibold tabular-nums text-ink">
            {renewals.length}
          </span>
        </div>
        {renewals[0] && (
          <div className="px-5 py-2.5">
            <p className="text-[0.6rem] text-muted-foreground">
              Next:{" "}
              <span className="font-medium text-ink">
                {renewals[0].name}
              </span>{" "}
              · {formatDate(renewals[0].insurancePolicy?.endDate)}
            </p>
          </div>
        )}
      </div>

      {uninsured.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onFilterUninsured}
            className="inline-flex items-center gap-1 text-[0.63rem] font-semibold text-primary"
          >
            Review {uninsured.length === 1 ? "the uninsured piece" : "uninsured pieces"}
            <ArrowUpRight className="size-3" />
          </button>
        </div>
      )}
    </Panel>
  );
}

export default function VaultPage() {
  const navigate = useNavigate();
  const { actor, isLoading, canSwitchDemoRole, setDemoOperations } = useVaultActor();
  const { ready, minerals, metrics, activities } = useVaultData(actor);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMineral = useVaultMineral(actor, selectedId);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const rows = minerals.filter((mineral) => {
      if (query) {
        const haystack = [
          mineral.name,
          mineral.type,
          mineral.category,
          mineral.vaultId,
          mineral.certificateNumber,
          mineral.storageLocation,
          mineral.ownerName,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.type !== "all" && mineral.type !== filters.type) return false;
      if (filters.insurance !== "all") {
        const status = insuranceStatus(mineral);
        if (filters.insurance === "insured" && status !== "active") return false;
        if (filters.insurance === "uninsured" && status !== "uninsured") return false;
        if (filters.insurance === "pending" && status !== "pending") return false;
      }
      if (filters.shipping !== "all") {
        if (filters.shipping === "in_vault" && mineral.shipping) return false;
        if (
          filters.shipping !== "in_vault" &&
          mineral.shipping?.currentStatus !== filters.shipping
        ) {
          return false;
        }
      }
      return true;
    });

    return rows.sort((a, b) => {
      if (filters.sort === "value_asc") return a.estimatedValue - b.estimatedValue;
      if (filters.sort === "deposit_desc") return b.depositDate - a.depositDate;
      if (filters.sort === "name_asc") return a.name.localeCompare(b.name);
      return b.estimatedValue - a.estimatedValue;
    });
  }, [filters, minerals]);

  if (isLoading || !ready) return <VaultSkeleton />;
  if (actor.role === "admin") {
    return <Navigate to="/dashboard/admin/vault" replace />;
  }

  const firstName = (actor.name || "there").split(" ")[0];
  const activeFilters =
    filters.search.trim() !== "" ||
    filters.type !== "all" ||
    filters.insurance !== "all" ||
    filters.shipping !== "all" ||
    filters.sort !== "value_desc";
  const uninsured = minerals.filter((mineral) => !mineral.insurancePolicy);

  const downloadInventory = () => {
    downloadCsv(
      "cosmic-vault-inventory.csv",
      [
        { key: "vaultId", label: "Vault ID" },
        { key: "certificate", label: "Certificate" },
        { key: "name", label: "Mineral" },
        { key: "type", label: "Type" },
        { key: "category", label: "Category" },
        { key: "weight", label: "Weight" },
        { key: "dimensions", label: "Dimensions" },
        { key: "purity", label: "Purity" },
        { key: "grade", label: "Grade" },
        { key: "value", label: "Appraised value" },
        { key: "currency", label: "Currency" },
        { key: "location", label: "Storage location" },
        { key: "deposited", label: "Deposited" },
        { key: "insurance", label: "Insurance status" },
        { key: "policy", label: "Policy" },
        { key: "shipping", label: "Shipping status" },
      ],
      filtered.map((mineral) => ({
        vaultId: mineral.vaultId,
        certificate: mineral.certificateNumber,
        name: mineral.name,
        type: mineral.type,
        category: mineral.category,
        weight: formatWeight(mineral.weight, mineral.unit),
        dimensions: mineral.dimensions,
        purity: mineral.purity,
        grade: mineral.grade,
        value: mineral.estimatedValue,
        currency: mineral.currency,
        location: mineral.storageLocation,
        deposited: formatDate(mineral.depositDate),
        insurance: INSURANCE_STATUS_META[insuranceStatus(mineral)].label,
        policy: mineral.insurancePolicy?.policyNumber ?? "None",
        shipping: mineral.shipping
          ? SHIPPING_STATUS_META[mineral.shipping.currentStatus].longLabel
          : "In vault",
      })),
    );
    toast.success("Inventory downloaded.");
  };

  return (
    <div className="space-y-6">
      {canSwitchDemoRole && (
        <DemoBar
          onSwitch={() => {
            setDemoOperations(true);
            navigate("/dashboard/admin/vault");
          }}
        />
      )}

      <PageHeader
        eyebrow={
          <>
            Member vault
            <span className="size-1 rounded-[4px] bg-primary/60" />
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            <span className="size-1 rounded-[4px] bg-primary/60" />
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-[4px] bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-[4px] bg-emerald-500" />
              </span>
              Live holdings
            </span>
          </>
        }
        title={`${greeting()}, ${firstName}.`}
        description="Every object you own, the policy protecting it, and every movement it makes. Held under dual control in the Cosmic Vault, with a person accountable for each record."
        actions={
          <>
            <Button
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
              onClick={downloadInventory}
              disabled={filtered.length === 0}
            >
              <Download className="size-3.5" />
              Inventory
            </Button>
            <Button asChild className="h-10 rounded-[4px] px-4">
              <Link to="/dashboard/support">
                <Plus className="size-3.5" />
                Arrange a deposit
              </Link>
            </Button>
          </>
        }
      />

      <VaultPulse
        items={[
          {
            label: "Holdings",
            value: metrics.holdings,
            helper: `${metrics.insuredCount} insured · ${metrics.uninsuredCount} uninsured`,
            icon: Gem,
          },
          {
            label: "Appraised value",
            value: formatMoneyValue(metrics.totalAppraisedValue, metrics.currency),
            helper: "Latest recorded appraisal",
            icon: Wallet,
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
            label: "In motion",
            value: metrics.activeShipments,
            helper: `${metrics.pendingShipments} pending · ${metrics.onHoldShipments} on hold`,
            icon: Truck,
            tone: metrics.onHoldShipments > 0 ? "warning" : "default",
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[4px] border border-line bg-card p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Search name, vault ID, certificate, or location"
                  aria-label="Search minerals"
                  className="h-9 rounded-[4px] bg-card pl-9 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter by mineral type"
                  value={filters.type}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, type: event.target.value }))
                  }
                  className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
                >
                  <option value="all">All types</option>
                  {MINERAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by insurance status"
                  value={filters.insurance}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      insurance: event.target.value,
                    }))
                  }
                  className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
                >
                  <option value="all">All insurance</option>
                  <option value="insured">Insured</option>
                  <option value="uninsured">Not insured</option>
                  <option value="pending">Pending</option>
                </select>
                <select
                  aria-label="Filter by shipping status"
                  value={filters.shipping}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      shipping: event.target.value,
                    }))
                  }
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
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      sort: event.target.value as SortKey,
                    }))
                  }
                  className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
                >
                  <option value="value_desc">Value · high to low</option>
                  <option value="value_asc">Value · low to high</option>
                  <option value="deposit_desc">Newest deposit</option>
                  <option value="name_asc">Name · A to Z</option>
                </select>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-0.5 pt-2">
              <p className="inline-flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
                <SlidersHorizontal className="size-3" />
                {filtered.length} of {minerals.length} records
                {activeFilters ? " · filtered" : ""}
              </p>
              {activeFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-1 text-[0.6rem] font-medium text-primary"
                >
                  <RefreshCw className="size-3" />
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {minerals.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Gem}
                title="The vault is ready for its first piece."
                description="A vault specialist will arrange intake, identity checks and an independent appraisal before anything is accepted into custody."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm" className="rounded-[4px]">
                      <Link to="/dashboard/support">Arrange a deposit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-[4px] bg-transparent"
                      onClick={() => {
                        const count = seedDemoCollection(actor);
                        toast.success(
                          count
                            ? `${count} demonstration records loaded.`
                            : "A demonstration collection is already loaded.",
                        );
                      }}
                    >
                      Load demonstration collection
                    </Button>
                  </div>
                }
              />
            </Panel>
          ) : filtered.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Search}
                title="No minerals match those filters."
                description="Try a broader search, or reset the filters to see the full collection."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-[4px] bg-transparent"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                  >
                    Clear filters
                  </Button>
                }
              />
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((mineral, index) => (
                <MineralCard
                  key={mineral.id}
                  mineral={mineral}
                  index={index}
                  onOpen={(next) => setSelectedId(next.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <VaultActivityFeed
            activities={activities}
            limit={7}
            onOpenMineral={(id) => setSelectedId(id)}
            href="/dashboard/shipments"
          />
          <CoverHealth
            minerals={minerals}
            onFilterUninsured={() =>
              setFilters((current) => ({ ...current, insurance: "uninsured" }))
            }
          />

          {uninsured.length > 0 && (
            <div className="rounded-[4px] border border-amber-500/30 bg-amber-500/[0.05] p-4">
              <p className="flex items-center gap-2 text-[0.68rem] font-semibold text-ink">
                <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                {uninsured.length === 1
                  ? "One piece needs cover"
                  : `${uninsured.length} pieces need cover`}
              </p>
              <p className="mt-1.5 text-[0.64rem] leading-5 text-muted-foreground">
                {uninsured.map((mineral) => mineral.name).join(", ")}. Open the record
                to compare recommended policies.
              </p>
            </div>
          )}

          <div className="starfield relative overflow-hidden rounded-[4px] bg-[#071227] p-5 text-bone">
            <span className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(76,125,255,0.4),transparent_66%)]" />
            <p className="relative flex items-center gap-2 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-bone/45">
              <Headset className="size-3.5 text-electric-soft" />
              Vault concierge
            </p>
            <p className="relative mt-2 max-w-[16rem] text-[0.78rem] font-medium leading-5 text-bone/85">
              A specialist with your record in front of them, not a call queue.
            </p>
            <Link
              to="/dashboard/support"
              className="relative mt-3 inline-flex items-center gap-1 text-[0.66rem] font-semibold text-electric-soft transition-colors hover:text-bone"
            >
              Open support
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {minerals.some((mineral) => mineral.isDemo) && (
            <p className="px-1 text-[0.58rem] leading-4 text-muted-foreground">
              Demonstration data is clearly labelled and stored only in this browser.
            </p>
          )}
        </div>
      </div>

      {selectedMineral && (
        <MineralDetailDialog
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
