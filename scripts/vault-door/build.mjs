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

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "src", "components", "landing", "vault-door");
const rad = (deg) => (deg * Math.PI) / 180;

/* Camera: azimuth 90 looks straight down +y at the door face, so the dial and drive ring read as true circles;
   elevation 8 keeps a sliver of the top, enough to show the frame's depth. With the face frontal, depth order is
   decided by height off the face (s) alone, so the painter's order below needs no per-angle sorting. */

/* ── The truth the figure runs on ─────────────────────────────────────────── */
const BOLTS = 12;
const BOLT_AT = (i) => 15 + 30 * i; // degrees, counter-clockwise from +x on the door face
const PIN_FROM = 104; // pin radius with the bolts withdrawn
const PIN_TRAVEL = 34; // pin (and bolt) travel
const RING_SWEEP = 28; // drive ring turns this far, and the spiral slots are cut to match
const COMBINATION = [24, 61, 8];

/* ── World ────────────────────────────────────────────────────────────────── */
const WIDTH = 640;
const HEIGHT = 620;
const ZC = 240; // door axis height above the plinth top
const R_BODY = 204;
const R_FLANGE = 214;
const R_BORE = 154.5;
const R_DOOR = 152;
const R_FACE = 148;
const R_RING_IN = 86;
const R_RING_OUT = 144;
const RING_S = [4.2, 7.6];
const BOLT_W = 4.8; // half width
const BOLT_LEN = 44;
const BOLT_S = [0.3, 3.6];

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

/* a point on the door face, in the door's own (u, v) = (x, z) coordinates, at depth s */
const face = (u, v, s = 0) => [u, s, ZC + v];
const faceAt = (u, v, s = 0) => at(face(u, v, s));
const polar = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

/* a rounded rectangle in radial coordinates (rho outward, tau across), rotated onto the door */
function rrect(rho0, rho1, tau0, tau1, deg, rc = 1, n = 2) {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const to = (rho, tau) => [rho * c - tau * s, rho * s + tau * c];
  const r = Math.min(rc, (rho1 - rho0) / 2, (tau1 - tau0) / 2);
  const out = [];
  const corner = (cr, ct, a0) => {
    for (let j = 0; j <= n; j++) {
      const a = rad(a0 + (90 * j) / n);
      out.push(to(cr + r * Math.cos(a), ct + r * Math.sin(a)));
    }
  };
  corner(rho1 - r, tau1 - r, 0);
  corner(rho0 + r, tau1 - r, 90);
  corner(rho0 + r, tau0 + r, 180);
  corner(rho1 - r, tau0 + r, 270);
  return out;
}
const polyRadial = (points, deg) => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return points.map(([rho, tau]) => [rho * c - tau * s, rho * s + tau * c]);
};
/* facet counts only set the tone fills (outlines are analytic), so keep them modest */
const facets = (r) => Math.max(14, Math.min(88, Math.round(r * 0.5)));
const disc = (s0, s1, r, F) => G.disc(s0, s1, r, F, P, { steps: facets(r) });
const band = (s0, s1, rIn, rOut, F) => G.ringBand(s0, s1, rIn, rOut, F, P, { steps: facets(rOut) });
const prism = (poly, s0, s1) => G.prismOf(F0, poly, s0, s1, P);
const frameAtFace = (u, v) => G.frameOf([u, 0, ZC + v], [0, 1, 0], [1, 0, 0], [0, 0, 1]);

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

/* ── Hinge post with three knuckles, joined to the ring by arms ───────────── */
const HINGE_X = -229;
const HINGE_Y = -40;
const KNUCKLE_DZ = [112, 0, -112];
function hinge() {
  const out = [];
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 15, 0, 4, P, 32), { tone: "lo" }));
  out.push(D([[-8, -7], [8, -7], [-8, 7], [8, 7]].map(([dx, dy]) => at([HINGE_X + dx * 1.5, HINGE_Y + dy * 1.5, 4])), { size: 0.4, tone: "lo" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 5.5, 4, ZC + 150 - 4, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([60, 170].map((z) => k.sideArc(HINGE_X, HINGE_Y, 5.5, z, P, 14)).join(""), { tone: "faint" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 8, ZC + 150, 5, P, 28), { tone: "mid" }));
  out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 3.4, ZC + 155, 3, P, 20), { tone: "mid" }));
  for (const dz of KNUCKLE_DZ) {
    const z0 = ZC + dz - 14;
    out.push(solid(k.cylinder(HINGE_X, HINGE_Y, 11, z0, 28, P, 36, 0.6), { tone: "hi", crease: "lo" }));
    out.push(L(k.sideArc(HINGE_X, HINGE_Y, 11, z0 + 8, P, 24) + k.sideArc(HINGE_X, HINGE_Y, 11, z0 + 20, P, 24), { tone: "faint" }));
    out.push(L(k.ring(HINGE_X, HINGE_Y, 7.6, z0 + 28, P, 20), { tone: "lo" }));
    out.push(D([at([HINGE_X, HINGE_Y, z0 + 28])], { size: 0.55, tone: "hi" }));
    const edge = Math.sqrt(R_BODY ** 2 - dz ** 2);
    const arm = { x: HINGE_X + 11, y: HINGE_Y - 8, w: -edge - (HINGE_X + 11), d: 16, r: 1.5 };
    out.push(solid(k.slabOf(arm, ZC + dz - 8, 16, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([arm.x + 8, HINGE_Y, ZC + dz + 8]), at([arm.x + arm.w - 8, HINGE_Y, ZC + dz + 8])], { size: 0.45 }));
  }
  return out.join("");
}

