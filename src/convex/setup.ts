import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  ALL_PERMISSIONS,
  normalizeRole,
  requirePermission,
  requireViewer,
} from "./lib/authz";
import { writeAudit } from "./lib/audit";
import { ensureSettings } from "./lib/settings";
import { ensureCustomerProfile } from "./lib/people";

const COUNTRIES = [
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "Europe", dialCode: "+44" },
  { code: "IE", name: "Ireland", currency: "EUR", region: "Europe", dialCode: "+353" },
  { code: "DE", name: "Germany", currency: "EUR", region: "Europe", dialCode: "+49" },
  { code: "FR", name: "France", currency: "EUR", region: "Europe", dialCode: "+33" },
  { code: "NL", name: "Netherlands", currency: "EUR", region: "Europe", dialCode: "+31" },
  { code: "ES", name: "Spain", currency: "EUR", region: "Europe", dialCode: "+34" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "Middle East", dialCode: "+971" },
  { code: "SG", name: "Singapore", currency: "SGD", region: "Asia Pacific", dialCode: "+65" },
  { code: "US", name: "United States", currency: "USD", region: "Americas", dialCode: "+1" },
  { code: "CA", name: "Canada", currency: "CAD", region: "Americas", dialCode: "+1" },
  { code: "AU", name: "Australia", currency: "AUD", region: "Asia Pacific", dialCode: "+61" },
];

const CURRENCIES = [
  { code: "GBP", name: "Pound sterling", symbol: "£", minorUnits: 2 },
  { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2 },
  { code: "USD", name: "US dollar", symbol: "$", minorUnits: 2 },
  { code: "AED", name: "UAE dirham", symbol: "د.إ", minorUnits: 2 },
  { code: "SGD", name: "Singapore dollar", symbol: "S$", minorUnits: 2 },
  { code: "CAD", name: "Canadian dollar", symbol: "C$", minorUnits: 2 },
  { code: "AUD", name: "Australian dollar", symbol: "A$", minorUnits: 2 },
];

const CATEGORIES = [
  { key: "motor", name: "Motor", description: "Private car and light vehicle cover.", sortOrder: 1 },
  { key: "health", name: "Health", description: "Private medical, dental, and wellbeing cover.", sortOrder: 2 },
  { key: "life", name: "Life", description: "Term life protection for the people who rely on you.", sortOrder: 3 },
  { key: "home", name: "Home & property", description: "Buildings and contents protection.", sortOrder: 4 },
  { key: "travel", name: "Travel", description: "Single-trip and annual travel cover.", sortOrder: 5 },
  { key: "business", name: "Business", description: "Commercial liability and business interruption.", sortOrder: 6 },
];

type SeedProduct = {
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
  ratingFactors: {
    key: string;
    label: string;
    help?: string;
    options: { value: string; label: string; multiplier: number }[];
  }[];
  questions: {
    key: string;
    label: string;
    type: "text" | "number" | "date" | "select" | "textarea";
    required: boolean;
    options?: string[];
  }[];
  requiredDocuments: { key: string; label: string; required: boolean }[];
};

