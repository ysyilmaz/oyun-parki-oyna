const LIFT_OVER = 1.2;
const EXIT = 1.2;
const LAND_EDGE = 2;
const LAND_IN = 4;
const LIP = 0.15;
const CALM = 1.2;
const FLUSH = -0.2;

function flush(b) {
  b.nextGap = FLUSH;
}

function landLip(b, L, w) {
  b.block({ x: L.x, y: L.y + LIP, z: L.z - L.sz / 2 + 0.15, sx: w, sz: 0.3, sy: LIP, style: 'curb' });
}

function since(b, n0) {
  return b.specs.slice(n0).filter((s) => s.t === 'block' || s.t === 'disk');
}

export function windLane(b, list, { vx = 0, vz = 0, lip = false, pulse = null, h = 4.5, over = 0, sock = true, chev = true } = {}) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let top = -Infinity;
  let low = Infinity;
  for (const s of list) {
    const hx = s.r || s.sx / 2;
    const hz = s.r || s.sz / 2;
    const mx = s.move && s.move.x ? Math.abs(s.move.x) : 0;
    x0 = Math.min(x0, s.x - hx - mx);
    x1 = Math.max(x1, s.x + hx + mx);
    z0 = Math.min(z0, s.z - hz);
    z1 = Math.max(z1, s.z + hz);
    top = Math.max(top, s.y);
    low = Math.min(low, s.y);
  }
  if (vz) z0 -= over;
  else if (vx) {
    if (z1 - z0 > 3) z0 += CALM;
    x0 -= vx < 0 ? over : 0;
    x1 += vx > 0 ? over : 0;
  }
  return b.add({ t: 'wind', x: (x0 + x1) / 2, y: top, z: (z0 + z1) / 2, sx: x1 - x0, sz: z1 - z0, h, y0: low - 1.5, vx, vz, lip, pulse, sock, chev });
}

export function updraft(b, { rise = 5, r = 2.2, gap = 1.2, size = 6, land = 6, landing = true, lip = true } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const base = b.ahead(gap, size, size, { style: 'ground', sy: 1.4 });
  if (gap > 0.5) b.arc(px, py, pz, base.x, base.y, base.z + size / 2, gap >= 2 ? 2 : 1);
  const u = b.add({ t: 'updraft', x: base.x, y: base.y, z: base.z, r, rise: rise + LIFT_OVER, exit: { x: base.x, z: base.z - EXIT }, target: { x: base.x, y: base.y + rise, z: base.z - LAND_EDGE - land / 2 } });
  const turns = Math.max(4, Math.round(rise));
  for (let k = 0; k < turns; k++) {
    const a = k * 1.25;
    b.coin(base.x + Math.cos(a) * 0.55, base.y + 1.4 + ((rise - 0.4) * (k + 0.5)) / turns, base.z + Math.sin(a) * 0.55);
  }
  b.x = base.x;
  b.y = base.y;
  b.z = base.z - LAND_EDGE;
  if (landing) {
    const L = b.ahead(0, land, land, { dy: rise, style: 'ground', sy: 1.4 });
    b.coin(L.x, L.y + 1.1, L.z - 0.6);
    if (lip) landLip(b, L, land);
  } else {
    b.y = base.y + rise;
    b.nextGap = 0;
    b.finishDy = 0;
  }
  return u;
}

function lipLane(b, w, len, gap, wind) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const s = b.ahead(gap, w, len, { style: 'block', color: b.col(), sy: 1.2 });
  if (gap > 0.5) b.arc(px, py, pz, s.x, s.y, s.z + len / 2, 1);
  const side = -Math.sign(wind.vx || 0);
  for (let z = s.z + len / 2 - 1.6; z > s.z - len / 2 + 1; z -= 2.4) b.coin(s.x + side * (w / 2 - 1.3), s.y + 1.1, z);
  windLane(b, [s], wind);
  return s;
}

