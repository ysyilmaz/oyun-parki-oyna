const FLUSH = -0.2;
const TAB_W = 2.4;
const TAB_D = 1.2;
const WALL = 4;
const DOOR_W = 3.4;

let pid = 0;
let island = null;
let fid = 0;
let sid = 0;

function rail(pts) {
  return pts.map(([x, y, z]) => ({ x, y, z }));
}

function catchUnder(b, tiles, size, z0, z1, entry, dy = 2.2, pad = 1.5) {
  const xs = tiles.map((t) => t.x);
  const x0 = Math.min(...xs) - size / 2 - pad;
  const x1 = Math.max(...xs) + size / 2 + pad;
  const fy = Math.min(...tiles.map((t) => t.y)) - dy;
  b.block({ x: (x0 + x1) / 2, y: fy, z: (z0 + z1) / 2, sx: x1 - x0, sz: z0 - z1 + 1, sy: 0.6, style: 'ground', bare: true, side: true });
  const sx = x1 + 1.3;
  const steps = Math.max(1, Math.ceil((entry.y - fy) / 0.75) - 1);
  for (let k = 1; k <= steps; k++) b.block({ x: sx, y: fy + k * 0.75, z: (z0 + z1) / 2 + 2 + (k - 1) * 2.6, sx: 2.2, sz: 2.4, sy: 0.6, color: 1, side: true });
  b.block({ x: sx - 0.6, y: entry.y, z: z0 + 1.6, sx: 3.4, sz: 3.2, sy: 0.6, color: 1, side: true });
}

function exitPad(b, gap, w = 4.4, len = 3) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const s = b.ahead(gap, w, len, { style: 'block', color: b.col(), sy: 1.2 });
  b.arc(px, py, pz, s.x, s.y, s.z + len / 2, 1);
  return s;
}

function popupRun(b, { n = 4, size = 3.4, gap = 1.2, zig = 0.6, rise = 0, T = 14, catchFloor = false, exit = true, firstRise = 0, exitLen = 3 } = {}) {
  const id = ++pid;
  const tab = { x: b.x, y: b.y, z: b.z + TAB_D / 2 + 0.35, sx: TAB_W, sz: TAB_D };
  const entry = { x: b.x, y: b.y, z: b.z };
  b.add({ t: 'popgroup', id, T, tab, x: tab.x, y: tab.y, z: tab.z });
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const cz = b.z - gap - size / 2;
    const cx = i === 0 ? b.x : b.x + (i % 2 ? zig * 2 : -zig * 2);
    const top = b.y + (i === 0 ? firstRise : rise);
    const s = b.add({ t: 'popstep', gid: id, i, x: cx, y: top, z: cz, sx: size, sz: size, sy: 0.6 });
    tiles.push(s);
    b.arc(px, py, pz, cx, top, cz + size / 2, 1);
    b.coin(cx, top + 1.1, cz);
    b.x = cx;
    b.y = top;
    b.z = cz - size / 2;
  }
  if (catchFloor) catchUnder(b, tiles, size, entry.z, b.z, entry);
  if (exit) exitPad(b, gap, 4.4, exitLen);
  else b.nextGap = gap;
}

