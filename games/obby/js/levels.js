import { worldDef } from './themes.js';
import { stormSeq, stormExtra } from './storm-course.js';
import { gearSeq, gearExtra, musicBox } from './gear-course.js';

export const PHYS = {
  gravity: 30,
  fallMul: 1.65,
  jump: 12.5,
  run: 8,
  radius: 0.42,
  height: 1.7,
};

export const FULL_HELP = { ledge: 1.05, reach: 0.4 };

export function padPower(rise) {
  return Math.sqrt(2 * PHYS.gravity * (rise + 2.4));
}

export const SWING_LEFT = 0.45;
export const SWING_HOME = 3;
export const SWING_REACH = 16;

export function holdWait(w, ph, dt) {
  let d = (((w.goal - ph) % w.P) + w.P) % w.P;
  if (d > w.P / 2) d -= w.P;
  const k = dt * SWING_HOME;
  return Math.max(-k, Math.min(k, d));
}

export function swingFar(sw, ph, dt) {
  const leg = Math.PI / sw.speed;
  const P = 2 * (leg + sw.hold);
  const goal = sw.hold + leg + Math.min(0.3, sw.hold / 2);
  const u = (((ph + sw.t0) % P) + P) % P;
  if (u < sw.hold || u >= goal) return u >= goal && u < 2 * sw.hold + leg ? 0 : dt;
  return Math.min(dt, goal - u);
}

export function swingWait(sw, ph, dt) {
  const P = 2 * (Math.PI / sw.speed + sw.hold);
  const goal = sw.hold - SWING_LEFT;
  const u = (((ph + sw.t0) % P) + P) % P;
  if (u <= goal) return Math.min(dt, goal - u);
  if (u < sw.hold) return goal - u;
  const fwd = P - u + goal;
  const back = u - goal;
  return fwd < back ? Math.min(dt * SWING_HOME, fwd) : -Math.min(dt * SWING_HOME, back);
}

class Builder {
  constructor(world, extra = false) {
    this.w = world;
    this.def = worldDef(world);
    this.extra = extra;
    this.secret = false;
    this.meta = [];
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.specs = [];
    this.coins = [];
    this.cps = [];
    this.ci = 0;
    this.nextGap = null;
    this.stage = 0;
  }

  add(s) {
    s.stage = this.stage;
    if (this.secret) {
      s.side = true;
      s.secret = true;
    }
    if (this.aimNext && s.t === 'block') {
      this.aimNext.target = { x: s.x, y: s.y, z: s.z };
      this.aimNext = null;
    }
    this.specs.push(s);
    return s;
  }

  col() {
    this.ci++;
    return this.ci;
  }

  block(o) {
    return this.add({ t: 'block', sy: 1, style: 'block', yaw: 0, ...o });
  }

  coin(x, y, z) {
    this.coins.push(this.secret ? { x, y, z, stage: this.stage, secret: true } : { x, y, z, stage: this.stage });
  }

