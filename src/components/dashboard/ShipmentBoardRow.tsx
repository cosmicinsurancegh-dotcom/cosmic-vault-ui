import {
  LiveShipmentPanel,
  type JourneyMineral,
  type JourneyPolicy,
} from "./LiveShipmentPanel";
import { ShipmentRouteRail } from "./ShipmentRouteRail";
import {
  ShipmentSignalChip,
  ShipmentStateChip,
  type JourneyEvent,
  type JourneyShipment,
} from "./ShipmentJourney";
import { shipmentModeFor } from "./shipmentMode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyTracking } from "@/lib/clipboard";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ClipboardCopy,
  Clock3,
  Mail,
  MailCheck,
  MailX,
  Maximize2,
  RotateCw,
  UserRoundPlus,
} from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";

/** The last email attempt recorded for a consignment. */
export type ShipmentEmailState = {
  emailStatus: "queued" | "sent" | "skipped" | "failed";
  emailError: string | null;
  at: number;
  /** Queued for longer than a send should take: the delivery never reported. */
  stalled: boolean;
};

/**
 * The delivery state of the consignment's last email. A status change says
 * "queued" until the provider answers, so the board reads the result back
 * rather than assuming the owner was reached.
 *
 * A failed or stalled send also carries the way out of it: a resend from the
 * row, using the same stored message the failed attempt tried to deliver, so
 * staff never have to leave the board to fix a delivery.
 */
function ShipmentEmailChip({
  email,
  reference,
  onResend,
}: {
  email: ShipmentEmailState;
  /** The consignment's shipping ID, so a row's resend is named for it. */
  reference: string;
  onResend?: () => Promise<void>;
}) {
  const [resending, setResending] = useState(false);
  const failed = email.stalled || email.emailStatus === "failed";
  const skipped = email.emailStatus === "skipped";
  const sent = email.emailStatus === "sent";
  const Icon = sent ? MailCheck : failed || skipped ? MailX : Mail;
  const label = sent
    ? "Email sent"
    : failed
      ? email.stalled
        ? "Email stalled"
        : "Email failed"
      : skipped
        ? "Email skipped"
        : "Email queued";
  const detail = email.emailError
    ? `${label} · ${email.emailError}`
    : `${label} · ${formatDateTime(email.at)}`;

  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <p
        title={detail}
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 truncate text-[0.58rem] font-medium",
          failed || skipped
            ? "text-amber-700 dark:text-amber-400"
            : "text-muted-foreground",
        )}
      >
        <Icon className="size-3 shrink-0" strokeWidth={2.2} />
        <span className="truncate">{label}</span>
        <span className="truncate font-normal tabular-nums opacity-70">
          · {formatDateTime(email.at)}
        </span>
      </p>

      {/* Offered only where a resend can help: a skipped email has no address
          to reach, and a delivered one must not be sent twice. */}
      {failed && onResend ? (
        <button
          type="button"
          disabled={resending}
          onClick={async () => {
            setResending(true);
            try {
              await onResend();
            } finally {
              setResending(false);
            }
          }}
          title="Queue this consignment's last email again"
          aria-label={`Resend the last email for ${reference}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-amber-600/40 px-1.5 py-0.5 text-[0.55rem] font-semibold text-amber-700 transition-colors hover:border-amber-600 hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-400"
        >
          <RotateCw
            className={cn("size-2.5", resending && "animate-spin")}
            strokeWidth={2.4}
          />
          {resending ? "Resending" : "Resend"}
        </button>
      ) : null}
    </div>
  );
}

/** Anything the row itself controls, which a card click must leave alone. */
const ROW_ACTIONS =
  "a, button, input, select, textarea, [role='menuitem'], [data-row-action]";

/**
 * One consignment on the dispatch board: identity and exceptions on the left,
 * the route rail in the middle, and the row's controls on the right. The live
 * tracking view opens in a dialog over the board — from the row's own button or
 * from anywhere on the card.
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
  email,
  onResendEmail,
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
  /** Staff only: the last email about this consignment; `null` means none. */
  email?: ShipmentEmailState | null;
  /** Staff only: queues the last email again; shown only if a send failed. */
  onResendEmail?: () => Promise<void>;
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
  const label = shipment.reference;

  const showTracking = () => {
    if (!open) onToggle();
  };

  /* The row is one big target, so a click on the copy button, a control or the
     actions menu does its own job instead of opening the tracking view. */
  const openFromCard = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest(ROW_ACTIONS)) return;
    showTracking();
  };

  return (
    <article
      onClick={openFromCard}
      className={cn(
        "cursor-pointer border-b border-line/70 last:border-b-0",
        className,
      )}
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

          {/* The owner line says who should be reached; this says whether the
              last email actually reached them. */}
          {email ? (
            <ShipmentEmailChip
              email={email}
              reference={label}
              onResend={onResendEmail}
            />
          ) : null}

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
            onClick={showTracking}
            aria-haspopup="dialog"
            aria-label={`Open live tracking for ${label}`}
            title="Open live tracking"
            className="grid size-8 shrink-0 place-items-center rounded-[4px] border border-line text-muted-foreground transition-colors hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Maximize2 className="size-3.5" strokeWidth={2.2} />
          </button>

          {menu}
          {controls}
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onToggle();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[4px] border-line bg-background sm:max-w-5xl">
          <DialogTitle className="sr-only">
            Live tracking for {label}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {shipment.carrier} · {shipment.origin} to {shipment.destination}.
            Escape closes this view.
          </DialogDescription>
          <LiveShipmentPanel
            id={panelId}
            shipment={shipment}
            events={events}
            mineral={mineral}
            policy={policy}
          />
        </DialogContent>
      </Dialog>
    </article>
  );
}
