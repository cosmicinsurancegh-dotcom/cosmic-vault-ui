/**
 * Builds the hero's front-facing vault door ("The Strongroom") with the Anatomy kit.
 *
 *   node scripts/vault-door/build.mjs                    writes src/components/landing/vault-door/art.generated.ts + vault-door.css
 *   VD_PREVIEW=/tmp/door.html node scripts/vault-door/build.mjs   also writes a standalone page of the resting pose
 *
 * Everything static is drawn here once and shipped as finished SVG strings. Only what moves
 * (bolts, pins, the drive ring's slots, the dial face, the knurl, the gauge needle, the lamps)
 * carries a data-vd hook that VaultDoor.tsx drives at runtime.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import * as M from "./door-model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "src", "components", "landing", "vault-door");
const rad = (deg) => (deg * Math.PI) / 180;
const { BOLTS, BOLT_AT, PIN_FROM, PIN_TRAVEL, RING_SWEEP, COMBINATION, ZC, R_BODY, R_FLANGE, R_BORE, R_DOOR, R_FACE, R_RING_OUT, RING_S, BOLT_LEN, RHO_IN, DIAL_S, KNOB_S, DIAL_R, KNOB_R, HINGE_X, HINGE_Y, ARM_V, KNUCKLE_R, polyRadial, rrect } = M;

/* Camera: azimuth 90 looks straight down +y at the door face, so the dial and drive ring read as true circles;
   elevation 8 keeps a sliver of the top, enough to show the frame's depth. With the face frontal, depth order is
   decided by height off the face (s) alone, so the painter's order below needs no per-angle sorting. */

/* ── World ────────────────────────────────────────────────────────────────── */
const WIDTH = 640;
const HEIGHT = 620;
const CHAMBER = 150; // how far behind the door's face the vault's back wall stands

const PLATE = { x: -262, y: -92, w: 510, d: 176, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners({ x: -246, y: -52, w: 470, d: 56 }, ZC - R_FLANGE, ZC + R_FLANGE),
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 90, elevation: 8 },
);

const F0 = G.frameOf([0, 0, ZC], [0, 1, 0], [1, 0, 0], [0, 0, 1]); // door face frame: s along +y, u = x, v = z
const door = M.makeDoor(P, 0); // the shut door; the swing is drawn at runtime by the same model
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (items, centre) => [...items].sort((a, b) => k.depthOf(centre(a), P) - k.depthOf(centre(b), P));
let solids = 0;
const solid = (paths, style) => {
  solids++;
  return S(paths, style);
};

const faceAt = door.faceAt;
const polar = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
const r1 = (p) => p.map((n) => Math.round(n * 10) / 10).join(" ");
const prism = (poly, s0, s1) => G.prismOf(F0, poly, s0, s1, P);
const facets = (r) => Math.max(14, Math.min(88, Math.round(r * 0.5)));
const disc = (s0, s1, r, F) => G.disc(s0, s1, r, F, P, { steps: facets(r) });
/* a ring band's fill is the hull of its rims, so a ring the door leaves open needs `hole` cutting its bore out (the fills are even-odd, see the CSS) */
const band = (s0, s1, rIn, rOut, F, hole = null) => G.ringBand(s0, s1, rIn, rOut, F, P, { steps: facets(rOut), hole });
const frameAtFace = door.frameAtFace;

/* The matrix that turns a flat group about the door's axis (or any point on the face) in the plane at depth s. */
function turnMatrix(s, deg, cx = 0, cz = 0) {
  const o = faceAt(cx, cz, s);
  const x = faceAt(cx + 1, cz, s);
  const z = faceAt(cx, cz + 1, s);
  const ex = [x[0] - o[0], x[1] - o[1]];
  const ez = [z[0] - o[0], z[1] - o[1]];
  const c = Math.cos(rad(deg));
  const n = Math.sin(rad(deg));
  const xr = [c * ex[0] + n * ez[0], c * ex[1] + n * ez[1]];
  const zr = [-n * ex[0] + c * ez[0], -n * ex[1] + c * ez[1]];
  const det = ex[0] * ez[1] - ex[1] * ez[0];
  const i = [[ez[1] / det, -ez[0] / det], [-ex[1] / det, ex[0] / det]];
  const a = xr[0] * i[0][0] + zr[0] * i[1][0];
  const b = xr[1] * i[0][0] + zr[1] * i[1][0];
  const cc = xr[0] * i[0][1] + zr[0] * i[1][1];
  const d = xr[1] * i[0][1] + zr[1] * i[1][1];
  const e = o[0] - (a * o[0] + cc * o[1]);
  const f = o[1] - (b * o[0] + d * o[1]);
  return `matrix(${[a, b, cc, d, e, f].map((v) => Math.round(v * 1e4) / 1e4).join(" ")})`;
}

