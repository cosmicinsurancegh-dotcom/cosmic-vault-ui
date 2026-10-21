import { MINERAL_PLANS, quotePlan } from "./plans";
import type {
  InsurancePolicy,
  InternalNote,
  Mineral,
  MineralAuditEvent,
  Shipment,
  ShipmentAddress,
  ShippingStatus,
  VaultOwner,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days: number, hour = 10) => {
  const date = new Date(now + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

const VAULT_ADDRESS: ShipmentAddress = {
  name: "Cosmic Vault Depository",
  line1: "18 Finsbury Circus",
  city: "London",
  postcode: "EC2M 7EB",
  country: "United Kingdom",
};

export const DEMO_OWNERS: VaultOwner[] = [
  {
    id: "demo-client-noor",
    name: "Noor Haddad",
    email: "noor.haddad@example.com",
    clientReference: "CV-CLIENT-0841",
    address: {
      name: "Noor Haddad",
      line1: "14 Harbour View Mews",
      city: "Bristol",
      postcode: "BS1 4TT",
      country: "United Kingdom",
    },
  },
  {
    id: "demo-client-tomas",
    name: "Tomas Berg",
    email: "tomas.berg@example.com",
    clientReference: "CV-CLIENT-0917",
    address: {
      name: "Tomas Berg",
      line1: "8 Marina Terrace",
      city: "Cork",
      postcode: "T12 X4P2",
      country: "Ireland",
    },
  },
  {
    id: "demo-client-priya",
    name: "Priya Raman",
    email: "priya.raman@example.com",
    clientReference: "CV-CLIENT-1024",
    address: {
      name: "Priya Raman",
      line1: "Flat 3, 27 Kirkstall Lane",
      city: "Leeds",
      postcode: "LS6 3EA",
      country: "United Kingdom",
    },
  },
];

export const DEMO_OWNER = DEMO_OWNERS[0];

let policySequence = 1840;
function makePolicy({
  planId,
  startDaysAgo,
  endDaysAhead,
  appraisedValue,
  status = "active",
  note,
}: {
  planId: string;
  startDaysAgo: number;
  endDaysAhead: number;
  appraisedValue: number;
  status?: "active" | "pending" | "expired";
  note?: string;
}): InsurancePolicy {
  const plan = MINERAL_PLANS.find((item) => item.id === planId) ?? MINERAL_PLANS[0];
  const quote = quotePlan(plan, appraisedValue);
  policySequence += 7;
  const policyNumber = `CVP-${new Date(now).getFullYear()}-${policySequence}`;
  return {
    planId: plan.id,
    policyId: `policy-${policySequence}`,
    name: plan.name,
    planType: plan.planType,
    policyNumber,
    coverageAmount: quote.coverageAmount,
    currency: "GBP",
    premium: quote.premium,
    premiumFrequency: plan.frequency,
    startDate: at(-startDaysAgo),
    endDate: at(endDaysAhead),
    deductible: quote.deductible,
    coverageDetails: plan.coverageDetails,
    exclusions: plan.exclusions,
    status,
    statusHistory: [
      {
        status: "pending",
        at: at(-startDaysAgo - 1, 15),
        note: "Cover requested. Appraisal and provenance documents received.",
        actor: "Iris Chen",
      },
      {
        status,
        at: at(-startDaysAgo, 11),
        note:
          note ??
          (status === "active"
            ? "Policy bound. Certificate and schedule issued to the member."
            : status === "pending"
              ? "Awaiting final underwriter sign-off."
              : "Policy term ended. Renewal quote issued."),
        actor: "Iris Chen",
      },
    ],
    certificateUrl: "",
  };
}

function makeShipment({
  trackingNumber,
  carrier,
  service,
  destination,
  currentStatus,
  etaDays,
  events,
}: {
  trackingNumber: string;
  carrier: string;
  service: string;
  destination: ShipmentAddress;
  currentStatus: ShippingStatus;
  etaDays: number;
  events: { status: ShippingStatus; daysAgo: number; note: string }[];
}): Shipment {
  const history = events.map((event) => ({
    status: event.status,
    at: at(-event.daysAgo, 9),
    note: event.note,
    actor: "Cosmic Vault operations",
  }));
  return {
    trackingNumber,
    carrier,
    service,
    origin: VAULT_ADDRESS,
    destination,
    estimatedDelivery: at(etaDays, 17),
    currentStatus,
    statusHistory: history,
    dispatchedAt: history.find((event) => event.status === "in_transit")?.at,
    deliveredAt: history.find((event) => event.status === "shipped")?.at,
  };
}

function audit(
  id: string,
  kind: MineralAuditEvent["kind"],
  message: string,
  daysAgo: number,
  actor = "Cosmic Vault operations",
): MineralAuditEvent {
  return { id, kind, message, at: at(-daysAgo, 12), actor };
}

const noor = DEMO_OWNERS[0];
const tomas = DEMO_OWNERS[1];
const priya = DEMO_OWNERS[2];

export const DEMO_MINERALS: Mineral[] = [
  {
    id: "mineral-gold-sovereign",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-A-1042",
    certificateNumber: "COA-8842-1190",
    name: "Sovereign 1 kg Gold Bar",
    type: "Gold Bar",
    category: "Bullion",
    description:
      "A single 1 kg cast bar from a LBMA Good Delivery refiner, sealed in its original assay card. The bar has been held in the vault since acquisition and has never left secure custody.",
    weight: 1000,
    unit: "g",
    dimensions: "115 × 52 × 9 mm",
    purity: "999.9",
    grade: "24 ct · LBMA Good Delivery",
    estimatedValue: 786400,
    currency: "GBP",
    valuationUpdatedAt: at(-2, 8),
    photos: ["/minerals/gold-bars.webp", "/minerals/gold-bars-detail.webp"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-420),
    storageLocation: "Vault A · Drawer 12",
    insurancePolicy: makePolicy({
      planId: "cosmic-full",
      startDaysAgo: 405,
      endDaysAhead: 238,
      appraisedValue: 786400,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-8842-1190-GB",
      carrier: "Malca-Amit",
      service: "Secure air · door-to-door",
      destination: noor.address,
      currentStatus: "in_transit",
      etaDays: 2,
      events: [
        {
          status: "pending",
          daysAgo: 6,
          note: "Outbound request approved by vault operations. Consignment reference created.",
        },
        {
          status: "in_progress",
          daysAgo: 5,
          note: "Bar retrieved, re-photographed and sealed in a tamper-evident case.",
        },
        {
          status: "in_transit",
          daysAgo: 2,
          note: "Collected by Malca-Amit. Air waybill CVX-8842-1190-GB is active.",
        },
      ],
    }),
    notes:
      "Original assay card is stored with the bar. Please give the carrier at least 48 hours' notice if you need to change the delivery address.",
    internalNotes: [
      {
        id: "note-gold-1",
        author: "Iris Chen",
        body: "Client confirmed the Bristol address by phone before dispatch. Carrier SLA is 72 hours door-to-door.",
        createdAt: at(-4, 14),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-gold-1", "deposit", "Received, weighed and photographed at intake.", 420),
      audit("audit-gold-2", "insurance", "Cosmic Full Coverage bound for £865,040.", 405),
      audit("audit-gold-3", "valuation", "Appraisal refreshed against the morning gold fix.", 2, "Valuations desk"),
      audit("audit-gold-4", "shipping", "Shipment moved to In Transit with Malca-Amit.", 2),
    ],
    isDemo: true,
    createdAt: at(-421),
    updatedAt: at(-2),
  },
  {
    id: "mineral-diamond-aurora",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-B-0304",
    certificateNumber: "COA-6221-8490",
    name: "The Aurora Diamond",
    type: "Diamond",
    category: "Gemstone",
    description:
      "A 5.02 carat round brilliant with D colour and VVS1 clarity, accompanied by a GIA report and a laser inscription on the girdle. Held in a sealed, individually numbered parcel.",
    weight: 5.02,
    unit: "ct",
    dimensions: "11.10 × 11.10 × 6.82 mm",
    purity: "D colour",
    grade: "VVS1 · Excellent cut · GIA 6221849031",
    estimatedValue: 412500,
    currency: "GBP",
    valuationUpdatedAt: at(-11, 9),
    photos: ["/minerals/diamonds.webp", "/minerals/diamond-detail.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-188),
    storageLocation: "Vault B · Case 04",
    insurancePolicy: makePolicy({
      planId: "cosmic-full",
      startDaysAgo: 186,
      endDaysAhead: 94,
      appraisedValue: 412500,
    }),
    shipping: null,
    notes:
      "Stone is loose, not set. Please book a viewing at least five working days in advance so the parcel can be retrieved under dual control.",
    internalNotes: [
      {
        id: "note-diamond-1",
        author: "Marcus Vale",
        body: "GIA report matches the girdle inscription. Annual reappraisal due in November.",
        createdAt: at(-185, 16),
      },
    ],
    claims: [
      {
        id: "claim-diamond-1",
        reference: "CLM-CV-2041",
        reason: "Suspected repolish during a previous setting",
        details:
          "A small weight discrepancy was noted during the latest appraisal. Requesting a gemmologist review before the renewal quote is issued.",
        status: "under_review",
        submittedAt: at(-8, 11),
      },
    ],
    statusHistory: [
      audit("audit-diamond-1", "deposit", "Sealed parcel received and matched to the GIA report.", 188),
      audit("audit-diamond-2", "insurance", "All-Risk Mineral Policy bound for £453,750.", 186),
      audit("audit-diamond-3", "valuation", "Independent appraisal refreshed by the gemmology desk.", 11, "Gemmology desk"),
      audit("audit-diamond-4", "claim", "Claim CLM-CV-2041 opened for a gemmologist review.", 8, "Noor Haddad"),
    ],
    isDemo: true,
    createdAt: at(-189),
    updatedAt: at(-8),
  },
  {
    id: "mineral-silver-ten-ounce",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-C-0721",
    certificateNumber: "COA-3308-4471",
    name: "Ten-Ounce Silver Set",
    type: "Silver Bar",
    category: "Bullion",
    description:
      "Ten consecutive 1 oz .999 fine silver rounds in a sealed presentation tube, with matching serials and a refiner certificate.",
    weight: 311.03,
    unit: "g",
    dimensions: "90 × 52 × 32 mm (tube)",
    purity: "999.0",
    grade: "Fine silver · uncirculated",
    estimatedValue: 3180,
    currency: "GBP",
    valuationUpdatedAt: at(-6, 9),
    photos: ["/minerals/silver-bars.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-95),
    storageLocation: "Vault C · Tray 21",
    insurancePolicy: makePolicy({
      planId: "transit-storage",
      startDaysAgo: 94,
      endDaysAhead: 271,
      appraisedValue: 3180,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-3308-4471-GB",
      carrier: "Brink's Global Services",
      service: "Secure road · next day",
      destination: noor.address,
      currentStatus: "in_progress",
      etaDays: 3,
      events: [
        {
          status: "pending",
          daysAgo: 2,
          note: "Outbound request received and assigned to the packing team.",
        },
        {
          status: "in_progress",
          daysAgo: 1,
          note: "Final weight check complete. Tube is being sealed in the transit case.",
        },
      ],
    }),
    notes:
      "Keep the presentation tube sealed. Breaking the seal may affect the implied numismatic premium on resale.",
    internalNotes: [],
    claims: [],
    statusHistory: [
      audit("audit-silver-1", "deposit", "Tube received and serials recorded.", 95),
      audit("audit-silver-2", "insurance", "Transit + Storage cover bound for £3,498.", 94),
      audit("audit-silver-3", "shipping", "Shipment preparation started.", 2),
      audit("audit-silver-4", "shipping", "Packing and document check underway.", 1),
    ],
    isDemo: true,
    createdAt: at(-96),
    updatedAt: at(-1),
  },
  {
    id: "mineral-emerald-muzo",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-B-0319",
    certificateNumber: "COA-1402-9928",
    name: "Muzo Emerald",
    type: "Emerald",
    category: "Gemstone",
    description:
      "An 8.4 carat emerald-cut emerald from the Muzo region of Colombia, with minor traditional oil and an independent colour report. Stored in an inert, cushioned case.",
    weight: 8.4,
    unit: "ct",
    dimensions: "14.2 × 10.1 × 7.4 mm",
    purity: "Minor traditional oil",
    grade: "AAA · Vivid green",
    estimatedValue: 96500,
    currency: "GBP",
    valuationUpdatedAt: at(-27, 10),
    photos: ["/minerals/emerald.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-310),
    storageLocation: "Vault B · Case 09",
    insurancePolicy: makePolicy({
      planId: "cosmic-full",
      startDaysAgo: 308,
      endDaysAhead: 57,
      appraisedValue: 96500,
    }),
    shipping: null,
    notes:
      "Avoid temperature swings. The vault monitors relative humidity continuously and the case is inspected quarterly.",
    internalNotes: [
      {
        id: "note-emerald-1",
        author: "Gemmology desk",
        body: "Colour report confirms Muzo origin. Oil level is stable at the last two inspections.",
        createdAt: at(-60, 13),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-emerald-1", "deposit", "Stone received and photographed under controlled light.", 310),
      audit("audit-emerald-2", "insurance", "Cosmic Full Coverage bound for £106,150.", 308),
      audit("audit-emerald-3", "valuation", "Quarterly condition check completed without change.", 27, "Gemmology desk"),
    ],
    isDemo: true,
    createdAt: at(-311),
    updatedAt: at(-27),
  },
  {
    id: "mineral-platinum-britannia",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-A-1002",
    certificateNumber: "COA-7719-3302",
    name: "Platinum Britannia 1 oz",
    type: "Platinum Coin",
    category: "Specie",
    description:
      "A 2022 1 oz platinum Britannia in a protective capsule. Purchased at issue and held continuously in the vault.",
    weight: 31.1,
    unit: "g",
    dimensions: "32.69 mm diameter · 2.1 mm depth",
    purity: "999.5",
    grade: "Uncirculated · Royal Mint",
    estimatedValue: 1185,
    currency: "GBP",
    valuationUpdatedAt: at(-19, 8),
    photos: ["/minerals/platinum-coin.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-42),
    storageLocation: "Vault A · Drawer 02",
    insurancePolicy: null,
    shipping: null,
    notes:
      "This piece is not yet covered. Add a policy before arranging any shipment or viewing outside the vault.",
    internalNotes: [
      {
        id: "note-platinum-1",
        author: "Iris Chen",
        body: "Member asked for storage-only options at intake. Follow up with the Vault Storage Essential quote before the next review.",
        createdAt: at(-40, 11),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-platinum-1", "deposit", "Coin received in a sealed capsule and recorded.", 42),
      audit("audit-platinum-2", "valuation", "Initial appraisal recorded at £1,185.", 42, "Valuations desk"),
    ],
    isDemo: true,
    createdAt: at(-43),
    updatedAt: at(-19),
  },
  {
    id: "mineral-rare-earth-neodymium",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-D-0143",
    certificateNumber: "COA-5203-7718",
    name: "Neodymium Oxide Specimen",
    type: "Rare Earth",
    category: "Rare Earth",
    description:
      "A 450 g technical-grade neodymium oxide specimen in a sealed mineral mount, sourced from Mount Weld and accompanied by an assay certificate.",
    weight: 450,
    unit: "g",
    dimensions: "78 × 54 × 40 mm",
    purity: "99.9%",
    grade: "Technical grade · sealed mount",
    estimatedValue: 18400,
    currency: "GBP",
    valuationUpdatedAt: at(-90, 10),
    photos: ["/minerals/rare-earth.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-230),
    storageLocation: "Vault D · Cabinet 3",
    insurancePolicy: makePolicy({
      planId: "transit-storage",
      startDaysAgo: 228,
      endDaysAhead: 137,
      appraisedValue: 18400,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-5203-7718-GB",
      carrier: "Loomis International",
      service: "Secure road · signed delivery",
      destination: noor.address,
      currentStatus: "shipped",
      etaDays: -12,
      events: [
        {
          status: "pending",
          daysAgo: 20,
          note: "Outbound request approved. Destination and customs reference verified.",
        },
        {
          status: "in_progress",
          daysAgo: 19,
          note: "Specimen removed from the display cabinet and sealed in an inert transit mount.",
        },
        {
          status: "in_transit",
          daysAgo: 17,
          note: "Collected by Loomis International. Consignment sealed with tamper-evident ties.",
        },
        {
          status: "shipped",
          daysAgo: 12,
          note: "Delivered to Noor Haddad. Signature and photo evidence recorded.",
        },
      ],
    }),
    notes:
      "Assay certificate is bundled in the documents section. Do not open the sealed mount; it protects the specimen from oxidation.",
    internalNotes: [
      {
        id: "note-rare-1",
        author: "Operations",
        body: "Delivery completed cleanly. Proof of delivery is stored against the shipment record.",
        createdAt: at(-12, 17),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-rare-1", "deposit", "Specimen received with sealed assay certificate.", 230),
      audit("audit-rare-2", "insurance", "Transit + Storage cover bound for £20,240.", 228),
      audit("audit-rare-3", "shipping", "Shipment delivered and signed for.", 12),
    ],
    isDemo: true,
    createdAt: at(-231),
    updatedAt: at(-12),
  },
  {
    id: "mineral-ruby-burma",
    ownerId: noor.id,
    ownerName: noor.name,
    ownerEmail: noor.email,
    ownerReference: noor.clientReference,
    vaultId: "CV-B-0307",
    certificateNumber: "COA-9011-2244",
    name: "Burma Ruby",
    type: "Ruby",
    category: "Gemstone",
    description:
      "A 4.1 carat oval ruby from Mogok with no evidence of heat treatment. A statement of origin and a colour report accompany the stone.",
    weight: 4.1,
    unit: "ct",
    dimensions: "9.8 × 8.2 × 5.6 mm",
    purity: "No heat · no residues",
    grade: "AAAA · Pigeon blood",
    estimatedValue: 64000,
    currency: "GBP",
    valuationUpdatedAt: at(-74, 9),
    photos: ["/minerals/ruby.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-140),
    storageLocation: "Vault B · Case 07",
    insurancePolicy: null,
    shipping: null,
    notes:
      "Cover has lapsed while the renewal is reviewed. The stone remains in the vault and is not eligible for release until cover is reinstated.",
    internalNotes: [
      {
        id: "note-ruby-1",
        author: "Underwriting",
        body: "Renewal held pending an updated origin report. Member has been notified by email.",
        createdAt: at(-21, 10),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-ruby-1", "deposit", "Stone received with origin statement and sealed parcel.", 140),
      audit("audit-ruby-2", "insurance", "Previous all-risk cover expired at renewal.", 21),
      audit("audit-ruby-3", "valuation", "Appraisal refreshed at £64,000.", 74, "Gemmology desk"),
    ],
    isDemo: true,
    createdAt: at(-141),
    updatedAt: at(-21),
  },
  {
    id: "mineral-tomas-silver",
    ownerId: tomas.id,
    ownerName: tomas.name,
    ownerEmail: tomas.email,
    ownerReference: tomas.clientReference,
    vaultId: "CV-C-0688",
    certificateNumber: "COA-1204-8831",
    name: "Argent 5 kg Silver Bar",
    type: "Silver Bar",
    category: "Bullion",
    description:
      "A single 5 kg cast silver bar with a stamped serial and refiner mark, stored in the client's dedicated tray.",
    weight: 5000,
    unit: "g",
    dimensions: "255 × 95 × 45 mm",
    purity: "999.0",
    grade: "Cast · refiner assay",
    estimatedValue: 4920,
    currency: "GBP",
    valuationUpdatedAt: at(-15, 9),
    photos: ["/minerals/silver-bars.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-170),
    storageLocation: "Vault C · Tray 08",
    insurancePolicy: makePolicy({
      planId: "transit-storage",
      startDaysAgo: 168,
      endDaysAhead: 197,
      appraisedValue: 4920,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-1204-8831-IE",
      carrier: "Brink's Global Services",
      service: "Secure road · two day",
      destination: tomas.address,
      currentStatus: "pending",
      etaDays: 4,
      events: [
        {
          status: "pending",
          daysAgo: 1,
          note: "Collection slot requested with Brink's. Awaiting route confirmation.",
        },
      ],
    }),
    notes:
      "Delivery requires photo identification. The carrier will contact the number on file before arrival.",
    internalNotes: [],
    claims: [],
    statusHistory: [
      audit("audit-tomas-silver-1", "deposit", "Bar received and weighed at 5,000 g.", 170),
      audit("audit-tomas-silver-2", "insurance", "Transit + Storage cover bound for £5,412.", 168),
      audit("audit-tomas-silver-3", "shipping", "Outbound shipment raised in Pending.", 1),
    ],
    isDemo: true,
    createdAt: at(-171),
    updatedAt: at(-1),
  },
  {
    id: "mineral-tomas-diamond",
    ownerId: tomas.id,
    ownerName: tomas.name,
    ownerEmail: tomas.email,
    ownerReference: tomas.clientReference,
    vaultId: "CV-B-0288",
    certificateNumber: "COA-4410-6652",
    name: "Kimberley White Diamond",
    type: "Diamond",
    category: "Gemstone",
    description:
      "A 3.10 carat pear brilliant with E colour and VS1 clarity, held loose with its original grading report.",
    weight: 3.1,
    unit: "ct",
    dimensions: "12.4 × 7.8 × 4.9 mm",
    purity: "E colour",
    grade: "VS1 · Very good cut",
    estimatedValue: 182000,
    currency: "GBP",
    valuationUpdatedAt: at(-33, 10),
    photos: ["/minerals/diamonds.webp", "/minerals/diamond-detail.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-260),
    storageLocation: "Vault B · Case 11",
    insurancePolicy: makePolicy({
      planId: "cosmic-full",
      startDaysAgo: 258,
      endDaysAhead: 104,
      appraisedValue: 182000,
    }),
    shipping: null,
    notes: "Loose stone. Viewings are supervised and recorded.",
    internalNotes: [
      {
        id: "note-tomas-diamond-1",
        author: "Gemmology desk",
        body: "Report and stone are a matched pair. No fluorescence observed.",
        createdAt: at(-257, 14),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-tomas-diamond-1", "deposit", "Stone verified and sealed in a numbered parcel.", 260),
      audit("audit-tomas-diamond-2", "insurance", "Cosmic Full Coverage bound for £200,200.", 258),
    ],
    isDemo: true,
    createdAt: at(-261),
    updatedAt: at(-33),
  },
  {
    id: "mineral-tomas-sapphire",
    ownerId: tomas.id,
    ownerName: tomas.name,
    ownerEmail: tomas.email,
    ownerReference: tomas.clientReference,
    vaultId: "CV-B-0291",
    certificateNumber: "COA-3307-1029",
    name: "Ceylon Royal Blue Sapphire",
    type: "Sapphire",
    category: "Gemstone",
    description:
      "A 6.70 carat cushion-cut sapphire with a royal blue hue and no heat treatment, accompanied by an origin report.",
    weight: 6.7,
    unit: "ct",
    dimensions: "11.8 × 9.6 × 6.4 mm",
    purity: "No heat · Sri Lanka",
    grade: "AAA · Royal blue",
    estimatedValue: 48200,
    currency: "GBP",
    valuationUpdatedAt: at(-58, 9),
    photos: ["/minerals/sapphire.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-120),
    storageLocation: "Vault B · Case 12",
    insurancePolicy: null,
    shipping: null,
    notes:
      "Awaiting an insurance instruction from the owner. The stone remains secure in the vault and cannot be released without cover.",
    internalNotes: [
      {
        id: "note-tomas-sapphire-1",
        author: "Iris Chen",
        body: "Sent the storage-only quote. Client is comparing it with their household policy.",
        createdAt: at(-30, 15),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-tomas-sapphire-1", "deposit", "Stone received and photographed.", 120),
      audit("audit-tomas-sapphire-2", "valuation", "Appraisal recorded at £48,200.", 58, "Gemmology desk"),
    ],
    isDemo: true,
    createdAt: at(-121),
    updatedAt: at(-30),
  },
  {
    id: "mineral-tomas-nugget",
    ownerId: tomas.id,
    ownerName: tomas.name,
    ownerEmail: tomas.email,
    ownerReference: tomas.clientReference,
    vaultId: "CV-A-1067",
    certificateNumber: "COA-7752-3004",
    name: "Welcome Stranger Nugget",
    type: "Gold Nugget",
    category: "Bullion",
    description:
      "A 212.4 g natural gold nugget from Victoria, Australia, with a documented find location and a display mount.",
    weight: 212.4,
    unit: "g",
    dimensions: "62 × 34 × 22 mm",
    purity: "92.5% Au equivalent",
    grade: "Natural specimen · 22 ct",
    estimatedValue: 18900,
    currency: "GBP",
    valuationUpdatedAt: at(-46, 11),
    photos: ["/minerals/gold-nugget.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-210),
    storageLocation: "Vault A · Drawer 15",
    insurancePolicy: makePolicy({
      planId: "vault-essential",
      startDaysAgo: 208,
      endDaysAhead: 157,
      appraisedValue: 18900,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-7752-3004-IE",
      carrier: "Malca-Amit",
      service: "Secure road · three day",
      destination: tomas.address,
      currentStatus: "in_transit",
      etaDays: 1,
      events: [
        {
          status: "pending",
          daysAgo: 7,
          note: "Outbound request approved. Display mount release authorised.",
        },
        {
          status: "in_progress",
          daysAgo: 5,
          note: "Nugget and display mount packed under dual control.",
        },
        {
          status: "in_transit",
          daysAgo: 1,
          note: "Collected by Malca-Amit. In transit to Cork.",
        },
      ],
    }),
    notes:
      "The display mount is part of the insured object. Keep it with the nugget if you move the piece.",
    internalNotes: [],
    claims: [],
    statusHistory: [
      audit("audit-tomas-nugget-1", "deposit", "Nugget received with find documentation.", 210),
      audit("audit-tomas-nugget-2", "insurance", "Vault Storage Essential bound for £20,790.", 208),
      audit("audit-tomas-nugget-3", "shipping", "Shipment moved to In Transit.", 1),
    ],
    isDemo: true,
    createdAt: at(-211),
    updatedAt: at(-1),
  },
  {
    id: "mineral-priya-britannia",
    ownerId: priya.id,
    ownerName: priya.name,
    ownerEmail: priya.email,
    ownerReference: priya.clientReference,
    vaultId: "CV-A-1088",
    certificateNumber: "COA-2206-5541",
    name: "Gold Britannia Ten-Coin Tube",
    type: "Gold Coin",
    category: "Specie",
    description:
      "A sealed Royal Mint tube of ten 1 oz gold Britannia coins, 2024 issue, with matching security seals.",
    weight: 311,
    unit: "g",
    dimensions: "92 × 52 × 30 mm (tube)",
    purity: "999.9",
    grade: "Bullion · uncirculated",
    estimatedValue: 248900,
    currency: "GBP",
    valuationUpdatedAt: at(-4, 9),
    photos: ["/minerals/gold-bars.webp", "/minerals/gold-bars-detail.webp"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-80),
    storageLocation: "Vault A · Drawer 07",
    insurancePolicy: makePolicy({
      planId: "cosmic-full",
      startDaysAgo: 78,
      endDaysAhead: 287,
      appraisedValue: 248900,
    }),
    shipping: null,
    notes: "Sealed tube. The vault records both the tube seal and the individual coin serials.",
    internalNotes: [],
    claims: [],
    statusHistory: [
      audit("audit-priya-gold-1", "deposit", "Sealed tube received and serials recorded.", 80),
      audit("audit-priya-gold-2", "insurance", "Cosmic Full Coverage bound for £273,790.", 78),
      audit("audit-priya-gold-3", "valuation", "Appraisal refreshed against the London fix.", 4, "Valuations desk"),
    ],
    isDemo: true,
    createdAt: at(-81),
    updatedAt: at(-4),
  },
  {
    id: "mineral-priya-ruby",
    ownerId: priya.id,
    ownerName: priya.name,
    ownerEmail: priya.email,
    ownerReference: priya.clientReference,
    vaultId: "CV-B-0324",
    certificateNumber: "COA-8891-4402",
    name: "Pigeon Blood Ruby",
    type: "Ruby",
    category: "Gemstone",
    description:
      "A 2.40 carat cushion-cut ruby with a saturated pigeon-blood hue and minor traditional treatment, in a sealed parcel.",
    weight: 2.4,
    unit: "ct",
    dimensions: "8.4 × 7.1 × 5.0 mm",
    purity: "Minor traditional heat",
    grade: "AAA · Pigeon blood",
    estimatedValue: 39800,
    currency: "GBP",
    valuationUpdatedAt: at(-35, 10),
    photos: ["/minerals/ruby.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-150),
    storageLocation: "Vault B · Case 06",
    insurancePolicy: makePolicy({
      planId: "transit-storage",
      startDaysAgo: 148,
      endDaysAhead: 119,
      appraisedValue: 39800,
    }),
    shipping: makeShipment({
      trackingNumber: "CVX-8891-4402-GB",
      carrier: "Loomis International",
      service: "Secure road · signed delivery",
      destination: priya.address,
      currentStatus: "on_hold",
      etaDays: 5,
      events: [
        {
          status: "pending",
          daysAgo: 9,
          note: "Outbound request approved by vault operations.",
        },
        {
          status: "in_progress",
          daysAgo: 8,
          note: "Stone retrieved and packed in a sealed transit parcel.",
        },
        {
          status: "on_hold",
          daysAgo: 6,
          note: "Held pending confirmation of the destination customs reference. Client notified.",
        },
      ],
    }),
    notes:
      "A customs reference is required for this route. Our operations team will update the track as soon as it is confirmed.",
    internalNotes: [
      {
        id: "note-priya-ruby-1",
        author: "Operations",
        body: "Awaiting client's customs reference. ETA is provisional until the hold is released.",
        createdAt: at(-6, 12),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-priya-ruby-1", "deposit", "Stone received in a sealed parcel.", 150),
      audit("audit-priya-ruby-2", "insurance", "Transit + Storage cover bound for £43,780.", 148),
      audit("audit-priya-ruby-3", "shipping", "Shipment placed on hold for a customs reference.", 6),
    ],
    isDemo: true,
    createdAt: at(-151),
    updatedAt: at(-6),
  },
  {
    id: "mineral-priya-emerald",
    ownerId: priya.id,
    ownerName: priya.name,
    ownerEmail: priya.email,
    ownerReference: priya.clientReference,
    vaultId: "CV-B-0330",
    certificateNumber: "COA-6650-2287",
    name: "Muzo Emerald Pair",
    type: "Emerald",
    category: "Gemstone",
    description:
      "A matched pair of 2.80 carat emerald-cut emeralds from Muzo, suitable for a bespoke setting, held in a single sealed parcel.",
    weight: 5.6,
    unit: "ct",
    dimensions: "9.1 × 6.8 × 5.2 mm each",
    purity: "Minor traditional oil",
    grade: "AAA · Matched pair",
    estimatedValue: 72400,
    currency: "GBP",
    valuationUpdatedAt: at(-22, 9),
    photos: ["/minerals/emerald.svg"],
    certificateUrl: "",
    assayReportUrl: "",
    depositDate: at(-110),
    storageLocation: "Vault B · Case 10",
    insurancePolicy: makePolicy({
      planId: "vault-essential",
      startDaysAgo: 108,
      endDaysAhead: 64,
      appraisedValue: 72400,
      status: "pending",
      note: "Awaiting the final underwriter sign-off after the updated colour report.",
    }),
    shipping: null,
    notes:
      "Cover is awaiting final sign-off. The stones remain in the vault and can be viewed by appointment.",
    internalNotes: [
      {
        id: "note-priya-emerald-1",
        author: "Underwriting",
        body: "Colour report received. Final sign-off expected this week; no additional conditions.",
        createdAt: at(-9, 15),
      },
    ],
    claims: [],
    statusHistory: [
      audit("audit-priya-emerald-1", "deposit", "Matched pair received and recorded as one parcel.", 110),
      audit("audit-priya-emerald-2", "insurance", "Vault Storage Essential submitted for approval.", 8),
      audit("audit-priya-emerald-3", "valuation", "Pair appraisal refreshed at £72,400.", 22, "Gemmology desk"),
    ],
    isDemo: true,
    createdAt: at(-111),
    updatedAt: at(-8),
  },
];

/** A quiet, varied subset used when a real member asks to load a demo collection. */
export function demoCollectionForOwner({
  ownerId,
  ownerName,
  ownerEmail,
  ownerReference,
  address,
}: {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerReference: string;
  address: ShipmentAddress;
}): Mineral[] {
  const templates = [
    DEMO_MINERALS[0],
    DEMO_MINERALS[1],
    DEMO_MINERALS[2],
    DEMO_MINERALS[4],
    DEMO_MINERALS[5],
    DEMO_MINERALS[6],
  ];
  return templates.map((mineral, index) => {
    const suffix = `${ownerId.slice(-6)}-${index + 1}`;
    const shipping = mineral.shipping
      ? {
          ...mineral.shipping,
          destination: { ...address, name: ownerName },
          statusHistory: mineral.shipping.statusHistory.map((event) => ({
            ...event,
            note: event.note.replace(/Noor Haddad/g, ownerName),
          })),
        }
      : null;
    return {
      ...mineral,
      id: `${mineral.id}-${suffix}`,
      ownerId,
      ownerName,
      ownerEmail,
      ownerReference,
      vaultId: mineral.vaultId.replace(/\d{4}$/, String(2000 + index)),
      certificateNumber: mineral.certificateNumber.replace(/\d{4}$/, String(3000 + index)),
      shipping,
      claims: [],
      internalNotes: [],
      statusHistory: mineral.statusHistory.map((event) => ({
        ...event,
        id: `${event.id}-${suffix}`,
      })),
      isDemo: true,
      createdAt: Date.now() - index * DAY,
      updatedAt: Date.now() - index * DAY,
    };
  });
}

/** Ensures every seeded owner exists even if a previous local store predates them. */
export function demoOwnerById(id: string) {
  return DEMO_OWNERS.find((owner) => owner.id === id);
}

export function createInternalNote(author: string, body: string): InternalNote {
  return {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    body,
    createdAt: Date.now(),
  };
}
