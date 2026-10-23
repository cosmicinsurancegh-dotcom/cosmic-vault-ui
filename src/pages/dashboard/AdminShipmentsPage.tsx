import { EmptyState, PageHeader } from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminMineralDialog } from "@/components/vault/AdminMineralDialog";
import {
  InVaultChip,
  ShipmentAlertChip,
  ShipmentRoute,
} from "@/components/vault/ShipmentRoute";
import { shipmentMode } from "@/components/vault/shipmentMode";
import { StatusLegend } from "@/components/vault/StatusBadges";
import { VaultPulse } from "@/components/vault/VaultPulse";
import { VaultSkeleton } from "@/components/vault/VaultSkeleton";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  describeShipmentEmailOutcome,
  useShipmentStatusPublisher,
} from "@/lib/vault/useShipmentEmail";
import {
  useVaultActor,
  useVaultData,
  useVaultMineral,
} from "@/lib/vault/useVault";
import type { Mineral, ShippingStatus } from "@/lib/vault/types";
import {
  SHIPPING_STATUSES,
  SHIPPING_STATUS_META,
  formatWeight,
} from "@/lib/vault/types";
import {
  ArrowUpRight,
  ChevronDown,
  ClipboardCopy,
  Clock3,
  Gem,
  Loader2,
  MapPin,
  PackageCheck,
  Search,
  Sparkles,
  Truck,
  Warehouse,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

type Filter = ShippingStatus | "all" | "in_vault";

const KEBAB =
  "absolute right-3 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:right-5 lg:top-1/2 lg:-translate-y-1/2";

function etaLabel(mineral: Mineral) {
  if (!mineral.shipping) return "";
  if (mineral.shipping.currentStatus === "shipped") return "Delivered";
  const days = Math.ceil(
    (mineral.shipping.estimatedDelivery - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days} days`;
}

export default function AdminShipmentsPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { actor, isLoading, canSwitchDemoRole, setDemoOperations } =
    useVaultActor();
  const { ready, minerals, metrics } = useVaultData(actor);
  const publishStatus = useShipmentStatusPublisher(actor);
  const [status, setStatus] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<"shipping" | "details">(
    "shipping",
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const selectedMineral = useVaultMineral(actor, selectedId);

  const counts = {
    pending: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "pending",
    ).length,
    in_progress: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "in_progress",
    ).length,
    on_hold: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "on_hold",
    ).length,
    in_transit: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "in_transit",
    ).length,
    shipped: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "shipped",
    ).length,
  };
  const inVault = minerals.filter((mineral) => !mineral.shipping).length;
  const activeCount =
    counts.pending + counts.in_progress + counts.on_hold + counts.in_transit;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return minerals
      .filter((mineral) => {
        if (status === "in_vault") {
          if (mineral.shipping) return false;
        } else if (status !== "all") {
          if (mineral.shipping?.currentStatus !== status) return false;
        }
        if (!query) return true;
        return [
          mineral.name,
          mineral.ownerName,
          mineral.ownerEmail,
          mineral.vaultId,
          mineral.shipping?.trackingNumber ?? "",
          mineral.shipping?.carrier ?? "",
          mineral.shipping?.destination.city ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (!a.shipping && !b.shipping)
          return a.ownerName.localeCompare(b.ownerName);
        if (!a.shipping) return 1;
        if (!b.shipping) return -1;
        return a.shipping.estimatedDelivery - b.shipping.estimatedDelivery;
      });
  }, [minerals, search, status]);

  if (isLoading || !ready) return <VaultSkeleton cards={2} />;
  if (actor.role !== "admin") return <Navigate to="/dashboard/vault" replace />;

  return (
    <div className="space-y-6">
      {canSwitchDemoRole && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border border-primary/20 bg-card text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold text-ink">
                Operations preview · shipment control
              </p>
              <p className="mt-0.5 text-[0.64rem] leading-5 text-muted-foreground">
                Changes publish immediately to the member tracking view.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-[4px] bg-card px-3 text-[0.65rem]"
            onClick={() => {
              setDemoOperations(false);
              navigate("/dashboard/shipments");
            }}
          >
            Member tracking
            <ArrowUpRight className="size-3" />
          </Button>
        </div>
      )}

      <PageHeader
        eyebrow={
          <>
            Vault operations
            <span className="size-1 rounded-[4px] bg-primary/60" />
            Shipment control
            <span className="size-1 rounded-[4px] bg-primary/60" />
            Live
          </>
        }
        title="Every consignment, under control."
        description="Initiate a shipment, change its tracking status, and leave a clear note for the member. Only staff can move a consignment between states."
        actions={
          <>
            <Button
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
              onClick={() => navigate("/dashboard/admin/vault")}
            >
              <Gem className="size-3.5" />
              Vault register
            </Button>
            <Button
              className="h-10 rounded-[4px] px-4"
              onClick={() => {
                setInitialTab("shipping");
                setSelectedId(
                  minerals.find((mineral) => !mineral.shipping)?.id ?? null,
                );
              }}
              disabled={inVault === 0}
            >
              <PackageCheck className="size-3.5" />
              Initiate shipment
            </Button>
          </>
        }
      />

      <VaultPulse
        items={[
          {
            label: "Active consignments",
            value: activeCount,
            helper: `${counts.in_transit} in transit`,
            icon: Truck,
          },
          {
            label: "Pending",
            value: counts.pending,
            helper: "Awaiting collection or packing",
            icon: PackageCheck,
          },
          {
            label: "On hold",
            value: counts.on_hold,
            helper: counts.on_hold
              ? "Requires an operational check"
              : "Nothing held",
            icon: MapPin,
            tone: counts.on_hold ? "warning" : "default",
          },
          {
            label: "Delivered",
            value: counts.shipped,
            helper: `${inVault} still in the vault`,
            icon: Warehouse,
            tone: "positive",
          },
        ]}
      />

      <div className="rounded-[4px] border border-line bg-card p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-[220px] flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search consignments"
              placeholder="Search mineral, owner, tracking number, carrier"
              className="h-9 rounded-full bg-card pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: "All" },
                ...SHIPPING_STATUSES.map((item) => ({
                  key: item,
                  label: SHIPPING_STATUS_META[item].label,
                })),
                { key: "in_vault", label: "In vault" },
              ] as { key: Filter; label: string }[]
            ).map((option) => {
              const count =
                option.key === "all"
                  ? minerals.filter((mineral) => mineral.shipping).length
                  : option.key === "in_vault"
                    ? inVault
                    : counts[option.key];
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStatus(option.key)}
                  aria-pressed={status === option.key}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.62rem] font-medium leading-none transition-colors",
                    status === option.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-line bg-card text-muted-foreground hover:border-primary/30 hover:text-ink",
                  )}
                >
                  {option.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2">
          <StatusLegend />
          <p className="text-[0.6rem] text-muted-foreground">
            {metrics.activeShipments} active · quick changes publish immediately
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[4px] border border-line bg-card">
          <EmptyState
            icon={Truck}
            title="No consignments match."
            description="Change the status filter, or search a different owner, mineral or tracking number."
            action={
              <Button
                size="sm"
                variant="outline"
                className="rounded-[4px] bg-transparent"
                onClick={() => {
                  setStatus("all");
                  setSearch("");
                }}
              >
                Show every consignment
              </Button>
            }
          />
        </div>
      ) : (
        <section className="overflow-hidden rounded-[4px] border border-line bg-card">
          {rows.map((mineral, index) => {
            const shipment = mineral.shipping;
            const { Icon: ModeIcon, label: modeLabel } = shipment
              ? shipmentMode(shipment)
              : { Icon: Warehouse, label: "In vault" };

            return (
              <motion.article
                key={mineral.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.035, 0.2),
                }}
                className="relative grid gap-4 border-b border-line px-4 py-5 pr-14 transition-colors last:border-b-0 hover:bg-ice/30 sm:px-6 sm:pr-16 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)] lg:items-center lg:gap-8"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-full",
                      shipment
                        ? "bg-primary text-primary-foreground shadow-[0_10px_20px_-12px_var(--electric)]"
                        : "border border-line bg-ice text-muted-foreground",
                    )}
                    title={modeLabel}
                  >
                    <ModeIcon className="size-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {shipment ? "Shipping ID" : "Mineral"}
                    </p>
                    {shipment ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            shipment.trackingNumber,
                          );
                          toast.success("Tracking number copied.");
                        }}
                        title="Copy tracking number"
                        className="mt-0.5 flex max-w-full items-center gap-1.5 text-[0.78rem] font-semibold tracking-[-0.01em] text-ink transition-colors hover:text-primary"
                      >
                        <span className="truncate">
                          {shipment.trackingNumber}
                        </span>
                        <ClipboardCopy className="size-3 shrink-0 text-muted-foreground" />
                      </button>
                    ) : (
                      <p className="mt-0.5 truncate text-[0.78rem] font-semibold tracking-[-0.01em] text-ink">
                        {mineral.name}
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                      {shipment ? mineral.name : mineral.type} ·{" "}
                      {formatWeight(mineral.weight, mineral.unit)}
                    </p>
                    <p className="mt-0.5 truncate text-[0.58rem] text-muted-foreground/80">
                      {mineral.ownerName} · {mineral.vaultId}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {shipment ? (
                        <>
                          <span className="relative inline-flex">
                            <select
                              aria-label={`Update tracking status for ${mineral.name}`}
                              title="Change the published tracking status"
                              value={shipment.currentStatus}
                              disabled={updatingId === mineral.id}
                              onChange={async (event) => {
                                const next = event.target
                                  .value as ShippingStatus;
                                const note = `Status updated to ${SHIPPING_STATUS_META[next].label} by vault operations.`;
                                const message = `${mineral.name} is now ${SHIPPING_STATUS_META[next].label}.`;
                                setUpdatingId(mineral.id);
                                try {
                                  const outcome = await publishStatus(
                                    mineral,
                                    next,
                                    note,
                                  );
                                  const description =
                                    describeShipmentEmailOutcome(outcome);
                                  if (
                                    outcome.kind === "sent" ||
                                    outcome.kind === "demo"
                                  ) {
                                    toast.success(message, { description });
                                  } else {
                                    toast.warning(message, { description });
                                  }
                                } catch (error) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Could not update the status.",
                                  );
                                } finally {
                                  setUpdatingId(null);
                                }
                              }}
                              className={cn(
                                "h-6 max-w-[9.5rem] cursor-pointer appearance-none truncate rounded-full border pl-2.5 pr-6 text-[0.6rem] font-semibold leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                                SHIPPING_STATUS_META[shipment.currentStatus]
                                  .tone,
                              )}
                            >
                              {SHIPPING_STATUSES.map((item) => (
                                <option
                                  key={item}
                                  value={item}
                                  className="bg-card text-ink"
                                >
                                  {SHIPPING_STATUS_META[item].label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 opacity-60" />
                          </span>
                          {updatingId === mineral.id ? (
                            <Loader2 className="size-3 animate-spin text-muted-foreground" />
                          ) : (
                            <ShipmentAlertChip shipment={shipment} />
                          )}
                        </>
                      ) : (
                        <InVaultChip />
                      )}
                    </div>
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[0.58rem] font-medium leading-none text-muted-foreground">
                      <Clock3 className="size-3" />
                      {shipment
                        ? shipment.currentStatus === "shipped"
                          ? `Delivered · ${formatDate(
                              shipment.deliveredAt ??
                                shipment.estimatedDelivery,
                            )}`
                          : `Est. delivery · ${formatDate(
                              shipment.estimatedDelivery,
                            )} · ${etaLabel(mineral)}`
                        : mineral.storageLocation}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 lg:border-l lg:border-line/70 lg:pl-8">
                  {shipment ? (
                    <>
                      <ShipmentRoute shipment={shipment} />
                      <p className="mt-3 truncate text-[0.55rem] text-muted-foreground lg:hidden">
                        {shipment.carrier} · {shipment.service}
                      </p>
                    </>
                  ) : (
                    <p className="min-w-0 text-[0.62rem] leading-5 text-muted-foreground">
                      No consignment exists. Initiate one from the packing bench
                      and the member sees it here as soon as it is published.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInitialTab("shipping");
                    setSelectedId(mineral.id);
                  }}
                  aria-label={`Manage ${mineral.name}`}
                  title={shipment ? "Manage consignment" : "Start shipment"}
                  className={KEBAB}
                >
                  <ArrowUpRight className="size-4" />
                </button>
              </motion.article>
            );
          })}
        </section>
      )}

      <p className="px-1 text-[0.6rem] leading-5 text-muted-foreground">
        Status changes are appended to the shipment history with the acting
        staff member and a timestamp. The member sees the same update on their
        tracking page and is emailed the new step, the note and the revised
        route as soon as it is published.
      </p>

      {selectedMineral && (
        <AdminMineralDialog
          key={`${selectedMineral.id}-${initialTab}`}
          mineral={selectedMineral}
          actor={actor}
          open={Boolean(selectedMineral)}
          initialTab={initialTab}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}