function foldRun(b, { n = 4, size = 4, gap = 1.2, zig = 0.8, entrySet = 0, moving = [], amp = 1.2, speed = 0.6, pairAt = -1, riseFrom = -1, rise = 0, catchFloor = false, exit = true, dir = null, entry = null, teach = false, relay = false, gap0 = null, exitGap = null } = {}) {
  const id = ++fid;
  const ent = entry || { x: b.x, y: b.y, z: b.z + 4, hx: 3.25, hz: 4 };
  b.add({ t: 'foldgroup', id, entrySet, entry: ent, x: ent.x, y: ent.y, z: ent.z, teach, ...(relay ? { relay } : {}) });
  const tiles = [];
  const ux = dir ? dir[0] : 0;
  const uz = dir ? dir[1] : -1;
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    const top = b.y + (riseFrom >= 0 && i >= riseFrom ? rise : 0);
    const set = (entrySet + 1 + i) % 2;
    const side = i === 0 ? 0 : i % 2 ? zig : -zig;
    const along = (i === 0 && gap0 !== null ? gap0 : gap) + size / 2;
    const cx = b.x + ux * along + (ux === 0 ? side : 0);
    const cz = b.z + uz * along + (uz === 0 ? side : 0);
    if (i === pairAt) {
      for (const k of [-1, 1]) {
        const o = { t: 'fold', gid: id, i, set, x: cx + (dir ? 0 : (k * size) / 2), y: top, z: cz + (dir ? (k * size) / 2 : 0), sx: size, sz: size, sy: 0.6 };
        tiles.push(b.add(o));
        b.coin(o.x, top + 1.1, o.z);
      }
    } else {
      const o = { t: 'fold', gid: id, i, set, x: cx, y: top, z: cz, sx: size, sz: size, sy: 0.6 };
      if (moving.includes(i)) o.move = { x: amp, speed, phase: i * 1.3 };
      tiles.push(b.add(o));
      b.coin(cx, top + 1.1, cz);
    }
    b.arc(px, py, pz, cx - ux * (size / 2), top, cz - uz * (size / 2), 1);
    b.y = top;
    if (dir) {
      b.x = cx + ux * (size / 2);
      b.z = cz + uz * (size / 2);
    } else {
      b.x = cx;
      b.z = cz - size / 2;
    }
  }
  if (catchFloor && teach) catchUnder(b, tiles, size, ent.z + ent.hz, b.z - 1, ent, 1.2, 4);
  else if (catchFloor) catchUnder(b, tiles, size, ent.z - ent.hz, b.z, ent, 1.2);
  if (exit && !dir) exitPad(b, exitGap === null ? gap : exitGap);
  else if (!dir) b.nextGap = gap;
  return tiles;
}

function stamp(b, x, y, z, door, k) {
  const id = ++sid;
  b.add({ t: 'stamp', x, y, z, s: 1.6, h: 0.3 });
  b.add({ t: 'switch', id, lock: 'ink', x, y: y + 0.3, z, rail: rail(door(k, x, y + 0.3, z)) });
  b.coin(x, y + 1.6, z);
  return id;
}

function lowCurb(b, x, z, y, sx, sz) {
  b.block({ x, y: y + 0.6, z, sx, sz, sy: 0.6, style: 'curb', side: true });
}

function curbs(b, x, y, z, sx, sz, side, front = true, fade = false) {
  const f = fade ? { fade: true } : {};
  b.block({ x: x + side * (sx / 2 - 0.25), y: y + WALL, z, sx: 0.5, sz, sy: WALL, style: 'ground', side: true, ...f });
  if (front) b.block({ x: x - side * 0.25, y: y + WALL, z: z - sz / 2 + 0.25, sx: sx - 0.5, sz: 0.5, sy: WALL, style: 'ground', side: true, ...f });
}

function frontWall(b, x, y, edge, width, gapLen) {
  const seg = (width - DOOR_W) / 2;
  for (const side of [-1, 1]) {
    b.block({ x: x + side * (DOOR_W / 2 + seg / 2), y: y + WALL, z: edge + 0.25, sx: seg, sz: 0.5, sy: WALL, style: 'ground', side: true });
    b.block({ x: x + side * (DOOR_W / 2 + 0.25), y: y + WALL, z: edge - gapLen / 2, sx: 0.5, sz: gapLen, sy: WALL, style: 'ground', side: true });
  }
}

