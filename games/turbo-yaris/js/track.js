import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { THEMES } from './themes.js';

const SCALE = 1.4;
export const RAMP_LEN = 16;
export const RAMP_H = 2.6;
const CELL = 25;

export class Track {
  constructor(def) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.halfRoad = def.halfRoad;
    this.halfWall = def.halfWall;
    const curve = new THREE.CatmullRomCurve3(def.points.map(p => new THREE.Vector3(p[0] * SCALE, p[2], p[1] * SCALE)), true, 'centripetal', 0.5);
    const L = curve.getLength();
    const N = Math.round(L / 2);
    this.L = L;
    this.N = N;
    this.ds = L / N;
    const pts = curve.getSpacedPoints(N);
    const f = () => new Float32Array(N);
    this.px = f(); this.py = f(); this.pz = f(); this.tx = f(); this.tz = f(); this.rx = f(); this.rz = f();
    this.head = f(); this.curv = f(); this.line = f(); this.vmax = f(); this.slope = f();
    for (let i = 0; i < N; i++) { this.px[i] = pts[i].x; this.py[i] = pts[i].y; this.pz[i] = pts[i].z; }
    for (let i = 0; i < N; i++) {
      const a = this.w(i - 1), b = this.w(i + 1);
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      this.rx[i] = -dz; this.rz[i] = dx;
      this.head[i] = Math.atan2(dx, dz);
      this.slope[i] = (this.py[b] - this.py[a]) / (2 * this.ds);
    }
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let d = this.head[this.w(i + 3)] - this.head[this.w(i - 3)];
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      raw[i] = d / (6 * this.ds);
    }
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -4; k <= 4; k++) s += raw[this.w(i + k)];
      this.curv[i] = s / 9;
    }
    const lineRaw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let c = 0;
      for (let k = 0; k < 14; k++) c += this.curv[this.w(i + k)];
      c /= 14;
      lineRaw[i] = THREE.MathUtils.clamp(-c * 260, -(this.halfRoad - 2.6), this.halfRoad - 2.6);
    }
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -10; k <= 10; k++) s += lineRaw[this.w(i + k)];
      this.line[i] = s / 21;
    }
    for (let i = 0; i < N; i++) this.vmax[i] = Math.min(46, Math.sqrt(24 / Math.max(Math.abs(this.curv[i]), 1e-4)));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = N - 1; i >= 0; i--) {
        const nx = this.vmax[this.w(i + 1)];
        this.vmax[i] = Math.min(this.vmax[i], Math.sqrt(nx * nx + 2 * 16 * this.ds));
      }
    }
    this.rampS = def.ramp * L;
    this.hash = new Map();
    for (let i = 0; i < N; i++) {
      const k = this.key(Math.floor(this.px[i] / CELL), Math.floor(this.pz[i] / CELL));
      if (!this.hash.has(k)) this.hash.set(k, []);
      this.hash.get(k).push(i);
    }
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < N; i++) { minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]); minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]); }
    this.bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    this.pads = def.boostPads.map(p => ({ s: p.at * L, lat: p.lat, halfW: 2.6, len: 9 }));
    this.itemSpots = [];
    def.itemRows.forEach(r => [-6, -3, 0, 3, 6].forEach(lat => this.itemSpots.push({ s: r * L, lat })));
  }

  key(cx, cz) { return cx * 100003 + cz; }
  w(i) { const N = this.N; return ((i % N) + N) % N; }
  wrapS(s) { const L = this.L; return ((s % L) + L) % L; }

  nearest(x, z, maxR = 90) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const r = Math.ceil(maxR / CELL);
    let best = -1, bd = maxR * maxR;
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      const list = this.hash.get(this.key(cx + a, cz + b));
      if (!list) continue;
      for (const i of list) {
        const dx = x - this.px[i], dz = z - this.pz[i];
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return { i: best, d: best < 0 ? Infinity : Math.sqrt(bd) };
  }

  project(x, z, hint, out, range = 14) {
    let best = -1, bd = Infinity;
    if (hint < 0) {
      const n = this.nearest(x, z, 200);
      best = n.i >= 0 ? n.i : 0;
      if (n.i < 0) for (let i = 0; i < this.N; i++) { const d = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2; if (d < bd) { bd = d; best = i; } }
    } else {
      for (let k = -range; k <= range; k++) {
        const i = this.w(hint + k);
        const d = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    let i0 = best, i1 = this.w(best + 1);
    let t = this.segT(x, z, i0, i1);
    if (t < 0) { i1 = best; i0 = this.w(best - 1); t = this.segT(x, z, i0, i1); }
    t = Math.min(1, Math.max(0, t));
    const cx = this.px[i0] + (this.px[i1] - this.px[i0]) * t;
    const cz = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * t;
    let rx = this.rx[i0] + (this.rx[i1] - this.rx[i0]) * t;
    let rz = this.rz[i0] + (this.rz[i1] - this.rz[i0]) * t;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    out.i = i0;
    out.t = t;
    out.s = (i0 + t) * this.ds;
    out.lat = (x - cx) * rx + (z - cz) * rz;
    out.rx = rx; out.rz = rz;
    out.tx = rz; out.tz = -rx;
    out.y = this.py[i0] + (this.py[i1] - this.py[i0]) * t;
    out.slope = this.slope[i0];
    return out;
  }

  segT(x, z, i0, i1) {
    const ax = this.px[i0], az = this.pz[i0];
    const dx = this.px[i1] - ax, dz = this.pz[i1] - az;
    return ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1);
  }

  rampHeight(s, lat) {
    let d = s - this.rampS;
    if (d < -this.L / 2) d += this.L;
    if (d > this.L / 2) d -= this.L;
    if (d < 0 || d > RAMP_LEN || Math.abs(lat) > this.halfRoad) return 0;
    return RAMP_H * Math.pow(d / RAMP_LEN, 1.3);
  }

  groundY(p) {
    return p.y + this.rampHeight(p.s, p.lat);
  }

  pointAt(s, lat = 0, out = {}) {
    s = this.wrapS(s);
    const f = s / this.ds;
    const i0 = Math.floor(f) % this.N, i1 = this.w(i0 + 1), t = f - Math.floor(f);
    let rx = this.rx[i0] + (this.rx[i1] - this.rx[i0]) * t;
    let rz = this.rz[i0] + (this.rz[i1] - this.rz[i0]) * t;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    out.x = this.px[i0] + (this.px[i1] - this.px[i0]) * t + rx * lat;
    out.z = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * t + rz * lat;
    out.y = this.py[i0] + (this.py[i1] - this.py[i0]) * t;
    out.rx = rx; out.rz = rz;
    out.heading = Math.atan2(rz, -rx);
    out.i = i0;
    return out;
  }
}

