/**
 * The email face of the project's colour system.
 *
 * `src/index.css` holds the design tokens in oklch and the app reads them
 * through Tailwind. A Convex function cannot import a stylesheet, and Outlook
 * cannot render oklch, so the same colours are restated here as sRGB hex and
 * every tint is mixed from them rather than typed in.
 *
 * `tests/emailPalette.test.ts` converts the tokens out of the stylesheet and
 * fails when this file and `src/index.css` disagree, so the two shipment
 * emails cannot drift away from the dashboard palette.
 *
 * The stylesheet has no success or warning role, so the three status colours
 * use the same Tailwind steps the dashboard's status chips do (amber-700 and
 * emerald-700), plus the stylesheet's own `--destructive` for a cancellation.
 */

/** Exact sRGB conversions of the `:root` tokens in `src/index.css`. */
export const DESIGN_TOKENS = {
  ink: "#0A1224",
  navy: "#091430",
  electric: "#2B61EB",
  electricSoft: "#8BB9FD",
  ice: "#E2F3FF",
  bone: "#FFFFFF",
  halo: "#DBC8A2",
  line: "#D4D9E1",
  secondary: "#E6ECF3",
  muted: "#DFF1FF",
  mutedInk: "#5E6572",
  accent: "#E0EFFD",
  border: "#D2D7DE",
  foreground: "#0B1325",
  destructive: "#E7000B",
} as const;

function channel(hex: string, index: number) {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

/** Blend `from` towards `towards`; `weight` is the share of `towards` (0-1). */
function mix(from: string, towards: string, weight: number) {
  const share = Math.min(1, Math.max(0, weight));
  return `#${[0, 1, 2]
    .map((index) =>
      Math.round(
        channel(from, index) * (1 - share) + channel(towards, index) * share,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

const { ink, navy, electric, electricSoft, ice, bone, halo, line, accent } =
  DESIGN_TOKENS;

/**
 * Roles, not raw colours: the same names the dashboard's components use. The
 * mixes are the app's own alphas - `bg-ice/20`, `bg-ice/45` - resolved to solid
 * hex, because email clients drop eight-digit hex.
 */
export const EMAIL_COLOURS = {
  /** The page behind the card: ice at a fifth, the app's page tint. */
  canvas: mix(ice, bone, 0.8),
  /** A tinted panel inside the card: the hero band. */
  panel: mix(ice, bone, 0.45),
  /** A tinted well inside a panel: chips, the CTA block. */
  panelDeep: mix(ice, bone, 0.2),
  card: bone,
  white: bone,

  ink,
  /** Secondary type, `--muted-foreground`. */
  muted: DESIGN_TOKENS.mutedInk,
  faint: mix(DESIGN_TOKENS.mutedInk, bone, 0.3),

  line,
  /** The hairline between rows inside a card. */
  lineSoft: mix(line, bone, 0.5),

  electric,
  /** Electric pressed into ink: links and labels on a tinted panel. */
  electricDeep: mix(electric, ink, 0.4),
  electricSoft,
  /** `--accent`, the blue wash behind a chip. */
  electricTint: accent,
  electricLine: mix(electric, bone, 0.72),
  /** The dashed track ahead on the route rail. */
  electricTrack: mix(electric, bone, 0.78),
  navy,
  /** Footnote type on a navy band: electricSoft lifted towards white. */
  navyMuted: mix(electricSoft, bone, 0.35),
  /** Dim type on navy: the copyright line. */
  navyFaint: mix(electricSoft, navy, 0.7),
  /** The hairline that separates the footer columns from the band. */
  navyLine: mix(navy, electric, 0.18),
  halo,

  amber: "#B45309",
  amberTint: "#FEF3E2",
  amberLine: "#F0D9B5",
  emerald: "#047857",
  emeraldTint: "#E9F6F0",
  emeraldLine: "#BDE5D2",
  danger: DESIGN_TOKENS.destructive,
  dangerTint: mix(DESIGN_TOKENS.destructive, bone, 0.93),
  dangerLine: mix(DESIGN_TOKENS.destructive, bone, 0.72),
} as const;