  arc(x0, y0, z0, x1, y1, z1, n = 1, h = 1.9) {
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      this.coin(x0 + (x1 - x0) * t, Math.max(y0, y1) + h * Math.sin(Math.PI * t) + 0.4, z0 + (z1 - z0) * t);
    }
  }

  ahead(gap, sx, sz, o = {}) {
    const { dy = 0, dx = 0, ...rest } = o;
    const cz = this.z - gap - sz / 2;
    const top = this.y + dy;
    const cx = this.x + dx;
    const s = this.block({ x: cx, y: top, z: cz, sx, sz, ...rest });
    this.x = cx;
    this.y = top;
    this.z = cz - sz / 2;
    return s;
  }

  start() {
    const s = this.block({ x: 0, y: 0, z: 0, sx: 10, sz: 10, sy: 2, style: 'ground' });
    this.z = -5;
    this.cps.push({ x: 0, y: 0, z: 0, index: 0, r: 4.6 });
    this.coin(0, 1.1, -0.6);
    this.coin(0, 1.1, -2.6);
    this.add({ t: 'start', x: 0, y: 0, z: -3.2 });
    for (const [x, z, sx, sz] of [[-4.75, 0, 0.5, 9], [4.75, 0, 0.5, 9], [0, 4.75, 10, 0.5]]) this.block({ x, y: 0.7, z, sx, sz, sy: 0.7, style: 'curb' });
    return s;
  }

  gate(x0, x1) {
    for (const [a, b] of [[-5, x0], [x1, 5]]) if (b - a > 0.2) this.block({ x: (a + b) / 2, y: 0.7, z: -4.75, sx: b - a, sz: 0.5, sy: 0.7, style: 'curb' });
  }

  checkpoint(dy = 0) {
    const gap = this.nextGap ?? (this.extra ? 2.4 : this.def.cp.gap);
    this.nextGap = null;
    const size = this.def.cp.size;
    const px = this.x;
    const py = this.y;
    const pz = this.z;
    const s = this.ahead(gap, size, size, { dy, style: 'ground', sy: 1.6 });
    if (gap > 0) this.arc(px, py, pz, s.x, s.y, s.z + size / 2, 1);
    const index = this.cps.length;
    this.cps.push({ x: s.x, y: s.y, z: s.z, index, r: size / 2 });
    this.add({ t: 'cp', x: s.x, y: s.y, z: s.z, index });
    if (this.extra) for (let k = 0; k < 6; k++) this.coin(s.x + Math.cos((k / 6) * Math.PI * 2) * 2.3, s.y + 1.1, s.z + Math.sin((k / 6) * Math.PI * 2) * 2.3);
  }

  finish() {
    const gap = this.nextGap ?? 2.2;
    this.nextGap = null;
    const px = this.x;
    const py = this.y;
    const pz = this.z;
    const s = this.ahead(gap, 11, 11, { dy: this.finishDy ?? 0.5, style: 'ground', sy: 2 });
    this.arc(px, py, pz, s.x, s.y, s.z + 5.5, 1);
    const index = this.cps.length;
    this.cps.push({ x: s.x, y: s.y, z: s.z, index, r: 5, finish: true });
    this.add({ t: 'finish', x: s.x, y: s.y, z: s.z, index });
  }
}

function steps(b, { n = 4, size = 3.6, gap = 2.2, rise = 0.5, zig = 1.8, ice = false, first = true, gate = false } = {}) {
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const p = b.ahead(gap, size, size, {
      dy: rise,
      dx: i === 0 ? (first ? -zig : -zig * 2) : i % 2 ? zig * 2 : -zig * 2,
      style: ice ? 'ice' : 'block',
      color: b.col(),
      surface: ice ? 'ice' : undefined,
      sy: 1.2,
    });
    if (i === 0 && gate) b.gate(p.x - size / 2, p.x + size / 2);
    if (gap > 0) b.arc(px, py, pz, p.x, p.y, p.z + size / 2, 1);
    b.coin(p.x, p.y + 1.1, p.z);
  }
  if (gap === 0) b.nextGap = 0;
}

function bridge(b, { len = 12, w = 2 } = {}) {
  const s = b.ahead(-0.4, w, len + 0.8, { style: 'beam', sy: 0.7, dy: 0.2 });
  for (let z = s.z + len / 2 - 1.5; z > s.z - len / 2 + 1; z -= 2.2) b.coin(s.x, s.y + 1.1, z);
  b.nextGap = -0.4;
}

function stairs(b, { n = 5, rise = 0.9, size = 3, gap = 1.2 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = b.ahead(gap, size, size, { dy: rise, dx: i % 2 ? 1.6 : -1.6, color: b.col(), sy: 1.2 });
    if (i % 2 === 0) b.coin(p.x, p.y + 1.1, p.z);
  }
}

function sideMovers(b, { n = 2, amp = 2.5, speed = 0.9, size = 3.8, gap = 2 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = b.ahead(gap, size, size, { move: { x: amp, speed, phase: i * Math.PI }, color: b.col(), style: 'mover', sy: 0.8 });
    b.coin(p.x, p.y + 1.2, p.z);
  }
}

function ferry(b, { amp = 3, size = 4.4, speed = 0.8, hold = 0, dock = null, board = 1.2 } = {}) {
  const near = b.z - board - size / 2;
  const far = near - 2 * amp;
  const c = (near + far) / 2;
  const move = hold ? { z: amp, speed, phase: Math.PI / 2, hold } : { z: amp, speed, phase: Math.PI / 2 };
  b.block({ x: b.x, y: b.y, z: c, sx: size, sz: size, sy: 0.8, style: 'mover', color: hold ? 7 : b.col(), move, chevrons: hold > 0, guard: hold > 0 });
  if (hold) b.add({ t: 'rail', x: b.x, y: b.y - 0.8, z: c, z0: near + size / 2 + board, z1: far - size / 2 - (dock ?? 0), w: size });
  for (let k = 0; k < 3; k++) b.coin(b.x, b.y + 1.2, near - (k * (near - far)) / 2);
  b.z = far - size / 2;
  b.nextGap = dock ?? 1.2;
  if (dock !== null) b.finishDy = 0;
}