function stampHub(b, { layout = 'alcoves', gapLen = 5, hub = 8, gap = 0 } = {}) {
  const px = b.x;
  const py = b.y;
  const pz = b.z;
  const h = b.ahead(gap, hub, hub, { style: 'ground', sy: 1.4 });
  if (gap > 0) b.arc(px, py, pz, h.x, h.y, h.z + hub / 2, 1);
  const edge = h.z - hub / 2;
  const slot = [-1.1, 0, 1.1];
  const door = (k, x, y, z) => {
    const sx = h.x + slot[k];
    const out = [[x, y, z]];
    const inX = Math.max(h.x - hub / 2 + 0.6, Math.min(h.x + hub / 2 - 0.6, x));
    out.push([inX, h.y, z]);
    out.push([sx, h.y, z]);
    out.push([sx, h.y, edge + 0.6]);
    return out;
  };
  const ids = [];
  const A = 3.2;
  if (layout === 'alcoves') {
    const wide = hub / 2 + A;
    b.block({ x: h.x, y: h.y, z: h.z, sx: wide * 2, sz: hub, sy: 1.2, style: 'block', color: b.col(), side: false });
    for (const side of [-1, 1]) b.block({ x: h.x + side * (wide - 0.25), y: h.y + WALL, z: h.z, sx: 0.5, sz: hub, sy: WALL, style: 'ground', side: true, fade: true });
    for (const side of [-1, 1]) b.block({ x: h.x + side * (wide + 3.4) / 2, y: h.y + WALL, z: h.z + hub / 2 - 0.25, sx: wide - 3.4, sz: 0.5, sy: WALL, style: 'ground', side: true, fade: true });
    const spots = [
      [-1, h.z + 2.2],
      [1, h.z + 1.6],
      [-1, h.z - 0.8],
    ];
    spots.forEach(([side, z], k) => {
      const x = h.x + side * (hub / 2 + A / 2 - 0.2);
      ids.push(stamp(b, x, h.y, z, door, k));
    });
  } else if (layout === 'islands') {
    const W = 5.4;
    const isl = [
      [-1, FLUSH, h.z - 0.2, 7.6, [h.z + 2.0, h.z - 2.4]],
      [1, FLUSH, h.z + 1.0, 3.6, [h.z + 1.2]],
    ];
    let k = 0;
    for (const [side, hop, z, D, zs] of isl) {
      const x = h.x + side * (hub / 2 + hop + W / 2);
      b.block({ x, y: h.y, z, sx: W, sz: D, sy: 1.2, style: 'block', color: b.col(), side: false });
      curbs(b, x, h.y, z, W, D, side, true, true);
      b.coin(h.x + side * (hub / 2), h.y + 1.1, z);
      for (const sz of zs) ids.push(stamp(b, x + side * 1.3, h.y, sz, door, k++));
    }
  } else {
    const stub = (k, x, y, z) => [[x, y, z], [x, y, z - 1.2]];
    ids.push(stamp(b, h.x + 2.2, h.y, h.z - 1.6, stub, 0));
    b.block({ x: h.x + hub / 2 - 0.25, y: h.y + WALL, z: h.z, sx: 0.5, sz: hub, sy: WALL, style: 'ground', side: true, fade: true });
    b.block({ x: h.x - hub / 2 + 0.25, y: h.y + WALL, z: h.z, sx: 0.5, sz: hub, sy: WALL, style: 'ground', side: true, fade: true });
    b.x = h.x;
    b.y = h.y;
    b.z = edge;
    const runA = foldRun(b, { n: 3, size: 4.6, gap: 1.4, zig: 0.4, entrySet: 0, exit: false, relay: true, entry: { x: h.x, y: h.y, z: h.z, hx: hub / 2, hz: hub / 2 } });
    const L = b.ahead(1.4, 5.4, 4.4, { style: 'block', color: b.col(), sy: 1.2 });
    b.arc(runA[2].x, h.y, runA[2].z - 2.3, L.x, h.y, L.z + 2.2, 1);
    for (const sd of [-1, 1]) b.block({ x: L.x + sd * (2.7 - 0.25), y: h.y + WALL, z: L.z, sx: 0.5, sz: 4.4, sy: WALL, style: 'ground', side: true, fade: true });
    ids.push(stamp(b, L.x + 1.4, h.y, L.z + 0.4, stub, 1));
    b.x = L.x;
    b.z = L.z - 2.2;
    const runB = foldRun(b, { n: 3, size: 4.6, gap: 1.4, zig: 0.4, entrySet: 1, exit: false, relay: true, entry: { x: L.x, y: h.y, z: L.z, hx: 2.7, hz: 2.2 } });
    const F = b.block({ x: b.x, y: h.y, z: b.z - 1.4 - 3, sx: 6, sz: 6, sy: 1.4, style: 'ground' });
    const fe = F.z - 3;
    ids.push(stamp(b, F.x - 1.6, h.y, F.z + 0.6, (k, x, y, z) => [[x, y, z], [x, y, fe + 1.2], [F.x, y, fe + 0.6]], 2));
    const tail = [...runB.map((t) => [t.x, h.y, t.z]), [F.x, h.y, F.z], [F.x, h.y, fe + 0.6]];
    const sws = ids.slice(0, 2).map((id) => b.specs.find((s) => s.t === 'switch' && s.id === id));
    sws[0].rail = rail([[sws[0].x, sws[0].y, sws[0].z], [h.x, h.y, sws[0].z], [h.x, h.y, edge + 0.6], ...runA.map((t) => [t.x, h.y, t.z]), [L.x, h.y, L.z], ...tail]);
    sws[1].rail = rail([[sws[1].x, sws[1].y, sws[1].z], [L.x, h.y, L.z - 2.2 + 0.6], ...tail]);
    frontWall(b, F.x, h.y, fe, 6, gapLen);
    b.add({ t: 'door', ids, lock: ids.map(() => 'ink'), x: F.x, y: h.y, z: fe - 0.16, w: DOOR_W });
    ids.forEach((id, k) => b.add({ t: 'xbridge', id, lock: 'ink', x: F.x, y: h.y, z: fe - (gapLen * (k + 0.5)) / 3, sx: 2.8, sz: gapLen / 3 + 0.1, sy: 0.5 }));
    b.x = F.x;
    b.y = h.y;
    b.z = fe - gapLen;
    b.nextGap = 0;
    return;
  }
  frontWall(b, h.x, h.y, edge, layout === 'alcoves' ? hub + A * 2 : hub, gapLen);
  b.add({ t: 'door', ids, lock: ids.map(() => 'ink'), x: h.x, y: h.y, z: edge - 0.16, w: DOOR_W, lampScale: 1.8 });
  ids.forEach((id, k) => b.add({ t: 'xbridge', id, lock: 'ink', x: h.x, y: h.y, z: edge - (gapLen * (k + 0.5)) / 3, sx: 2.8, sz: gapLen / 3 + 0.1, sy: 0.5 }));
  for (let k = 1; k <= 2; k++) b.coin(h.x, h.y + 1.1, edge - (gapLen * k) / 3);
  b.x = h.x;
  b.z = edge - gapLen;
  b.nextGap = 0;
}

