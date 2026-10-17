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