function tramps(b, { n = 3, spacing = 5.4, power = 16, r = 1.6, zig = 1.2, lead = 1, rise = 0, drop = 1.2 } = {}) {
  let z = b.z - lead - r;
  let y = b.y - drop;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const x = b.x + (i % 2 ? zig : -zig);
    if (i) y += rise;
    const d = b.add({ t: 'disk', x, y, z, r, sy: 0.6, style: 'tramp', surface: 'tramp', power });
    if (prev) prev.target = { x, y, z };
    prev = d;
    b.coin(x, y + 4.2, z);
    b.coin(x, y + 2.6, z);
    z -= spacing;
  }
  b.z = z + spacing - r - lead;
  b.y += n * rise;
  b.nextGap = 0;
  b.aimNext = prev;
}

function pad(b, { rise = 5, dist = 3.6, gap = 2.2, land = true, len = 5, top = [2.4, 2.4], flush = false } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const p = b.ahead(gap, 5, len, { color: b.col(), sy: 1 });
  if (gap > 2.2) b.arc(px, py, pz, p.x, p.y, p.z + len / 2, 1);
  const pd = b.block({ x: p.x, y: p.y + (flush ? 0.02 : 0.22), z: p.z, sx: top[0], sz: top[1], sy: 0.3, style: 'pad', surface: 'pad', power: padPower(rise) });
  const t = land ? b.ahead(dist, 6, 6, { dy: rise, style: 'ground', sy: 1.4 }) : { x: p.x, y: p.y + rise, z: p.z - len / 2 - dist - b.def.cp.size / 2 };
  if (!land) {
    b.y = t.y;
    b.nextGap = dist;
  }
  pd.target = { x: t.x, y: t.y, z: t.z };
  const vy = pd.power;
  const y0 = pd.y;
  const up = vy / PHYS.gravity;
  const apex = y0 + (vy * vy) / (2 * PHYS.gravity);
  const tf = up + Math.sqrt((2 * (apex - t.y)) / (PHYS.gravity * PHYS.fallMul));
  for (let k = 1; k <= 3; k++) {
    const tt = (tf * k) / 4;
    const y = tt < up ? y0 + vy * tt - 0.5 * PHYS.gravity * tt * tt : apex - 0.5 * PHYS.gravity * PHYS.fallMul * (tt - up) * (tt - up);
    b.coin(p.x + ((t.x - p.x) * tt) / tf, y + 1, p.z + ((t.z - p.z) * tt) / tf);
  }
  if (land) b.coin(t.x, t.y + 1.1, t.z);
}

function disks(b, { n = 3, r = 2.8, spin = 0.6, gap = 1.6 } = {}) {
  for (let i = 0; i < n; i++) {
    const z = b.z - gap - r;
    const x = b.x + (i % 2 ? 1.4 : -1.4);
    b.add({ t: 'disk', x, y: b.y, z, r, sy: 0.8, style: 'spinner', color: b.col(), spin: i % 2 ? -spin : spin });
    b.coin(x, b.y + 1.2, z);
    b.x = x;
    b.z = z - r;
  }
}

function crumble(b, { n = 5, size = 3, gap = 1, delay = 0.7 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = b.ahead(gap, size, size, { dx: i % 2 ? 1.1 : -1.1, style: 'crumble', crumble: b.def.crumbleHold ? { delay, hold: true } : { delay }, sy: 0.7 });
    b.coin(p.x, p.y + 1.1, p.z);
  }
}

