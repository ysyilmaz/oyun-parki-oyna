const CART_L = 3.6;
const CART_GAP = 0.15;

let gid = 0;
let sid = 0;

function beats(b, { n = 4, size = 3.8, gap = 1.2, zig = 1.2, mode = 'clock', sets = 2, cycle = 4, solid = 2.5, ew = 4, catchFloor = false } = {}) {
  const id = ++gid;
  const entry = { x: b.x, y: b.y, z: b.z, w: ew };
  const g = b.add({ t: 'beatgroup', id, mode, sets, cycle, solid, entry, x: b.x, y: b.y, z: b.z });
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const cz = b.z - gap - size / 2;
    const cx = (i === 0 ? entry.x : b.x) + (i % 2 ? zig : -zig) * (i === 0 ? 0.5 : 1);
    const s = b.add({ t: 'beat', gid: id, i, set: i % sets, x: cx, y: b.y, z: cz, sx: size, sz: size, sy: 0.7, gap });
    tiles.push(s);
    b.arc(px, py, pz, cx, b.y, cz + size / 2, 1);
    b.coin(cx, b.y + 1.1, cz);
    b.x = cx;
    b.z = cz - size / 2;
  }
  g.n = n;
  if (catchFloor) {
    const z0 = entry.z;
    const z1 = b.z;
    const xs = tiles.map((t) => t.x);
    const x0 = Math.min(...xs) - size / 2 - 1.5;
    const x1 = Math.max(...xs) + size / 2 + 1.5;
    const fy = b.y - 2.2;
    b.block({ x: (x0 + x1) / 2, y: fy, z: (z0 + z1) / 2, sx: x1 - x0, sz: z0 - z1 + 1, sy: 0.6, style: 'ground', bare: true, side: true });
    const sx = x1 + 1.3;
    b.block({ x: sx, y: fy + 0.75, z: (z0 + z1) / 2 + 2, sx: 2.2, sz: 2.4, sy: 0.6, color: 1, side: true });
    b.block({ x: sx, y: fy + 1.5, z: (z0 + z1) / 2 + 4.6, sx: 2.2, sz: 2.4, sy: 0.6, color: 1, side: true });
    b.block({ x: sx - 0.6, y: b.y, z: z0 + 1.6, sx: 3.4, sz: 3.2, sy: 0.6, color: 1, side: true });
  }
  b.nextGap = gap;
  return g;
}

function rail(pts) {
  return pts.map(([x, y, z]) => ({ x, y, z }));
}

function gate(b, { len = 8, w = 4, gapLen = 4.6, lock = 'cyan', bx = 0 } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const walk = b.ahead(b.nextGap ?? 1.2, w, len, { style: 'block', color: b.col(), sy: 1.2 });
  b.nextGap = null;
  b.arc(px, py, pz, walk.x, walk.y, walk.z + len / 2, 1);
  const id = ++sid;
  const sw = { x: walk.x + bx, y: walk.y, z: walk.z + 0.6 };
  const edge = walk.z - len / 2;
  b.add({ t: 'switch', id, lock, x: sw.x, y: sw.y, z: sw.z, rail: rail([[sw.x, sw.y, sw.z - 1], [sw.x, sw.y, edge + 1.4], [walk.x, walk.y, edge + 0.6]]) });
  b.add({ t: 'door', ids: [id], lock: [lock], x: walk.x, y: walk.y, z: edge - 0.16, w });
  b.add({ t: 'xbridge', id, lock, x: walk.x, y: walk.y, z: edge - gapLen / 2, sx: 2.8, sz: gapLen + 0.2, sy: 0.5 });
  for (let k = 1; k <= 2; k++) b.coin(walk.x, walk.y + 1.1, edge - (gapLen * k) / 3);
  b.x = walk.x;
  b.z = edge - gapLen;
  b.nextGap = 0;
}

