import { shipmentModeFor } from "./shipmentMode";
import {
  ShipmentStateChip,
  type JourneyEvent,
  type JourneyShipment,
} from "./ShipmentJourney";
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  shipmentStageCount,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  Copy,
  History,
  Loader2,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Suspense, lazy, useEffect, useState } from "react";
import { toast } from "sonner";

/* The mapping library is large and only needed once a row is open, so it is
   fetched with the panel rather than with the tracking desk. */
const ShipmentMap = lazy(() =>
  import("./ShipmentMap").then((module) => ({ default: module.ShipmentMap })),
);

export type JourneyMineral = {
  name: string;
  reference: string;
  category: string;
  quantity: number;
  unit: string;
  declaredValue: number;
  currency: string;
};

export type JourneyPolicy = {
  policyNumber: string;
  provider: string;
  coverage: string;
  coverageLimit: number;
  currency: string;
} | null;

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo in transit",
  storage: "Storage",
  liability: "Liability",
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const FULL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function day(at?: number) {
  return at ? DAY.format(new Date(at)) : null;
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      toast.success("Tracking number copied.");
    } catch {
      toast.error("Could not reach the clipboard.");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy tracking number ${value}`}
      className="grid size-6 shrink-0 place-items-center rounded-[4px] border border-line text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {copied ? (
        <Check className="size-3" strokeWidth={2.6} />
      ) : (
        <Copy className="size-3" strokeWidth={2.2} />
      )}
    </button>
  );
}

function InfoItem({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.66rem] text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[0.82rem] font-medium text-ink">
        <Icon className="size-4 shrink-0 text-ink/60" strokeWidth={1.9} />
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {children}
        </span>
      </div>
    </div>
  );
}

/**
 * Four milestones on one line, drawn in the route rail's language — a dashed
 * track with a solid progress fill, diamond waypoints and ringed markers — so
 * the popup reads as the same tracking view as the board it opened from.
 */
function LifecycleStepper({
  shipment,
  events,
}: {
  shipment: JourneyShipment;
  events: JourneyEvent[];
}) {
  const mode = shipmentModeFor(shipment.carrier);
  const count = shipmentStageCount(shipment.status);
  const attention = shipmentNeedsAttention(shipment.status);
  const reached = new Map<ShipmentStatus, number>();
  for (const event of [...events].sort(
    (left, right) => left.createdAt - right.createdAt,
  )) {
    reached.set(event.status, event.createdAt);
  }

  const stageIcons: ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>[] = [PackageCheck, mode.Icon, Truck, Check];

  const lastIndex = SHIPMENT_STAGES.length - 1;
  const progress = Math.max(count - 1, 0) / lastIndex;

  return (
    <ol
      className="relative grid grid-cols-4 items-start gap-1"
      aria-label={`Milestones for ${shipment.reference}`}
    >
      {/* The same track the rail draws: dashed ahead, filled behind. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-4 h-0 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/25"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-[12.5%] top-4 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-500",
          attention
            ? "bg-amber-500 shadow-[0_2px_7px_-1px_var(--halo)]"
            : "bg-primary shadow-[0_2px_7px_-1px_var(--electric)]",
        )}
        style={{ width: `calc(75% * ${progress})` }}
      />
      {[1 / 6, 1 / 2, 5 / 6].map((point) => (
        <span
          key={point}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-[13px] size-[7px] -translate-x-1/2 rotate-45 rounded-[1px] border",
            point <= progress
              ? attention
                ? "border-amber-500 bg-amber-500"
                : "border-primary bg-primary"
              : "border-line bg-card",
          )}
          style={{ left: `calc(12.5% + 75% * ${point})` }}
        />
      ))}

      {SHIPMENT_STAGES.map((stage, index) => {
        const complete = index < count - 1;
        const current = index === count - 1;
        const at =
          reached.get(stage.key as ShipmentStatus) ??
          (current ? shipment.lastStatusAt : undefined);
        const Icon = stageIcons[index];
        const future = !complete && !current;
        const estimateOnly = future && index === lastIndex;

        return (
          <li
            key={stage.key}
            className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center"
            aria-current={current ? "step" : undefined}
          >
            <span
              className={cn(
                "relative grid size-8 place-items-center rounded-full border ring-4 ring-card transition-colors",
                complete && "border-primary bg-primary text-primary-foreground",
                current &&
                  (attention
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-primary bg-primary text-primary-foreground"),
                future && "border-line bg-card text-muted-foreground/55",
              )}
            >
              <Icon className="size-4" strokeWidth={2.4} />
            </span>
            <p
              className={cn(
                "mt-2.5 w-full truncate text-[0.76rem] font-semibold leading-4 tracking-[-0.01em]",
                future ? "text-muted-foreground/60" : "text-ink",
              )}
            >
              {stage.label}
            </p>
            <p className="mt-1 w-full truncate text-[0.58rem] tabular-nums text-muted-foreground">
              {complete || current
                ? (day(at) ?? "Pending")
                : estimateOnly
                  ? `Est. ${day(shipment.estimatedArrivalAt) ?? "pending"}`
                  : "Pending"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function SideCard({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h4 className="flex items-center gap-1.5 text-[0.8rem] font-semibold tracking-[-0.01em] text-ink">
        <Icon className="size-4 text-primary" strokeWidth={2} />
        {title}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

/**
 * The live tracking card for one consignment: the four facts that identify the
 * journey, the milestone line, the geocoded route and the record behind it.
 */
export function LiveShipmentPanel({
  shipment,
  events,
  mineral,
  policy,
  className,
  id,
}: {
  shipment: JourneyShipment;
  events: JourneyEvent[];
  mineral: JourneyMineral;
  policy?: JourneyPolicy;
  className?: string;
  id?: string;
}) {
  const mode = shipmentModeFor(shipment.carrier);
  const delivered = shipment.status === "delivered";
  const arrival = delivered
    ? shipment.lastStatusAt
    : shipment.estimatedArrivalAt;
  const tracking = shipment.trackingNumber ?? shipment.reference;

  return (
    <div id={id} className={cn("min-w-0", className)}>
      {/* The close control sits in the dialog's top-right corner. */}
      <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
        <h3 className="text-[0.9rem] font-semibold tracking-[-0.02em] text-ink">
          Live shipment tracking
        </h3>
        <ShipmentStateChip
          status={shipment.status}
          className="text-[0.66rem]"
        />
      </div>

      <div className="mt-3 grid gap-4 rounded-xl border border-line bg-card px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Tracking number" icon={PackageSearch}>
          <span className="truncate">{tracking}</span>
          <CopyValue value={tracking} />
        </InfoItem>
        <InfoItem label="Transport mode" icon={mode.Icon}>
          {mode.label}
        </InfoItem>
        <InfoItem label="Carrier" icon={mode.Icon}>
          {shipment.carrier}
        </InfoItem>
        <InfoItem label="Estimated delivery" icon={CalendarDays}>
          {arrival ? FULL.format(new Date(arrival)) : "Awaiting an estimate"}
        </InfoItem>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-line bg-card px-4 py-5">
            <LifecycleStepper shipment={shipment} events={events} />
          </div>

          <Suspense
            fallback={
              <div className="flex h-[280px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-ice text-[0.65rem] text-muted-foreground sm:h-[320px]">
                <Loader2 className="size-3.5 animate-spin" />
                Preparing the route map…
              </div>
            }
          >
            <ShipmentMap
              origin={shipment.origin}
              destination={shipment.destination}
              currentLocation={shipment.currentLocation}
              mode={mode}
              className="h-[280px] w-full sm:h-[320px]"
            />
          </Suspense>
        </div>

        <div className="space-y-3">
          <SideCard icon={PackageSearch} title="Shipment details">
            <dl className="space-y-2.5 text-[0.68rem]">
              <DetailRow label="Cargo type">{mineral.category}</DetailRow>
              <DetailRow label="Quantity">
                {mineral.quantity.toLocaleString("en-GB")} {mineral.unit}
              </DetailRow>
              <DetailRow label="Declared value">
                {formatMoney(mineral.declaredValue, mineral.currency)}
              </DetailRow>
              <DetailRow label="Booking ref.">{shipment.reference}</DetailRow>
              <DetailRow label="Tracking">{tracking}</DetailRow>
            </dl>
          </SideCard>

          <SideCard icon={ShieldCheck} title="Cover">
            {policy ? (
              <dl className="space-y-2.5 text-[0.68rem]">
                <DetailRow label="Cover type">
                  {COVERAGE_LABELS[policy.coverage] ?? policy.coverage}
                </DetailRow>
                <DetailRow label="Policy no.">{policy.policyNumber}</DetailRow>
                <DetailRow label="Provider">{policy.provider}</DetailRow>
                <DetailRow label="Limit">
                  {formatMoney(policy.coverageLimit, policy.currency)}
                </DetailRow>
              </dl>
            ) : (
              <p className="text-[0.62rem] leading-5 text-muted-foreground">
                Vault operations have not attached a policy to this consignment.
                Ask your broker before it moves again.
              </p>
            )}
          </SideCard>

          <SideCard icon={History} title="Progress updates">
            {events.length === 0 ? (
              <p className="text-[0.62rem] leading-5 text-muted-foreground">
                No updates have been recorded for this consignment yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {events.slice(0, 4).map((event, index) => (
                  <li
                    key={`${event.createdAt}-${index}`}
                    className="relative pl-4"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 size-1.5 rounded-full bg-primary"
                    />
                    <p className="text-[0.64rem] font-semibold text-ink">
                      {SHIPMENT_STATUS_LABELS[event.status]}
                    </p>
                    <p className="mt-0.5 text-[0.58rem] tabular-nums text-muted-foreground">
                      {formatDate(event.createdAt)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    {event.note && (
                      <p className="mt-0.5 text-[0.6rem] leading-4 text-muted-foreground">
                        {event.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </SideCard>
        </div>
      </div>
    </div>
  );
}