function ribbon(track, rows, latA, latB, yA, yB, vLen, colorFn) {
  const pos = [], uv = [], col = [], idx = [];
  const n = rows.length;
  let v = 0;
  for (let r = 0; r < n; r++) {
    const i = rows[r];
    const x = track.px[i], z = track.pz[i], y = track.py[i];
    const rx = track.rx[i], rz = track.rz[i];
    const la = typeof latA === 'function' ? latA(i) : latA;
    const lb = typeof latB === 'function' ? latB(i) : latB;
    pos.push(x + rx * la, y + yA, z + rz * la, x + rx * lb, y + yB, z + rz * lb);
    uv.push(0, v, 1, v);
    if (colorFn) { const c = colorFn(i); col.push(...c[0], ...c[1]); }
    v += track.ds / vLen;
    if (r < n - 1) {
      const a = r * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function loopRows(track) {
  const rows = [];
  for (let i = 0; i <= track.N; i++) rows.push(track.w(i));
  return rows;
}

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd21a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1a1a1a';
  for (let k = -2; k < 4; k++) {
    g.beginPath();
    g.moveTo(k * 48, 0); g.lineTo(k * 48 + 24, 0); g.lineTo(k * 48 + 24 + 128, 128); g.lineTo(k * 48 + 128, 128);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildTrackMeshes(track, env) {
  const group = new THREE.Group();
  const th = track.theme;
  const theme = track.def.theme;
  const N = track.N;
  const rows = loopRows(track);
  const updaters = [];

  const roadTex = T.asphaltTexture(theme);
  const vLen = track.L / Math.round(track.L / 14);
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: theme === 'neon' ? 0.42 : 0.86, metalness: theme === 'neon' ? 0.15 : 0.0 });
  if (theme === 'neon') {
    const rt = T.wetRoughnessTexture();
    roadMat.roughnessMap = rt;
    roadMat.roughness = 1;
    roadMat.envMapIntensity = 1.6;
  }
  const road = new THREE.Mesh(ribbon(track, rows, -track.halfRoad, track.halfRoad, 0.04, 0.04, vLen), roadMat);
  road.receiveShadow = true;
  group.add(road);

  const W = track.halfWall;
  const lin = c => c.map(v => Math.pow(v, 2.2));
  const sh = lin(th.shoulder), se = lin(th.shoulderEdge);
  const noise = T.noiseTexture(9, 256, 70);
  noise.repeat.set(1, 1);
  const shoulderMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: noise, roughness: 0.95 });
  const outer = W + 3;
  for (const side of [-1, 1]) {
    const a = side * track.halfRoad, b = side * outer;
    const g = ribbon(track, rows, side < 0 ? b : a, side < 0 ? a : b, side < 0 ? -0.12 : 0.03, side < 0 ? 0.03 : -0.12, 10, i => (side < 0 ? [se, sh] : [sh, se]));
    const m = new THREE.Mesh(g, shoulderMat);
    m.receiveShadow = true;
    group.add(m);
    const skirtDepth = theme === 'neon' ? (i => -track.py[i] - 1.2) : (() => -3.2);
    const skirtG = skirtGeometry(track, rows, side, outer, skirtDepth, theme === 'neon' ? 0.4 : 6, se);
    const sk = new THREE.Mesh(skirtG, theme === 'neon' ? new THREE.MeshStandardMaterial({ color: 0x3a3c48, roughness: 0.9 }) : shoulderMat);
    sk.receiveShadow = true;
    group.add(sk);
  }

  const curbTex = T.curbTexture(th.curbA, th.curbB);
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.6 });
  const curbZones = zones(track, 0.011, 6);
  for (const z of curbZones) {
    const zr = [];
    for (let i = z.a - 4; i <= z.b + 4; i++) zr.push(track.w(i));
    for (const side of [-1, 1]) {
      const a = side * (track.halfRoad - 0.35), b = side * (track.halfRoad + 1.3);
      const g = ribbon(track, zr, side < 0 ? b : a, side < 0 ? a : b, 0.08, 0.08, 3.2);
      const m = new THREE.Mesh(g, curbMat);
      m.receiveShadow = true;
      group.add(m);
    }
  }
  track.curbZones = curbZones;

  const wallGeo = new RoundedBoxGeometry(0.8, 1.1, 1, 1, 0.1);
  wallGeo.translate(0, 0.55, 0);
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, N * 2);
  const strip = th.strip ? new THREE.InstancedMesh(new THREE.BoxGeometry(0.84, 0.12, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false }), N * 2) : null;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const cA = new THREE.Color(th.wallA), cB = new THREE.Color(th.wallB);
  let k = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const j = track.w(i + 1);
      const lat = side * (W + 0.4);
      const ax = track.px[i] + track.rx[i] * lat, az = track.pz[i] + track.rz[i] * lat;
      const bx = track.px[j] + track.rx[j] * lat, bz = track.pz[j] + track.rz[j] * lat;
      const len = Math.hypot(bx - ax, bz - az) + 0.06;
      p3.set((ax + bx) / 2, (track.py[i] + track.py[j]) / 2, (az + bz) / 2);
      q.setFromAxisAngle(up, Math.atan2(bx - ax, bz - az));
      s3.set(1, 1, len);
      m4.compose(p3, q, s3);
      walls.setMatrixAt(k, m4);
      walls.setColorAt(k, Math.floor(i / 2) % 2 ? cA : cB);
      if (strip) {
        p3.y += 1.08;
        m4.compose(p3, q, s3);
        strip.setMatrixAt(k, m4);
        strip.setColorAt(k, new THREE.Color(th.strip[Math.floor(i / 12) % 2]));
      }
      k++;
    }
  }
  walls.castShadow = false;
  walls.receiveShadow = true;
  group.add(walls);
  if (strip) group.add(strip);

  const tireGeo = new THREE.TorusGeometry(0.42, 0.2, 6, 12);
  tireGeo.rotateX(Math.PI / 2);
  const tireSpots = [];
  for (const z of curbZones) {
    if (z.b - z.a < 8) continue;
    const side = z.sign > 0 ? 1 : -1;
    for (let i = z.a; i <= z.b; i += 1) tireSpots.push({ i: track.w(i), side });
  }
  const tires = new THREE.InstancedMesh(tireGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), Math.max(1, tireSpots.length * 3));
  const tA = new THREE.Color(th.tireA), tB = new THREE.Color(th.tireB);
  let tk = 0;
  tireSpots.forEach((sp, n) => {
    const lat = sp.side * (W + 1.35);
    for (let h = 0; h < 3; h++) {
      m4.makeTranslation(track.px[sp.i] + track.rx[sp.i] * lat, track.py[sp.i] + 0.2 + h * 0.38, track.pz[sp.i] + track.rz[sp.i] * lat);
      tires.setMatrixAt(tk, m4);
      tires.setColorAt(tk, n % 2 ? tA : tB);
      tk++;
    }
  });
  tires.count = tk;
  tires.castShadow = false;
  group.add(tires);

  const signTex = T.arrowSignTexture(th.sign[0], th.sign[1]);
  const signGeoR = new THREE.PlaneGeometry(2.6, 1.3);
  const signGeoL = signGeoR.clone();
  const uvL = signGeoL.attributes.uv;
  for (let n = 0; n < uvL.count; n++) uvL.setX(n, 1 - uvL.getX(n));
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: theme === 'neon' ? 0xffffff : 0x000000, emissiveMap: theme === 'neon' ? signTex : null, emissiveIntensity: theme === 'neon' ? 0.9 : 0 });
  const signSpots = { L: [], R: [] };
  for (const z of curbZones) {
    if (z.b - z.a < 10) continue;
    const side = z.sign > 0 ? 1 : -1;
    for (let i = z.a - 12; i <= z.b - 4; i += 7) signSpots[z.sign > 0 ? 'L' : 'R'].push({ i: track.w(i), side });
  }
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.4 }), signSpots.L.length * 2 + signSpots.R.length * 2 + 2);
  let pk = 0;
  for (const dir of ['L', 'R']) {
    const list = signSpots[dir];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(dir === 'L' ? signGeoL : signGeoR, signMat, list.length);
    list.forEach((sp, n) => {
      const i = sp.i;
      const lat = sp.side * (W + 0.45);
      const nx = -track.tx[i] * 0.55 - sp.side * track.rx[i];
      const nz = -track.tz[i] * 0.55 - sp.side * track.rz[i];
      p3.set(track.px[i] + track.rx[i] * lat, track.py[i] + 2.25, track.pz[i] + track.rz[i] * lat);
      q.setFromAxisAngle(up, Math.atan2(nx, nz));
      m4.compose(p3, q, s3.set(1, 1, 1));
      im.setMatrixAt(n, m4);
      for (const off of [-0.8, 0.8]) {
        const ox = Math.cos(Math.atan2(nx, nz)) * off, oz = -Math.sin(Math.atan2(nx, nz)) * off;
        m4.makeTranslation(p3.x + ox, track.py[i] + 1.3, p3.z + oz);
        posts.setMatrixAt(pk++, m4);
      }
    });
    group.add(im);
  }
  posts.count = pk;
  group.add(posts);

  const checker = T.checkerTexture(16, 2);
  const startMat = new THREE.MeshStandardMaterial({ map: checker, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(track.halfRoad * 2, 2.4), startMat);
  startLine.rotation.x = -Math.PI / 2;
  const sp0 = track.pointAt(0);
  const startHolder = new THREE.Group();
  startHolder.position.set(sp0.x, sp0.y + 0.06, sp0.z);
  startHolder.rotation.y = sp0.heading;
  startHolder.add(startLine);
  startLine.receiveShadow = true;
  group.add(startHolder);

  const gantry = buildGantry(track, th, theme);
  group.add(gantry.group);

  const padTex = T.chevronTexture();
  padTex.repeat.set(1, 2);
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) });
  const glowTex = T.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const baseMat = new THREE.MeshBasicMaterial({ color: th.padGlow, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.3, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const pad of track.pads) {
    const pp = track.pointAt(pad.s + pad.len / 2, pad.lat);
    const h = new THREE.Group();
    h.position.set(pp.x, pp.y + 0.07, pp.z);
    h.rotation.y = pp.heading;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(pad.halfW * 2 + 0.4, pad.len + 0.4), plateMat);
    plate.rotation.x = -Math.PI / 2;
    plate.receiveShadow = true;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(pad.halfW * 3.4, pad.len * 1.5), baseMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    const chev = new THREE.Mesh(new THREE.PlaneGeometry(pad.halfW * 2, pad.len), padMat);
    chev.rotation.x = -Math.PI / 2;
    chev.position.y = 0.03;
    h.add(plate, glow, chev);
    group.add(h);
  }
  updaters.push((dt) => { padTex.offset.y -= dt * 1.6; });

  group.add(buildRamp(track));

  const stands = buildStands(track, th, theme);
  group.add(stands.group);
  updaters.push((dt, time) => { stands.uniforms.uTime.value = time; });

  return {
    group,
    gantryLights: gantry.lights,
    standSpots: stands.robotSpots,
    update(dt, time) { updaters.forEach(u => u(dt, time)); }
  };
}