function twoSwitch(b, { gapLen = 5, lockA = 'cyan', lockB = 'violet' } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const hub = b.ahead(1.2, 6, 6, { style: 'ground', sy: 1.4 });
  b.arc(px, py, pz, hub.x, hub.y, hub.z + 3, 1);
  const L = b.block({ x: hub.x - 6.2, y: hub.y + 0.4, z: hub.z + 0.6, sx: 3.6, sz: 3.6, sy: 1, color: b.col() });
  const ia = ++sid;
  const edge = hub.z - 3;
  b.add({ t: 'switch', id: ia, lock: lockA, x: L.x, y: L.y, z: L.z, rail: rail([[L.x + 1, L.y, L.z], [L.x + 1.7, L.y, L.z], [hub.x - 3, hub.y, L.z], [hub.x - 0.7, hub.y, L.z - 0.5], [hub.x - 0.7, hub.y, edge + 0.6]]) });
  b.coin(L.x, L.y + 1.1, L.z);
  const R = b.block({ x: hub.x + 6.2, y: hub.y + 0.4, z: hub.z + 0.6, sx: 3.6, sz: 3.6, sy: 1, color: b.col() });
  const ib = ++sid;
  b.add({ t: 'switch', id: ib, lock: lockB, x: R.x, y: R.y, z: R.z, rail: rail([[R.x - 1, R.y, R.z], [R.x - 1.7, R.y, R.z], [hub.x + 3, hub.y, R.z], [hub.x + 0.7, hub.y, R.z - 0.5], [hub.x + 0.7, hub.y, edge + 0.6]]) });
  b.coin(R.x, R.y + 1.1, R.z);
  b.add({ t: 'door', ids: [ia, ib], lock: [lockA, lockB], x: hub.x, y: hub.y, z: edge - 0.16, w: 6 });
  b.add({ t: 'xbridge', id: ia, lock: lockA, x: hub.x, y: hub.y, z: edge - gapLen / 4, sx: 2.8, sz: gapLen / 2 + 0.1, sy: 0.5 });
  b.add({ t: 'xbridge', id: ib, lock: lockB, x: hub.x, y: hub.y, z: edge - (gapLen * 3) / 4, sx: 2.8, sz: gapLen / 2 + 0.1, sy: 0.5 });
  b.coin(hub.x, hub.y + 1.1, edge - gapLen / 2);
  b.x = hub.x;
  b.z = edge - gapLen;
  b.nextGap = 0;
}

function pistons(b, { n = 3, size = 3.8, gap = 1.1, amp = 0.6, speed = 1.0, zig = 1.0 } = {}) {
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const p = b.ahead(gap, size, size, { dx: i % 2 ? zig * 2 : -zig, style: 'mover', color: b.col(), sy: 0.8, move: { y: amp, speed, phase: i * 2.1 }, piston: true });
    b.arc(px, py, pz, p.x, p.y, p.z + size / 2, 1);
    b.coin(p.x, p.y + 1.4, p.z);
  }
}

function trackPath(x0, y, z0, len, shape) {
  const pts = [];
  const n = Math.round(len);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [dx, dz] = shape(t, len);
    pts.push({ x: x0 + dx, y, z: z0 + dz });
  }
  return pts;
}

function cart(b, { len = 40, speed = 3.5, finale = false, shape, coinsHigh = true } = {}) {
  const x0 = b.x;
  const y = b.y;
  const z0 = b.z - CART_GAP - CART_L / 2;
  const path = trackPath(x0, y, z0, len, shape);
  b.add({ t: 'cart', x: x0, y, z: z0, path, speed, finale });
  for (let i = 3; i < path.length - 3; i += 4) {
    const p = path[i];
    b.coin(p.x, p.y + 1.15, p.z);
    if (coinsHigh && i % 8 === 7) b.coin(p.x, p.y + 2.4, p.z);
  }
  const e = path[path.length - 1];
  b.x = e.x;
  b.z = e.z - CART_L / 2;
  return path;
}

function freezeButton(b, side) {
  const cp = b.cps[b.cps.length - 1];
  const x = cp.x + side * (cp.r - 1.3);
  const z = cp.z + 1;
  return b.add({ t: 'freeze', side: true, x, y: cp.y, z, lock: 'violet', target: gid + 1, rail: rail([[x, cp.y, z - 1], [x, cp.y, cp.z - cp.r + 0.6], [cp.x + side * 1.4, cp.y, cp.z - cp.r + 0.3]]) });
}

export function musicBox(b, side, back) {
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
  beats(b, { n: 5, size: 3.4, gap: 2.0, zig: 1.4, mode: 'clock', sets: 2, cycle: 2, solid: 1.25, ew: 6 });
  gate(b, { len: 7, w: 3.6, gapLen: 4.2, lock: 'cyan', bx: 0.6 });
  const end = b.ahead(0.05, 5, 5, { style: 'ground', sy: 1.4 });
  b.coin(end.x, end.y + 1.1, end.z + 1.2);
  b.add({ t: 'portal', x: end.x, y: end.y, z: end.z - 1, yaw: 0, to: back, out: true });
  b.secret = false;
  b.add({ t: 'portal', x: cp.x + side * (cp.r - 1.1), y: cp.y, z: cp.z - 2, yaw: Math.PI / 2, to: { x: ox, y: oy, z: oz - 2 }, out: false });
  b.stage -= 1;
  Object.assign(b, keep);
}

