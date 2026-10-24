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
  SHIPMENT_STAGES,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  shipmentProgress,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { formatDate, formatMoney } from "@/lib/format";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCopy,
  Clock3,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type MineRow = FunctionReturnType<typeof api.minerals.mine>[number];
type ShipmentRow = MineRow & { shipment: NonNullable<MineRow["shipment"]> };

function hasShipment(row: MineRow): row is ShipmentRow {
  return row.shipment !== null;
}

/**
 * The member's tracking desk, reading the same shipment records vault
 * operations work from. Every status change made in the staff console appears
 * here with its location, note and timestamp, and the member is emailed by the
 * server when it happens.
 */
export default function ShipmentsPage() {
  const rows = useQuery(api.minerals.mine);
  const [status, setStatus] = useState<ShipmentStatus | "all">("all");
  const [search, setSearch] = useState("");

  const shipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (rows ?? [])
      .filter(hasShipment)
      .filter((row) => status === "all" || row.shipment.status === status)
      .filter((row) => {
        if (!query) return true;
        return [
          row.mineral.name,
          row.mineral.reference,
          row.shipment.reference,
          row.shipment.trackingNumber ?? "",
          row.shipment.carrier,
          row.shipment.origin,
          row.shipment.destination,
          row.shipment.currentLocation ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          (a.shipment.estimatedArrivalAt ?? a.shipment.createdAt) -
          (b.shipment.estimatedArrivalAt ?? b.shipment.createdAt),
      );
  }, [rows, search, status]);

  const stats = useMemo(() => {
    const all = (rows ?? []).filter(hasShipment);
    return {
      total: all.length,
      active: all.filter(
        (row) =>
          row.shipment.status !== "delivered" &&
          row.shipment.status !== "cancelled",
      ).length,
      preparing: all.filter((row) => row.shipment.status === "preparing")
        .length,
      attention: all.filter((row) => shipmentNeedsAttention(row.shipment.status))
        .length,
      delivered: all.filter((row) => row.shipment.status === "delivered")
        .length,
    };
  }, [rows]);

  if (rows === undefined) {
    return <LoadingState label="Loading your shipments" />;
  }

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
        description="Vault operations start and move every consignment. Each status change, location and note is published here as it happens, and we email you the update."
        actions={
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-[4px] bg-card px-4"
          >
            <Link to="/dashboard/minerals">
              <PackageCheck className="size-3.5" />
              My minerals
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Active shipments"
          value={stats.active}
          helper={`${stats.total} on record`}
          icon={Truck}
        />
        <MetricTile
          label="In preparation"
          value={stats.preparing}
          helper="Being verified and packed"
          icon={PackageCheck}
        />
        <MetricTile
          label="Needs attention"
          value={stats.attention}
          helper="Held, delayed or cancelled"
          icon={AlertTriangle}
        />
        <MetricTile
          label="Delivered"
          value={stats.delivered}
          helper="Signed for at the destination"
          icon={MapPin}
        />
      </div>

      <div className="rounded-[4px] border border-line bg-card p-3">
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
            {(["all", ...SHIPMENT_STATUSES] as (ShipmentStatus | "all")[]).map(
              (option) => {
                const count =
                  option === "all"
                    ? (rows ?? []).filter(hasShipment).length
                    : (rows ?? []).filter(hasShipment).filter(
                        (row) => row.shipment.status === option,
                      ).length;
                const label =
                  option === "all" ? "All" : SHIPMENT_STATUS_LABELS[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    aria-pressed={status === option}
                    className={
                      status === option
                        ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.62rem] font-medium leading-none text-primary-foreground"
                        : "rounded-full border border-line bg-card px-3 py-1.5 text-[0.62rem] font-medium leading-none text-muted-foreground transition-colors hover:border-primary/30 hover:text-ink"
                    }
                  >
                    {label} ({count})
                  </button>
                );
              },
            )}
          </div>
        </div>
        <p className="mt-2 border-t border-line/70 pt-2 text-[0.6rem] text-muted-foreground">
          Times shown in your local timezone · only vault operations can move a
          consignment
        </p>
      </div>

      {shipments.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Truck}
            title={
              search.trim() || status !== "all"
                ? "No shipments match."
                : "Nothing is moving right now."
            }
            description={
              search.trim() || status !== "all"
                ? "Try another status or clear the search. Only vault operations can initiate or change a shipment."
                : "Once vault operations start a consignment for one of your minerals, its live tracking will appear here and we will email you."
            }
            action={
              search.trim() || status !== "all" ? (
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
              ) : (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-[4px] bg-transparent"
                >
                  <Link to="/dashboard/minerals">View my minerals</Link>
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {shipments.map(({ mineral, shipment, events }) => {
            const delivered = shipment.status === "delivered";
            return (
              <section
                key={shipment._id}
                className="overflow-hidden rounded-[4px] border border-line bg-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {shipment.reference} · {shipment.carrier}
                    </p>
                    <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                      {mineral.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mineral.reference} ·{" "}
                      {mineral.quantity.toLocaleString("en-GB")} {mineral.unit} ·
                      declared at{" "}
                      {formatMoney(mineral.declaredValue, mineral.currency)}
                    </p>
                    {shipment.trackingNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            shipment.trackingNumber ?? "",
                          );
                          toast.success("Tracking number copied.");
                        }}
                        title="Copy tracking number"
                        className="mt-1.5 flex max-w-full items-center gap-1.5 text-[0.7rem] font-medium text-primary transition-colors hover:text-ink"
                      >
                        <span className="truncate">
                          {shipment.trackingNumber}
                        </span>
                        <ClipboardCopy className="size-3 shrink-0" />
                      </button>
                    )}
                  </div>
                  <StatusPill status={shipment.status} />
                </div>

                <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.05fr_1fr]">
                  <div className="space-y-4">
                    <div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
                        <MapPin className="size-3.5 shrink-0" />
                        {shipment.origin} → {shipment.destination}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Truck className="size-3.5 shrink-0" />
                        {shipment.carrier}
                        {shipment.currentLocation
                          ? ` · last seen ${shipment.currentLocation}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            shipmentNeedsAttention(shipment.status)
                              ? "h-full rounded-full bg-amber-500"
                              : "h-full rounded-full bg-primary"
                          }
                          style={{
                            width: `${shipmentProgress(shipment.status)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between gap-1 text-[0.55rem] uppercase tracking-[0.08em] text-muted-foreground">
                        {SHIPMENT_STAGES.map((stage) => (
                          <span key={stage.key}>{stage.label}</span>
                        ))}
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-2 text-[0.62rem] text-muted-foreground">
                      <div>
                        <dt className="uppercase tracking-[0.1em]">
                          {delivered ? "Delivered" : "Estimated arrival"}
                        </dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-ink">
                          <CalendarClock className="size-3.5" />
                          {formatDate(
                            delivered
                              ? shipment.lastStatusAt
                              : shipment.estimatedArrivalAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.1em]">
                          Last update
                        </dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-ink">
                          <Clock3 className="size-3.5" />
                          {formatDate(shipment.lastStatusAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="lg:border-l lg:border-line/70 lg:pl-6">
                    <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Progress updates
                    </p>
                    {events.length > 0 ? (
                      <div className="mt-3">
                        <Timeline
                          items={events.slice(0, 5).map((event) => ({
                            title: SHIPMENT_STATUS_LABELS[event.status],
                            body: [event.location, event.note]
                              .filter(Boolean)
                              .join(" · "),
                            at: event.createdAt,
                          }))}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        No updates have been recorded for this consignment yet.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[4px] border border-line bg-card px-4 py-3">
        <p className="max-w-xl text-[0.62rem] leading-5 text-muted-foreground">
          Tracking statuses are controlled only by vault operations: preparing,
          in transit, held at customs, out for delivery, delivered, delayed and
          cancelled. If a shipment needs attention, the latest update will say
          what is happening.
        </p>
        <p className="text-[0.6rem] font-medium text-ink">
          {stats.active} active · {stats.delivered} delivered
        </p>
      </div>
    </div>
  );
}
