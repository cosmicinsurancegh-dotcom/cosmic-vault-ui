import type { VaultImage } from "@/lib/imagery";
import { MINERAL_IMAGES } from "@/lib/imagery";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Compass,
  FileCheck2,
  FolderOpen,
  Gem,
  Handshake,
  Headset,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessagesSquare,
  Scale,
  ScanLine,
  ShieldCheck,
  Truck,
  Vault,
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
  /** Photography for the panel's feature card. */
  image?: VaultImage;
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
    id: "vault",
    label: "The vault",
    href: "/#store",
    match: ["/"],
    groups: [
      {
        title: "The vault",
        links: [
          {
            label: "What we store",
            href: "/#store",
            description: "Bullion, gemstones, rare earths, collections",
            icon: Gem,
          },
          {
            label: "Custody standards",
            href: "/#standards",
            description: "Dual control and chain of evidence",
            icon: ShieldCheck,
          },
          {
            label: "Object insurance",
            href: "/#cover",
            description: "A named policy on every object",
            icon: FileCheck2,
          },
          {
            label: "Release & tracking",
            href: "/#tracking",
            description: "Five stages, timestamped",
            icon: Truck,
          },
          {
            label: "How a deposit works",
            href: "/#process",
            description: "Desk, appraisal, cover, drawer",
            icon: ScanLine,
          },
        ],
      },
      {
        title: "Start here",
        links: [
          {
            label: "Request a vault review",
            href: "/#review",
            description: "Custody and cover, quoted together",
            icon: Vault,
          },
          {
            label: "Open the member vault",
            href: "/dashboard",
            description: "Your minerals, policies and releases",
            icon: LayoutGrid,
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
      eyebrow: "One record",
      title: "Stored, appraised and covered in one place.",
      body: "The custodian and the underwriter are the same desk. Every object carries its photographs, certificate, policy and release history on one record.",
      image: MINERAL_IMAGES.bullionDetail,
      primary: { label: "Request a vault review", href: "/#review" },
      secondary: { label: "See what we store", href: "/#store" },
    },
  },
  {
    id: "cover",
    label: "Cover",
    href: "/cover",
    match: ["/cover"],
    groups: [
      {
        title: "Object insurance",
        links: [
          {
            label: "All cover",
            href: "/cover",
            description: "Every policy we write",
            icon: ShieldCheck,
          },
          {
            label: "Understanding cover",
            href: "/cover/understanding",
            description: "What a named policy means",
            icon: BookOpen,
          },
          {
            label: "Limits and exclusions",
            href: "/cover/limits-and-exclusions",
            description: "What is and isn't covered",
            icon: Scale,
          },
        ],
      },
      {
        title: "Get covered",
        links: [
          {
            label: "Get a quote",
            href: "/quote",
            description: "Custody and cover, priced together",
            icon: FileCheck2,
          },
          {
            label: "How it works",
            href: "/how-it-works",
            description: "Apply, policy and renewals",
            icon: Compass,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Named policy",
      title: "Every object carries its own cover.",
      body: "Cover is underwritten by hand against the appraisal, with the reasons recorded on the same record as the object.",
      image: MINERAL_IMAGES.sapphire,
      primary: { label: "Get a quote", href: "/quote" },
      secondary: { label: "Limits and exclusions", href: "/cover/limits-and-exclusions" },
    },
  },
  {
    id: "claims",
    label: "Claims",
    href: "/claims",
    match: ["/claims"],
    groups: [
      {
        title: "Claims",
        links: [
          {
            label: "Claims overview",
            href: "/claims",
            description: "How a claim is handled",
            icon: LifeBuoy,
          },
          {
            label: "Make a claim",
            href: "/claims/make-a-claim",
            description: "Start in a few minutes",
            icon: ClipboardList,
          },
          {
            label: "Track a claim",
            href: "/claims/track",
            description: "Status from your member record",
            icon: ScanLine,
          },
          {
            label: "Policy documents",
            href: "/claims/policy-documents",
            description: "Schedules and certificates",
            icon: FolderOpen,
          },
          {
            label: "Claim payments",
            href: "/claims/payments",
            description: "When and how you are paid",
            icon: Landmark,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Fair process",
      title: "A claim is read by a person, not a queue.",
      body: "Every claim is reviewed against the object's own record, with a written reason for the outcome.",
      image: MINERAL_IMAGES.ruby,
      primary: { label: "Make a claim", href: "/claims/make-a-claim" },
      secondary: { label: "Complaints procedure", href: "/legal/complaints" },
    },
  },
  {
    id: "members",
    label: "Members",
    href: "/dashboard",
    match: ["/dashboard"],
    groups: [
      {
        title: "Your vault",
        links: [
          {
            label: "Overview",
            href: "/dashboard",
            description: "The collection at a glance",
            icon: LayoutGrid,
          },
          {
            label: "My minerals",
            href: "/dashboard/vault",
            description: "Every object with its own record",
            icon: Gem,
          },
          {
            label: "Shipments",
            href: "/dashboard/shipments",
            description: "Live release tracking",
            icon: Truck,
          },
          {
            label: "Policies",
            href: "/dashboard/policies",
            description: "Cover in force and renewals",
            icon: FileCheck2,
          },
          {
            label: "Documents",
            href: "/dashboard/documents",
            description: "Certificates, schedules and appraisals",
            icon: FolderOpen,
          },
        ],
      },
      {
        title: "Help",
        links: [
          {
            label: "Claims",
            href: "/dashboard/claims",
            description: "File and follow a claim",
            icon: LifeBuoy,
          },
          {
            label: "Support",
            href: "/dashboard/support",
            description: "Reach the vault desk",
            icon: Headset,
          },
          {
            label: "Help centre",
            href: "/help",
            description: "Guides by topic",
            icon: MessagesSquare,
          },
          {
            label: "Contact support",
            href: "/support/contact",
            description: "A person, not a queue",
            icon: Mail,
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Member record",
      title: "The same record we work from.",
      body: "Members see the status, the policy and the release history the vault team sees. No separate summary, and no waiting to be told what changed.",
      image: MINERAL_IMAGES.diamonds,
      primary: { label: "Open my vault", href: "/dashboard" },
      secondary: { label: "Track a shipment", href: "/dashboard/shipments" },
    },
  },
  {
    id: "company",
    label: "Company",
    href: "/about",
    match: ["/about", "/contact", "/legal"],
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
            label: "Our commitment",
            href: "/about/commitment",
            description: "Plain language and fair process",
            icon: ClipboardList,
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
            description: "How to reach the desk",
            icon: Mail,
          },
        ],
      },
      {
        title: "Approach",
        links: [
          {
            label: "How cover is decided",
            href: "/about/principles",
            description: "Manual underwriting, recorded reasons",
            icon: Compass,
          },
          {
            label: "Regulatory information",
            href: "/legal/regulatory",
            description: "Company and permissions status",
            icon: Landmark,
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
      title: "A vault is an argument about trust.",
      body: "We are building for decades of custody, not a quarter of storage. That means dual control, honest appraisals and a record that can be produced years later.",
      image: MINERAL_IMAGES.rareEarth,
      primary: { label: "Read our story", href: "/about" },
      secondary: { label: "Regulatory information", href: "/legal/regulatory" },
    },
  },
];

export const FOOTER_COLUMNS: { title: string; links: MenuLink[] }[] = [
  {
    title: "The vault",
    links: [
      { label: "What we store", href: "/#store" },
      { label: "Object insurance", href: "/#cover" },
      { label: "Release & tracking", href: "/#tracking" },
      { label: "Custody standards", href: "/#standards" },
      { label: "How a deposit works", href: "/#process" },
    ],
  },
  {
    title: "Members",
    links: [
      { label: "My vault", href: "/dashboard" },
      { label: "Shipments", href: "/dashboard/shipments" },
      { label: "Policies", href: "/dashboard/policies" },
      { label: "Documents", href: "/dashboard/documents" },
      { label: "Contact support", href: "/support/contact" },
    ],
  },
  {
    title: "Company",
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