function conveyor(b, { len = 12, w = 4, dir = 'z', speed = 2.5, curb = false, gap = 2 } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const s = b.ahead(gap, w, len, { style: 'conveyor', surface: 'conveyor', conv: { dir, speed }, sy: 0.8 });
  b.arc(px, py, pz, s.x, s.y, s.z + len / 2, 1);
  if (curb && dir !== 'z') {
    const side = dir === 'x+' ? 1 : -1;
    b.block({ x: s.x + side * (w / 2 + 0.35), y: s.y + 0.7, z: s.z, sx: 0.7, sz: len, sy: 1.5, style: 'curb' });
  }
  for (let z = s.z + len / 2 - 2; z > s.z - len / 2 + 1; z -= 2.5) b.coin(s.x, s.y + 1.1, z);
}

function sweeper(b, { r = 6.5, speed = 1, arms = 2, gap = 2, push = false } = {}) {
  const z = b.z - gap - r;
  const x = b.x;
  const y = b.y;
  b.add({ t: 'disk', x, y, z, r, sy: 1.2, style: 'arena' });
  b.add({ t: 'disk', x, y: y + 1.6, z, r: 0.8, sy: 1.6, style: 'hub' });
  b.add({ t: 'bar', x, y: y + 0.6, z, len: r - 0.1, radius: 0.3, speed, arms, push });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.coin(x + Math.cos(a) * r * 0.62, y + 1.1, z + Math.sin(a) * r * 0.62);
  }
  b.z = z - r;
}

function lavaStones(b, { n = 5, moving = false, spacing = 3.8, zig = 2 } = {}) {
  const L = n * spacing + 1.6;
  const pz = b.z - 0.4 - L / 2;
  b.block({ x: b.x, y: b.y - 1.1, z: pz, sx: 13, sz: L, sy: 1.2, style: 'lava', kill: true });
  let z = b.z - 0.4 - spacing / 2 - 0.4;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const x = b.x + (i % 2 ? zig : -zig) * (moving ? 0.5 : 1);
    const o = { x, y: b.y, z, sx: 2.4, sz: 2.4, sy: 3, style: 'stone' };
    if (moving) o.move = { x: 2.6, speed: 1, phase: i * 1.7 };
    b.block(o);
    b.coin(x, b.y + 1.1, z);
    if (prev && !moving) b.arc(prev.x, b.y, prev.z, x, b.y, z, 1, 1.4);
    prev = { x, z };
    z -= spacing;
  }
  b.z = pz - L / 2;
  b.nextGap = 0.8;
}

function spinPlanks(b, { n = 2, len = 9, w = 1.9, speed = 0.55, gap = 1, wait = false } = {}) {
  let c = b.z - gap - len / 2;
  for (let i = 0; i < n; i++) {
    const o = { x: b.x, y: b.y, z: c, sx: w, sz: len, sy: 0.7, style: 'plank', color: b.col(), spin: speed };
    if (wait) o.wait = { P: Math.PI / speed, goal: 0 };
    b.block(o);
    b.add({ t: 'disk', x: b.x, y: b.y - 1.2, z: c, r: 0.5, sy: 1.7, style: 'axle', nocollide: true });
    b.coin(b.x, b.y + 1.1, c);
    c -= len + gap;
  }
  b.z = c + len + gap - len / 2;
  b.nextGap = gap;
}

function barBeam(b, { len = 14, w = 1.5, bars = 2, speed = 1.5, floor = 0, push = false } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const s = b.ahead(2, w, len, { style: 'beam', sy: 0.7 });
  b.arc(px, py, pz, s.x, s.y, s.z + len / 2, 1);
  if (floor) b.block({ x: s.x, y: s.y - 0.45, z: s.z, sx: floor, sz: len, sy: 0.8, style: 'ground', bare: true });
  for (let i = 0; i < bars; i++) {
    const z = s.z + len / 2 - ((i + 1) * len) / (bars + 1);
    const side = i % 2 ? -1 : 1;
    const hx = s.x + side * 3;
    b.add({ t: 'disk', x: hx, y: s.y + 1.2, z, r: 0.55, sy: 9, style: 'pillar' });
    b.add({ t: 'bar', x: hx, y: s.y + 0.55, z, len: 5, radius: 0.27, speed: speed * side, arms: 1, phase: i * 1.3, push });
  }
  for (let z = s.z + len / 2 - 1.5; z > s.z - len / 2 + 1; z -= 2) b.coin(s.x, s.y + 1.1, z);
}