function stampLedge(b) {
  const s = island(b, { size: 8, gap: FLUSH });
  const ax = s.x - 5.5;
  const az = s.z + 1.5;
  b.block({ x: ax, y: s.y, z: az, sx: 3, sz: 3, sy: 1.2, style: 'block', color: b.col() });
  curbs(b, ax, s.y, az, 3, 3, -1, true, true);
  const edge = s.z - 4;
  const gapLen = 4;
  const id = stamp(b, ax, s.y, az, (k, x, y, z) => [[x, y, z], [s.x - 2.4, s.y, z], [s.x, s.y, z], [s.x, s.y, edge + 0.6]], 0);
  frontWall(b, s.x, s.y, edge, 8, gapLen);
  b.add({ t: 'door', ids: [id], lock: ['ink'], x: s.x, y: s.y, z: edge - 0.16, w: DOOR_W });
  b.add({ t: 'xbridge', id, lock: 'ink', x: s.x, y: s.y, z: edge - gapLen / 2, sx: 2.8, sz: gapLen + 0.1, sy: 0.5 });
  b.coin(s.x, s.y + 1.1, edge - gapLen / 2);
  b.x = s.x;
  b.z = edge - gapLen;
  b.nextGap = 0;
}

function tent(b) {
  const cp = b.cps[b.cps.length - 1];
  b.add({ t: 'tent', x: cp.x + (cp.r - 1.1), y: cp.y, z: cp.z - 0.6 });
}

