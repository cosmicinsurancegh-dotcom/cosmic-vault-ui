/**
 * The vault door as one rigid body that turns about the hinge line.
 *
 *   makeDoor(P, thetaDeg)  -> the door drawn at that angle (0 = shut, 90 = standing out square to the frame)
 *
 * build.mjs calls it at 0 for the shut art (whose moving parts carry data-vd hooks that VaultDoor drives with
 * cheap transforms); VaultDoor.tsx calls it per frame while the door swings, with the bolts, drive ring and
 * dial already at their open positions. One drawing code, so the shut door and the swinging door cannot drift.
 *
 * Painter's order inside the door is height off the door face (s), because the door is only ever seen from its
 * front: it turns from 0 to 90 degrees, so its face never turns away.
 */
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const rad = (deg) => (deg * Math.PI) / 180;
const tenth = (n) => Math.round(n * 10) / 10;
const xy = (p) => `${tenth(p[0])} ${tenth(p[1])}`;

/* ── The truth the figure runs on ─────────────────────────────────────────── */
export const BOLTS = 12;
export const BOLT_AT = (i) => 15 + 30 * i; // degrees, counter-clockwise from +x on the door face
export const PIN_FROM = 104; // pin radius with the bolts withdrawn
export const PIN_TRAVEL = 34; // pin (and bolt) travel
export const RING_SWEEP = 28; // drive ring turns this far, and the spiral slots are cut to match
export const COMBINATION = [24, 61, 8];

/* ── World ────────────────────────────────────────────────────────────────── */
export const ZC = 240; // door axis height above the plinth top
export const R_BODY = 204;
export const R_FLANGE = 214;
export const R_BORE = 154.5;
export const R_DOOR = 152;
export const R_FACE = 148;
export const R_RING_IN = 86;
export const R_RING_OUT = 144;
export const RING_S = [4.2, 7.6];
export const BOLT_W = 4.8; // half width
export const BOLT_LEN = 44;
export const BOLT_S = [0.3, 3.6];
export const DOOR_BACK = -44; // the door's rear face, in its own s
export const RHO_IN = PIN_FROM + PIN_TRAVEL - 8; // bolt tail radius when locked

export const DIAL_S = 9;
export const KNOB_S = 17;
export const DIAL_R = 66;
export const KNOB_R = 24;
export const KNURL = 72;

/* The hinge: a vertical pin in front of the flange plane, so the door's front-left edge swings away from the
   frame instead of into it. Three arms carry the door to it, a hair above the face. */
export const HINGE_X = -229;
export const HINGE_Y = 8;
export const ARM_V = [90, 0, -90]; // arm centre heights on the door face
export const ARM_S = [4, 12]; // arm thickness, in door s: centred on the pin
export const ARM_HALF = 8; // half the arm's height
export const KNUCKLE_R = 11;
export const GASKET = { s: [-3, -1], r: [148.2, 152.6] };

const polar = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

/** a rounded rectangle in radial coordinates (rho outward, tau across), rotated by deg onto the door */
export function rrect(rho0, rho1, tau0, tau1, deg, rc = 1, n = 2) {
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
export const polyRadial = (points, deg) => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return points.map(([rho, tau]) => [rho * c - tau * s, rho * s + tau * c]);
};
/* a rounded rectangle on the door face, in (u, v) */
function rect(u0, u1, v0, v1, rc = 1, n = 2) {
  const r = Math.min(rc, (u1 - u0) / 2, (v1 - v0) / 2);
  const out = [];
  const corner = (cu, cv, a0) => {
    for (let j = 0; j <= n; j++) {
      const a = rad(a0 + (90 * j) / n);
      out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
    }
  };
  corner(u1 - r, v1 - r, 0);
  corner(u0 + r, v1 - r, 90);
  corner(u0 + r, v0 + r, 180);
  corner(u1 - r, v0 + r, 270);
  return out;
}