function elevator(b, { rise = 6, speed = 0.8, trunk = false } = {}) {
  const p = b.ahead(1.6, 4, 4, { dy: rise / 2, move: { y: rise / 2, speed, phase: -Math.PI / 2 }, style: 'mover', color: b.col(), sy: 0.8 });
  if (trunk) b.add({ t: 'trunk', x: p.x, y: p.y - rise / 2 - 0.8, z: p.z, r: 3.3, h: rise + 2.6 });
  for (let k = 0; k < 3; k++) b.coin(p.x, p.y - rise / 2 + 1.2 + k * (rise / 2), p.z);
  b.y = p.y + rise / 2;
  b.nextGap = 1.6;
}

function swing(b, { L = 5, A = 0.45, period = 4, hold: h = 1.2, size = 4.6, board = 0.05, dock = 0.05, guard = false, lights = false, phase = 0 } = {}) {
  const hold = h > 0 ? Math.max(h, SWING_LEFT + 0.05) : 0;
  const amp = L * Math.sin(A);
  const near = b.z - board - size / 2;
  const far = near - 2 * amp;
  const c = (near + far) / 2;
  const speed = (2 * Math.PI) / period;
  const t0 = phase ? Math.PI / speed + hold : 0;
  b.block({ x: b.x, y: b.y, z: c, sx: size, sz: size, sy: 0.6, style: 'swing', swing: { L, A, speed, hold, t0 }, chevrons: true, guard });
  if (lights) b.add({ t: 'rail', x: b.x, y: b.y - 0.8, z: c, z0: near + size / 2 + board, z1: far - size / 2 - dock, w: size, bare: true });
  const dip = L * (1 - Math.cos(A));
  for (let k = 0; k < 5; k++) {
    const a = A * (1 - k / 2);
    b.coin(b.x, b.y + 1.2 - dip + L * (1 - Math.cos(a)), c + L * Math.sin(a));
  }
  b.z = far - size / 2;
  b.nextGap = dock;
}

function island(b, { size = 6, gap = 1.2, dy = 0, spawn = false } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const s = b.ahead(gap, size, size, spawn ? { dy, style: 'ground', sy: 1.4, spawn } : { dy, style: 'ground', sy: 1.4 });
  if (gap > 0.5) b.arc(px, py, pz, s.x, s.y, s.z + size / 2, 1);
  b.coin(s.x, s.y + 1.1, s.z);
  return s;
}

function secretRoute(b, side, back) {
  const cp = b.cps[b.cps.length - 1];
  const keep = { x: b.x, y: b.y, z: b.z, nextGap: b.nextGap, aimNext: b.aimNext };
  b.stage += 1;
  b.secret = true;
  const ox = cp.x + side * 40;
  const oy = cp.y + 2;
  const oz = cp.z + 12;
  b.x = ox;
  b.y = oy;
  b.z = oz;
  b.block({ x: ox, y: oy, z: oz - 3, sx: 6, sz: 6, sy: 1.6, style: 'ground' });
  b.add({ t: 'secretcp', x: ox, y: oy, z: oz - 3 });
  b.z = oz - 6;
  swing(b, { L: 5.5, A: 0.6, period: 3.8, hold: 0.7, size: 4.2, board: 0.05, dock: 1, guard: true, lights: true });
  tramps(b, { n: 3, zig: 1.6, spacing: 5.8, lead: 0.05, drop: 0.25 });
  crumble(b, { n: 3, size: 3, gap: 2.4, delay: 0.6 });
  const end = b.ahead(4.6, 5, 5, { style: 'ground', sy: 1.4 });
  b.arc(end.x, end.y, end.z + 2.5 + 4.6, end.x, end.y, end.z + 2.5, 2, 1.6);
  b.add({ t: 'portal', x: end.x, y: end.y, z: end.z - 1, yaw: 0, to: back, out: true });
  b.secret = false;
  b.add({ t: 'portal', x: cp.x + side * (cp.r - 1.1), y: cp.y, z: cp.z - 0.6, yaw: Math.PI / 2, to: { x: ox, y: oy, z: oz - 2 }, out: false });
  b.stage -= 1;
  Object.assign(b, keep);
}

function iceSlide(b, { n = 3, len = 8, w = 3.2, gap = 2.4 } = {}) {
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const p = b.ahead(gap, w, len, { dy: -0.5, dx: i % 2 ? 1.5 : -1.5, style: 'ice', surface: 'ice', sy: 1 });
    b.arc(px, py, pz, p.x, p.y, p.z + len / 2, 1);
    b.coin(p.x, p.y + 1.1, p.z);
  }
}