export function gearSeq(h) {
  const { steps, bridge, sideMovers, pad, barBeam, island, conveyor, stairs, tramps, disks, spinPlanks } = h;
  gid = 0;
  sid = 0;
  return [
    (b) => {
      gid = 0;
      sid = 0;
      steps(b, { n: 2, size: 4.6, gap: 1.2, rise: 0.3, zig: 0.8, gate: true });
      bridge(b, { len: 10, w: 3 });
    },
    (b) => gate(b, { len: 8, w: 4, gapLen: 5.2, lock: 'cyan' }),
    (b) => steps(b, { n: 3, size: 4, gap: 2, rise: 0.4, zig: 1.2 }),
    (b) => beats(b, { n: 4, size: 4, gap: 1.6, mode: 'wait', ew: 6.5, catchFloor: true }),
    (b) => beats(b, { n: 4, size: 3.8, gap: 1.8, mode: 'clock', ew: 6.5, catchFloor: true }),
    (b) => tramps(b, { n: 2, r: 2.2, zig: 0.4, spacing: 4.6, lead: 0.6 }),
    (b) => disks(b, { n: 3, r: 3, spin: 0.5, gap: 1.2 }),
    (b) => beats(b, { n: 5, size: 3.6, gap: 1.9, mode: 'clock', ew: 6.5 }),
    (b) => pistons(b, { n: 3, size: 4.6, gap: 0.1, amp: 0.45, speed: 0.9, zig: 0.6 }),
    (b) => twoSwitch(b, { gapLen: 5 }),
    (b) => bridge(b, { len: 12, w: 3 }),
    (b) => sideMovers(b, { n: 3, amp: 2, speed: 0.8, size: 3.8, gap: 1.8 }),
    (b) => {
      cart(b, { len: 40, speed: 3.5, shape: (t, L) => [Math.sin(t * Math.PI * 2) * 3.2, -t * L] });
      island(b, { size: 6, gap: CART_GAP });
    },
    (b) => {
      conveyor(b, { len: 12, w: 4.5, dir: 'x+', speed: 1.0, curb: true, gap: 1.2 });
      conveyor(b, { len: 12, w: 4.5, dir: 'x-', speed: 1.0, curb: true, gap: 1.2 });
    },
    (b) => beats(b, { n: 6, size: 3.6, gap: 1.9, mode: 'clock', sets: 3, cycle: 6, solid: 2.5, ew: 6.5 }),
    (b) => island(b, { size: 8, gap: 1.4 }),
    (b) => disks(b, { n: 2, r: 3.4, spin: 0.35, gap: 2 }),
    (b) => barBeam(b, { len: 14, w: 2.2, bars: 2, speed: 1.0, floor: 4, push: true }),
    (b) => {
      stairs(b, { n: 3, rise: 0.6, size: 4.4, gap: 1 });
      b.nextGap = 1;
    },
    (b) => {
      freezeButton(b, 1);
      beats(b, { n: 6, size: 3.6, gap: 1.9, mode: 'clock', ew: 6.5 });
    },
    (b) => pad(b, { rise: 6, gap: 1.4 }),
    (b) => {
      b.meta[b.stage] = { camBack: 1.5 };
      const path = cart(b, { len: 70, speed: 5, finale: true, coinsHigh: true, shape: (t, L) => [Math.sin(t * Math.PI * 1.5) * 9 * Math.min(1, (1 - t) * 6), -t * L] });
      const e = path[path.length - 1];
      b.x = e.x;
      b.z = e.z + 5.5;
      b.nextGap = 0;
      b.finishDy = 0;
    },
  ];
}

export function gearExtra(h) {
  const { steps, sideMovers, disks } = h;
  return [
    (b) => {
      gid = 100;
      sid = 100;
      steps(b, { n: 3, size: 3.8, gap: 2.2, rise: 0.3, zig: 1.2 });
    },
    (b) => beats(b, { n: 5, size: 3.4, gap: 2.0, mode: 'clock', sets: 2, cycle: 3, solid: 1.9, ew: 6.5 }),
    (b) => disks(b, { n: 3, r: 2.6, spin: 0.7, gap: 2.2 }),
    (b) => sideMovers(b, { n: 3, amp: 2.4, speed: 1, size: 3.6, gap: 2 }),
    (b) => beats(b, { n: 6, size: 3.4, gap: 2.0, mode: 'clock', sets: 3, cycle: 4.5, solid: 1.9, ew: 6.5 }),
  ];
}
