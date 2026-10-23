/**
 * The mineral-vault domain model.
 *
 * Money in this module is stored in **major units** (e.g. 786400 = £786,400)
 * because every value is an appraisal, not a ledger entry. The surrounding
 * insurance platform stores premiums in minor units; `formatMoneyValue` from
 * `@/lib/format` is the correct formatter for these fields.
 *
 * The model is deliberately transport-agnostic. `repository.ts` exposes the
 * same shape a Convex query/mutation pair would return, so the local demo
 * adapter can be replaced without touching a screen.
 */

export const SHIPPING_STATUSES = [
  "pending",
  "in_progress",
  "on_hold",
  "in_transit",
  "shipped",
] as const;

export type ShippingStatus = (typeof SHIPPING_STATUSES)[number];

export type ShippingStatusMeta = {
  label: string;
  longLabel: string;
  description: string;
  /** Position in the five-step journey (0-based). */
  index: number;
  tone: string;
  dot: string;
};

export const SHIPPING_STATUS_META: Record<ShippingStatus, ShippingStatusMeta> =
  {
    pending: {
      label: "Pending",
      longLabel: "Pending",
      description: "Authorised and queued with vault operations.",
      index: 0,
      tone: "border-line bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    in_progress: {
      label: "In Progress",
      longLabel: "In Progress",
      description: "Being prepared, verified and packaged.",
      index: 1,
      tone: "border-primary/25 bg-primary/10 text-primary dark:text-electric-soft",
      dot: "bg-electric-soft",
    },
    on_hold: {
      label: "On Hold",
      longLabel: "On Hold",
      description: "Paused pending an operational or customs check.",
      index: 2,
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    in_transit: {
      label: "In Transit",
      longLabel: "In Transit",
      description: "With the secure carrier and moving to its destination.",
      index: 3,
      tone: "border-primary bg-primary text-primary-foreground",
      dot: "bg-primary",
    },
    shipped: {
      label: "Shipped",
      longLabel: "Shipped / Delivered",
      description: "Delivered and signed for at the destination.",
      index: 4,
      tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
  };

export const MINERAL_TYPES = [
  "Gold Bar",
  "Gold Coin",
  "Gold Nugget",
  "Silver Bar",
  "Diamond",
  "Emerald",
  "Ruby",
  "Sapphire",
  "Platinum Coin",
  "Rare Earth",
] as const;

export type MineralType = (typeof MINERAL_TYPES)[number];

export const MINERAL_CATEGORIES = [
  "Bullion",
  "Specie",
  "Gemstone",
  "Rare Earth",
] as const;

export type MineralCategory = (typeof MINERAL_CATEGORIES)[number];

export const WEIGHT_UNITS = ["g", "kg", "oz", "ct"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const PREMIUM_FREQUENCIES = ["monthly", "quarterly", "annual"] as const;

export type PremiumFrequency = (typeof PREMIUM_FREQUENCIES)[number];

export const INSURANCE_STATUSES = [
  "active",
  "pending",
  "expired",
  "uninsured",
] as const;

export type InsuranceStatus = (typeof INSURANCE_STATUSES)[number];

export type InsuranceStatusMeta = {
  label: string;
  tone: string;
  dot: string;
};

export const INSURANCE_STATUS_META: Record<
  InsuranceStatus,
  InsuranceStatusMeta
> = {
  active: {
    label: "Insured",
    tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Insurance pending",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  expired: {
    label: "Cover expired",
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  uninsured: {
    label: "Not insured",
    tone: "border-line bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

export type InsuranceEvent = {
  status: "active" | "pending" | "expired" | "cancelled";
  at: number;
  note: string;
  actor: string;
};

export type InsurancePolicy = {
  /** Stable plan identifier, e.g. "cosmic-full". */
  planId: string;
  policyId: string;
  name: string;
  planType: string;
  policyNumber: string;
  /** Major units, in `currency`. */
  coverageAmount: number;
  currency: string;
  /** Major units per billing period. */
  premium: number;
  premiumFrequency: PremiumFrequency;
  startDate: number;
  endDate: number;
  deductible: number;
  coverageDetails: string[];
  exclusions: string[];
  status: "active" | "pending" | "expired";
  statusHistory: InsuranceEvent[];
  certificateUrl?: string;
};

export type ShipmentAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};

export type ShipmentEvent = {
  status: ShippingStatus;
  at: number;
  note: string;
  actor: string;
};

export type Shipment = {
  trackingNumber: string;
  carrier: string;
  service: string;
  origin: ShipmentAddress;
  destination: ShipmentAddress;
  estimatedDelivery: number;
  currentStatus: ShippingStatus;
  statusHistory: ShipmentEvent[];
  /** Added by staff when handing the consignment to the carrier. */
  dispatchedAt?: number;
  deliveredAt?: number;
};

export type ClaimRequest = {
  id: string;
  reference: string;
  reason: string;
  details: string;
  status: "submitted" | "under_review" | "approved" | "declined";
  submittedAt: number;
};

export type InternalNote = {
  id: string;
  author: string;
  body: string;
  createdAt: number;
};

export type MineralAuditEvent = {
  id: string;
  kind:
    | "deposit"
    | "insurance"
    | "shipping"
    | "claim"
    | "valuation"
    | "edit"
    | "note";
  message: string;
  at: number;
  actor: string;
};

export type VaultOwner = {
  id: string;
  name: string;
  email: string;
  clientReference: string;
  /** Client-safe address shown on outbound shipments. */
  address: ShipmentAddress;
};

export type Mineral = {
  id: string;
  /**
   * Owner identity. In a server-backed implementation this is the customer's
   * `users._id`; the demo uses stable pseudo-ids for its three sample clients.
   */
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerReference: string;

  /** Unique vault identifier, printed on the physical drawer label. */
  vaultId: string;
  certificateNumber: string;

  name: string;
  type: MineralType;
  category: MineralCategory;
  description: string;

  weight: number;
  unit: WeightUnit;
  dimensions: string;
  purity: string;
  grade: string;

  estimatedValue: number;
  currency: string;
  valuationUpdatedAt: number;

  /** Public photo URLs. The first entry is the card image. */
  photos: string[];
  certificateUrl: string;
  assayReportUrl: string;

  depositDate: number;
  storageLocation: string;

  insurancePolicy: InsurancePolicy | null;
  shipping: Shipment | null;

  /** Client-visible care notes or provenance. */
  notes: string;
  /** Never returned by a client-scoped API. */
  internalNotes: InternalNote[];
  claims: ClaimRequest[];

  statusHistory: MineralAuditEvent[];
  /** Marks records that belong to the demonstration dataset. */
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
};

export type VaultActivityKind =
  | "deposit"
  | "insurance"
  | "shipping"
  | "claim"
  | "valuation"
  | "edit"
  | "note";

export type VaultActivity = {
  id: string;
  kind: VaultActivityKind;
  title: string;
  body: string;
  at: number;
  mineralId: string;
  mineralName: string;
  ownerId: string;
  ownerName: string;
  internal: boolean;
};

export type VaultActor = {
  role: "client" | "admin";
  /** The acting user's id. Admin actions are not owner-scoped. */
  userId: string;
  ownerId: string;
  name: string;
  email: string;
  isDemo: boolean;
};

export type VaultMetrics = {
  holdings: number;
  currency: string;
  totalAppraisedValue: number;
  totalInsuredValue: number;
  insuredCount: number;
  uninsuredCount: number;
  activeShipments: number;
  pendingShipments: number;
  onHoldShipments: number;
  deliveredShipments: number;
  clientCount: number;
};

export type MineralInput = {
  name: string;
  type: MineralType;
  category: MineralCategory;
  description: string;
  weight: number;
  unit: WeightUnit;
  dimensions: string;
  purity: string;
  grade: string;
  estimatedValue: number;
  currency: string;
  photos: string[];
  notes: string;
  storageLocation: string;
  certificateUrl?: string;
  assayReportUrl?: string;
};

export type PolicyInput = {
  planId: string;
  name: string;
  planType: string;
  coverageAmount: number;
  premium: number;
  premiumFrequency: PremiumFrequency;
  startDate: number;
  endDate: number;
  deductible: number;
  coverageDetails: string[];
  exclusions: string[];
};

export type ShipmentInput = {
  trackingNumber: string;
  carrier: string;
  service: string;
  destination: ShipmentAddress;
  estimatedDelivery: number;
  initialStatus: Extract<ShippingStatus, "pending" | "in_progress">;
  note: string;
};

export type ClaimInput = {
  reason: string;
  details: string;
};

export type InsuranceRequestInput = {
  planId: string;
  note: string;
};

export function insuranceStatus(mineral: Mineral): InsuranceStatus {
  if (!mineral.insurancePolicy) return "uninsured";
  return mineral.insurancePolicy.status;
}

export function isInsuranceActive(mineral: Mineral) {
  return mineral.insurancePolicy?.status === "active";
}

export function shippingStatus(
  mineral: Mineral,
): ShippingStatus | "not_shipping" {
  return mineral.shipping?.currentStatus ?? "not_shipping";
}

export function formatWeight(weight: number, unit: WeightUnit) {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: unit === "ct" ? 2 : weight < 100 ? 2 : 0,
  }).format(weight)} ${unit}`;
}

export function formatAddress(address: ShipmentAddress) {
  return [
    address.name,
    address.line1,
    address.line2,
    address.city,
    address.postcode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function isActiveShipment(mineral: Mineral) {
  const status = mineral.shipping?.currentStatus;
  return (
    status === "pending" ||
    status === "in_progress" ||
    status === "on_hold" ||
    status === "in_transit"
  );
}
