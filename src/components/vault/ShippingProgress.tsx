import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  CirclePause,
  Clock3,
  Minus,
  PackageCheck,
  Truck,
} from "lucide-react";
import type {
  Shipment,
  ShipmentEvent,
  ShippingStatus,
} from "@/lib/vault/types";
import { SHIPPING_STATUSES, SHIPPING_STATUS_META } from "@/lib/vault/types";

type StepState = "complete" | "active" | "skipped" | "future";

const ACTIVE_BORDER: Record<ShippingStatus, string> = {
  pending: "border-muted-foreground/45",
  in_progress: "border-electric-soft",
  on_hold: "border-amber-500",
  in_transit: "border-primary",
  shipped: "border-emerald-500",
};

/* The live step wears the same filled marker as its status chip. */
const ACTIVE_FILL: Record<ShippingStatus, string> = {
  pending: "border-muted-foreground/40 bg-muted text-muted-foreground",
  in_progress: "border-primary bg-primary text-primary-foreground",
  on_hold: "border-amber-500 bg-amber-500 text-white",
  in_transit: "border-primary bg-primary text-primary-foreground",
  shipped: "border-emerald-600 bg-emerald-600 text-white",
};

const ACTIVE_RING: Record<ShippingStatus, string> = {
  pending: "ring-muted-foreground/10",
  in_progress: "ring-primary/15",
  on_hold: "ring-amber-500/15",
  in_transit: "ring-primary/15",
  shipped: "ring-emerald-500/15",
};

function shortStamp(at?: number) {
  if (!at) return "Awaiting";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
}

function buildSteps(shipment: Shipment) {
  const currentIndex = SHIPPING_STATUS_META[shipment.currentStatus].index;
  const latestByStatus = new Map<ShippingStatus, ShipmentEvent>();
  for (const event of shipment.statusHistory) {
    latestByStatus.set(event.status, event);
  }
  return SHIPPING_STATUSES.map((status) => {
    const meta = SHIPPING_STATUS_META[status];
    const event = latestByStatus.get(status);
    let state: StepState;
    if (meta.index < currentIndex) {
      state = event ? "complete" : "skipped";
    } else if (meta.index === currentIndex) {
      state = "active";
    } else {
      state = "future";
    }
    return { status, meta, event, state };
  });
}

function StepDot({
  state,
  status,
  active,
  reduceMotion,
}: {
  state: StepState;
  status: ShippingStatus;
  active: boolean;
  reduceMotion: boolean | null;
}) {
  const ActiveIcon =
    status === "pending"
      ? Clock3
      : status === "in_progress"
        ? PackageCheck
        : status === "on_hold"
          ? CirclePause
          : status === "in_transit"
            ? Truck
            : Check;
  return (
    <span className="relative grid size-8 shrink-0 place-items-center">
      {active && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full border",
            ACTIVE_BORDER[status],
          )}
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.span
        key={state}
        initial={reduceMotion ? false : { scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative grid size-8 place-items-center rounded-full border text-[0.6rem] font-semibold",
          state === "complete" &&
            "border-primary bg-primary text-primary-foreground shadow-[0_6px_14px_-8px_var(--electric)]",
          state === "active" &&
            cn("border-2 ring-4", ACTIVE_FILL[status], ACTIVE_RING[status]),
          state === "skipped" &&
            "border-dashed border-line bg-card text-muted-foreground",
          state === "future" && "border-line bg-card text-muted-foreground/55",
        )}
      >
        {state === "complete" ? (
          <Check className="size-3.5" strokeWidth={2.4} />
        ) : state === "skipped" ? (
          <Minus className="size-3" strokeWidth={2.2} />
        ) : state === "active" ? (
          <ActiveIcon className="size-4" strokeWidth={2.4} />
        ) : (
          <span className="size-1.5 rounded-full bg-line" />
        )}
      </motion.span>
    </span>
  );
}

