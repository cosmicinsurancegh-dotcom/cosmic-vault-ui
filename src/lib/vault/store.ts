import { formatMoneyValue } from "@/lib/format";
import {
  DEMO_MINERALS,
  DEMO_OWNERS,
  createInternalNote,
  demoCollectionForOwner,
} from "./demoData";
import {
  MINERAL_PLANS,
  buildPolicyFromPlan,
  policyNumberFor,
  quotePlan,
} from "./plans";
import type {
  ClaimInput,
  InsuranceRequestInput,
  Mineral,
  MineralInput,
  PolicyInput,
  ShipmentInput,
  ShippingStatus,
  VaultActivity,
  VaultActor,
  VaultMetrics,
} from "./types";
import {
  SHIPPING_STATUS_META,
  formatWeight,
  isActiveShipment,
  isInsuranceActive,
} from "./types";

const STORAGE_KEY = "cosmic-vault.minerals.v1";
const SCHEMA_VERSION = 3;

type PersistedState = {
  version: number;
  minerals: Mineral[];
  savedAt: number;
};

export type VaultStoreSnapshot = {
  minerals: Mineral[];
  ready: boolean;
  savedAt: number;
};

let snapshot: VaultStoreSnapshot = {
  minerals: [],
  ready: false,
  savedAt: 0,
};

const listeners = new Set<() => void>();
let hydrated = false;
let hydrationTimer: ReturnType<typeof setTimeout> | null = null;

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    minerals: clone(DEMO_MINERALS),
    savedAt: Date.now(),
  };
}

function readPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      parsed?.version !== SCHEMA_VERSION ||
      !Array.isArray(parsed.minerals) ||
      parsed.minerals.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(minerals: Mineral[], savedAt: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, minerals, savedAt }),
    );
  } catch {
    // A sandboxed preview can refuse storage. The session still works in memory.
  }
}

function publish(next: VaultStoreSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function mutate(mutator: (minerals: Mineral[]) => Mineral[]) {
  const savedAt = Date.now();
  const minerals = mutator(clone(snapshot.minerals));
  persist(minerals, savedAt);
  publish({ minerals, ready: true, savedAt });
}

function init() {
  const persisted = readPersisted() ?? seedState();
  if (!readPersisted()) persist(persisted.minerals, persisted.savedAt);
  publish({
    minerals: persisted.minerals,
    ready: false,
    savedAt: persisted.savedAt,
  });

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readPersisted();
      if (next) {
        publish({
          minerals: next.minerals,
          ready: true,
          savedAt: next.savedAt,
        });
      }
    });
  }
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  if (snapshot.minerals.length === 0) init();
  if (hydrationTimer) clearTimeout(hydrationTimer);
  hydrationTimer = setTimeout(() => {
    publish({ ...snapshot, ready: true });
  }, 320);
}

export function subscribe(listener: () => void) {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): VaultStoreSnapshot {
  ensureHydrated();
  return snapshot;
}

export function getServerSnapshot(): VaultStoreSnapshot {
  return snapshot;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function mineralsForActor(actor: VaultActor, minerals = snapshot.minerals) {
  if (actor.role === "admin") return minerals;
  return minerals.filter((mineral) => mineral.ownerId === actor.ownerId);
}

export function findMineral(actor: VaultActor, mineralId: string) {
  const mineral = snapshot.minerals.find((item) => item.id === mineralId);
  if (!mineral) throw new Error("Mineral not found.");
  if (actor.role !== "admin" && mineral.ownerId !== actor.ownerId) {
    throw new Error("This mineral is not part of your vault.");
  }
  return mineral;
}

export function metricsForMinerals(minerals: Mineral[]): VaultMetrics {
  const currency =
    minerals.find((mineral) => mineral.currency)?.currency ?? "GBP";
  const insured = minerals.filter(isInsuranceActive);
  const active = minerals.filter(isActiveShipment);
  return {
    holdings: minerals.length,
    currency,
    totalAppraisedValue: minerals.reduce(
      (total, mineral) => total + mineral.estimatedValue,
      0,
    ),
    totalInsuredValue: insured.reduce(
      (total, mineral) => total + (mineral.insurancePolicy?.coverageAmount ?? 0),
      0,
    ),
    insuredCount: insured.length,
    uninsuredCount: minerals.length - insured.length,
    activeShipments: active.length,
    pendingShipments: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "pending",
    ).length,
    onHoldShipments: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "on_hold",
    ).length,
    deliveredShipments: minerals.filter(
      (mineral) => mineral.shipping?.currentStatus === "shipped",
    ).length,
    clientCount: new Set(minerals.map((mineral) => mineral.ownerId)).size,
  };
}

