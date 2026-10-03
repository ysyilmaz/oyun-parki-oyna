import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blockGeo } from './geo.js';
import { glowColor } from './shaders.js';
import { cardSide } from './paper-look.js';

export const POP_CYAN = 0x35e0ff;
export const FOLD_COLORS = [0xc8b0ff, 0xc8ff4a];
export const INK = 0x3a6cff;
const DROP = 0x3a3a44;
const STAMP_WOOD = 0x6a4a34;
const RAIL = 0x8a6a48;
const WARN_RED = 0xff3040;
const STAMP_RIM = 0x1e2c6a;
const STAMP_FACE = 0x5a72c8;
const WARN_T = 3;
const LEAVE = 0.5;
const LATCH = 0.5;
const RISE = 0.3;
const STAGGER = 0.08;
const FOLD_UP = 0.12;
const FOLD_DOWN = 0.25;
const BOOK_OPEN = 1.2;
const DEMO = 1.5;
const CUE = 0.3;
const FOLD_WARN = 0.7;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _x = new THREE.Vector3(1, 0, 0);
const _z = new THREE.Vector3(0, 0, 1);
const _y = new THREE.Vector3(0, 1, 0);
const _qi = new THREE.Quaternion();

function timerMaterial(top) {
  return new THREE.ShaderMaterial({
    uniforms: { left: { value: 1 }, color: { value: new THREE.Color(POP_CYAN) } },
    transparent: true,
    depthWrite: false,
    depthTest: !top,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float left;',
      'uniform vec3 color;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec2 q = vUv - 0.5;',
      '  float r = length(q);',
      '  float a = fract(atan(q.x, q.y) / 6.2831853 + 1.0);',
      '  float aa = fwidth(r) * 1.5;',
      '  float ring = smoothstep(0.25 - aa, 0.25, r) * (1.0 - smoothstep(0.46, 0.46 + aa, r));',
      '  float edge = smoothstep(0.22 - aa, 0.22, r) * (1.0 - smoothstep(0.5 - aa, 0.5, r));',
      '  float on = step(1.0 - left, a);',
      '  vec3 track = vec3(0.10, 0.09, 0.12);',
      '  vec3 c = mix(track, color, on * ring);',
      '  c = mix(c, vec3(1.0), (edge - ring) * 0.9);',
      '  float face = step(r, 0.22) * 0.85;',
      '  c = mix(c, vec3(0.98, 0.96, 0.92), face);',
      '  float alpha = max(edge, face);',
      '  if (alpha < 0.01) discard;',
      '  gl_FragColor = vec4(c, alpha);',
      '}',
    ].join(String.fromCharCode(10)),
  });
}

function col(x, y, z, hx, hy, hz, style, spec) {
  return { shape: 'box', x, y, z, hx, hy, hz, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0, style, stage: spec.stage, spec, obj: null, squash: 0 };
}

function segBox(a, b, lift, x0, y0, z0, x1, y1, z1) {
  let t0 = 0;
  let t1 = 1;
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  const pa = [a.x, a.y, a.z];
  const d = [b.x - a.x, b.y + lift - a.y, b.z - a.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-6) {
      if (pa[i] < lo[i] || pa[i] > hi[i]) return false;
      continue;
    }
    let u = (lo[i] - pa[i]) / d[i];
    let v = (hi[i] - pa[i]) / d[i];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return t1 < 0.97;
}

function inRect(r, pos, pad) {
  return Math.abs(pos.x - r.x) < r.sx / 2 + pad && Math.abs(pos.z - r.z) < r.sz / 2 + pad;
}

function dashFrameGeo(n = 5, fill = 0.55) {
  const parts = [];
  const t = 0.08;
  const step = 1 / n;
  for (let i = 0; i < n; i++) {
    const c = -0.5 + step * (i + 0.5);
    const L = step * fill;
    parts.push(new THREE.BoxGeometry(L, 0.04, t).translate(c, 0, 0.5 - t / 2));
    parts.push(new THREE.BoxGeometry(L, 0.04, t).translate(c, 0, -0.5 + t / 2));
    parts.push(new THREE.BoxGeometry(t, 0.04, L).translate(0.5 - t / 2, 0, c));
    parts.push(new THREE.BoxGeometry(t, 0.04, L).translate(-0.5 + t / 2, 0, c));
  }
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
}

function tabGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0.5);
  s.lineTo(0.5, 0.5);
  s.lineTo(0.5, -0.2);
  s.lineTo(0, -0.5);
  s.lineTo(-0.5, -0.2);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.22, 0.3);
  hole.lineTo(0, 0.05);
  hole.lineTo(0.22, 0.3);
  hole.lineTo(0.22, 0.14);
  hole.lineTo(0, -0.12);
  hole.lineTo(-0.22, 0.14);
  hole.closePath();
  s.holes.push(hole);
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

function ridgeShapes(w, h) {
  const s = new THREE.Shape();
  const pts = [[-0.5, 0], [-0.5, 0.42], [-0.32, 1], [-0.2, 0.62], [-0.05, 0.8], [0.12, 0.5], [0.28, 0.92], [0.42, 0.55], [0.5, 0.38], [0.5, 0]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * w, y * h) : s.moveTo(x * w, y * h)));
  return [s];
}

function hillShapes(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    s.lineTo(-w / 2 + w * t, h * (0.55 + 0.3 * Math.sin(t * Math.PI * 3 + 0.4) + 0.15 * Math.sin(t * Math.PI * 7)));
  }
  s.lineTo(w / 2, 0);
  s.closePath();
  return [s];
}

