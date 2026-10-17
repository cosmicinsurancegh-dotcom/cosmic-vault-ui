import {
  BookOpen,
  Briefcase,
  Car,
  CircleHelp,
  ClipboardList,
  Compass,
  CreditCard,
  FileSearch,
  FolderOpen,
  Handshake,
  Headset,
  HeartHandshake,
  HeartPulse,
  House,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessageSquareWarning,
  MessagesSquare,
  Plane,
  RefreshCw,
  Scale,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type MenuLink = {
  label: string;
  href: string;
  description?: string;
  icon?: LucideIcon;
};

export type MenuGroup = {
  title: string;
  links: MenuLink[];
};

export type MenuFeature = {
  eyebrow: string;
  title: string;
  body: string;
  primary: MenuLink;
  secondary?: MenuLink;
};

export type NavSection = {
  id: string;
  label: string;
  href: string;
  match: string[];
  groups: MenuGroup[];
  feature: MenuFeature;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "cover",
    label: "Cover",
    href: "/cover",
    match: ["/cover"],
    groups: [
      {
        title: "Explore cover",
        links: [
          {
            label: "All insurance products",
            href: "/cover",
            description: "The full catalogue at a glance",
            icon: LayoutGrid,
          },
          {
            label: "Home insurance",
            href: "/cover/home",
            description: "Buildings and contents",
            icon: House,
          },
          {
            label: "Motor insurance",
            href: "/cover/motor",
            description: "Comprehensive private car cover",
            icon: Car,
          },
          {
            label: "Travel insurance",
            href: "/cover/travel",
            description: "Single trips and annual cover",
            icon: Plane,
          },
          {
            label: "Health insurance",
            href: "/cover/health",
            description: "Private medical and wellbeing",
            icon: HeartPulse,
          },
          {
            label: "Life and family protection",
            href: "/cover/life",
            description: "Long-horizon protection",
            icon: HeartHandshake,
          },
          {
            label: "Business insurance",
            href: "/cover/business",
            description: "Liability and interruption",
            icon: Briefcase,
          },
        ],
      },
      {
        title: "Choose your cover",
        links: [
          {
            label: "Understanding your coverage",
            href: "/cover/understanding",
            description: "What policies actually do",
            icon: BookOpen,
          },
          {
            label: "Coverage limits and exclusions",
            href: "/cover/limits-and-exclusions",
            description: "The parts worth reading twice",
            icon: Scale,
          },
          {
            label: "Frequently asked questions",
            href: "/faqs",
            description: "Straight answers, no jargon",
            icon: CircleHelp,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Start here",
      title: "A quote, not a sales call.",
      body: "Tell us what you want to protect. An advisor reviews every request and the final terms always come from the policy wording.",
      primary: { label: "Get a quote", href: "/quote" },
      secondary: { label: "How cover is priced", href: "/how-it-works" },
    },
  },
  {
    id: "how-it-works",
    label: "How It Works",
    href: "/how-it-works",
    match: ["/how-it-works", "/quote"],
    groups: [
      {
        title: "The customer journey",
        links: [
          {
            label: "Our approach to insurance",
            href: "/how-it-works",
            description: "Calm, clear, and manual where it matters",
            icon: Compass,
          },
          {
            label: "Getting a quote",
            href: "/quote",
            description: "What we ask and why",
            icon: FileSearch,
          },
          {
            label: "Applying for cover",
            href: "/how-it-works/apply",
            description: "From quotation to policy",
            icon: ClipboardList,
          },
          {
            label: "Understanding your policy",
            href: "/how-it-works/your-policy",
            description: "Schedule, wording, and limits",
            icon: ScrollText,
          },
          {
            label: "Renewals and policy changes",
            href: "/how-it-works/renewals",
            description: "Keeping cover up to date",
            icon: RefreshCw,
          },
          {
            label: "Frequently asked questions",
            href: "/faqs",
            description: "The things people ask most",
            icon: CircleHelp,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "No surprises",
      title: "Underwriting stays human.",
      body: "Applications are reviewed by a person. We do not promise automatic approval, and an indicative premium is never a binding price.",
      primary: { label: "Start with a quote", href: "/quote" },
      secondary: { label: "Read the FAQs", href: "/faqs" },
    },
  },
  {
    id: "claims-support",
    label: "Claims & Support",
    href: "/claims",
    match: ["/claims", "/support", "/help", "/faqs"],
    groups: [
      {
        title: "Claims",
        links: [
          {
            label: "Claims overview",
            href: "/claims",
            description: "How the process works",
            icon: ShieldCheck,
          },
          {
            label: "Make a claim",
            href: "/claims/make-a-claim",
            description: "What to gather before you start",
            icon: LifeBuoy,
          },
          {
            label: "Track a claim",
            href: "/claims/track",
            description: "Sign in to view live progress",
            icon: FileSearch,
          },
          {
            label: "Policy documents",
            href: "/claims/policy-documents",
            description: "Sign in to your document vault",
            icon: FolderOpen,
          },
          {
            label: "Payments and billing",
            href: "/claims/payments",
            description: "Premiums, renewals and refunds",
            icon: CreditCard,
          },
        ],
      },
      {
        title: "Support",
        links: [
          {
            label: "Help centre",
            href: "/help",
            description: "Guides by topic",
            icon: MessagesSquare,
          },
          {
            label: "Frequently asked questions",
            href: "/faqs",
            description: "Search every answer",
            icon: CircleHelp,
          },
          {
            label: "Contact support",
            href: "/support/contact",
            description: "Reach a person",
            icon: Headset,
          },
          {
            label: "Report a problem",
            href: "/support/report",
            description: "Tell us what went wrong",
            icon: MessageSquareWarning,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "A real person",
      title: "Support that stays with the record.",
      body: "Support requests are held separately from claim decisions and payments. Signed-in members can follow every update in their vault.",
      primary: { label: "Contact support", href: "/support/contact" },
      secondary: { label: "Open the help centre", href: "/help" },
    },
  },
  {
    id: "about",
    label: "About",
    href: "/about",
    match: ["/about", "/contact"],
    groups: [
      {
        title: "Cosmic Vault",
        links: [
          {
            label: "Our story",
            href: "/about",
            description: "Why the vault exists",
            icon: BookOpen,
          },
          {
            label: "Our principles",
            href: "/about/principles",
            description: "The standards we hold",
            icon: ShieldCheck,
          },
          {
            label: "Our commitment to customers",
            href: "/about/commitment",
            description: "Plain language and fair process",
            icon: HeartHandshake,
          },
          {
            label: "Broker partnerships",
            href: "/about/brokers",
            description: "Working with intermediaries",
            icon: Handshake,
          },
          {
            label: "Contact us",
            href: "/contact",
            description: "How to get in touch",
            icon: Mail,
          },
        ],
      },
      {
        title: "Trust and governance",
        links: [
          {
            label: "Regulatory information",
            href: "/legal/regulatory",
            description: "Company and permissions status",
            icon: Landmark,
          },
          {
            label: "Accessibility statement",
            href: "/legal/accessibility",
            description: "How we approach access",
            icon: BookOpen,
          },
          {
            label: "Complaints procedure",
            href: "/legal/complaints",
            description: "If something goes wrong",
            icon: Scale,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Long horizon",
      title: "Insurance for the long horizon.",
      body: "We are building for the decades, not the quarter. That means clear wording, careful decisions, and service that does not disappear after the sale.",
      primary: { label: "Read our story", href: "/about" },
      secondary: { label: "Broker partnerships", href: "/about/brokers" },
    },
  },
];

export const FOOTER_COLUMNS: { title: string; links: MenuLink[] }[] = [
  {
    title: "Explore cover",
    links: [
      { label: "All products", href: "/cover" },
      { label: "Home insurance", href: "/cover/home" },
      { label: "Motor insurance", href: "/cover/motor" },
      { label: "Travel insurance", href: "/cover/travel" },
      { label: "Health insurance", href: "/cover/health" },
      { label: "Life and family protection", href: "/cover/life" },
      { label: "Business insurance", href: "/cover/business" },
    ],
  },
  {
    title: "Customer support",
    links: [
      { label: "Claims", href: "/claims" },
      { label: "Help centre", href: "/help" },
      { label: "FAQs", href: "/faqs" },
      { label: "Payments and billing", href: "/claims/payments" },
      { label: "Contact support", href: "/support/contact" },
    ],
  },
  {
    title: "About Cosmic Vault",
    links: [
      { label: "Our story", href: "/about" },
      { label: "Our principles", href: "/about/principles" },
      { label: "Broker partnerships", href: "/about/brokers" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms and conditions", href: "/legal/terms" },
      { label: "Privacy notice", href: "/legal/privacy" },
      { label: "Cookie policy", href: "/legal/cookies" },
      { label: "Accessibility statement", href: "/legal/accessibility" },
      { label: "Complaints procedure", href: "/legal/complaints" },
      { label: "Regulatory information", href: "/legal/regulatory" },
    ],
  },
];
