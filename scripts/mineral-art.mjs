/**
 * Generates the studio illustrations in `public/minerals`.
 *
 * Two of the minerals are real photographs (gold bars, loose diamonds). The
 * rest are drawn here so every asset shares one studio setup: the same dark
 * sweep, the same key light from the upper left, the same contact shadow and
 * film grain. Drawing them from geometry — rather than hand-written paths —
 * keeps the facet shading consistent with the lighting and makes it cheap to
 * add another material later.
 *
 * Run with: node scripts/mineral-art.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/minerals");

/* A tiny deterministic generator, so re-running produces identical files. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const LIGHT = (() => {
  const x = -0.62;
  const y = -0.72;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
})();

const round = (value) => Math.round(value * 10) / 10;
const points = (list) => list.map(([x, y]) => `${round(x)} ${round(y)}`).join("L");

/** Unit vector from the stone's centre to a facet, projected onto the key light. */
function lit(x, y, cx, cy) {
  const dx = x - cx;
  const dy = y - cy;
  const length = Math.hypot(dx, dy) || 1;
  return (dx / length) * LIGHT.x + (dy / length) * LIGHT.y;
}

const centroid = (list) => {
  const sum = list.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / list.length, sum[1] / list.length];
};

/**
 * The girdle outline. `shape` scales a unit outline: a round brilliant reads as
 * a slightly irregular circle, an oval is squashed, a cushion is a superellipse
 * and a step cut is an octagon with cut corners.
 */
function outline(shape, rx, ry, cx, cy) {
  const points = [];
  if (shape === "octagon") {
    const cxr = 0.42;
    const corners = [
      [1, 1 - cxr],
      [1 - cxr, 1],
      [-(1 - cxr), 1],
      [-1, 1 - cxr],
      [-1, -(1 - cxr)],
      [-(1 - cxr), -1],
      [1 - cxr, -1],
      [1, -(1 - cxr)],
    ];
    return corners.map(([x, y]) => [cx + x * rx, cy + y * ry]);
  }

  const count = shape === "round" ? 24 : 20;
  const squash = shape === "cushion" ? 3.6 : 2;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Superellipse: |x|^n + |y|^n = 1 keeps the corners of a cushion fuller.
    const norm = Math.pow(
      Math.pow(Math.abs(cos), squash) + Math.pow(Math.abs(sin), squash),
      1 / squash,
    );
    points.push([cx + (cos / norm) * rx, cy + (sin / norm) * ry]);
  }
  return points;
}

