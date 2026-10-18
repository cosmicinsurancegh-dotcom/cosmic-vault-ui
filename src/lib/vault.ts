import { Car, HeartHandshake, HeartPulse, House } from "lucide-react";
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
  life: HeartHandshake,
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
    from: "Rated on your answers",
  },
  {
    key: "home",
    label: "Home insurance",
    short: "Home",
    blurb:
      "Buildings and contents cover that protects the place you've made your own, wherever you are.",
    from: "Rated on your answers",
  },
  {
    key: "auto",
    label: "Auto insurance",
    short: "Auto",
    blurb:
      "Comprehensive cover for the cars you actually drive, with fair premiums and fast repairs.",
    from: "Rated on your answers",
  },
  {
    key: "life",
    label: "Life insurance",
    short: "Life",
    blurb:
      "Long-horizon protection for the people who rely on you, written in plain language.",
    from: "Rated on your answers",
  },
];

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
    className:
      "bg-halo/25 text-[#6b4e18] border-halo/40 dark:bg-halo/15 dark:text-halo dark:border-halo/30",
  },
  quoted: {
    label: "Quote ready",
    className:
      "bg-primary/10 text-primary border-primary/25 dark:text-electric-soft",
  },
  active: {
    label: "Cover active",
    className:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  },
};