const SEQ = {
  1: [
    (b) => steps(b, { n: 2, size: 4.8, gap: 0, rise: 0.3, zig: 0.6, gate: true }),
    (b) => steps(b, { n: 2, size: 4.8, gap: 1, rise: 0, zig: 0.6, first: false }),
    (b) => bridge(b, { len: 10, w: 3 }),
    (b) => tramps(b, { n: 2, r: 2, zig: 0.4, spacing: 4.6, lead: 0.6 }),
    (b) => {
      steps(b, { n: 1, size: 4.2, gap: 3, rise: 0, zig: 0 });
      sideMovers(b, { n: 2, amp: 1.2, speed: 0.6, size: 4.2, gap: 2.8 });
    },
    (b) => pad(b, { rise: 4, gap: 3 }),
    (b) => stairs(b, { n: 5, rise: 0.9, size: 3.4, gap: 1.9 }),
    (b) => tramps(b, { n: 3 }),
    (b) => pad(b, { rise: 5, gap: 3 }),
    (b) => disks(b, { n: 3, r: 3, spin: 0.45, gap: 2.8 }),
    (b) => ferry(b, { amp: 1.6, size: 4.6, speed: 1.3, hold: 1.6, dock: 0.05, board: 0.05 }),
  ],
  2: [
    (b) => {
      crumble(b, { n: 4, size: 3.4, gap: 1, delay: 1.1 });
      conveyor(b, { len: 12, w: 4.5, dir: 'x+', speed: 2, curb: true, gap: 1 });
    },
    (b) => lavaStones(b, { n: 5, spacing: 4.6, zig: 0.8 }),
    (b) => sweeper(b, { r: 6.5, speed: 0.6, arms: 1, push: true }),
    (b) => crumble(b, { n: 5, size: 3, gap: 1.9, delay: 0.9 }),
    (b) => sideMovers(b, { n: 3, amp: 2.8, speed: 1, size: 3.5, gap: 2 }),
    (b) => spinPlanks(b, { n: 2 }),
    (b) => pad(b, { rise: 6 }),
    (b) => barBeam(b, { len: 14, w: 1.8, bars: 2, speed: 1.0, floor: 4, push: true }),
    (b) => conveyor(b, { len: 14, w: 3.6, dir: 'z', speed: 3 }),
    (b) => sweeper(b, { r: 7.5, speed: 0.75, arms: 4 }),
    (b) => lavaStones(b, { n: 4, moving: true, spacing: 4 }),
  ],
  3: [
    (b) => steps(b, { n: 4, size: 4, gap: 2.2, rise: 0.4, zig: 1.6, ice: true }),
    (b) => tramps(b, { n: 3 }),
    (b) => sideMovers(b, { n: 3, amp: 3, speed: 1.15, size: 3.6, gap: 2 }),
    (b) => iceSlide(b, { n: 3 }),
    (b) => sweeper(b, { r: 6.5, speed: 1.25, arms: 2 }),
    (b) => crumble(b, { n: 6, size: 2.9, gap: 1.8, delay: 0.6 }),
    (b) => disks(b, { n: 4, r: 2.6, spin: 0.85, gap: 1.7 }),
    (b) => {
      pad(b, { rise: 5 });
      pad(b, { rise: 5 });
    },
    (b) => spinPlanks(b, { n: 3, speed: 0.6 }),
    (b) => conveyor(b, { len: 12, w: 3.6, dir: 'x-', speed: 2.4, curb: true }),
    (b) => {
      elevator(b, { rise: 6 });
      ferry(b, { amp: 2.8, size: 4.2, speed: 0.9 });
    },
    (b) => barBeam(b, { len: 9, w: 2.2, bars: 1, speed: 1.6 }),
    (b) => barBeam(b, { len: 9, w: 2.2, bars: 2, speed: 1.6 }),
  ],
  4: [
    (b) => {
      steps(b, { n: 2, size: 4.8, gap: 1, rise: 0.3, zig: 0.6, gate: true });
      b.nextGap = 1.2;
    },
    (b) => tramps(b, { n: 2, r: 2.2, zig: 0.4, spacing: 4.6, lead: 0.05, drop: 0.25 }),
    (b) => stairs(b, { n: 4, rise: 0.8, size: 4, gap: 1.2 }),
    (b) => swing(b, { L: 5, A: 0.45, period: 4, hold: 1.2, size: 4.6, guard: true, lights: true }),
    (b) => {
      swing(b, { L: 5, A: 0.45, period: 4, hold: 0.9, size: 4.2, guard: true, lights: true });
      island(b, { size: 5.5, gap: 0.05, spawn: true });
      swing(b, { L: 5, A: 0.45, period: 4, hold: 0.9, size: 4.2, guard: true, lights: true, phase: true });
    },
    (b) => tramps(b, { n: 3, lead: 0.05, drop: 0.25 }),
    (b) => bridge(b, { len: 12, w: 3 }),
    (b) => disks(b, { n: 3, r: 3, spin: 0.5, gap: 2.4 }),
    (b) => {
      swing(b, { L: 5.5, A: 0.55, period: 4, hold: 0.6, size: 4.2, dock: 0.6, guard: true, lights: true });
      steps(b, { n: 2, size: 3.6, gap: 2.2, rise: 0, zig: 0.8 });
    },
    (b) => pad(b, { rise: 5, gap: 0, land: false }),
    (b) => steps(b, { n: 3, size: 4.4, gap: 1.6, rise: 0, zig: 1 }),
    (b) => barBeam(b, { len: 12, w: 2, bars: 1, speed: 1.0, floor: 4, push: true }),
    (b) => {
      swing(b, { L: 5.5, A: 0.5, period: 4, hold: 0.8, size: 4.2, guard: true, lights: true });
      swing(b, { L: 5.5, A: 0.5, period: 4, hold: 0.8, size: 4.8, board: 1, guard: true, phase: true });
    },
    (b) => crumble(b, { n: 4, size: 3.6, gap: 1.2, delay: 1.0 }),
    (b) => island(b, { size: 6, gap: 1.6 }),
    (b) => {
      b.meta[b.stage] = { camBack: 1.5 };
      swing(b, { L: 7, A: 0.5, period: 4.4, hold: 0.7, size: 4.4, guard: true, lights: true });
      swing(b, { L: 7, A: 0.5, period: 4.4, hold: 0.7, size: 4.8, board: 1, guard: true, phase: true });
      swing(b, { L: 7, A: 0.5, period: 4.4, hold: 0.7, size: 4.8, board: 1, guard: true });
    },
    (b) => {
      tramps(b, { n: 3, rise: 0.8, lead: 0.05, drop: 0.25 });
      pad(b, { rise: 6 });
    },
    (b) => {
      spinPlanks(b, { n: 2, speed: 0.5, w: 2.6, gap: 0.5, wait: true });
      pad(b, { rise: 6, gap: 0.5, land: false, len: 7.5, top: [3.4, 7], flush: true });
      b.finishDy = 0;
    },
  ],
};