/** Scale an outline about its centre. */
function scale(list, factor, cx, cy) {
  return list.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

function hsl(hue, saturation, lightness) {
  return `hsl(${round(hue)} ${round(saturation)}% ${round(lightness)}%)`;
}

/**
 * Crown facets. Each girdle edge becomes two triangles meeting at a table
 * vertex, and the shading follows the light rather than the index, so the
 * result looks cut rather than striped.
 */
function crown(poly, table, cx, cy, tone) {
  const facets = [];
  for (let index = 0; index < poly.length; index += 1) {
    const next = (index + 1) % poly.length;
    const a = poly[index];
    const b = poly[next];
    const t = table[index];
    const tNext = table[next];

    for (const triangle of [
      [a, b, tNext],
      [a, tNext, t],
    ]) {
      const [px, py] = centroid(triangle);
      const light = lit(px, py, cx, cy);
      // Facets catching the light go pale; the ones turning away sink into the
      // body colour. A small deterministic wobble keeps it from looking banded.
      const sparkle = (Math.sin(index * 2.7 + triangle.length) + 1) / 2;
      const lightness =
        tone.low + (tone.high - tone.low) * ((light + 1) / 2) ** 1.25 + sparkle * tone.sparkle;
      facets.push({
        path: `M${points(triangle)}Z`,
        fill: hsl(tone.hue + light * tone.hueShift, tone.saturation, lightness),
      });
    }
  }
  return facets;
}

/**
 * The pavilion, seen through the table. A face-up stone returns most of the
 * light that enters it, so these facets are mid-tone rather than dark, and the
 * web is offset below the centre of the table where the culet actually sits.
 */
function pavilion(table, cx, cy, tone) {
  const culet = [cx + 6, cy + (table[0][1] - cy) * 0.42];
  const facets = [];
  for (let index = 0; index < table.length; index += 1) {
    const a = table[index];
    const b = table[(index + 1) % table.length];
    const [px, py] = centroid([a, b, culet]);
    const light = lit(px, py, cx, cy);
    const sparkle = (Math.sin(index * 1.9) + 1) / 2;
    facets.push({
      path: `M${round(a[0])} ${round(a[1])}L${round(b[0])} ${round(b[1])}L${round(
        culet[0],
      )} ${round(culet[1])}Z`,
      fill: hsl(
        tone.hue + 8,
        tone.saturation + 4,
        tone.mid + light * 13 + sparkle * 5,
      ),
    });
  }
  return facets;
}

/** The bright band between the girdle and the table of a step or cushion cut. */
function bezel(girdle, table, cx, cy, tone) {
  const ring = girdle.map((point, index) => {
    const target = table[index];
    return [
      point[0] + (target[0] - point[0]) * 0.58,
      point[1] + (target[1] - point[1]) * 0.58,
    ];
  });
  const facets = [];
  for (let index = 0; index < girdle.length; index += 1) {
    const next = (index + 1) % girdle.length;
    for (const triangle of [
      [girdle[index], girdle[next], ring[next]],
      [girdle[index], ring[next], ring[index]],
    ]) {
      const [px, py] = centroid(triangle);
      const light = lit(px, py, cx, cy);
      const sparkle = (Math.sin(index * 2.2 + triangle.length) + 1) / 2;
      // The bezel band carries the sharpest contrast on a cut stone.
      const lightness =
        tone.low +
        (tone.high - tone.low) * ((light + 1) / 2) ** 1.4 +
        sparkle * tone.sparkle * 0.8;
      facets.push({
        path: `M${points(triangle)}Z`,
        fill: hsl(tone.hue + light * tone.hueShift, tone.saturation, lightness),
      });
    }
  }
  return { facets, ring };
}

/** Crisp specular shards — the highlights that make a stone read as polished. */
function specular(poly, table, cx, cy, opacity = 0.62) {
  const shards = [];
  for (const index of [2, 3, 4, 15, 16, 20, 21]) {
    if (index >= poly.length) continue;
    const a = poly[index];
    const t = table[index];
    const tNext = table[(index + 1) % table.length];
    const inner = [cx + (t[0] - cx) * 0.72, cy + (t[1] - cy) * 0.72];
    shards.push(
      `<path d="M${points([a, t, inner])}Z" fill="#fff" opacity="${round(
        opacity * (0.35 + ((index % 3) + 1) * 0.22),
      )}"/>`,
    );
  }
  return shards.join("");
}

function frame({ id, hue, saturation, wash }) {
  return `
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="72%">
      <stop offset="0" stop-color="${hsl(hue, saturation * 0.5, 17)}"/>
      <stop offset="0.55" stop-color="${hsl(hue, saturation * 0.4, 8)}"/>
      <stop offset="1" stop-color="${hsl(hue, saturation * 0.3, 3)}"/>
    </radialGradient>
    <radialGradient id="key" cx="34%" cy="18%" r="62%">
      <stop offset="0" stop-color="${wash}" stop-opacity="0.42"/>
      <stop offset="0.6" stop-color="${wash}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${wash}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="46%" r="68%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.6"/>
    </radialGradient>
    <radialGradient id="caustic" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${hsl(hue, saturation + 14, 52)}" stop-opacity="0.34"/>
      <stop offset="0.6" stop-color="${hsl(hue, saturation, 26)}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${hsl(hue, saturation, 12)}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="34"/>
    </filter>
    <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="1600" height="1100" fill="url(#bg)"/>
  <rect width="1600" height="1100" fill="url(#key)"/>
  <rect width="1600" height="1100" fill="url(#vignette)"/>
  <rect width="1600" height="1100" filter="url(#grain)" opacity="0.65"/>
  <rect x="0.5" y="0.5" width="1599" height="1099" fill="none" stroke="#fff" stroke-opacity="0.06"/>`;
}

function plaque(hue, saturation, label) {
  return `
  <g opacity="0.85">
    <path d="M1150 918 1450 918" stroke="${hsl(hue, saturation, 78)}" stroke-opacity="0.4"/>
    <text x="1150" y="952" fill="${hsl(hue, saturation * 0.35, 94)}" font-family="Georgia, serif"
      font-size="17" letter-spacing="6" opacity="0.8">${label}</text>
  </g>`;
}

/* -------------------------------------------------------------------------- */
/* Precious stones                                                            */
/* -------------------------------------------------------------------------- */

function stone({ shape, hue, saturation, tone, label, aria, seed }) {
  const random = seeded(seed);
  const cx = 800;
  const cy = 520;
  const rx = shape === "octagon" ? 330 : 372;
  const ry = shape === "octagon" ? 268 : 300;

  const girdle = outline(shape, rx, ry, cx, cy);
  const tableFactor = shape === "octagon" ? 0.62 : 0.5;
  const tableRaw = scale(girdle, tableFactor, cx, cy - ry * 0.06);
  const table = tableRaw.map(([x, y]) => [
    x + (random() - 0.5) * 2,
    y + (random() - 0.5) * 2,
  ]);

  const crownFacets = crown(girdle, table, cx, cy, tone);
  const bezelBand = bezel(girdle, table, cx, cy, tone);
  const pavilionFacets = pavilion(table, cx, cy, tone);

  const stepRings =
    shape === "octagon"
      ? [1.32, 1.14].map((factor) => {
          const ring = scale(table, factor, cx, cy);
          return `<path d="M${points(ring)}Z" fill="none" stroke="${hsl(
            tone.hue,
            tone.saturation,
            tone.high + 10,
          )}" stroke-opacity="0.26" stroke-width="1.4"/>`;
        })
      : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" role="img" aria-label="${aria}">
  ${frame({ id: label, hue, saturation, wash: hsl(hue, saturation + 20, 74) })}
  <defs>
    <clipPath id="table-clip"><path d="M${points(table)}Z"/></clipPath>
    <radialGradient id="tablelight" cx="42%" cy="38%" r="72%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.34"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- contact shadow and the light the stone throws onto the surface -->
  <ellipse cx="815" cy="884" rx="300" ry="46" fill="#000" opacity="0.7" filter="url(#soft)"/>
  <ellipse cx="800" cy="848" rx="250" ry="70" fill="url(#caustic)" filter="url(#bloom)"/>

  <g>
    <path d="M${points(girdle)}Z" fill="${hsl(tone.hue, tone.saturation, tone.low)}"/>
    ${crownFacets.map((facet) => `<path d="${facet.path}" fill="${facet.fill}"/>`).join("")}
    ${bezelBand.facets.map((facet) => `<path d="${facet.path}" fill="${facet.fill}"/>`).join("")}
    <path d="M${points(table)}Z" fill="${hsl(tone.hue, tone.saturation + 6, tone.mid - 4)}"/>
    ${pavilionFacets.map((facet) => `<path d="${facet.path}" fill="${facet.fill}"/>`).join("")}
    <g clip-path="url(#table-clip)">
      <rect x="420" y="200" width="760" height="680" fill="url(#tablelight)"/>
      ${stepRings.join("")}
      ${specular(table, scale(table, 0.96, cx, cy), cx, cy, 0.5)}
    </g>
    ${specular(girdle, bezelBand.ring, cx, cy, 0.42)}
    <path d="M${points(table)}Z" fill="none" stroke="${hsl(
      tone.hue,
      tone.saturation,
      tone.high + 18,
    )}" stroke-opacity="0.4" stroke-width="1.6"/>
    <path d="M${points(girdle)}Z" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="2"/>
    <path d="M${points(girdle.slice(Math.round(girdle.length * 0.58), Math.round(girdle.length * 0.85)))}"
      fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round"/>
  </g>

  <rect width="1600" height="1100" fill="url(#vignette)" opacity="0.32"/>
  ${plaque(hue, saturation, label)}