/* ── Frame ring: body, flange, ribs, bolt circle, instruments ─────────────── */
function frameBody() {
  const out = [];
  out.push(solid(band(-50, -8, R_BORE, R_BODY, F0), { tone: "mid" }));
  out.push(k.fadedSvg(G.ribsOf(F0, -46, -12, R_BODY, 168, P, { fade: [0.08, 0.5], seams: true }), { tone: "lo" }));
  return out.join("");
}
function frameFlange() {
  const out = [];
  out.push(solid(band(-8, 0, R_BORE, R_FLANGE, F0), { tone: "mid" }));
  out.push(L(G.circleOf(F0, 0, R_FLANGE - 5, P, 120) + G.circleOf(F0, 0, R_BORE + 3.2, P, 120), { tone: "faint" }));
  out.push(L(G.circleOf(F0, 0, R_FLANGE - 1, P, 120), { tone: "mid" })); // bright rim: the flange's thickness, seen head-on
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
  return out.join("");
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

/* ── One bolt: body, nose, serrations; pin drawn later above the ring ─────── */
const RHO_IN = PIN_FROM + PIN_TRAVEL - 8; // locked position
function bolt(deg) {
  const body = solid(prism(rrect(RHO_IN, RHO_IN + BOLT_LEN - 6, -BOLT_W, BOLT_W, deg, 0.8), BOLT_S[0], BOLT_S[1]), { tone: "lit", lit: true });
  const nose = solid(prism(polyRadial([[RHO_IN + BOLT_LEN - 6, -BOLT_W], [RHO_IN + BOLT_LEN - 0.4, -2.4], [RHO_IN + BOLT_LEN - 0.4, 2.4], [RHO_IN + BOLT_LEN - 6, BOLT_W]], deg), BOLT_S[0], BOLT_S[1]), { tone: "lit", lit: true, crease: "none" });
  const ticks = [];
  for (let rho = RHO_IN + 12; rho <= RHO_IN + BOLT_LEN - 9; rho += 4) {
    for (const sign of [-1, 1]) {
      const [u0, v0] = polyRadial([[rho, sign * BOLT_W]], deg)[0];
      const [u1, v1] = polyRadial([[rho, sign * (BOLT_W - 1.7)]], deg)[0];
      ticks.push(`M${faceAt(u0, v0, BOLT_S[1]).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1, BOLT_S[1]).map((n) => Math.round(n * 10) / 10).join(" ")}`);
    }
  }
  const [gu0, gv0] = polyRadial([[RHO_IN + 11, 0]], deg)[0];
  const [gu1, gv1] = polyRadial([[RHO_IN + BOLT_LEN - 9, 0]], deg)[0];
  const groove = `M${faceAt(gu0, gv0, BOLT_S[1]).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(gu1, gv1, BOLT_S[1]).map((n) => Math.round(n * 10) / 10).join(" ")}`;
  return body + nose + L(ticks.join(""), { tone: "mid" }) + L(groove, { tone: "mid", free: true });
}

function pin(deg) {
  const [u, v] = polar(RHO_IN + 8, deg);
  const f = frameAtFace(u, v);
  return solid(disc(BOLT_S[1], RING_S[1] + 0.4, 2.7, f), { tone: "hi" }) + solid(disc(RING_S[1] + 0.4, RING_S[1] + 1.8, 4, f), { tone: "hi" });
}

/* ── Door ─────────────────────────────────────────────────────────────────── */
function doorBody() {
  const out = [];
  out.push(solid(G.solidOf([[-44, R_DOOR], [-3, R_DOOR], [-3, R_FACE], [0, R_FACE]], F0, P, { steps: 96 }), { tone: "hi" }));
  /* the step between the door's rim and its face plate carries a row of screws, and each bolt a channel */
  out.push(D(G.dotsOf(F0, -3, R_DOOR - 2.2, 36, P, { all: true, phase: rad(0) }), { size: 0.45 }));
  const channels = [];
  for (let i = 0; i < BOLTS; i++) {
    const deg = BOLT_AT(i);
    for (const sign of [-1, 1]) {
      const [u0, v0] = polyRadial([[R_RING_OUT, sign * 7]], deg)[0];
      const [u1, v1] = polyRadial([[R_FACE, sign * 7]], deg)[0];
      channels.push(`M${faceAt(u0, v0).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1).map((n) => Math.round(n * 10) / 10).join(" ")}`);
    }
  }
  out.push(L(channels.join(""), { tone: "lo" }));
  return out.join("");
}

/* ── Drive ring: a plate on the bearing race, cut with spiral slots ───────── */
function slotPath() {
  const half = 3.1;
  const centre = (t) => {
    const r = PIN_FROM + PIN_TRAVEL * t;
    return { r, phi: -RING_SWEEP * t }; // degrees relative to the pin's own angle
  };
  const pts = [];
  const N = 22;
  const T0 = -0.07;
  const T1 = 1.07;
  const slots = [];
  for (let i = 0; i < BOLTS; i++) {
    const base = BOLT_AT(i);
    const line = [];
    for (let j = 0; j <= N; j++) {
      const t = T0 + ((T1 - T0) * j) / N;
      const { r, phi } = centre(t);
      line.push({ r, a: rad(base + phi) });
    }
    const centreXY = line.map(({ r, a }) => [r * Math.cos(a), r * Math.sin(a)]);
    const normalAt = (j) => {
      const a = centreXY[Math.max(0, j - 1)];
      const b = centreXY[Math.min(N, j + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      return [-dy / len, dx / len];
    };
    const left = centreXY.map((p, j) => [p[0] + normalAt(j)[0] * half, p[1] + normalAt(j)[1] * half]);
    const right = centreXY.map((p, j) => [p[0] - normalAt(j)[0] * half, p[1] - normalAt(j)[1] * half]).reverse();
    const capAt = (j, sign) => {
      const [nx, ny] = normalAt(j);
      const [tx, ty] = [ny, -nx]; // path direction (right-hand of the left normal)
      const c = centreXY[j];
      const out = [];
      for (let q = 1; q < 7; q++) {
        const psi = (Math.PI * q) / 7;
        out.push([c[0] + half * (Math.cos(psi) * nx * sign + Math.sin(psi) * tx * -sign * -1), c[1] + half * (Math.cos(psi) * ny * sign + Math.sin(psi) * ty * -sign * -1)]);
      }
      return out;
    };
    const ring = [...left, ...capAt(N, 1), ...right, ...capAt(0, -1)];
    slots.push(ring);
  }
  return slots;
}
function driveRing() {
  const out = [];
  out.push(solid(band(0, RING_S[0], 80, 90, F0), { tone: "mid" })); // bearing race
  return out.join("");
}
function driveRingTop() {
  const out = [];
  out.push(solid(band(RING_S[0], RING_S[1], R_RING_IN, R_RING_OUT, F0), { tone: "hi" }));
  out.push(L(G.circleOf(F0, RING_S[1], R_RING_IN + 3.4, P, 96) + G.circleOf(F0, RING_S[1], R_RING_OUT - 3.4, P, 120), { tone: "faint" }));
  out.push(L(G.circleOf(F0, RING_S[1], R_RING_OUT, P, 120) + G.circleOf(F0, RING_S[1], R_RING_IN, P, 96), { tone: "mid" }));
  return out.join("");
}
function ringSlots() {
  const holes = slotPath().map((ring) => `M${ring.map(([u, v]) => faceAt(u, v, RING_S[1]).map((n) => Math.round(n * 10) / 10).join(" ")).join("L")}Z`);
  const dots = [];
  for (let i = 0; i < 36; i++) {
    const [u, v] = polar(97.5, i * 10 + 5);
    dots.push(faceAt(u, v, RING_S[1]));
  }
  return `<g data-vd="rot" data-id="ring" data-s="${RING_S[1]}" transform="${turnMatrix(RING_S[1], RING_SWEEP)}"><path class="vd-slot" d="${holes.join("")}"/>${D(dots, { size: 0.45, tone: "lo" })}</g>`;
}

/* ── Combination dial ─────────────────────────────────────────────────────── */
const DIAL_S = 9;
const KNOB_S = 17;
const DIAL_R = 66;
const KNOB_R = 24;
function dialStatic() {
  const out = [];
  out.push(solid(disc(0, 3, 79.6, F0), { tone: "mid" }));
  /* a stepped bezel: a low outer step carrying the screws and the scale, a taller inner step round the dial */
  out.push(solid(band(3, 6, 72.6, 78, F0), { tone: "hi" }));
  out.push(solid(band(3, DIAL_S, DIAL_R + 0.6, 72.6, F0), { tone: "hi" }));
  const screws = [];
  for (let i = 0; i < 8; i++) screws.push(faceAt(...polar(75.3, i * 45 + 22.5), 6));
  out.push(L(G.circleOf(F0, 6, 75.3, P, 60), { tone: "faint" }), D(screws, { size: 0.5 }));
  out.push(L(G.circleOf(F0, 6, 78, P, 120) + G.circleOf(F0, DIAL_S, 72.6, P, 100), { tone: "mid" }));
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = i * 10;
    const [u0, v0] = polar(78, a);
    const [u1, v1] = polar(i % 3 === 0 ? 74.4 : 76, a);
    ticks.push(`M${faceAt(u0, v0, 6).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1, 6).map((n) => Math.round(n * 10) / 10).join(" ")}`);
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  out.push(solid(disc(3, DIAL_S, DIAL_R, F0), { tone: "hi" }));
  return out.join("");
}
function dialFace() {
  const minor = [];
  const mid = [];
  const major = [];
  for (let i = 0; i < 100; i++) {
    const a = 90 - i * 3.6;
    const len = i % 10 === 0 ? 6 : i % 5 === 0 ? 4.4 : 2.8;
    const [u0, v0] = polar(DIAL_R - 1.4, a);
    const [u1, v1] = polar(DIAL_R - 1.4 - len, a);
    const d = `M${faceAt(u0, v0, DIAL_S).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1, DIAL_S).map((n) => Math.round(n * 10) / 10).join(" ")}`;
    (i % 10 === 0 ? major : i % 5 === 0 ? mid : minor).push(d);
  }
  const O = faceAt(0, 0, DIAL_S);
  const ex = [faceAt(1, 0, DIAL_S)[0] - O[0], faceAt(1, 0, DIAL_S)[1] - O[1]];
  const ez = [faceAt(0, 1, DIAL_S)[0] - O[0], faceAt(0, 1, DIAL_S)[1] - O[1]];
  const faceMatrix = (px, py) => `matrix(${ex[0]} ${ex[1]} ${-ez[0]} ${-ez[1]} ${O[0] + px * ex[0] - py * ez[0]} ${O[1] + px * ex[1] - py * ez[1]})`;
  const numerals = [];
  for (let i = 0; i < 100; i += 10) {
    const a = 90 - i * 3.6;
    const [px, pz] = polar(52, a);
    numerals.push(`<text class="iso-face-text vd-num" data-tone="hi" transform="${faceMatrix(px, -pz)} rotate(${i * 3.6})" font-size="7.4" text-anchor="middle" dominant-baseline="central">${i}</text>`);
  }
  return `<g data-vd="rot" data-id="dial" data-s="${DIAL_S}">${L(minor.join(""), { tone: "lo" })}${L(mid.join(""), { tone: "mid" })}${L(major.join(""), { tone: "hi" })}${L(G.circleOf(F0, DIAL_S, DIAL_R - 1, P, 120) + G.circleOf(F0, DIAL_S, 42, P, 90) + G.circleOf(F0, DIAL_S, 33, P, 72), { tone: "lo" })}${numerals.join("")}</g>`;
}
const KNURL = 72;
function knurlAt(rotDeg) {
  const V = G.viewOf(P);
  const lines = [];
  for (let j = 0; j < KNURL; j++) {
    const t = rad(rotDeg) + (j / KNURL) * Math.PI * 2;
    if (Math.cos(t) * V[0] + Math.sin(t) * V[2] < 0.14) continue;
    const a = at(face(KNOB_R * Math.cos(t), KNOB_R * Math.sin(t), DIAL_S + 0.7));
    const b = at(face(KNOB_R * Math.cos(t), KNOB_R * Math.sin(t), KNOB_S - 0.7));
    lines.push(`M${a.map((n) => Math.round(n * 10) / 10).join(" ")}L${b.map((n) => Math.round(n * 10) / 10).join(" ")}`);
  }
  return lines.join("");
}
function knob() {
  const out = [];
  out.push(solid(disc(DIAL_S, KNOB_S, KNOB_R, F0), { tone: "hi", crease: "lo" }));
  out.push(`<path data-vd="knurl" class="iso-line" data-tone="lo" d="${knurlAt(0)}"/>`);
  out.push(L(G.circleOf(F0, KNOB_S, KNOB_R - 2.8, P, 64), { tone: "lo" }));
  const top = [];
  const O = faceAt(0, 0, KNOB_S);
  /* the knurl seen head-on is a serrated rim: short ticks hanging from the edge, turning with the knob */
  const serration = [];
  for (let a = 0; a < 360; a += 10) {
    const [u0, v0] = polar(KNOB_R, a);
    const [u1, v1] = polar(KNOB_R - 2.8, a);
    serration.push(`M${faceAt(u0, v0, KNOB_S).map((n) => Math.round(n * 10) / 10).join(" ")}L${faceAt(u1, v1, KNOB_S).map((n) => Math.round(n * 10) / 10).join(" ")}`);
  }
  top.push(L(serration.join(""), { tone: "lo" }));
  /* a pointer and a collar on the knob's top; they turn with it */
  const tip = faceAt(0, KNOB_R - 5, KNOB_S);
  const tail = faceAt(0, -9, KNOB_S);
  top.push(L(`M${tail.map((n) => Math.round(n * 10) / 10).join(" ")}L${tip.map((n) => Math.round(n * 10) / 10).join(" ")}`, { tone: "lit" }));
  top.push(L(G.circleOf(F0, KNOB_S, 6, P, 40), { tone: "mid" }));
  top.push(D([O], { size: 0.8, tone: "hi" }));
  out.push(`<g data-vd="rot" data-id="knob" data-s="${KNOB_S}">${top.join("")}</g>`);
  return out.join("");
}
function indexLug() {
  const tri = [[-3.6, 78.4], [3.6, 78.4], [0, DIAL_R + 1.6]];
  return solid(prism(tri, 6, DIAL_S + 1.8), { tone: "lit", lit: true, crease: "none" });
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
function bullion() {
  const out = [];
  const CX = 150;
  const Y0 = 6;
  const LEN = 62;
  const BAR = { bottom: 28, top: 21, height: 12 };
  const rows = [
    { z: 0, xs: [-31, 0, 31] },
    { z: BAR.height, xs: [-15.5, 15.5] },
    { z: BAR.height * 2, xs: [0] },
  ];
  for (const row of rows) {
    for (const x of row.xs) {
      const F = G.frameOf([CX + x, Y0, row.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      const poly = [[-BAR.bottom / 2, 0], [BAR.bottom / 2, 0], [BAR.top / 2, BAR.height], [-BAR.top / 2, BAR.height]];
      out.push(solid(G.prismOf(F, poly, 0, LEN, P), { tone: "hi", crease: "lo" }));
      out.push(L(k.planOutline({ x: CX + x - 6, y: Y0 + 7, w: 12, d: LEN - 14, r: 2.5 }, row.z + BAR.height, P, 3), { tone: "lo" }));
    }
  }
  return out.join("");
}

/* ── Assemble in painter's order ──────────────────────────────────────────── */
const units = Array.from({ length: BOLTS }, (_, i) => ({ i, deg: BOLT_AT(i) }));

const boltLayer = units
  .map(({ i, deg }) => {
    const b = bracket(deg);
    return `${b.first}<g data-vd="bolt" data-i="${i}" data-deg="${deg}">${bolt(deg)}</g>${b.second}${b.bridge}${b.dots}`;
  })
  .join("");
const pinLayer = units.map(({ i, deg }) => `<g data-vd="pin" data-i="${i}" data-deg="${deg}">${pin(deg)}</g>`).join("");

const BODY = [
  plinth(),
  pedestal(),
  hinge(),
  frameBody(),
  doorBody(),
  frameFlange(),
  stiffeners(),
  lamps(),
  gauge(),
  nameplate(),
  driveRing(),
  boltLayer,
  driveRingTop(),
  ringSlots(),
  pinLayer,
  dialStatic(),
  dialFace(),
  knob(),
  indexLug(),
  bullion(),
].join("");

const LABEL =
  "A front-facing round vault door on a stand. A hundred-division combination dial sits in the centre, ringed by a drive plate cut with twelve spiral slots; each slot holds a pin that carries one of twelve sliding bolts. Dial the combination 24, 61, 08 and the three lamps light, the drive plate turns 28 degrees, and the bolts withdraw from their brackets. Six bars of bullion stand on the plinth in front.";

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