function zones(track, thr, minLen) {
  const N = track.N;
  const on = new Uint8Array(N);
  for (let i = 0; i < N; i++) on[i] = Math.abs(track.curv[i]) > thr ? 1 : 0;
  let start = 0;
  while (start < N && on[start]) start++;
  const res = [];
  let i = 0;
  while (i < N) {
    const idx = (start + i) % N;
    if (on[idx]) {
      let j = i;
      let sum = 0;
      while (j < N && on[(start + j) % N]) { sum += track.curv[(start + j) % N]; j++; }
      if (j - i >= minLen) res.push({ a: start + i, b: start + j - 1, sign: sum > 0 ? 1 : -1 });
      i = j;
    } else i++;
  }
  return res;
}

function skirtGeometry(track, rows, side, lat, depthFn, outward, color) {
  const pos = [], idx = [], col = [], uv = [];
  rows.forEach((i, r) => {
    const x = track.px[i], z = track.pz[i], y = track.py[i];
    const a = lat * side, b = (lat + outward) * side;
    pos.push(x + track.rx[i] * a, y - 0.12, z + track.rz[i] * a, x + track.rx[i] * b, y + depthFn(i), z + track.rz[i] * b);
    col.push(...color, ...color);
    uv.push(0, r * 0.2, 1, r * 0.2);
    if (r < rows.length - 1) {
      const k = r * 2;
      if (side > 0) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildGantry(track, th, theme) {
  const group = new THREE.Group();
  const p = track.pointAt(-6);
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = p.heading;
  const W = track.halfWall + 1.2;
  const mat = new THREE.MeshStandardMaterial({ color: th.gantry, roughness: 0.35, metalness: 0.5 });
  const pillarGeo = new RoundedBoxGeometry(1.4, 9, 1.4, 3, 0.25);
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(pillarGeo, mat);
    pl.position.set(s * W, 4.5, 0);
    pl.castShadow = true;
    group.add(pl);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(W * 2 + 1.4, 2.2, 1.2, 3, 0.25), mat);
  beam.position.y = 8.6;
  beam.castShadow = true;
  group.add(beam);
  const bt = T.bannerTexture(th.banner[0], th.banner[1], th.banner[2]);
  const bmat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: theme === 'neon' ? 1.1 : 0.25 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 - 1, 1.9), bmat);
    b.position.set(0, 8.6, s * 0.62);
    if (s < 0) b.rotation.y = Math.PI;
    group.add(b);
  }
  const lights = [];
  const lgeo = new THREE.SphereGeometry(0.42, 16, 12);
  const housing = new THREE.Mesh(new RoundedBoxGeometry(4.2, 1.3, 0.6, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  housing.position.set(0, 10.4, -0.2);
  group.add(housing);
  for (let n = 0; n < 3; n++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, roughness: 0.3 });
    const l = new THREE.Mesh(lgeo, m);
    l.position.set((n - 1) * 1.3, 10.4, -0.55);
    group.add(l);
    lights.push(m);
  }
  const flagTex = T.checkerTexture(6, 4);
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 8, 1), flagMat);
    f.position.set(s * W, 10.2, 0);
    f.rotation.y = Math.PI / 2;
    f.position.x += s * 1.2;
    group.add(f);
  }
  return { group, lights };
}