const EXTRA = {
  1: [
    (b) => steps(b, { n: 3, size: 3.6, gap: 2.6, rise: 0.3, zig: 1.4 }),
    (b) => sideMovers(b, { n: 3, amp: 2, speed: 0.8, size: 3.8, gap: 2.4 }),
    (b) => tramps(b, { n: 3, zig: 1.6 }),
    (b) => disks(b, { n: 3, r: 2.6, spin: 0.7, gap: 2.4 }),
    (b) => stairs(b, { n: 4, rise: 1, size: 3, gap: 2.2 }),
  ],
  2: [
    (b) => lavaStones(b, { n: 5, moving: true, spacing: 4 }),
    (b) => crumble(b, { n: 5, size: 2.8, gap: 2, delay: 0.6 }),
    (b) => spinPlanks(b, { n: 2, speed: 0.7 }),
    (b) => sweeper(b, { r: 6.5, speed: 0.9, arms: 2 }),
    (b) => sideMovers(b, { n: 3, amp: 3, speed: 1.1, size: 3.4, gap: 2.2 }),
  ],
  3: [
    (b) => iceSlide(b, { n: 3 }),
    (b) => sideMovers(b, { n: 3, amp: 3, speed: 1.3, size: 3.4, gap: 2.2 }),
    (b) => disks(b, { n: 4, r: 2.4, spin: 1, gap: 2 }),
    (b) => barBeam(b, { len: 12, w: 2, bars: 2, speed: 1.8 }),
    (b) => crumble(b, { n: 6, size: 2.6, gap: 2, delay: 0.5 }),
  ],
  4: [
    (b) => swing(b, { L: 5.5, A: 0.55, period: 3.8, hold: 0.5, size: 4, dock: 0.6 }),
    (b) => tramps(b, { n: 3, zig: 1.6, spacing: 5.6 }),
    (b) => disks(b, { n: 3, r: 2.6, spin: 0.7, gap: 2.4 }),
    (b) => crumble(b, { n: 4, size: 3, gap: 1.9, delay: 0.7 }),
    (b) => {
      swing(b, { L: 6, A: 0.55, period: 4, hold: 0.5, size: 4 });
      swing(b, { L: 6, A: 0.55, period: 4, hold: 0.5, size: 4, board: 1, phase: true });
    },
  ],
};