</svg>`;
}

/* -------------------------------------------------------------------------- */
/* A mineral specimen                                                         */
/* -------------------------------------------------------------------------- */

function specimen({ hue, saturation, label, aria, seed }) {
  const random = seeded(seed);
  const cx = 800;
  const cy = 560;
  const silhouette = [];
  const count = 13;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const radius = 300 + random() * 132;
    silhouette.push([
      cx + Math.cos(angle) * radius * 1.06,
      cy + Math.sin(angle) * radius * 0.78,
    ]);
  }

  const facets = silhouette.map((point, index) => {
    const next = silhouette[(index + 1) % count];
    const [px, py] = centroid([point, next, [cx, cy]]);
    const light = lit(px, py, cx, cy);
    const lightness = 12 + (light + 1) * 15 + random() * 5;
    return `<path d="M${round(point[0])} ${round(point[1])}L${round(next[0])} ${round(next[1])}L${round(
      cx,
    )} ${round(cy)}Z" fill="${hsl(hue, saturation * 0.35, lightness)}"/>`;
  });

  const veins = [];
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2 + random();
    const start = [cx + Math.cos(angle) * 40, cy + Math.sin(angle) * 30];
    const mid = [
      cx + Math.cos(angle + 0.4) * 150,
      cy + Math.sin(angle + 0.4) * 110,
    ];
    const end = [cx + Math.cos(angle + 0.2) * 250, cy + Math.sin(angle + 0.2) * 180];
    veins.push(
      `<path d="M${round(start[0])} ${round(start[1])}Q${round(mid[0])} ${round(
        mid[1],
      )} ${round(end[0])} ${round(end[1])}" fill="none" stroke="${hsl(
        hue,
        saturation + 18,
        68,
      )}" stroke-opacity="${round(0.28 + random() * 0.4)}" stroke-width="${round(
        3 + random() * 5,
      )}" stroke-linecap="round"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1100" role="img" aria-label="${aria}">
  ${frame({ id: label, hue, saturation, wash: hsl(hue, saturation, 70) })}

  <ellipse cx="800" cy="880" rx="320" ry="52" fill="#000" opacity="0.72" filter="url(#soft)"/>
  <ellipse cx="800" cy="845" rx="240" ry="66" fill="url(#caustic)" filter="url(#bloom)" opacity="0.7"/>

  <g>
    <path d="M${points(silhouette)}Z" fill="${hsl(hue, saturation * 0.3, 8)}"/>
    ${facets.join("")}
    ${veins.join("")}
    <path d="M${points(silhouette)}Z" fill="none" stroke="${hsl(
      hue,
      saturation * 0.25,
      78,
    )}" stroke-opacity="0.28" stroke-width="2"/>
  </g>

  <rect width="1600" height="1100" fill="url(#vignette)" opacity="0.5"/>
  ${plaque(hue, saturation, label)}
</svg>`;
}

