export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalPageConfig = {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  metaDescription: string;
  status: "draft" | "verified";
  sections: LegalSection[];
};

/**
 * Draft trust and legal pages.
 *
 * Nothing here has been approved by a qualified legal adviser, and none of it
 * asserts a regulatory status, company registration, or jurisdiction that has
 * been verified. Each page is published with a visible draft notice and must
 * pass legal review before launch.
 */
export const LEGAL_PAGES: Record<string, LegalPageConfig> = {
  terms: {
    slug: "terms",
    eyebrow: "Legal · Terms and conditions",
    title: "Terms and conditions",
    intro:
      "These terms describe how this website and the Cosmic Vault platform may be used. They sit alongside, and do not replace, the terms of any insurance policy you hold.",
    metaDescription:
      "Draft terms and conditions for the Cosmic Vault website and platform, pending legal review.",
    status: "draft",
    sections: [
      {
        heading: "1. About these terms",
        paragraphs: [
          "These terms govern access to and use of this website and the Cosmic Vault platform. By using the platform you agree to them. If you do not agree, please do not use the platform.",
          "These terms are a working draft. Governing law, jurisdiction, and the identity of the contracting entity are deliberately left unstated because they have not been confirmed, and inventing them would be misleading.",
        ],
      },
      {
        heading: "2. What this site is for",
        paragraphs: [
          "The site explains our products and lets visitors request a quotation, apply for cover where they hold an account, and manage an existing policy. Descriptions of cover on marketing pages are summaries only.",
        ],
        bullets: [
          "Product pages describe how a product is configured. They are not the contract of insurance.",
          "The policy schedule, policy wording, and any endorsement on your file determine what is covered.",
          "Nothing on this site is financial, legal, or tax advice.",
        ],
      },
      {
        heading: "3. Quotations and applications",
        paragraphs: [
          "Any premium shown before underwriting review is indicative. It is calculated from the published rating rules for a specific product version and can change if your answers change or the product version changes.",
        ],
        bullets: [
          "A quotation is not an offer of cover and does not oblige us to accept an application.",
          "Applications are subject to underwriting review, and a decision may be declined with reasons recorded.",
          "Cover begins only when a policy has been issued and its start date has been reached.",
          "Quotations expire after the validity period stated on the quotation itself.",
        ],
      },
      {
        heading: "4. Your responsibilities",
        bullets: [
          "Provide accurate, complete information when requesting a quotation or applying for cover.",
          "Tell us promptly when anything material changes - a change of address, use, driver, business activity, or declared condition.",
          "Keep your sign-in email secure and tell us if you believe someone else has access to it.",
          "Do not attempt to access records that are not yours, or to interfere with the platform's operation.",
        ],
      },
      {
        heading: "5. Payments",
        paragraphs: [
          "Premium payments, renewals, refunds, and claim settlements are recorded against the policy, application, or claim they belong to. A policy that depends on an unpaid premium is not treated as active.",
          "Approved contact and payment details will be published on the regulatory information page once verified. Until then, no bank details should be treated as authentic Cosmic Vault details.",
        ],
      },
      {
        heading: "6. Availability and changes",
        paragraphs: [
          "We aim to keep the platform available, but we do not guarantee uninterrupted access. Content, product configuration, and these terms may change; material changes will be reflected in the version published here.",
        ],
      },
      {
        heading: "7. Liability",
        paragraphs: [
          "Nothing in these terms excludes liability that cannot lawfully be excluded. Beyond that, the extent of liability for use of this website, and the jurisdiction in which disputes are heard, have not been settled and require legal review before publication.",
        ],
      },
      {
        heading: "8. Complaints",
        paragraphs: [
          "If you are unhappy with our service or a decision, the complaints procedure sets out how to raise it and what happens next.",
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    eyebrow: "Legal · Privacy notice",
    title: "Privacy notice",
    intro:
      "This notice describes the personal data the platform holds, why it is held, and what you can ask us to do with it. It is a draft and requires legal approval.",
    metaDescription:
      "Draft privacy notice describing the personal data Cosmic Vault holds, why it is processed, and what rights you can exercise.",
    status: "draft",
    sections: [
      {
        heading: "What we hold",
        bullets: [
          "Account details: your email address, display name, role, and sign-in history.",
          "Quotation and application details: answers about the risk being insured, and any documents you upload.",
          "Policy and claim records: the schedule, limits, decisions, and correspondence attached to them.",
          "Payment records: amounts, references, methods, and statuses. Card numbers are not stored by the platform.",
          "Support records: enquiries, replies, and any records linked to them.",
          "Technical data necessary to operate the service securely, such as session information.",
        ],
      },
      {
        heading: "Why we hold it",
        paragraphs: [
          "To provide quotations, assess applications, issue and service policies, assess claims, process payments, answer support enquiries, and meet record-keeping obligations. Some processing is necessary to enter into and perform a contract of insurance; some is necessary to comply with legal obligations; some relies on our legitimate interest in operating a secure service.",
          "The lawful basis for each processing activity will be confirmed and published here as part of legal review. This notice does not currently state a basis for any activity.",
        ],
      },
      {
        heading: "Who can see it",
        bullets: [
          "You, through your vault.",
          "Authorised staff, restricted by role and per-record permissions enforced on the server.",
          "A broker assigned to you, where you have consented to that relationship, and only for the customers assigned to them.",
          "Service providers acting under instruction to operate the platform, once those relationships are documented.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Policy, claim, and payment records are kept for as long as they may be needed to evidence cover or answer a question about it. Retention periods will be set out here in full once confirmed. Nothing is deleted simply because a policy has ended.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "Subject to applicable law, you can ask for a copy of your personal data, ask for inaccurate data to be corrected, ask for data to be erased where there is no overriding obligation to keep it, and object to certain processing.",
          "Contact support to make a request. We will explain what verification is needed and how the request will be handled.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Access to records is enforced on the server rather than in the interface, and privileged actions are written to an audit log. We will never ask for your one-time sign-in code in a message.",
        ],
      },
    ],
  },

  cookies: {
    slug: "cookies",
    eyebrow: "Legal · Cookie policy",
    title: "Cookie policy",
    intro:
      "This policy describes the cookies and local storage the platform uses. It lists what exists today rather than a template list of tracking technologies we do not use.",
    metaDescription:
      "Draft cookie policy describing the cookies and browser storage used by the Cosmic Vault platform.",
    status: "draft",
    sections: [
      {
        heading: "What is used today",
        bullets: [
          "A session cookie that keeps you signed in after verifying a one-time code. Without it, you would be signed out on every page.",
          "Browser local storage that remembers your light or dark theme preference.",
          "Browser local storage used by the dashboard interface to remember minor interface state, such as a collapsed sidebar.",
        ],
      },
      {
        heading: "What is not used today",
        paragraphs: [
          "No advertising cookies, no cross-site tracking pixels, and no third-party analytics are configured on this platform. If that changes, this page will list each tool, what it collects, and how to refuse it before it is enabled.",
        ],
      },
      {
        heading: "Managing them",
        paragraphs: [
          "You can clear cookies and site storage at any time in your browser settings. Clearing the session cookie will sign you out, and clearing local storage will reset interface preferences such as the theme.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "Where a future change introduces non-essential cookies, we will ask for consent before they are set and record that choice.",
        ],
      },
    ],
  },

  accessibility: {
    slug: "accessibility",
    eyebrow: "Legal · Accessibility statement",
    title: "Accessibility statement",
    intro:
      "We want everyone to be able to read our documents, understand our products, and complete an application without unnecessary obstacles. This statement records where we are and what is planned.",
    metaDescription:
      "Accessibility statement for the Cosmic Vault website and platform, including current measures, known limitations and how to report a barrier.",
    status: "draft",
    sections: [
      {
        heading: "What we have done",
        bullets: [
          "Semantic HTML landmarks, headings, and lists, so assistive technology can navigate the page structure.",
          "Keyboard-operable navigation, including the mega menus, with Escape to close and focus returned to the control that opened them.",
          "Visible focus styles throughout, and skip-to-content links on public pages.",
          "Text alternatives for decorative imagery marked as presentational, and accessible names for icon-only controls.",
          "Reduced-motion support: interface transitions are suppressed when your system requests it.",
          "Colour contrast checked against the design tokens in both light and dark themes.",
        ],
      },
      {
        heading: "Known limitations",
        bullets: [
          "This platform has not yet been through an independent accessibility audit, and we do not claim conformance with a specific standard until one has been completed.",
          "Some third-party components may not yet meet every criterion we would set ourselves.",
          "Documents issued as policy paperwork are produced by the platform and will be reviewed for readability as part of the same programme of work.",
        ],
      },
      {
        heading: "Reporting a barrier",
        paragraphs: [
          "If something prevents you from using the site - a control you cannot reach, text you cannot read, or a form you cannot complete - report it. Where a barrier cannot be removed quickly, we will find another way to give you the information or complete the task.",
        ],
      },
    ],
  },

  complaints: {
    slug: "complaints",
    eyebrow: "Legal · Complaints procedure",
    title: "Complaints procedure",
    intro:
      "If you are unhappy with our service or with a decision we have made, this is how to raise it and what happens next.",
    metaDescription:
      "How to raise a complaint with Cosmic Vault, what to include, how it is handled, and how to escalate if you remain dissatisfied.",
    status: "draft",
    sections: [
      {
        heading: "How to raise a complaint",
        bullets: [
          "Signed-in members can open a support request, choosing the complaint category so it is flagged as high priority from the start.",
          "Include the policy, claim, application, or payment reference the complaint concerns.",
          "Describe what happened, what you expected, and what outcome you are looking for.",
          "Attach anything that supports it - correspondence, documents, or screenshots.",
        ],
      },
      {
        heading: "What happens next",
        paragraphs: [
          "Your complaint is recorded as a support request and reviewed by a person. We will confirm we have it, ask for anything missing, and explain the position in writing.",
          "We do not publish a fixed resolution deadline here, because a timeline we cannot control would be a promise we might break. If a complaint depends on a third party, we will say so and keep you updated on the record.",
        ],
      },
      {
        heading: "If you remain dissatisfied",
        paragraphs: [
          "Tell us. A complaint can be escalated for a further review, and we will explain the reasoning behind the outcome.",
          "Referral to an external ombudsman or regulator requires a verified, authorised entity and is not available while the platform's regulatory status is unpublished. That referral route will be documented on this page, with the correct body named, once the position is confirmed.",
        ],
      },
      {
        heading: "Records",
        paragraphs: [
          "Complaints, replies, and outcomes are kept with the record they concern, so nothing depends on a single person's memory.",
        ],
      },
    ],
  },

  regulatory: {
    slug: "regulatory",
    eyebrow: "Legal · Regulatory and company information",
    title: "Regulatory and company information",
    intro:
      "This page is where company registration, registered office, regulatory status, and approved contact details belong. None of them are published yet, and this page says so rather than inventing them.",
    metaDescription:
      "The current verified status of Cosmic Vault's company registration, regulatory authorisation and contact details, with what will be published once confirmed.",
    status: "draft",
    sections: [
      {
        heading: "Current status: nothing published",
        paragraphs: [
          "Cosmic Vault is a demonstration insurance platform built as a product concept. It does not currently publish a company registration number, a registered office address, a regulatory authorisation or firm reference number, or an approved telephone number or contact address.",
          "Earlier versions of this site displayed a firm reference number, a London address, and a telephone number. Those were illustrative placeholder values, not verified details, and they have been removed.",
        ],
      },
      {
        heading: "What belongs on this page",
        bullets: [
          "The legal name of the entity that contracts with customers, and any trading names in use.",
          "Company registration number and registered office address, verified against the relevant register.",
          "Regulatory authorisation status, the authorising body, and the firm reference number, verified against the regulator's own register.",
          "The scope of permissions actually held, and any limitations or territorial restrictions.",
          "Approved contact details for customers, complaints, and data protection enquiries.",
          "Details of any professional indemnity or financial protection arrangements where required.",
        ],
      },
      {
        heading: "What will not be published",
        bullets: [
          "Any approval, registration, award, partnership, or accreditation that has not been verified against its primary source.",
          "Any statement implying authorisation to carry on regulated activity before that authorisation exists.",
          "Any contact detail that does not reach a monitored, approved channel.",
        ],
      },
      {
        heading: "Why this matters",
        paragraphs: [
          "Insurance customers make decisions on the strength of exactly this information. Publishing an unverified registration or authorisation claim would be a misrepresentation, so until each item is confirmed it stays off the site.",
        ],
      },
      {
        heading: "Before launch",
        paragraphs: [
          "This page must be completed and approved before the platform is offered to the public, and the placeholder-values note above must be removed at that point.",
        ],
      },
    ],
  },
};

export function legalPage(slug: string) {
  return LEGAL_PAGES[slug];
}

export const LEGAL_SLUGS = Object.keys(LEGAL_PAGES);