const SEED_PRODUCTS: SeedProduct[] = [
  {
    code: "MOT-COMP-01",
    name: "Vault Comprehensive Motor",
    categoryKey: "motor",
    description:
      "Comprehensive private car cover with courtesy vehicle, windscreen protection, and a named claims handler.",
    targetCustomer: "Private car owners and families insuring up to three vehicles.",
    countries: ["GB", "IE", "DE", "FR", "NL", "ES", "AE", "SG", "AU"],
    currency: "GBP",
    basePremium: 48000,
    excess: 25000,
    coverageLimit: 2000000,
    benefits: [
      "Courtesy vehicle while yours is repaired",
      "Windscreen and glass cover",
      "Named claims handler",
      "European Union cover up to 90 days",
    ],
    exclusions: [
      "Racing, track days, and competitive events",
      "Commercial delivery use unless endorsed",
      "Wear, tear, and mechanical breakdown",
    ],
    ratingFactors: [
      {
        key: "annual_mileage",
        label: "Annual mileage",
        options: [
          { value: "under_5k", label: "Under 5,000", multiplier: 0.9 },
          { value: "5k_10k", label: "5,000 – 10,000", multiplier: 1 },
          { value: "10k_20k", label: "10,000 – 20,000", multiplier: 1.18 },
          { value: "over_20k", label: "Over 20,000", multiplier: 1.35 },
        ],
      },
      {
        key: "claims_history",
        label: "Claims in the last 3 years",
        options: [
          { value: "none", label: "None", multiplier: 0.92 },
          { value: "one", label: "One", multiplier: 1.15 },
          { value: "two_plus", label: "Two or more", multiplier: 1.45 },
        ],
      },
      {
        key: "vehicle_value",
        label: "Vehicle value band",
        options: [
          { value: "under_15k", label: "Under £15,000", multiplier: 0.85 },
          { value: "15k_35k", label: "£15,000 – £35,000", multiplier: 1 },
          { value: "35k_75k", label: "£35,000 – £75,000", multiplier: 1.3 },
          { value: "over_75k", label: "Over £75,000", multiplier: 1.7 },
        ],
      },
    ],
    questions: [
      { key: "vehicle_make_model", label: "Vehicle make and model", type: "text", required: true },
      { key: "registration", label: "Registration / plate", type: "text", required: true },
      { key: "vehicle_year", label: "Year of manufacture", type: "number", required: true },
      { key: "annual_mileage", label: "Annual mileage", type: "select", required: true, options: ["under_5k", "5k_10k", "10k_20k", "over_20k"] },
      { key: "claims_history", label: "Claims in the last three years", type: "select", required: true, options: ["none", "one", "two_plus"] },
      { key: "vehicle_value", label: "Vehicle value band", type: "select", required: true, options: ["under_15k", "15k_35k", "35k_75k", "over_75k"] },
      { key: "garaging_postcode", label: "Overnight parking postcode", type: "text", required: true },
    ],
    requiredDocuments: [
      { key: "driving_licence", label: "Driving licence", required: true },
      { key: "vehicle_registration", label: "Vehicle registration document", required: true },
    ],
  },
  {
    code: "HLT-PRIV-01",
    name: "Vault Private Health",
    categoryKey: "health",
    description:
      "Private medical cover with consultant access, mental-health support, and dental options.",
    targetCustomer: "Individuals and families looking for private healthcare outside the public system.",
    countries: ["GB", "IE", "DE", "NL", "ES", "AE", "SG"],
    currency: "GBP",
    basePremium: 72000,
    excess: 15000,
    coverageLimit: 1000000,
    benefits: [
      "Private consultant and diagnostic cover",
      "Mental-health support with no referral needed",
      "Dental and optical option",
      "Second-opinion service",
    ],
    exclusions: [
      "Pre-existing conditions unless declared and accepted",
      "Cosmetic treatment",
      "Travel outside the listed territories",
    ],
    ratingFactors: [
      {
        key: "age_band",
        label: "Age band",
        options: [
          { value: "18_29", label: "18 – 29", multiplier: 0.75 },
          { value: "30_44", label: "30 – 44", multiplier: 1 },
          { value: "45_59", label: "45 – 59", multiplier: 1.45 },
          { value: "60_plus", label: "60+", multiplier: 2.1 },
        ],
      },
      {
        key: "cover_level",
        label: "Cover level",
        options: [
          { value: "essential", label: "Essential", multiplier: 0.8 },
          { value: "signature", label: "Signature", multiplier: 1 },
          { value: "horizon", label: "Horizon (full)", multiplier: 1.4 },
        ],
      },
      {
        key: "family",
        label: "Cover type",
        options: [
          { value: "individual", label: "Individual", multiplier: 1 },
          { value: "couple", label: "Couple", multiplier: 1.8 },
          { value: "family", label: "Family", multiplier: 2.4 },
        ],
      },
    ],
    questions: [
      { key: "age_band", label: "Age band", type: "select", required: true, options: ["18_29", "30_44", "45_59", "60_plus"] },
      { key: "cover_level", label: "Cover level", type: "select", required: true, options: ["essential", "signature", "horizon"] },
      { key: "family", label: "Who is covered", type: "select", required: true, options: ["individual", "couple", "family"] },
      { key: "pre_existing", label: "Any pre-existing medical conditions?", type: "textarea", required: true },
    ],
    requiredDocuments: [
      { key: "id_document", label: "Photo identification", required: true },
      { key: "medical_history", label: "Medical history summary", required: false },
    ],
  },
  {
    code: "LIF-TERM-01",
    name: "Vault Term Life",
    categoryKey: "life",
    description:
      "Level term life cover with optional critical illness, written in plain language.",
    targetCustomer: "Adults protecting a mortgage, dependants, or a family business.",
    countries: ["GB", "IE", "DE", "FR", "NL", "ES", "AE", "SG", "CA", "AU"],
    currency: "GBP",
    basePremium: 36000,
    excess: 0,
    coverageLimit: 50000000,
    benefits: [
      "Level sum assured for the full term",
      "Optional critical illness acceleration",
      "Free trust wording guidance",
      "Bereavement support line",
    ],
    exclusions: [
      "Non-disclosure of material facts",
      "Death within the initial 24-month exclusion period for non-accidental causes",
      "War and illegal activity exclusions",
    ],
    ratingFactors: [
      {
        key: "age_band",
        label: "Age band",
        options: [
          { value: "18_34", label: "18 – 34", multiplier: 0.8 },
          { value: "35_49", label: "35 – 49", multiplier: 1 },
          { value: "50_64", label: "50 – 64", multiplier: 1.9 },
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
      {
        key: "term",
        label: "Term length",
        options: [
          { value: "10", label: "10 years", multiplier: 0.8 },
          { value: "20", label: "20 years", multiplier: 1 },
          { value: "30", label: "30 years", multiplier: 1.25 },
        ],
      },
    ],
    questions: [
      { key: "age_band", label: "Age band", type: "select", required: true, options: ["18_34", "35_49", "50_64"] },
      { key: "smoker", label: "Smoking status", type: "select", required: true, options: ["non_smoker", "smoker"] },
      { key: "term", label: "Term length (years)", type: "select", required: true, options: ["10", "20", "30"] },
      { key: "sum_assured", label: "Sum assured required", type: "number", required: true },
      { key: "beneficiaries", label: "Who should receive the benefit?", type: "textarea", required: true },
    ],
    requiredDocuments: [{ key: "id_document", label: "Photo identification", required: true }],
  },
  {
    code: "HOM-BLD-01",
    name: "Vault Home & Contents",
    categoryKey: "home",
    description:
      "Buildings and contents cover with new-for-old replacement and home emergency response.",
    targetCustomer: "Homeowners and long-term renters.",
    countries: ["GB", "IE", "DE", "FR", "NL", "ES", "AE", "SG", "CA", "AU"],
    currency: "GBP",
    basePremium: 28000,
    excess: 20000,
    coverageLimit: 750000,
    benefits: [
      "New-for-old contents replacement",
      "Home emergency call-out",
      "Alternative accommodation",
      "Accidental damage option",
    ],
    exclusions: [
      "Unoccupied property beyond 60 days",
      "Gradual deterioration and damp",
      "Business stock kept at home",
    ],
    ratingFactors: [
      {
        key: "property_type",
        label: "Property type",
        options: [
          { value: "flat", label: "Flat / apartment", multiplier: 0.9 },
          { value: "terrace", label: "Terraced house", multiplier: 1 },
          { value: "semi", label: "Semi-detached", multiplier: 1.12 },
          { value: "detached", label: "Detached", multiplier: 1.35 },
        ],
      },
      {
        key: "contents_level",
        label: "Contents cover",
        options: [
          { value: "50k", label: "Up to £50,000", multiplier: 0.85 },
          { value: "100k", label: "Up to £100,000", multiplier: 1 },
          { value: "200k", label: "Up to £200,000", multiplier: 1.4 },
        ],
      },
      {
        key: "flood_risk",
        label: "Flood risk",
        options: [
          { value: "low", label: "Low", multiplier: 1 },
          { value: "medium", label: "Medium", multiplier: 1.22 },
          { value: "high", label: "High", multiplier: 1.55 },
        ],
      },
    ],
    questions: [
      { key: "property_address", label: "Insured property address", type: "textarea", required: true },
      { key: "property_type", label: "Property type", type: "select", required: true, options: ["flat", "terrace", "semi", "detached"] },
      { key: "contents_level", label: "Contents cover", type: "select", required: true, options: ["50k", "100k", "200k"] },
      { key: "flood_risk", label: "Flood risk", type: "select", required: true, options: ["low", "medium", "high"] },
      { key: "rebuild_value", label: "Estimated rebuild value", type: "number", required: true },
    ],
    requiredDocuments: [{ key: "proof_of_address", label: "Proof of address", required: true }],
  },
  {
    code: "TRV-ANN-01",
    name: "Vault Worldwide Travel",
    categoryKey: "travel",
    description:
      "Annual multi-trip travel cover with medical expenses, cancellation, and gadget protection.",
    targetCustomer: "Frequent travellers and families taking multiple trips a year.",
    countries: ["GB", "IE", "DE", "FR", "NL", "ES", "AE", "SG", "US", "CA", "AU"],
    currency: "GBP",
    basePremium: 12000,
    excess: 7500,
    coverageLimit: 500000,
    benefits: [
      "Emergency medical treatment and repatriation",
      "Trip cancellation and curtailment",
      "Gadget and baggage cover",
      "24/7 emergency assistance line",
    ],
    exclusions: [
      "Travel against medical advice",
      "Extreme sports unless the winter-sports option is added",
      "Known events such as strikes announced before booking",
    ],
    ratingFactors: [
      {
        key: "travellers",
        label: "Travellers",
        options: [
          { value: "single", label: "One adult", multiplier: 1 },
          { value: "couple", label: "Two adults", multiplier: 1.7 },
          { value: "family", label: "Family", multiplier: 2.2 },
        ],
      },
      {
        key: "region",
        label: "Destinations",
        options: [
          { value: "europe", label: "Europe", multiplier: 0.85 },
          { value: "worldwide", label: "Worldwide excl. USA", multiplier: 1 },
          { value: "worldwide_usa", label: "Worldwide incl. USA", multiplier: 1.45 },
        ],
      },
      {
        key: "age_band",
        label: "Oldest traveller age",
        options: [
          { value: "under_40", label: "Under 40", multiplier: 1 },
          { value: "40_64", label: "40 – 64", multiplier: 1.25 },
          { value: "65_plus", label: "65+", multiplier: 1.9 },
        ],
      },
    ],
    questions: [
      { key: "travellers", label: "Travellers", type: "select", required: true, options: ["single", "couple", "family"] },
      { key: "region", label: "Destinations", type: "select", required: true, options: ["europe", "worldwide", "worldwide_usa"] },
      { key: "age_band", label: "Oldest traveller age", type: "select", required: true, options: ["under_40", "40_64", "65_plus"] },
      { key: "trip_start", label: "First departure date", type: "date", required: true },
      { key: "conditions", label: "Declared medical conditions", type: "textarea", required: false },
    ],
    requiredDocuments: [{ key: "id_document", label: "Photo identification", required: true }],
  },
  {
    code: "BUS-LIAB-01",
    name: "Vault Business Liability",
    categoryKey: "business",
    description:
      "Public and employers' liability for small businesses, with optional business interruption.",
    targetCustomer: "Owner-managed businesses with up to 50 employees.",
    countries: ["GB", "IE", "DE", "NL", "ES", "AE", "SG"],
    currency: "GBP",
    basePremium: 96000,
    excess: 50000,
    coverageLimit: 5000000,
    benefits: [
      "Public and employers' liability",
      "Business interruption option",
      "Legal expenses helpline",
      "Named account handler",
    ],
    exclusions: [
      "Work at height above 10 metres",
      "Hazardous substances unless declared",
      "Unlicensed subcontractors",
    ],
    ratingFactors: [
      {
        key: "employees",
        label: "Employees",
        options: [
          { value: "1_5", label: "1 – 5", multiplier: 0.8 },
          { value: "6_20", label: "6 – 20", multiplier: 1 },
          { value: "21_50", label: "21 – 50", multiplier: 1.6 },
        ],
      },
      {
        key: "sector",
        label: "Sector",
        options: [
          { value: "professional", label: "Professional services", multiplier: 0.9 },
          { value: "retail", label: "Retail", multiplier: 1 },
          { value: "construction", label: "Construction", multiplier: 1.75 },
          { value: "hospitality", label: "Hospitality", multiplier: 1.35 },
        ],
      },
      {
        key: "turnover",
        label: "Annual turnover",
        options: [
          { value: "under_250k", label: "Under £250,000", multiplier: 0.85 },
          { value: "250k_1m", label: "£250,000 – £1m", multiplier: 1 },
          { value: "over_1m", label: "Over £1m", multiplier: 1.4 },
        ],
      },
    ],
    questions: [
      { key: "business_name", label: "Registered business name", type: "text", required: true },
      { key: "registration_number", label: "Company registration number", type: "text", required: true },
      { key: "sector", label: "Sector", type: "select", required: true, options: ["professional", "retail", "construction", "hospitality"] },
      { key: "employees", label: "Employees", type: "select", required: true, options: ["1_5", "6_20", "21_50"] },
      { key: "turnover", label: "Annual turnover", type: "select", required: true, options: ["under_250k", "250k_1m", "over_1m"] },
    ],
    requiredDocuments: [
      { key: "company_registration", label: "Company registration certificate", required: true },
      { key: "health_safety", label: "Health and safety policy", required: false },
    ],
  },
];

export async function ensureReferenceData(ctx: MutationCtx) {
  for (const country of COUNTRIES) {
    const existing = await ctx.db
      .query("countries")
      .withIndex("by_code", (q) => q.eq("code", country.code))
      .unique();
    if (!existing) {
      await ctx.db.insert("countries", { ...country, active: true });
    }
  }
  for (const currency of CURRENCIES) {
    const existing = await ctx.db
      .query("currencies")
      .withIndex("by_code", (q) => q.eq("code", currency.code))
      .unique();
    if (!existing) {
      await ctx.db.insert("currencies", { ...currency, active: true });
    }
  }
  for (const category of CATEGORIES) {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_key", (q) => q.eq("key", category.key))
      .unique();
    if (!existing) {
      await ctx.db.insert("categories", { ...category, active: true });
    }
  }
  await ensureSettings(ctx);
}

async function seedCatalogue(ctx: MutationCtx, actorId?: Id<"users">) {
  const now = Date.now();
  let created = 0;
  for (const product of SEED_PRODUCTS) {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_code", (q) => q.eq("code", product.code))
      .first();
    if (existing) continue;
    await ctx.db.insert("products", {
      ...product,
      wordingVersion: "1.0",
      wording:
        "This policy is issued on the terms set out in the schedule and the product wording applicable on the effective date. Cover is subject to eligibility, exclusions, and the excess shown in the schedule. Claims are assessed by an authorised handler and payment is made only after a recorded decision and settlement.",
      disclosures:
        "Insurance is arranged by the company as a direct insurer. Product availability, policy wording, and payment methods are configured per market and reviewed before publication. This is not financial advice.",
      status: "published",
      version: 1,
      effectiveFrom: now,
      renewalNoticeDays: 30,
      cancellationNoticeDays: 14,
      termMonths: 12,
      createdBy: actorId,
      publishedBy: actorId,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }
  return created;
}

export const status = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    // Indexed lookup, not `users.take(200)`: once the table is larger than the
    // scan window a super admin outside it must still close the founding claim.
    const superAdmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .first();
    const hasSuperAdmin = superAdmin !== null;
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .take(1);
    const countries = await ctx.db.query("countries").take(1);
    return {
      hasSuperAdmin,
      catalogueReady: products.length > 0,
      referenceReady: countries.length > 0,
      role: normalizeRole(viewer.user.role),
      suspended: viewer.suspended,
    };
  },
});

/**
 * Liveness probe for the dashboard's health banner.
 *
 * It must not require a session: the banner asks the deployment over the Convex
 * HTTP API with no credentials, so an auth-gated query answers it with the same
 * masked "Server Error" that production returns for every failure - a healthy
 * deployment then looks exactly like one that runs nothing. Returning a
 * constant makes a value response mean "functions are running", which is the
 * only question the banner asks.
 */
export const health = query({
  args: {},
  handler: async () => ({ ok: true as const }),
});

/** Safe for any signed-in user: seeds fixed reference configuration only. */
export const ensureBasics = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    await ensureReferenceData(ctx);
    if (viewer.role === "customer") {
      await ensureCustomerProfile(ctx, viewer.user._id);
    }
    return { ok: true };
  },
});