function pineShapes(w, h) {
  const s = new THREE.Shape();
  const t = w * 0.09;
  s.moveTo(-t, 0);
  s.lineTo(-t, h * 0.18);
  [[0.5, 0.18], [0.36, 0.45], [0.26, 0.7]].forEach(([hw, y], k) => {
    s.lineTo(-w * hw, h * y);
    s.lineTo(-w * hw * 0.45, h * (y + 0.04));
    if (k === 2) s.lineTo(0, h);
  });
  [[0.26, 0.7], [0.36, 0.45], [0.5, 0.18]].forEach(([hw, y]) => {
    s.lineTo(w * hw * 0.45, h * (y + 0.04));
    s.lineTo(w * hw, h * y);
  });
  s.lineTo(t, h * 0.18);
  s.lineTo(t, 0);
  s.closePath();
  return [s];
}

function sunShapes(w, h) {
  const r = w * 0.3;
  const cy = h - w * 0.5;
  const disc = new THREE.Shape();
  disc.absarc(0, cy, r, 0, Math.PI * 2, false);
  const out = [disc];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const ray = new THREE.Shape();
    ray.moveTo(Math.cos(a - 0.16) * r * 1.2, cy + Math.sin(a - 0.16) * r * 1.2);
    ray.lineTo(Math.cos(a) * w * 0.5, cy + Math.sin(a) * w * 0.5);
    ray.lineTo(Math.cos(a + 0.16) * r * 1.2, cy + Math.sin(a + 0.16) * r * 1.2);
    ray.closePath();
    out.push(ray);
  }
  const stick = new THREE.Shape();
  stick.moveTo(-0.05, 0);
  stick.lineTo(0.05, 0);
  stick.lineTo(0.05, cy - r * 1.25);
  stick.lineTo(-0.05, cy - r * 1.25);
  stick.closePath();
  out.push(stick);
  return out;
}

function roundTreeShapes(w, h) {
  const r = w * 0.42;
  const s = new THREE.Shape();
  s.moveTo(-w * 0.07, 0);
  s.lineTo(w * 0.07, 0);
  s.lineTo(w * 0.07, h - 2 * r + 0.02);
  s.absarc(0, h - r, r, -Math.PI / 2 + 0.2, Math.PI * 1.5 - 0.2, false);
  s.lineTo(-w * 0.07, h - 2 * r + 0.02);
  s.closePath();
  return [s];
}

function grassShapes(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    s.lineTo(x, h * (i % 2 ? 1 : 0.55));
  }
  s.lineTo(w / 2, 0);
  s.closePath();
  return [s];
}

export function makePaper(world) {
  const keep = new Set(['popgroup', 'popstep', 'foldgroup', 'fold', 'stamp', 'tent', 'edge', 'inkdrop', 'chev']);
  const specs = world.course.specs.filter((s) => keep.has(s.t));
  const meta = world.course.meta || [];
  const book = meta.some((m) => m && m.book);
  return specs.length || book ? new Paper(world, specs, book) : null;
}

class Paper {
  constructor(world, specs, book) {
    this.w = world;
    this.time = 0;
    this.pops = [];
    this.steps = [];
    this.folds = [];
    this.tiles = [];
    this.stamps = [];
    this.tents = specs.filter((s) => s.t === 'tent');
    this.edges = specs.filter((s) => s.t === 'edge').map((s) => ({ s, view: world.viewOf(s) }));
    this.drops = specs.filter((s) => s.t === 'inkdrop').map((s) => ({ s, view: world.viewOf(s) }));
    this.chevs = specs.filter((s) => s.t === 'chev').map((s) => ({ s, view: world.viewOf(s) }));
    const byPop = new Map();
    for (const s of specs.filter((x) => x.t === 'popgroup')) {
      const g = { s, id: s.id, T: s.T, tab: s.tab, steps: [], state: 'idle', left: 0, view: world.viewOf(s), stage: s.stage, flash: 0 };
      this.pops.push(g);
      byPop.set(s.id, g);
    }
    for (const s of specs.filter((x) => x.t === 'popstep')) {
      const g = byPop.get(s.gid);
      const c = col(s.x, s.y - s.sy / 2, s.z, s.sx / 2, s.sy / 2, s.sz / 2, 'popup', s);
      c.active = false;
      c.popup = true;
      world.colliders.push(c);
      const t = { s, g, i: s.i, c, top: s.y, on: false, latch: false, k: 0, since: 0, view: g.view };
      g.steps.push(t);
      this.steps.push(t);
    }
    const byFold = new Map();
    for (const s of specs.filter((x) => x.t === 'foldgroup')) {
      const e = s.entry;
      const f = { s, id: s.id, entrySet: s.entrySet, entry: { x: e.x, z: e.z, sx: e.hx * 2, sz: e.hz * 2, y: e.y }, tiles: [], cur: s.entrySet, last: null, view: world.viewOf(s), stage: s.stage, teach: !!s.teach, taught: false, demo: s.entrySet, demoT: 0, cue: false, relay: !!s.relay, at: -1 };
      this.folds.push(f);
      byFold.set(s.id, f);
    }
    for (const s of specs.filter((x) => x.t === 'fold')) {
      const f = byFold.get(s.gid);
      const c = col(s.x, s.y - s.sy / 2, s.z, s.sx / 2, s.sy / 2, s.sz / 2, 'fold', s);
      c.fold = true;
      c.set = s.set;
      world.colliders.push(c);
      const t = { s, f, set: s.set, c, top: s.y, on: false, k: 0, view: f.view, bx: s.x, move: s.move || null };
      t.on = f.relay ? s.i <= 0 : t.set === f.cur;
      c.active = t.on;
      t.k = t.on ? 1 : 0;
      f.tiles.push(t);
      this.tiles.push(t);
    }
    for (const s of specs.filter((x) => x.t === 'stamp')) {
      const c = col(s.x, s.y + s.h / 2, s.z, s.s / 2, s.h / 2, s.s / 2, 'stamp', s);
      c.stamp = true;
      world.colliders.push(c);
      this.stamps.push({ s, c, view: world.viewOf(s), sw: null });
    }
    this.byCol = new Map(this.tiles.map((t) => [t.c, t]));
    this.prevG = null;
    this.book = book ? this.makeBook() : null;
    this.build();
  }