function buildRamp(track) {
  const hz = hazardTexture();
  hz.repeat.set(RAMP_LEN / 3, 1);
  const topTex = T.chevronTexture();
  topTex.repeat.set(3, RAMP_LEN / 8);
  const pos = [], uv = [], idx = [];
  const sidePos = [], sideUv = [], sideIdx = [];
  const steps = 16;
  const hw = track.halfRoad;
  const pt = {};
  for (let k = 0; k <= steps; k++) {
    const d = (k / steps) * RAMP_LEN;
    track.pointAt(track.rampS + d, 0, pt);
    const h = RAMP_H * Math.pow(d / RAMP_LEN, 1.3) + 0.05;
    const lx = pt.x - pt.rx * hw, lz = pt.z - pt.rz * hw;
    const rx = pt.x + pt.rx * hw, rz = pt.z + pt.rz * hw;
    pos.push(lx, pt.y + h, lz, rx, pt.y + h, rz);
    uv.push(0, d / 8, 3, d / 8);
    if (k < steps) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (const s of [0, 1]) {
      const x = s ? rx : lx, z = s ? rz : lz;
      const base = sidePos.length / 3;
      sidePos.push(x, pt.y + 0.02, z, x, pt.y + h, z);
      sideUv.push(d / 3, 0, d / 3, h / RAMP_H);
      if (k < steps) {
        if (s) sideIdx.push(base, base + 4, base + 1, base + 1, base + 4, base + 5);
        else sideIdx.push(base, base + 1, base + 4, base + 1, base + 5, base + 4);
      }
    }
  }
  track.pointAt(track.rampS + RAMP_LEN, 0, pt);
  const lx = pt.x - pt.rx * hw, lz = pt.z - pt.rz * hw, rx2 = pt.x + pt.rx * hw, rz2 = pt.z + pt.rz * hw;
  const b = sidePos.length / 3;
  sidePos.push(lx, pt.y, lz, rx2, pt.y, rz2, lx, pt.y + RAMP_H + 0.05, lz, rx2, pt.y + RAMP_H + 0.05, rz2);
  sideUv.push(0, 0, 6, 0, 0, 1, 6, 1);
  sideIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g1.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g1.setIndex(idx);
  g1.computeVertexNormals();
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(sideUv, 2));
  g2.setIndex(sideIdx);
  g2.computeVertexNormals();
  const top = new THREE.Mesh(g1, new THREE.MeshStandardMaterial({ color: 0x2b2d35, emissive: 0xffffff, emissiveMap: topTex, emissiveIntensity: 0.9, map: topTex, roughness: 0.5 }));
  const sides = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6, side: THREE.DoubleSide }));
  top.castShadow = sides.castShadow = true;
  top.receiveShadow = true;
  const grp = new THREE.Group();
  grp.add(top, sides);
  return grp;
}