export function ShippingProgress({
  shipment,
  orientation = "horizontal",
  showNotes = false,
  className,
}: {
  shipment: Shipment;
  orientation?: "horizontal" | "vertical";
  showNotes?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const steps = buildSteps(shipment);
  const currentIndex = SHIPPING_STATUS_META[shipment.currentStatus].index;
  const currentMeta = SHIPPING_STATUS_META[shipment.currentStatus];

  if (orientation === "vertical") {
    return (
      <ol
        className={cn("relative", className)}
        aria-label={`Shipment ${shipment.trackingNumber}: ${currentMeta.longLabel}`}
      >
        {steps.map(({ status, meta, event, state }, index) => {
          const last = index === steps.length - 1;
          return (
            <motion.li
              key={status}
              initial={reduceMotion ? false : { opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                delay: index * 0.04,
                ease: "easeOut",
              }}
              className={cn("relative flex gap-3.5", last ? "pb-0" : "pb-5")}
              aria-current={state === "active" ? "step" : undefined}
            >
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%-32px)] w-px transition-colors duration-500",
                    meta.index < currentIndex ? "bg-primary/35" : "bg-line",
                  )}
                />
              )}
              <StepDot
                state={state}
                status={status}
                active={state === "active"}
                reduceMotion={reduceMotion}
              />
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p
                    className={cn(
                      "text-[0.72rem] font-semibold",
                      state === "future"
                        ? "text-muted-foreground/60"
                        : "text-ink",
                    )}
                  >
                    {meta.longLabel}
                  </p>
                  <span className="text-[0.58rem] text-muted-foreground">
                    {state === "skipped"
                      ? "Not required"
                      : shortStamp(event?.at)}
                  </span>
                </div>
                {showNotes && (
                  <p
                    className={cn(
                      "mt-0.5 max-w-[42rem] text-[0.66rem] leading-5",
                      state === "future"
                        ? "text-muted-foreground/45"
                        : "text-muted-foreground",
                    )}
                  >
                    {state === "skipped"
                      ? "This step was not needed for this route."
                      : (event?.note ?? meta.description)}
                  </p>
                )}
                {state === "active" && event?.actor && (
                  <p className="mt-1 text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                    Updated by {event.actor}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol
      className={cn("grid grid-cols-5", className)}
      aria-label={`Shipment ${shipment.trackingNumber}: ${currentMeta.longLabel}`}
    >
      {steps.map(({ status, meta, event, state }, index) => {
        const lineFilled = meta.index < currentIndex;
        return (
          <li
            key={status}
            className="relative flex min-w-0 flex-col items-center px-1 text-center"
            aria-current={state === "active" ? "step" : undefined}
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[calc(50%+18px)] top-4 h-px w-[calc(100%-36px)] transition-colors duration-500",
                  lineFilled ? "bg-primary/35" : "bg-line",
                )}
              />
            )}
            <StepDot
              state={state}
              status={status}
              active={state === "active"}
              reduceMotion={reduceMotion}
            />
            <p
              className={cn(
                "mt-2 text-[0.6rem] font-semibold leading-4",
                state === "active"
                  ? "text-ink"
                  : state === "future"
                    ? "text-muted-foreground/50"
                    : "text-ink/70",
              )}
            >
              {meta.label}
            </p>
            <p className="mt-0.5 text-[0.55rem] tabular-nums text-muted-foreground/75">
              {state === "skipped" ? "Skipped" : shortStamp(event?.at)}
            </p>
            {showNotes && (
              <p className="mt-1 hidden max-w-[11rem] text-[0.58rem] leading-4 text-muted-foreground/75 xl:block">
                {event?.note ?? meta.description}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function shipmentProgressPercent(shipment: Shipment) {
  const index = SHIPPING_STATUS_META[shipment.currentStatus].index;
  return Math.max(
    8,
    Math.round((index / (SHIPPING_STATUSES.length - 1)) * 100),
  );
}
