import {
  EmptyState,
  LoadingState,
  PageHeader,
  StatusPill,
  Timeline,
} from "@/components/dashboard/PlatformUI";
import {
  SHIPMENT_STAGES,
  SHIPMENT_STATUS_LABELS,
  shipmentNeedsAttention,
  shipmentProgress,
} from "@/convex/lib/shipments";
import { api } from "@/convex/_generated/api";
import { formatDate, formatMoney } from "@/lib/format";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { Gem, MapPin, PackageSearch, Truck } from "lucide-react";

const COVERAGE_LABELS: Record<string, string> = {
  all_risk: "All risk",
  cargo_transit: "Cargo & transit",
  storage: "Storage",
  liability: "Liability",
};

export default function MineralsPage() {
  const minerals = useQuery(api.minerals.mine);
  const reduceMotion = useReducedMotion();

  if (minerals === undefined) {
    return <LoadingState label="Loading your minerals" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your minerals"
        title="Every consignment, with its cover and progress."
        description="Minerals assigned to your account by the logistics desk, with the policy that protects them and live shipment milestones. We email you whenever a shipment moves."
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
          {minerals.map(({ mineral, policy, shipment, events }, index) => (
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
                    {mineral.quantity.toLocaleString("en-GB")} {mineral.unit} ·
                    declared at{" "}
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
                          {COVERAGE_LABELS[policy.coverage] ?? policy.coverage}{" "}
                          · cover limit{" "}
                          {formatMoney(policy.coverageLimit, policy.currency)}
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
                      <div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={reduceMotion ? false : { width: 0 }}
                            animate={{
                              width: `${shipmentProgress(shipment.status)}%`,
                            }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={
                              shipmentNeedsAttention(shipment.status)
                                ? "h-full rounded-full bg-amber-500"
                                : "h-full rounded-full bg-primary"
                            }
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
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
