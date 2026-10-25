import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { VAULT_ART as ART } from "./art.generated";
import "./vault-door.css";

/**
 * The hero's vault door. The drawing is finished SVG built by scripts/vault-door/build.mjs;
 * this file only moves it, and every number it shows comes from the same model that moves it:
 * dial reading -> three wheels -> drive ring angle -> pin radius -> bolt travel.
 */

export interface VaultStatus {
  /** The number under the index, 0-99. */
  reading: number;
  /** One short line: what the door is waiting for, or that it is open. */
  text: string;
}

const RAD = Math.PI / 180;
const { P, ZC } = ART;
const K = P.scale * Math.sqrt(1.6);
const SIN_A = Math.sin(P.azimuth * RAD);
const COS_A = Math.cos(P.azimuth * RAD);
const SIN_E = Math.sin(P.elevation * RAD);
const COS_E = Math.cos(P.elevation * RAD);
const VIEW = [COS_A * COS_E, SIN_A * COS_E, SIN_E];

/* The camera, and a basis for any plane parallel to the door face. */
const iso = (x: number, y: number, z: number): [number, number] => [
  P.origin[0] + (x * SIN_A - y * COS_A) * K,
  P.origin[1] + ((x * COS_A + y * SIN_A) * SIN_E - z * COS_E) * K,
];
function basis(s: number, cx = 0, cz = 0) {
  const o = iso(cx, s, ZC + cz);
  const x = iso(cx + 1, s, ZC + cz);
  const z = iso(cx, s, ZC + cz + 1);
  return { o, ex: [x[0] - o[0], x[1] - o[1]], ez: [z[0] - o[0], z[1] - o[1]] };
}

/* Turning a flat group about a point on the face is an affine map of the screen. */
function turnMatrix(b: ReturnType<typeof basis>, deg: number) {
  const c = Math.cos(deg * RAD);
  const n = Math.sin(deg * RAD);
  const { o, ex, ez } = b;
  const xr = [c * ex[0] + n * ez[0], c * ex[1] + n * ez[1]];
  const zr = [-n * ex[0] + c * ez[0], -n * ex[1] + c * ez[1]];
  const det = ex[0] * ez[1] - ex[1] * ez[0];
  const i00 = ez[1] / det;
  const i01 = -ez[0] / det;
  const i10 = -ex[1] / det;
  const i11 = ex[0] / det;
  const a = xr[0] * i00 + zr[0] * i10;
  const bb = xr[1] * i00 + zr[1] * i10;
  const cc = xr[0] * i01 + zr[0] * i11;
  const d = xr[1] * i01 + zr[1] * i11;
  return `matrix(${a} ${bb} ${cc} ${d} ${o[0] - (a * o[0] + cc * o[1])} ${o[1] - (bb * o[0] + d * o[1])})`;
}

