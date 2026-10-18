import type { FaqEntry } from "@/components/site/PageShell";
import {
  BookOpen,
  Calculator,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileSearch,
  FileText,
  FolderOpen,
  Handshake,
  HeartHandshake,
  Hourglass,
  Landmark,
  LifeBuoy,
  ListChecks,
  Lock,
  RefreshCw,
  Scale,
  ScrollText,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ContentBlock =
  | {
      kind: "cards";
      eyebrow?: string;
      title: string;
      intro?: string;
      tone?: "default" | "ice";
      columns?: 2 | 3;
      items: { title: string; body: string; icon?: LucideIcon }[];
    }
  | {
      kind: "steps";
      eyebrow?: string;
      title: string;
      intro?: string;
      tone?: "default" | "ice";
      steps: { title: string; body: string }[];
    }
  | {
      kind: "prose";
      eyebrow?: string;
      title: string;
      tone?: "default" | "ice";
      paragraphs?: string[];
      bullets?: { term: string; body: string }[];
    }
  | {
      kind: "callout";
      eyebrow?: string;
      title: string;
      body: string;
      tone?: "default" | "ice";
      severity?: "note" | "warning";
    }
  | {
      kind: "faqs";
      eyebrow?: string;
      title: string;
      intro?: string;
      tone?: "default" | "ice";
      items: FaqEntry[];
    };

export type ContentPageConfig = {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  metaDescription: string;
  aside: { title: string; body: string; items?: { label: string; href: string }[] };
  blocks: ContentBlock[];
  cta: {
    eyebrow: string;
    title: string;
    body: string;
    primary: { label: string; to: string };
    secondary?: { label: string; to: string };
  };
  related: { label: string; href: string; description?: string }[];
};

export const CONTENT_PAGES: Record<string, ContentPageConfig> = {
  "cover-understanding": {
    slug: "cover-understanding",
    eyebrow: "Cover · Understanding coverage",
    title: "What your cover actually does.",
    intro:
      "Insurance is a set of promises with conditions attached. Understanding four ideas — limit, excess, exclusion, and disclosure — explains most of what a policy does and what it does not.",
    metaDescription:
      "A plain-language guide to how insurance coverage works: limits, excesses, exclusions, disclosure, and how to read a policy schedule and wording.",
    aside: {
      title: "The four terms worth learning",
      body: "Limit, excess, exclusion, disclosure. If you understand those four, you understand the shape of nearly every policy decision.",
      items: [
        { label: "Coverage limits and exclusions", href: "/cover/limits-and-exclusions" },
        { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        title: "Four ideas explain most of it",
        intro:
          "None of these are tricks. They exist because a policy is a contract with boundaries, and the boundaries should be visible before you buy.",
        items: [
          {
            title: "The limit",
            icon: Calculator,
            body: "The most a policy will pay for a covered event, either per claim or in total. Anything above the limit is your own exposure.",
          },
          {
            title: "The excess",
            icon: CreditCard,
            body: "The first part of a claim you pay. A higher excess usually means a lower premium, and vice versa.",
          },
          {
            title: "The exclusion",
            icon: Scale,
            body: "An event or circumstance the policy does not cover at all. Exclusions are stated in the wording, not hidden in it.",
          },
          {
            title: "Disclosure",
            icon: FileCheck2,
            body: "Your duty to tell us the facts that affect the risk honestly and completely. Undisclosed facts can affect a claim.",
          },
          {
            title: "The condition",
            icon: ListChecks,
            body: "Something you must do — or avoid doing — for cover to apply, such as keeping a security system in use or declaring a change of use.",
          },
          {
            title: "The endorsement",
            icon: ScrollText,
            body: "A formal change to a policy after it starts, recorded against the file with a date and an author.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "Reading a policy",
        title: "Schedule first, then wording",
        paragraphs: [
          "Your schedule is the summary page: who is insured, what is insured, the period of cover, the limits, and the excess. It is short on purpose and worth reading carefully, because it is specific to you.",
          "The policy wording is the detail behind the schedule. It explains what each benefit means, what is excluded, and what you must do if something happens. Where the two appear to disagree, the wording and any endorsement on your file govern.",
        ],
      },
      {
        kind: "callout",
        title: "If a term is unclear, ask before you buy",
        body: "Nobody is expected to interpret policy drafting alone. Ask support to explain any wording in plain language, or ask us which exclusion would apply to a situation you are worried about.",
      },
      {
        kind: "faqs",
        title: "Common questions about coverage",
        items: [
          {
            question: "Does a higher premium mean better cover?",
            answer:
              "Not necessarily. Premium reflects the risk being insured and the features selected. Two policies at the same price can cover very different things, which is why the schedule and wording matter more than the number.",
          },
          {
            question: "Why is something I assumed was covered excluded?",
            answer:
              "Usually because it is either uninsurable in principle, priced separately, or would be declared incorrectly at the outset. If an exclusion is unclear, ask about your specific situation before applying.",
          },
          {
            question: "Can exclusions be removed?",
            answer:
              "Sometimes a specific activity or item can be added by endorsement if the product supports it. Where it cannot, we will say so rather than leave it ambiguous.",
          },
        ],
      },
    ],
    cta: {
      eyebrow: "Next step",
      title: "See what cover might cost.",
      body: "An indicative quotation uses the published rating rules for the product you choose. Nothing is approved and nothing is charged at this stage.",
      primary: { label: "Get a quote", to: "/quote" },
      secondary: { label: "Read about limits and exclusions", to: "/cover/limits-and-exclusions" },
    },
    related: [
      { label: "All insurance products", href: "/cover", description: "Every cover line in one place" },
      { label: "Applying for cover", href: "/how-it-works/apply", description: "What the application asks for" },
      { label: "Frequently asked questions", href: "/faqs", description: "Search every answer" },
    ],
  },

  "cover-limits": {
    slug: "cover-limits",
    eyebrow: "Cover · Limits and exclusions",
    title: "The parts worth reading twice.",
    intro:
      "Limits and exclusions decide what a policy does in the moments that matter. This page explains where to find them and how to check them against your own circumstances.",
    metaDescription:
      "How coverage limits, excesses, exclusions and policy conditions work, where to find them in your documents, and what to check before you apply.",
    aside: {
      title: "Where these live",
      body: "Limits, excesses and exclusions appear in three places: the product terms, the individual policy schedule, and the policy wording.",
      items: [
        { label: "Understanding your coverage", href: "/cover/understanding" },
        { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        columns: 2,
        title: "Five things to check before you buy",
        items: [
          {
            title: "The overall limit",
            icon: Calculator,
            body: "The maximum the policy will pay. Check it against the total value at risk, not against a typical claim.",
          },
          {
            title: "Single-item limits",
            icon: FileText,
            body: "Valuable individual items, such as jewellery, gadgets or specified equipment, are often limited separately from the total.",
          },
          {
            title: "The excess",
            icon: CreditCard,
            body: "What you pay before the policy responds, and whether a different excess applies to different sections or causes of loss.",
          },
          {
            title: "The exclusions",
            icon: Scale,
            body: "Events that are not covered at all. They are decisive, and they are listed in the wording rather than implied.",
          },
          {
            title: "The conditions",
            icon: ListChecks,
            body: "Steps you must take — declarations, safeguards, time limits for reporting — for a claim to be valid.",
          },
          {
            title: "Your own disclosures",
            icon: FileCheck2,
            body: "Whatever you declared forms the basis of cover. If your circumstances have changed, the record needs to change with it.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "Why exclusions exist",
        title: "A policy cannot price the whole world",
        paragraphs: [
          "Some events are excluded because no premium could sensibly cover them: war, deliberate loss, or ordinary wear. Others are excluded because they belong in a different product, like commercial delivery in a private motor policy.",
          "The practical test is simple. Before you buy, ask: what is the most likely thing to go wrong in this part of my life, and does this policy respond to it? If the answer is unclear, ask us directly.",
        ],
        bullets: [
          {
            term: "Not covered at all",
            body: "Stated exclusions. No amount of context changes the outcome.",
          },
          {
            term: "Covered up to a limit",
            body: "The claim is valid but the payment stops at the stated figure.",
          },
          {
            term: "Covered after an excess",
            body: "The claim is valid; the first portion is yours to pay.",
          },
          {
            term: "Covered only if declared",
            body: "The item or activity is insurable once it is properly recorded on the policy.",
          },
        ],
      },
      {
        kind: "callout",
        severity: "warning",
        title: "Product pages summarise; the wording governs",
        body: "The descriptions on our cover pages are editorial summaries of how each product is configured. They are not the contract. Your schedule, the policy wording, and any endorsement are what determine whether a claim is paid.",
      },
    ],
    cta: {
      eyebrow: "Ask us",
      title: "Not sure whether something is covered?",
      body: "Tell us the situation in your own words. We will tell you which exclusion or condition applies, and what information would need to be declared.",
      primary: { label: "Contact support", to: "/support/contact" },
      secondary: { label: "Frequently asked questions", to: "/faqs" },
    },
    related: [
      { label: "Understanding your coverage", href: "/cover/understanding" },
      { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      { label: "Help centre", href: "/help" },
    ],
  },

  "how-it-works": {
    slug: "how-it-works",
    eyebrow: "How it works",
    title: "A plain process, run by people.",
    intro:
      "Six steps from a first question to cover that is actually in force. Each one has a name, a record, and a person accountable for it.",
    metaDescription:
      "How Cosmic Vault works: quoting, applying, documents, manual underwriting, policy issue, and ongoing servicing explained step by step.",
    aside: {
      title: "What this page is not",
      body: "It is not a promise of approval, a turnaround guarantee, or a price commitment. It describes the process and who does what inside it.",
      items: [
        { label: "Getting a quote", href: "/quote" },
        { label: "Applying for cover", href: "/how-it-works/apply" },
      ],
    },
    blocks: [
      {
        kind: "steps",
        title: "The journey, end to end",
        steps: [
          {
            title: "Ask, or request a quote",
            body: "Send a quote request with what you want to protect, or start a full quotation in your vault. No obligation either way.",
          },
          {
            title: "Answer the product questions",
            body: "Every product has its own question set. Honest answers are what make a quotation usable later.",
          },
          {
            title: "Receive an indicative premium",
            body: "Calculated from the published rating rules for that product version. Indicative means exactly that — it is not a binding price.",
          },
          {
            title: "Apply and upload documents",
            body: "Convert the quotation into an application and attach what the product requires, such as identification or a registration document.",
          },
          {
            title: "Underwriting reviews it",
            body: "A person reviews the application, may request more information, and records a decision with the reasons.",
          },
          {
            title: "Cover is issued and serviced",
            body: "Once approved, the premium is paid and a policy is issued. Renewals, changes, claims and documents all stay on the same record.",
          },
        ],
      },
      {
        kind: "cards",
        tone: "ice",
        columns: 2,
        title: "The things we deliberately do",
        items: [
          {
            title: "Manual underwriting",
            icon: UserRound,
            body: "Decisions are made by a person against the product terms, not by an automated rule with no explanation attached.",
          },
          {
            title: "Recorded decisions",
            icon: FileCheck2,
            body: "Every status change, information request and decision is written to the record, including who made it and when.",
          },
          {
            title: "Plain-language documents",
            icon: BookOpen,
            body: "Your schedule, wording and correspondence live in one vault you can return to at any time.",
          },
          {
            title: "No invented urgency",
            icon: Hourglass,
            body: "We do not manufacture countdowns or fake scarcity. If something needs your attention, it will be because it genuinely does.",
          },
        ],
      },
      {
        kind: "prose",
        eyebrow: "Being straight with you",
        title: "What we will not claim",
        paragraphs: [
          "We will not tell you that an application will be approved, or that a premium is fixed before underwriting has reviewed the risk. We will not publish a settlement timeframe we cannot control, because a claim depends on evidence and third parties.",
          "What we will do is tell you the reason for a decision, tell you what information would change it, and keep the whole exchange on a record you can see.",
        ],
      },
      {
        kind: "faqs",
        title: "Questions about the process",
        items: [
          {
            question: "How long does underwriting take?",
            answer:
              "It depends on the product, the completeness of the application, and how quickly requested information arrives. Rather than publish a figure we cannot guarantee, we keep the status and any information request visible on the application itself.",
          },
          {
            question: "Can I withdraw an application?",
            answer:
              "Yes. A submitted application can be withdrawn, and the record shows that it was withdrawn rather than declined.",
          },
          {
            question: "What if I disagree with a decision?",
            answer:
              "You can respond with further information, and the decision reasons are recorded. If you remain unhappy, the complaints procedure sets out the formal route.",
          },
        ],
      },
    ],
    cta: {
      eyebrow: "Start",
      title: "Begin with a quotation.",
      body: "Answer the questions for the product you are considering and see an indicative premium. Nothing is charged until a policy is issued.",
      primary: { label: "Get a quote", to: "/quote" },
      secondary: { label: "How to apply", to: "/how-it-works/apply" },
    },
    related: [
      { label: "Applying for cover", href: "/how-it-works/apply" },
      { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      { label: "Renewals and policy changes", href: "/how-it-works/renewals" },
    ],
  },

  "how-it-works-apply": {
    slug: "how-it-works-apply",
    eyebrow: "How it works · Applying",
    title: "From quotation to policy.",
    intro:
      "An application is a fuller conversation than a quotation. It is where evidence, documents and disclosures come together so an underwriter can make a decision.",
    metaDescription:
      "How applying for insurance works at Cosmic Vault: converting a quotation, documents, disclosures, underwriting review, decisions and policy issue.",
    aside: {
      title: "Before you start",
      body: "Complete applications are decided faster. Gather identification, the documents the product lists, and the facts you need to disclose before you begin.",
      items: [
        { label: "Getting a quote", href: "/quote" },
        { label: "Your vault", href: "/auth?returnTo=%2Fdashboard" },
      ],
    },
    blocks: [
      {
        kind: "steps",
        title: "What happens, in order",
        steps: [
          {
            title: "Convert your quotation",
            body: "The quotation becomes a draft application with its product version, answers and premium attached.",
          },
          {
            title: "Complete the disclosures",
            body: "Answer the remaining questions fully, including anything that has changed since the quotation.",
          },
          {
            title: "Add the required documents",
            body: "The product lists what it needs. Uploads are attached to the application and to your document vault.",
          },
          {
            title: "Accept the terms and submit",
            body: "Submitting records your consent and moves the application into review. Nothing is submitted on your behalf.",
          },
          {
            title: "Answer any information request",
            body: "An underwriter may ask a specific question. You will see it on the application and can respond there.",
          },
          {
            title: "Decision, payment, policy",
            body: "If approved, the premium is confirmed, payment clears, and a policy is issued with its schedule and wording.",
          },
        ],
      },
      {
        kind: "cards",
        tone: "ice",
        columns: 2,
        title: "What you may be asked for",
        items: [
          {
            title: "Identification",
            icon: FileText,
            body: "Photo identification is standard, and the exact requirement is listed on the product you chose.",
          },
          {
            title: "Evidence about the risk",
            icon: FileSearch,
            body: "A vehicle registration document, proof of address, a company registration certificate, or a health summary.",
          },
          {
            title: "Honest disclosures",
            icon: FileCheck2,
            body: "Conditions, claims history, business activities, and anything else that would influence an underwriter.",
          },
          {
            title: "Payment details",
            icon: Wallet,
            body: "Premium payments are recorded against the application. Card or bank details are never requested over chat or email.",
          },
        ],
      },
      {
        kind: "callout",
        title: "Applying requires an account",
        body: "Quotations and applications are held against your record so you can return to them, upload documents securely, and see decisions and reasons. Sign in with your email to start or continue one.",
      },
      {
        kind: "faqs",
        title: "Questions about applying",
        items: [
          {
            question: "What happens if information is missing?",
            answer:
              "The application status changes to show that information is required, with the specific question attached. It stays open until you respond or withdraw it.",
          },
          {
            question: "Can I apply for someone else?",
            answer:
              "Only through a broker acting for that person, with their consent recorded. Brokers can prepare quotations and applications for customers assigned to them.",
          },
          {
            question: "When does cover actually start?",
            answer:
              "When a policy has been issued and its start date reached. An approved application that has not been paid for and issued is not yet cover.",
          },
        ],
      },
    ],
    cta: {
      eyebrow: "Ready",
      title: "Start with a quotation you can return to.",
      body: "Quotations are held on your record, so you can compare options and complete an application when it suits you.",
      primary: { label: "Get a quote", to: "/quote" },
      secondary: { label: "Sign in to your vault", to: "/auth?returnTo=%2Fdashboard" },
    },
    related: [
      { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      { label: "Coverage limits and exclusions", href: "/cover/limits-and-exclusions" },
      { label: "Payments and billing", href: "/claims/payments" },
    ],
  },

  "how-it-works-policy": {
    slug: "how-it-works-policy",
    eyebrow: "How it works · Your policy",
    title: "Where everything lives.",
    intro:
      "Once a policy is issued, three documents describe it: the schedule, the wording, and your own record of payments and correspondence. All three are held in your vault.",
    metaDescription:
      "Understand your policy documents: the schedule, policy wording, endorsements and certificates, and where to find each one in your vault.",
    aside: {
      title: "Find your documents",
      body: "Signed-in members can open every policy document, certificate and invoice from the document vault.",
      items: [
        { label: "Policy documents", href: "/claims/policy-documents" },
        { label: "Payments and billing", href: "/claims/payments" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        columns: 2,
        title: "The documents, and what each is for",
        items: [
          {
            title: "The schedule",
            icon: FileText,
            body: "Your policy in one page: insured parties, the things insured, limits, excess, dates, and the premium that applies.",
          },
          {
            title: "The policy wording",
            icon: ScrollText,
            body: "The full terms, including benefits, exclusions, conditions, and what to do after a loss. This is the contract.",
          },
          {
            title: "Endorsements",
            icon: RefreshCw,
            body: "Changes made after the policy started, each with a date, a summary, and the author who approved it.",
          },
          {
            title: "Certificates and evidence",
            icon: FileCheck2,
            body: "Evidence of cover for a landlord, client or authority, issued alongside your policy documents.",
          },
          {
            title: "Invoices and receipts",
            icon: Wallet,
            body: "Every premium, refund or settlement transaction, linked to the policy or claim it belongs to.",
          },
          {
            title: "Correspondence",
            icon: FolderOpen,
            body: "Notifications and support threads, kept with the record they relate to rather than scattered across inboxes.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "Keeping it current",
        title: "A policy is only accurate if you tell us when things change",
        paragraphs: [
          "Moving house, adding a driver, changing business activity, starting a new medication, or renovating a property can all change what the policy covers. None of those are reasons for concern, but all of them belong on the record.",
          "When you need something to change, request it against the policy. The change is reviewed, and only takes effect once it is recorded as approved — which means you will never be unsure whether cover was adjusted.",
        ],
      },
      {
        kind: "callout",
        title: "Documents stay available",
        body: "Nothing is deleted after a policy ends. Expired and cancelled policies keep their documents so you can evidence cover for a period that has passed.",
      },
    ],
    cta: {
      eyebrow: "Your vault",
      title: "Open your policy documents.",
      body: "Sign in to view, download and check the documents attached to every policy you hold.",
      primary: { label: "Open policy documents", to: "/claims/policy-documents" },
      secondary: { label: "Renewals and changes", to: "/how-it-works/renewals" },
    },
    related: [
      { label: "Policy documents", href: "/claims/policy-documents" },
      { label: "Make a claim", href: "/claims/make-a-claim" },
      { label: "Help centre", href: "/help" },
    ],
  },

  "how-it-works-renewals": {
    slug: "how-it-works-renewals",
    eyebrow: "How it works · Renewals and changes",
    title: "Nothing changes quietly.",
    intro:
      "Renewals and mid-term changes both follow the same principle: we show you the terms, you approve them, and the record changes only when that happens.",
    metaDescription:
      "How insurance renewals and policy changes work at Cosmic Vault: renewal notices, endorsements, cancellations, and what happens before cover changes.",
    aside: {
      title: "Types of change",
      body: "Address, vehicle, cover level, named parties, cancellation, or a temporary suspension — each is a request reviewed by a person.",
      items: [
        { label: "Understanding your policy", href: "/how-it-works/your-policy" },
        { label: "Payments and billing", href: "/claims/payments" },
      ],
    },
    blocks: [
      {
        kind: "steps",
        title: "How a renewal works",
        steps: [
          {
            title: "You are given notice",
            body: "Before the renewal date, and in line with the renewal notice period configured for the product.",
          },
          {
            title: "You review the terms",
            body: "The renewal shows the premium and any changes to the cover or the product version since last year.",
          },
          {
            title: "You confirm or adjust",
            body: "Ask for a change if your circumstances have moved on. Adjustments are reviewed before they apply.",
          },
          {
            title: "Payment is settled",
            body: "The renewal premium is recorded against the policy, with its status visible in your payments.",
          },
          {
            title: "Cover continues",
            body: "The policy is renewed with a new end date, and the documents are updated on the record.",
          },
          {
            title: "Or the policy lapses",
            body: "If a renewal is not completed, the policy reaches its end date. Nothing is renewed silently on your behalf.",
          },
        ],
      },
      {
        kind: "cards",
        tone: "ice",
        columns: 2,
        title: "Mid-term changes",
        items: [
          {
            title: "Endorsement",
            icon: RefreshCw,
            body: "A change to the cover itself — a new address, an added driver, a different contents level — recorded against the policy.",
          },
          {
            title: "Cancellation",
            icon: Scale,
            body: "Assessed against the policy conditions and notice period, with the outcome and any premium effect explained.",
          },
          {
            title: "Suspension",
            icon: Lock,
            body: "For a period when the risk does not exist — an empty property, a laid-up vehicle — where the product allows it.",
          },
          {
            title: "Renewal review",
            icon: ClipboardCheck,
            body: "A chance to correct anything that has drifted: an out-of-date sum insured, a change of use, a sold vehicle.",
          },
        ],
      },
      {
        kind: "callout",
        severity: "warning",
        title: "A request is not a change",
        body: "Asking for a change does not alter the policy. Cover changes only when the request is approved and the change is recorded. Until then, the existing terms apply.",
      },
    ],
    cta: {
      eyebrow: "Your vault",
      title: "Review your policies and requests.",
      body: "Sign in to see renewal dates, active policies, and the status of any change you have requested.",
      primary: { label: "Open my policies", to: "/auth?returnTo=%2Fdashboard%2Fpolicies" },
      secondary: { label: "Contact support", to: "/support/contact" },
    },
    related: [
      { label: "Payments and billing", href: "/claims/payments" },
      { label: "Understanding your policy", href: "/how-it-works/your-policy" },
      { label: "Frequently asked questions", href: "/faqs" },
    ],
  },

  "claims-payments": {
    slug: "claims-payments",
    eyebrow: "Claims & support · Payments and billing",
    title: "Every amount, accounted for.",
    intro:
      "Premiums, renewals, refunds and claim settlements are recorded as separate transactions, each linked to the policy, application or claim it belongs to.",
    metaDescription:
      "Payments and billing at Cosmic Vault: how premiums, renewals, refunds and claim settlements are recorded, and what to do when a payment fails.",
    aside: {
      title: "See your own records",
      body: "Signed-in members can view every transaction with its reference, method and status.",
      items: [
        { label: "Open payments in my vault", href: "/auth?returnTo=%2Fdashboard%2Fpayments" },
        { label: "Policy documents", href: "/claims/policy-documents" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        columns: 2,
        title: "What appears on your statement",
        items: [
          {
            title: "Premium payments",
            icon: CreditCard,
            body: "The amount due for a new policy, recorded against the application until the policy is issued.",
          },
          {
            title: "Renewals",
            icon: RefreshCw,
            body: "The renewal premium, with the due date and status visible so you can act before cover ends.",
          },
          {
            title: "Refunds",
            icon: Wallet,
            body: "Recorded as separate transactions linked to the original payment, and only after approval.",
          },
          {
            title: "Claim settlements",
            icon: LifeBuoy,
            body: "Settlement amounts are recorded against the claim they belong to, after a decision has been made.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "How to check a payment",
        title: "Three things to look at",
        paragraphs: [
          "Every transaction carries a reference, a method, and a status. If something looks wrong, those three details are what support needs to trace it.",
        ],
        bullets: [
          { term: "Status", body: "Pending, succeeded, failed, refunded, or disputed. Nothing is assumed to have cleared until it says so." },
          { term: "Reference", body: "Quote it in any support request. It is what links the query to the exact transaction." },
          { term: "Linked record", body: "The policy, application or claim the amount belongs to, so the payment is never floating on its own." },
        ],
      },
      {
        kind: "callout",
        title: "If a payment fails",
        body: "The transaction is marked failed with the reason recorded and a notification is raised. A policy that depends on an unpaid premium is not treated as active. Contact support if you are unsure which payment is outstanding — never send card details or security codes in a message.",
      },
    ],
    cta: {
      eyebrow: "Take a look",
      title: "Check your payment history.",
      body: "Sign in to see every amount, its status, and the record it belongs to.",
      primary: { label: "Open payments", to: "/auth?returnTo=%2Fdashboard%2Fpayments" },
      secondary: { label: "Contact support", to: "/support/contact" },
    },
    related: [
      { label: "Policy documents", href: "/claims/policy-documents" },
      { label: "Renewals and policy changes", href: "/how-it-works/renewals" },
      { label: "Report a problem", href: "/support/report" },
    ],
  },

  "support-report": {
    slug: "support-report",
    eyebrow: "Support · Report a problem",
    title: "Tell us what went wrong.",
    intro:
      "A problem reported early is usually a problem that stays small. This page explains what to include and what happens next.",
    metaDescription:
      "How to report a problem to Cosmic Vault: what to include, how reports are handled, security guidance, and how to escalate a complaint.",
    aside: {
      title: "Escalating further",
      body: "If a problem is not resolved, the complaints procedure sets out the formal route and what we will do with it.",
      items: [
        { label: "Complaints procedure", href: "/legal/complaints" },
        { label: "Contact support", href: "/support/contact" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        columns: 2,
        title: "What people report",
        items: [
          {
            title: "A problem with the website",
            icon: BookOpen,
            body: "A broken page, a link that goes nowhere, a form that will not submit, or something that does not display correctly on your device.",
          },
          {
            title: "Incorrect information",
            icon: FileCheck2,
            body: "A record that does not match your details, a document that is wrong, or a payment figure that looks incorrect.",
          },
          {
            title: "Service that fell short",
            icon: Handshake,
            body: "A request that was not answered, an explanation that was unclear, or handling you feel was not fair.",
          },
          {
            title: "A security concern",
            icon: Lock,
            body: "A suspicious message, an unexpected sign-in attempt, or anything that makes you doubt a communication is genuine.",
          },
        ],
      },
      {
        kind: "steps",
        title: "What to include",
        steps: [
          {
            title: "Where it happened",
            body: "The page, the record reference, or the policy, claim or payment involved.",
          },
          {
            title: "What you expected",
            body: "A sentence on what should have happened is more useful than a description of the problem alone.",
          },
          {
            title: "When it happened",
            body: "The date and approximate time help trace the record and any notification raised at that moment.",
          },
          {
            title: "What you have seen",
            body: "A screenshot or the exact wording of an error helps enormously. Redact anything personal before attaching it.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "After you report",
        title: "What happens next",
        paragraphs: [
          "Signed-in members raise problems as a support request, which creates a reference and keeps the whole thread with the record it concerns. That means the person picking it up can see the context rather than starting from scratch.",
          "If the problem is a complaint about our service or a decision, it is handled under the complaints procedure, which explains what we do and how to escalate if you are still unhappy.",
        ],
      },
      {
        kind: "callout",
        severity: "warning",
        title: "Never send sensitive credentials",
        body: "We will never ask for your one-time sign-in code, card numbers, or full bank credentials in a message. If someone claiming to be Cosmic Vault asks for those, treat it as fraudulent and report it.",
      },
    ],
    cta: {
      eyebrow: "Report it",
      title: "Raise a support request.",
      body: "Signed-in members can open a request, attach the record it relates to, and follow every reply in one place.",
      primary: { label: "Contact support", to: "/support/contact" },
      secondary: { label: "Open the help centre", to: "/help" },
    },
    related: [
      { label: "Contact support", href: "/support/contact" },
      { label: "Complaints procedure", href: "/legal/complaints" },
      { label: "Help centre", href: "/help" },
    ],
  },

  about: {
    slug: "about",
    eyebrow: "About · Our story",
    title: "Built for the long horizon.",
    intro:
      "Cosmic Vault is a working insurance platform: products, applications, underwriting, policies, claims and payments in one record. It exists because the ordinary experience of buying cover is worse than it needs to be.",
    metaDescription:
      "Why Cosmic Vault exists: a working insurance platform built around clear wording, manual underwriting, and a single record for the whole life of a policy.",
    aside: {
      title: "A note on this site",
      body: "Cosmic Vault is a demonstration platform. Company history, registration details and regulatory authorisation are not published until they are verified.",
      items: [
        { label: "Regulatory information", href: "/legal/regulatory" },
        { label: "Our principles", href: "/about/principles" },
      ],
    },
    blocks: [
      {
        kind: "prose",
        title: "Why we started",
        paragraphs: [
          "Insurance is one of the few products people buy hoping never to use it, and one of the few where the moment of use is the moment they are least able to argue. That asymmetry is the whole problem: everything is decided at the point of sale and tested at the point of loss.",
          "Cosmic Vault is built the other way around. The product configuration, the questions asked, the disclosure record, the underwriting decision and the claim all sit on one timeline. Nothing important lives only in a call recording or a PDF in an inbox.",
          "We are not trying to be the cheapest or the loudest. We are trying to be the insurer whose documents make sense when it counts, and whose process is legible from beginning to end.",
        ],
      },
      {
        kind: "cards",
        tone: "ice",
        title: "What is actually built today",
        intro:
          "This is the current state of the platform, described accurately rather than aspirationally.",
        items: [
          {
            title: "Six cover lines",
            icon: Landmark,
            body: "Motor, health, life, home, travel and business products, configured with their own questions, rating rules, limits and exclusions.",
          },
          {
            title: "Manual underwriting",
            icon: UserRound,
            body: "Applications are reviewed by a person, with information requests and decisions recorded against the file.",
          },
          {
            title: "End-to-end records",
            icon: FileCheck2,
            body: "Quotations, applications, policies, claims, payments and documents linked together instead of existing in isolation.",
          },
          {
            title: "Role-based access",
            icon: Lock,
            body: "Customers, brokers, and staff see different things. Permissions are enforced on the server, not merely hidden in the interface.",
          },
          {
            title: "Broker workflows",
            icon: Handshake,
            body: "Brokers work with assigned customers, with consent recorded before a quotation is prepared on someone's behalf.",
          },
          {
            title: "Audit trail",
            icon: ListChecks,
            body: "Privileged actions are written to an audit log with the actor, the before and after state, and the reason.",
          },
        ],
      },
      {
        kind: "callout",
        title: "What is not built yet",
        body: "Self-service that goes beyond the current flows, automated claim decisions, and any published regulatory status. Where a feature does not exist, we say so on the relevant page rather than pretending the interaction worked.",
      },
    ],
    cta: {
      eyebrow: "Get to know us",
      title: "Read the standards we hold ourselves to.",
      body: "Our principles describe what we do when a decision is difficult, and where we think the industry usually gets it wrong.",
      primary: { label: "Our principles", to: "/about/principles" },
      secondary: { label: "Contact us", to: "/contact" },
    },
    related: [
      { label: "Our principles", href: "/about/principles" },
      { label: "Our commitment to customers", href: "/about/commitment" },
      { label: "Broker partnerships", href: "/about/brokers" },
    ],
  },

  "about-principles": {
    slug: "about-principles",
    eyebrow: "About · Our principles",
    title: "How we behave when it's difficult.",
    intro:
      "Principles only matter when they cost something. These are the standards we hold to when a decision is uncomfortable, a claim is contested, or a customer is frustrated.",
    metaDescription:
      "The principles behind Cosmic Vault: plain language, decisions with reasons, honest marketing, careful underwriting, and a fair process for disputes.",
    aside: {
      title: "Applied, not framed",
      body: "Each principle below describes something concrete that happens on this platform today.",
      items: [
        { label: "Our commitment to customers", href: "/about/commitment" },
        { label: "Our story", href: "/about" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        title: "Six principles",
        items: [
          {
            title: "Plain language over polish",
            icon: BookOpen,
            body: "If a sentence exists to protect us rather than inform you, it should be rewritten or removed. Marketing summaries never replace the wording.",
          },
          {
            title: "Decisions come with reasons",
            icon: FileCheck2,
            body: "A declined application or claim states why, and says what information would change the outcome. A refusal without an explanation is not a decision, it is an exit.",
          },
          {
            title: "No invented certainty",
            icon: Scale,
            body: "No guaranteed approvals, no settlement stopwatches, no fabricated member numbers. If we cannot verify a claim, it does not appear on the site.",
          },
          {
            title: "Underwriting is human",
            icon: UserRound,
            body: "Edge cases are where care matters most, so a person reviews them. Automation should remove drudgery, not accountability.",
          },
          {
            title: "Access is enforced properly",
            icon: Lock,
            body: "Privileged routes are protected on the server. Hiding a menu item is presentation, not security, and we treat it as such.",
          },
          {
            title: "Disagreement has a route",
            icon: Scale,
            body: "You can dispute a decision with information, and escalate under the complaints procedure. Neither route is a dead end.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "In practice",
        title: "What these principles changed",
        paragraphs: [
          "They are why this site has no price promise on a landing page, why product pages describe coverage areas qualitatively and defer to the wording, and why the regulatory page says clearly that no authorisation is published rather than inventing a reference number.",
          "They are also why privacy, accessibility and complaints pages exist as real documents with a visible draft status, instead of footnote links that go nowhere.",
        ],
      },
    ],
    cta: {
      eyebrow: "Questions",
      title: "Ask us to justify any of this.",
      body: "If a principle sounds like a slogan, ask for the behaviour behind it. We would rather be challenged than decorative.",
      primary: { label: "Contact us", to: "/contact" },
      secondary: { label: "Our commitment to customers", to: "/about/commitment" },
    },
    related: [
      { label: "Our commitment to customers", href: "/about/commitment" },
      { label: "Regulatory information", href: "/legal/regulatory" },
      { label: "Accessibility statement", href: "/legal/accessibility" },
    ],
  },

  "about-commitment": {
    slug: "about-commitment",
    eyebrow: "About · Our commitment to customers",
    title: "What you can hold us to.",
    intro:
      "A commitment is only meaningful if it is specific. These are the promises we can keep today, and the ones we will not make because we cannot guarantee them.",
    metaDescription:
      "Cosmic Vault's customer commitments: clear documents, recorded decisions, protected data, fair changes, and an honest account of what we cannot yet do.",
    aside: {
      title: "Where to take it",
      body: "If we fall short of any of these, report it. Complaints are handled under a documented procedure.",
      items: [
        { label: "Report a problem", href: "/support/report" },
        { label: "Complaints procedure", href: "/legal/complaints" },
      ],
    },
    blocks: [
      {
        kind: "cards",
        columns: 2,
        title: "What we commit to",
        items: [
          {
            title: "Documents you can read",
            icon: FileText,
            body: "Schedules and wording in plain language, held on your record and available whenever you need them — including after a policy ends.",
          },
          {
            title: "Decisions with reasons",
            icon: ClipboardCheck,
            body: "Every decision on an application or claim is recorded with its reason and the person accountable for it.",
          },
          {
            title: "Your data, protected",
            icon: Lock,
            body: "Records are visible only to you, to staff with the relevant permission, and to a broker assigned to you. That is enforced on the server.",
          },
          {
            title: "Changes that wait for approval",
            icon: RefreshCw,
            body: "A policy is never altered silently. Requests are reviewed, and the change takes effect only once it is recorded as approved.",
          },
          {
            title: "Honest marketing",
            icon: HeartHandshake,
            body: "No invented statistics, awards, testimonials or regulatory claims anywhere on this site.",
          },
          {
            title: "Access to a person",
            icon: LifeBuoy,
            body: "Every automated shortcut has a route to a human, including when you want to question a decision or a figure.",
          },
        ],
      },
      {
        kind: "prose",
        tone: "ice",
        eyebrow: "Being honest",
        title: "What we will not promise",
        paragraphs: [
          "We will not promise that an application will be accepted. We will not promise a claim outcome, a settlement timeframe, or a price that underwriting has not yet reviewed.",
          "We will not claim a regulatory approval, a company registration, a physical office, or a partnership that has not been verified. Where those details are genuinely missing, this site says so and the regulatory page explains what will be published once verified.",
        ],
      },
    ],
    cta: {
      eyebrow: "Hold us to it",
      title: "Tell us when we get it wrong.",
      body: "A reported problem is treated as a defect to fix, not an inconvenience to manage. That is the point of the commitment.",
      primary: { label: "Report a problem", to: "/support/report" },
      secondary: { label: "Complaints procedure", to: "/legal/complaints" },
    },
    related: [
      { label: "Our principles", href: "/about/principles" },
      { label: "Complaints procedure", href: "/legal/complaints" },
      { label: "Privacy notice", href: "/legal/privacy" },
    ],
  },
};

export function contentPage(slug: keyof typeof CONTENT_PAGES | string) {
  return CONTENT_PAGES[slug];
}
