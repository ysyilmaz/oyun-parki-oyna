export const PHYS = {
  gravity: 30,
  fallMul: 1.65,
  jump: 12.5,
  run: 8,
  radius: 0.42,
  height: 1.7,
};

export function padPower(rise) {
  return Math.sqrt(2 * PHYS.gravity * (rise + 2.4));
}

class Builder {
  constructor(world) {
    this.w = world;
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
    this.coins.push({ x, y, z, stage: this.stage });
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
    const gap = this.nextGap ?? (this.w === 1 ? 1.2 : 2.2);
    this.nextGap = null;
    const size = this.w === 1 ? 7 : 6.5;
    const px = this.x;
    const py = this.y;
    const pz = this.z;
    const s = this.ahead(gap, size, size, { dy, style: 'ground', sy: 1.6 });
    if (gap > 0) this.arc(px, py, pz, s.x, s.y, s.z + size / 2, 1);
    const index = this.cps.length;
    this.cps.push({ x: s.x, y: s.y, z: s.z, index, r: size / 2 });
    this.add({ t: 'cp', x: s.x, y: s.y, z: s.z, index });
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

function ferry(b, { amp = 3, size = 4.4, speed = 0.8, hold = 0, dock = null } = {}) {
  const near = b.z - 1.2 - size / 2;
  const far = near - 2 * amp;
  const c = (near + far) / 2;
  const move = hold ? { z: amp, speed, phase: Math.PI / 2, hold } : { z: amp, speed, phase: Math.PI / 2 };
  b.block({ x: b.x, y: b.y, z: c, sx: size, sz: size, sy: 0.8, style: 'mover', color: b.col(), move, chevrons: hold > 0 });
  if (hold) b.add({ t: 'rail', x: b.x, y: b.y - 0.8, z: c, z0: near + size / 2, z1: far - size / 2, w: size });
  for (let k = 0; k < 3; k++) b.coin(b.x, b.y + 1.2, near - (k * (near - far)) / 2);
  b.z = far - size / 2;
  b.nextGap = dock ?? 1.2;
  if (dock !== null) b.finishDy = 0;
}

function tramps(b, { n = 3, spacing = 5.4, power = 16, r = 1.6, zig = 1.2, lead = 1 } = {}) {
  let z = b.z - lead - r;
  const y = b.y - 1.2;
  let prev = null;
  for (let i = 0; i < n; i++) {
    const x = b.x + (i % 2 ? zig : -zig);
    const d = b.add({ t: 'disk', x, y, z, r, sy: 0.6, style: 'tramp', surface: 'tramp', power });
    if (prev) prev.target = { x, y, z };
    prev = d;
    b.coin(x, y + 4.2, z);
    b.coin(x, y + 2.6, z);
    z -= spacing;
  }
  b.z = z + spacing - r - lead;
  b.nextGap = 0;
  b.aimNext = prev;
}

function pad(b, { rise = 5, dist = 3.6 } = {}) {
  const p = b.ahead(2.2, 5, 5, { color: b.col(), sy: 1 });
  const pd = b.block({ x: p.x, y: p.y + 0.22, z: p.z, sx: 2.4, sz: 2.4, sy: 0.3, style: 'pad', surface: 'pad', power: padPower(rise) });
  const t = b.ahead(dist, 6, 6, { dy: rise, style: 'ground', sy: 1.4 });
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
  b.coin(t.x, t.y + 1.1, t.z);
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
    const p = b.ahead(gap, size, size, { dx: i % 2 ? 1.1 : -1.1, style: 'crumble', crumble: { delay }, sy: 0.7 });
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

function lavaStones(b, { n = 5, moving = false, spacing = 3.8 } = {}) {
  const L = n * spacing + 1.6;
  const pz = b.z - 0.4 - L / 2;
  b.block({ x: b.x, y: b.y - 1.1, z: pz, sx: 13, sz: L, sy: 1.2, style: 'lava', kill: true });
  let z = b.z - 0.4 - spacing / 2 - 0.4;
  for (let i = 0; i < n; i++) {
    const x = b.x + (i % 2 ? 2 : -2) * (moving ? 0.5 : 1);
    const o = { x, y: b.y, z, sx: 2.4, sz: 2.4, sy: 3, style: 'stone' };
    if (moving) o.move = { x: 2.6, speed: 1, phase: i * 1.7 };
    b.block(o);
    b.coin(x, b.y + 1.1, z);
    z -= spacing;
  }
  b.z = pz - L / 2;
  b.nextGap = 0.8;
}

function spinPlanks(b, { n = 2, len = 9, w = 1.9, speed = 0.55 } = {}) {
  let c = b.z - 1 - len / 2;
  for (let i = 0; i < n; i++) {
    b.block({ x: b.x, y: b.y, z: c, sx: w, sz: len, sy: 0.7, style: 'plank', color: b.col(), spin: speed });
    b.add({ t: 'disk', x: b.x, y: b.y - 1.2, z: c, r: 0.5, sy: 1.7, style: 'axle', nocollide: true });
    b.coin(b.x, b.y + 1.1, c);
    c -= len + 1;
  }
  b.z = c + len + 1 - len / 2;
  b.nextGap = 1;
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

function elevator(b, { rise = 6, speed = 0.8 } = {}) {
  const p = b.ahead(1.6, 4, 4, { dy: rise / 2, move: { y: rise / 2, speed, phase: -Math.PI / 2 }, style: 'mover', color: b.col(), sy: 0.8 });
  for (let k = 0; k < 3; k++) b.coin(p.x, p.y - rise / 2 + 1.2 + k * (rise / 2), p.z);
  b.y = p.y + rise / 2;
  b.nextGap = 1.6;
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
    (b) => sideMovers(b, { n: 2, amp: 1.2, speed: 0.6, size: 4.2, gap: 1.4 }),
    (b) => pad(b, { rise: 4 }),
    (b) => stairs(b, { n: 5, rise: 0.9, size: 3.4, gap: 1.2 }),
    (b) => tramps(b, { n: 3 }),
    (b) => pad(b, { rise: 5 }),
    (b) => disks(b, { n: 3, r: 3, spin: 0.45, gap: 1.5 }),
    (b) => ferry(b, { amp: 1.6, size: 4.6, speed: 1.3, hold: 1.6, dock: 0.3 }),
  ],
  2: [
    (b) => {
      crumble(b, { n: 4, size: 3.4, gap: 1, delay: 1.1 });
      conveyor(b, { len: 12, w: 4.5, dir: 'x+', speed: 2, curb: true, gap: 1 });
    },
    (b) => lavaStones(b, { n: 5 }),
    (b) => sweeper(b, { r: 6.5, speed: 0.6, arms: 1, push: true }),
    (b) => crumble(b, { n: 5, size: 3, gap: 1.2, delay: 0.7 }),
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
    (b) => crumble(b, { n: 6, size: 2.9, gap: 1.2, delay: 0.6 }),
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
};

function bonus(b, level, side) {
  const cp = b.cps[b.cps.length - 1];
  let edge = cp.x + side * cp.r;
  let y = cp.y;
  const z = cp.z;
  const n = level === 1 ? 2 : 3;
  const w = level === 1 ? 2.6 : 1.8;
  const gap = level === 1 ? 2.3 : level === 2 ? 4.2 : 4.8;
  for (let i = 0; i < n; i++) {
    const x = edge + side * (gap + w / 2);
    y += level === 1 ? 0.7 : 0.9;
    const o = { x, y, z: z + (i % 2 ? 0.9 : -0.9), sx: w, sz: w, sy: 0.8, color: b.col() };
    if (level >= 2 && i === 1) {
      o.style = 'crumble';
      o.crumble = { delay: 0.55 };
    }
    if (level === 3 && i === 2) o.move = { z: 1.6, speed: 1.3, phase: 0 };
    b.block(o);
    edge = x + (side * w) / 2;
  }
  const x = edge + side * (gap + 1.5);
  y += 0.8;
  b.block({ x, y, z, sx: 3, sz: 3, sy: 1, style: 'ground' });
  b.add({ t: 'bigstar', x, y: y + 1.5, z });
}

const BONUS = {
  1: { 4: [1, 1], 7: [1, -1] },
  2: { 2: [2, -1], 6: [2, 1] },
  3: { 1: [3, 1], 7: [3, -1] },
};

export function buildCourse(world) {
  const b = new Builder(world);
  b.start();
  const seq = SEQ[world];
  seq.forEach((fn, i) => {
    b.stage = i;
    fn(b);
    if (i < seq.length - 1) {
      b.checkpoint(i % 3 === 2 && !(b.nextGap < 0) ? 0.6 : 0);
      const bo = BONUS[world][i];
      if (bo) bonus(b, bo[0], bo[1]);
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
  const at = world === 1 ? [Math.round(n / 2)] : [Math.round(n / 3), Math.round((2 * n) / 3)];
  for (const i of at) {
    const c = b.cps[i];
    c.chest = true;
    b.specs.push({ t: 'chest', x: c.x - c.r + 1.3, y: c.y, z: c.z - c.r + 1.3, index: c.index });
  }
  return { specs: b.specs, coins: b.coins, cps: b.cps, bigStars, bounds: { minX, maxX, minY, maxY, minZ, maxZ } };
}
