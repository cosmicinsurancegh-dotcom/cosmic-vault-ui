/**
 * Protected demonstration dataset for the existing insurance platform.
 *
 * SAFETY CONTRACT
 * ---------------
 * - Every export is `internal*`: no browser client can call it. `convex run`
 *   (which holds the deployment's admin key) is the only way in.
 * - Writes additionally require `DEMO_SEED_ENABLED=1` on the deployment, the
 *   exact confirmation phrase, and the plan hash from a fresh dry run, so a
 *   stale or accidental run cannot write.
 * - Only records carrying `seedBatch === DEMO_SEED_BATCH` are ever created,
 *   patched or (in cleanup) deleted. Existing users' credentials, roles and
 *   profiles are never overwritten.
 * - Seeded notifications are inserted with `emailStatus: "skipped"` and no
 *   scheduler call, so no email is sent. No payment provider, webhook or claim
 *   processor is touched. Decisions are historical sample records only.
 *
 * USAGE (run against an explicitly chosen deployment):
 *   bunx convex run demoSeed:preview
 *   bunx convex run demoSeed:apply '{"confirm":"insureflow-demo-v1","planHash":"<hash>"}'
 *   bunx convex run demoSeed:cleanupPreview
 *   bunx convex run demoSeed:cleanup '{"confirm":"delete:insureflow-demo-v1","planHash":"<hash>"}'
 *
 * Dry-run-only identities: because this project signs in with Convex Auth email
 * OTP, a demo email needs a deliverable inbox to become a sign-in account. By
 * default `apply` refuses to invent identities; `allowDataOnlyIdentities: true`
 * creates clearly marked data-only rows (no auth account) for sandbox demos.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_ADMIN_PERMISSIONS, PERMISSIONS } from "./lib/authz";
import { DAY } from "./lib/refs";

export const DEMO_SEED_BATCH = "insureflow-demo-v1";
const CONFIRM_APPLY = DEMO_SEED_BATCH;
const CONFIRM_DELETE = `delete:${DEMO_SEED_BATCH}`;
const CONFIRM_DEACTIVATE = `deactivate:${DEMO_SEED_BATCH}`;
const ENV_FLAG = "DEMO_SEED_ENABLED";

const DEMO_NOTICE =
  "DEMONSTRATION RECORD — fictional data created for product testing. Not a real quote, policy, claim, payment or contract.";

type StaffRole = "super_admin" | "admin" | "customer" | "broker";

/**
 * Least-privilege staff rights for the demo administrator: the documented
 * conservative admin default plus product management and audit read, which the
 * required admin dashboard screens use. It deliberately does NOT occupy the
 * super_admin seat, so the app's founding-super-admin path stays available.
 */
const DEMO_ADMIN_PERMISSIONS = [
  ...DEFAULT_ADMIN_PERMISSIONS,
  PERMISSIONS.PRODUCTS_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
];

function permissionsFor(role: StaffRole) {
  return role === "admin" ? DEMO_ADMIN_PERMISSIONS : undefined;
}

type IdentitySpec = {
  key: string;
  email: string;
  name: string;
  role: StaffRole;
  org?: string;
};

const IDENTITIES: IdentitySpec[] = [
  { key: "admin", email: "admin@insureflow.demo", name: "Iris Chen", role: "admin" },
  { key: "customer-a", email: "customer@insureflow.demo", name: "Noor Haddad", role: "customer" },
  { key: "customer-b", email: "customer2@insureflow.demo", name: "Tomas Berg", role: "customer" },
  { key: "customer-c", email: "customer3@insureflow.demo", name: "Priya Raman", role: "customer" },
  {
    key: "broker-1",
    email: "broker@insureflow.demo",
    name: "Daniel Reyes",
    role: "broker",
    org: "Reyes & Co Insurance",
  },
  {
    key: "broker-2",
    email: "broker2@insureflow.demo",
    name: "Sofia Lindqvist",
    role: "broker",
    org: "Nordic Cover Partners",
  },
];

const CUSTOMER_KEYS = ["customer-a", "customer-b", "customer-c"] as const;
const BROKER_KEYS = ["broker-1", "broker-2"] as const;
type CustomerKey = (typeof CUSTOMER_KEYS)[number];
type BrokerKey = (typeof BROKER_KEYS)[number];
type ProductKey = "motor" | "home" | "travel" | "life" | "business";

const CUSTOMER_COUNTRY: Record<CustomerKey, { country: string; city: string; address: string; postal: string }> = {
  "customer-a": { country: "GB", city: "Bristol", address: "14 Harbour View Mews", postal: "BS1 4TT" },
  "customer-b": { country: "IE", city: "Cork", address: "8 Marina Terrace", postal: "T12 X4P2" },
  "customer-c": { country: "GB", city: "Leeds", address: "Flat 3, 27 Kirkstall Lane", postal: "LS6 3EA" },
};

/* -------------------------------------------------------------------------- */
/* Product catalogue                                                          */
/* -------------------------------------------------------------------------- */

type FactorOption = { value: string; label: string; multiplier: number };
type RatingFactor = { key: string; label: string; help?: string; options: FactorOption[] };
type ProductQuestion = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  required: boolean;
  options?: string[];
  help?: string;
};

type ProductSpec = {
  key: ProductKey;
  code: string;
  name: string;
  categoryKey: string;
  description: string;
  targetCustomer: string;
  countries: string[];
  currency: string;
  basePremium: number;
  excess: number;
  coverageLimit: number;
  benefits: string[];
  exclusions: string[];
  ratingFactors: RatingFactor[];
  questions: ProductQuestion[];
  requiredDocuments: { key: string; label: string; required: boolean }[];
};