export function inkRoad(b, side, back) {
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
  popupRun(b, { n: 6, size: 3.4, gap: 2.2, zig: 0.8, T: 16 });
  b.nextGap = null;
  foldRun(b, { n: 5, size: 3.6, gap: 2.4, zig: 0.9, entry: { x: b.x, y: b.y, z: b.z + 1.5, hx: 2.2, hz: 1.5 } });
  const hub = b.ahead(1.4, 6, 6, { style: 'ground', sy: 1.4 });
  const fx = hub.x + 6.4;
  b.block({ x: fx, y: hub.y, z: hub.z, sx: 3, sz: 3, sy: 1.2, style: 'block', color: b.col() });
  curbs(b, fx, hub.y, hub.z, 3, 3, 1);
  const edge = hub.z - 3;
  const id = stamp(b, fx, hub.y, hub.z, (k, x, y, z) => [[x, y, z], [hub.x + 2.4, hub.y, z], [hub.x, hub.y, z], [hub.x, hub.y, edge + 0.6]], 0);
  b.add({ t: 'door', ids: [id], lock: ['ink'], x: hub.x, y: hub.y, z: edge - 0.16, w: 6 });
  b.add({ t: 'xbridge', id, lock: 'ink', x: hub.x, y: hub.y, z: edge - 2, sx: 2.8, sz: 4.1, sy: 0.5 });
  b.x = hub.x;
  b.z = edge - 4;
  const end = b.ahead(0, 5, 5, { style: 'ground', sy: 1.4 });
  b.coin(end.x, end.y + 1.1, end.z + 1.2);
  b.add({ t: 'portal', x: end.x, y: end.y, z: end.z - 1, yaw: 0, to: back, toCp: b.cps.length, out: true });
  b.secret = false;
  b.add({ t: 'portal', x: cp.x + side * (cp.r - 1.1), y: cp.y, z: cp.z - 0.6, yaw: Math.PI / 2, to: { x: ox, y: oy, z: oz - 2 }, out: false });
  tent(b);
  for (let k = 0; k < 9; k++) {
    const u = k / 8;
    b.add({ t: 'inkdrop', x: cp.x + side * (0.6 + u * 1.3 + (k % 2 ? 0.3 : -0.3)), y: cp.y, z: cp.z + 2.8 - u * 3.2, r: 0.36 });
  }
  b.stage -= 1;
  Object.assign(b, keep);
}

const NO_APRON = new Set([0, 5, 8, 9, 18]);
const LIP_STAGES = 8;

function apron(fn) {
  return (b) => {
    const a = b.ahead(FLUSH, 4.4, 2.6, { style: 'ground', sy: 1.4 });
    const k = b.specs.length;
    fn(b);
    const front = a.z - 1.3;
    const next = b.specs.slice(k).find((s) => ['fold', 'popgroup', 'block', 'swing'].includes(s.t) || s.style);
    if (!next) return;
    const gapAhead = next.t === 'fold' || next.t === 'popgroup' || (next.sz !== undefined && front - (next.z + next.sz / 2) > 0.3);
    if (gapAhead && b.stage <= LIP_STAGES) {
      b.block({ x: a.x, y: a.y + 0.3, z: front + 0.2, sx: 4.4, sz: 0.4, sy: 0.3, style: 'curb', side: true, lip: true });
      if (next.t !== 'popgroup') b.add({ t: 'chev', x: a.x, y: a.y, z: front + 0.2, top: 0.3 });
    }
  };
}

