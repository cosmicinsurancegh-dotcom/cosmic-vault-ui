import type { InsurancePolicy, PremiumFrequency } from "./types";

export type MineralPlan = {
  id: string;
  name: string;
  planType: string;
  blurb: string;
  /** Annual rate applied to the appraised value. */
  rate: number;
  /** Deductible as a share of the appraised value, with a floor. */
  deductibleRate: number;
  deductibleFloor: number;
  frequency: PremiumFrequency;
  coverageDetails: string[];
  exclusions: string[];
  recommendedFor: string;
};

export const MINERAL_PLANS: MineralPlan[] = [
  {
    id: "cosmic-full",
    name: "Cosmic Full Coverage",
    planType: "All-Risk Mineral Policy",
    blurb:
      "The complete policy: storage, transit, theft, damage and named perils, with agreed-value settlement.",
    rate: 0.0115,
    deductibleRate: 0.01,
    deductibleFloor: 750,
    frequency: "annual",
    coverageDetails: [
      "All-risk cover in the vault and in secure transit",
      "Theft, burglary, mysterious disappearance and damage",
      "Fire, flood, earthquake and other natural disasters",
      "Agreed-value settlement based on the latest appraisal",
      "Transit loss or delay with a dedicated claims handler",
      "Worldwide cover while in the care of an approved carrier",
    ],
    exclusions: [
      "Gradual deterioration, inherent vice or normal wear",
      "Unauthorised removal from the vault",
      "Consequences of war, nuclear risk or government seizure",
    ],
    recommendedFor: "Collections above £100,000 or objects with no replacement.",
  },
  {
    id: "transit-storage",
    name: "Transit + Storage",
    planType: "Mineral Transit & Storage",
    blurb:
      "Storage and outbound transit on one policy, built for pieces that move between vaults.",
    rate: 0.0078,
    deductibleRate: 0.02,
    deductibleFloor: 500,
    frequency: "annual",
    coverageDetails: [
      "Cover in the vault and while with an approved secure carrier",
      "Theft, accidental damage and transit loss",
      "Fire, flood and natural disaster at the vault or in transit",
      "Replacement or agreed-value settlement",
    ],
    exclusions: [
      "Loss while in the custody of a non-approved carrier",
      "Gradual deterioration and inherent vice",
      "Unattended transit or storage outside the declared route",
    ],
    recommendedFor: "Pieces that travel or have a planned shipment.",
  },
  {
    id: "vault-essential",
    name: "Vault Storage Essential",
    planType: "Vault Storage Cover",
    blurb:
      "Focused cover for pieces that remain in the vault, with a lower premium and higher excess.",
    rate: 0.0052,
    deductibleRate: 0.025,
    deductibleFloor: 350,
    frequency: "annual",
    coverageDetails: [
      "Theft and burglary from the Cosmic Vault premises",
      "Fire, flood and natural disaster while stored",
      "Accidental damage during handling by vault staff",
      "Agreed-value settlement",
    ],
    exclusions: [
      "Any loss in transit or outside the vault",
      "Gradual deterioration and inherent wear",
      "Unauthorised access arranged by the owner",
    ],
    recommendedFor: "Long-term storage of stable-value bullion.",
  },
];

function round(value: number, step = 1) {
  return Math.round(value / step) * step;
}

export function quotePlan(plan: MineralPlan, appraisedValue: number) {
  const coverageAmount = round(appraisedValue * 1.1, 50);
  const premium = Math.max(
    120,
    round(appraisedValue * plan.rate, plan.frequency === "monthly" ? 1 : 5),
  );
  const deductible = Math.max(
    plan.deductibleFloor,
    round(appraisedValue * plan.deductibleRate, 50),
  );
  return { coverageAmount, premium, deductible };
}

export function buildPolicyFromPlan({
  plan,
  appraisedValue,
  currency,
  startDate,
  endDate,
  actor,
  policyNumber,
}: {
  plan: MineralPlan;
  appraisedValue: number;
  currency: string;
  startDate: number;
  endDate: number;
  actor: string;
  policyNumber: string;
}): InsurancePolicy {
  const quote = quotePlan(plan, appraisedValue);
  const now = Date.now();
  return {
    planId: plan.id,
    policyId: `${plan.id}-${now.toString(36)}`,
    name: plan.name,
    planType: plan.planType,
    policyNumber,
    coverageAmount: quote.coverageAmount,
    currency,
    premium: quote.premium,
    premiumFrequency: plan.frequency,
    startDate,
    endDate,
    deductible: quote.deductible,
    coverageDetails: plan.coverageDetails,
    exclusions: plan.exclusions,
    status: "active",
    statusHistory: [
      {
        status: "active",
        at: now,
        note: `Policy bound at ${new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(quote.coverageAmount)} of cover.`,
        actor,
      },
    ],
  };
}

export function policyNumberFor(seed: string) {
  const number = Math.abs(
    [...seed].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7),
  )
    .toString()
    .slice(0, 6)
    .padStart(6, "0");
  return `CVP-${new Date().getFullYear()}-${number}`;
}

export function premiumLabel(policy: InsurancePolicy) {
  return `/${policy.premiumFrequency === "annual" ? "yr" : policy.premiumFrequency === "quarterly" ? "qtr" : "mo"}`;
}