function arena(b, { r = 7, gap = 1.4, fans = 8 } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const z = b.z - gap - r;
  b.add({ t: 'disk', x: b.x, y: b.y, z, r, sy: 1.2, style: 'arena' });
  b.arc(px, py, pz, b.x, b.y, z + r, 1);
  b.add({ t: 'fans', x: b.x, y: b.y, z, r: r + 1.3, n: fans });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.coin(b.x + Math.cos(a) * r * 0.6, b.y + 1.1, z + Math.sin(a) * r * 0.6);
  }
  b.z = z;
  return { x: b.x, y: b.y, z };
}

function finaleLift(b, rise, at) {
  const c = at || { x: b.x, y: b.y, z: b.z };
  const u = b.add({ t: 'updraft', x: c.x, y: c.y, z: c.z, r: 2.4, rise: rise + LIFT_OVER, exit: { x: c.x, z: c.z - EXIT }, target: { x: c.x, y: c.y + rise, z: c.z - LAND_IN - 0.5 }, big: true });
  for (let k = 0; k < 9; k++) {
    const a = k * 1.1;
    b.coin(c.x + Math.cos(a) * 0.6, c.y + 1.4 + ((rise - 0.4) * (k + 0.5)) / 9, c.z + Math.sin(a) * 0.6);
  }
  b.x = c.x;
  b.y = c.y + rise;
  b.z = c.z - LAND_EDGE;
  b.nextGap = 0;
  b.finishDy = 0;
  return u;
}

export function stormSeq(h) {
  const { steps, bridge, sideMovers, pad, barBeam, island, conveyor, stairs } = h;
  return [
    (b) => {
      steps(b, { n: 2, size: 4.6, gap: 1.2, rise: 0.3, zig: 0.8, gate: true });
      b.nextGap = 1.2;
    },
    (b) => {
      lipLane(b, 6, 14, 1.2, { vx: 1.5, lip: true });
      flush(b);
    },
    (b) => {
      lipLane(b, 5, 12, 1.4, { vx: -2.2, lip: true });
      flush(b);
    },
    (b) => bridge(b, { len: 12, w: 3 }),
    (b) => {
      const n0 = b.specs.length;
      steps(b, { n: 3, size: 5, gap: 1.8, rise: 0, zig: 0 });
      windLane(b, since(b, n0), { vx: -0.9, over: 1 });
      flush(b);
    },
    (b) => {
      updraft(b, { rise: 5, gap: FLUSH, lip: false });
      flush(b);
    },
    (b) => {
      sideMovers(b, { n: 2, amp: 1, speed: 0.8, size: 4.8, gap: 1.6 });
      flush(b);
    },
    (b) => {
      b.meta[b.stage] = { camBack: 1.5 };
      updraft(b, { rise: 4, gap: FLUSH, lip: false, land: 4 });
      updraft(b, { rise: 4, gap: FLUSH, lip: false });
      flush(b);
    },
    (b) => {
      barBeam(b, { len: 12, w: 2.2, bars: 2, speed: 1.0, floor: 4, push: true });
      flush(b);
    },
    (b) => {
      island(b, { size: 8, gap: 1.4 });
      flush(b);
    },
    (b) => {
      const n0 = b.specs.length;
      conveyor(b, { len: 12, w: 4.5, dir: 'z', speed: 1.2, gap: 0.3 });
      windLane(b, since(b, n0), { vx: 2, lip: true });
      flush(b);
    },
    (b) => {
      const px = b.x;
      const py = b.y;
      const pz = b.z;
      const s = b.ahead(1.2, 3, 10, { style: 'beam', sy: 0.7 });
      b.arc(px, py, pz, s.x, s.y, s.z + 5, 1);
      for (let z = s.z + 3.5; z > s.z - 4.5; z -= 2.5) b.coin(s.x, s.y + 1.1, z);
      windLane(b, [s], { vx: -2, pulse: { on: 3, off: 2, spin: 0.6 } });
      flush(b);
    },
    (b) => {
      stairs(b, { n: 3, rise: 0.6, size: 4.4, gap: 1 });
      flush(b);
    },
    (b) => {
      pad(b, { rise: 6, gap: 1.4 });
      flush(b);
    },
    (b) => {
      const n0 = b.specs.length;
      sideMovers(b, { n: 3, amp: 2.2, speed: 0.9, size: 3.8, gap: 2 });
      windLane(b, since(b, n0), { vz: -1 });
      flush(b);
    },
    (b) => {
      const n0 = b.specs.length;
      steps(b, { n: 4, size: 3.6, gap: 3, rise: 0, zig: 1 });
      windLane(b, since(b, n0), { vz: -1.5, over: 1 });
      flush(b);
    },
    (b) => {
      island(b, { size: 7, gap: 1.4 });
      flush(b);
    },
    (b) => {
      b.meta[b.stage] = { camBack: 2 };
      liftChain(b, 3, 6, FLUSH, false);
      flush(b);
    },
    (b) => {
      const n0 = b.specs.length;
      steps(b, { n: 4, size: 3.8, gap: 2, rise: 0, zig: 0.4 });
      since(b, n0).forEach((s, i) => windLane(b, [s], { vx: i < 2 ? -1.6 : 1.6, over: 0 }));
      flush(b);
    },
    (b) => {
      const c = arena(b, { r: 7, gap: 1.4 });
      finaleLift(b, 10, { x: c.x, y: c.y, z: c.z - 3.2 });
    },
  ];
}

