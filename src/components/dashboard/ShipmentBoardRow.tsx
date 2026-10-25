import {
  LiveShipmentPanel,
  type JourneyMineral,
  type JourneyPolicy,
} from "./LiveShipmentPanel";
import {
  ShipmentRouteRail,
  ShipmentSignalChip,
  ShipmentStateChip,
  type JourneyEvent,
  type JourneyShipment,
} from "./ShipmentJourney";
import { shipmentModeFor } from "./shipmentMode";
import { copyTracking } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ClipboardCopy,
  Clock3,
  UserRoundPlus,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * One consignment on the dispatch board: identity and exceptions on the left,
 * the route rail in the middle, and the row's controls on the right. The live
 * tracking panel opens beneath it, inside the same record.
 *
 * The member desk and the staff console share this row; staff add an owner line
 * and their own controls, members get the actions menu.
 */
export function ShipmentBoardRow({
  mineral,
  policy,
  shipment,
  events,
  open,
  onToggle,
  owner,
  controls,
  menu,
  className,
}: {
  mineral: JourneyMineral;
  policy?: JourneyPolicy;
  shipment: JourneyShipment & { _id: string };
  events: JourneyEvent[];
  open: boolean;
  onToggle: () => void;
  /** Staff only: `null` means the mineral has no owner yet. */
  owner?: { name: string; email: string } | null;
  /** Staff only: status and assignment controls. */
  controls?: ReactNode;
  /** Member only: the row's actions menu. */
  menu?: ReactNode;
  className?: string;
}) {
  const mode = shipmentModeFor(shipment.carrier);
  const latest = events[0];
  const eta =
    shipment.status === "delivered"
      ? shipment.lastStatusAt
      : shipment.estimatedArrivalAt;
  const panelId = `live-${shipment._id}`;

  return (
    <article
      className={cn("border-b border-line/70 last:border-b-0", className)}
    >
      <div className="grid gap-4 px-4 py-4 transition-colors hover:bg-ice/25 sm:px-5 lg:grid-cols-[236px_minmax(0,1fr)_auto] lg:items-start lg:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-primary/10 text-primary">
              <mode.Icon className="size-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Shipping ID
              </p>
              <p className="truncate text-[0.8rem] font-semibold tracking-[-0.01em] text-ink">
                {shipment.reference}
              </p>
            </div>
          </div>

          {shipment.trackingNumber && (
            <button
              type="button"
              onClick={() => copyTracking(shipment.trackingNumber)}
              title="Copy tracking number"
              className="mt-1.5 flex max-w-full items-center gap-1.5 text-[0.62rem] font-medium tabular-nums text-primary transition-colors hover:text-ink"
            >
              <span className="truncate">{shipment.trackingNumber}</span>
              <ClipboardCopy className="size-3 shrink-0" />
            </button>
          )}

          <p className="mt-1 truncate text-[0.66rem] font-medium text-ink">
            {mineral.name}
            <span className="text-muted-foreground">
              {" · "}
              {mineral.quantity.toLocaleString("en-GB")} {mineral.unit}
            </span>
          </p>

          {owner !== undefined && (
            <p className="mt-1 truncate text-[0.58rem] text-muted-foreground">
              {owner ? (
                `${owner.name} · ${owner.email}`
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-amber-500/10 px-1.5 py-0.5 text-[0.58rem] font-semibold text-amber-700 dark:text-amber-400">
                  <UserRoundPlus className="size-3" strokeWidth={2.4} />
                  Unassigned
                </span>
              )}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ShipmentStateChip status={shipment.status} />
            <ShipmentSignalChip shipment={shipment} />
          </div>

          {eta && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-[4px] bg-ice px-2 py-1 text-[0.6rem] font-medium tabular-nums text-ink/70">
              <Clock3 className="size-3" strokeWidth={2.2} />
              {formatDate(eta)}
            </p>
          )}

          {latest?.note && (
            <p className="mt-1.5 line-clamp-2 text-[0.58rem] leading-4 text-muted-foreground">
              {latest.note}
            </p>
          )}
        </div>

        <ShipmentRouteRail
          shipment={shipment}
          events={events}
          className="min-w-0"
        />

        <div className="flex flex-wrap items-center gap-1.5 lg:flex-col lg:items-end">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${
              open ? "Hide" : "Show"
            } live tracking for ${shipment.reference}`}
            title={open ? "Hide live tracking" : "Show live tracking"}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              open
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-line text-muted-foreground hover:border-primary/35 hover:text-primary",
            )}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
              strokeWidth={2.2}
            />
          </button>

          {menu}
          {controls}
        </div>
      </div>

      {open && (
        <LiveShipmentPanel
          id={panelId}
          shipment={shipment}
          events={events}
          mineral={mineral}
          policy={policy}
        />
      )}
    </article>
  );
}
