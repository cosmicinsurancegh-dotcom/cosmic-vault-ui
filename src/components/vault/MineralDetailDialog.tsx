import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime, formatMoneyValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MINERAL_PLANS, premiumLabel } from "@/lib/vault/plans";
import type { Mineral, VaultActor } from "@/lib/vault/types";
import { formatAddress, formatWeight } from "@/lib/vault/types";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardCopy,
  FileCheck2,
  FileText,
  Gem,
  MapPin,
  PackageCheck,
  Ruler,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkle,
  Truck,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { MineralVisual } from "./MineralVisual";
import { ShipmentRouteRail } from "@/components/dashboard/ShipmentRouteRail";
import { vaultRoute } from "./vaultRoute";
import {
  InsuranceBadge,
  ShippingStatusBadge,
} from "./StatusBadges";
import {
  ClaimDialog,
  InsuranceRequestDialog,
  PlanMiniCard,
} from "./VaultActions";
import {
  VaultDocumentDialog,
  type VaultDocumentKind,
} from "./VaultDocuments";

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h3 className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h3>
        {description && (
          <p className="mt-1 max-w-2xl text-[0.7rem] leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[0.72rem] font-medium leading-5 text-ink">
        {value}
      </dd>
    </div>
  );
}

function InsuranceTimeline({ mineral }: { mineral: Mineral }) {
  const policy = mineral.insurancePolicy;
  if (!policy) return null;
  return (
    <ol className="space-y-3.5">
      {[...policy.statusHistory].reverse().map((event, index) => (
        <li key={`${event.at}-${index}`} className="relative pl-4">
          <span
            className={cn(
              "absolute left-0 top-1.5 size-1.5 rounded-[4px]",
              event.status === "active"
                ? "bg-emerald-500"
                : event.status === "pending"
                  ? "bg-amber-500"
                  : "bg-muted-foreground/50",
            )}
          />
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {formatDateTime(event.at)}
          </p>
          <p className="mt-0.5 text-[0.68rem] leading-5 text-ink">{event.note}</p>
          <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
            {event.actor}
          </p>
        </li>
      ))}
    </ol>
  );
}

