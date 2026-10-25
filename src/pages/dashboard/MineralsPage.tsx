import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusPill,
  Timeline,
} from "@/components/dashboard/PlatformUI";
import { ShipmentRouteRail } from "@/components/dashboard/ShipmentRouteRail";
import { RequestShipmentDialog } from "@/components/vault/RequestShipmentDialog";
import { Button } from "@/components/ui/button";
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@/convex/lib/shipments";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney } from "@/lib/format";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { Gem, MapPin, PackageSearch, Truck } from "lucide-react";
import { useState } from "react";

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

/** A consignment the member is waiting on, as opposed to one already delivered. */
function shipmentInFlight(status?: ShipmentStatus) {
  return Boolean(status) && status !== "delivered" && status !== "cancelled";
}

export default function MineralsPage() {
  const minerals = useQuery(api.minerals.mine);
  const reduceMotion = useReducedMotion();
  const [requestFor, setRequestFor] = useState<Id<"minerals"> | null>(null);

  if (minerals === undefined) {
    return <LoadingState label="Loading your minerals" />;
  }

  const requested = requestFor
    ? minerals.find((row) => row.mineral._id === requestFor)?.mineral
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your minerals"
        title="Every consignment, with its cover and progress."
        description="Minerals assigned to your account by the logistics desk, with the policy that protects them. Request a shipment when one needs to move, and follow it here while we email you every milestone."
      />

      {minerals.length === 0 ? (
        <div className="rounded-[4px] border border-line bg-card">
          <EmptyState
            icon={Gem}
            title="No minerals assigned yet"
            description="When our logistics desk records a mineral under your account, its policy and shipment will appear here. You will also receive an email."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {minerals.map(
            (
              { mineral, policy, shipment, request, requests, events },
              index,
            ) => {
              /* The open request and the ones already answered, newest first. */
              const history = requests ?? [];
              const latestRequest = request ?? history[0] ?? null;
              return (
                <motion.section
                  key={mineral._id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="overflow-hidden rounded-[4px] border border-line bg-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {mineral.reference} · {mineral.category}
                      </p>
                      <h2 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                        {mineral.name}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {mineral.quantity.toLocaleString("en-GB")}{" "}
                        {mineral.unit} · declared at{" "}
                        {formatMoney(mineral.declaredValue, mineral.currency)}
                      </p>
                    </div>
                    <StatusPill status={shipment?.status ?? mineral.status} />
                  </div>

                  <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.1fr_1fr]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Policy
                        </p>
                        {policy ? (
                          <div className="mt-1.5 space-y-1">
                            <p className="text-sm font-medium text-ink">
                              {policy.policyNumber}
                            </p>
                            <p className="text-xs leading-5 text-muted-foreground">
                              {policy.provider} ·{" "}
                              {COVERAGE_LABELS[policy.coverage] ??
                                policy.coverage}{" "}
                              · cover limit{" "}
                              {formatMoney(
                                policy.coverageLimit,
                                policy.currency,
                              )}
                            </p>
                            <p className="text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
                              In force {formatDate(policy.startDate)} —{" "}
                              {formatDate(policy.endDate)}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            No policy has been recorded for this mineral.
                          </p>
                        )}
                      </div>

                      {mineral.description && (
                        <p className="text-xs leading-5 text-muted-foreground">
                          {mineral.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Shipment
                      </p>
                      {shipment ? (
                        <div className="mt-1.5 space-y-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 text-ink">
                              <MapPin className="size-3.5 shrink-0" />
                              {shipment.origin} → {shipment.destination}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Truck className="size-3.5 shrink-0" />
                              {shipment.carrier}
                            </span>
                          </div>
                          <ShipmentRouteRail
                            shipment={shipment}
                            events={events}
                            className="pt-1"
                          />
                          <dl className="grid grid-cols-2 gap-2 text-[0.62rem] text-muted-foreground">
                            <div>
                              <dt className="uppercase tracking-[0.1em]">
                                Reference
                              </dt>
                              <dd className="mt-0.5 text-xs text-ink">
                                {shipment.reference}
                              </dd>
                            </div>
                            {shipment.trackingNumber && (
                              <div>
                                <dt className="uppercase tracking-[0.1em]">
                                  Tracking
                                </dt>
                                <dd className="mt-0.5 text-xs text-ink">
                                  {shipment.trackingNumber}
                                </dd>
                              </div>
                            )}
                            <div>
                              <dt className="uppercase tracking-[0.1em]">
                                Estimated arrival
                              </dt>
                              <dd className="mt-0.5 text-xs text-ink">
                                {formatDate(shipment.estimatedArrivalAt)}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.1em]">
                                Current location
                              </dt>
                              <dd className="mt-0.5 text-xs text-ink">
                                {shipment.currentLocation ?? "In transit"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <PackageSearch className="size-3.5" /> No shipment
                          recorded yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                    <p className="max-w-lg text-[0.62rem] leading-5 text-muted-foreground">
                      {latestRequest?.status === "pending"
                        ? `Shipment requested for ${latestRequest.destination}${
                            latestRequest.preferredDate
                              ? ` around ${formatDate(latestRequest.preferredDate)}`
                              : ""
                          }. The logistics desk is setting it up.`
                        : latestRequest?.status === "declined"
                          ? `Your last request was declined${latestRequest.decisionNote ? `: ${latestRequest.decisionNote}` : "."}`
                          : shipmentInFlight(shipment?.status)
                            ? "This consignment is already moving. You can request another shipment once it is delivered."
                            : "Nothing is moving. Request a shipment and the logistics desk will book and track it."}
                    </p>
                    <div className="flex items-center gap-2">
                      {latestRequest?.status === "pending" ? (
                        <StatusPill status="pending" />
                      ) : shipmentInFlight(shipment?.status) ? null : (
                        <Button
                          size="sm"
                          className="h-8 rounded-[4px] px-3 text-[0.65rem]"
                          onClick={() => setRequestFor(mineral._id)}
                        >
                          <Truck className="size-3.5" /> Request shipment
                        </Button>
                      )}
                    </div>
                  </div>

                  {events.length > 0 && (
                    <div className="border-t border-line bg-background/40 px-5 py-4">
                      <p className="mb-3 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Progress updates
                      </p>
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
                  )}

                  {history.length > 0 && (
                    <div className="border-t border-line px-5 py-4">
                      <p className="mb-3 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Request history
                      </p>
                      <ul className="space-y-2">
                        {history.map((entry) => (
                          <li
                            key={entry._id}
                            className="flex flex-wrap items-start justify-between gap-2 rounded-[4px] border border-line bg-background/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[0.68rem] font-medium text-ink">
                                {entry.destination}
                                {entry.preferredDate
                                  ? ` · preferred ${formatDate(entry.preferredDate)}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-[0.6rem] leading-5 text-muted-foreground">
                                Requested {formatDate(entry.createdAt)}
                                {entry.decidedAt
                                  ? ` · decided ${formatDate(entry.decidedAt)}`
                                  : ""}
                                {entry.decisionNote
                                  ? ` · ${entry.decisionNote}`
                                  : ""}
                              </p>
                            </div>
                            <StatusPill status={entry.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.section>
              );
            },
          )}
        </div>
      )}

      {requested && (
        <RequestShipmentDialog
          key={requested._id}
          open
          mineral={requested}
          onOpenChange={(open) => {
            if (!open) setRequestFor(null);
          }}
        />
      )}
    </div>
  );
}