/** The spiral slots in the drive ring, as closed outlines in (u, v), cut to the sweep the pins ride. */
export function slotOutlines() {
  const half = 3.1;
  const N = 22;
  const T0 = -0.07;
  const T1 = 1.07;
  const slots = [];
  for (let i = 0; i < BOLTS; i++) {
    const base = BOLT_AT(i);
    const line = [];
    for (let j = 0; j <= N; j++) {
      const t = T0 + ((T1 - T0) * j) / N;
      line.push({ r: PIN_FROM + PIN_TRAVEL * t, a: rad(base - RING_SWEEP * t) });
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
      const [tx, ty] = [ny, -nx];
      const c = centreXY[j];
      const out = [];
      for (let q = 1; q < 7; q++) {
        const psi = (Math.PI * q) / 7;
        out.push([c[0] + half * (Math.cos(psi) * nx * sign + Math.sin(psi) * tx * -sign * -1), c[1] + half * (Math.cos(psi) * ny * sign + Math.sin(psi) * ty * -sign * -1)]);
      }
      return out;
    };
    slots.push([...left, ...capAt(N, 1), ...right, ...capAt(0, -1)]);
  }
  return slots;
}

/** What the lock does as it opens: open = 0 locked, 1 withdrawn. */
export const lockAt = (open) => ({ ring: RING_SWEEP * (1 - open), needle: -270 * open, slide: PIN_TRAVEL * open });

/**
 * The door at `theta` degrees. Everything is drawn from one frame: o, the door face centre, a, its outward
 * normal, and (u, v), its in-plane axes. At theta = 0 that is the world's (x, y, z) = (u, s, ZC + v).
 */