function activityTitle(
  mineral: Mineral,
  kind: VaultActivity["kind"],
  label: string,
) {
  if (kind === "shipping") {
    return `${label} · ${mineral.name}`;
  }
  if (kind === "insurance") {
    return `${label} · ${mineral.name}`;
  }
  return `${label} · ${mineral.name}`;
}

export function activitiesForMinerals(
  actor: VaultActor,
  minerals: Mineral[],
): VaultActivity[] {
  const rows: VaultActivity[] = [];
  const includeInternal = actor.role === "admin";

  for (const mineral of minerals) {
    for (const event of mineral.statusHistory) {
      if (event.kind === "insurance" || event.kind === "shipping") continue;
      if (event.kind === "note" && !includeInternal) continue;
      rows.push({
        id: `${mineral.id}-${event.id}`,
        kind: event.kind,
        title:
          event.kind === "deposit"
            ? `Vault deposit · ${mineral.name}`
            : event.kind === "valuation"
              ? `Valuation refreshed · ${mineral.name}`
              : event.kind === "note"
                ? `Internal note · ${mineral.name}`
                : `Record updated · ${mineral.name}`,
        body: event.message,
        at: event.at,
        mineralId: mineral.id,
        mineralName: mineral.name,
        ownerId: mineral.ownerId,
        ownerName: mineral.ownerName,
        internal: event.kind === "note",
      });
    }

    const policy = mineral.insurancePolicy;
    if (policy) {
      for (const event of policy.statusHistory) {
        rows.push({
          id: `${mineral.id}-${policy.policyId}-${event.at}-${event.status}`,
          kind: "insurance",
          title: activityTitle(
            mineral,
            "insurance",
            event.status === "active"
              ? "Insurance activated"
              : event.status === "pending"
                ? "Insurance pending"
                : "Insurance updated",
          ),
          body:
            event.status === "active"
              ? `${policy.name} · ${formatMoneyValue(
                  policy.coverageAmount,
                  policy.currency,
                )} insured value. ${event.note}`
              : event.note,
          at: event.at,
          mineralId: mineral.id,
          mineralName: mineral.name,
          ownerId: mineral.ownerId,
          ownerName: mineral.ownerName,
          internal: false,
        });
      }
    }

    const shipping = mineral.shipping;
    if (shipping) {
      for (const event of shipping.statusHistory) {
        rows.push({
          id: `${mineral.id}-${shipping.trackingNumber}-${event.at}-${event.status}`,
          kind: "shipping",
          title: activityTitle(
            mineral,
            "shipping",
            SHIPPING_STATUS_META[event.status].label,
          ),
          body: `${event.note} Tracking ${shipping.trackingNumber} · ${shipping.carrier}.`,
          at: event.at,
          mineralId: mineral.id,
          mineralName: mineral.name,
          ownerId: mineral.ownerId,
          ownerName: mineral.ownerName,
          internal: false,
        });
      }
    }

    for (const claim of mineral.claims) {
      rows.push({
        id: `${mineral.id}-${claim.id}`,
        kind: "claim",
        title: `Claim ${claim.reference} · ${mineral.name}`,
        body: `${claim.reason}. ${claim.details}`,
        at: claim.submittedAt,
        mineralId: mineral.id,
        mineralName: mineral.name,
        ownerId: mineral.ownerId,
        ownerName: mineral.ownerName,
        internal: false,
      });
    }

    if (includeInternal) {
      for (const note of mineral.internalNotes) {
        rows.push({
          id: `${mineral.id}-${note.id}`,
          kind: "note",
          title: `Internal note · ${mineral.name}`,
          body: `${note.author}: ${note.body}`,
          at: note.createdAt,
          mineralId: mineral.id,
          mineralName: mineral.name,
          ownerId: mineral.ownerId,
          ownerName: mineral.ownerName,
          internal: true,
        });
      }
    }
  }

  return rows.sort((a, b) => b.at - a.at);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

function requireAdmin(actor: VaultActor) {
  if (actor.role !== "admin") {
    throw new Error("This action is restricted to vault operations.");
  }
}

function requireClientOwnership(actor: VaultActor, mineral: Mineral) {
  if (actor.role !== "client" || mineral.ownerId !== actor.ownerId) {
    throw new Error("This action is not available for this mineral.");
  }
}

function touch(mineral: Mineral, message: string, kind: Mineral["statusHistory"][number]["kind"], actor: string) {
  const now = Date.now();
  mineral.statusHistory = [
    {
      id: `audit-${now.toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      message,
      at: now,
      actor,
    },
    ...mineral.statusHistory,
  ];
  mineral.updatedAt = now;
}

export function updateMineral(
  actor: VaultActor,
  mineralId: string,
  input: MineralInput,
) {
  requireAdmin(actor);
  if (!input.name.trim()) throw new Error("Give the mineral a name.");
  if (!Number.isFinite(input.weight) || input.weight <= 0) {
    throw new Error("Enter a weight greater than zero.");
  }
  if (!Number.isFinite(input.estimatedValue) || input.estimatedValue <= 0) {
    throw new Error("Enter an appraised value greater than zero.");
  }
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral) throw new Error("Mineral not found.");
    Object.assign(mineral, input);
    mineral.valuationUpdatedAt = Date.now();
    touch(
      mineral,
      `Record updated by ${actor.name}. Appraised value ${formatMoneyValue(
        input.estimatedValue,
        input.currency,
      )}.`,
      "edit",
      actor.name,
    );
    return minerals;
  });
}

export function assignPolicy(
  actor: VaultActor,
  mineralId: string,
  input: PolicyInput,
) {
  requireAdmin(actor);
  if (!input.planId) throw new Error("Choose a policy plan.");
  if (input.endDate <= input.startDate) {
    throw new Error("The policy end date must be after the start date.");
  }
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral) throw new Error("Mineral not found.");
    const previous = mineral.insurancePolicy;
    const policy = {
      ...input,
      policyId: `policy-${Date.now().toString(36)}`,
      policyNumber: policyNumberFor(`${mineral.id}-${Date.now()}`),
      currency: mineral.currency,
      status: "active" as const,
      statusHistory: [
        ...(previous?.statusHistory ?? []).filter(
          (event) => event.status !== "cancelled",
        ),
        {
          status: "active" as const,
          at: Date.now(),
          note: previous
            ? `Cover replaced with ${input.name} at ${formatMoneyValue(
                input.coverageAmount,
                mineral.currency,
              )}.`
            : `Policy bound at ${formatMoneyValue(
                input.coverageAmount,
                mineral.currency,
              )} of cover.`,
          actor: actor.name,
        },
      ],
      certificateUrl: "",
    };
    mineral.insurancePolicy = policy;
    touch(
      mineral,
      previous
        ? `Insurance changed to ${input.name}.`
        : `Insurance activated under ${input.name}.`,
      "insurance",
      actor.name,
    );
    return minerals;
  });
}

export function removePolicy(
  actor: VaultActor,
  mineralId: string,
  reason: string,
) {
  requireAdmin(actor);
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral) throw new Error("Mineral not found.");
    if (!mineral.insurancePolicy) return minerals;
    const policy = mineral.insurancePolicy;
    policy.statusHistory.push({
      status: "cancelled",
      at: Date.now(),
      note: reason.trim() || "Cover removed by vault operations.",
      actor: actor.name,
    });
    mineral.insurancePolicy = null;
    touch(
      mineral,
      `Insurance removed. ${reason.trim() || "No reason recorded."}`,
      "insurance",
      actor.name,
    );
    return minerals;
  });
}

export function startShipment(
  actor: VaultActor,
  mineralId: string,
  input: ShipmentInput,
) {
  requireAdmin(actor);
  if (!input.trackingNumber.trim()) throw new Error("Enter a tracking number.");
  if (!input.carrier.trim()) throw new Error("Choose a carrier.");
  if (!input.destination.line1.trim() || !input.destination.city.trim()) {
    throw new Error("Enter a complete destination address.");
  }
  if (!Number.isFinite(input.estimatedDelivery)) {
    throw new Error("Choose an estimated delivery date.");
  }
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral) throw new Error("Mineral not found.");
    if (mineral.shipping) throw new Error("A shipment already exists for this mineral.");
    const now = Date.now();
    mineral.shipping = {
      trackingNumber: input.trackingNumber.trim(),
      carrier: input.carrier.trim(),
      service: input.service.trim() || "Secure transit",
      origin: {
        name: "Cosmic Vault Depository",
        line1: "18 Finsbury Circus",
        city: "London",
        postcode: "EC2M 7EB",
        country: "United Kingdom",
      },
      destination: input.destination,
      estimatedDelivery: input.estimatedDelivery,
      currentStatus: input.initialStatus,
      statusHistory: [
        {
          status: input.initialStatus,
          at: now,
          note:
            input.note.trim() ||
            (input.initialStatus === "pending"
              ? "Shipment authorised and queued with vault operations."
              : "Preparation started. The piece is being verified and packed."),
          actor: actor.name,
        },
      ],
    };
    touch(
      mineral,
      `Shipment initiated with ${input.carrier.trim()} (${input.trackingNumber.trim()}).`,
      "shipping",
      actor.name,
    );
    return minerals;
  });
}

export function updateShipmentStatus(
  actor: VaultActor,
  mineralId: string,
  status: ShippingStatus,
  note: string,
) {
  requireAdmin(actor);
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral?.shipping) throw new Error("No shipment exists for this mineral.");
    if (mineral.shipping.currentStatus === status) {
      throw new Error("The shipment is already in that state.");
    }
    const now = Date.now();
    mineral.shipping.currentStatus = status;
    mineral.shipping.statusHistory.push({
      status,
      at: now,
      note:
        note.trim() ||
        SHIPPING_STATUS_META[status].description,
      actor: actor.name,
    });
    if (status === "in_transit") mineral.shipping.dispatchedAt = now;
    if (status === "shipped") mineral.shipping.deliveredAt = now;
    touch(
      mineral,
      `Shipment status changed to ${SHIPPING_STATUS_META[status].label}.`,
      "shipping",
      actor.name,
    );
    return minerals;
  });
}

export function addInternalNote(
  actor: VaultActor,
  mineralId: string,
  body: string,
) {
  requireAdmin(actor);
  if (body.trim().length < 3) throw new Error("Write a note before saving.");
  mutate((minerals) => {
    const mineral = minerals.find((item) => item.id === mineralId);
    if (!mineral) throw new Error("Mineral not found.");
    mineral.internalNotes = [
      createInternalNote(actor.name, body.trim()),
      ...mineral.internalNotes,
    ];
    touch(
      mineral,
      `Internal note added by ${actor.name}.`,
      "note",
      actor.name,
    );
    return minerals;
  });
}

export function requestInsurance(
  actor: VaultActor,
  mineralId: string,
  input: InsuranceRequestInput,
) {
  const mineral = snapshot.minerals.find((item) => item.id === mineralId);
  if (!mineral) throw new Error("Mineral not found.");
  requireClientOwnership(actor, mineral);
  const plan = MINERAL_PLANS.find((item) => item.id === input.planId);
  if (!plan) throw new Error("Choose a recommended policy.");
  const quote = quotePlan(plan, mineral.estimatedValue);
  mutate((minerals) => {
    const target = minerals.find((item) => item.id === mineralId);
    if (!target) throw new Error("Mineral not found.");
    target.internalNotes = [
      createInternalNote(
        actor.name,
        `Insurance request: ${plan.name}. Requested cover ${formatMoneyValue(
          quote.coverageAmount,
          target.currency,
        )}. ${input.note.trim() || "No additional note."}`,
      ),
      ...target.internalNotes,
    ];
    touch(
      target,
      `Insurance requested under ${plan.name}. Awaiting underwriting.`,
      "insurance",
      actor.name,
    );
    return minerals;
  });
}

export function fileClaim(
  actor: VaultActor,
  mineralId: string,
  input: ClaimInput,
) {
  const mineral = snapshot.minerals.find((item) => item.id === mineralId);
  if (!mineral) throw new Error("Mineral not found.");
  requireClientOwnership(actor, mineral);
  if (!isInsuranceActive(mineral)) {
    throw new Error("This mineral is not insured. Add cover before filing a claim.");
  }
  if (input.reason.trim().length < 3) throw new Error("Describe what happened.");
  if (input.details.trim().length < 10) {
    throw new Error("Add enough detail for the claims team to assess.");
  }
  mutate((minerals) => {
    const target = minerals.find((item) => item.id === mineralId);
    if (!target) throw new Error("Mineral not found.");
    const now = Date.now();
    const reference = `CLM-CV-${now.toString(36).slice(-5).toUpperCase()}`;
    target.claims = [
      {
        id: `claim-${now.toString(36)}`,
        reference,
        reason: input.reason.trim(),
        details: input.details.trim(),
        status: "submitted",
        submittedAt: now,
      },
      ...target.claims,
    ];
    touch(
      target,
      `Claim ${reference} submitted for review.`,
      "claim",
      actor.name,
    );
    return minerals;
  });
}

export function seedDemoCollection(actor: VaultActor) {
  if (actor.role !== "client") {
    throw new Error("Only a client vault can load a sample collection.");
  }
  const existing = snapshot.minerals.some(
    (mineral) => mineral.ownerId === actor.ownerId,
  );
  if (existing) return 0;
  const owner = DEMO_OWNERS.find((item) => item.id === actor.ownerId);
  const minerals = demoCollectionForOwner({
    ownerId: actor.ownerId,
    ownerName: actor.name,
    ownerEmail: actor.email,
    ownerReference:
      owner?.clientReference ??
      `CV-CLIENT-${actor.ownerId.slice(-4).toUpperCase()}`,
    address: {
      name: actor.name,
      line1: "22 Example Street",
      city: "London",
      postcode: "EC1A 1AA",
      country: "United Kingdom",
    },
  });
  mutate((current) => [...minerals, ...current]);
  return minerals.length;
}

export function resetDemoStore(actor: VaultActor) {
  requireAdmin(actor);
  mutate(() => clone(DEMO_MINERALS));
}

/* -------------------------------------------------------------------------- */
/* Helpers used by the screens                                                */
/* -------------------------------------------------------------------------- */

export function defaultPolicyFor(mineral: Mineral, planId = "cosmic-full"): PolicyInput {
  const plan = MINERAL_PLANS.find((item) => item.id === planId) ?? MINERAL_PLANS[0];
  const quote = quotePlan(plan, mineral.estimatedValue);
  const start = Date.now();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return {
    planId: plan.id,
    name: plan.name,
    planType: plan.planType,
    coverageAmount: quote.coverageAmount,
    premium: quote.premium,
    premiumFrequency: plan.frequency,
    startDate: start,
    endDate: end.getTime(),
    deductible: quote.deductible,
    coverageDetails: plan.coverageDetails,
    exclusions: plan.exclusions,
  };
}

export function mineralSummaryLine(mineral: Mineral) {
  return `${formatWeight(mineral.weight, mineral.unit)} · ${mineral.purity}`;
}

export function buildPolicyFromPlanId(mineral: Mineral, planId: string) {
  const plan = MINERAL_PLANS.find((item) => item.id === planId) ?? MINERAL_PLANS[0];
  const start = Date.now();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return buildPolicyFromPlan({
    plan,
    appraisedValue: mineral.estimatedValue,
    currency: mineral.currency,
    startDate: start,
    endDate: end.getTime(),
    actor: "Vault operations",
    policyNumber: policyNumberFor(`${mineral.id}-${start}`),
  });
}