function PolicySection({
  mineral,
  actor,
  onFileClaim,
}: {
  mineral: Mineral;
  actor: VaultActor;
  onFileClaim: () => void;
}) {
  const [requestPlan, setRequestPlan] = useState<string | null>(null);
  const policy = mineral.insurancePolicy;
  const active = policy?.status === "active";

  if (!policy) {
    return (
      <section className="border-t border-line px-5 py-6 sm:px-7">
        <SectionHeading
          eyebrow="Protection"
          title="This piece is not insured yet."
          description="Choose one of the recommended policies below. Vault operations confirm the final terms before cover starts."
        />
        <div className="mt-4 grid gap-2.5 md:grid-cols-3">
          {MINERAL_PLANS.map((plan) => (
            <PlanMiniCard
              key={plan.id}
              plan={plan}
              mineral={mineral}
              onSelect={() => setRequestPlan(plan.id)}
            />
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-[0.62rem] leading-5 text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          An uninsured piece can still be stored, but a claim cannot be filed until
          cover is active. Vault operations can bind one of these plans to the
          record once the appraisal is confirmed.
        </p>
        <InsuranceRequestDialog
          mineral={mineral}
          actor={actor}
          open={Boolean(requestPlan)}
          initialPlanId={requestPlan ?? undefined}
          onOpenChange={(open) => !open && setRequestPlan(null)}
        />
      </section>
    );
  }

  return (
    <section className="border-t border-line px-5 py-6 sm:px-7">
      <SectionHeading
        eyebrow="Protection"
        title="Insurance policy"
        description="The schedule below is the policy bound to this vault record."
        action={
          <Button
            size="sm"
            className="h-9 rounded-[4px] px-4"
            onClick={onFileClaim}
            disabled={!active}
          >
            <FileCheck2 className="size-3.5" />
            File a claim
          </Button>
        }
      />

      {!active && (
        <div className="mt-4 flex items-start gap-2 rounded-[4px] border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-2.5 text-[0.66rem] leading-5 text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          {policy.status === "pending"
            ? "This policy is awaiting final underwriting sign-off. Claims cannot be filed until it is active."
            : "This policy has expired. Ask vault operations for a renewal before filing a claim."}
        </div>
      )}

      <div className="mt-4 grid gap-3.5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[4px] border border-line bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {policy.planType}
              </p>
              <p className="mt-1 text-[0.98rem] font-semibold tracking-[-0.02em] text-ink">
                {policy.name}
              </p>
              <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                {policy.policyNumber}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[0.58rem] font-semibold",
                active
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : policy.status === "pending"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-line bg-muted text-muted-foreground",
              )}
            >
              <ShieldCheck className="size-3" />
              {active ? "In force" : policy.status === "pending" ? "Pending" : "Expired"}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-line pt-4 sm:grid-cols-3">
            <Field
              label="Coverage"
              value={formatMoneyValue(policy.coverageAmount, policy.currency)}
            />
            <Field
              label="Premium"
              value={
                <>
                  {formatMoneyValue(policy.premium, policy.currency)}
                  <span className="ml-1 text-[0.6rem] font-normal text-muted-foreground">
                    {premiumLabel(policy)}
                  </span>
                </>
              }
            />
            <Field
              label="Deductible"
              value={formatMoneyValue(policy.deductible, policy.currency)}
            />
            <Field label="Start date" value={formatDate(policy.startDate)} />
            <Field
              label={policy.status === "expired" ? "Expired" : "Renewal date"}
              value={formatDate(policy.endDate)}
            />
            <Field label="Billing" value={`${policy.premiumFrequency} · ${policy.currency}`} />
          </dl>

          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <div>
              <p className="text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What is covered
              </p>
              <ul className="mt-2 space-y-1.5">
                {policy.coverageDetails.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[0.67rem] leading-5 text-ink">
                    <Check className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What is not covered
              </p>
              <ul className="mt-2 space-y-1.5">
                {policy.exclusions.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[0.67rem] leading-5 text-muted-foreground">
                    <X className="mt-0.5 size-3 shrink-0 text-muted-foreground/60" strokeWidth={2.2} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border border-line bg-ice/25 p-4 sm:p-5">
          <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Policy history
          </p>
          <div className="mt-3">
            <InsuranceTimeline mineral={mineral} />
          </div>
          <div className="mt-4 border-t border-line/70 pt-3">
            <p className="flex items-start gap-1.5 text-[0.6rem] leading-4 text-muted-foreground">
              <BadgeCheck className="mt-0.5 size-3 shrink-0 text-primary" />
              Every change is timestamped and attached to the member record.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShippingSection({ mineral }: { mineral: Mineral }) {
  const shipment = mineral.shipping;
  if (!shipment) {
    return (
      <section className="border-t border-line px-5 py-6 sm:px-7">
        <SectionHeading
          eyebrow="Movement"
          title="No shipment in progress"
          description="This mineral is held in its assigned vault location. Vault operations will publish tracking here when a shipment is authorised."
        />
        <div className="mt-4 flex flex-col gap-3 rounded-[4px] border border-dashed border-line bg-ice/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-card text-primary">
              <PackageCheck className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink">{mineral.storageLocation}</p>
              <p className="mt-0.5 text-[0.64rem] text-muted-foreground">
                Stored under dual control · deposited {formatDate(mineral.depositDate)}
              </p>
            </div>
          </div>
          <span className="text-[0.6rem] text-muted-foreground">
            In vault · no tracking number
          </span>
        </div>
      </section>
    );
  }

  const active = shipment.currentStatus === "in_transit";
  const route = vaultRoute(shipment);
  return (
    <section className="border-t border-line px-5 py-6 sm:px-7">
      <SectionHeading
        eyebrow="Movement"
        title="Shipping & professional tracking"
        description="Controlled by vault operations. Every scan and status change is recorded against the consignment."
        action={<ShippingStatusBadge status={shipment.currentStatus} long />}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[4px] border border-line bg-card p-3.5">
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Tracking number
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(shipment.trackingNumber);
              toast.success("Tracking number copied.");
            }}
            className="mt-1 flex w-full items-center justify-between gap-2 text-left text-[0.7rem] font-semibold text-ink transition-colors hover:text-primary"
          >
            <span className="truncate">{shipment.trackingNumber}</span>
            <ClipboardCopy className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
        <div className="rounded-[4px] border border-line bg-card p-3.5">
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Carrier
          </p>
          <p className="mt-1 truncate text-[0.7rem] font-semibold text-ink">
            {shipment.carrier}
          </p>
          <p className="mt-0.5 truncate text-[0.56rem] text-muted-foreground">
            {shipment.service}
          </p>
        </div>
        <div className="rounded-[4px] border border-line bg-card p-3.5">
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Estimated delivery
          </p>
          <p className="mt-1 text-[0.7rem] font-semibold text-ink">
            {formatDate(shipment.estimatedDelivery)}
          </p>
          <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
            {active ? "On schedule" : "Per carrier update"}
          </p>
        </div>
        <div className="rounded-[4px] border border-line bg-card p-3.5">
          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Consignment
          </p>
          <p className="mt-1 text-[0.7rem] font-semibold text-ink">
            {shipment.deliveredAt ? "Delivered" : "In vault custody"}
          </p>
          <p className="mt-0.5 text-[0.56rem] text-muted-foreground">
            {shipment.statusHistory.length} recorded updates
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-[4px] border border-line bg-card p-4 sm:p-5">
          <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Live journey
          </p>
          <ShipmentRouteRail
            shipment={route.shipment}
            events={route.events}
            className="mt-4"
          />
        </div>
        <div className="rounded-[4px] border border-line bg-ice/25 p-4 sm:p-5">
          <div>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Origin
            </p>
            <p className="mt-1.5 text-[0.7rem] font-semibold text-ink">
              {shipment.origin.name}
            </p>
            <p className="mt-0.5 text-[0.63rem] leading-5 text-muted-foreground">
              {formatAddress(shipment.origin)}
            </p>
          </div>
          <div className="my-4 flex items-center gap-2 text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-px flex-1 bg-line" />
            <Truck className="size-3" />
            Secure transit
            <span className="h-px flex-1 bg-line" />
          </div>
          <div>
            <p className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Destination
            </p>
            <p className="mt-1.5 text-[0.7rem] font-semibold text-ink">
              {shipment.destination.name}
            </p>
            <p className="mt-0.5 text-[0.63rem] leading-5 text-muted-foreground">
              {formatAddress(shipment.destination)}
            </p>
          </div>
          <div className="mt-4 border-t border-line/70 pt-3">
            <p className="flex items-start gap-1.5 text-[0.6rem] leading-4 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-primary" />
              Tracking status can only be changed by vault operations. You will see
              each change here as it happens.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MineralDetailDialog({
  mineral,
  actor,
  open,
  onOpenChange,
}: {
  mineral: Mineral;
  actor: VaultActor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [activePhoto, setActivePhoto] = useState(mineral.photos[0]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [documentKind, setDocumentKind] = useState<VaultDocumentKind | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-[4px] border-line bg-background p-0 sm:max-w-[1040px]">
          <div className="grid md:grid-cols-[1.02fr_0.98fr]">
            <div className="relative min-h-[300px] md:min-h-[360px]">
              <MineralVisual
                mineral={{ ...mineral, photos: [activePhoto ?? mineral.photos[0]] }}
                className="size-full min-h-[300px] md:min-h-[360px]"
                overlay
              >
                <div className="absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-2">
                  <span className="rounded-[4px] border border-white/15 bg-[#071227]/55 px-2.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-bone/80 backdrop-blur-md">
                    {mineral.type}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <InsuranceBadge mineral={mineral} />
                    {mineral.shipping && (
                      <ShippingStatusBadge status={mineral.shipping.currentStatus} />
                    )}
                  </div>
                </div>
                {mineral.photos.length > 1 && (
                  <div className="absolute inset-x-4 bottom-4 flex gap-1.5">
                    {mineral.photos.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        onClick={() => setActivePhoto(photo)}
                        aria-label={`View photo ${index + 1} of ${mineral.name}`}
                        aria-pressed={activePhoto === photo}
                        className={cn(
                          "h-11 w-14 overflow-hidden rounded-[4px] border-2 transition-colors",
                          activePhoto === photo
                            ? "border-bone"
                            : "border-white/20 opacity-70 hover:opacity-100",
                        )}
                      >
                        <img
                          src={photo}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </MineralVisual>
            </div>

            <div className="p-5 sm:p-6">
              <DialogHeader className="text-left">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Vault record · {mineral.category}
                </p>
                <DialogTitle className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-[1.65rem]">
                  {mineral.name}
                </DialogTitle>
                <DialogDescription className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.65rem] text-muted-foreground">
                  <span>{mineral.vaultId}</span>
                  <span className="size-0.5 rounded-full bg-muted-foreground/50" />
                  <span>{mineral.certificateNumber}</span>
                  <span className="size-0.5 rounded-full bg-muted-foreground/50" />
                  <span>{mineral.storageLocation}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Appraised value
                  </p>
                  <p className="mt-1 text-[1.55rem] font-semibold leading-none tracking-[-0.04em] text-ink">
                    {formatMoneyValue(mineral.estimatedValue, mineral.currency)}
                  </p>
                  <p className="mt-1 text-[0.56rem] text-muted-foreground">
                    Refreshed {formatDate(mineral.valuationUpdatedAt)}
                  </p>
                </div>
                <span className="rounded-[4px] border border-line bg-ice/40 px-2.5 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {mineral.ownerReference}
                </span>
              </div>

              <p className="mt-4 text-[0.72rem] leading-6 text-muted-foreground">
                {mineral.description}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Field
                  label="Weight"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Scale className="size-3 text-primary" />
                      {formatWeight(mineral.weight, mineral.unit)}
                    </span>
                  }
                />
                <Field
                  label="Dimensions"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="size-3 text-primary" />
                      {mineral.dimensions}
                    </span>
                  }
                />
                <Field
                  label="Purity"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkle className="size-3 text-primary" />
                      {mineral.purity}
                    </span>
                  }
                />
                <Field label="Grade / karat" value={mineral.grade} />
                <Field
                  label="Vault location"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3 text-primary" />
                      {mineral.storageLocation}
                    </span>
                  }
                />
                <Field
                  label="Deposited"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3 text-primary" />
                      {formatDate(mineral.depositDate)}
                    </span>
                  }
                />
                <Field label="Category" value={mineral.category} />
                <Field label="Type" value={mineral.type} />
              </dl>

              <div className="mt-4 rounded-[4px] border border-line bg-ice/25 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Gem className="size-3 text-primary" />
                  Custodian note
                </p>
                <p className="mt-1.5 text-[0.67rem] leading-5 text-ink">
                  {mineral.notes}
                </p>
              </div>

              {mineral.isDemo && (
                <p className="mt-3 text-[0.56rem] text-muted-foreground">
                  Demonstration record. It illustrates the live member experience and
                  is not a real valuation or policy.
                </p>
              )}
            </div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.08 }}
          >
            <PolicySection
              mineral={mineral}
              actor={actor}
              onFileClaim={() => setClaimOpen(true)}
            />
            <ShippingSection mineral={mineral} />

            <section className="border-t border-line px-5 py-6 sm:px-7">
              <SectionHeading
                eyebrow="Records"
                title="Certificates and provenance"
                description="The documents below are linked to this vault record. The signed originals are held by Cosmic Vault."
              />
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDocumentKind("certificate")}
                  className="group flex items-start gap-3 rounded-[4px] border border-line bg-card p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.72rem] font-semibold text-ink">
                      Certificate of authenticity
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] leading-5 text-muted-foreground">
                      {mineral.certificateNumber} · issued at intake
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentKind("assay")}
                  className="group flex items-start gap-3 rounded-[4px] border border-line bg-card p-4 text-left transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[4px] bg-ice text-primary">
                    <FileCheck2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.72rem] font-semibold text-ink">
                      Assay & appraisal report
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] leading-5 text-muted-foreground">
                      Measurements, purity and verification
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </div>

              {mineral.claims.length > 0 && (
                <div className="mt-6">
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Claims on this mineral
                  </p>
                  <div className="mt-2 space-y-2">
                    {mineral.claims.map((claim) => (
                      <div key={claim.id} className="rounded-[4px] border border-line bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[0.7rem] font-semibold text-ink">
                              {claim.reference}
                            </p>
                            <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                              {claim.reason} · filed {formatDateTime(claim.submittedAt)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-[4px] border px-2 py-0.5 text-[0.56rem] font-semibold",
                              claim.status === "under_review"
                                ? "border-primary/25 bg-primary/10 text-primary dark:text-electric-soft"
                                : "border-halo/40 bg-halo/15 text-[#7a5a1c] dark:text-halo",
                            )}
                          >
                            {claim.status === "under_review" ? "Under review" : "Submitted"}
                          </span>
                        </div>
                        <p className="mt-2 text-[0.65rem] leading-5 text-muted-foreground">
                          {claim.details}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4 sm:px-7">
              <p className="text-[0.58rem] text-muted-foreground">
                Last updated {formatDateTime(mineral.updatedAt)}
              </p>
              <div className="flex gap-2">
                {mineral.insurancePolicy?.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-[4px] bg-transparent"
                    onClick={() => setClaimOpen(true)}
                  >
                    <FileCheck2 className="size-3.5" />
                    File a claim
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-9 rounded-[4px]"
                  onClick={() => onOpenChange(false)}
                >
                  Close record
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      <ClaimDialog
        mineral={mineral}
        actor={actor}
        open={claimOpen}
        onOpenChange={setClaimOpen}
      />
      <VaultDocumentDialog
        mineral={mineral}
        kind={documentKind}
        open={Boolean(documentKind)}
        onOpenChange={(next) => !next && setDocumentKind(null)}
      />
    </>
  );
}
