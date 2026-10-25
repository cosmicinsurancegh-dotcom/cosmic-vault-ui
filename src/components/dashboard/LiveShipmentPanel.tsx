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
 * Four milestones on one line, the same rhythm as the live journey: what has
 * happened, where the consignment is now, and what the estimate says next.
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

  return (
    <ol
      className="grid grid-cols-4"
      aria-label={`Milestones for ${shipment.reference}`}
    >
      {SHIPMENT_STAGES.map((stage, index) => {
        const complete = index < count - 1;
        const current = index === count - 1;
        const at =
          reached.get(stage.key as ShipmentStatus) ??
          (current ? shipment.lastStatusAt : undefined);
        const Icon = stageIcons[index];
        const future = !complete && !current;
        const estimateOnly = future && index === SHIPMENT_STAGES.length - 1;

        return (
          <li
            key={stage.key}
            className="relative flex min-w-0 flex-col items-center px-1 text-center"
            aria-current={current ? "step" : undefined}
          >
            {index < SHIPMENT_STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[calc(50%+30px)] top-6 h-px w-[calc(100%-60px)]",
                  complete ? "bg-primary/40" : "bg-line",
                )}
              />
            )}
            <span
              className={cn(
                "relative grid size-12 place-items-center rounded-full ring-4 transition-colors",
                complete &&
                  "bg-primary text-primary-foreground ring-primary/10",
                current &&
                  (attention
                    ? "bg-amber-500 text-white ring-amber-500/15"
                    : "bg-primary text-primary-foreground ring-primary/15"),
                future &&
                  "bg-muted text-muted-foreground/60 ring-muted-foreground/5",
              )}
            >
              {future ? (
                <span className="size-2 rounded-full bg-muted-foreground/40" />
              ) : (
                <Icon className="size-5" strokeWidth={2.2} />
              )}
            </span>
            <p
              className={cn(
                "mt-3 w-full truncate text-[0.72rem] font-semibold tracking-[-0.01em]",
                future ? "text-muted-foreground/70" : "text-ink",
              )}
            >
              {stage.label}
            </p>
            <p className="mt-1 text-[0.6rem] tabular-nums text-muted-foreground">
              {complete || current
                ? (day(at) ?? "Pending")
                : estimateOnly
                  ? (day(shipment.estimatedArrivalAt) ?? "Estimated")
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
    <div
      id={id}
      className={cn(
        "border-t border-line bg-[linear-gradient(180deg,var(--ice)_0%,transparent_70%)] px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[0.9rem] font-semibold tracking-[-0.02em] text-ink">
          Live shipment tracking
        </h3>
        <ShipmentStateChip
          status={shipment.status}
          className="px-3 py-1.5 text-[0.66rem]"
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