/* The knob's knurl: vertical lines on the half of the cylinder that faces us, redrawn as it turns. */
const KNURL = 72;
function knurlPath(rotDeg: number) {
  const { knobR, s: s0, knobS: s1 } = ART.dial;
  const lines: string[] = [];
  for (let j = 0; j < KNURL; j++) {
    const t = rotDeg * RAD + (j / KNURL) * Math.PI * 2;
    if (Math.cos(t) * VIEW[0] + Math.sin(t) * VIEW[2] < 0.14) continue;
    const a = iso(knobR * Math.cos(t), s0 + 0.7, ZC + knobR * Math.sin(t));
    const b = iso(knobR * Math.cos(t), s1 - 0.7, ZC + knobR * Math.sin(t));
    lines.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return lines.join("");
}

/* The combination: right to 24, left to 61, right to 08. Right is clockwise, which lowers the reading. */
const STEPS = [
  { to: ART.combination[0], dir: -1, turns: 3 },
  { to: ART.combination[1], dir: 1, turns: 2 },
  { to: ART.combination[2], dir: -1, turns: 1 },
] as const;
const DEG_PER_NUMBER = 3.6;
const mod100 = (n: number) => ((n % 100) + 100) % 100;
const pad = (n: number) => String(n).padStart(2, "0");
const sideWord = (dir: number) => (dir < 0 ? "right" : "left");

/** Dial degrees (counter-clockwise positive) that reach `to` moving `dir`, after at least `turns` full turns. */
function travelTo(rot: number, to: number, dir: number, turns: number) {
  const here = rot / DEG_PER_NUMBER;
  const gap = mod100((to - here) * dir);
  return (here + dir * (gap + 100 * (turns - 1))) * DEG_PER_NUMBER;
}

/* A critically damped spring: no overshoot, velocity continuous. */
function settle(state: { x: number; v: number }, target: number, dt: number, seconds: number) {
  const w = 1 / seconds;
  for (let i = 0; i < 4; i++) {
    state.v += (w * w * (target - state.x) - 2 * w * state.v) * (dt / 4);
    state.x += state.v * (dt / 4);
  }
}

/* A tour move is a timed slew, so the dial never spends seconds creeping the last degree. */
const slewSeconds = (degrees: number) => Math.min(3.6, Math.max(1.2, 1 + Math.abs(degrees) / 520));
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const OPEN_HOLD = 3.4;
const IDLE_RESUME = 6;

interface Props {
  className?: string;
  onStatus?: (status: VaultStatus) => void;
}

export function VaultDoor({ className, onStatus }: Props) {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const press = useRef<(key: string, shift: boolean) => void>(() => {});
  const statusRef = useRef(onStatus);
  useEffect(() => {
    statusRef.current = onStatus;
  });

  useEffect(() => {
    const host = svg.current;
    const wrap = root.current;
    if (!host || !wrap) return;

    const pick = (sel: string) => Array.from(host.querySelectorAll<SVGElement>(sel));
    const bolts = pick('[data-vd="bolt"]');
    const pins = pick('[data-vd="pin"]');
    const lamps = pick('[data-vd="lamp"]');
    const ring = host.querySelector<SVGElement>('[data-vd="rot"][data-id="ring"]')!;
    const dialFace = host.querySelector<SVGElement>('[data-vd="rot"][data-id="dial"]')!;
    const knobTop = host.querySelector<SVGElement>('[data-vd="rot"][data-id="knob"]')!;
    const needle = host.querySelector<SVGElement>('[data-vd="rot"][data-id="needle"]')!;
    const knurl = host.querySelector<SVGElement>('[data-vd="knurl"]')!;

    const rings = { b: basis(Number(ring.dataset.s)) };
    const dials = { b: basis(Number(dialFace.dataset.s)) };
    const knobs = { b: basis(Number(knobTop.dataset.s)) };
    const needles = { b: basis(Number(needle.dataset.s), ART.gauge.cx, ART.gauge.cz) };
    /* each bolt slides along its own radius; one world unit inward is this many screen px */
    const slide = ART.boltAt.map((deg) => {
      const dx = -Math.cos(deg * RAD);
      const dz = -Math.sin(deg * RAD);
      return [dx * SIN_A * K, (dx * COS_A * SIN_E - dz * COS_E) * K] as const;
    });
    const face = basis(ART.dial.s);

    /* the dial: `rot` counter-clockwise degrees; the lock: 1 = bolts home, 0 = withdrawn */
    const dial = { x: 0, v: 0 };
    const lock = { x: 1, v: 0 };
    const want = { dial: 0, lock: 1 };
    const door = {
      stage: 0,
      mode: "tour" as "tour" | "hand",
      step: -1, // tour progress: -1 waiting, 0..2 dialling, 3 open, 4 closing, 5 homing
      hold: 1.4, // seconds to wait before the next tour step
      openFor: 0,
      lastInput: -1e9,
      restRot: 0,
      drag: null as null | { pointer: number; last: number; at: number; vel: number },
    };
    const slew = { from: 0, to: 0, t: 1, dur: 1 };
    const slewTo = (to: number) => {
      slew.from = dial.x;
      slew.to = to;
      slew.t = 0;
      slew.dur = slewSeconds(to - dial.x);
      want.dial = to;
    };
    let clock = 0;
    let frame = 0;
    let last = 0;
    let visible = false;
    let shown = { reading: -1, text: "" };
    let lampsOn = -1;

    const readingOf = (rot: number) => mod100(Math.round(rot / DEG_PER_NUMBER));

    const textNow = () => {
      if (lock.x < 0.98) return lock.x < 0.04 ? "Open · 12 bolts withdrawn" : "Drive ring turning · bolts withdrawing";
      if (door.stage >= 3) return "Wheel 3 set · drive ring free";
      const next = STEPS[door.stage];
      return `Wheel ${door.stage + 1} of 3 · turn ${sideWord(next.dir)} to ${pad(next.to)}`;
    };

    const draw = () => {
      const rot = dial.x;
      dialFace.setAttribute("transform", turnMatrix(dials.b, rot));
      knobTop.setAttribute("transform", turnMatrix(knobs.b, rot));
      knurl.setAttribute("d", knurlPath(rot));
      const open = 1 - Math.min(1, Math.max(0, lock.x));
      ring.setAttribute("transform", turnMatrix(rings.b, ART.ringSweep * (1 - open)));
      needle.setAttribute("transform", turnMatrix(needles.b, -270 * open));
      const home = ART.pinTravel * open;
      /* the bolts are emitted in depth order, so each one says which radius it slides along */
      for (const el of [...bolts, ...pins]) {
        const [sx, sy] = slide[Number(el.dataset.i)];
        el.setAttribute("transform", `translate(${(sx * home).toFixed(2)} ${(sy * home).toFixed(2)})`);
      }
      const lit = door.stage;
      if (lit !== lampsOn) {
        lampsOn = lit;
        lamps.forEach((el, i) => (i < lit ? el.setAttribute("data-on", "") : el.removeAttribute("data-on")));
      }
      const next = { reading: readingOf(rot), text: textNow() };
      if (next.reading !== shown.reading || next.text !== shown.text) {
        shown = next;
        statusRef.current?.(next);
      }
    };

    /* a wheel catches only if the dial lands on its number having come the right way round */
    const landed = () => {
      const moved = dial.x - door.restRot;
      door.restRot = dial.x;
      if (Math.abs(moved) < 6 * DEG_PER_NUMBER) return;
      const dir = Math.sign(moved);
      const at = readingOf(dial.x);
      const next = door.stage < 3 ? STEPS[door.stage] : null;
      if (next && at === next.to && dir === next.dir) door.stage++;
      else door.stage = at === STEPS[0].to && dir === STEPS[0].dir ? 1 : 0;
      if (door.stage === 3) {
        want.lock = 0;
        door.openFor = 0;
      }
    };

    const tour = (dt: number) => {
      if (door.hold > 0) return void (door.hold -= dt);
      const parked = slew.t >= slew.dur;
      if (door.step === -1) {
        door.step = 0;
        door.stage = 0;
        slewTo(travelTo(dial.x, STEPS[0].to, STEPS[0].dir, STEPS[0].turns));
      } else if (door.step < 3) {
        if (!parked) return;
        door.stage = door.step + 1; // the wheel drops its gate: the lamp comes on
        door.step++;
        door.hold = 0.55;
        if (door.step < 3) slewTo(travelTo(dial.x, STEPS[door.step].to, STEPS[door.step].dir, STEPS[door.step].turns));
        else want.lock = 0;
      } else if (door.step === 3) {
        if (lock.x > 0.04) return;
        door.openFor += dt;
        if (door.openFor < OPEN_HOLD) return;
        door.stage = 0;
        want.lock = 1;
        door.step = 4;
      } else if (door.step === 4) {
        if (lock.x < 0.99) return;
        slewTo(Math.round(dial.x / 360) * 360);
        door.step = 5;
      } else if (parked) {
        door.step = -1;
        door.restRot = dial.x;
        door.hold = 1.6;
      }
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      clock += dt;
      if (door.mode === "hand" && clock - door.lastInput > IDLE_RESUME && !door.drag) {
        /* nobody has touched it for a while: wait for the door to close, then run the combination again */
        if (lock.x >= 0.99 || want.lock === 1) {
          door.mode = "tour";
          door.step = -1;
          door.stage = 0;
          door.hold = 0.6;
          want.lock = 1;
        }
      }
      if (door.mode === "tour") tour(dt);
      else if (want.lock === 0 && lock.x < 0.04) {
        door.openFor += dt;
        if (door.openFor > OPEN_HOLD) {
          door.stage = 0;
          want.lock = 1;
        }
      }
      if (reduce) {
        dial.x = want.dial;
        dial.v = 0;
        lock.x = want.lock;
        slew.t = slew.dur;
      } else {
        if (door.mode === "tour" && slew.t < slew.dur) {
          slew.t = Math.min(slew.dur, slew.t + dt);
          const before = dial.x;
          dial.x = slew.from + (slew.to - slew.from) * easeInOut(slew.t / slew.dur);
          dial.v = (dial.x - before) / dt;
        } else if (door.drag) dial.x = want.dial;
        else {
          settle(dial, want.dial, dt, 0.26);
          /* the last half degree is not worth watching: land on the number */
          if (Math.abs(dial.x - want.dial) < 0.6 && Math.abs(dial.v) < 6) {
            dial.x = want.dial;
            dial.v = 0;
          }
        }
        settle(lock, want.lock, dt, 0.42);
      }
      lock.x = Math.min(1, Math.max(0, lock.x));
      if (door.mode === "hand" && !door.drag && Math.abs(dial.x - want.dial) < 0.05 && Math.abs(dial.v) < 0.5 && door.restRot !== dial.x) landed();
      draw();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      if (frame || !visible) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    /* ── hands: drag the dial, or use the keys ──────────────────────────────── */
    const takeOver = () => {
      if (door.mode === "tour") {
        want.dial = dial.x;
        slew.t = slew.dur;
      }
      door.mode = "hand";
      door.lastInput = clock;
    };
    /* pointer -> the door's own (u, v), then the dial's angle */
    const toFace = (e: PointerEvent) => {
      const box = host.getBoundingClientRect();
      const sx = ((e.clientX - box.left) / box.width) * ART.viewBox[0] - face.o[0];
      const sy = ((e.clientY - box.top) / box.height) * ART.viewBox[1] - face.o[1];
      const det = face.ex[0] * face.ez[1] - face.ex[1] * face.ez[0];
      return { u: (sx * face.ez[1] - sy * face.ez[0]) / det, v: (face.ex[0] * sy - face.ex[1] * sx) / det };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const { u, v } = toFace(e);
      if (Math.hypot(u, v) > 80) return;
      takeOver();
      wrap.setPointerCapture(e.pointerId);
      door.drag = { pointer: e.pointerId, last: Math.atan2(v, u) / RAD, at: performance.now(), vel: 0 };
      want.dial = dial.x;
      dial.v = 0;
      wrap.style.cursor = "grabbing";
      run();
    };
    const onMove = (e: PointerEvent) => {
      const { u, v } = toFace(e);
      const drag = door.drag;
      if (!drag) {
        wrap.style.cursor = e.pointerType !== "touch" && Math.hypot(u, v) <= 80 ? "grab" : "";
        return;
      }
      const a = Math.atan2(v, u) / RAD;
      let d = a - drag.last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      const now = performance.now();
      drag.vel = 0.8 * drag.vel + 0.2 * ((d / Math.max(now - drag.at, 1)) * 1000);
      drag.last = a;
      drag.at = now;
      want.dial += d;
      door.lastInput = clock;
    };
    const onUp = () => {
      const drag = door.drag;
      if (!drag) return;
      door.drag = null;
      wrap.style.cursor = "grab";
      /* coast a little with the hand's speed, then settle on the nearest number */
      const coast = reduce ? 0 : Math.max(-720, Math.min(720, drag.vel)) * 0.25;
      want.dial = Math.round((want.dial + coast) / DEG_PER_NUMBER) * DEG_PER_NUMBER;
      dial.v = reduce ? 0 : drag.vel * 0.6;
      door.lastInput = clock;
      run();
    };
    press.current = (key, shift) => {
      if (key === "Enter" || key === " ") {
        door.mode = "tour";
        door.step = -1;
        door.stage = 0;
        door.hold = 0;
        want.lock = 1;
        run();
        return;
      }
      const step = (shift ? 10 : 1) * DEG_PER_NUMBER;
      const right = key === "ArrowRight" || key === "ArrowDown";
      const left = key === "ArrowLeft" || key === "ArrowUp";
      if (!right && !left && key !== "Home") return;
      takeOver(); // first: it parks the dial where it is, so the key steps from what the reader sees
      const here = Math.round(want.dial / DEG_PER_NUMBER) * DEG_PER_NUMBER;
      want.dial = key === "Home" ? Math.round(dial.x / 360) * 360 : here + (left ? step : -step);
      run();
    };

    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    if (reduce) door.mode = "hand";
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) run();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(wrap);
    draw();

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
    };
  }, [reduce]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "Enter", " "].includes(e.key)) return;
    e.preventDefault();
    press.current(e.key, e.shiftKey);
  };

  return (
    <div
      ref={root}
      tabIndex={0}
      role="group"
      aria-label="Vault door. Drag the dial, or use the arrow keys to turn it and Enter to run the combination."
      onKeyDown={onKeyDown}
      className={`iso vd touch-pan-y select-none outline-none focus-visible:ring-1 focus-visible:ring-white/60 focus-visible:ring-offset-8 focus-visible:ring-offset-transparent ${className ?? ""}`}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${ART.viewBox[0]} ${ART.viewBox[1]}`}
        className="iso-svg"
        role="img"
        aria-label={ART.label}
        dangerouslySetInnerHTML={{ __html: ART.svg }}
      />
    </div>
  );
}
