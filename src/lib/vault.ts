import { Atom, Crown, Diamond, Gem } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The four custody classes. The storage keys are the platform's original
 * coverage identifiers and are kept stable for the Convex schema; everything a
 * person reads - labels, icons, copy - describes minerals, not households.
 */
export type CoverageKey = "health" | "home" | "auto" | "life";

export const COVERAGE_LABELS: Record<CoverageKey, string> = {
  health: "Rare earths & critical metals",
  home: "Bullion & bars",
  auto: "Collections & heirlooms",
  life: "Diamonds & gemstones",
};

export const COVERAGE_ICONS: Record<CoverageKey, LucideIcon> = {
  health: Atom,
  home: Gem,
  auto: Crown,
  life: Diamond,
};

export const COVERAGE_OPTIONS: {
  key: CoverageKey;
  label: string;
  short: string;
  blurb: string;
  from: string;
}[] = [
  {
    key: "home",
    label: "Bullion & bars",
    short: "Bullion",
    blurb:
      "Gold, silver and platinum bars or coins, held in sealed drawers with the assay card and the policy in the same record.",
    from: "Insured to the assayed gram",
  },
  {
    key: "life",
    label: "Diamonds & gemstones",
    short: "Gemstones",
    blurb:
      "Loose stones, finished pieces and full parcels, appraised stone by stone and covered on their own schedule.",
    from: "Insured to the appraisal",
  },
  {
    key: "health",
    label: "Rare earths & critical metals",
    short: "Rare earths",
    blurb:
      "Specimens, oxides and reference samples for laboratories, funds and collections that need custody with a chain of evidence.",
    from: "Insured to the certificate",
  },
  {
    key: "auto",
    label: "Collections & heirlooms",
    short: "Collections",
    blurb:
      "A whole collection under one custody agreement, with every object keeping its own policy, photographs and release history.",
    from: "Insured piece by piece",
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