const DEMO_PRODUCTS: ProductSpec[] = [
  {
    key: "motor",
    code: "DEMO-MOT-01",
    name: "Meridian Comprehensive Motor",
    categoryKey: "motor",
    description:
      "Demonstration comprehensive motor cover for private cars, with courtesy transport and a named claims handler.",
    targetCustomer: "Private car owners insuring a single household vehicle.",
    countries: ["GB", "IE", "DE", "FR"],
    currency: "GBP",
    basePremium: 54000,
    excess: 25000,
    coverageLimit: 200000000,
    benefits: ["Courtesy vehicle during repair", "Windscreen cover", "Named claims handler", "EU cover up to 90 days"],
    exclusions: ["Track days and racing", "Commercial delivery use", "Mechanical breakdown"],
    ratingFactors: [
      {
        key: "annual_mileage",
        label: "Annual mileage",
        options: [
          { value: "5k_10k", label: "5,000 – 10,000", multiplier: 1 },
          { value: "10k_20k", label: "10,000 – 20,000", multiplier: 1.18 },
        ],
      },
      {
        key: "claims_history",
        label: "Claims in the last three years",
        options: [
          { value: "none", label: "None", multiplier: 0.92 },
          { value: "one", label: "One", multiplier: 1.15 },
        ],
      },
    ],
    questions: [
      { key: "annual_mileage", label: "Annual mileage", type: "select", required: true, options: ["5k_10k", "10k_20k"] },
      { key: "claims_history", label: "Claims in the last three years", type: "select", required: true, options: ["none", "one"] },
      { key: "vehicle", label: "Vehicle make and model", type: "text", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_identity", label: "Photo identification", required: true }],
  },
  {
    key: "home",
    code: "DEMO-HOM-01",
    name: "Meridian Home & Contents",
    categoryKey: "home",
    description:
      "Demonstration buildings and contents cover with new-for-old replacement and home emergency response.",
    targetCustomer: "Homeowners and long-term renters.",
    countries: ["GB", "IE", "NL", "ES"],
    currency: "GBP",
    basePremium: 32900,
    excess: 15000,
    coverageLimit: 75000000,
    benefits: ["New-for-old contents", "Home emergency call-out", "Alternative accommodation", "Accidental damage option"],
    exclusions: ["Property unoccupied over 60 days", "Gradual deterioration and damp", "Business stock at home"],
    ratingFactors: [
      {
        key: "property_type",
        label: "Property type",
        options: [
          { value: "flat", label: "Flat / apartment", multiplier: 0.9 },
          { value: "terrace", label: "Terraced house", multiplier: 1 },
        ],
      },
      {
        key: "flood_risk",
        label: "Flood risk",
        options: [
          { value: "low", label: "Low", multiplier: 1 },
          { value: "medium", label: "Medium", multiplier: 1.22 },
        ],
      },
    ],
    questions: [
      { key: "property_type", label: "Property type", type: "select", required: true, options: ["flat", "terrace"] },
      { key: "flood_risk", label: "Flood risk", type: "select", required: true, options: ["low", "medium"] },
      { key: "property_address", label: "Insured property address", type: "textarea", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_identity", label: "Photo identification", required: true }],
  },
  {
    key: "travel",
    code: "DEMO-TRV-01",
    name: "Meridian Annual Travel",
    categoryKey: "travel",
    description:
      "Demonstration annual multi-trip travel cover with medical expenses, cancellation and baggage protection.",
    targetCustomer: "Frequent travellers and couples taking several trips a year.",
    countries: ["GB", "IE", "DE", "FR", "US"],
    currency: "GBP",
    basePremium: 14900,
    excess: 7500,
    coverageLimit: 50000000,
    benefits: ["Emergency medical treatment", "Trip cancellation", "Baggage and gadget cover", "24/7 assistance line"],
    exclusions: ["Travel against medical advice", "Extreme sports unless endorsed", "Known events before booking"],
    ratingFactors: [
      {
        key: "travellers",
        label: "Travellers",
        options: [
          { value: "single", label: "One adult", multiplier: 1 },
          { value: "couple", label: "Two adults", multiplier: 1.7 },
        ],
      },
      {
        key: "region",
        label: "Destinations",
        options: [
          { value: "europe", label: "Europe", multiplier: 0.85 },
          { value: "worldwide", label: "Worldwide excl. USA", multiplier: 1 },
        ],
      },
    ],
    questions: [
      { key: "travellers", label: "Travellers", type: "select", required: true, options: ["single", "couple"] },
      { key: "region", label: "Destinations", type: "select", required: true, options: ["europe", "worldwide"] },
      { key: "trip_start", label: "First departure date", type: "date", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_identity", label: "Photo identification", required: true }],
  },
  {
    key: "life",
    code: "DEMO-LIF-01",
    name: "Meridian Level Term Life",
    categoryKey: "life",
    description:
      "Demonstration level term life cover with optional critical illness, written in plain language.",
    targetCustomer: "Adults protecting a mortgage or dependants.",
    countries: ["GB", "IE", "DE", "NL"],
    currency: "GBP",
    basePremium: 42500,
    excess: 0,
    coverageLimit: 25000000,
    benefits: ["Level sum assured", "Critical illness option", "Trust wording guidance", "Bereavement support line"],
    exclusions: ["Non-disclosure of material facts", "War and illegal activity", "Initial exclusion period"],
    ratingFactors: [
      {
        key: "age_band",
        label: "Age band",
        options: [
          { value: "18_34", label: "18 – 34", multiplier: 0.8 },
          { value: "35_49", label: "35 – 49", multiplier: 1 },
        ],
      },
      {
        key: "smoker",
        label: "Smoking status",
        options: [
          { value: "non_smoker", label: "Non-smoker", multiplier: 1 },
          { value: "smoker", label: "Smoker", multiplier: 1.65 },
        ],
      },
    ],
    questions: [
      { key: "age_band", label: "Age band", type: "select", required: true, options: ["18_34", "35_49"] },
      { key: "smoker", label: "Smoking status", type: "select", required: true, options: ["non_smoker", "smoker"] },
      { key: "sum_assured", label: "Sum assured required", type: "number", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_identity", label: "Photo identification", required: true }],
  },
  {
    key: "business",
    code: "DEMO-BUS-01",
    name: "Meridian Business Liability",
    categoryKey: "business",
    description:
      "Demonstration public and employers' liability cover for small businesses, with business interruption option.",
    targetCustomer: "Owner-managed businesses with up to 20 employees.",
    countries: ["GB", "IE", "NL", "ES"],
    currency: "GBP",
    basePremium: 118000,
    excess: 50000,
    coverageLimit: 500000000,
    benefits: ["Public liability", "Employers' liability", "Business interruption option", "Legal expenses helpline"],
    exclusions: ["Work at height above 10 metres", "Hazardous substances", "Unlicensed subcontractors"],
    ratingFactors: [
      {
        key: "employees",
        label: "Employees",
        options: [
          { value: "1_5", label: "1 – 5", multiplier: 0.8 },
          { value: "6_20", label: "6 – 20", multiplier: 1 },
        ],
      },
      {
        key: "sector",
        label: "Sector",
        options: [
          { value: "professional", label: "Professional services", multiplier: 0.9 },
          { value: "retail", label: "Retail", multiplier: 1 },
        ],
      },
    ],
    questions: [
      { key: "employees", label: "Employees", type: "select", required: true, options: ["1_5", "6_20"] },
      { key: "sector", label: "Sector", type: "select", required: true, options: ["professional", "retail"] },
      { key: "business_name", label: "Registered business name", type: "text", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_identity", label: "Company registration", required: true }],
  },
];

function answerPremium(product: ProductSpec, answers: Record<string, string | number>): number {
  let amount = product.basePremium;
  for (const factor of product.ratingFactors) {
    const selected = String(answers[factor.key] ?? "");
    const option = factor.options.find((item) => item.value === selected);
    if (option) amount *= option.multiplier;
  }
  return Math.round(amount);
}

/* -------------------------------------------------------------------------- */
/* Applications, policies, claims                                              */
/* -------------------------------------------------------------------------- */

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "declined";

type ApplicationSpec = {
  key: string;
  reference: string;
  customer: CustomerKey;
  broker: BrokerKey;
  product: ProductKey;
  status: ApplicationStatus;
  answers: Record<string, string | number>;
  submittedDaysAgo?: number;
  decidedDaysAgo?: number;
  decision?: "approved" | "declined";
  decisionReason?: string;
  assigned?: boolean;
};

const DEMO_APPLICATIONS: ApplicationSpec[] = [
  {
    key: "app-01",
    reference: "APP-DEMO-0001",
    customer: "customer-a",
    broker: "broker-1",
    product: "motor",
    status: "approved",
    answers: { annual_mileage: "5k_10k", claims_history: "none", vehicle: "2019 Volkswagen Golf" },
    submittedDaysAgo: 152,
    decidedDaysAgo: 150,
    decision: "approved",
    decisionReason: "Documents verified; driving record and mileage within appetite.",
    assigned: true,
  },
  {
    key: "app-02",
    reference: "APP-DEMO-0002",
    customer: "customer-a",
    broker: "broker-1",
    product: "motor",
    status: "approved",
    answers: { annual_mileage: "10k_20k", claims_history: "one", vehicle: "2021 Ford Kuga" },
    submittedDaysAgo: 601,
    decidedDaysAgo: 599,
    decision: "approved",
    decisionReason: "Prior claim reviewed and accepted with the recorded premium.",
    assigned: true,
  },
  {
    key: "app-03",
    reference: "APP-DEMO-0003",
    customer: "customer-a",
    broker: "broker-1",
    product: "home",
    status: "approved",
    answers: { property_type: "terrace", flood_risk: "low", property_address: "14 Harbour View Mews, Bristol" },
    submittedDaysAgo: 92,
    decidedDaysAgo: 90,
    decision: "approved",
    decisionReason: "Standard risk; proof of address accepted.",
    assigned: true,
  },
  {
    key: "app-04",
    reference: "APP-DEMO-0004",
    customer: "customer-a",
    broker: "broker-1",
    product: "travel",
    status: "approved",
    answers: { travellers: "couple", region: "europe", trip_start: "2026-05-12" },
    submittedDaysAgo: 421,
    decidedDaysAgo: 420,
    decision: "approved",
    decisionReason: "Annual multi-trip cover issued for the declared region.",
    assigned: true,
  },
  {
    key: "app-05",
    reference: "APP-DEMO-0005",
    customer: "customer-b",
    broker: "broker-1",
    product: "life",
    status: "approved",
    answers: { age_band: "35_49", smoker: "non_smoker", sum_assured: 250000 },
    submittedDaysAgo: 182,
    decidedDaysAgo: 180,
    decision: "approved",
    decisionReason: "Medical declaration accepted without further evidence.",
    assigned: true,
  },
  {
    key: "app-06",
    reference: "APP-DEMO-0006",
    customer: "customer-b",
    broker: "broker-1",
    product: "business",
    status: "approved",
    answers: { employees: "6_20", sector: "retail", business_name: "Berg Outdoor Supplies Ltd" },
    submittedDaysAgo: 302,
    decidedDaysAgo: 300,
    decision: "approved",
    decisionReason: "Liability cover issued for the declared retail premises.",
    assigned: true,
  },
  {
    key: "app-07",
    reference: "APP-DEMO-0007",
    customer: "customer-c",
    broker: "broker-2",
    product: "home",
    status: "approved",
    answers: { property_type: "flat", flood_risk: "medium", property_address: "Flat 3, 27 Kirkstall Lane, Leeds" },
    submittedDaysAgo: 62,
    decidedDaysAgo: 60,
    decision: "approved",
    decisionReason: "Medium flood risk accepted with the recorded excess.",
    assigned: true,
  },
  {
    key: "app-08",
    reference: "APP-DEMO-0008",
    customer: "customer-c",
    broker: "broker-2",
    product: "travel",
    status: "approved",
    answers: { travellers: "single", region: "worldwide", trip_start: "2026-06-02" },
    submittedDaysAgo: 122,
    decidedDaysAgo: 120,
    decision: "approved",
    decisionReason: "Worldwide annual cover issued as requested.",
    assigned: true,
  },
  {
    key: "app-09",
    reference: "APP-DEMO-0009",
    customer: "customer-c",
    broker: "broker-2",
    product: "motor",
    status: "under_review",
    answers: { annual_mileage: "10k_20k", claims_history: "none", vehicle: "2023 Hyundai Tucson" },
    submittedDaysAgo: 4,
    assigned: true,
  },
  {
    key: "app-10",
    reference: "APP-DEMO-0010",
    customer: "customer-a",
    broker: "broker-1",
    product: "life",
    status: "submitted",
    answers: { age_band: "18_34", smoker: "non_smoker", sum_assured: 150000 },
    submittedDaysAgo: 1,
    assigned: true,
  },
  {
    key: "app-11",
    reference: "APP-DEMO-0011",
    customer: "customer-b",
    broker: "broker-1",
    product: "motor",
    status: "draft",
    answers: { annual_mileage: "5k_10k", claims_history: "none", vehicle: "2018 Skoda Octavia" },
  },
  {
    key: "app-12",
    reference: "APP-DEMO-0012",
    customer: "customer-c",
    broker: "broker-2",
    product: "business",
    status: "declined",
    answers: { employees: "1_5", sector: "professional", business_name: "Raman Studio Ltd" },
    submittedDaysAgo: 46,
    decidedDaysAgo: 40,
    decision: "declined",
    decisionReason:
      "Demonstration decision: the declared professional-services activity falls outside the product appetite. No policy was issued.",
    assigned: true,
  },
];

type PolicySpec = {
  key: string;
  policyNumber: string;
  application: string;
  status: "active" | "expired" | "cancelled";
  startDaysAgo: number;
  endDaysFromNow: number;
  cancelledDaysAgo?: number;
  cancelReason?: string;
};

const DEMO_POLICIES: PolicySpec[] = [
  { key: "pol-01", policyNumber: "POL-DEMO-0001", application: "app-01", status: "active", startDaysAgo: 150, endDaysFromNow: 215 },
  { key: "pol-02", policyNumber: "POL-DEMO-0002", application: "app-02", status: "expired", startDaysAgo: 600, endDaysFromNow: -235 },
  { key: "pol-03", policyNumber: "POL-DEMO-0003", application: "app-03", status: "active", startDaysAgo: 90, endDaysFromNow: 275 },
  { key: "pol-04", policyNumber: "POL-DEMO-0004", application: "app-04", status: "expired", startDaysAgo: 420, endDaysFromNow: -55 },
  { key: "pol-05", policyNumber: "POL-DEMO-0005", application: "app-05", status: "active", startDaysAgo: 180, endDaysFromNow: 185 },
  { key: "pol-06", policyNumber: "POL-DEMO-0006", application: "app-06", status: "cancelled", startDaysAgo: 300, endDaysFromNow: 65, cancelledDaysAgo: 40, cancelReason: "Demonstration cancellation: cover replaced under a new arrangement." },
  { key: "pol-07", policyNumber: "POL-DEMO-0007", application: "app-07", status: "active", startDaysAgo: 60, endDaysFromNow: 305 },
  { key: "pol-08", policyNumber: "POL-DEMO-0008", application: "app-08", status: "active", startDaysAgo: 120, endDaysFromNow: 245 },
];

type ClaimStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "partially_approved"
  | "declined"
  | "paid";

type ClaimSpec = {
  key: string;
  reference: string;
  policy: string;
  incidentDaysAgo: number;
  reportedDaysAgo: number;
  amountClaimed: number;
  status: ClaimStatus;
  location: string;
  description: string;
  assigned?: boolean;
  decidedDaysAgo?: number;
  approvedAmount?: number;
  decisionReason?: string;
  paidDaysAgo?: number;
  settlementRef?: string;
};

const DEMO_CLAIMS: ClaimSpec[] = [
  {
    key: "clm-01",
    reference: "CLM-DEMO-0001",
    policy: "pol-01",
    incidentDaysAgo: 10,
    reportedDaysAgo: 9,
    amountClaimed: 85000,
    status: "submitted",
    location: "Bristol city centre car park",
    description:
      "Demonstration claim: minor rear bumper damage while parked, with photographs and a repair estimate attached.",
  },
  {
    key: "clm-02",
    reference: "CLM-DEMO-0002",
    policy: "pol-01",
    incidentDaysAgo: 25,
    reportedDaysAgo: 24,
    amountClaimed: 120000,
    status: "under_review",
    location: "M4 motorway, junction 19",
    description:
      "Demonstration claim: windscreen cracked by road debris. A replacement invoice and photographs are attached.",
    assigned: true,
  },
  {
    key: "clm-03",
    reference: "CLM-DEMO-0003",
    policy: "pol-03",
    incidentDaysAgo: 45,
    reportedDaysAgo: 44,
    amountClaimed: 240000,
    status: "approved",
    location: "14 Harbour View Mews, Bristol",
    description:
      "Demonstration claim: escape of water damaged the kitchen floor and lower cabinets. A plumber report is attached.",
    assigned: true,
    decidedDaysAgo: 20,
    approvedAmount: 190000,
    decisionReason: "Demonstration decision: covered escape of water; approved at the assessed repair cost after excess.",
  },
  {
    key: "clm-04",
    reference: "CLM-DEMO-0004",
    policy: "pol-05",
    incidentDaysAgo: 60,
    reportedDaysAgo: 59,
    amountClaimed: 500000,
    status: "declined",
    location: "Cork, Ireland",
    description:
      "Demonstration claim: a benefit request outside the declared cover. The policy schedule and declaration are attached.",
    assigned: true,
    decidedDaysAgo: 30,
    decisionReason:
      "Demonstration decision: the event does not fall within the cover described in the policy schedule. No payment is due.",
  },
  {
    key: "clm-05",
    reference: "CLM-DEMO-0005",
    policy: "pol-07",
    incidentDaysAgo: 35,
    reportedDaysAgo: 34,
    amountClaimed: 180000,
    status: "partially_approved",
    location: "Flat 3, 27 Kirkstall Lane, Leeds",
    description:
      "Demonstration claim: storm damage to a balcony door and flooring, with photographs and a contractor quote attached.",
    assigned: true,
    decidedDaysAgo: 15,
    approvedAmount: 90000,
    decisionReason:
      "Demonstration decision: part of the claim was excluded as gradual damage; the remaining amount was approved.",
  },
  {
    key: "clm-06",
    reference: "CLM-DEMO-0006",
    policy: "pol-08",
    incidentDaysAgo: 100,
    reportedDaysAgo: 98,
    amountClaimed: 96000,
    status: "paid",
    location: "Lisbon, Portugal",
    description:
      "Demonstration claim: emergency medical treatment abroad with hospital invoices and receipts attached.",
    assigned: true,
    decidedDaysAgo: 75,
    approvedAmount: 96000,
    decisionReason: "Demonstration decision: treatment covered in full; settlement recorded separately.",
    paidDaysAgo: 60,
    settlementRef: "SET-DEMO-0006",
  },
];

/* -------------------------------------------------------------------------- */
/* Notifications and notifications-driven activity                            */
/* -------------------------------------------------------------------------- */

type NotificationSpec = {
  key: string;
  user: IdentitySpec["key"];
  type: string;
  title: string;
  body: string;
  href: string;
  daysAgo: number;
  read?: boolean;
};

const DEMO_NOTIFICATIONS: NotificationSpec[] = [
  { key: "n01", user: "admin", type: "application.submitted", title: "New application APP-DEMO-0009", body: "Motor application submitted by a broker for manual underwriting.", href: "/dashboard/admin/applications", daysAgo: 4 },
  { key: "n02", user: "admin", type: "payment.succeeded", title: "Premium awaiting confirmation", body: "A demonstration renewal premium is pending confirmation. No real payment was taken.", href: "/dashboard/admin/payments", daysAgo: 2 },
  { key: "n03", user: "admin", type: "claim.submitted", title: "New claim CLM-DEMO-0002", body: "A windscreen claim is queued for manual review.", href: "/dashboard/admin/claims", daysAgo: 24 },
  { key: "n04", user: "admin", type: "support.updated", title: "A customer was assigned to a broker", body: "Demonstration broker assignment recorded for the demo book.", href: "/dashboard/admin/brokers", daysAgo: 61, read: true },
  { key: "n05", user: "customer-a", type: "application.approved", title: "Application APP-DEMO-0001 approved", body: "Motor cover was approved. A premium payment is now due before the policy is issued.", href: "/dashboard/applications", daysAgo: 150 },
  { key: "n06", user: "customer-a", type: "policy.issued", title: "Policy POL-DEMO-0001 issued", body: "Your motor certificate and schedule are available in the document library.", href: "/dashboard/policies", daysAgo: 149 },
  { key: "n07", user: "customer-a", type: "payment.succeeded", title: "Payment recorded for POL-DEMO-0001", body: "A demonstration premium receipt was recorded. No real funds were moved.", href: "/dashboard/payments", daysAgo: 149, read: true },
  { key: "n08", user: "customer-a", type: "claim.status_changed", title: "Claim CLM-DEMO-0002 under review", body: "A handler is reviewing the windscreen evidence you supplied.", href: "/dashboard/claims", daysAgo: 23 },
  { key: "n09", user: "customer-a", type: "renewal.approaching", title: "POL-DEMO-0001 renewal approaching", body: "Your demonstration motor policy is due for renewal within the reminder window.", href: "/dashboard/policies", daysAgo: 1 },
  { key: "n10", user: "customer-a", type: "claim.submitted", title: "Claim CLM-DEMO-0001 received", body: "Your demonstration claim is queued for review. This is not an admission of cover.", href: "/dashboard/claims", daysAgo: 9 },
  { key: "n11", user: "customer-b", type: "application.approved", title: "Application APP-DEMO-0005 approved", body: "Term life cover was approved and issued as POL-DEMO-0005.", href: "/dashboard/applications", daysAgo: 180, read: true },
  { key: "n12", user: "customer-b", type: "policy.issued", title: "Policy POL-DEMO-0005 issued", body: "Your demonstration life certificate is ready to download.", href: "/dashboard/policies", daysAgo: 179, read: true },
  { key: "n13", user: "customer-c", type: "policy.issued", title: "Policy POL-DEMO-0008 issued", body: "Your annual travel cover is active for the demonstration period.", href: "/dashboard/policies", daysAgo: 119 },
  { key: "n14", user: "customer-c", type: "claim.settled", title: "Settlement recorded for CLM-DEMO-0006", body: "A demonstration settlement of GBP 960 was recorded against your travel claim.", href: "/dashboard/claims", daysAgo: 60 },
  { key: "n15", user: "broker-1", type: "support.updated", title: "A customer was assigned to you", body: "Noor Haddad and Tomas Berg are now in your demonstration book of business.", href: "/dashboard/broker/customers", daysAgo: 61 },
  { key: "n16", user: "broker-1", type: "application.submitted", title: "Application APP-DEMO-0010 submitted", body: "A demonstration life application is queued for underwriting.", href: "/dashboard/applications", daysAgo: 1 },
  { key: "n17", user: "broker-2", type: "support.updated", title: "A customer was assigned to you", body: "Priya Raman is now in your demonstration book of business.", href: "/dashboard/broker/customers", daysAgo: 61, read: true },
];

/* -------------------------------------------------------------------------- */
/* Planning                                                                   */
/* -------------------------------------------------------------------------- */

function marker(key: string, seededAt: number) {
  return {
    isDemo: true as const,
    seedBatch: DEMO_SEED_BATCH,
    seededAt,
    demoKey: `${DEMO_SEED_BATCH}:${key}`,
  };
}

function demoKey(key: string) {
  return `${DEMO_SEED_BATCH}:${key}`;
}

function isDemoRow(row: { seedBatch?: string }) {
  return row.seedBatch === DEMO_SEED_BATCH;
}

function assertEnabled() {
  if (process.env[ENV_FLAG] !== "1") {
    throw new Error(
      `Demo seeding is disabled. Set ${ENV_FLAG}=1 on this deployment first (and unset it after use).`,
    );
  }
}

async function loadSnapshot(ctx: QueryCtx) {
  const [
    users,
    authAccounts,
    customerProfiles,
    brokerProfiles,
    brokerAssignments,
    products,
    applications,
    applicationEvents,
    policies,
    claims,
    claimEvents,
    transactions,
    documents,
    notifications,
    auditLogs,
  ] = await Promise.all([
    ctx.db.query("users").take(1000),
    ctx.db.query("authAccounts").take(1000),
    ctx.db.query("customerProfiles").take(1000),
    ctx.db.query("brokerProfiles").take(1000),
    ctx.db.query("brokerAssignments").take(1000),
    ctx.db.query("products").take(1000),
    ctx.db.query("applications").take(1000),
    ctx.db.query("applicationEvents").take(1000),
    ctx.db.query("policies").take(1000),
    ctx.db.query("claims").take(1000),
    ctx.db.query("claimEvents").take(1000),
    ctx.db.query("transactions").take(1000),
    ctx.db.query("documents").take(1000),
    ctx.db.query("notifications").take(1000),
    ctx.db.query("auditLogs").take(1000),
  ]);
  return {
    users,
    authAccounts,
    customerProfiles,
    brokerProfiles,
    brokerAssignments,
    products,
    applications,
    applicationEvents,
    policies,
    claims,
    claimEvents,
    transactions,
    documents,
    notifications,
    auditLogs,
  };
}

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;

function plannedCounts() {
  const decidedApplications = DEMO_APPLICATIONS.filter((app) => app.decision);
  const decidedClaims = DEMO_CLAIMS.filter((claim) => claim.decisionReason);
  return {
    users: IDENTITIES.length,
    customerProfiles: CUSTOMER_KEYS.length,
    brokerProfiles: BROKER_KEYS.length,
    brokerAssignments: BROKER_KEYS.length + 1,
    products: DEMO_PRODUCTS.length,
    applications: DEMO_APPLICATIONS.length,
    applicationEvents: DEMO_APPLICATIONS.reduce(
      (total, app) =>
        total + 1 + (app.status !== "draft" ? 1 : 0) + (app.assigned ? 1 : 0) + (app.decision ? 1 : 0),
      0,
    ),
    policies: DEMO_POLICIES.length,
    claims: DEMO_CLAIMS.length,
    claimEvents: DEMO_CLAIMS.reduce(
      (total, claim) =>
        total +
        1 +
        (claim.assigned ? 1 : 0) +
        (claim.decisionReason ? 1 : 0) +
        (claim.status === "paid" ? 1 : 0),
      0,
    ),
    // Three documents per policy, one receipt per confirmed premium, one decision letter per decided claim.
    documents: DEMO_POLICIES.length * 3 + DEMO_POLICIES.length + decidedClaims.length,
    transactions: DEMO_POLICIES.length + 2 + (DEMO_CLAIMS.some((claim) => claim.status === "paid") ? 1 : 0),
    notifications: DEMO_NOTIFICATIONS.length,
    auditLogs:
      1 +
      DEMO_PRODUCTS.length +
      decidedApplications.length +
      DEMO_POLICIES.length +
      DEMO_POLICIES.length +
      decidedClaims.length +
      (      DEMO_CLAIMS.some((claim) => claim.status === "paid") ? 1 : 0) +
      (BROKER_KEYS.length + 1) +
      DEMO_POLICIES.filter((policy) => policy.status === "cancelled").length,
  };
}

function existingDemoKeys(snapshot: Snapshot) {
  const collect = (rows: { demoKey?: string }[]) => {
    const keys = new Set<string>();
    for (const row of rows) if (row.demoKey) keys.add(row.demoKey);
    return keys;
  };
  return {
    products: collect(snapshot.products),
    applications: collect(snapshot.applications),
    policies: collect(snapshot.policies),
    claims: collect(snapshot.claims),
    transactions: collect(snapshot.transactions),
    documents: collect(snapshot.documents),
    notifications: collect(snapshot.notifications),
    applicationEvents: collect(snapshot.applicationEvents),
    claimEvents: collect(snapshot.claimEvents),
    auditLogs: collect(snapshot.auditLogs),
    brokerAssignments: collect(snapshot.brokerAssignments),
  };
}

function effectiveEmail(identity: IdentitySpec, overrides?: Record<string, string>) {
  const override = overrides?.[identity.key]?.trim().toLowerCase();
  return override || identity.email;
}

function normalizeRole(role?: string): "super_admin" | "admin" | "customer" | "broker" {
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  if (role === "broker") return "broker";
  return "customer";
}

async function userHasBusinessData(ctx: QueryCtx, userId: Id<"users">) {
  const [application, policy, claim, transaction] = await Promise.all([
    ctx.db.query("applications").withIndex("by_customer", (q) => q.eq("customerUserId", userId)).first(),
    ctx.db.query("policies").withIndex("by_customer", (q) => q.eq("customerUserId", userId)).first(),
    ctx.db.query("claims").withIndex("by_customer", (q) => q.eq("customerUserId", userId)).first(),
    ctx.db.query("transactions").withIndex("by_customer", (q) => q.eq("customerUserId", userId)).first(),
  ]);
  return Boolean(application || policy || claim || transaction);
}

type IdentityPlan = {
  key: string;
  email: string;
  name: string;
  role: StaffRole;
  userId: string | null;
  status: "ready" | "link-role" | "missing" | "conflict";
  note?: string;
};

async function buildIdentityPlan(
  ctx: QueryCtx,
  snapshot: Snapshot,
  overrides: Record<string, string> | undefined,
  allowDataOnly: boolean,
) {
  const plans: IdentityPlan[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const identity of IDENTITIES) {
    const email = effectiveEmail(identity, overrides);
    const user = snapshot.users.find((row) => (row.email ?? "").toLowerCase() === email);
    if (!user) {
      plans.push({
        key: identity.key,
        email,
        name: identity.name,
        role: identity.role,
        userId: null,
        status: "missing",
        note: allowDataOnly
          ? "Will be created as a data-only demo identity (no Convex Auth account, cannot sign in)."
          : "No Convex Auth user with this email. Sign in once with this email or pass allowDataOnlyIdentities for a sandbox.",
      });
      if (!allowDataOnly) {
        blockers.push(`${identity.key}: no Convex Auth user exists for ${email}.`);
      }
      continue;
    }

    const current = normalizeRole(user.role);
    if (current === identity.role) {
      plans.push({ key: identity.key, email, name: user.name ?? identity.name, role: identity.role, userId: user._id, status: "ready" });
      continue;
    }
    if (identity.role === "customer") {
      plans.push({
        key: identity.key,
        email,
        name: user.name ?? identity.name,
        role: identity.role,
        userId: user._id,
        status: "conflict",
        note: `Existing account has role "${current}".`,
      });
      blockers.push(`${identity.key}: ${email} exists with role "${current}", not customer.`);
      continue;
    }
    if (current !== "customer" || (await userHasBusinessData(ctx, user._id))) {
      plans.push({
        key: identity.key,
        email,
        name: user.name ?? identity.name,
        role: identity.role,
        userId: user._id,
        status: "conflict",
        note: `Refusing to elevate role "${current}" (or an account with existing business data).`,
      });
      blockers.push(`${identity.key}: ${email} cannot be elevated safely; review the account manually.`);
      continue;
    }
    plans.push({
      key: identity.key,
      email,
      name: user.name ?? identity.name,
      role: identity.role,
      userId: user._id,
      status: "link-role",
      note: `Role will be set to ${identity.role} for the demo dataset.`,
    });
  }

  if (allowDataOnly) {
    warnings.push(
      "Data-only demo identities have no Convex Auth account. They populate admin views but cannot sign in until each email completes the normal email-OTP flow with a deliverable inbox.",
    );
  }
  warnings.push(
    "The demo admin uses the conservative admin role plus products.manage and audit.view (needed for the admin dashboard). It does not take the super_admin seat, so the founding-super-admin path remains available.",
  );
  return { plans, blockers, warnings };
}

function buildPlan(
  snapshot: Snapshot,
  identityPlan: IdentityPlan[],
  allowDataOnly: boolean,
) {
  const planned = plannedCounts();
  const existingKeys = existingDemoKeys(snapshot);
  const blockers: string[] = [];

  const countExisting = (rows: { seedBatch?: string }[]) => rows.filter(isDemoRow).length;
  const existing = {
    users: snapshot.users.filter(isDemoRow).length,
    customerProfiles: countExisting(snapshot.customerProfiles),
    brokerProfiles: countExisting(snapshot.brokerProfiles),
    brokerAssignments: countExisting(snapshot.brokerAssignments),
    products: countExisting(snapshot.products),
    applications: countExisting(snapshot.applications),
    applicationEvents: countExisting(snapshot.applicationEvents),
    policies: countExisting(snapshot.policies),
    claims: countExisting(snapshot.claims),
    claimEvents: countExisting(snapshot.claimEvents),
    transactions: countExisting(snapshot.transactions),
    documents: countExisting(snapshot.documents),
    notifications: countExisting(snapshot.notifications),
    auditLogs: countExisting(snapshot.auditLogs),
  };

  // Identity records are counted separately: one per demo identity, create-or-link.
  const identityCreate = identityPlan.filter((item) => item.status === "missing").length;
  const identityLink = identityPlan.filter((item) => item.status === "link-role").length;
  const customerProfilesToCreate = identityPlan.filter(
    (item) =>
      item.role === "customer" &&
      (!item.userId || !snapshot.customerProfiles.some((row) => row.userId === item.userId)),
  ).length;
  const brokerProfilesToCreate = identityPlan.filter(
    (item) =>
      item.role === "broker" &&
      (!item.userId || !snapshot.brokerProfiles.some((row) => row.userId === item.userId)),
  ).length;

  const productKeysToCreate = DEMO_PRODUCTS.filter((item) => !existingKeys.products.has(demoKey(`product:${item.key}`))).length;
  const applicationKeysToCreate = DEMO_APPLICATIONS.filter((item) => !existingKeys.applications.has(demoKey(`application:${item.key}`))).length;
  const policyKeysToCreate = DEMO_POLICIES.filter((item) => !existingKeys.policies.has(demoKey(`policy:${item.key}`))).length;
  const claimKeysToCreate = DEMO_CLAIMS.filter((item) => !existingKeys.claims.has(demoKey(`claim:${item.key}`))).length;

  // Collision guards: never reuse a business identifier owned by a non-demo record.
  for (const product of DEMO_PRODUCTS) {
    const clash = snapshot.products.find((row) => row.code === product.code && !isDemoRow(row));
    if (clash) blockers.push(`Product code ${product.code} already belongs to a non-demo product (${clash._id}).`);
  }
  for (const application of DEMO_APPLICATIONS) {
    const clash = snapshot.applications.find((row) => row.reference === application.reference && !isDemoRow(row));
    if (clash) blockers.push(`Application reference ${application.reference} already exists outside this seed batch.`);
  }
  for (const policy of DEMO_POLICIES) {
    const clash = snapshot.policies.find((row) => row.policyNumber === policy.policyNumber && !isDemoRow(row));
    if (clash) blockers.push(`Policy number ${policy.policyNumber} already exists outside this seed batch.`);
  }
  for (const claim of DEMO_CLAIMS) {
    const clash = snapshot.claims.find((row) => row.reference === claim.reference && !isDemoRow(row));
    if (clash) blockers.push(`Claim reference ${claim.reference} already exists outside this seed batch.`);
  }
  for (const notification of DEMO_NOTIFICATIONS) {
    const dedupeKey = `${demoKey(`notification:${notification.key}`)}`;
    const clash = snapshot.notifications.find((row) => row.dedupeKey === dedupeKey && !isDemoRow(row));
    if (clash) blockers.push(`Notification dedupe key ${dedupeKey} is already in use.`);
  }
  const demoTransactionKeys = new Set(
    DEMO_POLICIES.map((policy) => `${demoKey(`premium:${policy.policyNumber}`)}`).concat([
      `${demoKey("renewal:POL-DEMO-0001")}`,
      `${demoKey("retry:POL-DEMO-0003")}`,
      `${demoKey("settlement:CLM-DEMO-0006")}`,
    ]),
  );
  for (const key of demoTransactionKeys) {
    const clash = snapshot.transactions.find((row) => row.idempotencyKey === key && !isDemoRow(row));
    if (clash) blockers.push(`Transaction idempotency key ${key} is already in use.`);
  }

  const toCreate = {
    users: identityCreate,
    customerProfiles: customerProfilesToCreate,
    brokerProfiles: brokerProfilesToCreate,
    brokerAssignments:
      planned.brokerAssignments -
      [...existingKeys.brokerAssignments].filter((key) => key.startsWith(demoKey("assignment:"))).length,
    products: productKeysToCreate,
    applications: applicationKeysToCreate,
    applicationEvents:
      planned.applicationEvents -
      [...existingKeys.applicationEvents].filter((key) => key.startsWith(demoKey("application-event:"))).length,
    policies: policyKeysToCreate,
    claims: claimKeysToCreate,
    claimEvents:
      planned.claimEvents -
      [...existingKeys.claimEvents].filter((key) => key.startsWith(demoKey("claim-event:"))).length,
    transactions:
      planned.transactions -
      [...existingKeys.transactions].filter((key) => key.startsWith(demoKey("transaction:"))).length,
    documents:
      planned.documents -
      [...existingKeys.documents].filter((key) => key.startsWith(demoKey("document:"))).length,
    notifications:
      planned.notifications -
      [...existingKeys.notifications].filter((key) => key.startsWith(demoKey("notification:"))).length,
    auditLogs:
      planned.auditLogs -
      [...existingKeys.auditLogs].filter((key) => key.startsWith(demoKey("audit:"))).length,
  };

  const planHash = hashPlan({
    batch: DEMO_SEED_BATCH,
    allowDataOnly,
    identities: identityPlan.map((item) => ({
      key: item.key,
      email: item.email,
      userId: item.userId,
      role: item.role,
      status: item.status,
    })),
    planned,
    existing,
    identityCreate,
    identityLink,
  });

  return { planned, existing, toCreate, blockers, planHash };
}

function hashPlan(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Dry run                                                                    */
/* -------------------------------------------------------------------------- */

export const preview = internalQuery({
  args: {
    allowDataOnlyIdentities: v.optional(v.boolean()),
    identityEmails: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const snapshot = await loadSnapshot(ctx);
    const allowDataOnly = args.allowDataOnlyIdentities ?? false;
    const identity = await buildIdentityPlan(ctx, snapshot, args.identityEmails, allowDataOnly);
    const plan = buildPlan(snapshot, identity.plans, allowDataOnly);
    const blockers = [...identity.blockers, ...plan.blockers];

    return {
      batch: DEMO_SEED_BATCH,
      environment: process.env.DEMO_SEED_ENVIRONMENT ?? "unlabelled",
      enabled: process.env[ENV_FLAG] === "1",
      mode: allowDataOnly ? "sandbox-data-only" : "existing-auth-users-only",
      planHash: plan.planHash,
      identities: identity.plans,
      counts: { planned: plan.planned, existing: plan.existing, toCreate: plan.toCreate },
      samples: {
        accounts: identity.plans.map((item) => ({ role: item.role, email: item.email, name: item.name })),
        products: DEMO_PRODUCTS.map((item) => ({ code: item.code, name: item.name, category: item.categoryKey, basePremium: item.basePremium, currency: item.currency, status: "published" })),
        applications: DEMO_APPLICATIONS.map((item) => ({ reference: item.reference, status: item.status, product: item.product })),
        policies: DEMO_POLICIES.map((item) => ({ policyNumber: item.policyNumber, status: item.status })),
        claims: DEMO_CLAIMS.map((item) => ({ reference: item.reference, status: item.status })),
      },
      sideEffects: {
        email: "none — notifications are inserted with emailStatus=skipped and no scheduler call",
        payments: "none — transactions are historical records only, no provider call",
        externalWebhooks: "none",
        deletes: "none — preview is read-only",
      },
      blockers,
      warnings: identity.warnings,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Apply                                                                      */
/* -------------------------------------------------------------------------- */

export const apply = internalMutation({
  args: {
    confirm: v.string(),
    planHash: v.string(),
    allowDataOnlyIdentities: v.optional(v.boolean()),
    identityEmails: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    assertEnabled();
    if (args.confirm !== CONFIRM_APPLY) {
      throw new Error(`Confirmation phrase must be exactly "${CONFIRM_APPLY}".`);
    }
    const allowDataOnly = args.allowDataOnlyIdentities ?? false;
    const snapshot = await loadSnapshot(ctx);
    const identityPlan = await buildIdentityPlan(ctx, snapshot, args.identityEmails, allowDataOnly);
    const plan = buildPlan(snapshot, identityPlan.plans, allowDataOnly);
    const blockers = [...identityPlan.blockers, ...plan.blockers];

    if (plan.planHash !== args.planHash) {
      throw new Error(
        `The dry-run hash is stale (previewed ${args.planHash}, current ${plan.planHash}). Run demoSeed:preview again and review the new plan before applying.`,
      );
    }
    if (blockers.length > 0) {
      throw new Error(`Demo seed blocked:\n- ${blockers.join("\n- ")}`);
    }

    const now = Date.now();
    const created: Record<string, number> = {};
    const skipped: Record<string, number> = {};
    const bump = (bucket: Record<string, number>, table: string) => {
      bucket[table] = (bucket[table] ?? 0) + 1;
    };

    /* 1. Identities (never credentials, never an existing name). */
    const userIds = new Map<string, Id<"users">>();
    for (const identity of IDENTITIES) {
      const planItem = identityPlan.plans.find((item) => item.key === identity.key)!;
      const email = effectiveEmail(identity, args.identityEmails);
      if (planItem.userId) {
        const id = planItem.userId as Id<"users">;
        userIds.set(identity.key, id);
        if (planItem.status === "link-role") {
          await ctx.db.patch(id, {
            role: identity.role,
            permissions: permissionsFor(identity.role),
            lastRoleChangeAt: now,
            ...marker(`user:${identity.key}`, now),
          });
          bump(created, "users");
        }
        continue;
      }
      const id = await ctx.db.insert("users", {
        email,
        name: identity.name,
        isAnonymous: false,
        role: identity.role,
        permissions: permissionsFor(identity.role),
        status: "active",
        ...marker(`user:${identity.key}`, now),
      });
      userIds.set(identity.key, id);
      bump(created, "users");
    }

    /* 2. Profiles (never overwrite an existing profile). */
    for (const identity of IDENTITIES) {
      const userId = userIds.get(identity.key)!;
      if (identity.role === "customer") {
        const existing = await ctx.db
          .query("customerProfiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        if (existing) {
          bump(skipped, "customerProfiles");
          continue;
        }
        const location = CUSTOMER_COUNTRY[identity.key as CustomerKey];
        await ctx.db.insert("customerProfiles", {
          userId,
          reference: `CUS-DEMO-${identity.key.slice(-1).toUpperCase()}`,
          fullName: identity.name,
          email: effectiveEmail(identity, args.identityEmails),
          phone: "+44 117 496 0000",
          dateOfBirth: "1988-04-12",
          country: location.country,
          city: location.city,
          addressLine: location.address,
          postalCode: location.postal,
          currency: "GBP",
          locale: "en-GB",
          timezone: "Europe/London",
          preferredLanguage: "en",
          marketingOptIn: false,
          verificationStatus: "verified",
          notes: "Demo identity created by the protected demo seed workflow.",
          createdAt: now - 240 * DAY,
          updatedAt: now,
          ...marker(`customer:${identity.key}`, now),
        });
        bump(created, "customerProfiles");
      }
      if (identity.role === "broker") {
        const existing = await ctx.db
          .query("brokerProfiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        if (existing) {
          bump(skipped, "brokerProfiles");
          continue;
        }
        await ctx.db.insert("brokerProfiles", {
          userId,
          reference: `BRK-DEMO-${identity.key.slice(-1)}`,
          orgName: identity.org ?? "Demo Brokerage",
          contactName: identity.name,
          email: effectiveEmail(identity, args.identityEmails),
          phone: "+44 20 7946 0000",
          countries: ["GB", "IE"],
          status: "active",
          agreementRef: `AGR-DEMO-${identity.key.slice(-1)}`,
          commissionEnabled: true,
          commissionRate: identity.key === "broker-1" ? 12.5 : 10,
          createdAt: now - 300 * DAY,
          updatedAt: now,
          ...marker(`broker:${identity.key}`, now),
        });
        bump(created, "brokerProfiles");
      }
    }

    /* 3. Broker assignments (customer book). */
    const assignmentPlan: { broker: BrokerKey; customer: CustomerKey }[] = [
      { broker: "broker-1", customer: "customer-a" },
      { broker: "broker-1", customer: "customer-b" },
      { broker: "broker-2", customer: "customer-c" },
    ];
    for (const item of assignmentPlan) {
      const key = demoKey(`assignment:${item.broker}:${item.customer}`);
      const existing = snapshot.brokerAssignments.find((row) => row.demoKey === key);
      if (existing) {
        bump(skipped, "brokerAssignments");
        continue;
      }
      await ctx.db.insert("brokerAssignments", {
        brokerUserId: userIds.get(item.broker)!,
        customerUserId: userIds.get(item.customer)!,
        status: "active",
        assignedBy: userIds.get("admin")!,
        note: "Demonstration assignment created by the demo seed workflow.",
        createdAt: now - 61 * DAY,
        ...marker(`assignment:${item.broker}:${item.customer}`, now),
      });
      bump(created, "brokerAssignments");
    }

    /* 4. Products. */
    const productIds = new Map<ProductKey, Id<"products">>();
    for (const spec of DEMO_PRODUCTS) {
      const key = demoKey(`product:${spec.key}`);
      const existing = snapshot.products.find((row) => row.demoKey === key);
      if (existing) {
        productIds.set(spec.key, existing._id);
        bump(skipped, "products");
        continue;
      }
      const id = await ctx.db.insert("products", {
        code: spec.code,
        name: spec.name,
        categoryKey: spec.categoryKey,
        description: spec.description,
        targetCustomer: spec.targetCustomer,
        countries: spec.countries,
        currency: spec.currency,
        basePremium: spec.basePremium,
        termMonths: 12,
        excess: spec.excess,
        coverageLimit: spec.coverageLimit,
        exclusions: spec.exclusions,
        benefits: spec.benefits,
        ratingFactors: spec.ratingFactors,
        questions: spec.questions,
        requiredDocuments: spec.requiredDocuments,
        wordingVersion: "1.0",
        wording: `${DEMO_NOTICE}\n\nCover is subject to eligibility, exclusions, limits and the excess shown in the schedule. Claims are assessed manually by an authorised handler.`,
        disclosures: `${DEMO_NOTICE}\n\nThis is a demonstration product used to exercise the platform. It is not an offer of insurance and no cover exists.`,
        status: "published",
        version: 1,
        effectiveFrom: now - 90 * DAY,
        renewalNoticeDays: 30,
        cancellationNoticeDays: 14,
        createdBy: userIds.get("admin")!,
        publishedBy: userIds.get("admin")!,
        publishedAt: now - 90 * DAY,
        createdAt: now - 90 * DAY,
        updatedAt: now - 90 * DAY,
        ...marker(`product:${spec.key}`, now),
      });
      productIds.set(spec.key, id);
      bump(created, "products");
    }

    /* 5. Applications. */
    const appIds = new Map<string, Id<"applications">>();
    const appByKey = new Map(DEMO_APPLICATIONS.map((item) => [item.key, item]));
    for (const spec of DEMO_APPLICATIONS) {
      const key = demoKey(`application:${spec.key}`);
      const existing = snapshot.applications.find((row) => row.demoKey === key);
      if (existing) {
        appIds.set(spec.key, existing._id);
        bump(skipped, "applications");
        continue;
      }
      const product = DEMO_PRODUCTS.find((item) => item.key === spec.product)!;
      const customerId = userIds.get(spec.customer)!;
      const submittedAt = spec.submittedDaysAgo !== undefined ? now - spec.submittedDaysAgo * DAY : undefined;
      const decidedAt = spec.decidedDaysAgo !== undefined ? now - spec.decidedDaysAgo * DAY : undefined;
      const documents = [
        {
          name: `${product.requiredDocuments[0].label} — ${spec.reference}`,
          key: product.requiredDocuments[0].key,
          body: `${DEMO_NOTICE}\n\nFictional supporting document for ${spec.reference}.`,
          addedBy: customerId,
          addedAt: submittedAt ?? now - 5 * DAY,
        },
      ];
      const id = await ctx.db.insert("applications", {
        reference: spec.reference,
        customerUserId: customerId,
        brokerUserId: userIds.get(spec.broker)!,
        productId: productIds.get(product.key)!,
        productCode: product.code,
        productVersion: 1,
        productName: product.name,
        categoryKey: product.categoryKey,
        country: CUSTOMER_COUNTRY[spec.customer].country,
        currency: product.currency,
        premium: answerPremium(product, spec.answers),
        answers: spec.answers,
        status: spec.status,
        submittedAt,
        assignedTo: spec.assigned ? userIds.get("admin")! : undefined,
        decision: spec.decision,
        decisionReason: spec.decisionReason,
        decidedBy: spec.decision ? userIds.get("admin")! : undefined,
        decidedAt,
        termsAcceptedAt: submittedAt,
        consentRecordedAt: submittedAt,
        documents,
        createdAt: (submittedAt ?? now) - 2 * DAY,
        updatedAt: decidedAt ?? submittedAt ?? now - 5 * DAY,
        ...marker(`application:${spec.key}`, now),
      });
      appIds.set(spec.key, id);
      bump(created, "applications");
    }

    /* 6. Policies (issued only from approved applications). */
    const policyIds = new Map<string, Id<"policies">>();
    for (const spec of DEMO_POLICIES) {
      const key = demoKey(`policy:${spec.key}`);
      const existing = snapshot.policies.find((row) => row.demoKey === key);
      if (existing) {
        policyIds.set(spec.key, existing._id);
        bump(skipped, "policies");
        continue;
      }
      const applicationSpec = appByKey.get(spec.application)!;
      const product = DEMO_PRODUCTS.find((item) => item.key === applicationSpec.product)!;
      const applicationId = appIds.get(applicationSpec.key)!;
      const startDate = now - spec.startDaysAgo * DAY;
      const endDate = now + spec.endDaysFromNow * DAY;
      const issuedAt = startDate - DAY;
      const premium = answerPremium(product, applicationSpec.answers);
      const id = await ctx.db.insert("policies", {
        policyNumber: spec.policyNumber,
        customerUserId: userIds.get(applicationSpec.customer)!,
        brokerUserId: userIds.get(applicationSpec.broker)!,
        applicationId,
        productId: productIds.get(product.key)!,
        productCode: product.code,
        productVersion: 1,
        productName: product.name,
        categoryKey: product.categoryKey,
        status: spec.status,
        insuredName: IDENTITIES.find((item) => item.key === applicationSpec.customer)!.name,
        country: CUSTOMER_COUNTRY[applicationSpec.customer].country,
        currency: product.currency,
        premium,
        excess: product.excess,
        coverageLimit: product.coverageLimit,
        exclusions: product.exclusions,
        benefits: product.benefits,
        wordingVersion: "1.0",
        startDate,
        endDate,
        renewalDate: endDate - 30 * DAY,
        issuedBy: userIds.get("admin")!,
        issuedAt,
        cancelledAt: spec.cancelledDaysAgo !== undefined ? now - spec.cancelledDaysAgo * DAY : undefined,
        cancelReason: spec.cancelReason,
        endorsements:
          spec.status === "cancelled"
            ? [
                {
                  summary: spec.cancelReason ?? "Demonstration cancellation.",
                  at: now - (spec.cancelledDaysAgo ?? 1) * DAY,
                  by: userIds.get("admin")!,
                },
              ]
            : [],
        createdAt: issuedAt,
        updatedAt: now - (spec.cancelledDaysAgo ?? 0) * DAY,
        ...marker(`policy:${spec.key}`, now),
      });
      policyIds.set(spec.key, id);
      bump(created, "policies");

      const application = await ctx.db.get(applicationId);
      if (application && !application.policyId) {
        await ctx.db.patch(applicationId, { policyId: id });
      }
    }

    /* 7. Claims (inside the policy term, manual historical decisions). */
    const claimIds = new Map<string, Id<"claims">>();
    for (const spec of DEMO_CLAIMS) {
      const key = demoKey(`claim:${spec.key}`);
      const existing = snapshot.claims.find((row) => row.demoKey === key);
      if (existing) {
        claimIds.set(spec.key, existing._id);
        bump(skipped, "claims");
        continue;
      }
      const policySpec = DEMO_POLICIES.find((item) => item.key === spec.policy)!;
      const applicationSpec = appByKey.get(policySpec.application)!;
      const product = DEMO_PRODUCTS.find((item) => item.key === applicationSpec.product)!;
      const customerId = userIds.get(applicationSpec.customer)!;
      const reportedAt = now - spec.reportedDaysAgo * DAY;
      const decidedAt = spec.decidedDaysAgo !== undefined ? now - spec.decidedDaysAgo * DAY : undefined;
      const paidAt = spec.paidDaysAgo !== undefined ? now - spec.paidDaysAgo * DAY : undefined;
      const id = await ctx.db.insert("claims", {
        reference: spec.reference,
        policyId: policyIds.get(spec.policy)!,
        customerUserId: customerId,
        productId: productIds.get(product.key)!,
        productName: product.name,
        country: CUSTOMER_COUNTRY[applicationSpec.customer].country,
        currency: product.currency,
        incidentDate: now - spec.incidentDaysAgo * DAY,
        location: spec.location,
        description: spec.description,
        amountClaimed: spec.amountClaimed,
        status: spec.status,
        assignedTo: spec.assigned ? userIds.get("admin")! : undefined,
        decision: spec.status === "declined" ? "declined" : spec.approvedAmount !== undefined ? (spec.status === "partially_approved" ? "partially_approved" : "approved") : undefined,
        approvedAmount: spec.approvedAmount,
        decisionReason: spec.decisionReason,
        decidedBy: spec.decisionReason ? userIds.get("admin")! : undefined,
        decidedAt,
        settlementRef: spec.settlementRef,
        paidAt,
        documents: [
          {
            name: `Evidence — ${spec.reference}`,
            key: "supporting_evidence",
            body: `${DEMO_NOTICE}\n\nFictional supporting evidence for ${spec.reference}.`,
            addedBy: customerId,
            addedAt: reportedAt,
          },
        ],
        reportedAt,
        createdAt: reportedAt,
        updatedAt: paidAt ?? decidedAt ?? reportedAt,
        ...marker(`claim:${spec.key}`, now),
      });
      claimIds.set(spec.key, id);
      bump(created, "claims");
    }

    /* 8. Transactions: one confirmed premium per policy, one pending, one failed, one settlement. */
    const transactionIds = new Map<string, Id<"transactions">>();
    const transactionDefaults = (customerId: Id<"users">, createdAt: number) => ({
      customerUserId: customerId,
      type: "premium" as const,
      currency: "GBP",
      method: "bank_transfer" as const,
      providerVerified: false,
      reconciled: false,
      createdAt,
      updatedAt: createdAt,
    });

    for (const [index, spec] of DEMO_POLICIES.entries()) {
      const policyId = policyIds.get(spec.key)!;
      const policy = await ctx.db.get(policyId);
      if (!policy) continue;
      const key = demoKey(`premium:${spec.policyNumber}`);
      const existing = snapshot.transactions.find((row) => row.demoKey === demoKey(`transaction:premium:${spec.policyNumber}`));
      if (existing) {
        transactionIds.set(spec.key, existing._id);
        bump(skipped, "transactions");
        continue;
      }
      const reference = `PAY-DEMO-${String(index + 1).padStart(4, "0")}`;
      const id = await ctx.db.insert("transactions", {
        ...transactionDefaults(policy.customerUserId, policy.issuedAt),
        reference,
        policyId,
        amount: policy.premium,
        status: "succeeded",
        providerRef: `DEMO-BANK-${String(index + 1).padStart(4, "0")}`,
        providerVerified: true,
        idempotencyKey: key,
        note: `Demonstration premium for ${spec.policyNumber}. No real funds moved.`,
        recordedBy: userIds.get("admin")!,
        reconciled: true,
        reconciledBy: userIds.get("admin")!,
        reconciledAt: policy.issuedAt + DAY,
        ...marker(`transaction:premium:${spec.policyNumber}`, now),
      });
      transactionIds.set(spec.key, id);
      bump(created, "transactions");
    }

    const pendingKey = demoKey("renewal:POL-DEMO-0001");
    const pendingExisting = snapshot.transactions.find((row) => row.demoKey === demoKey("transaction:renewal:POL-DEMO-0001"));
    if (pendingExisting) {
      bump(skipped, "transactions");
    } else {
      const policyOneId = policyIds.get("pol-01")!;
      const policyOne = await ctx.db.get(policyOneId);
      if (policyOne) {
        await ctx.db.insert("transactions", {
          ...transactionDefaults(policyOne.customerUserId, now - 2 * DAY),
          reference: "PAY-DEMO-1001",
          policyId: policyOneId,
          amount: policyOne.premium,
          status: "pending",
          idempotencyKey: pendingKey,
          note: "Demonstration renewal premium invitation. Not an invoice and no payment is due.",
          dueDate: now + 10 * DAY,
          ...marker("transaction:renewal:POL-DEMO-0001", now),
        });
        bump(created, "transactions");
      }
    }

    const failedExisting = snapshot.transactions.find((row) => row.demoKey === demoKey("transaction:retry:POL-DEMO-0003"));
    if (failedExisting) {
      bump(skipped, "transactions");
    } else {
      const policyThree = await ctx.db.get(policyIds.get("pol-03")!);
      if (policyThree) {
        await ctx.db.insert("transactions", {
          ...transactionDefaults(policyThree.customerUserId, now - 12 * DAY),
          reference: "PAY-DEMO-1002",
          policyId: policyThree._id,
          amount: 5000,
          status: "failed",
          method: "card",
          idempotencyKey: demoKey("retry:POL-DEMO-0003"),
          note: "Demonstration card attempt that failed. No card was charged.",
          failureReason: "Demonstration decline: the test card was not charged.",
          ...marker("transaction:retry:POL-DEMO-0003", now),
        });
        bump(created, "transactions");
      }
    }

    const paidClaimSpec = DEMO_CLAIMS.find((claim) => claim.status === "paid");
    if (paidClaimSpec) {
      const paidExisting = snapshot.transactions.find((row) => row.demoKey === demoKey("transaction:settlement:CLM-DEMO-0006"));
      if (paidExisting) {
        bump(skipped, "transactions");
      } else {
        const claimId = claimIds.get(paidClaimSpec.key)!;
        const claim = await ctx.db.get(claimId);
        if (claim) {
          const paidAt = now - (paidClaimSpec.paidDaysAgo ?? 1) * DAY;
          await ctx.db.insert("transactions", {
            ...transactionDefaults(claim.customerUserId, paidAt),
            reference: "SET-DEMO-0006",
            policyId: claim.policyId,
            claimId,
            type: "settlement",
            amount: paidClaimSpec.approvedAmount ?? paidClaimSpec.amountClaimed,
            status: "succeeded",
            method: "manual",
            providerRef: "DEMO-SETTLEMENT-0006",
            providerVerified: true,
            idempotencyKey: demoKey("settlement:CLM-DEMO-0006"),
            note: "Demonstration claim settlement. No real payment was made.",
            recordedBy: userIds.get("admin")!,
            reconciled: true,
            reconciledBy: userIds.get("admin")!,
            reconciledAt: paidAt + DAY,
            ...marker("transaction:settlement:CLM-DEMO-0006", now),
          });
          bump(created, "transactions");
        }
      }
    }

    /* 9. Documents (text bodies only; no storage objects are created). */
    for (const spec of DEMO_POLICIES) {
      const policyId = policyIds.get(spec.key)!;
      const policy = await ctx.db.get(policyId);
      if (!policy) continue;
      const docs = [
        { kind: "schedule", name: `${spec.policyNumber} — policy schedule`, body: `POLICY SCHEDULE\n\n${spec.policyNumber}\nInsured: ${policy.insuredName}\nProduct: ${policy.productName}\nTerm: ${new Date(policy.startDate).toISOString().slice(0, 10)} to ${new Date(policy.endDate).toISOString().slice(0, 10)}\nPremium: ${(policy.premium / 100).toFixed(2)} ${policy.currency}\n\n${DEMO_NOTICE}` },
        { kind: "certificate", name: `${spec.policyNumber} — certificate of insurance`, body: `CERTIFICATE OF INSURANCE\n\n${spec.policyNumber}\n${policy.productName}\n\n${DEMO_NOTICE}` },
        { kind: "wording", name: `${spec.policyNumber} — policy wording`, body: `POLICY WORDING\n\n${policy.productName}\n\n${DEMO_NOTICE}\n\nCover is subject to the exclusions and limits recorded in the schedule.` },
      ];
      for (const doc of docs) {
        const documentKey = demoKey(`document:policy:${spec.policyNumber}:${doc.kind}`);
        if (snapshot.documents.some((row) => row.demoKey === documentKey)) {
          bump(skipped, "documents");
          continue;
        }
        await ctx.db.insert("documents", {
          ownerUserId: policy.customerUserId,
          name: doc.name,
          category: "policy",
          policyId,
          body: doc.body,
          contentType: "text/plain",
          version: 1,
          issuedBy: userIds.get("admin")!,
          issuedAt: policy.issuedAt,
          createdAt: policy.issuedAt,
          ...marker(`document:policy:${spec.policyNumber}:${doc.kind}`, now),
        });
        bump(created, "documents");
      }
    }

    for (const [index, spec] of DEMO_POLICIES.entries()) {
      const transactionId = transactionIds.get(spec.key);
      if (!transactionId) continue;
      const policy = await ctx.db.get(policyIds.get(spec.key)!);
      const transaction = await ctx.db.get(transactionId);
      if (!policy || !transaction) continue;
      const documentKey = demoKey(`document:receipt:${spec.policyNumber}`);
      if (snapshot.documents.some((row) => row.demoKey === documentKey)) {
        bump(skipped, "documents");
        continue;
      }
      await ctx.db.insert("documents", {
        ownerUserId: policy.customerUserId,
        name: `Receipt PAY-DEMO-${String(index + 1).padStart(4, "0")} — ${spec.policyNumber}`,
        category: "receipt",
        policyId: policy._id,
        body: `PAYMENT RECEIPT\n\nReference: ${transaction.reference}\nPolicy: ${spec.policyNumber}\nAmount: ${(transaction.amount / 100).toFixed(2)} ${transaction.currency}\n\n${DEMO_NOTICE}`,
        contentType: "text/plain",
        version: 1,
        issuedBy: userIds.get("admin")!,
        issuedAt: transaction.createdAt,
        createdAt: transaction.createdAt,
        ...marker(`document:receipt:${spec.policyNumber}`, now),
      });
      bump(created, "documents");
    }

    for (const spec of DEMO_CLAIMS) {
      if (!spec.decisionReason) continue;
      const claimId = claimIds.get(spec.key)!;
      const claim = await ctx.db.get(claimId);
      if (!claim) continue;
      const documentKey = demoKey(`document:claim:${spec.reference}`);
      if (snapshot.documents.some((row) => row.demoKey === documentKey)) {
        bump(skipped, "documents");
        continue;
      }
      const decidedAt = claim.decidedAt ?? now - 30 * DAY;
      await ctx.db.insert("documents", {
        ownerUserId: claim.customerUserId,
        name: `Claim ${spec.reference} — decision letter`,
        category: "claim",
        claimId,
        body: `CLAIM DECISION\n\nClaim: ${spec.reference}\nStatus: ${claim.status}\nDecision: ${claim.decision ?? "pending"}\nApproved amount: ${((claim.approvedAmount ?? 0) / 100).toFixed(2)} ${claim.currency}\n\n${claim.decisionReason ?? ""}\n\n${DEMO_NOTICE}`,
        contentType: "text/plain",
        version: 1,
        issuedBy: userIds.get("admin")!,
        issuedAt: decidedAt,
        createdAt: decidedAt,
        ...marker(`document:claim:${spec.reference}`, now),
      });
      bump(created, "documents");
    }

    /* 10. Application events (the detail timelines). */
    for (const spec of DEMO_APPLICATIONS) {
      const applicationId = appIds.get(spec.key)!;
      const customerId = userIds.get(spec.customer)!;
      const createdAt = (spec.submittedDaysAgo !== undefined ? now - spec.submittedDaysAgo * DAY : now - 5 * DAY) - 2 * DAY;
      const submittedAt = spec.submittedDaysAgo !== undefined ? now - spec.submittedDaysAgo * DAY : undefined;
      const decidedAt = spec.decidedDaysAgo !== undefined ? now - spec.decidedDaysAgo * DAY : undefined;
      const events = [
        { kind: "created", at: createdAt, actorId: customerId, actorRole: "customer", message: "Demonstration application created from a catalogue quotation.", fromStatus: undefined, toStatus: "draft", internal: false },
        ...(submittedAt ? [{ kind: "submitted", at: submittedAt, actorId: customerId, actorRole: "customer", message: "Application submitted for manual underwriting.", fromStatus: "draft", toStatus: "submitted", internal: false }] : []),
        ...(spec.assigned && submittedAt ? [{ kind: "assigned", at: submittedAt + 60 * 60 * 1000, actorId: userIds.get("admin")!, actorRole: "admin", message: "Application assigned to a demonstration underwriter.", fromStatus: undefined, toStatus: undefined, internal: true }] : []),
        ...(spec.decision && decidedAt ? [{ kind: "decision", at: decidedAt, actorId: userIds.get("admin")!, actorRole: "admin", message: spec.decisionReason ?? "Decision recorded.", fromStatus: "under_review", toStatus: spec.status, internal: false }] : []),
      ];
      for (const event of events) {
        const key = demoKey(`application-event:${spec.key}:${event.kind}`);
        if (snapshot.applicationEvents.some((row) => row.demoKey === key)) {
          bump(skipped, "applicationEvents");
          continue;
        }
        await ctx.db.insert("applicationEvents", {
          applicationId,
          actorId: event.actorId,
          actorRole: event.actorRole,
          kind: event.kind === "created" || event.kind === "submitted" ? "status" : event.kind === "assigned" ? "assignment" : "decision",
          message: event.message,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          internal: event.internal,
          createdAt: event.at,
          ...marker(`application-event:${spec.key}:${event.kind}`, now),
        });
        bump(created, "applicationEvents");
      }
    }

    /* 11. Claim events. */
    for (const spec of DEMO_CLAIMS) {
      const claimId = claimIds.get(spec.key)!;
      const claim = await ctx.db.get(claimId);
      if (!claim) continue;
      const decidedAt = claim.decidedAt;
      const paidAt = claim.paidAt;
      const events = [
        { kind: "submitted", at: claim.reportedAt, message: "Claim submitted with supporting evidence.", fromStatus: undefined, toStatus: "submitted", internal: false },
        ...(spec.assigned ? [{ kind: "assigned", at: claim.reportedAt + 60 * 60 * 1000, message: "Claim assigned to a demonstration handler.", fromStatus: undefined, toStatus: "under_review", internal: true }] : []),
        ...(spec.decisionReason && decidedAt ? [{ kind: "decision", at: decidedAt, message: spec.decisionReason, fromStatus: "under_review", toStatus: spec.status, internal: false }] : []),
        ...(paidAt ? [{ kind: "settlement", at: paidAt, message: `Settlement ${spec.settlementRef ?? "recorded"} for the approved amount.`, fromStatus: spec.status, toStatus: "paid", internal: false }] : []),
      ];
      for (const event of events) {
        const key = demoKey(`claim-event:${spec.key}:${event.kind}`);
        if (snapshot.claimEvents.some((row) => row.demoKey === key)) {
          bump(skipped, "claimEvents");
          continue;
        }
        await ctx.db.insert("claimEvents", {
          claimId,
          actorId: event.kind === "submitted" ? claim.customerUserId : userIds.get("admin")!,
          actorRole: event.kind === "submitted" ? "customer" : "admin",
          kind: event.kind === "submitted" ? "status" : event.kind === "assigned" ? "status" : event.kind === "settlement" ? "settlement" : "decision",
          message: event.message,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          internal: event.internal,
          createdAt: event.at,
          ...marker(`claim-event:${spec.key}:${event.kind}`, now),
        });
        bump(created, "claimEvents");
      }
    }

    /* 12. Notifications — inserted directly with email skipped; no scheduler call. */
    for (const spec of DEMO_NOTIFICATIONS) {
      const userId = userIds.get(spec.user)!;
      const key = demoKey(`notification:${spec.key}`);
      if (snapshot.notifications.some((row) => row.demoKey === key)) {
        bump(skipped, "notifications");
        continue;
      }
      await ctx.db.insert("notifications", {
        userId,
        type: spec.type,
        title: spec.title,
        body: spec.body,
        href: spec.href,
        relatedType: "demoSeed",
        relatedId: DEMO_SEED_BATCH,
        dedupeKey: `${key}:${userId}`,
        readAt: spec.read ? now - spec.daysAgo * DAY : undefined,
        emailStatus: "skipped",
        emailAttempts: 0,
        createdAt: now - spec.daysAgo * DAY,
        ...marker(`notification:${spec.key}`, now),
      });
      bump(created, "notifications");
    }

    /* 13. Append-only audit history for the demo decisions. */
    const auditRows: {
      action: string;
      entityType: string;
      entityId: string;
      at: number;
      after: unknown;
      reason?: string;
    }[] = [];
    auditRows.push({
      action: "demo.seed_applied",
      entityType: "demoSeed",
      entityId: DEMO_SEED_BATCH,
      at: now,
      after: { batch: DEMO_SEED_BATCH, mode: allowDataOnly ? "sandbox-data-only" : "existing-auth-users-only", planHash: plan.planHash },
      reason: "Protected demonstration dataset applied through internal tooling.",
    });
    for (const product of DEMO_PRODUCTS) {
      auditRows.push({ action: "product.published", entityType: "products", entityId: String(productIds.get(product.key)), at: now - 90 * DAY, after: { code: product.code } });
    }
    for (const spec of DEMO_APPLICATIONS) {
      if (!spec.decision) continue;
      auditRows.push({
        action: `application.${spec.decision}`,
        entityType: "applications",
        entityId: String(appIds.get(spec.key)),
        at: now - (spec.decidedDaysAgo ?? 1) * DAY,
        after: { reference: spec.reference, decision: spec.decision },
        reason: spec.decisionReason,
      });
    }
    for (const spec of DEMO_POLICIES) {
      const policy = await ctx.db.get(policyIds.get(spec.key)!);
      if (!policy) continue;
      auditRows.push({ action: "policy.issued", entityType: "policies", entityId: String(policy._id), at: policy.issuedAt, after: { policyNumber: spec.policyNumber } });
      if (spec.status === "cancelled") {
        auditRows.push({ action: "policy.cancelled", entityType: "policies", entityId: String(policy._id), at: policy.cancelledAt ?? now, after: { policyNumber: spec.policyNumber, status: "cancelled" }, reason: spec.cancelReason });
      }
    }
    for (const [index, spec] of DEMO_POLICIES.entries()) {
      const policy = await ctx.db.get(policyIds.get(spec.key)!);
      if (!policy) continue;
      auditRows.push({ action: "payment.confirmed", entityType: "transactions", entityId: `PAY-DEMO-${String(index + 1).padStart(4, "0")}`, at: policy.issuedAt + DAY, after: { policyNumber: spec.policyNumber } });
    }
    for (const spec of DEMO_CLAIMS) {
      if (!spec.decisionReason) continue;
      auditRows.push({
        action: "claim.decided",
        entityType: "claims",
        entityId: String(claimIds.get(spec.key)),
        at: now - (spec.decidedDaysAgo ?? 1) * DAY,
        after: { reference: spec.reference, status: spec.status },
        reason: spec.decisionReason,
      });
      if (spec.status === "paid") {
        auditRows.push({
          action: "claim.settled",
          entityType: "claims",
          entityId: String(claimIds.get(spec.key)),
          at: now - (spec.paidDaysAgo ?? 1) * DAY,
          after: { reference: spec.reference, settlementRef: spec.settlementRef },
        });
      }
    }
    for (const item of assignmentPlan) {
      auditRows.push({
        action: "broker.customer_assigned",
        entityType: "brokerAssignments",
        entityId: demoKey(`assignment:${item.broker}:${item.customer}`),
        at: now - 61 * DAY,
        after: { broker: item.broker, customer: item.customer },
      });
    }

    for (const [index, row] of auditRows.entries()) {
      const key = demoKey(`audit:${row.action}:${index}`);
      if (snapshot.auditLogs.some((entry) => entry.demoKey === key)) {
        bump(skipped, "auditLogs");
        continue;
      }
      await ctx.db.insert("auditLogs", {
        actorId: userIds.get("admin")!,
        actorRole: "admin",
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        after: row.after,
        reason: row.reason,
        at: row.at,
        ...marker(`audit:${row.action}:${index}`, now),
      });
      bump(created, "auditLogs");
    }

    /* 14. Verify what this batch now owns. */
    const after = await loadSnapshot(ctx);
    const verification: Record<string, number> = {
      users: after.users.filter(isDemoRow).length,
      customerProfiles: after.customerProfiles.filter(isDemoRow).length,
      brokerProfiles: after.brokerProfiles.filter(isDemoRow).length,
      brokerAssignments: after.brokerAssignments.filter(isDemoRow).length,
      products: after.products.filter(isDemoRow).length,
      applications: after.applications.filter(isDemoRow).length,
      applicationEvents: after.applicationEvents.filter(isDemoRow).length,
      policies: after.policies.filter(isDemoRow).length,
      claims: after.claims.filter(isDemoRow).length,
      claimEvents: after.claimEvents.filter(isDemoRow).length,
      transactions: after.transactions.filter(isDemoRow).length,
      documents: after.documents.filter(isDemoRow).length,
      notifications: after.notifications.filter(isDemoRow).length,
      auditLogs: after.auditLogs.filter(isDemoRow).length,
    };

    const integrity = {
      approvedApplicationsWithPolicy: after.applications.filter(
        (app) => isDemoRow(app) && app.status === "approved" && app.policyId,
      ).length,
      demoPolicies: after.policies.filter(isDemoRow).length,
      declinedApplicationsWithPolicy: after.applications.filter(
        (app) => isDemoRow(app) && app.status === "declined" && app.policyId,
      ).length,
      duplicatePolicyNumbers:
        after.policies.filter(isDemoRow).length -
        new Set(after.policies.filter(isDemoRow).map((row) => row.policyNumber)).size,
      duplicateTransactionKeys:
        after.transactions.filter(isDemoRow).length -
        new Set(after.transactions.filter(isDemoRow).map((row) => row.idempotencyKey)).size,
      demoNotificationsQueuedForEmail: after.notifications.filter(
        (row) => isDemoRow(row) && row.emailStatus === "queued",
      ).length,
      policiesWithPremiumReceipt: after.policies.filter(
        (policy) =>
          isDemoRow(policy) &&
          after.transactions.some(
            (tx) => isDemoRow(tx) && tx.policyId === policy._id && tx.type === "premium" && tx.status === "succeeded",
          ),
      ).length,
    };

    return {
      batch: DEMO_SEED_BATCH,
      mode: allowDataOnly ? "sandbox-data-only" : "existing-auth-users-only",
      created,
      skipped,
      verification,
      integrity,
      planHash: plan.planHash,
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                    */
/* -------------------------------------------------------------------------- */

function cleanupBlockers(snapshot: Snapshot) {
  const blockers: string[] = [];
  const demoUsers = snapshot.users.filter(isDemoRow);

  for (const user of demoUsers) {
    const accounts = snapshot.authAccounts.filter((account) => account.userId === user._id);
    if (accounts.length > 0) {
      blockers.push(
        `${user.email ?? user._id}: has a Convex Auth account, so it cannot be deleted by the demo cleanup. Remove demo data manually or leave the account in place.`,
      );
    }
  }

  const touches = (rows: { seedBatch?: string }[]) => rows.some((row) => !isDemoRow(row));
  for (const user of demoUsers) {
    if (
      touches(snapshot.applications.filter((row) => row.customerUserId === user._id && !isDemoRow(row))) ||
      touches(snapshot.policies.filter((row) => row.customerUserId === user._id && !isDemoRow(row))) ||
      touches(snapshot.claims.filter((row) => row.customerUserId === user._id && !isDemoRow(row))) ||
      touches(snapshot.transactions.filter((row) => row.customerUserId === user._id && !isDemoRow(row))) ||
      touches(snapshot.documents.filter((row) => row.ownerUserId === user._id && !isDemoRow(row))) ||
      touches(snapshot.customerProfiles.filter((row) => row.userId === user._id && !isDemoRow(row))) ||
      touches(snapshot.brokerProfiles.filter((row) => row.userId === user._id && !isDemoRow(row)))
    ) {
      blockers.push(
        `${user.email ?? user._id}: is linked to records outside this seed batch. Cleanup will not delete this demo account.`,
      );
    }
  }

  for (const policy of snapshot.policies.filter(isDemoRow)) {
    const foreign = [
      ...snapshot.claims.filter((row) => row.policyId === policy._id && !isDemoRow(row)),
      ...snapshot.transactions.filter((row) => row.policyId === policy._id && !isDemoRow(row)),
      ...snapshot.documents.filter((row) => row.policyId === policy._id && !isDemoRow(row)),
    ];
    if (foreign.length > 0) {
      blockers.push(`${policy.policyNumber}: has records outside this seed batch (claims, payments or documents).`);
    }
  }

  for (const product of snapshot.products.filter(isDemoRow)) {
    const foreign = [
      ...snapshot.applications.filter((row) => row.productId === product._id && !isDemoRow(row)),
      ...snapshot.policies.filter((row) => row.productId === product._id && !isDemoRow(row)),
    ];
    if (foreign.length > 0) {
      blockers.push(`${product.code}: is used by applications or policies outside this seed batch.`);
    }
  }

  return blockers;
}

export const cleanupPreview = internalQuery({
  args: {},
  handler: async (ctx) => {
    const snapshot = await loadSnapshot(ctx);
    const blockers = cleanupBlockers(snapshot);
    return {
      batch: DEMO_SEED_BATCH,
      planHash: hashPlan({
        batch: DEMO_SEED_BATCH,
        counts: {
          users: snapshot.users.filter(isDemoRow).length,
          customerProfiles: snapshot.customerProfiles.filter(isDemoRow).length,
          brokerProfiles: snapshot.brokerProfiles.filter(isDemoRow).length,
          brokerAssignments: snapshot.brokerAssignments.filter(isDemoRow).length,
          products: snapshot.products.filter(isDemoRow).length,
          applications: snapshot.applications.filter(isDemoRow).length,
          applicationEvents: snapshot.applicationEvents.filter(isDemoRow).length,
          policies: snapshot.policies.filter(isDemoRow).length,
          claims: snapshot.claims.filter(isDemoRow).length,
          claimEvents: snapshot.claimEvents.filter(isDemoRow).length,
          transactions: snapshot.transactions.filter(isDemoRow).length,
          documents: snapshot.documents.filter(isDemoRow).length,
          notifications: snapshot.notifications.filter(isDemoRow).length,
          auditLogs: snapshot.auditLogs.filter(isDemoRow).length,
        },
      }),
      counts: {
        users: snapshot.users.filter(isDemoRow).length,
        customerProfiles: snapshot.customerProfiles.filter(isDemoRow).length,
        brokerProfiles: snapshot.brokerProfiles.filter(isDemoRow).length,
        brokerAssignments: snapshot.brokerAssignments.filter(isDemoRow).length,
        products: snapshot.products.filter(isDemoRow).length,
        applications: snapshot.applications.filter(isDemoRow).length,
        applicationEvents: snapshot.applicationEvents.filter(isDemoRow).length,
        policies: snapshot.policies.filter(isDemoRow).length,
        claims: snapshot.claims.filter(isDemoRow).length,
        claimEvents: snapshot.claimEvents.filter(isDemoRow).length,
        transactions: snapshot.transactions.filter(isDemoRow).length,
        documents: snapshot.documents.filter(isDemoRow).length,
        notifications: snapshot.notifications.filter(isDemoRow).length,
        auditLogs: snapshot.auditLogs.filter(isDemoRow).length,
      },
      records: {
        products: snapshot.products.filter(isDemoRow).map((row) => row.code),
        applications: snapshot.applications.filter(isDemoRow).map((row) => row.reference),
        policies: snapshot.policies.filter(isDemoRow).map((row) => row.policyNumber),
        claims: snapshot.claims.filter(isDemoRow).map((row) => row.reference),
        accounts: snapshot.users.filter(isDemoRow).map((row) => row.email),
      },
      blockers,
      safeToDelete: blockers.length === 0,
      recommendedAction:
        blockers.length > 0
          ? "Do not delete. Use deactivate, or clean the listed records manually after review."
          : "Deletion only removes records in this seed batch. Prefer deactivate in any environment with audit requirements.",
    };
  },
});

export const cleanup = internalMutation({
  args: { confirm: v.string(), planHash: v.string() },
  handler: async (ctx, args) => {
    assertEnabled();
    if (args.confirm !== CONFIRM_DELETE) {
      throw new Error(`Confirmation phrase must be exactly "${CONFIRM_DELETE}".`);
    }
    const snapshot = await loadSnapshot(ctx);
    const blockers = cleanupBlockers(snapshot);
    const previewHash = hashPlan({
      batch: DEMO_SEED_BATCH,
      counts: {
        users: snapshot.users.filter(isDemoRow).length,
        customerProfiles: snapshot.customerProfiles.filter(isDemoRow).length,
        brokerProfiles: snapshot.brokerProfiles.filter(isDemoRow).length,
        brokerAssignments: snapshot.brokerAssignments.filter(isDemoRow).length,
        products: snapshot.products.filter(isDemoRow).length,
        applications: snapshot.applications.filter(isDemoRow).length,
        applicationEvents: snapshot.applicationEvents.filter(isDemoRow).length,
        policies: snapshot.policies.filter(isDemoRow).length,
        claims: snapshot.claims.filter(isDemoRow).length,
        claimEvents: snapshot.claimEvents.filter(isDemoRow).length,
        transactions: snapshot.transactions.filter(isDemoRow).length,
        documents: snapshot.documents.filter(isDemoRow).length,
        notifications: snapshot.notifications.filter(isDemoRow).length,
        auditLogs: snapshot.auditLogs.filter(isDemoRow).length,
      },
    });
    if (previewHash !== args.planHash) {
      throw new Error(`The cleanup preview is stale (previewed ${args.planHash}, current ${previewHash}). Re-run demoSeed:cleanupPreview.`);
    }
    if (blockers.length > 0) {
      throw new Error(`Cleanup blocked:\n- ${blockers.join("\n- ")}`);
    }

    const deleted: Record<string, number> = {};
    const remove = async (rows: { _id: unknown }[], table: string) => {
      for (const row of rows) {
        await ctx.db.delete(row._id as Id<"users">);
        deleted[table] = (deleted[table] ?? 0) + 1;
      }
    };

    // Dependants first, then parents. Every selection is batch-scoped.
    await remove(snapshot.claimEvents.filter(isDemoRow), "claimEvents");
    await remove(snapshot.claims.filter(isDemoRow), "claims");
    await remove(snapshot.applicationEvents.filter(isDemoRow), "applicationEvents");
    await remove(snapshot.transactions.filter(isDemoRow), "transactions");
    await remove(snapshot.documents.filter(isDemoRow), "documents");
    await remove(snapshot.policies.filter(isDemoRow), "policies");
    await remove(snapshot.applications.filter(isDemoRow), "applications");
    await remove(snapshot.notifications.filter(isDemoRow), "notifications");
    await remove(snapshot.auditLogs.filter(isDemoRow), "auditLogs");
    await remove(snapshot.brokerAssignments.filter(isDemoRow), "brokerAssignments");
    await remove(snapshot.brokerProfiles.filter(isDemoRow), "brokerProfiles");
    await remove(snapshot.customerProfiles.filter(isDemoRow), "customerProfiles");
    await remove(snapshot.products.filter(isDemoRow), "products");
    await remove(snapshot.users.filter(isDemoRow), "users");

    return { batch: DEMO_SEED_BATCH, deleted };
  },
});

/**
 * Read-only post-seed verification. Reports the same aggregates the dashboards
 * derive, plus relationship checks that a seed must never violate.
 */
export const verify = internalQuery({
  args: {},
  handler: async (ctx) => {
    const snapshot = await loadSnapshot(ctx);
    const demo = {
      users: snapshot.users.filter(isDemoRow),
      customerProfiles: snapshot.customerProfiles.filter(isDemoRow),
      brokerProfiles: snapshot.brokerProfiles.filter(isDemoRow),
      brokerAssignments: snapshot.brokerAssignments.filter(isDemoRow),
      products: snapshot.products.filter(isDemoRow),
      applications: snapshot.applications.filter(isDemoRow),
      policies: snapshot.policies.filter(isDemoRow),
      claims: snapshot.claims.filter(isDemoRow),
      transactions: snapshot.transactions.filter(isDemoRow),
      documents: snapshot.documents.filter(isDemoRow),
      notifications: snapshot.notifications.filter(isDemoRow),
      auditLogs: snapshot.auditLogs.filter(isDemoRow),
    };
    const counts = (rows: { seedBatch?: string }[]) => rows.filter(isDemoRow).length;
    const distribution = (rows: { status?: string }[]) => {
      const map: Record<string, number> = {};
      for (const row of rows) {
        if (!row.status) continue;
        map[row.status] = (map[row.status] ?? 0) + 1;
      }
      return map;
    };

    const policyIds = new Set(demo.policies.map((row) => row._id));
    const appIds = new Set(demo.applications.map((row) => row._id));
    const claimIds = new Set(demo.claims.map((row) => row._id));

    const moneyByCurrency = new Map<string, { succeeded: number; pending: number; failed: number; settled: number }>();
    for (const tx of demo.transactions) {
      const bucket = moneyByCurrency.get(tx.currency) ?? { succeeded: 0, pending: 0, failed: 0, settled: 0 };
      if (tx.type === "settlement" && tx.status === "succeeded") bucket.settled += tx.amount;
      else if (tx.type === "premium" && tx.status === "succeeded") bucket.succeeded += tx.amount;
      else if (tx.type === "premium" && tx.status === "pending") bucket.pending += tx.amount;
      else if (tx.type === "premium" && tx.status === "failed") bucket.failed += tx.amount;
      moneyByCurrency.set(tx.currency, bucket);
    }

    const brokerWorkload = demo.brokerProfiles.map((profile) => {
      const assignments = demo.brokerAssignments.filter(
        (row) => row.brokerUserId === profile.userId && row.status === "active",
      );
      const apps = demo.applications.filter((row) => row.brokerUserId === profile.userId);
      const policies = demo.policies.filter((row) => row.brokerUserId === profile.userId);
      return {
        orgName: profile.orgName,
        assignedCustomers: assignments.length,
        applications: apps.length,
        openApplications: apps.filter((row) => row.status !== "approved" && row.status !== "declined").length,
        activePolicies: policies.filter((row) => row.status === "active").length,
        commissionEstimate: policies
          .filter((row) => row.status === "active")
          .reduce((total, row) => total + Math.round(row.premium * (profile.commissionRate / 100)), 0),
      };
    });

    const customerSummaries = demo.customerProfiles.map((profile) => ({
      name: profile.fullName,
      applications: demo.applications.filter((row) => row.customerUserId === profile.userId).length,
      activePolicies: demo.policies.filter(
        (row) => row.customerUserId === profile.userId && row.status === "active",
      ).length,
      openClaims: demo.claims.filter(
        (row) =>
          row.customerUserId === profile.userId &&
          ["submitted", "under_review", "additional_info_required", "under_assessment"].includes(row.status),
      ).length,
      outstanding: demo.transactions
        .filter((row) => row.customerUserId === profile.userId && row.type === "premium" && row.status === "pending")
        .reduce((total, row) => total + row.amount, 0),
    }));

    const checks: { name: string; ok: boolean; detail: string }[] = [];
    const approvedWithoutPolicy = demo.applications.filter((row) => row.status === "approved" && !row.policyId);
    checks.push({
      name: "approved applications carry a policy",
      ok: approvedWithoutPolicy.length === 0,
      detail: `${approvedWithoutPolicy.length} missing`,
    });
    const declinedWithPolicy = demo.applications.filter((row) => row.status === "declined" && row.policyId);
    checks.push({
      name: "declined applications never issue a policy",
      ok: declinedWithPolicy.length === 0,
      detail: `${declinedWithPolicy.length} violations`,
    });
    const policyFromUnapproved = demo.policies.filter((policy) => {
      const application = demo.applications.find((row) => row._id === policy.applicationId);
      return !application || application.status !== "approved";
    });
    checks.push({
      name: "every policy originates from an approved application",
      ok: policyFromUnapproved.length === 0,
      detail: `${policyFromUnapproved.length} violations`,
    });
    const claimsOutsideTerm = demo.claims.filter((claim) => {
      const policy = demo.policies.find((row) => row._id === claim.policyId);
      return !policy || claim.incidentDate < policy.startDate || claim.incidentDate > policy.endDate;
    });
    checks.push({
      name: "claims fall inside their policy term",
      ok: claimsOutsideTerm.length === 0,
      detail: `${claimsOutsideTerm.length} outside term`,
    });
    const claimsOverLimit = demo.claims.filter((claim) => {
      const policy = demo.policies.find((row) => row._id === claim.policyId);
      return !policy || claim.amountClaimed > policy.coverageLimit;
    });
    checks.push({
      name: "claimed amounts stay within the coverage limit",
      ok: claimsOverLimit.length === 0,
      detail: `${claimsOverLimit.length} over limit`,
    });
    const decidedWithoutMetadata = demo.claims.filter(
      (claim) => claim.decision && (!claim.decidedBy || !claim.decidedAt),
    );
    checks.push({
      name: "decided claims record who decided and when",
      ok: decidedWithoutMetadata.length === 0,
      detail: `${decidedWithoutMetadata.length} incomplete`,
    });
    const foreignReferences = demo.documents.filter(
      (doc) =>
        (doc.policyId && !policyIds.has(doc.policyId)) ||
        (doc.claimId && !claimIds.has(doc.claimId)) ||
        (doc.applicationId && !appIds.has(doc.applicationId)),
    );
    checks.push({
      name: "seeded documents reference seeded records",
      ok: foreignReferences.length === 0,
      detail: `${foreignReferences.length} dangling`,
    });
    const queuedEmail = demo.notifications.filter((row) => row.emailStatus !== "skipped");
    checks.push({
      name: "seeded notifications never queue email",
      ok: queuedEmail.length === 0,
      detail: `${queuedEmail.length} non-skipped`,
    });
    const demoUserIds = new Set(demo.users.map((row) => row._id));
    const authAccounts = snapshot.authAccounts.filter((row) => demoUserIds.has(row.userId));
    checks.push({
      name: "no auth account was invented for demo identities",
      ok: authAccounts.length === 0,
      detail: `${authAccounts.length} auth accounts`,
    });
    const premiumMismatch = demo.policies.filter((policy) => {
      const receipts = demo.transactions.filter(
        (tx) => tx.policyId === policy._id && tx.type === "premium" && tx.status === "succeeded",
      );
      return receipts.length !== 1 || receipts[0].amount !== policy.premium;
    });
    checks.push({
      name: "each demo policy reconciles to exactly one premium receipt",
      ok: premiumMismatch.length === 0,
      detail: `${premiumMismatch.length} mismatches`,
    });

    return {
      batch: DEMO_SEED_BATCH,
      demoCounts: {
        users: counts(snapshot.users),
        customerProfiles: counts(snapshot.customerProfiles),
        brokerProfiles: counts(snapshot.brokerProfiles),
        brokerAssignments: counts(snapshot.brokerAssignments),
        products: counts(snapshot.products),
        applications: counts(snapshot.applications),
        applicationEvents: counts(snapshot.applicationEvents),
        policies: counts(snapshot.policies),
        claims: counts(snapshot.claims),
        claimEvents: counts(snapshot.claimEvents),
        transactions: counts(snapshot.transactions),
        documents: counts(snapshot.documents),
        notifications: counts(snapshot.notifications),
        auditLogs: counts(snapshot.auditLogs),
      },
      nonDemoCounts: {
        users: snapshot.users.length - counts(snapshot.users),
        customerProfiles: snapshot.customerProfiles.length - counts(snapshot.customerProfiles),
        brokerProfiles: snapshot.brokerProfiles.length - counts(snapshot.brokerProfiles),
        products: snapshot.products.length - counts(snapshot.products),
        applications: snapshot.applications.length - counts(snapshot.applications),
        policies: snapshot.policies.length - counts(snapshot.policies),
        claims: snapshot.claims.length - counts(snapshot.claims),
        transactions: snapshot.transactions.length - counts(snapshot.transactions),
        documents: snapshot.documents.length - counts(snapshot.documents),
        notifications: snapshot.notifications.length - counts(snapshot.notifications),
        auditLogs: snapshot.auditLogs.length - counts(snapshot.auditLogs),
      },
      statuses: {
        applications: distribution(demo.applications),
        policies: distribution(demo.policies),
        claims: distribution(demo.claims),
        transactions: distribution(demo.transactions),
      },
      moneyByCurrency: [...moneyByCurrency.entries()].map(([currency, value]) => ({ currency, ...value })),
      brokerWorkload,
      customerSummaries,
      checks,
      allChecksPassed: checks.every((check) => check.ok),
    };
  },
});

/** Non-destructive option for production: keeps the audit trail, closes access. */
export const deactivate = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, args) => {
    assertEnabled();
    if (args.confirm !== CONFIRM_DEACTIVATE) {
      throw new Error(`Confirmation phrase must be exactly "${CONFIRM_DEACTIVATE}".`);
    }
    const snapshot = await loadSnapshot(ctx);
    let users = 0;
    let products = 0;
    for (const user of snapshot.users.filter(isDemoRow)) {
      if (user.status !== "suspended") {
        await ctx.db.patch(user._id, { status: "suspended", suspendedReason: "Demonstration dataset deactivated." });
        users += 1;
      }
    }
    for (const product of snapshot.products.filter(isDemoRow)) {
      if (product.status !== "archived") {
        await ctx.db.patch(product._id, { status: "archived", updatedAt: Date.now() });
        products += 1;
      }
    }
    return { batch: DEMO_SEED_BATCH, suspendedUsers: users, archivedProducts: products };
  },
});
