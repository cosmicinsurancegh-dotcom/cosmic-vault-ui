import {
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
  Panel,
  StatusPill,
  Timeline,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { useAuth } from "@/hooks/use-auth";
import {
  downloadCsv,
  formatDate,
  formatMoney,
  formatMoneyList,
} from "@/lib/format";
import { useQuery } from "convex/react";
import {
  CalendarClock,
  Download,
  Gem,
  Headset,
  MapPin,
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
import { Link } from "react-router";
import { toast } from "sonner";

type SortKey = "value_desc" | "value_asc" | "deposit_desc" | "name_asc";

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

const RENEWAL_WINDOW = 90 * 24 * 60 * 60 * 1000;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The member's vault, reading the minerals staff have assigned to them.
 *
 * Ownership travels with the record: the mineral, its insurance policy and its
 * shipment are the same records vault operations see, so an assignment or a
 * status change shows up here immediately.
 */
export default function VaultPage() {
  const { user } = useAuth();
  const rows = useQuery(api.minerals.mine);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [insurance, setInsurance] = useState("all");
  const [shipping, setShipping] = useState<ShipmentStatus | "all" | "in_vault">(
    "all",
  );
  const [sort, setSort] = useState<SortKey>("value_desc");
  // Captured once so the renewal window cannot shift between renders.
  const [renewalCutoff] = useState(() => Date.now() + RENEWAL_WINDOW);

  const categories = useMemo(
    () =>
      [...new Set((rows ?? []).map((row) => row.mineral.category))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((row) => {
        if (category !== "all" && row.mineral.category !== category)
          return false;
        if (insurance === "insured" && row.policy?.status !== "active")
          return false;
        if (insurance === "uninsured" && row.policy) return false;
        if (insurance === "pending" && row.policy?.status !== "draft")
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
          row.policy?.policyNumber ?? "",
          row.policy?.provider ?? "",
          row.shipment?.reference ?? "",
          row.shipment?.trackingNumber ?? "",
          row.shipment?.currentLocation ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sort === "value_asc")
          return a.mineral.declaredValue - b.mineral.declaredValue;
        if (sort === "deposit_desc")
          return b.mineral.createdAt - a.mineral.createdAt;
        if (sort === "name_asc")
          return a.mineral.name.localeCompare(b.mineral.name);
        return b.mineral.declaredValue - a.mineral.declaredValue;
      });
  }, [category, insurance, rows, search, shipping, sort]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const insured = list.filter((row) => row.policy?.status === "active");
    const declared = new Map<string, number>();
    const covered = new Map<string, number>();
    for (const row of list) {
      declared.set(
        row.mineral.currency,
        (declared.get(row.mineral.currency) ?? 0) + row.mineral.declaredValue,
      );
    }
    for (const row of insured) {
      if (!row.policy) continue;
      covered.set(
        row.policy.currency,
        (covered.get(row.policy.currency) ?? 0) + row.policy.coverageLimit,
      );
    }
    return {
      holdings: list.length,
      insuredCount: insured.length,
      uninsured: list.filter((row) => !row.policy).length,
      declared: [...declared.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      covered: [...covered.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      renewals: list.filter(
        (row) =>
          row.policy?.status === "active" &&
          row.policy.endDate < renewalCutoff,
      ),
      inMotion: list.filter(
        (row) =>
          row.shipment &&
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
    };
  }, [renewalCutoff, rows]);

  const recentEvents = useMemo(
    () =>
      (rows ?? [])
        .flatMap((row) =>
          row.events.map((event) => ({ ...event, mineral: row.mineral })),
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6),
    [rows],
  );

  const firstName = (user?.name ?? "there").split(" ")[0];
  const activeFilters =
    search.trim() !== "" ||
    category !== "all" ||
    insurance !== "all" ||
    shipping !== "all";
  const nextRenewal = stats.renewals.sort(
    (a, b) => (a.policy?.endDate ?? 0) - (b.policy?.endDate ?? 0),
  )[0];

  if (rows === undefined) return <LoadingState label="Loading your vault" />;

  const downloadInventory = () => {
    downloadCsv(
      "cosmic-vault-inventory.csv",
      [
        { key: "reference", label: "Reference" },
        { key: "name", label: "Mineral" },
        { key: "category", label: "Category" },
        { key: "quantity", label: "Quantity" },
        { key: "value", label: "Declared value" },
        { key: "currency", label: "Currency" },
        { key: "policy", label: "Policy" },
        { key: "coverage", label: "Coverage" },
        { key: "coverLimit", label: "Cover limit" },
        { key: "policyStatus", label: "Policy status" },
        { key: "shipment", label: "Shipment" },
        { key: "shipping", label: "Shipping status" },
        { key: "updated", label: "Updated" },
      ],
      filtered.map((row) => ({
        reference: row.mineral.reference,
        name: row.mineral.name,
        category: row.mineral.category,
        quantity: `${row.mineral.quantity} ${row.mineral.unit}`,
        value: row.mineral.declaredValue,
        currency: row.mineral.currency,
        policy: row.policy?.policyNumber ?? "None",
        coverage: row.policy
          ? (COVERAGE_LABELS[row.policy.coverage] ?? row.policy.coverage)
          : "",
        coverLimit: row.policy?.coverageLimit ?? "",
        policyStatus: row.policy?.status ?? "",
        shipment: row.shipment?.reference ?? "",
        shipping: row.shipment
          ? SHIPMENT_STATUS_LABELS[row.shipment.status]
          : "In vault",
        updated: formatDate(row.mineral.updatedAt),
      })),
    );
    toast.success("Inventory downloaded.");
  };

  return (
    <div className="space-y-6">
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
        description="Every mineral assigned to you, the policy protecting it, and every movement it makes. Records are maintained by vault operations under dual control."
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Holdings"
          value={stats.holdings}
          helper={`${stats.insuredCount} insured · ${stats.uninsured} without cover`}
          icon={Gem}
        />
        <MetricTile
          label="Declared value"
          value={formatMoneyList(stats.declared, "None")}
          helper="Latest recorded appraisal"
          icon={Wallet}
        />
        <MetricTile
          label="Insured value"
          value={formatMoneyList(stats.covered, "None")}
          helper={`${stats.insuredCount} active ${stats.insuredCount === 1 ? "policy" : "policies"}`}
          icon={ShieldCheck}
        />
        <MetricTile
          label="In motion"
          value={stats.inMotion}
          helper="Consignments not yet delivered"
          icon={Truck}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[4px] border border-line bg-card p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search mineral, reference, policy or tracking"
                  aria-label="Search minerals"
                  className="h-9 rounded-[4px] bg-card pl-9 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 max-w-[160px] rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by insurance status"
                  value={insurance}
                  onChange={(event) => setInsurance(event.target.value)}
                  className="h-9 rounded-[4px] border border-line bg-card px-2.5 text-xs text-ink"
                >
                  <option value="all">All insurance</option>
                  <option value="insured">Insured</option>
                  <option value="uninsured">Not insured</option>
                  <option value="pending">Pending</option>
                </select>
                <select
                  aria-label="Filter by shipping status"
                  value={shipping}
                  onChange={(event) =>
                    setShipping(
                      event.target.value as ShipmentStatus | "all" | "in_vault",
                    )
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
                  <option value="value_asc">Value · low to high</option>
                  <option value="deposit_desc">Newest first</option>
                  <option value="name_asc">Name · A to Z</option>
                </select>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-0.5 pt-2">
              <p className="inline-flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
                <SlidersHorizontal className="size-3" />
                {filtered.length} of {rows.length} records
                {activeFilters ? " · filtered" : ""}
              </p>
              {activeFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setInsurance("all");
                    setShipping("all");
                  }}
                  className="inline-flex items-center gap-1 text-[0.6rem] font-medium text-primary"
                >
                  <RefreshCw className="size-3" />
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Gem}
                title="No minerals assigned yet."
                description="When vault operations record a mineral under your account, it appears here with its insurance policy and shipment. We email you when that happens."
                action={
                  <Button asChild size="sm" className="rounded-[4px]">
                    <Link to="/dashboard/support">Talk to the vault desk</Link>
                  </Button>
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
                    onClick={() => {
                      setSearch("");
                      setCategory("all");
                      setInsurance("all");
                      setShipping("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </Panel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map(({ mineral, policy, shipment, events }) => (
                <Panel key={mineral._id} className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {mineral.reference} · {mineral.category}
                      </p>
                      <h2 className="mt-1 truncate text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
                        {mineral.name}
                      </h2>
                      <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                        {mineral.quantity.toLocaleString("en-GB")}{" "}
                        {mineral.unit} ·{" "}
                        {formatMoney(mineral.declaredValue, mineral.currency)}
                      </p>
                    </div>
                    <StatusPill status={policy?.status ?? mineral.status} />
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div>
                      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Insurance
                      </p>
                      {policy ? (
                        <div className="mt-1.5 space-y-0.5">
                          <p className="text-xs font-medium text-ink">
                            {policy.policyNumber}
                          </p>
                          <p className="text-[0.62rem] leading-5 text-muted-foreground">
                            {policy.provider} ·{" "}
                            {COVERAGE_LABELS[policy.coverage] ??
                              policy.coverage}{" "}
                            · cover limit{" "}
                            {formatMoney(
                              policy.coverageLimit,
                              policy.currency,
                            )}
                          </p>
                          <p className="text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground">
                            In force {formatDate(policy.startDate)} —{" "}
                            {formatDate(policy.endDate)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
                          <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
                          No policy has been recorded for this mineral.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Shipment
                      </p>
                      {shipment ? (
                        <div className="mt-1.5 space-y-1">
                          <p className="flex flex-wrap items-center gap-2 text-xs text-ink">
                            <StatusPill status={shipment.status} />
                            <span className="text-[0.62rem] text-muted-foreground">
                              {shipment.reference}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            {shipment.origin} → {shipment.destination}
                          </p>
                          <p className="flex flex-wrap items-center gap-x-2 text-[0.6rem] text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Truck className="size-3.5 shrink-0" />
                              {shipment.carrier}
                            </span>
                            {shipment.trackingNumber && (
                              <span>· {shipment.trackingNumber}</span>
                            )}
                            {shipment.estimatedArrivalAt && (
                              <span className="inline-flex items-center gap-1">
                                · <CalendarClock className="size-3" />{" "}
                                {formatDate(shipment.estimatedArrivalAt)}
                              </span>
                            )}
                          </p>
                          {events.length > 0 && (
                            <div className="mt-2 border-t border-line/70 pt-2">
                              <Timeline
                                items={events.slice(0, 2).map((event) => ({
                                  title: SHIPMENT_STATUS_LABELS[event.status],
                                  body: [event.location, event.note]
                                    .filter(Boolean)
                                    .join(" · "),
                                  at: event.createdAt,
                                }))}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[0.62rem] text-muted-foreground">
                          Held in the vault. No consignment has been arranged.
                        </p>
                      )}
                    </div>
                  </div>

                  {shipment && (
                    <div className="border-t border-line px-5 py-3">
                      <Link
                        to="/dashboard/shipments"
                        className="inline-flex items-center gap-1 text-[0.62rem] font-semibold text-primary"
                      >
                        Track this consignment
                      </Link>
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Panel>
            <div className="px-5 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
                    Cover health
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Active policies across your collection.
                  </p>
                </div>
                <span className="rounded-[4px] border border-line bg-ice/50 px-2 py-0.5 text-[0.56rem] font-semibold tabular-nums text-ink">
                  {rows.length
                    ? Math.round((stats.insuredCount / rows.length) * 100)
                    : 0}
                  %
                </span>
              </div>
              <p className="mt-4 text-[0.62rem] text-muted-foreground">
                <span className="font-semibold text-ink">
                  {stats.insuredCount}
                </span>{" "}
                of {rows.length} insured
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[4px] bg-ink/[0.07] dark:bg-white/10">
                <div
                  className="h-full rounded-[4px] bg-emerald-500"
                  style={{
                    width: `${rows.length ? Math.max(3, Math.round((stats.insuredCount / rows.length) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="mt-4 divide-y divide-line border-t border-line">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="inline-flex items-center gap-2 text-[0.66rem] text-muted-foreground">
                  <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
                  Without cover
                </span>
                <span className="text-[0.68rem] font-semibold tabular-nums text-ink">
                  {stats.uninsured}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="inline-flex items-center gap-2 text-[0.66rem] text-muted-foreground">
                  <CalendarClock className="size-3.5 text-primary" />
                  Renewals in 90 days
                </span>
                <span className="text-[0.68rem] font-semibold tabular-nums text-ink">
                  {stats.renewals.length}
                </span>
              </div>
              {nextRenewal?.policy && (
                <div className="px-5 py-2.5">
                  <p className="text-[0.6rem] text-muted-foreground">
                    Next:{" "}
                    <span className="font-medium text-ink">
                      {nextRenewal.mineral.name}
                    </span>{" "}
                    · {formatDate(nextRenewal.policy.endDate)}
                  </p>
                </div>
              )}
            </div>
            {stats.uninsured > 0 && (
              <div className="border-t border-line px-5 py-3">
                <button
                  type="button"
                  onClick={() => setInsurance("uninsured")}
                  className="inline-flex items-center gap-1 text-[0.63rem] font-semibold text-primary"
                >
                  Review uninsured pieces
                </button>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="px-5 pt-5">
              <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-ink">
                Recent movement
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The latest updates from vault operations.
              </p>
            </div>
            <div className="mt-4 border-t border-line px-5 py-4">
              {recentEvents.length === 0 ? (
                <p className="text-[0.62rem] leading-5 text-muted-foreground">
                  No shipment updates yet. Changes appear here as they happen.
                </p>
              ) : (
                <Timeline
                  items={recentEvents.map((event) => ({
                    title: `${event.mineral.name} · ${SHIPMENT_STATUS_LABELS[event.status]}`,
                    body: [event.location, event.note]
                      .filter(Boolean)
                      .join(" · "),
                    at: event.createdAt,
                  }))}
                />
              )}
            </div>
          </Panel>

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
            </Link>
          </div>
        </div>
      </div>

      <p className="px-1 text-[0.58rem] leading-4 text-muted-foreground">
        <Sparkles className="mr-1 inline size-3" />
        Records are maintained by vault operations. Assignment, insurance and
        tracking changes are recorded in the audit log.
      </p>
    </div>
  );
}
