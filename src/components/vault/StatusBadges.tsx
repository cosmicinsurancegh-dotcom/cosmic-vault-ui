import { cn } from "@/lib/utils";
import { CircleDashed, ShieldAlert, ShieldCheck, Truck } from "lucide-react";
import type { InsuranceStatus, ShippingStatus } from "@/lib/vault/types";
import {
  INSURANCE_STATUS_META,
  SHIPPING_STATUS_META,
  insuranceStatus,
} from "@/lib/vault/types";
import type { Mineral } from "@/lib/vault/types";

export function InsuranceBadge({
  mineral,
  className,
  showIcon = true,
}: {
  mineral: Mineral;
  className?: string;
  showIcon?: boolean;
}) {
  const status = insuranceStatus(mineral);
  const meta = INSURANCE_STATUS_META[status];
  const Icon =
    status === "active"
      ? ShieldCheck
      : status === "uninsured"
        ? ShieldAlert
        : CircleDashed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[0.6rem] font-semibold",
        meta.tone,
        className,
      )}
      title={
        mineral.insurancePolicy
          ? `${mineral.insurancePolicy.name} · ${mineral.insurancePolicy.policyNumber}`
          : "No active policy on this mineral"
      }
    >
      {showIcon && <Icon className="size-3" strokeWidth={2} />}
      {meta.label}
    </span>
  );
}

export function ShippingStatusBadge({
  status,
  className,
  long = false,
}: {
  status: ShippingStatus;
  className?: string;
  long?: boolean;
}) {
  const meta = SHIPPING_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[0.6rem] font-semibold",
        meta.tone,
        className,
      )}
      title={meta.description}
    >
      <span className={cn("size-1.5 rounded-[4px]", meta.dot)} />
      {long ? meta.longLabel : meta.label}
    </span>
  );
}

export function ShippingBadgeForMineral({
  mineral,
  className,
}: {
  mineral: Mineral;
  className?: string;
}) {
  if (!mineral.shipping) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-line bg-muted/60 px-2 py-0.5 text-[0.6rem] font-semibold text-muted-foreground",
          className,
        )}
      >
        <Truck className="size-3" strokeWidth={2} />
        In vault
      </span>
    );
  }
  return <ShippingStatusBadge status={mineral.shipping.currentStatus} className={className} />;
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.58rem] text-muted-foreground">
      {(Object.keys(SHIPPING_STATUS_META) as ShippingStatus[]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            className={cn("size-1.5 rounded-[4px]", SHIPPING_STATUS_META[status].dot)}
          />
          {SHIPPING_STATUS_META[status].label}
        </span>
      ))}
    </div>
  );
}

export function InsuranceStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.58rem] text-muted-foreground">
      {(["active", "pending", "uninsured"] as InsuranceStatus[]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-[4px]",
              INSURANCE_STATUS_META[status].dot,
            )}
          />
          {INSURANCE_STATUS_META[status].label}
        </span>
      ))}
    </div>
  );
}