const KIT = { steps, bridge, sideMovers, pad, barBeam, island, conveyor, stairs };
SEQ[5] = stormSeq(KIT);
EXTRA[5] = stormExtra(KIT);
SEQ[6] = gearSeq({ ...KIT, tramps, disks, spinPlanks });
EXTRA[6] = gearExtra({ ...KIT, disks });
const SECRET = { 6: musicBox };

function bonus(b, level, side) {
  const cp = b.cps[b.cps.length - 1];
  let edge = cp.x + side * cp.r;
  let y = cp.y;
  const z = cp.z;
  const n = level === 1 ? 2 : 3;
  const w = level === 1 ? 2.6 : 1.8;
  const gap = b.def.bonusGap || (level === 1 ? 2.3 : level === 2 ? 4.2 : 4.8);
  if (b.def.bonusMark) b.add({ t: 'takeoff', x: edge - side * 0.5, y, z: z - 0.9, dir: side });
  for (let i = 0; i < n; i++) {
    const x = edge + side * (gap + w / 2);
    y += level === 1 ? 0.7 : 0.9;
    const o = { x, y, z: z + (i % 2 ? 0.9 : -0.9), sx: w, sz: w, sy: 0.8, color: b.col(), side: true };
    if (level >= 2 && i === 1) {
      o.style = 'crumble';
      o.crumble = b.def.crumbleHold ? { delay: 0.55, hold: true } : { delay: 0.55 };
    }
    if (level === 3 && i === 2) o.move = { z: 1.6, speed: 1.3, phase: 0 };
    b.block(o);
    edge = x + (side * w) / 2;
  }
  const x = edge + side * (gap + 1.5);
  y += 0.8;
  b.block({ x, y, z, sx: 3, sz: 3, sy: 1, style: 'ground', side: true });
  b.add({ t: 'bigstar', x, y: y + 1.5, z });
}

export function buildCourse(world, extra = false) {
  const b = new Builder(world, extra);
  b.start();
  const seq = extra ? EXTRA[world] : SEQ[world];
  seq.forEach((fn, i) => {
    b.stage = i;
    fn(b);
    if (i < seq.length - 1) {
      b.checkpoint(i % 3 === 2 && !(b.nextGap < 0) ? 0.6 : 0);
      const bo = !extra && b.def.bonus[i];
      if (bo) bonus(b, bo[0], bo[1]);
      const sr = !extra && b.def.secret;
      if (sr && sr.at === i) {
        const cp = b.cps[b.cps.length - 1];
        (SECRET[b.w] || secretRoute)(b, sr.side, { x: cp.x - sr.side * 1.6, y: cp.y, z: cp.z + 1.2 });
      }
    } else b.finish();
  });
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of b.specs) {
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
  }
  const bigStars = b.specs.filter((x) => x.t === 'bigstar').map((x) => ({ x: x.x, y: x.y, z: x.z }));
  const n = b.cps.length - 1;
  const at = extra ? [] : b.def.chests.filter((i) => i > 0 && i < n);
  for (const i of at) {
    const c = b.cps[i];
    c.chest = true;
    b.specs.push({ t: 'chest', x: c.x - c.r + 1.3, y: c.y, z: c.z - c.r + 1.3, index: c.index, stage: c.index - 1 });
  }
  const meta = b.cps.slice(0, -1).map((c, i) => b.meta[i] || {});
  return { specs: b.specs, coins: b.coins, cps: b.cps, bigStars, meta, bounds: { minX, maxX, minY, maxY, minZ, maxZ } };
}
