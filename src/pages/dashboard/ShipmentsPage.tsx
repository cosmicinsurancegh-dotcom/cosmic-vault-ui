import { EmptyState, PageHeader, Panel } from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MineralDetailDialog } from "@/components/vault/MineralDetailDialog";
import { MineralVisual } from "@/components/vault/MineralVisual";
import { ShippingProgress } from "@/components/vault/ShippingProgress";
import { ShippingStatusBadge, StatusLegend } from "@/components/vault/StatusBadges";
import { VaultPulse } from "@/components/vault/VaultPulse";
import { VaultSkeleton } from "@/components/vault/VaultSkeleton";
import { daysUntil, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVaultActor, useVaultData, useVaultMineral } from "@/lib/vault/useVault";
import type { Mineral, ShippingStatus } from "@/lib/vault/types";
import {
  SHIPPING_STATUSES,
  SHIPPING_STATUS_META,
  formatAddress,
} from "@/lib/vault/types";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardCopy,
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

const ACTIVE_ACCENT: Record<ShippingStatus, string> = {
  pending: "border-t-muted-foreground/30",
  in_progress: "border-t-primary",
  on_hold: "border-t-amber-500",
  in_transit: "border-t-violet-500",
  shipped: "border-t-emerald-500",
};

function etaLabel(mineral: Mineral) {
  if (!mineral.shipping) return "";
  if (mineral.shipping.currentStatus === "shipped") {
    return "Delivered";
  }
  const days = daysUntil(mineral.shipping.estimatedDelivery);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days} days`;
}

export default function ShipmentsPage() {
  const { actor, isLoading } = useVaultActor();
  const { ready, minerals, metrics } = useVaultData(actor);
  const [status, setStatus] = useState<ShippingStatus | "all" | "in_vault">("all");
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
        } else if (status !== "all" && mineral.shipping.currentStatus !== status) {
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
    pending: minerals.filter((m) => m.shipping?.currentStatus === "pending").length,
    in_progress: minerals.filter((m) => m.shipping?.currentStatus === "in_progress").length,
    on_hold: minerals.filter((m) => m.shipping?.currentStatus === "on_hold").length,
    in_transit: minerals.filter((m) => m.shipping?.currentStatus === "in_transit").length,
    shipped: minerals.filter((m) => m.shipping?.currentStatus === "shipped").length,
  };
  const activeCount = counts.pending + counts.in_progress + counts.on_hold + counts.in_transit;
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
            <Button asChild variant="outline" className="h-10 rounded-[4px] bg-card px-4">
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
            helper: counts.on_hold ? "Requires an operational check" : "Nothing held",
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
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search shipments"
              placeholder="Search tracking number, carrier, mineral, or city"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "all", label: `All (${minerals.filter((m) => m.shipping).length})` },
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
                  "rounded-[4px] border px-2.5 py-1.5 text-[0.62rem] font-medium transition-colors",
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
            title={status === "in_vault" ? "Everything is in the vault." : "No shipments match."}
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
        <div className="space-y-4">
          {shipments.map((mineral, index) => {
            if (!mineral.shipping) {
              return (
                <motion.article
                  key={mineral.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
                  className="flex flex-col gap-3 rounded-[4px] border border-line bg-card p-4 sm:flex-row sm:items-center"
                >
                  <MineralVisual
                    mineral={mineral}
                    className="aspect-square size-14 shrink-0 rounded-[4px]"
                    overlay={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{mineral.name}</p>
                    <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                      {mineral.vaultId} · {mineral.storageLocation}
                    </p>
                  </div>
                  <span className="rounded-[4px] border border-line bg-muted/60 px-2 py-0.5 text-[0.6rem] font-semibold text-muted-foreground">
                    In vault · no shipment
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-[4px] bg-transparent text-[0.65rem]"
                    onClick={() => setSelectedId(mineral.id)}
                  >
                    Open record
                  </Button>
                </motion.article>
              );
            }

            const shipment = mineral.shipping;
            return (
              <motion.article
                key={mineral.id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.25) }}
                className={cn(
                  "overflow-hidden rounded-[4px] border border-t-2 border-line bg-card",
                  ACTIVE_ACCENT[shipment.currentStatus],
                )}
              >
                <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <MineralVisual
                      mineral={mineral}
                      className="aspect-square size-16 shrink-0 rounded-[4px]"
                      overlay={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[0.86rem] font-semibold tracking-[-0.02em] text-ink">
                          {mineral.name}
                        </p>
                        <ShippingStatusBadge status={shipment.currentStatus} long />
                      </div>
                      <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                        {mineral.vaultId} · {mineral.type} · {mineral.storageLocation}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6rem] text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(shipment.trackingNumber);
                            toast.success("Tracking number copied.");
                          }}
                          className="inline-flex items-center gap-1 font-medium text-ink transition-colors hover:text-primary"
                        >
                          {shipment.trackingNumber}
                          <ClipboardCopy className="size-3 text-muted-foreground" />
                        </button>
                        <span>{shipment.carrier}</span>
                        <span>{shipment.service}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-[430px]">
                    <div>
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Estimated delivery
                      </p>
                      <p className="mt-1 text-[0.68rem] font-semibold text-ink">
                        {formatDate(shipment.estimatedDelivery)}
                      </p>
                      <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
                        {etaLabel(mineral)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Destination
                      </p>
                      <p className="mt-1 truncate text-[0.68rem] font-semibold text-ink">
                        {shipment.destination.city}
                      </p>
                      <p className="mt-0.5 truncate text-[0.56rem] text-muted-foreground">
                        {shipment.destination.country}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Last update
                      </p>
                      <p className="mt-1 text-[0.68rem] font-semibold text-ink">
                        {formatDateTime(
                          shipment.statusHistory[shipment.statusHistory.length - 1]?.at,
                        )}
                      </p>
                      <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
                        {shipment.statusHistory.length} recorded events
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 self-start rounded-[4px] bg-transparent text-[0.62rem]"
                    onClick={() => setSelectedId(mineral.id)}
                  >
                    Full record
                    <ArrowUpRight className="size-3" />
                  </Button>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="hidden md:block">
                    <ShippingProgress shipment={shipment} orientation="horizontal" showNotes />
                  </div>
                  <div className="md:hidden">
                    <ShippingProgress shipment={shipment} orientation="vertical" showNotes />
                  </div>
                </div>

                <div className="grid gap-3 border-t border-line bg-ice/20 px-4 py-3 sm:grid-cols-2 sm:px-5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] bg-card text-primary">
                      <Warehouse className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Origin
                      </p>
                      <p className="mt-0.5 truncate text-[0.62rem] text-ink">
                        {formatAddress(shipment.origin)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] bg-card text-primary">
                      <MapPin className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Destination
                      </p>
                      <p className="mt-0.5 truncate text-[0.62rem] text-ink">
                        {formatAddress(shipment.destination)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[4px] border border-line bg-card px-4 py-3">
        <p className="max-w-xl text-[0.62rem] leading-5 text-muted-foreground">
          Tracking statuses are controlled only by vault operations: Pending, In
          Progress, On Hold, In Transit and Shipped / Delivered. If a shipment is on
          hold, the latest update will say what is needed.
        </p>
        <p className="text-[0.6rem] font-medium text-ink">
          {metrics.activeShipments} active · {metrics.deliveredShipments} delivered
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
