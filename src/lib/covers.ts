/**
 * Public content for the insurance cover lines that exist in the platform.
 *
 * Every entry maps to a real, configured product category (see
 * `convex/setup.ts` → CATEGORIES / SEED_PRODUCTS). Coverage areas and
 * limitations below are editorial summaries of those product configurations —
 * they are intentionally qualitative. Limits, excesses and optional benefits
 * live in the product schedule and policy wording, never on a marketing page.
 */

export type CoverPage = {
  slug: string;
  name: string;
  productName: string;
  navLabel: string;
  eyebrow: string;
  headline: string;
  intro: string;
  metaDescription: string;
  summary: string;
  suitableFor: string[];
  coverageAreas: { title: string; body: string }[];
  limitations: string[];
  beforeYouApply: string[];
  pricing: string;
  faqs: { question: string; answer: string }[];
};

export const COVERS: CoverPage[] = [
  {
    slug: "home",
    name: "Home insurance",
    productName: "Vault Home & Contents",
    navLabel: "Home insurance",
    eyebrow: "Cover · Home and property",
    headline: "Protection for the place you've made your own.",
    intro:
      "Buildings and contents cover for owners and long-term renters, with the questions we ask designed to reflect the property you actually live in — not an average one.",
    metaDescription:
      "Home and contents insurance from Cosmic Vault: what buildings and contents cover does, who it may suit, what underwriters ask for, and how to start an application.",
    summary:
      "One household policy for the structure and the things inside it, rated on your property details rather than a postcode average.",
    suitableFor: [
      "Homeowners protecting the structure and the contents inside it",
      "Long-term renters who want contents cover in their own name",
      "Households that have recently renovated, extended, or moved",
      "Owners of older or non-standard properties who want a human review",
    ],
    coverageAreas: [
      {
        title: "Buildings cover",
        body: "The structure of the property, including permanent fixtures and fittings, assessed against an estimated rebuild value rather than market price.",
      },
      {
        title: "Contents cover",
        body: "Household possessions at the level you declare, with replacement terms set out in the schedule rather than assumed.",
      },
      {
        title: "Escape of water and storm damage",
        body: "Common household risks are considered as part of the product design, with the excess that applies stated in your schedule.",
      },
      {
        title: "Home emergency response",
        body: "Support when something fails at home, so the first question is how to make it safe rather than who to call.",
      },
    ],
    limitations: [
      "Property type, construction, and flood risk are declared during underwriting. A material change can change the terms or the price.",
      "Unoccupied periods, business use of the home, and high-value single items usually need to be declared and may be excluded.",
      "The rebuild value is an estimate you are responsible for reviewing; under-insurance is not corrected automatically.",
      "Maintenance-related damage, wear and tear, and gradual deterioration are not insurable events.",
    ],
    beforeYouApply: [
      "The full insurable address and approximate year of construction",
      "Property type and any non-standard construction",
      "An estimated rebuild value, not the asking or market price",
      "The contents value you want covered, and any high-value single items",
      "Any recent claims, and whether you or the property have experienced flooding",
    ],
    pricing:
      "Your indicative premium is calculated from the published rating rules for the product — property type, declared contents level, and flood risk — then reviewed by an underwriter before any cover begins.",
    faqs: [
      {
        question: "Is buildings cover included automatically?",
        answer:
          "Buildings and contents are separate elements of the same product design. Tell us in the application whether you need one or both, and the schedule will state exactly what is covered.",
      },
      {
        question: "What if my property is unusual?",
        answer:
          "Non-standard construction, listed buildings, and homes with a history of flooding can still be considered, but the details must be declared. An underwriter reviews these applications personally rather than pushing them through an automated rule.",
      },
      {
        question: "How is the rebuild value decided?",
        answer:
          "You provide an estimate of the cost to rebuild the property, excluding the value of the land. It is a different figure from the price you paid or the current market value.",
      },
    ],
  },
  {
    slug: "motor",
    name: "Motor insurance",
    productName: "Vault Comprehensive Motor",
    navLabel: "Motor insurance",
    eyebrow: "Cover · Motor",
    headline: "Comprehensive cover for the cars you actually drive.",
    intro:
      "Private car cover for up to three vehicles on one policy, with the paperwork kept to what genuinely affects the risk.",
    metaDescription:
      "Comprehensive motor insurance from Cosmic Vault: what the cover includes, who it suits, what underwriters ask for, and how the quote and application process works.",
    summary:
      "Comprehensive private car cover, rated on mileage and claims history rather than advertising rates.",
    suitableFor: [
      "Private car owners who want a single policy across a household",
      "Households insuring more than one vehicle, including young drivers",
      "Drivers who want a named claims handler rather than a call queue",
      "Drivers who occasionally travel in Europe with their own car",
    ],
    coverageAreas: [
      {
        title: "Accidental damage and theft",
        body: "Comprehensive cover for your own vehicle, with the excess that applies written into the schedule.",
      },
      {
        title: "Liability to other people",
        body: "Third-party liability is an essential part of the product design, so damage you cause to others is considered in the same policy.",
      },
      {
        title: "Windscreen and glass",
        body: "Glass damage is handled separately from a full claim wherever the product terms allow it.",
      },
      {
        title: "Courtesy vehicle and European use",
        body: "A replacement vehicle while yours is repaired, and cover for trips within Europe for the period stated in the policy.",
      },
    ],
    limitations: [
      "Racing, track days, and competitive events are excluded.",
      "Commercial delivery or ride-hailing use requires an endorsement and is not covered by default.",
      "Wear, tear, and mechanical breakdown are not insurable events.",
      "Annual mileage and claims history affect the rating and must be declared accurately.",
    ],
    beforeYouApply: [
      "Driving licence details for every named driver",
      "Vehicle registration document details",
      "Your best estimate of annual mileage",
      "Claims and convictions within the period the application asks about",
      "Whether the car is used for work, commuting, or social use only",
    ],
    pricing:
      "Indicative pricing uses the product's published rating rules, including declared annual mileage and recent claims history. A quote is not a commitment to cover.",
    faqs: [
      {
        question: "Can I cover more than one car?",
        answer:
          "Yes. The motor product is designed for private car owners insuring up to three vehicles, with each vehicle listed on the schedule.",
      },
      {
        question: "Is European cover automatic?",
        answer:
          "Cover for a limited period of European driving is part of the product design, and the exact duration is stated in the policy wording. Longer or repeated stays abroad should be declared.",
      },
      {
        question: "What happens after an accident?",
        answer:
          "Report the claim in your vault, upload what you have, and a named handler takes it from there. You can follow every update on the claim itself — see how claims work.",
      },
    ],
  },
  {
    slug: "travel",
    name: "Travel insurance",
    productName: "Vault Worldwide Travel",
    navLabel: "Travel insurance",
    eyebrow: "Cover · Travel",
    headline: "Cover that comes with you.",
    intro:
      "Single-trip and annual multi-trip travel cover for medical emergencies, cancellations, and the bag you really don't want to lose.",
    metaDescription:
      "Travel insurance from Cosmic Vault: medical cover, cancellation, baggage protection, who it suits, and how to start a travel quotation.",
    summary:
      "Annual or trip-based cover with an emergency assistance line and medical expenses at its centre.",
    suitableFor: [
      "Frequent travellers who want one annual policy instead of many",
      "Families travelling together who want everyone on the same terms",
      "Travellers who need medical expenses and repatriation covered",
      "Anyone whose destination falls outside standard regional cover",
    ],
    coverageAreas: [
      {
        title: "Emergency medical treatment",
        body: "Emergency treatment abroad and, where medically necessary, repatriation home — the core reason travel cover exists.",
      },
      {
        title: "Cancellation and curtailment",
        body: "Cover for the cost of cancelling or cutting a trip short for a reason the policy accepts, assessed case by case.",
      },
      {
        title: "Baggage and gadgets",
        body: "Protection for the possessions you travel with, with single-item limits stated in the schedule.",
      },
      {
        title: "Emergency assistance line",
        body: "One number to call from anywhere, staffed by people who can authorise treatment and arrange travel.",
      },
    ],
    limitations: [
      "Travel against medical advice is not covered.",
      "Extreme and winter sports are excluded unless the relevant option is added to the policy.",
      "Events known about before the trip was booked, such as announced strikes, are not insurable.",
      "Destinations must be within the regional scope you selected — worldwide cover excluding the USA is a different product scope from worldwide including it.",
    ],
    beforeYouApply: [
      "Who is travelling, and their ages",
      "The destinations and the first departure date",
      "Any declared medical conditions, for everyone on the policy",
      "Whether winter sports or higher-risk activities are planned",
      "Photo identification for each traveller",
    ],
    pricing:
      "Indicative pricing reflects the number of travellers, the destination region, and the age of the oldest traveller, calculated from the product's published rating rules.",
    faqs: [
      {
        question: "Do I need to declare medical conditions?",
        answer:
          "Yes. Declaring conditions is how they can be considered. Conditions that are not declared cannot be assessed, and that affects whether a related claim can be paid.",
      },
      {
        question: "Is an annual policy cheaper than several trips?",
        answer:
          "That depends how often you travel. The quotation shows the calculated premium for the product as configured, and you can compare it against a single-trip quotation before deciding.",
      },
      {
        question: "What if I need help abroad right now?",
        answer:
          "Call the emergency assistance number in your policy schedule. If you are already in the vault, your policy documents and emergency contacts are held there.",
      },
    ],
  },
  {
    slug: "health",
    name: "Health insurance",
    productName: "Vault Private Health",
    navLabel: "Health insurance",
    eyebrow: "Cover · Health",
    headline: "Private healthcare, without the maze.",
    intro:
      "Private medical cover with consultant access, mental-health support, and optional dental — arranged so you know what is covered before you need it.",
    metaDescription:
      "Private health insurance from Cosmic Vault: consultant diagnostics, mental-health support, dental options, exclusions, and how to start an application.",
    summary:
      "Cover for diagnostics, consultant care, and mental-health support, with pre-existing conditions assessed individually.",
    suitableFor: [
      "Individuals and families who want faster access to consultant-led care",
      "People who want mental-health support without needing a referral first",
      "Households choosing a cover level for one person, a couple, or a family",
      "Anyone who would rather have conditions assessed than automatically declined",
    ],
    coverageAreas: [
      {
        title: "Consultant and diagnostic care",
        body: "Access to private consultation and diagnostics so treatment decisions are made on complete information.",
      },
      {
        title: "Mental-health support",
        body: "Support that does not depend on first persuading a GP to refer you.",
      },
      {
        title: "Second opinions",
        body: "A structured way to have a diagnosis reviewed before committing to a treatment path.",
      },
      {
        title: "Dental and optical option",
        body: "Routine dental and optical care can be added where the product version you choose supports it.",
      },
    ],
    limitations: [
      "Pre-existing conditions are excluded unless they are declared and specifically accepted.",
      "Cosmetic treatment is not covered.",
      "Treatment outside the territories listed in the policy is not covered.",
      "Cover levels differ, and the schedule — not the marketing description — states what is included.",
    ],
    beforeYouApply: [
      "The age band of everyone to be covered",
      "Whether the policy is for one person, a couple, or a family",
      "The cover level you are considering",
      "An honest summary of pre-existing conditions and current medication",
      "Photo identification — a medical history summary helps but is optional",
    ],
    pricing:
      "Indicative pricing reflects age band, chosen cover level, and who is covered. Declared conditions are reviewed by an underwriter rather than priced automatically.",
    faqs: [
      {
        question: "Will a pre-existing condition stop me getting cover?",
        answer:
          "Not necessarily. It means the condition must be declared so it can be assessed. If it cannot be covered, you will be told which parts of the policy it affects rather than being rejected silently.",
      },
      {
        question: "Do I need a GP referral?",
        answer:
          "Mental-health support is designed to be reachable without a referral. Other pathways are described in the policy wording for the cover level you choose.",
      },
      {
        question: "What is the difference between cover levels?",
        answer:
          "Cover levels change which benefits are available and how they are accessed. Each level is described in the product documents shown during the application.",
      },
    ],
  },
  {
    slug: "life",
    name: "Life and family protection",
    productName: "Vault Term Life",
    navLabel: "Life and family protection",
    eyebrow: "Cover · Life and family",
    headline: "Long-horizon protection for the people who rely on you.",
    intro:
      "Level term life cover written in plain language, with an optional critical illness element and support for anyone left to handle the paperwork.",
    metaDescription:
      "Term life and family protection from Cosmic Vault: how level term cover works, who it suits, what must be declared, and how to request a quotation.",
    summary:
      "A fixed sum assured for a fixed term, priced on age, smoking status, and term length.",
    suitableFor: [
      "Adults protecting a mortgage or a family's ongoing costs",
      "Parents who want certainty for a defined number of years",
      "Business owners protecting a partner or a key person",
      "Anyone who wants a critical illness option considered in the same policy",
    ],
    coverageAreas: [
      {
        title: "Level term cover",
        body: "A fixed sum assured for a fixed term: the amount and the period are agreed at the outset and do not change unless you change them.",
      },
      {
        title: "Critical illness option",
        body: "Where selected and accepted, an accelerated payment on diagnosis of a qualifying condition, subject to the policy definitions.",
      },
      {
        title: "Trust wording guidance",
        body: "Help with putting the policy in trust so a payment does not wait on probate.",
      },
      {
        title: "Bereavement support",
        body: "Practical support for the people dealing with a claim, not just the payment itself.",
      },
    ],
    limitations: [
      "Non-disclosure of material facts — including health and lifestyle information — can affect whether a claim is paid.",
      "A claim from a non-accidental cause within the initial exclusion period stated in the policy is not covered.",
      "War and illegal activity exclusions apply.",
      "The sum assured is not investment-linked; it does not grow with the market or with inflation unless a specific option is selected.",
    ],
    beforeYouApply: [
      "The term you want cover for and the sum assured you need",
      "Age band and smoking status for the person insured",
      "Who should receive the benefit, and whether a trust is appropriate",
      "Full details of any health conditions, past or present",
      "Photo identification",
    ],
    pricing:
      "Indicative pricing reflects age band, smoking status, and the term length you choose, calculated from the published rating rules for the product. Health disclosures are assessed by an underwriter.",
    faqs: [
      {
        question: "How much cover do I need?",
        answer:
          "A common starting point is the outstanding mortgage plus a period of household income, alongside any other commitments. The right figure depends on your circumstances, and the application records the sum you choose.",
      },
      {
        question: "Why does putting a policy in trust matter?",
        answer:
          "A trust can allow the payment to reach the right people without waiting for probate. Guidance is included, and a qualified adviser should confirm what suits your situation.",
      },
      {
        question: "Is critical illness cover automatic?",
        answer:
          "No. It is an option that must be selected and accepted, and its definitions are set out in full in the policy wording.",
      },
    ],
  },
  {
    slug: "business",
    name: "Business insurance",
    productName: "Vault Business Liability",
    navLabel: "Business insurance",
    eyebrow: "Cover · Business",
    headline: "Liability cover for the business you've built.",
    intro:
      "Public and employers' liability for owner-managed businesses, with business interruption available and an account handler who knows the file.",
    metaDescription:
      "Business liability insurance from Cosmic Vault: public and employers' liability, business interruption, declared hazardous work, and how to start an application.",
    summary:
      "Liability cover for small businesses, rated on sector, headcount, and annual turnover.",
    suitableFor: [
      "Owner-managed businesses with a small team",
      "Professional services firms carrying client-facing risk",
      "Retail and hospitality businesses with premises to the public",
      "Contractors who need employers' liability to work for larger clients",
    ],
    coverageAreas: [
      {
        title: "Public liability",
        body: "Claims from third parties for injury or property damage connected with your business operations.",
      },
      {
        title: "Employers' liability",
        body: "Cover for claims brought by people who work for you, which many clients and landlords ask to see evidence of.",
      },
      {
        title: "Business interruption option",
        body: "Where selected, cover for lost trading following an insured event, on the basis set out in the policy.",
      },
      {
        title: "Legal expenses helpline",
        body: "Practical legal guidance when a dispute starts, before it becomes a claim.",
      },
    ],
    limitations: [
      "High-risk activities, including work at height beyond the limits stated in the product terms, are excluded.",
      "Hazardous substances and processes must be declared and may not be acceptable.",
      "Unlicensed or unvetted subcontractors are not covered.",
      "Turnover, headcount, and sector determine the terms and must be accurate at the time of the application.",
    ],
    beforeYouApply: [
      "Registered business name and company registration number",
      "Sector and a description of the work you actually carry out",
      "Number of employees, including labour-only subcontractors",
      "Annual turnover for the current period",
      "Company registration certificate, and a health and safety policy where you have one",
    ],
    pricing:
      "Indicative pricing reflects declared sector, number of employees, and annual turnover, calculated from the product's published rating rules. Complex or higher-risk operations are reviewed by an underwriter.",
    faqs: [
      {
        question: "Can you cover construction and trades work?",
        answer:
          "Construction is a configured sector, but the specific activities matter. Work at height or with hazardous substances must be declared, and some combinations fall outside the product terms.",
      },
      {
        question: "Is business interruption included?",
        answer:
          "It is an option within the product rather than a default inclusion. Ask for it during the quotation, and the schedule will state the basis if it is accepted.",
      },
      {
        question: "Do you provide a certificate for my client?",
        answer:
          "Evidence of employers' liability cover is issued with the policy documents once the application is approved and the policy is active.",
      },
    ],
  },
];

export function coverBySlug(slug: string) {
  return COVERS.find((cover) => cover.slug === slug);
}
