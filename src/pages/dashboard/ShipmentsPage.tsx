import { ShipmentBoardRow } from "@/components/dashboard/ShipmentBoardRow";
import {
  EmptyState,
  LoadingState,
  MetricTile,
  PageHeader,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { copyTracking } from "@/lib/clipboard";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  ClipboardCopy,
  Gem,
  MapPin,
  MoreVertical,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

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
  const [openId, setOpenId] = useState<string | null>(null);

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
      attention: all.filter((row) =>
        shipmentNeedsAttention(row.shipment.status),
      ).length,
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
        description="Request a shipment for any mineral in your vault, then follow it here. Vault operations book and move it, and every status change, location and note is published as it happens."
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
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search shipments"
              placeholder="Search by ID, tracking, carrier, mineral or city"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...SHIPMENT_STATUSES] as (ShipmentStatus | "all")[]).map(
              (option) => {
                const count = (rows ?? [])
                  .filter(hasShipment)
                  .filter(
                    (row) => option === "all" || row.shipment.status === option,
                  ).length;
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
                    {`${
                      option === "all" ? "All" : SHIPMENT_STATUS_LABELS[option]
                    } (${count})`}
                  </button>
                );
              },
            )}
          </div>
        </div>
        <p className="mt-2 border-t border-line/70 pt-2 text-[0.6rem] text-muted-foreground">
          Times shown in your local timezone · request a shipment from My
          minerals, then vault operations move it
        </p>
      </div>

      {shipments.length === 0 ? (
        <div className="rounded-[4px] border border-line bg-card">
          <EmptyState
            icon={Truck}
            title={
              search.trim() || status !== "all"
                ? "No shipments match."
                : "Nothing is moving right now."
            }
            description={
              search.trim() || status !== "all"
                ? "Try another status or clear the search. Shipments start from a request you send from My minerals, and only vault operations can change one."
                : "Request a shipment from My minerals and it will appear here once the logistics desk has booked it. We email you every update."
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
        </div>
      ) : (
        <div className="overflow-hidden rounded-[4px] border border-line bg-card">
          {shipments.map(({ mineral, policy, shipment, events }) => (
            <ShipmentBoardRow
              key={shipment._id}
              mineral={mineral}
              policy={policy}
              shipment={shipment}
              events={events}
              open={openId === shipment._id}
              onToggle={() =>
                setOpenId((current) =>
                  current === shipment._id ? null : shipment._id,
                )
              }
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${shipment.reference}`}
                      className="grid size-8 shrink-0 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-ice hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <MoreVertical className="size-4" strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setOpenId(shipment._id)}>
                      <MapPin className="size-3.5" />
                      Show live tracking
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => copyTracking(shipment.trackingNumber)}
                    >
                      <ClipboardCopy className="size-3.5" />
                      Copy tracking number
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/minerals">
                        <Gem className="size-3.5" />
                        View my minerals
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[4px] border border-line bg-card px-4 py-3">
        <p className="max-w-xl text-[0.62rem] leading-5 text-muted-foreground">
          Shipments start when the logistics desk books one you have requested;
          tracking statuses are then controlled only by vault operations:
          preparing, in transit, held at customs, out for delivery, delivered,
          delayed and cancelled. If a shipment needs attention, the latest
          update will say what is happening.
        </p>
        <p className="text-[0.6rem] font-medium text-ink">
          {stats.active} active · {stats.delivered} delivered
        </p>
      </div>
    </div>
  );
}