export function makeDoor(P, theta = 0, detail = 1) {
  /* facet counts only set the tone fills (outlines are analytic), so a door in motion can take fewer of them and drop its finest marks */
  const facets = (r) => Math.max(detail < 1 ? 10 : 14, Math.min(88, Math.round(r * 0.5 * detail)));
  const fine = detail >= 0.75;
  const c = Math.cos(rad(theta));
  const sn = Math.sin(rad(theta));
  const turn = ([x, y, z]) => [HINGE_X + (x - HINGE_X) * c - (y - HINGE_Y) * sn, HINGE_Y + (x - HINGE_X) * sn + (y - HINGE_Y) * c, z];
  const O = turn([0, 0, ZC]);
  const U = [c, sn, 0];
  const A = [-sn, c, 0];
  const V = [0, 0, 1];
  const F0 = G.frameOf(O, A, U, V);
  const at = (p) => k.iso(p, P);
  /* a point on the door, in its own (u, v) at height s off the face */
  const pt = (u, v, s = 0) => [O[0] + A[0] * s + U[0] * u, O[1] + A[1] * s + U[1] * u, ZC + v];
  const faceAt = (u, v, s = 0) => at(pt(u, v, s));
  const frameAtFace = (u, v) => G.frameOf(pt(u, v, 0), A, U, V);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const disc = (s0, s1, r, F = F0) => G.disc(s0, s1, r, F, P, { steps: facets(r) });
  const band = (s0, s1, rIn, rOut, F = F0) => G.ringBand(s0, s1, rIn, rOut, F, P, { steps: facets(rOut) });
  const prism = (poly, s0, s1) => G.prismOf(F0, poly, s0, s1, P);
  const seg = (a, b) => `M${xy(a)}L${xy(b)}`;
  const polarAt = (r, deg, s) => faceAt(...polar(r, deg), s);

  /* ── The door slab: rim, step, gasket ───────────────────────────────────── */
  function body() {
    const out = [];
    out.push(S(G.solidOf([[DOOR_BACK, R_DOOR], [-3, R_DOOR], [-3, R_FACE], [0, R_FACE]], F0, P, { steps: Math.round(96 * detail) }), { tone: "hi" }));
    /* a rubber gasket seats on the step round the whole perimeter, with a row of screws along its top */
    out.push(S(band(GASKET.s[0], GASKET.s[1], GASKET.r[0], GASKET.r[1]), { tone: "lo", crease: "lo" }));
    if (fine) out.push(D(G.dotsOf(F0, GASKET.s[1], (GASKET.r[0] + GASKET.r[1]) / 2, 36, P, { all: true }), { size: 0.45 }));
    /* each bolt rides a channel in the face plate */
    const channels = [];
    for (let i = 0; i < BOLTS; i++) {
      const deg = BOLT_AT(i);
      for (const sign of [-1, 1]) {
        const [u0, v0] = polyRadial([[R_RING_OUT, sign * 7]], deg)[0];
        const [u1, v1] = polyRadial([[R_FACE, sign * 7]], deg)[0];
        channels.push(seg(faceAt(u0, v0), faceAt(u1, v1)));
      }
    }
    out.push(L(channels.join(""), { tone: "lo" }));
    return out.join("");
  }

  /* ── Drive ring: a plate on the bearing race, cut with spiral slots ─────── */
  const race = () => S(band(0, RING_S[0], 80, 90), { tone: "mid" });
  function ringTop() {
    const out = [];
    out.push(S(band(RING_S[0], RING_S[1], R_RING_IN, R_RING_OUT), { tone: "hi" }));
    out.push(L(G.circleOf(F0, RING_S[1], R_RING_IN + 3.4, P, 96) + G.circleOf(F0, RING_S[1], R_RING_OUT - 3.4, P, 120), { tone: "faint" }));
    out.push(L(G.circleOf(F0, RING_S[1], R_RING_OUT, P, 120) + G.circleOf(F0, RING_S[1], R_RING_IN, P, 96), { tone: "mid" }));
    return out.join("");
  }
  /** the slots and the ring's dots, drawn with the ring turned by `ringDeg` (the shut art turns them with a transform instead) */
  function ringSlots(ringDeg = 0, wrap = "") {
    const turnBy = (p) => {
      const a = rad(ringDeg);
      return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
    };
    const holes = slotOutlines().map((ring) => `M${ring.map((p) => xy(faceAt(...turnBy(p), RING_S[1]))).join("L")}Z`);
    const dots = [];
    if (fine) for (let i = 0; i < 36; i++) dots.push(faceAt(...turnBy(polar(97.5, i * 10 + 5)), RING_S[1]));
    return { holes: holes.join(""), dots: fine ? D(dots, { size: 0.45, tone: "lo" }) : "", wrap };
  }

  /* ── One bolt: body, nose, serrations; the pin is drawn later above the ring ─ */
  function bolt(deg, shift = 0) {
    const r0 = RHO_IN - shift;
    const body_ = S(prism(rrect(r0, r0 + BOLT_LEN - 6, -BOLT_W, BOLT_W, deg, 0.8), BOLT_S[0], BOLT_S[1]), { tone: "lit", lit: true });
    const nose = S(prism(polyRadial([[r0 + BOLT_LEN - 6, -BOLT_W], [r0 + BOLT_LEN - 0.4, -2.4], [r0 + BOLT_LEN - 0.4, 2.4], [r0 + BOLT_LEN - 6, BOLT_W]], deg), BOLT_S[0], BOLT_S[1]), { tone: "lit", lit: true, crease: "none" });
    const ticks = [];
    for (let rho = r0 + 12; rho <= r0 + BOLT_LEN - 9; rho += 4) {
      for (const sign of [-1, 1]) {
        const [u0, v0] = polyRadial([[rho, sign * BOLT_W]], deg)[0];
        const [u1, v1] = polyRadial([[rho, sign * (BOLT_W - 1.7)]], deg)[0];
        ticks.push(seg(faceAt(u0, v0, BOLT_S[1]), faceAt(u1, v1, BOLT_S[1])));
      }
    }
    const [gu0, gv0] = polyRadial([[r0 + 11, 0]], deg)[0];
    const [gu1, gv1] = polyRadial([[r0 + BOLT_LEN - 9, 0]], deg)[0];
    return body_ + nose + (fine ? L(ticks.join(""), { tone: "mid" }) + L(seg(faceAt(gu0, gv0, BOLT_S[1]), faceAt(gu1, gv1, BOLT_S[1])), { tone: "mid", free: true }) : "");
  }
  function pin(deg, shift = 0) {
    const [u, v] = polar(RHO_IN + 8 - shift, deg);
    const f = frameAtFace(u, v);
    return S(disc(BOLT_S[1], RING_S[1] + 0.4, 2.7, f), { tone: "hi" }) + S(disc(RING_S[1] + 0.4, RING_S[1] + 1.8, 4, f), { tone: "hi" });
  }

  /* ── Combination dial ───────────────────────────────────────────────────── */
  function dialStatic() {
    const out = [];
    out.push(S(disc(0, 3, 79.6), { tone: "mid" }));
    /* a stepped bezel: a low outer step carrying the screws and the scale, a taller inner step round the dial */
    out.push(S(band(3, 6, 72.6, 78), { tone: "hi" }));
    out.push(S(band(3, DIAL_S, DIAL_R + 0.6, 72.6), { tone: "hi" }));
    const screws = [];
    for (let i = 0; i < 8; i++) screws.push(polarAt(75.3, i * 45 + 22.5, 6));
    out.push(L(G.circleOf(F0, 6, 75.3, P, 60), { tone: "faint" }), D(screws, { size: 0.5 }));
    out.push(L(G.circleOf(F0, 6, 78, P, 120) + G.circleOf(F0, DIAL_S, 72.6, P, 100), { tone: "mid" }));
    const ticks = [];
    for (let i = 0; i < 36; i++) {
      const a = i * 10;
      ticks.push(seg(polarAt(78, a, 6), polarAt(i % 3 === 0 ? 74.4 : 76, a, 6)));
    }
    if (fine) out.push(L(ticks.join(""), { tone: "lo" }));
    out.push(S(disc(3, DIAL_S, DIAL_R), { tone: "hi" }));
    return out.join("");
  }
  /** the dial's printed face, turned `rot` degrees counter-clockwise (the shut art leaves it at 0 and turns it with a transform) */
  function dialFace(rot = 0, wrap = "") {
    const minor = [];
    const mid = [];
    const major = [];
    for (let i = 0; i < 100; i++) {
      const a = 90 - i * 3.6 + rot;
      const len = i % 10 === 0 ? 6 : i % 5 === 0 ? 4.4 : 2.8;
      const d = seg(polarAt(DIAL_R - 1.4, a, DIAL_S), polarAt(DIAL_R - 1.4 - len, a, DIAL_S));
      (i % 10 === 0 ? major : i % 5 === 0 ? mid : minor).push(d);
    }
    const O_ = faceAt(0, 0, DIAL_S);
    const ex = [faceAt(1, 0, DIAL_S)[0] - O_[0], faceAt(1, 0, DIAL_S)[1] - O_[1]];
    const ez = [faceAt(0, 1, DIAL_S)[0] - O_[0], faceAt(0, 1, DIAL_S)[1] - O_[1]];
    const faceMatrix = (px, py) => `matrix(${ex[0]} ${ex[1]} ${-ez[0]} ${-ez[1]} ${O_[0] + px * ex[0] - py * ez[0]} ${O_[1] + px * ex[1] - py * ez[1]})`;
    const numerals = [];
    for (let i = 0; i < 100; i += 10) {
      const [px, pz] = polar(52, 90 - i * 3.6 + rot);
      numerals.push(`<text class="iso-face-text vd-num" data-tone="hi" transform="${faceMatrix(px, -pz)} rotate(${i * 3.6 - rot})" font-size="7.4" text-anchor="middle" dominant-baseline="central">${i}</text>`);
    }
    const inner = `${L(minor.join(""), { tone: "lo" })}${L(mid.join(""), { tone: "mid" })}${L(major.join(""), { tone: "hi" })}${L(G.circleOf(F0, DIAL_S, DIAL_R - 1, P, 120) + G.circleOf(F0, DIAL_S, 42, P, 90) + G.circleOf(F0, DIAL_S, 33, P, 72), { tone: "lo" })}${numerals.join("")}`;
    return wrap ? `<g ${wrap}>${inner}</g>` : inner;
  }
  /** the knob's knurl: vertical lines on the half of the cylinder that faces us */
  function knurlAt(rotDeg) {
    const Vw = G.viewOf(P);
    const lines = [];
    for (let j = 0; j < KNURL; j++) {
      const t = rad(rotDeg) + (j / KNURL) * Math.PI * 2;
      const nu = Math.cos(t);
      const nv = Math.sin(t);
      const normal = [U[0] * nu + V[0] * nv, U[1] * nu + V[1] * nv, U[2] * nu + V[2] * nv];
      if (G.dot3(normal, Vw) < 0.14) continue;
      lines.push(seg(faceAt(KNOB_R * nu, KNOB_R * nv, DIAL_S + 0.7), faceAt(KNOB_R * nu, KNOB_R * nv, KNOB_S - 0.7)));
    }
    return lines.join("");
  }
  /** the knob: a body, its knurl, and a top (pointer, collar, serrated rim) that turns with it */
  function knob(rot = 0, wrap = "") {
    const out = [];
    out.push(S(disc(DIAL_S, KNOB_S, KNOB_R), { tone: "hi", crease: "lo" }));
    out.push(`<path data-vd="knurl" class="iso-line" data-tone="lo" d="${knurlAt(rot)}"/>`);
    out.push(L(G.circleOf(F0, KNOB_S, KNOB_R - 2.8, P, 64), { tone: "lo" }));
    const top = [];
    const serration = [];
    for (let a = 0; a < 360; a += 10) serration.push(seg(polarAt(KNOB_R, a + rot, KNOB_S), polarAt(KNOB_R - 2.8, a + rot, KNOB_S)));
    top.push(L(serration.join(""), { tone: "lo" }));
    top.push(L(seg(faceAt(...polar(9, 90 + rot + 180), KNOB_S), faceAt(...polar(KNOB_R - 5, 90 + rot), KNOB_S)), { tone: "lit" }));
    top.push(L(G.circleOf(F0, KNOB_S, 6, P, 40), { tone: "mid" }));
    top.push(D([faceAt(0, 0, KNOB_S)], { size: 0.8, tone: "hi" }));
    out.push(wrap ? `<g ${wrap}>${top.join("")}</g>` : top.join(""));
    return out.join("");
  }
  const indexLug = () => S(prism([[-3.6, 78.4], [3.6, 78.4], [0, DIAL_R + 1.6]], 6, DIAL_S + 1.8), { tone: "lit", lit: true, crease: "none" });

  /* ── Hinge arms: bars on the door face, out over the flange to the pin ─────── */
  const ARM_REACH = KNUCKLE_R - 0.8; // where an arm's end meets the knuckle, measured from the pin
  const earAngle = (v) => 180 - (Math.asin(v / 146) * 180) / Math.PI;
  function arms() {
    const out = [];
    for (const vc of ARM_V) {
      const uEnd = -Math.sqrt(146.4 ** 2 - vc ** 2);
      /* the ear is a lug on the face plate, between the drive ring and the rim, that the arm sits on */
      out.push(S(prism(rrect(144.6, 147.8, -6, 6, earAngle(vc), 0.8), 0, ARM_S[0]), { tone: "mid" }));
      const poly = rect(HINGE_X + ARM_REACH, uEnd, vc - ARM_HALF, vc + ARM_HALF, 1.2);
      out.push(S(prism(poly, ARM_S[0], ARM_S[1]), { tone: "hi", crease: "lo" }));
      out.push(L(seg(faceAt(HINGE_X + ARM_REACH + 4, vc - ARM_HALF + 2.6, ARM_S[1]), faceAt(uEnd - 3, vc - ARM_HALF + 2.6, ARM_S[1])), { tone: "faint" }));
      out.push(D([faceAt(HINGE_X + ARM_REACH + 7, vc, ARM_S[1]), faceAt(uEnd - 7, vc, ARM_S[1]), faceAt((HINGE_X + uEnd) / 2, vc, ARM_S[1])], { size: 0.5, tone: "hi" }));
    }
    return out.join("");
  }

  /* ── The whole door at the open state, for the swing ───────────────────────────
     Bolts withdrawn, the ring home, the dial at `dialRot`. Painter's order is s, lowest first. */
  function swing({ dialRot = 0 } = {}) {
    const ring = ringSlots(0);
    const shift = PIN_TRAVEL;
    const bolts = Array.from({ length: BOLTS }, (_, i) => bolt(BOLT_AT(i), shift)).join("");
    const pins = Array.from({ length: BOLTS }, (_, i) => pin(BOLT_AT(i), shift)).join("");
    /* the arms are returned apart: they stand in front of the flange at every angle, so they are drawn above its lip */
    const main = [body(), race(), bolts, ringTop(), `<path class="vd-slot" d="${ring.holes}"/>`, ring.dots, pins, dialStatic(), dialFace(dialRot), knob(dialRot), indexLug()].join("");
    return { main, arms: arms() };
  }

  /** The projection of the part of the door that stands in front of the flange's face (y >= 0): the region where
      the flange must not be drawn over it. A convex hull, because the door and the half-space are both convex. */
  function frontHull(steps = 72) {
    const keep = [];
    const rings = [[DOOR_BACK, R_DOOR], [-3, R_DOOR], [0, R_FACE]].map(([s, r]) =>
      Array.from({ length: steps }, (_, j) => {
        const [u, v] = polar(r, (j / steps) * 360);
        return pt(u, v, s);
      }),
    );
    for (const ring of rings) {
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j];
        const b = ring[(j + 1) % ring.length];
        if (a[1] >= 0) keep.push(a);
        if ((a[1] >= 0) !== (b[1] >= 0)) {
          const t = a[1] / (a[1] - b[1]);
          keep.push([a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t]);
        }
      }
    }
    /* the arms and their ears lie above the face, so they are in front whenever the face is */
    return keep.length ? G.hullOf(keep.map(at)) : [];
  }

  /** the door's shadow on the floor: its rim carried along the light to z = 0 */
  function shadow() {
    const Lg = G.lightOf(P);
    const floor = [];
    for (const [s, r] of [[DOOR_BACK, R_DOOR], [0, R_DOOR]]) {
      for (let j = 0; j < 72; j++) {
        const [u, v] = polar(r, (j / 72) * 360);
        const p = pt(u, v, s);
        const t = p[2] / Lg[2];
        floor.push(at([p[0] - Lg[0] * t, p[1] - Lg[1] * t, 0]));
      }
    }
    return k.pathOf(G.hullOf(floor), true);
  }

  /** the lowest door point in the world frame, for the swing's own clearance check */
  function sample(step = 24) {
    const out = [];
    for (const [s, r] of [[DOOR_BACK, R_DOOR], [-3, R_DOOR], [0, R_FACE]]) {
      for (let j = 0; j < step; j++) {
        const [u, v] = polar(r, (j / step) * 360);
        out.push(pt(u, v, s));
      }
    }
    for (const vc of ARM_V) {
      for (const uu of [HINGE_X + ARM_REACH, -Math.sqrt(146.4 ** 2 - vc ** 2)]) {
        for (const s of ARM_S) for (const dv of [-ARM_HALF, ARM_HALF]) out.push(pt(uu, vc + dv, s));
      }
    }
    return out;
  }

  return { F0, pt, faceAt, frameAtFace, body, race, ringTop, ringSlots, bolt, pin, dialStatic, dialFace, knurlAt, knob, indexLug, arms, swing, frontHull, shadow, sample, disc, band, prism, turnPoint: turn };
}