/**
 * Reference configuration is seeded idempotently. If no super admin exists yet,
 * the first signed-in user claims the founding super-admin seat. Once a super
 * admin exists this can never promote anyone through this path.
 */
export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx, { allowSuspended: true });
    // A guest session is disposable: anyone who opens the site could otherwise
    // claim the founding admin seat before the operator signs in. Require a
    // real email identity, which also makes the action auditable.
    if (viewer.user.isAnonymous) {
      throw new Error(
        "Sign in with your email address to claim founding access.",
      );
    }
    await ensureReferenceData(ctx);

    // The founding claim must never depend on how many users exist: a partial
    // table scan would let a later visitor promote themselves once the real
    // super admin sits beyond the scan window.
    const existingSuper = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "super_admin"))
      .first();
    if (existingSuper) {
      return { promoted: false, hasSuperAdmin: true };
    }

    const now = Date.now();
    await ctx.db.patch(viewer.user._id, {
      role: "super_admin",
      permissions: ALL_PERMISSIONS,
      status: "active",
      lastRoleChangeAt: now,
    });
    await writeAudit(
      ctx,
      { ...viewer, role: "super_admin", permissions: ALL_PERMISSIONS },
      {
        action: "staff.bootstrap_super_admin",
        entityType: "users",
        entityId: viewer.user._id,
        after: { role: "super_admin" },
        reason: "Founding super admin claim (no super admin existed).",
      },
    );
    return { promoted: true, hasSuperAdmin: true };
  },
});