/* -------------------------------------------------------------------------- */

const assets = {
  "ruby.svg": stone({
    shape: "cushion",
    hue: 352,
    saturation: 72,
    seed: 11,
    label: "BURMA · NO HEAT",
    aria: "A cushion-cut ruby under studio light, set on a dark surface",
    tone: {
      hue: 350,
      hueShift: 8,
      saturation: 68,
      low: 16,
      mid: 34,
      high: 56,
      sparkle: 7,
    },
  }),
  "emerald.svg": stone({
    shape: "octagon",
    hue: 158,
    saturation: 58,
    seed: 23,
    label: "MUZO · 3.10 CT",
    aria: "An emerald-cut green gemstone under studio light",
    tone: {
      hue: 158,
      hueShift: 6,
      saturation: 54,
      low: 14,
      mid: 33,
      high: 54,
      sparkle: 8,
    },
  }),
  "sapphire.svg": stone({
    shape: "oval",
    hue: 222,
    saturation: 74,
    seed: 37,
    label: "CEYLON · UNHEATED",
    aria: "An oval blue sapphire under studio light",
    tone: {
      hue: 222,
      hueShift: 9,
      saturation: 70,
      low: 16,
      mid: 36,
      high: 58,
      sparkle: 8,
    },
  }),
  "rare-earth.svg": null,
};

/* `rare-earth.svg` is hand-drawn: a rock is mostly silhouette and surface
   texture, which the facet model above renders as a flat disc. Delete a null
   entry and the file is left untouched. */

await mkdir(OUT, { recursive: true });
for (const [name, svg] of Object.entries(assets)) {
  if (!svg) continue;
  await writeFile(resolve(OUT, name), `${svg.trim()}\n`, "utf8");
  console.log(`wrote public/minerals/${name}`);
}
