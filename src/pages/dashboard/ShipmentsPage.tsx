import {
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MineralDetailDialog } from "@/components/vault/MineralDetailDialog";
import {
  InVaultChip,
  ShipmentAlertChip,
  ShipmentRoute,
  ShipmentStatusChip,
} from "@/components/vault/ShipmentRoute";
import { shipmentMode } from "@/components/vault/shipmentMode";
import { StatusLegend } from "@/components/vault/StatusBadges";
import { VaultPulse } from "@/components/vault/VaultPulse";
import { VaultSkeleton } from "@/components/vault/VaultSkeleton";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useVaultActor,
  useVaultData,
  useVaultMineral,
} from "@/lib/vault/useVault";
import type { ShippingStatus } from "@/lib/vault/types";
import { SHIPPING_STATUSES, SHIPPING_STATUS_META } from "@/lib/vault/types";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardCopy,
  Clock3,
  Headset,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { toast } from "sonner";

const KEBAB =
  "absolute right-3 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:right-5 lg:top-1/2 lg:-translate-y-1/2";

export default function ShipmentsPage() {
  const { actor, isLoading } = useVaultActor();
  const { ready, minerals, metrics } = useVaultData(actor);
  const [status, setStatus] = useState<ShippingStatus | "all" | "in_vault">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedMineral = useVaultMineral(actor, selectedId);
  const reduceMotion = useReducedMotion();

  const shipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return minerals
      .filter((mineral) => {
        if (status === "in_vault") {
          if (mineral.shipping) return false;
        } else if (!mineral.shipping) {
          return false;
        } else if (
          status !== "all" &&
          mineral.shipping.currentStatus !== status
        ) {
          return false;
        }
        if (!query) return true;
        return [
          mineral.name,
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
        if (!a.shipping || !b.shipping) return a.shipping ? 1 : -1;
        return a.shipping.estimatedDelivery - b.shipping.estimatedDelivery;
      });
  }, [minerals, search, status]);

  if (isLoading || !ready) return <VaultSkeleton cards={2} />;
  if (actor.role === "admin") {
    return <Navigate to="/dashboard/admin/shipments" replace />;
  }

  const counts = {
    pending: minerals.filter((m) => m.shipping?.currentStatus === "pending")
      .length,
    in_progress: minerals.filter(
      (m) => m.shipping?.currentStatus === "in_progress",
    ).length,
    on_hold: minerals.filter((m) => m.shipping?.currentStatus === "on_hold")
      .length,
    in_transit: minerals.filter(
      (m) => m.shipping?.currentStatus === "in_transit",
    ).length,
    shipped: minerals.filter((m) => m.shipping?.currentStatus === "shipped")
      .length,
  };
  const activeCount =
    counts.pending + counts.in_progress + counts.on_hold + counts.in_transit;
  const inVault = minerals.filter((mineral) => !mineral.shipping).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            Shipping desk
            <span className="size-1 rounded-[4px] bg-primary/60" />
            Live tracking
          </>
        }
        title="Every movement, on the record."
        description="A shipment is only initiated by vault operations. From the packing bench to the signed delivery, every status change and timestamp is published here."
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-[4px] bg-card px-4"
            >
              <Link to="/dashboard/vault">
                <Warehouse className="size-3.5" />
                My minerals
              </Link>
            </Button>
            <Button asChild className="h-10 rounded-[4px] px-4">
              <Link to="/dashboard/support">
                <Headset className="size-3.5" />
                Concierge
              </Link>
            </Button>
          </>
        }
      />

      <VaultPulse
        items={[
          {
            label: "Active shipments",
            value: activeCount,
            helper: `${counts.in_transit} in transit`,
            icon: Truck,
          },
          {
            label: "In preparation",
            value: counts.pending + counts.in_progress,
            helper: `${counts.pending} pending · ${counts.in_progress} preparing`,
            icon: PackageCheck,
          },
          {
            label: "On hold",
            value: counts.on_hold,
            helper: counts.on_hold
              ? "Requires an operational check"
              : "Nothing held",
            icon: CalendarClock,
            tone: counts.on_hold ? "warning" : "default",
          },
          {
            label: "Delivered",
            value: counts.shipped,
            helper: `${inVault} still in the vault`,
            icon: MapPin,
            tone: "positive",
          },
        ]}
      />

      <div className="flex flex-col gap-3 rounded-[4px] border border-line bg-card p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-[220px] flex-1 lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search shipments"
              placeholder="Search tracking number, carrier, mineral, or city"
              className="h-9 rounded-full bg-card pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  key: "all",
                  label: `All (${minerals.filter((m) => m.shipping).length})`,
                },
                ...SHIPPING_STATUSES.map((item) => ({
                  key: item,
                  label: `${SHIPPING_STATUS_META[item].label} (${counts[item]})`,
                })),
                { key: "in_vault", label: `In vault (${inVault})` },
              ] as { key: ShippingStatus | "all" | "in_vault"; label: string }[]
            ).map((option) => (
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
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2">
          <StatusLegend />
          <p className="text-[0.6rem] text-muted-foreground">
            Times shown in your local timezone
          </p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Truck}
            title={
              status === "in_vault"
                ? "Everything is in the vault."
                : "No shipments match."
            }
            description={
              status === "in_vault"
                ? "There are no minerals awaiting transport. Any future shipment will appear here with a live tracking number."
                : "Try another status or clear the search. Only vault operations can initiate or change a shipment."
            }
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
                Show every movement
              </Button>
            }
          />
        </Panel>
      ) : (
        <section className="overflow-hidden rounded-[4px] border border-line bg-card">
          {shipments.map((mineral, index) => {
            if (!mineral.shipping) {
              return (
                <motion.article
                  key={mineral.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(index * 0.03, 0.18),
                  }}
                  className="relative grid gap-4 border-b border-line px-4 py-5 pr-14 last:border-b-0 sm:px-6 sm:pr-16 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:items-center lg:gap-8"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-ice text-muted-foreground">
                      <Warehouse className="size-5" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Mineral
                      </p>
                      <p className="mt-1 truncate text-[0.78rem] font-semibold tracking-[-0.01em] text-ink">
                        {mineral.name}
                      </p>
                      <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                        {mineral.vaultId} · {mineral.storageLocation}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <InVaultChip />
                        <span className="text-[0.58rem] font-medium text-muted-foreground">
                          No shipment arranged
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="min-w-0 text-[0.62rem] leading-5 text-muted-foreground lg:border-l lg:border-line/70 lg:pl-8">
                    Held in the vault under dual control. Vault operations start
                    every consignment from the packing bench — nothing moves
                    until then.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(mineral.id)}
                    aria-label={`Open the record for ${mineral.name}`}
                    title="Open full record"
                    className={KEBAB}
                  >
                    <ArrowUpRight className="size-4" />
                  </button>
                </motion.article>
              );
            }

            const shipment = mineral.shipping;
            const { Icon: ModeIcon, label: modeLabel } = shipmentMode(shipment);
            return (
              <motion.article
                key={mineral.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(index * 0.04, 0.2),
                }}
                className="relative grid gap-4 border-b border-line px-4 py-5 pr-14 transition-colors last:border-b-0 hover:bg-ice/30 sm:px-6 sm:pr-16 lg:grid-cols-[minmax(0,270px)_minmax(0,1fr)] lg:items-center lg:gap-8"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_20px_-12px_var(--electric)]"
                    title={modeLabel}
                  >
                    <ModeIcon className="size-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Shipping ID
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(shipment.trackingNumber);
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
                    <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground">
                      {mineral.name} · {mineral.vaultId}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ShipmentStatusChip status={shipment.currentStatus} />
                      <ShipmentAlertChip shipment={shipment} />
                    </div>
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[0.58rem] font-medium leading-none text-muted-foreground">
                      <Clock3 className="size-3" />
                      {shipment.currentStatus === "shipped"
                        ? `Delivered · ${formatDate(
                            shipment.deliveredAt ?? shipment.estimatedDelivery,
                          )}`
                        : `Est. delivery · ${formatDate(shipment.estimatedDelivery)}`}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 lg:border-l lg:border-line/70 lg:pl-8">
                  <ShipmentRoute shipment={shipment} />
                  <p className="mt-3 truncate text-[0.55rem] text-muted-foreground lg:hidden">
                    {shipment.carrier} · {shipment.service}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedId(mineral.id)}
                  aria-label={`Open the record for ${mineral.name}`}
                  title="Open full record"
                  className={KEBAB}
                >
                  <ArrowUpRight className="size-4" />
                </button>
              </motion.article>
            );
          })}
        </section>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[4px] border border-line bg-card px-4 py-3">
        <p className="max-w-xl text-[0.62rem] leading-5 text-muted-foreground">
          Tracking statuses are controlled only by vault operations: Pending, In
          Progress, On Hold, In Transit and Shipped / Delivered. If a shipment
          is on hold, the latest update will say what is needed.
        </p>
        <p className="text-[0.6rem] font-medium text-ink">
          {metrics.activeShipments} active · {metrics.deliveredShipments}{" "}
          delivered
        </p>
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