/* ── Plinth: feet, slab, groove, screws, ruler and label ──────────────────── */
function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24), ([x, y]) => [x, y, 0])) {
    out.push(solid(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(solid(k.cylinder(x, y, 6, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }
  out.push(solid(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  /* ruler strip along the front edge, ticks hanging from its edge */
  const strip = { x: -240, y: PLATE.y + PLATE.d - 17, w: 330, d: 8, r: 1 };
  out.push(solid(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 5, strip.x + strip.w - 5, 5, 5, strip.y + 0.8, 0.7, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.4, strip.y + 4, 0.7]), at([strip.x + strip.w - 2.4, strip.y + 4, 0.7])], { size: 0.45 }));
  /* label plate with three printed rules */
  const label = { x: -236, y: -70, w: 74, d: 34, r: 3 };
  out.push(solid(k.slabOf(label, 0, 0.9, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 2.2), 0.9, P), { tone: "faint" }));
  [[11, 52], [18, 40], [25, 46]].forEach(([dy, len]) => out.push(L(k.lineOnTop([label.x + 9, label.y + dy], [label.x + 9 + len * 0.9, label.y + dy], 0.9, P), { tone: "lo", free: true })));
  out.push(D([at([label.x + 5, label.y + 5, 0.9]), at([label.x + label.w - 5, label.y + label.d - 5, 0.9])], { size: 0.42 }));
  return out.join("");
}

/* ── Pedestal and chocks the door ring stands on ──────────────────────────── */
function pedestal() {
  const out = [];
  const foot = { x: -88, y: -60, w: 176, d: 56, r: 4 };
  out.push(solid(k.slabOf(foot, 0, 6, P, 4, 0.7), { tone: "mid" }));
  out.push(D(k.corners(foot, 7).map(([x, y]) => at([x, y, 6])), { size: 0.5 }));
  const body = { x: -72, y: -54, w: 144, d: 44, r: 3 };
  out.push(solid(k.slabOf(body, 6, ZC - R_BODY - 6, P, 4, 0.7), { tone: "mid" }));
  out.push(L(k.sideSeam(body, 20, P, 4), { tone: "faint" }));
  out.push(D([[-58, -44], [58, -44], [-58, -20], [58, -20]].map(([x, y]) => at([x, y, ZC - R_BODY])), { size: 0.45 }));
  /* chocks either side, a hair under the ring body */
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? 82 : -106;
    const plan = { x: x0, y: -50, w: 24, d: 38, r: 2 };
    const top = ZC - Math.sqrt(R_BODY ** 2 - (sx > 0 ? 82 : 82) ** 2) - 2;
    out.push(solid(k.slabOf(plan, 0, top, P, 3, 0.5), { tone: "lo" }));
    out.push(D([at([x0 + 6, -44, top]), at([x0 + 18, -44, top]), at([x0 + 6, -18, top]), at([x0 + 18, -18, top])], { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

/* ── Hinge post: a rod on the plinth with three heavy knuckles; the door's arms wrap them ── */
function hinge() {
  const out = [];
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 15, 0, 4, P, 32), { tone: "lo" }));
  out.push(D([[-8, -7], [8, -7], [-8, 7], [8, 7]].map(([dx, dy]) => at([HINGE_X + dx * 1.5, HINGE_Y + dy * 1.5, 4])), { size: 0.4, tone: "lo" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 5.5, 4, ZC + 150 - 4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([60, 170].map((z) => k.sideArc(HINGE_X, HINGE_Y, 5.5, z, P, 14)).join(""), { tone: "faint" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 8, ZC + 150, 5, P, 28), { tone: "mid" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 3.4, ZC + 155, 3, P, 20), { tone: "mid" }));
  for (const dz of ARM_V) {
    const z0 = ZC + dz - 14;
    out.push(solid(k.cylinder(HINGE_X, HINGE_Y, KNUCKLE_R, z0, 28, P, 36, 0.6), { tone: "hi", crease: "lo" }));
    out.push(L(k.sideArc(HINGE_X, HINGE_Y, KNUCKLE_R, z0 + 8, P, 24) + k.sideArc(HINGE_X, HINGE_Y, KNUCKLE_R, z0 + 20, P, 24), { tone: "faint" }));
    out.push(L(k.ring(HINGE_X, HINGE_Y, 7.6, z0 + 28, P, 20), { tone: "lo" }));
    out.push(D([at([HINGE_X, HINGE_Y, z0 + 28])], { size: 0.55, tone: "hi" }));
  }
  return out.join("");
}

/* ── Frame ring: body, flange, ribs, bolt circle, instruments ─────────────── */
function frameBody() {
  const out = [];
  out.push(solid(band(-50, -8, R_BORE, R_BODY, F0, [-8, R_BORE]), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(F0, -46, -12, R_BODY, 168, P, { fade: [0.08, 0.5], seams: true }), { tone: "lo" }));
  return out.join("");
}
/* the flange is drawn in two groups so the swing can redraw just its lip over the door (see lipMask) */
function frameFlange() {
  const lip = [];
  lip.push(solid(band(-8, 0, R_BORE, R_FLANGE, F0, [0, R_BORE]), { tone: "mid" }));
  lip.push(L(G.circleOf(F0, 0, R_FLANGE - 5, P, 120) + G.circleOf(F0, 0, R_BORE + 3.2, P, 120), { tone: "faint" }));
  lip.push(L(G.circleOf(F0, 0, R_FLANGE - 1, P, 120), { tone: "mid" })); // bright rim: the flange's thickness, seen head-on
  const out = [];
  /* scale ticks hanging from the engraved ring, a long one every 15 degrees; the lamp plate and nameplate cover their own stretch */
  const ticks = [];
  for (let a = 0; a < 360; a += 3) {
    if (Math.abs(a - 90) < 14 || Math.abs(a - 270) < 14) continue;
    const [u0, v0] = polar(R_FLANGE - 5, a);
    const [u1, v1] = polar(R_FLANGE - (a % 15 === 0 ? 2.2 : 3.4), a);
    ticks.push(`M${faceAt(u0, v0).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1).map((n) => Math.round(n * 10) / 10).join(" ")}`);
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  out.push(D(G.dotsOf(F0, 0, R_FLANGE - 11, 48, P, { all: true, phase: rad(3.75) }), { size: 0.5 }));
  /* domed rivet heads in a bolt circle, one over every bracket and stiffener; the instruments take 0, 90 and 270 */
  for (let a = 15; a < 360; a += 15) {
    if (a === 90 || a === 270) continue;
    const [u, v] = polar(R_FLANGE - 11, a);
    const f = frameAtFace(u, v);
    out.push(solid(disc(0, 1.8, 3.6, f), { tone: "hi", crease: "lo" }));
    out.push(L(G.circleOf(f, 1.8, 1.7, P, 12), { tone: "mid" }), D([faceAt(u, v, 1.8)], { size: 0.5, tone: "hi" }));
  }
  return { lip: lip.join(""), detail: out.join("") };
}
/* twelve stiffener ribs welded to the flange between the brackets */
function stiffeners() {
  const out = [];
  for (let i = 0; i < BOLTS; i++) {
    const deg = 30 * i;
    out.push(solid(prism(rrect(160, 194, -2.2, 2.2, deg, 0.8), 0, 3.2), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}

/* ── Receiver brackets the bolts lock into ────────────────────────────────── */
function bracket(deg) {
  const cheek = (t0, t1) => solid(prism(rrect(158, 190, t0, t1, deg, 1.1), 0, 6.5), { tone: "mid" });
  const far = [cheek(-9.6, -6.2), cheek(6.2, 9.6)];
  const bridge = solid(prism(rrect(163, 187, -9.6, 9.6, deg, 1.2), 6.5, 8.6), { tone: "mid" });
  const dots = [[167, -7.8], [167, 7.8], [183, -7.8], [183, 7.8]].map(([rho, tau]) => {
    const [u, v] = polyRadial([[rho, tau]], deg)[0];
    return faceAt(u, v, 8.6);
  });
  /* head-on the cheeks sit either side of the bolt and never overlap it, so their order is free */
  return { first: far[0], second: far[1], bridge, dots: D(dots, { size: 0.4, tone: "lo" }) };
}

/* ── Instruments on the flange: three lamps, a gauge, a nameplate ─────────── */
function lamps() {
  const out = [];
  const plate = prism(rrect(190, 210, -27, 27, 90, 3, 3), 0, 2.4);
  out.push(solid(plate, { tone: "mid" }));
  const lampXY = [-13.5, 0, 13.5].map((tau) => polyRadial([[200, tau]], 90)[0]);
  out.push(D(polyRadial([[194, -23], [194, 23], [206, -23], [206, 23]], 90).map(([u, v]) => faceAt(u, v, 2.4)), { size: 0.42, tone: "lo" }));
  lampXY.forEach(([u, v], i) => {
    const f = frameAtFace(u, v);
    out.push(solid(disc(2.4, 3.2, 5.4, f), { tone: "mid" }));
    out.push(`<g data-vd="lamp" data-i="${i}">${solid(disc(3.2, 6.4, 3.5, f), { tone: "hi" })}</g>`);
  });
  [-13.5, 0, 13.5].forEach((tau, i) => {
    const [u, v] = polyRadial([[192.6, tau]], 90)[0];
    const O = faceAt(0, 0, 2.4);
    const ex = [faceAt(1, 0, 2.4)[0] - O[0], faceAt(1, 0, 2.4)[1] - O[1]];
    const ez = [faceAt(0, 1, 2.4)[0] - O[0], faceAt(0, 1, 2.4)[1] - O[1]];
    out.push(`<text class="iso-face-text" data-tone="lo" transform="matrix(${ex[0]} ${ex[1]} ${-ez[0]} ${-ez[1]} ${O[0] + u * ex[0] + v * ez[0]} ${O[1] + u * ex[1] + v * ez[1]})" font-size="4.4" text-anchor="middle" dominant-baseline="central">${["I", "II", "III"][i]}</text>`);
  });
  return out.join("");
}
const GAUGE_AT = [188, 0];
const GAUGE_S = 4.2;
function gauge() {
  const out = [];
  const f = frameAtFace(...GAUGE_AT);
  out.push(solid(disc(0, 2.4, 17, f), { tone: "mid" }));
  out.push(D(Array.from({ length: 4 }, (_, i) => faceAt(GAUGE_AT[0] + 14.4 * Math.cos(rad(45 + 90 * i)), GAUGE_AT[1] + 14.4 * Math.sin(rad(45 + 90 * i)), 2.4)), { size: 0.4, tone: "lo" }));
  out.push(solid(band(2.4, GAUGE_S, 12.6, 15.2, f), { tone: "hi" }));
  out.push(solid(disc(2.4, 3.2, 12.8, f), { tone: "mid", crease: "lo" }));
  const ticks = [];
  for (let i = 0; i <= 14; i++) {
    const a = 225 - (270 * i) / 14;
    const [u0, v0] = [GAUGE_AT[0] + 11.6 * Math.cos(rad(a)), GAUGE_AT[1] + 11.6 * Math.sin(rad(a))];
    const len = i % 7 === 0 ? 3.4 : i % 2 === 0 ? 2.4 : 1.6;
    const [u1, v1] = [GAUGE_AT[0] + (11.6 - len) * Math.cos(rad(a)), GAUGE_AT[1] + (11.6 - len) * Math.sin(rad(a))];
    ticks.push(`M${faceAt(u0, v0, 3.2).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1, 3.2).map((n) => Math.round(n * 10) / 10).join(" ")}`);
  }
  out.push(L(ticks.join(""), { tone: "mid" }));
  /* needle drawn pointing at the left end of the scale, rotated at runtime about the gauge centre */
  const tipP = faceAt(GAUGE_AT[0] - 8.6 * Math.cos(rad(45)), GAUGE_AT[1] - 8.6 * Math.sin(rad(45)), 3.5);
  out.push(`<g data-vd="rot" data-id="needle" data-s="3.5" data-cx="${GAUGE_AT[0]}" data-cz="${GAUGE_AT[1]}">${L(`M${faceAt(GAUGE_AT[0] + 2.4 * Math.cos(rad(45)), GAUGE_AT[1] + 2.4 * Math.sin(rad(45)), 3.5).map((n) => Math.round(n * 10) / 10).join(" ")}L${tipP.map((n) => Math.round(n * 10) / 10).join(" ")}`, { tone: "lit" })}</g>`);
  out.push(solid(disc(3.5, 5, 1.8, f), { tone: "hi" }));
  return out.join("");
}
function nameplate() {
  const out = [];
  out.push(solid(prism(rrect(190, 208, -34, 34, 270, 2.4, 3), 0, 1.4), { tone: "mid", crease: "none" }));
  out.push(D(polyRadial([[194, -30], [194, 30], [204, -30], [204, 30]], 270).map(([u, v]) => faceAt(u, v, 1.4)), { size: 0.42, tone: "lo" }));
  const [u, v] = polyRadial([[199, 0]], 270)[0];
  const O = faceAt(0, 0, 1.4);
  const ex = [faceAt(1, 0, 1.4)[0] - O[0], faceAt(1, 0, 1.4)[1] - O[1]];
  const ez = [faceAt(0, 1, 1.4)[0] - O[0], faceAt(0, 1, 1.4)[1] - O[1]];
  out.push(`<text class="iso-face-text" data-tone="mid" transform="matrix(${ex[0]} ${ex[1]} ${-ez[0]} ${-ez[1]} ${O[0] + u * ex[0] + v * ez[0]} ${O[1] + u * ex[1] + v * ez[1]})" font-size="5.2" text-anchor="middle" dominant-baseline="central" letter-spacing="0.5">STRONGROOM · 316</text>`);
  return out.join("");
}

/* ── Six bars of bullion on the plinth: what the door is holding ─────────────
   Stacked 3-2-1 with their ends to the viewer, so the pyramid reads as six trapezoids. */
const BAR = { bottom: 28, top: 21, height: 12 };
function bars(rows, CX, Y0, LEN, z0 = 0) {
  const out = [];
  for (const row of rows) {
    for (const x of row.xs) {
      const F = G.frameOf([CX + x, Y0, z0 + row.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const poly = [[-BAR.bottom / 2, 0], [BAR.bottom / 2, 0], [BAR.top / 2, BAR.height], [-BAR.top / 2, BAR.height]];
      out.push(solid(G.prismOf(F, poly, 0, LEN, P), { tone: "hi", crease: "lo" }));
      out.push(L(k.planOutline({ x: CX + x - 6, y: Y0 + 7, w: 12, d: LEN - 14, r: 2.5 }, z0 + row.z + BAR.height, P, 3), { tone: "lo" }));
    }
  }
  return out.join("");
}
const bullion = () =>
  bars(
    [
      { z: 0, xs: [-31, 0, 31] },
      { z: BAR.height, xs: [-15.5, 15.5] },
      { z: BAR.height * 2, xs: [0] },
    ],
    150,
    6,
    62,
  );

/* ── The vault behind the door: a bored chamber, a back wall and a few bars on a pallet ──
   Seen only through the open door, so it is drawn dark; the bars are the one bright thing in it. */
function chamber() {
  const wall = [];
  const back = -CHAMBER;
  wall.push(solid(disc(back, back + 4, R_BORE + 1, F0), { tone: "lo", crease: "none" }));
  wall.push(L(G.circleOf(F0, back + 4, R_BORE - 34, P, 96) + G.circleOf(F0, back + 4, R_BORE - 84, P, 72), { tone: "faint" }));
  wall.push(D(G.dotsOf(F0, back + 4, R_BORE - 12, 36, P, { all: true }), { size: 0.5, tone: "lo" }));
  wall.push(solid(band(back + 4, -50, R_BORE, R_BORE + 3, F0, [-50, R_BORE]), { tone: "mid", crease: "lo" }));
  const floor = ZC - R_BORE;
  const pallet = { x: -31, y: back + 12, w: 62, d: 58, r: 2 };
  const gold = [solid(k.slabOf(pallet, floor, 3.5, P, 3, 0.4), { tone: "mid" })];
  gold.push(bars([{ z: 0, xs: [-14.5, 14.5] }, { z: BAR.height, xs: [0] }], 0, pallet.y + 2, 54, floor + 3.5));
  return `<g class="vd-recess">${wall.join("")}</g>${gold.join("")}`;
}

/* ── Assemble in painter's order ──────────────────────────────────────────────
   Two trees share the frame. "closed" is the shut door with the hooks VaultDoor drives cheaply (bolts, ring, dial,
   needle); "swing" is the frame with no door in it, and VaultDoor redraws the door into it at every angle. */
const units = Array.from({ length: BOLTS }, (_, i) => ({ i, deg: BOLT_AT(i) }));
const flange = frameFlange();
const brackets = units.map(({ deg }) => bracket(deg));
const bracketsAll = brackets.map((b) => b.first + b.second + b.bridge + b.dots).join("");

const boltLayer = units
  .map(({ i, deg }) => {
    const b = brackets[i];
    return `${b.first}<g data-vd="bolt" data-i="${i}" data-deg="${deg}">${door.bolt(deg)}</g>${b.second}${b.bridge}${b.dots}`;
  })
  .join("");
const pinLayer = units.map(({ i, deg }) => `<g data-vd="pin" data-i="${i}" data-deg="${deg}">${door.pin(deg)}</g>`).join("");
const ring = door.ringSlots(0);
const ringLayer = `<g data-vd="rot" data-id="ring" data-s="${RING_S[1]}" transform="${turnMatrix(RING_S[1], RING_SWEEP)}"><path class="vd-slot" d="${ring.holes}"/>${ring.dots}</g>`;
const dialLayer = door.dialFace(0, `data-vd="rot" data-id="dial" data-s="${DIAL_S}"`);
const knobLayer = door.knob(0, `data-vd="rot" data-id="knob" data-s="${KNOB_S}"`);

const use = (id) => `<use href="#${id}"/>`;
const defs = `<defs>
<g id="vd-flange-lip">${flange.lip}</g><g id="vd-flange">${flange.detail}</g><g id="vd-stiff">${stiffeners()}</g><g id="vd-inst">${lamps()}${gauge()}${nameplate()}</g><g id="vd-brackets">${bracketsAll}</g>
<g id="vd-lip">${use("vd-flange-lip")}${use("vd-stiff")}${use("vd-brackets")}</g>
<clipPath id="vd-floor"><path d="${k.planOutline(PLATE, 0, P)}"/></clipPath>
<clipPath id="vd-ring"><path clip-rule="evenodd" d="${G.circleOf(F0, 0, R_BORE + 16, P, 120)}${G.circleOf(F0, 0, R_BORE, P, 120)}"/></clipPath>
<clipPath id="vd-hull"><path clip-rule="evenodd" data-vd="hull" d="M0 0H${WIDTH}V${HEIGHT}H0Z"/></clipPath>
</defs>`;

const frameFront = use("vd-flange-lip") + use("vd-flange") + use("vd-stiff") + use("vd-inst");

const CLOSED = [door.body(), frameFront, door.race(), boltLayer, door.ringTop(), ringLayer, pinLayer, door.dialStatic(), dialLayer, knobLayer, door.indexLug(), door.arms()].join("");
/* swing: the door goes in between the base frame and its redrawn lip; the arms sit above the lip, always in front of it */
const SWING = `${frameFront}${use("vd-brackets")}<g data-vd="door"></g><g clip-path="url(#vd-ring)"><g clip-path="url(#vd-hull)">${use("vd-lip")}</g></g><g data-vd="arms"></g>`;

const BODY = [
  defs,
  plinth(),
  `<g clip-path="url(#vd-floor)"><path data-vd="shadow" class="vd-shadow" d="" opacity="0"/></g>`,
  pedestal(),
  hinge(),
  chamber(),
  frameBody(),
  `<g data-vd="closed">${CLOSED}</g>`,
  `<g data-vd="swing" display="none">${SWING}</g>`,
  bullion(),
].join("");

const LABEL =
  "A front-facing round vault door on a stand. A hundred-division combination dial sits in the centre, ringed by a drive plate cut with twelve spiral slots; each slot holds a pin that carries one of twelve sliding bolts. Dial the combination 24, 61, 08 and the three lamps light, the drive plate turns 28 degrees, and the bolts withdraw from their brackets. Six bars of bullion stand on the plinth in front. Scrolling turns the dial a quarter turn, withdraws the bolts, then swings the door ninety degrees about its left-hand hinge to show the vault behind.";

const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BODY });

/* ── Runtime constants and the tokens that make the kit's ink read on the hero blue ── */
const CSS = `
.vd{
  --anatomy-paper:#2b61eb;--anatomy-face:#5a8cf8;--anatomy-top:#9dbcfc;
  --anatomy-shade-0:#112f8c;--anatomy-shade-1:#1a43ad;--anatomy-shade-2:#3669ee;--anatomy-shade-3:#5a8cf8;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#cddfff;
  --anatomy-hi:rgb(255 255 255/.96);--anatomy-mid:rgb(255 255 255/.62);--anatomy-lo:rgb(255 255 255/.36);--anatomy-faint:rgb(255 255 255/.18);--anatomy-lit:#fff;
  --anatomy-halo:#0a2478;--anatomy-halo-opacity:.6;--anatomy-dot:#fff;
  --anatomy-weight:.6px;--anatomy-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
.vd .iso-svg{display:block;width:100%;height:auto;overflow:visible}
.vd .iso-fill{fill-rule:evenodd}
/* Site rule -- an Anatomy figure floats under the fixed navbar, so it is centred in the band
   below the bar and never taller than that band; it cannot slide under the bar on a short window.
   --iso-nav is the bar (its padding plus the 3.25rem rounded box) and its gap, --iso-gap the air
   under the art, --iso-caption the one live line beneath the figure. The band mirrors the hero's
   own min-h, and the cap is a max-width, not a max-height, so the viewBox ratio stays exact and
   the caption keeps the art's width. */
.iso-band{
  --iso-nav:4.75rem;--iso-gap:2rem;--iso-caption:1.35rem;--iso-aspect:${(WIDTH / HEIGHT).toFixed(4)};
  top:var(--iso-nav);bottom:var(--iso-gap);margin-left:auto;
  max-width:calc((max(40rem,88svh) - var(--iso-nav) - var(--iso-gap) - var(--iso-caption)) * var(--iso-aspect));
}
@media (min-width:640px){.iso-band{--iso-nav:5.25rem}}
.vd .vd-recess{--anatomy-paper:#0b2a7d;--anatomy-top:#16419f;--anatomy-shade-0:#061a58;--anatomy-shade-1:#0a2670;--anatomy-shade-2:#10358f;--anatomy-shade-3:#1a49b0}
.vd .vd-shadow{fill:#061a58;filter:blur(7px)}
.vd .vd-slot{fill:rgb(10 36 130/.55);stroke:var(--anatomy-mid);stroke-width:.6px;stroke-linejoin:round}
.vd .vd-num{font-family:var(--anatomy-mono);font-weight:600}
.vd [data-vd="lamp"] .iso-solid>.iso-fill{fill:#1d46bd}
.vd [data-vd="lamp"][data-on] .iso-solid>.iso-top{fill:#fff}
.vd [data-vd="lamp"][data-on] .iso-solid>.iso-shade{fill:#cddfff}
.vd [data-vd="lamp"][data-on] .iso-edge{stroke:#fff}
.vd [data-vd="lamp"][data-on]{filter:drop-shadow(0 0 5px rgb(255 255 255/.85))}
`;

const consts = {
  viewBox: [WIDTH, HEIGHT],
  P: { origin: P.origin, scale: P.scale, azimuth: P.azimuth, elevation: P.elevation },
  ZC,
  bolts: BOLTS,
  boltAt: Array.from({ length: BOLTS }, (_, i) => BOLT_AT(i)),
  pinFrom: PIN_FROM,
  pinTravel: PIN_TRAVEL,
  ringSweep: RING_SWEEP,
  combination: COMBINATION,
  dial: { s: DIAL_S, knobS: KNOB_S, knobR: KNOB_R, edgeR: DIAL_R },
  gauge: { cx: GAUGE_AT[0], cz: GAUGE_AT[1] },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, "art.generated.ts"),
  `// Generated by scripts/vault-door/build.mjs — do not edit by hand.\n` +
    `export const VAULT_ART = ${JSON.stringify({ ...consts, label: LABEL, svg: BODY })} as const;\n`,
);
writeFileSync(join(OUT, "vault-door.css"), `/* Generated by scripts/vault-door/build.mjs — the Anatomy kit's ink, tuned to the hero blue. */\n${k.ISO_CSS}\n${CSS}`);

if (process.env.VD_PREVIEW) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${k.ISO_CSS}${CSS}html,body{margin:0;background:#2b61eb}.wrap{width:min(1100px,100vw);margin:0 auto}</style></head><body><div class="wrap iso vd">${svg}</div></body></html>`;
  writeFileSync(process.env.VD_PREVIEW, html);
}
console.log(`vault door: ${solids} solids, ${(BODY.length / 1024).toFixed(0)} KB of markup`);
