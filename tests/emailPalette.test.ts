import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS, EMAIL_COLOURS } from "../src/convex/lib/emailPalette";

/**
 * The emails cannot read `src/index.css` - Convex has no stylesheet and Outlook
 * has no oklch - so `emailPalette` restates the tokens. These tests keep the
 * copy honest: the hexes must still be the stylesheet's colours, and the two
 * templates must not start inventing colours of their own.
 */

const STYLESHEET = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);

function rootTokens() {
  const root = STYLESHEET.slice(STYLESHEET.indexOf(":root {"));
  const block = root.slice(0, root.indexOf("\n}"));
  const tokens = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(--[\w-]+):\s*(oklch\([^)]*\));/);
    if (match) tokens.set(match[1], match[2]);
  }
  return tokens;
}

/** oklch -> oklab -> linear sRGB -> gamma-encoded sRGB, as CSS Color 4 does it. */
function oklchToHex(value: string) {
  const numbers = value.match(/-?\d*\.?\d+/g)!.map(Number);
  const [l, c, h] = numbers;
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);

  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((channel) => channel ** 3);

  const linear = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];

  return `#${linear
    .map((channel) => {
      const srgb =
        channel <= 0.0031308
          ? 12.92 * channel
          : 1.055 * Math.abs(channel) ** (1 / 2.4) - 0.055;
      const clamped = Math.min(1, Math.max(0, srgb));
      return Math.round(clamped * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase();
    })
    .join("")}`;
}

/** Palette key -> the CSS custom property it restates. */
const TOKEN_SOURCES: Record<keyof typeof DESIGN_TOKENS, string> = {
  ink: "--ink",
  navy: "--navy",
  electric: "--electric",
  electricSoft: "--electric-soft",
  ice: "--ice",
  bone: "--bone",
  halo: "--halo",
  line: "--line",
  secondary: "--secondary",
  muted: "--muted",
  mutedInk: "--muted-foreground",
  accent: "--accent",
  border: "--border",
  foreground: "--foreground",
  destructive: "--destructive",
};

describe("email palette", () => {
  const tokens = rootTokens();

  it("reads the tokens out of the stylesheet", () => {
    expect(tokens.size).toBeGreaterThan(20);
    expect(tokens.get("--electric")).toBe("oklch(0.545 0.216 264)");
  });

  it("still holds the stylesheet's colours", () => {
    const drift: string[] = [];

    for (const [key, property] of Object.entries(TOKEN_SOURCES)) {
      const source = tokens.get(property);
      expect(source, `${property} is missing from src/index.css`).toBeDefined();

      const expected = oklchToHex(source!);
      const actual =
        DESIGN_TOKENS[key as keyof typeof DESIGN_TOKENS].toUpperCase();
      if (actual !== expected) {
        drift.push(`${key}: palette ${actual}, stylesheet ${expected}`);
      }
    }

    expect(drift).toEqual([]);
  });

  it("uses the dashboard's electric blue, not the old mail blue", () => {
    expect(EMAIL_COLOURS.electric).toBe(DESIGN_TOKENS.electric);
    expect(EMAIL_COLOURS.electric).toBe("#2B61EB");
  });

  it("derives its tints from the tokens rather than typing new ones", () => {
    const allowed = new Set([
      ...Object.values(DESIGN_TOKENS).map((value) => value.toUpperCase()),
      "#B45309",
      "#FEF3E2",
      "#F0D9B5",
      "#047857",
      "#E9F6F0",
      "#BDE5D2",
    ]);

    for (const [role, value] of Object.entries(EMAIL_COLOURS)) {
      expect(value, `${role} is a literal colour`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }

    // Everything that is not an exact token must be one of the documented
    // status colours or a mix of two tokens, so no role sneaks in a new hue.
    const offSystem = Object.entries(EMAIL_COLOURS).filter(([, value]) => {
      const hex = value.toUpperCase();
      return !allowed.has(hex) && !isMixOfTokens(hex);
    });
    expect(offSystem).toEqual([]);
  });

  it("keeps raw hex out of every template it colours", () => {
    for (const file of [
      "../src/convex/lib/shipmentEmail.ts",
      "../src/convex/vault/shipmentEmail.ts",
      "../src/convex/email.ts",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      // The lookbehind skips numeric HTML entities such as `&#9670;`.
      expect(source).not.toMatch(/(?<!&)#[0-9A-Fa-f]{3,8}(?![0-9A-Fa-f])/);
    }
  });
});

/**
 * A tint is a token blended with white or with ink. Rather than restate every
 * weight, accept a colour whose hue matches a token mix: its distance from the
 * line between two tokens is small, and every token pair shares the palette's
 * blue-violet direction.
 */
function isMixOfTokens(hex: string) {
  const target = channels(hex);
  const candidates = Object.entries(DESIGN_TOKENS).map(([key, value]) => ({
    key,
    channels: channels(value.toUpperCase()),
  }));

  for (const from of candidates) {
    for (const towards of candidates) {
      for (let step = 0; step <= 100; step += 1) {
        const share = step / 100;
        const mixed = {
          r: from.channels.r + (towards.channels.r - from.channels.r) * share,
          g: from.channels.g + (towards.channels.g - from.channels.g) * share,
          b: from.channels.b + (towards.channels.b - from.channels.b) * share,
        };
        const distance =
          Math.abs(mixed.r - target.r) +
          Math.abs(mixed.g - target.g) +
          Math.abs(mixed.b - target.b);
        if (distance <= 3) return true;
      }
    }
  }

  return false;
}

function channels(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
