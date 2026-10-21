/**
 * The site's photography, kept in one place so every surface uses the same
 * crops, alt text and loading behaviour. Files live in `public/images` so the
 * pages never depend on a third-party host at runtime.
 */

export type VaultImage = {
  src: string;
  /** Empty string marks the image as decorative. */
  alt: string;
  /** CSS object-position value, for crops that must keep a subject in frame. */
  position?: string;
  /** Dominant colour, painted before the file decodes. */
  tone?: string;
};

export const IMAGES = {
  hero: {
    src: "/images/hero-advisory.webp",
    alt: "An advisor and a member talking across a desk",
    position: "50% 42%",
    tone: "#1b2436",
  },
  story: {
    src: "/images/story-advisor.webp",
    alt: "The Cosmic Vault advisory team working together in a bright office",
    position: "50% 45%",
    tone: "#c9c3b6",
  },
  storyDetail: {
    src: "/images/story-detail.webp",
    alt: "A handshake at the end of an advisory meeting",
    position: "50% 50%",
    tone: "#8a7c68",
  },
  workspaces: {
    src: "/images/workspaces.webp",
    alt: "A quiet, light-filled workspace",
    position: "50% 55%",
    tone: "#b7b0a4",
  },
  claimReview: {
    src: "/images/claim-review.webp",
    alt: "A claim handler reviewing an assessment",
    position: "50% 40%",
    tone: "#2a3040",
  },
  homeInterior: {
    src: "/images/home-interior.webp",
    alt: "A calm, light-filled living room",
    position: "50% 55%",
    tone: "#cdc6b8",
  },
  advisor: {
    src: "/images/advisor-portrait.webp",
    alt: "Portrait of a Cosmic Vault advisor",
    position: "50% 30%",
    tone: "#9a9488",
  },
  cosmos: {
    src: "/images/cosmos.webp",
    alt: "A field of stars above a dark horizon",
    position: "50% 50%",
    tone: "#050b18",
  },
  earth: {
    src: "/images/earth.webp",
    alt: "The Earth seen from orbit",
    position: "50% 50%",
    tone: "#05101f",
  },
  support: {
    src: "/images/support-desk.webp",
    alt: "A calm workspace set up for member support",
    position: "50% 50%",
    tone: "#a9a49a",
  },
  auth: {
    src: "/images/auth-vault.webp",
    alt: "A contemporary home lit from within at dusk",
    position: "50% 55%",
    tone: "#2b3040",
  },
  orbit: {
    src: "/images/notfound-orbit.webp",
    alt: "The Milky Way stretching across the night sky",
    position: "50% 50%",
    tone: "#060c1a",
  },
} satisfies Record<string, VaultImage>;

/**
 * The minerals themselves. Photographs where we have them, studio illustrations
 * for the materials that were never shot - both sit on the same dark ground, so
 * the grid reads as one collection rather than a mix of sources.
 */
export const MINERAL_IMAGES = {
  bullion: {
    src: "/minerals/gold-bars.webp",
    alt: "Stacked fine gold bars under vault lighting",
    position: "50% 42%",
    tone: "#2a1a05",
  },
  bullionDetail: {
    src: "/minerals/gold-bars-detail.webp",
    alt: "The minted face of a 1 kg fine gold bar",
    position: "50% 50%",
    tone: "#3d2708",
  },
  diamonds: {
    src: "/minerals/diamonds.webp",
    alt: "Loose brilliant-cut diamonds resting on a dark surface",
    position: "50% 52%",
    tone: "#141a22",
  },
  emerald: {
    src: "/minerals/emerald.svg",
    alt: "An emerald-cut green gemstone under studio light",
    position: "50% 50%",
    tone: "#071511",
  },
  ruby: {
    src: "/minerals/ruby.svg",
    alt: "A cushion-cut ruby photographed on a dark surface",
    position: "50% 50%",
    tone: "#1a070b",
  },
  sapphire: {
    src: "/minerals/sapphire.svg",
    alt: "An oval blue sapphire under studio light",
    position: "50% 50%",
    tone: "#071120",
  },
  rareEarth: {
    src: "/minerals/rare-earth.svg",
    alt: "A rare-earth mineral specimen with metallic veins",
    position: "50% 50%",
    tone: "#080f0d",
  },
  platinum: {
    src: "/minerals/platinum-coin.svg",
    alt: "A one-ounce platinum bullion coin",
    position: "50% 50%",
    tone: "#0d1118",
  },
  silver: {
    src: "/minerals/silver-bars.svg",
    alt: "A stack of fine silver bars",
    position: "50% 50%",
    tone: "#14171b",
  },
  goldNugget: {
    src: "/minerals/gold-nugget.svg",
    alt: "A natural gold nugget on a dark surface",
    position: "50% 50%",
    tone: "#1b1206",
  },
} satisfies Record<string, VaultImage>;

/** Decorative avatars for the advisor strip. */
export const ADVISOR_FACES: VaultImage[] = [
  { src: "/images/advisor-1.webp", alt: "", position: "50% 30%" },
  { src: "/images/advisor-2.webp", alt: "", position: "50% 30%" },
  { src: "/images/advisor-3.webp", alt: "", position: "50% 30%" },
];

const COVER_IMAGES: Record<string, VaultImage> = {
  home: {
    src: "/images/cover-home.webp",
    alt: "A contemporary home with a garden and swimming pool",
    position: "50% 60%",
    tone: "#7f8898",
  },
  motor: {
    src: "/images/cover-motor.webp",
    alt: "A car on an open road",
    position: "50% 60%",
    tone: "#2b2f36",
  },
  travel: {
    src: "/images/cover-travel.webp",
    alt: "A pale turquoise coastline meeting a wide sky",
    position: "50% 55%",
    tone: "#5f9aa6",
  },
  health: {
    src: "/images/cover-health.webp",
    alt: "A clinician in conversation with a patient",
    position: "50% 35%",
    tone: "#8d9aa0",
  },
  life: {
    src: "/images/cover-life.webp",
    alt: "People sharing time together outdoors",
    position: "50% 45%",
    tone: "#8d7f70",
  },
  business: {
    src: "/images/cover-business.webp",
    alt: "A small business team in a planning meeting",
    position: "50% 40%",
    tone: "#9a9186",
  },
};

export function coverImage(slug: string): VaultImage {
  return (
    COVER_IMAGES[slug] ?? {
      src: "/images/workspaces.webp",
      alt: "",
      tone: "#b7b0a4",
    }
  );
}