export const seedStarterCatalogue = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requirePermission(ctx, "products.manage");
    await ensureReferenceData(ctx);
    const created = await seedCatalogue(ctx, viewer.user._id);
    await writeAudit(ctx, viewer, {
      action: "products.seed_catalogue",
      entityType: "products",
      entityId: "starter-catalogue",
      after: { created },
    });
    return { created };
  },
});

/**
 * Operator seeding for a fresh deployment, run with `bunx convex run`.
 *
 * The admin UI can only seed the catalogue once someone has signed in and
 * holds `products.manage`, and a brand-new deployment has no accounts at all,
 * so day-one products have to come from an operator. Being internal, no
 * browser can reach it, and it is idempotent: rows that already exist are left
 * alone, so a second run is a no-op.
 */
export const seedDeployment = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensureReferenceData(ctx);
    const created = await seedCatalogue(ctx);
    const [products, countries, currencies, categories] = await Promise.all([
      ctx.db.query("products").take(300),
      ctx.db.query("countries").take(200),
      ctx.db.query("currencies").take(50),
      ctx.db.query("categories").take(50),
    ]);
    return {
      productsCreated: created,
      productsTotal: products.length,
      productsPublished: products.filter((item) => item.status === "published")
        .length,
      countries: countries.length,
      currencies: currencies.length,
      categories: categories.length,
    };
  },
});

export const referenceData = query({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx, { allowSuspended: true });
    const [countries, categories, currencies] = await Promise.all([
      ctx.db.query("countries").withIndex("by_active", (q) => q.eq("active", true)).take(100),
      ctx.db.query("categories").take(50),
      ctx.db.query("currencies").take(50),
    ]);
    return { countries, categories, currencies };
  },
});