export function paperSeq(h) {
  const { steps, bridge, sideMovers, barBeam, conveyor, stairs, tramps, disks, swing, crumble } = h;
  island = h.island;
  const flushExit = (fn) => (b) => {
    fn(b);
    if (b.nextGap === null || b.nextGap === undefined || b.nextGap > 0) b.nextGap = FLUSH;
  };
  return [
    (b) => {
      pid = 0;
      fid = 0;
      sid = 0;
      steps(b, { n: 2, size: 4.6, gap: 1.2, rise: 0.3, zig: 0.8, gate: true });
      bridge(b, { len: 10, w: 3 });
    },
    (b) => popupRun(b, { n: 4, size: 4.8, gap: 1.4, zig: 0.6, T: 16, catchFloor: true }),
    (b) => steps(b, { n: 3, size: 5, gap: 1.2, rise: 0.4, zig: 1.0 }),
    (b) => foldRun(b, { n: 4, size: 5, gap: 1.2, zig: 0.8, catchFloor: true, teach: true, exitGap: FLUSH }),
    (b) => foldRun(b, { n: 5, size: 4.6, gap: 1.6, zig: 1.0, exitGap: FLUSH }),
    (b) => tramps(b, { n: 2, r: 2.2, zig: 0.4, spacing: 4.6, lead: 0.6 }),
    (b) => disks(b, { n: 3, r: 3, spin: 0.45, gap: 1.4 }),
    (b) => popupRun(b, { n: 6, size: 4.6, gap: 1.3, zig: 0.35, rise: 0.3, T: 24 }),
    (b) => stampHub(b, { layout: 'alcoves', gapLen: 5 }),
    (b) => bridge(b, { len: 12, w: 3 }),
    (b) => sideMovers(b, { n: 3, amp: 1.6, speed: 0.8, size: 4, gap: 1.6 }),
    (b) => foldRun(b, { n: 5, size: 4.6, gap: 1.6, zig: 0.6, moving: [1, 3], amp: 1.2, speed: 0.6, catchFloor: true, exitGap: FLUSH }),
    (b) => {
      conveyor(b, { len: 12, w: 4.5, dir: 'z-', speed: 2, gap: 1.2 });
      island(b, { size: 6, gap: FLUSH });
    },
    (b) => stampHub(b, { layout: 'islands', gapLen: 5, gap: FLUSH, hub: 10 }),
    (b) => {
      crumble(b, { n: 4, size: 4.6, gap: 1.5, delay: 1.0 });
      foldRun(b, { n: 3, size: 4.6, gap: 1.4, zig: 0.6, exitGap: FLUSH, entry: { x: b.x, y: b.y, z: b.z + 2.3, hx: 2.3, hz: 2.3 } });
    },
    (b) => stampLedge(b),
    (b) => {
      popupRun(b, { n: 4, size: 4.8, gap: 1.4, zig: 0.6, T: 16, exitLen: 6 });
      foldRun(b, { n: 3, size: 4.6, gap: 1.6, zig: 0.8, exitGap: FLUSH, entry: { x: b.x, y: b.y, z: b.z + 3, hx: 2.2, hz: 3 } });
    },
    (b) => {
      barBeam(b, { len: 12, w: 2.2, bars: 2, speed: 1.0, floor: 4, push: true });
      b.nextGap = FLUSH;
    },
    (b) => swing(b, { L: 5, A: 0.45, period: 4, hold: 1.2, size: 4.6, guard: true, lights: true }),
    (b) => stampHub(b, { layout: 'mixed', gapLen: 4.6, gap: FLUSH }),
    (b) => {
      stairs(b, { n: 3, rise: 0.6, size: 4.4, gap: 1 });
      b.nextGap = 1;
    },
    (b) => foldRun(b, { n: 6, size: 4.4, gap: 1.8, zig: 1.2, pairAt: 3, riseFrom: 4, rise: 0.3, relay: true, gap0: 1, exitGap: FLUSH }),
    (b) => {
      b.meta[b.stage] = { camBack: 1.5, book: true };
      popupRun(b, { n: 5, size: 5, gap: 1.0, zig: 0.4, rise: 0.4, T: 20, exit: false });
      b.nextGap = FLUSH;
      b.finishDy = 0;
    },
  ]
    .map((fn, i) => (NO_APRON.has(i) ? fn : apron(fn)))
    .map((fn, i, all) => (i < all.length - 1 ? flushExit(fn) : fn));
}

export function paperExtra(h) {
  const { steps, sideMovers, disks } = h;
  return [
    (b) => {
      pid = 100;
      fid = 100;
      sid = 100;
      steps(b, { n: 3, size: 3.8, gap: 2.2, rise: 0.3, zig: 1.2 });
    },
    (b) => popupRun(b, { n: 5, size: 3.2, gap: 2.0, zig: 1.0, T: 9 }),
    (b) => disks(b, { n: 3, r: 2.6, spin: 0.7, gap: 2.2 }),
    (b) => foldRun(b, { n: 5, size: 3.2, gap: 2.2, zig: 1.0 }),
    (b) => sideMovers(b, { n: 3, amp: 2.4, speed: 1, size: 3.6, gap: 2 }),
  ];
}