function buildStands(track, th, theme) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };
  const structMat = new THREE.MeshStandardMaterial({ color: th.stand, roughness: 0.6, metalness: 0.2 });
  const seatMat = new THREE.MeshStandardMaterial({ color: th.standSeat, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: th.roof, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const people = [];
  const robotSpots = [];
  const tiers = 7;
  for (const st of track.def.stands) {
    const s = st.at * track.L;
    const p = track.pointAt(s);
    const h = new THREE.Group();
    const lat = st.side * (track.halfWall + 4.2);
    const pp = track.pointAt(s, lat);
    h.position.set(pp.x, pp.y, pp.z);
    h.rotation.y = p.heading + (st.side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const len = st.len;
    const seats = [];
    const structs = [];
    for (let k = 0; k < tiers; k++) {
      const g = new THREE.BoxGeometry(len, 0.75 * (k + 1), 1.5);
      g.translate(0, 0.375 * (k + 1), -k * 1.5);
      seats.push(g);
    }
    const back = new THREE.BoxGeometry(len + 1, 8.5, 0.5);
    back.translate(0, 4.25, -tiers * 1.5 + 0.4);
    structs.push(back);
    for (const sx of [-1, 1]) {
      const sideWall = new THREE.BoxGeometry(0.5, 8.5, tiers * 1.5 + 0.5);
      sideWall.translate(sx * (len / 2 + 0.25), 4.25, -tiers * 0.75 + 0.5);
      structs.push(sideWall);
    }
    for (let x = -len / 2; x <= len / 2 + 0.1; x += len / 5) {
      const pil = new THREE.CylinderGeometry(0.18, 0.18, 4, 8);
      pil.translate(x, 8.5 + 2, 0.6);
      structs.push(pil);
    }
    const seatMesh = new THREE.Mesh(mergeGeometries(seats), seatMat);
    const structMesh = new THREE.Mesh(mergeGeometries(structs), structMat);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.3, tiers * 1.5 + 3), roofMat);
    roof.position.set(0, 10.6, -tiers * 0.75 + 0.8);
    roof.rotation.x = -0.12;
    seatMesh.castShadow = structMesh.castShadow = roof.castShadow = true;
    seatMesh.receiveShadow = structMesh.receiveShadow = true;
    h.add(seatMesh, structMesh, roof);
    group.add(h);
    h.updateMatrixWorld(true);
    const r = T.rng(Math.floor(s * 13));
    for (let k = 0; k < tiers; k++) {
      for (let x = -len / 2 + 0.6; x < len / 2 - 0.4; x += 0.95) {
        if (r() < 0.12) continue;
        const v = new THREE.Vector3(x + (r() - 0.5) * 0.3, 0.75 * (k + 1), -k * 1.5 - 0.1).applyMatrix4(h.matrixWorld);
        people.push({ v, yaw: h.rotation.y, r: r() });
      }
    }
    const front = new THREE.Vector3(len / 2 + 3, 0, 2.5).applyMatrix4(h.matrixWorld);
    robotSpots.push({ x: front.x, y: pp.y, z: front.z, yaw: h.rotation.y });
    const front2 = new THREE.Vector3(-len / 2 - 3, 0, 2.5).applyMatrix4(h.matrixWorld);
    robotSpots.push({ x: front2.x, y: pp.y, z: front2.z, yaw: h.rotation.y });
  }
  const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.45, 2, 6);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.2, 7, 5);
  headGeo.translate(0, 1.12, 0);
  const bob = m => {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += abs(sin(uTime * 6.5 + float(gl_InstanceID) * 1.37)) * 0.28;');
    };
    return m;
  };
  const bodies = new THREE.InstancedMesh(bodyGeo, bob(new THREE.MeshStandardMaterial({ roughness: 0.7 })), people.length);
  const heads = new THREE.InstancedMesh(headGeo, bob(new THREE.MeshStandardMaterial({ roughness: 0.6 })), people.length);
  const shirts = [0xff3b3b, 0xffd23b, 0x3b8bff, 0x3bdc6a, 0xff7ad9, 0xffffff, 0xff8a1f, 0x9b5bff, 0x1fe0d0];
  const skins = [0xf1c7a0, 0xd9a47a, 0xa8714a, 0xffd9b8, 0x7a4a2a];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  people.forEach((pp, n) => {
    q.setFromAxisAngle(up, pp.yaw);
    m4.compose(pp.v, q, sc);
    bodies.setMatrixAt(n, m4);
    heads.setMatrixAt(n, m4);
    c.setHex(shirts[Math.floor(pp.r * shirts.length)]);
    if (theme === 'neon') c.multiplyScalar(0.9);
    bodies.setColorAt(n, c);
    c.setHex(skins[Math.floor((pp.r * 7.3 % 1) * skins.length)]);
    heads.setColorAt(n, c);
  });
  group.add(bodies, heads);
  return { group, uniforms, robotSpots };
}
