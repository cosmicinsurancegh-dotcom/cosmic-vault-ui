import { Car, HeartPulse, House, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CoverageKey = "health" | "home" | "auto" | "life";

export const COVERAGE_LABELS: Record<CoverageKey, string> = {
  health: "Health insurance",
  home: "Home insurance",
  auto: "Auto insurance",
  life: "Life insurance",
};

export const COVERAGE_ICONS: Record<CoverageKey, LucideIcon> = {
  health: HeartPulse,
  home: House,
  auto: Car,
  life: Sparkles,
};

export const COVERAGE_OPTIONS: {
  key: CoverageKey;
  label: string;
  short: string;
  blurb: string;
  from: string;
}[] = [
  {
    key: "health",
    label: "Health insurance",
    short: "Health",
    blurb:
      "Private care, dental and mental-health support on one simple plan — no network paperwork.",
    from: "From £59 / mo",
  },
  {
    key: "home",
    label: "Home insurance",
    short: "Home",
    blurb:
      "Buildings and contents cover that protects the place you've made your own, wherever you are.",
    from: "From £99 / mo",
  },
  {
    key: "auto",
    label: "Auto insurance",
    short: "Auto",
    blurb:
      "Comprehensive cover for the cars you actually drive, with fair premiums and fast repairs.",
    from: "From £79 / mo",
  },
  {
    key: "life",
    label: "Life insurance",
    short: "Life",
    blurb:
      "Long-horizon protection for the people who rely on you, written in plain language.",
    from: "From £149 / mo",
  },
];

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  featured?: boolean;
  perks: string[];
};

export const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    tagline: "The foundations, beautifully handled.",
    monthly: 59,
    perks: [
      "One coverage line of your choice",
      "24/7 digital claims",
      "£250,000 liability cover",
      "Human advisor, weekdays",
    ],
  },
  {
    id: "signature",
    name: "Signature",
    tagline: "Our most chosen way to cover a life.",
    monthly: 99,
    featured: true,
    perks: [
      "Any two coverage lines",
      "48-hour claim settlement",
      "Worldwide travel protection",
      "Priority advisor, 7 days",
    ],
  },
  {
    id: "horizon",
    name: "Horizon",
    tagline: "For homes, families, and everything next.",
    monthly: 149,
    perks: [
      "Any three coverage lines",
      "Home emergency response",
      "New-for-old replacement",
      "Named family advisors",
    ],
  },
  {
    id: "infinite",
    name: "Infinite",
    tagline: "The whole universe, quietly secure.",
    monthly: 249,
    perks: [
      "All four coverage lines",
      "Dedicated claims concierge",
      "Worldwide, all-terrain cover",
      "Annual vault review",
    ],
  },
];

export const YEARLY_DISCOUNT = 0.2;

export function planPrice(monthly: number, yearly: boolean) {
  return yearly ? Math.round(monthly * (1 - YEARLY_DISCOUNT)) : monthly;
}

export function planByName(name?: string | null) {
  return PLANS.find((plan) => plan.name.toLowerCase() === name?.toLowerCase());
}

export function coverageLabel(key: string): string {
  return COVERAGE_LABELS[key as CoverageKey] ?? key;
}

export function formatGBP(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function initials(name?: string | null) {
  if (!name) return "CV";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  in_review: {
    label: "In review",
    className: "bg-halo/25 text-[#6b4e18] border-halo/40",
  },
  quoted: {
    label: "Quote ready",
    className: "bg-electric/10 text-electric border-electric/25",
  },
  active: {
    label: "Cover active",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  },
};