function liftChain(b, n, rise, gap, lip = true) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const base = b.ahead(gap, 6, 6, { style: 'ground', sy: 1.4 });
  if (gap > 0.5) b.arc(px, py, pz, base.x, base.y, base.z + 3, 1);
  let c = { x: base.x, y: base.y, z: base.z };
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    const dx = last ? 0 : k % 2 ? -1.5 : 1.5;
    const tz = c.z - LAND_EDGE - 3;
    const tx = c.x + dx;
    const d = Math.hypot(tx - c.x, tz - c.z);
    b.add({ t: 'updraft', x: c.x, y: c.y, z: c.z, r: 2.2, rise: rise + LIFT_OVER, exit: { x: c.x + ((tx - c.x) / d) * EXIT, z: c.z + ((tz - c.z) / d) * EXIT }, target: { x: tx, y: c.y + rise, z: tz } });
    for (let j = 0; j < 6; j++) {
      const a = j * 1.25 + k;
      b.coin(c.x + Math.cos(a) * 0.55, c.y + 1.4 + ((rise - 0.4) * (j + 0.5)) / 6, c.z + Math.sin(a) * 0.55);
    }
    b.x = c.x;
    b.y = c.y;
    b.z = c.z - LAND_EDGE;
    const L = b.ahead(0, 6, 6, { dy: rise, dx, style: 'ground', sy: 1.4 });
    c = { x: L.x, y: L.y, z: L.z };
    if (last && lip) landLip(b, L, 6);
  }
  b.coin(c.x, c.y + 1.1, c.z - 0.6);
}

export function stormExtra(h) {
  const { steps, sideMovers } = h;
  return [
    (b) => lipLane(b, 5, 12, 2.4, { vx: 2, lip: true }),
    (b) => updraft(b, { rise: 5, gap: 1.6 }),
    (b) => {
      const n0 = b.specs.length;
      steps(b, { n: 3, size: 3.8, gap: 2, rise: 0, zig: 0.8 });
      windLane(b, since(b, n0), { vx: 1.8, over: 1 });
    },
    (b) => {
      const n0 = b.specs.length;
      sideMovers(b, { n: 2, amp: 2.4, speed: 1, size: 3.8, gap: 2 });
      windLane(b, since(b, n0), { vz: -0.8 });
    },
    (b) => {
      const c = arena(b, { r: 6, gap: 1.4, fans: 6 });
      finaleLift(b, 8, { x: c.x, y: c.y, z: c.z - 2.6 });
    },
  ];
}