  makeBook() {
    const fin = this.w.course.cps[this.w.course.cps.length - 1];
    return { x: fin.x, y: fin.y, z: fin.z, r: fin.r, t: -1, view: this.w.lastStage };
  }

  on(v) {
    return this.w.window === null || this.w.inWindow(v);
  }

  build() {
    const w = this.w;
    const T = (o) => w.track(o);
    const g = new THREE.Group();
    w.group.add(g);
    this.group = g;
    const inst = (geo, mat, n, cast = false) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
      im.frustumCulled = false;
      im.castShadow = cast;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(im);
      return im;
    };
    const glow = () => T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const cardG = T(blockGeo(1, 1, 1, 0.04, 1));
    const cardM = T(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true }));
    this.card = inst(cardG, cardM, this.steps.length + this.tiles.length + this.stamps.length, true);
    const fadeM = T(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false }));
    this.fade = inst(cardG, fadeM, this.steps.length + this.tiles.length);
    this.fade.renderOrder = 4;
    this.frame = inst(T(dashFrameGeo()), glow(), this.steps.length + this.tiles.length);
    this.frame.material.forceSinglePass = true;
    this.bandG = T(new THREE.BoxGeometry(1, 0.05, 1));
    const nBands = this.steps.length + this.folds.length + this.tiles.filter((t) => t.move).length * 2;
    this.band = inst(this.bandG, glow(), nBands);
    this.ring = inst(T(new THREE.RingGeometry(0.2, 0.3, 28).rotateX(-Math.PI / 2)), glow(), this.tiles.filter((t) => t.set === 0).length);
    this.square = inst(T(new THREE.BoxGeometry(0.6, 0.04, 0.6)), glow(), this.tiles.filter((t) => t.set === 1).length);
    this.tab = inst(T(tabGeo()), glow(), this.pops.length);
    this.edge = inst(this.bandG, glow(), this.edges.length);
    this.edges.forEach((e, i) => {
      const s = e.s;
      this.edge.setMatrixAt(i, _m.compose(_p.set(s.x, s.y + 0.03, s.z), _q.identity(), _s.set(s.sx, 1, s.sz)));
      this.edge.setColorAt(i, glowColor(0xfff4dc, 1.6));
    });
    this.edge.visible = false;
    this.drop = inst(T(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2)), T(new THREE.MeshBasicMaterial({ color: DROP, transparent: true, opacity: 0.8, depthWrite: false })), this.drops.length);
    this.drop.receiveShadow = false;
    this.drop.renderOrder = 6;
    this.drops.forEach((d, i) => this.drop.setMatrixAt(i, _m.compose(_p.set(d.s.x, d.s.y + 0.05, d.s.z), _q.identity(), _s.set(d.s.r, 1, d.s.r * 1.3))));
    this.drop.visible = false;
    const chevParts = [-1, 1].map((sd) => new THREE.BoxGeometry(0.14, 0.03, 0.75).rotateY(sd * 0.75).translate(sd * 0.24, 0, 0.12));
    const chevG = T(mergeGeometries(chevParts, false));
    for (const q of chevParts) q.dispose();
    this.chev = inst(chevG, glow(), this.chevs.length * 2);
    this.chevs.forEach((cv, i) => {
      for (const k of [0, 1]) {
        const at = cv.s.top ? _p.set(cv.s.x + (k ? 1.3 : -1.3), cv.s.y + cv.s.top + 0.03, cv.s.z) : _p.set(cv.s.x, cv.s.y + 0.03, cv.s.z + k * 0.6);
        this.chev.setMatrixAt(i * 2 + k, _m.compose(at, _q.identity(), _s.set(1, 1, 1)));
        this.chev.setColorAt(i * 2 + k, glowColor(0x3a3a44, 0.5 + 0.4 * k));
      }
    });
    this.chev.visible = false;
    this.wire = inst(T(new THREE.BoxGeometry(1, 0.03, 1)), glow(), this.steps.length + this.tiles.length);
    this.timerFloor = new THREE.Mesh(T(new THREE.PlaneGeometry(1, 1)), T(timerMaterial(false)));
    this.timerFloor.rotation.x = -Math.PI / 2;
    this.timerFloor.frustumCulled = false;
    this.timerFloor.visible = false;
    this.timerFloor.renderOrder = 5;
    this.timerTop = new THREE.Mesh(this.timerFloor.geometry, T(timerMaterial(true)));
    this.timerTop.frustumCulled = false;
    this.timerTop.visible = false;
    this.timerTop.renderOrder = 20;
    g.add(this.timerFloor, this.timerTop);
    this.cyan = glowColor(POP_CYAN, 1);
    this.foldC = FOLD_COLORS.map((c) => glowColor(c, 1));
    this.foldBody = [new THREE.Color(0xb7a3e6), new THREE.Color(0xd4e04a)];
    this.stepBody = new THREE.Color(0x6f8c96);
    this.inkBody = new THREE.Color(STAMP_WOOD);
    let k = 0;
    for (const t of this.steps) t.ci = k++;
    for (const t of this.tiles) t.ci = k++;
    for (const s of this.stamps) s.ci = k++;
    for (const t of this.steps) this.card.setColorAt(t.ci, this.stepBody);
    for (const t of this.tiles) this.card.setColorAt(t.ci, this.foldBody[t.set]);
    for (const s of this.stamps) this.card.setColorAt(s.ci, this.inkBody);
    if (this.card.instanceColor) this.card.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.steps.length + this.tiles.length; i++) {
      this.fade.setColorAt(i, this.stepBody);
      this.fade.setMatrixAt(i, _m.makeScale(0, 0, 0));
    }
    this.fade.visible = false;
    if (this.tents.length) this.buildTents();
    if (this.book) this.buildBook();
    this.restyleVines();
  }

  restyleStamps() {
    this.stampStyled = true;
    const r = this.w.rhythm;
    if (!r.swRim) return;
    r.swRim.material = this.w.track(new THREE.MeshStandardMaterial({ color: STAMP_RIM, roughness: 0.6, metalness: 0 }));
    if (r.swCap) r.swCap.material.color.set(STAMP_FACE);
  }

  restyleVines() {
    const w = this.w;
    if (!w.vineSeg) return;
    w.vineSeg.material.color.set(0x3a3a44);
    w.vineSeg.material.emissive.set(0x000000);
    w.vineLeaf.material.color.set(0xd9cbb0);
    w.vineKnot.material.color.set(0xa8865e);
    w.vineKnot.material.emissive.set(0x000000);
    const m = w.vinePosts.material;
    m.map = cardSide();
    m.color.set(0xffffff);
    m.needsUpdate = true;
  }

  buildTents() {
    const T = (o) => this.w.track(o);
    const m = T(new THREE.MeshStandardMaterial({ color: 0xa8865e, roughness: 0.9, side: THREE.FrontSide }));
    for (const s of this.tents) {
      const parts = [];
      for (const sd of [-1, 1]) parts.push(new THREE.BoxGeometry(0.08, 3.2, 3.4).rotateZ(sd * 0.55).translate(sd * 0.9, 1.35, 0));
      const geo = T(mergeGeometries(parts, false));
      for (const p of parts) p.dispose();
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(s.x, s.y, s.z);
      mesh.rotation.y = Math.PI / 2;
      mesh.scale.set(0.75, 0.6, 0.6);
      mesh.castShadow = true;
      this.w.stageGroup(this.w.viewOf(s)).add(mesh);
    }
  }

  buildBook() {
    const T = (o) => this.w.track(o);
    const bk = this.book;
    const m = T(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    this.bookMesh = new THREE.InstancedMesh(T(new THREE.BoxGeometry(1, 1, 1)), m, 2);
    this.bookMesh.frustumCulled = false;
    this.bookMesh.castShadow = true;
    this.bookMesh.receiveShadow = true;
    this.group.add(this.bookMesh);
    [0x6a4a34, 0xf2ece0].forEach((c, i) => this.bookMesh.setColorAt(i, _c.set(c)));
    this.bookMesh.instanceColor.needsUpdate = true;
    bk.layers = [
      { w: 10, h: 4.2, z: 4.8, shape: ridgeShapes, col: 0x5e6a7e },
      { w: 9, h: 3.0, z: 3.6, shape: hillShapes, col: 0x8fa38a },
      { w: 2.2, h: 2.4, z: 2.2, x: -3.4, shape: pineShapes, col: 0x5f7a5a },
      { w: 1.8, h: 2.6, z: 2.2, x: -1.2, shape: sunShapes, col: 0xf2ece0 },
      { w: 2.0, h: 2.0, z: 2.2, x: 1.0, shape: roundTreeShapes, col: 0xb5c2a5 },
      { w: 1.6, h: 2.6, z: 2.2, x: 3.2, shape: pineShapes, col: 0x5f7a5a },
      { w: 3.4, h: 1.0, z: 0.8, x: 0, shape: grassShapes, col: 0xa8865e },
    ];
    for (const L of bk.layers) {
      const geo = T(new THREE.ExtrudeGeometry(L.shape(L.w, L.h), { depth: 0.07, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -0.035).rotateY(-Math.PI / 2));
      L.mesh = new THREE.Mesh(geo, T(new THREE.MeshStandardMaterial({ color: L.col, roughness: 0.9 })));
      L.mesh.castShadow = true;
      L.mesh.receiveShadow = true;
      L.mesh.visible = false;
      this.group.add(L.mesh);
    }
  }

  step(dt) {
    this.time += dt;
    const p = this.w.player && !this.w.player.dead ? this.w.player : null;
    const pg = p && p.grounded ? p.ground : null;
    if (this.prevG && !pg && p && p.vel.y > 2 && this.byCol.has(this.prevG)) this.byCol.get(this.prevG).sq = 1;
    this.prevG = pg;
    for (const g of this.pops) this.stepPop(g, p, dt);
    for (const t of this.tiles) {
      if (!t.move) continue;
      const ox = t.c.x;
      t.c.x = t.bx + t.move.x * Math.sin(this.time * t.move.speed + t.move.phase);
      t.c.dx = t.c.x - ox;
    }
    for (const f of this.folds) this.stepFold(f, p, dt);
    if (this.w.player) this.fp = this.w.player;
    const fp = this.fp;
    if (this.book && this.book.t < 0 && fp && !fp.dead && Math.abs(fp.pos.y - this.book.y) < 3 && Math.hypot(fp.pos.x - this.book.x, fp.pos.z - this.book.z) < this.book.r + (fp.frozen ? 10 : 2)) this.book.t = 0;
    if (this.book && this.book.t >= 0) this.book.t += dt;
  }

  near(t, pos, pad) {
    const s = t.s;
    const cx = t.c.x;
    return Math.abs(pos.x - cx) < s.sx / 2 + pad && Math.abs(pos.z - s.z) < s.sz / 2 + pad && pos.y > t.top - 0.5 && pos.y < t.top + 3.2;
  }

  stepPop(g, p, dt) {
    const tab = g.tab;
    const yOk = p && p.pos.y > tab.y - 0.6 && p.pos.y < tab.y + 3;
    const onTab = yOk && inRect(tab, p.pos, 0);
    const nearTab = yOk && inRect(tab, p.pos, LEAVE);
    if (onTab && g.state !== 'armed') {
      g.state = 'armed';
      g.left = g.T;
      g.flash = 0.6;
      for (const t of g.steps) t.latch = false;
      this.sound('pop', g);
    } else if (g.state === 'armed' && !nearTab) {
      g.state = 'run';
      g.left = g.T;
    }
    if (g.state === 'run') {
      const before = Math.ceil(g.left);
      g.left -= dt;
      if (Math.ceil(g.left) !== before && g.left > 0) this.sound(g.left < WARN_T ? 'tick' : 'tock', g);
      if (g.left <= 0) {
        g.left = 0;
        g.state = 'gone';
        for (const t of g.steps) t.latch = !!p && this.near(t, p.pos, 0);
        this.sound('fold', g);
      }
    }
    g.flash = Math.max(0, g.flash - dt);
    for (const t of g.steps) {
      if (t.latch && !(p && this.near(t, p.pos, LATCH))) t.latch = false;
      const want = g.state === 'armed' || g.state === 'run' || t.latch;
      if (want !== t.on) {
        t.on = want;
        t.since = 0;
      }
      t.since += dt;
      t.c.active = t.on;
    }
  }

  stepFold(f, p, dt) {
    f.cue = false;
    const grounded = p && p.grounded && p.ground;
    const onTile = grounded && f.tiles.some((t) => t.c === p.ground);
    const onEntry = grounded && !onTile && inRect(f.entry, p.pos, 0) && p.pos.y > f.entry.y - 0.35 && p.pos.y < f.entry.y + 1;
    if (f.teach && !f.taught && (onTile || (p && !p.grounded && f.last !== null))) f.taught = true;
    if (f.relay) {
      if (onTile) f.at = f.tiles.find((t) => t.c === p.ground).s.i;
      else if (onEntry) f.at = -1;
    } else if (f.teach && !f.taught && onEntry) {
      f.demoT += dt;
      if (f.demoT >= DEMO) {
        f.demoT -= DEMO;
        f.demo = 1 - f.demo;
      }
      f.cue = f.demoT > DEMO - CUE;
      f.cur = f.demo;
      f.last = f.entrySet;
    } else if (grounded) {
      const tile = f.tiles.find((t) => t.c === p.ground);
      if (tile) {
        f.cur = tile.set;
        f.last = tile.set;
      } else if (onEntry) {
        f.cur = f.entrySet;
        f.last = f.entrySet;
      } else f.last = null;
    } else if (p && !p.grounded && f.last !== null) f.cur = 1 - f.last;
    let flips = 0;
    for (const t of f.tiles) {
      let want = f.relay ? t.s.i >= f.at - 1 && t.s.i <= f.at + 1 : t.set === f.cur;
      if (!want && t.on && p && (this.near(t, p.pos, LATCH) || this.landing(t, p))) want = true;
      if (want) {
        if (!t.on) flips++;
        t.on = true;
        t.warn = 0;
      } else if (t.on) {
        t.warn = (t.warn || 0) + dt;
        if (t.warn >= FOLD_WARN) {
          t.on = false;
          t.warn = 0;
          flips++;
        }
      }
      t.c.active = t.on;
    }
    if (flips && p && this.on(f.view)) this.sound('snap', f);
  }

  landing(t, p) {
    if (p.grounded) return false;
    const s = t.s;
    for (let k = 1; k <= 6; k++) {
      const u = k * 0.05;
      const x = p.pos.x + p.vel.x * u;
      const z = p.pos.z + p.vel.z * u;
      const y = p.pos.y + p.vel.y * u - 0.5 * 30 * 1.65 * u * u;
      if (y <= t.top + 0.1 && y > t.top - 1 && Math.abs(x - t.c.x) < s.sx / 2 + 0.4 && Math.abs(z - s.z) < s.sz / 2 + 0.4) return true;
    }
    return false;
  }

  dock() {
    for (const g of this.pops) {
      g.state = 'idle';
      g.left = 0;
      g.flash = 0;
      for (const t of g.steps) {
        t.latch = false;
        t.on = false;
        t.c.active = false;
        t.k = 0;
      }
    }
    for (const f of this.folds) {
      f.cur = f.entrySet;
      f.last = null;
      f.taught = false;
      f.demo = f.entrySet;
      f.demoT = 0;
      f.at = -1;
      for (const t of f.tiles) {
        t.on = f.relay ? t.s.i <= 0 : t.set === f.cur;
        t.warn = 0;
        t.c.active = t.on;
        t.k = t.on ? 1 : 0;
      }
    }
  }

  reset() {
    this.dock();
    if (this.book) this.book.t = -1;
  }

  finaleAim() {
    const bk = this.book;
    if (!bk || bk.t < 0) return null;
    return { x: bk.x - 2.5, y: bk.y + 0.6, z: bk.z + 1.2, yaw: Math.PI / 2 + 0.5, dist: 14, h: 4.6 };
  }

  sound(kind) {
    const a = this.w.audio;
    if (!a || !a.ctx) return;
    if (kind === 'pop') {
      a.noise(0.08, { vol: 0.05, freq: 2400, type: 'highpass' });
      [784, 988, 1175].forEach((f, i) => a.tone(f, 0.18, { type: 'triangle', vol: 0.06, when: i * 0.06 }));
    } else if (kind === 'tick') {
      a.tone(1397, 0.07, { type: 'triangle', vol: 0.07 });
      a.tone(1397, 0.05, { type: 'triangle', vol: 0.05, when: 0.25 });
    } else if (kind === 'tock') a.tone(880, 0.05, { type: 'triangle', vol: 0.04 });
    else if (kind === 'fold') a.tone(587, 0.3, { type: 'triangle', vol: 0.06, slide: 0.7 });
    else if (kind === 'snap') a.noise(0.05, { vol: 0.04, freq: 3200, type: 'highpass' });
  }

  hinge(t, k, sx, sz, sy) {
    const s = t.s;
    const a = (1 - k) * (Math.PI / 2);
    _q.setFromAxisAngle(_x, -a);
    const hz = s.z + s.sz / 2;
    const hy = t.top;
    _m.compose(_p.set(0, -sy / 2, -sz / 2), _qi, _s.set(sx, sy, sz));
    _m2.compose(_p.set(t.c.x, hy, hz), _q, _s.set(1, 1, 1));
    return _m2.multiply(_m);
  }

  update(t, dt) {
    const p = this.w.player;
    if (!this.stampStyled && this.stamps.length && this.w.rhythm) this.restyleStamps();
    const anyS = this.steps.some((x) => this.on(x.view));
    const anyF = this.tiles.some((x) => this.on(x.view));
    const anyK = this.stamps.some((x) => this.on(x.view));
    this.card.visible = anyS || anyF || anyK;
    this.frame.visible = anyS || anyF;
    this.band.visible = anyS || anyF;
    this.ring.visible = anyF;
    this.square.visible = anyF;
    this.tab.visible = this.pops.some((g) => this.on(g.view));
    let bi = 0;
    for (const st of this.steps) {
      const vis = this.on(st.view) ? 1 : 0;
      const g = st.g;
      const delay = st.on ? st.i * STAGGER : 0;
      const target = st.on && st.since > delay ? 1 : 0;
      st.k += (target - st.k) * (1 - Math.exp(-dt / (target ? RISE / 3 : RISE / 4)));
      const k = st.k;
      const s = st.s;
      this.card.setMatrixAt(st.ci, k < 0.01 || !vis ? _m.makeScale(0, 0, 0) : this.hinge(st, k, s.sx, s.sy, s.sz));
      _m.compose(_p.set(st.c.x, st.top + 0.02, s.z), _q.identity(), _s.set(s.sx * vis, 1, s.sz * vis));
      this.frame.setMatrixAt(st.ci, st.on ? _m.makeScale(0, 0, 0) : _m);
      const warn = g.state === 'run' && g.left < WARN_T;
      const lum = st.on ? (warn ? 1.2 + 1.7 * (0.5 + 0.5 * Math.cos(g.left * Math.PI * 4)) : 2.9) : 0.55;
      this.frame.setColorAt(st.ci, _c.copy(this.cyan).multiplyScalar(lum));
      _m.compose(_p.set(st.c.x, st.top + 0.03 - (1 - k) * 0.4, s.z - s.sz / 2 + 0.12 + (1 - k) * 0), _q.identity(), _s.set((s.sx - 0.2) * vis * Math.max(0.001, k), 1, 0.2 * vis));
      this.band.setMatrixAt(bi, _m);
      this.band.setColorAt(bi, _c.copy(this.cyan).multiplyScalar(lum));
      bi++;
    }
    this.pops.forEach((g, i) => {
      const vis = this.on(g.view) ? 1 : 0;
      const tb = g.tab;
      _m.compose(_p.set(tb.x, tb.y + 0.03, tb.z), _q.identity(), _s.set(tb.sx * vis, 1, tb.sz * vis));
      this.tab.setMatrixAt(i, _m);
      let lum = 2.9;
      if (g.state === 'idle' || g.state === 'gone') lum = 0.55 + (2.9 - 0.55) * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      if (g.flash > 0) lum = 4.5;
      this.tab.setColorAt(i, _c.copy(this.cyan).multiplyScalar(lum));
    });
    let ri = 0;
    let si = 0;
    for (const tl of this.tiles) {
      const vis = this.on(tl.view) ? 1 : 0;
      const target = tl.on ? 1 : 0;
      tl.k += (target - tl.k) * (1 - Math.exp(-dt / ((tl.on ? FOLD_UP : FOLD_DOWN) / 3)));
      const s = tl.s;
      const k = tl.k;
      tl.sq = Math.max(0, (tl.sq || 0) - dt * 3.5);
      const q = Math.sin(tl.sq * Math.PI) * tl.sq * 0.3;
      const hy = s.sy * Math.max(0.02, k) * (1 - q);
      const wv = tl.warn > 0 ? Math.sin(tl.warn * 70) * 0.07 : 0;
      _m.compose(_p.set(tl.c.x + wv, tl.top - q * 0.5 - hy / 2, s.z), _q.identity(), _s.set(s.sx * (1 + q * 0.06) * vis, hy * vis + 0.0001, s.sz * (1 + q * 0.06) * vis));
      this.card.setMatrixAt(tl.ci, k < 0.02 ? _m.makeScale(0, 0, 0) : _m);
      _m.compose(_p.set(tl.c.x, tl.top + 0.025, s.z), _q.identity(), _s.set(s.sx * vis, 1, s.sz * vis));
      const blink = tl.warn > 0 && Math.sin(tl.warn * Math.PI * 12) > 0;
      this.frame.setMatrixAt(tl.ci, tl.on && !blink ? _m.makeScale(0, 0, 0) : _m);
      const cue = (tl.f.cue && !tl.on) || blink ? 2.2 + 2.2 * (0.5 + 0.5 * Math.cos(t * Math.PI * 20)) : 0.55;
      this.frame.setColorAt(tl.ci, _c.copy(this.foldC[tl.set]).multiplyScalar(cue));
      const gs = Math.min(s.sx, s.sz) * 1.5;
      _m.compose(_p.set(tl.c.x, tl.top + 0.035, s.z), _q.identity(), _s.set(gs * vis, 1, gs * vis));
      const lum = tl.on ? 3.4 : 0.3;
      if (tl.set === 0) {
        this.ring.setMatrixAt(ri, _m);
        this.ring.setColorAt(ri++, _c.copy(this.foldC[0]).multiplyScalar(lum));
      } else {
        _m.compose(_p.set(tl.c.x, tl.top + 0.035, s.z), _q.identity(), _s.set(gs * 0.38 * vis, 1, gs * 0.38 * vis));
        this.square.setMatrixAt(si, _m);
        this.square.setColorAt(si++, _c.copy(this.foldC[1]).multiplyScalar(lum));
      }
      if (tl.move) {
        for (const sd of [-1, 1]) {
          _m.compose(_p.set(tl.bx, tl.top - s.sy - 0.1, s.z + sd * (s.sz / 2 - 0.5)), _q.identity(), _s.set((s.sx + tl.move.x * 2) * vis, 2, 0.14 * vis));
          this.band.setMatrixAt(bi, _m);
          this.band.setColorAt(bi++, _c.set(RAIL));
        }
      }
    }
    for (const f of this.folds) {
      const vis = this.on(f.view) ? 1 : 0;
      const e = f.entry;
      const t0 = f.tiles[0];
      const dx = t0.s.x - e.x;
      const dz = t0.s.z - e.z;
      const sideways = Math.abs(dx) > Math.abs(dz);
      const ex = sideways ? e.x + Math.sign(dx) * (e.sx / 2 - 0.25) : t0.s.x;
      const ez = sideways ? t0.s.z : e.z - e.sz / 2 + 0.25;
      _m.compose(_p.set(ex, e.y + 0.03, ez), _q.identity(), _s.set((sideways ? 0.3 : 2.6) * vis, 1, (sideways ? 2.6 : 0.3) * vis));
      this.band.setMatrixAt(bi, _m);
      this.band.setColorAt(bi++, _c.copy(this.foldC[f.entrySet]).multiplyScalar(f.cur === f.entrySet ? 2.9 : 0.55));
    }
    for (const sk of this.stamps) {
      const vis = this.on(sk.view) ? 1 : 0;
      if (!sk.sw && this.w.rhythm) sk.sw = this.w.rhythm.switches.find((x) => Math.abs(x.s.x - sk.s.x) < 0.01 && Math.abs(x.s.z - sk.s.z) < 0.01) || null;
      const sink = sk.sw ? sk.sw.sink * 0.08 : 0;
      const s = sk.s;
      _m.compose(_p.set(s.x, s.y + (s.h - sink) / 2, s.z), _q.identity(), _s.set(s.s * vis, (s.h - sink) * vis + 0.0001, s.s * vis));
      this.card.setMatrixAt(sk.ci, _m);
    }
    this.fadeBlockers(p);
    this.fadeWalls(p);
    this.updateWires(t);
    this.edge.visible = this.edges.some((e) => this.on(e.view));
    this.drop.visible = this.drops.some((d) => this.on(d.view));
    this.chev.visible = this.chevs.some((c) => this.on(c.view));
    for (const im of [this.card, this.fade, this.frame, this.band, this.ring, this.square, this.tab, this.wire]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.updateTimer(t, p);
    if (this.book) this.updateBook(t);
  }

  wireAt(i, ax, ay, az, bx, by, bz, color, vis) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    _q.setFromAxisAngle(_y, Math.atan2(dx, dz));
    _m.compose(_p.set((ax + bx) / 2, Math.max(ay, by) + 0.04, (az + bz) / 2), _q, _s.set(0.1 * vis, 1, len * vis + 0.0001));
    this.wire.setMatrixAt(i, _m);
    this.wire.setColorAt(i, color);
  }

  updateWires(t) {
    let i = 0;
    let anyW = false;
    for (const g of this.pops) {
      const vis = this.on(g.view) ? 1 : 0;
      anyW = anyW || !!vis;
      let a = { x: g.tab.x, y: g.tab.y, z: g.tab.z };
      g.steps.forEach((st, k) => {
        const idle = !st.on;
        const lum = idle ? 0.5 + 2.2 * Math.max(0, Math.sin(t * 5 - k * 1.1)) ** 4 : 0.9;
        this.wireAt(i++, a.x, a.y, a.z, st.c.x, st.top, st.s.z, _c.copy(this.cyan).multiplyScalar(lum), vis);
        a = { x: st.c.x, y: st.top, z: st.s.z };
      });
    }
    for (const f of this.folds) {
      const vis = this.on(f.view) ? 1 : 0;
      anyW = anyW || !!vis;
      for (const tl of f.tiles) {
        const i0 = tl.s.i;
        const src = i0 === 0 ? null : f.tiles.find((x) => x.s.i === i0 - 1);
        const ax = src ? src.c.x : f.entry.x;
        const az = src ? src.s.z : f.entry.z;
        const ay = src ? src.top : f.entry.y;
        const live = !tl.on && (src ? src.on : f.cur === f.entrySet);
        const lum = live ? 0.7 + 2.4 * Math.max(0, Math.sin(t * 5 - i0 * 1.1)) ** 4 : 0.45;
        this.wireAt(i++, ax, ay, az, tl.c.x, tl.top, tl.s.z, _c.copy(this.foldC[tl.set]).multiplyScalar(lum), vis);
      }
    }
    this.wire.visible = anyW;
  }

  fadeWalls(p) {
    if (!this.walls) this.walls = this.w.colliders.filter((c) => c.spec && c.spec.fade && c.obj);
    const cam = this.w.camera;
    for (const c of this.walls) {
      const hide = !!cam && !!p && !p.dead && this.on(this.w.viewOf(c.spec)) && [0.4, 1.1].some((lift) => segBox(cam.position, p.pos, lift, c.x - c.hx, c.y - c.hy, c.z - c.hz, c.x + c.hx, c.y + c.hy, c.z + c.hz));
      if (hide === !!c.faded) continue;
      c.faded = hide;
      c.obj.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.userData.solidMat) {
          o.userData.solidMat = o.material;
          const mk = (m) => {
            const q = m.clone();
            q.transparent = true;
            q.opacity = 0.3;
            q.depthWrite = false;
            return this.w.track(q);
          };
          o.userData.fadeMat = Array.isArray(o.material) ? o.material.map(mk) : mk(o.material);
        }
        o.material = hide ? o.userData.fadeMat : o.userData.solidMat;
      });
    }
  }

  fadeBlockers(p) {
    const cam = this.w.camera;
    let any = false;
    for (const t of [...this.steps, ...this.tiles]) {
      let hide = false;
      if (cam && p && !p.dead && t.on && t.k > 0.5 && this.on(t.view)) {
        const s = t.s;
        hide = [0.4, 1.1].some((lift) => segBox(cam.position, p.pos, lift, t.c.x - s.sx / 2, t.top - s.sy, s.z - s.sz / 2, t.c.x + s.sx / 2, t.top, s.z + s.sz / 2));
      }
      if (hide) {
        this.card.getMatrixAt(t.ci, _m);
        this.fade.setMatrixAt(t.ci, _m);
        this.card.getColorAt(t.ci, _c);
        this.fade.setColorAt(t.ci, _c);
        this.card.setMatrixAt(t.ci, _m.makeScale(0, 0, 0));
        any = true;
      } else this.fade.setMatrixAt(t.ci, _m.makeScale(0, 0, 0));
    }
    this.fade.visible = any;
  }

  past(g, pos) {
    if (g.endZ === undefined) g.endZ = Math.min(...g.steps.map((x) => x.s.z - x.s.sz / 2));
    return pos.z < g.endZ - 0.3;
  }

  updateTimer(t, p) {
    const g = this.pops.find((x) => (x.state === 'armed' || x.state === 'run') && this.on(x.view) && !(p && this.past(x, p.pos)));
    this.timerFloor.visible = !!g;
    this.timerTop.visible = !!g && !!p && !p.dead;
    if (!g) return;
    const left = g.state === 'armed' ? 1 : g.left / g.T;
    const warn = g.state === 'run' && g.left < WARN_T;
    const pulse = warn ? 0.75 + 0.25 * Math.cos(g.left * Math.PI * 4) : 1;
    for (const m of [this.timerFloor.material, this.timerTop.material]) {
      m.uniforms.left.value = left;
      m.uniforms.color.value.set(warn ? WARN_RED : POP_CYAN).multiplyScalar(pulse);
    }
    this.timerFloor.position.set(g.tab.x + g.tab.sx / 2 + 0.9, g.tab.y + 0.05, g.tab.z);
    this.timerFloor.scale.setScalar(1.6);
    if (this.timerTop.visible) {
      const cam = this.w.camera;
      _p.set(1, 0, 0);
      if (cam) _p.applyQuaternion(cam.quaternion);
      _p.y = 0;
      if (_p.lengthSq() < 1e-4) _p.set(1, 0, 0);
      _p.normalize();
      this.timerTop.position.set(p.pos.x + _p.x * 1.6, p.pos.y + 1.15 + 0.05 * Math.sin(t * 3), p.pos.z + _p.z * 1.6);
      if (cam) {
        _s.copy(cam.position).sub(this.timerTop.position).setY(0);
        if (_s.lengthSq() > 1e-4) this.timerTop.position.addScaledVector(_s.normalize(), 0.9);
        this.timerTop.quaternion.copy(cam.quaternion);
      }
      this.timerTop.scale.setScalar(warn ? 1.25 + 0.12 * Math.max(0, Math.cos(g.left * Math.PI * 2)) : 1.1);
    }
  }

  updateBook() {
    const bk = this.book;
    const vis = this.on(bk.view);
    this.bookMesh.visible = vis;
    if (!vis) {
      for (const L of bk.layers) L.mesh.visible = false;
      return;
    }
    const side = bk.x - bk.r;
    const o = bk.t < 0 ? 0 : Math.min(1, bk.t / BOOK_OPEN);
    const e = o * o * (3 - 2 * o);
    const W = bk.r * 2;
    _m.compose(_p.set(bk.x, bk.y - 1.1, bk.z), _q.identity(), _s.set(W + 0.6, 0.3, W + 0.6));
    this.bookMesh.setMatrixAt(0, _m);
    _q.setFromAxisAngle(_z, -(1 - e) * Math.PI);
    _m.compose(_p.set(-W / 2, 0.12, 0), _qi, _s.set(W, 0.24, W));
    _m2.compose(_p.set(side, bk.y - 0.05, bk.z), _q, _s.set(1, 1, 1));
    this.bookMesh.setMatrixAt(1, _m2.multiply(_m));
    bk.layers.forEach((L, i) => {
      const start = BOOK_OPEN + i * 0.18;
      const u = bk.t < start ? 0 : Math.min(1, (bk.t - start) / 0.35);
      const up = u * u * (3 - 2 * u);
      L.mesh.visible = up > 0.001;
      L.mesh.position.set(side - L.z * e, bk.y + 0.2, bk.z + (L.x || 0));
      L.mesh.quaternion.setFromAxisAngle(_z, (1 - up) * (Math.PI / 2));
    });
    this.bookMesh.instanceMatrix.needsUpdate = true;
  }
}
