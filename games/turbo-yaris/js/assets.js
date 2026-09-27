import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makePaintMaterial } from './paints.js';
import { blobShadowTexture } from './textures.js';

export const WHEEL_R = 0.46;

export const assets = {
  kart: null,
  shadowTex: null,
  shadowGeo: null,
  headMat: null,
  tailMat: null,
  shared: []
};

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

function part(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function merge(list, keep = true) {
  const g = mergeGeometries(list, false);
  list.forEach(p => p.dispose());
  g.computeBoundingSphere();
  g.userData.keep = keep;
  return g;
}

const rbox = (w, h, d, r = 0.08, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const SPH = (r, w = 12, h = 8, ps, pl, ts, tl) => new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl);
const CYL = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);

function taper(geo, len, sx, sy) {
  const pos = geo.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getZ(i) / len + 0.5));
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - (1 - sx) * t * t));
    pos.setY(i, minY + (y - minY) * (1 - (1 - sy) * t));
  }
  geo.computeVertexNormals();
  return geo;
}

function limb(a, b, r, color) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 1, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return part(g, color, m);
}

function tireGeo(R, w, segs) {
  const hw = w / 2;
  const rc = Math.min(0.14, w * 0.34);
  const pts = [new THREE.Vector2(R * 0.6, -hw + 0.03)];
  for (let i = 0; i <= 2; i++) { const a = -Math.PI / 2 + (i / 2) * Math.PI / 2; pts.push(new THREE.Vector2(R - rc + Math.cos(a) * rc, -hw + rc + Math.sin(a) * rc)); }
  for (let i = 0; i <= 2; i++) { const a = (i / 2) * Math.PI / 2; pts.push(new THREE.Vector2(R - rc + Math.cos(a) * rc, hw - rc + Math.sin(a) * rc)); }
  pts.push(new THREE.Vector2(R * 0.6, hw - 0.03));
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateZ(Math.PI / 2);
  return g;
}

const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function buildWheel(R, w, side) {
  const tire = [part(tireGeo(R, w, 16), 0x1c1d22)];
  const lugs = 8;
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationX(a).multiply(new THREE.Matrix4().makeTranslation(0, R - 0.01, 0));
    tire.push(part(BOX(w * 0.8, 0.075, 0.16), 0x2a2b31, m));
  }
  const face = side * (w * 0.4);
  const rim = [
    part(new THREE.CylinderGeometry(R * 0.62, R * 0.62, w * 0.8, 14, 1, true), 0xb9c0cc, M(0, 0, 0, 0, 0, Math.PI / 2)),
    part(CYL(R * 0.5, R * 0.56, 0.04, 14), 0xf3f5f9, M(face + side * 0.005, 0, 0, 0, 0, Math.PI / 2)),
    part(CYL(R * 0.17, R * 0.21, 0.1, 8), 0x2e323c, M(face + side * 0.04, 0, 0, 0, 0, Math.PI / 2))
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationX(a).multiply(new THREE.Matrix4().makeTranslation(face + side * 0.03, R * 0.3, 0));
    rim.push(part(BOX(0.05, R * 0.34, 0.09), 0x2e323c, m));
  }
  return { tire: merge(tire), rim: merge(rim) };
}

function fender(x, y, z, R, w, a0, a1) {
  const g = new THREE.TorusGeometry(R + 0.1, 0.07, 10, 20, a1 - a0);
  g.rotateZ(a0);
  g.applyMatrix4(M(0, 0, 0, 0, 0, 0, 1, 1, (w + 0.12) / 0.14));
  g.rotateY(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function headParts(out, r, helmetColor, stripe) {
  const shell = helmetColor == null ? out.paint : out.gloss;
  const hc = helmetColor == null ? 0xffffff : helmetColor;
  const win = 0.85;
  const add = (list, g, c) => list.push(part(g, c));
  add(shell, SPH(r, 14, 9, Math.PI / 2 + win, Math.PI * 2 - win * 2, 0, Math.PI), hc);
  add(shell, SPH(r, 6, 4, Math.PI / 2 - win, win * 2, 0, 0.78), hc);
  add(shell, SPH(r, 6, 3, Math.PI / 2 - win, win * 2, 2.3, Math.PI - 2.3), hc);
  add(out.glass, SPH(r * 1.05, 10, 2, Math.PI / 2 - 0.98, 1.96, 0.5, 0.36), 0x151a26);
  const band = new THREE.TorusGeometry(r * 1.015, r * 0.1, 3, 12, Math.PI - 0.95);
  band.rotateZ(0.95);
  band.rotateY(-Math.PI / 2);
  add(out.gloss, band, stripe);
  out.gloss.push(part(SPH(r * 0.9, 9, 8, Math.PI / 2 - 1.2, 2.4), 0xffcfa6, M(0, -r * 0.05, r * 0.04)));
  for (const s of [-1, 1]) {
    const ex = s * r * 0.34, ey = 0, ez = r * 0.82;
    out.gloss.push(part(SPH(r * 0.2, 7, 5), 0x1a1426, M(ex, ey, ez, 0, s * 0.38, 0, 0.78, 1.12, 0.42)));
    out.gloss.push(part(SPH(r * 0.07, 5, 3), 0xffffff, M(ex - r * 0.06, ey + r * 0.09, ez + r * 0.07)));
    out.gloss.push(part(SPH(r * 0.1, 5, 3), 0xff8fa0, M(s * r * 0.54, -r * 0.26, r * 0.66, 0, s * 0.62, 0, 1.1, 0.6, 0.3)));
  }
  out.gloss.push(part(new THREE.TorusGeometry(r * 0.12, r * 0.035, 3, 8, Math.PI), 0x7a1f2e, M(0, -r * 0.3, r * 0.84, 0, 0, Math.PI)));
}

function buildKart() {
  const paint = [], trim = [], gloss = [], metal = [], glass = [], head = [], tail = [];
  const W = [[0.92, 0.42, 1.25, 0.42, 0.38], [-0.92, 0.42, 1.25, 0.42, 0.38], [0.98, 0.5, -1.05, 0.5, 0.5], [-0.98, 0.5, -1.05, 0.5, 0.5]];
  paint.push(part(rbox(1.36, 0.48, 2.5, 0.22, 2), 0xffffff, M(0, 0.57, -0.12)));
  paint.push(part(taper(rbox(1.24, 0.46, 1.3, 0.2, 2), 1.3, 0.74, 0.62), 0xffffff, M(0, 0.55, 1.3)));
  for (const [x, y, z, R, w] of W) paint.push(part(fender(x, y, z, R, w, z > 0 ? 0.25 : 0.2, z > 0 ? 2.75 : 2.95), 0xffffff));
  for (const s of [-1, 1]) {
    paint.push(part(rbox(0.44, 0.42, 1.2, 0.16, 1), 0xffffff, M(s * 0.8, 0.5, -0.1)));
    trim.push(part(BOX(0.3, 0.18, 0.06), 0x15171d, M(s * 0.8, 0.5, 0.5)));
    gloss.push(part(BOX(0.03, 0.09, 1.0), 0xffffff, M(s * 1.02, 0.56, -0.1)));
    trim.push(part(rbox(0.08, 0.5, 0.7, 0.035), 0x1d2028, M(s * 1.02, 1.3, -1.62)));
    trim.push(part(BOX(0.08, 0.56, 0.14), 0x2a2d36, M(s * 0.42, 1.08, -1.52, 0.15, 0, 0)));
    metal.push(part(CYL(0.1, 0.085, 0.62, 10), 0xd8dde6, M(s * 0.36, 0.6, -1.78, Math.PI / 2, 0, 0)));
    metal.push(part(CYL(0.11, 0.11, 0.06, 10), 0x5a606c, M(s * 0.36, 0.6, -2.08, Math.PI / 2, 0, 0)));
    head.push(part(CYL(0.12, 0.12, 0.06, 12), 0xffffff, M(s * 0.34, 0.6, 1.9, Math.PI / 2 - 0.5, 0, 0)));
    tail.push(part(BOX(0.3, 0.12, 0.06), 0xffffff, M(s * 0.6, 0.42, -2.0)));
    trim.push(limb(new THREE.Vector3(s * 0.48, 0.42, -1.05), new THREE.Vector3(s * 0.76, 0.48, -1.05), 0.06, 0x2a2d36));
    trim.push(limb(new THREE.Vector3(s * 0.4, 0.36, 1.25), new THREE.Vector3(s * 0.74, 0.42, 1.25), 0.05, 0x2a2d36));
  }
  paint.push(part(taper(rbox(0.8, 0.52, 0.9, 0.2, 1), 0.9, 0.8, 0.7), 0xffffff, M(0, 0.94, -1.0, 0, Math.PI, 0)));
  paint.push(part(rbox(2.1, 0.14, 0.6, 0.06, 1), 0xffffff, M(0, 1.55, -1.64, -0.14, 0, 0)));
  gloss.push(part(BOX(2.11, 0.04, 0.12), 0xffffff, M(0, 1.6, -1.4, -0.14, 0, 0)));
  trim.push(part(BOX(1.5, 0.12, 3.3), 0x22252d, M(0, 0.28, -0.1)));
  trim.push(part(rbox(1.84, 0.22, 0.3, 0.1, 1), 0x2a2d36, M(0, 0.32, 2.06)));
  trim.push(part(BOX(0.18, 0.12, 0.34), 0x2a2d36, M(0.55, 0.3, 1.88)));
  trim.push(part(BOX(0.18, 0.12, 0.34), 0x2a2d36, M(-0.55, 0.3, 1.88)));
  trim.push(part(BOX(0.6, 0.14, 0.06), 0x15171d, M(0, 0.5, 1.95)));
  trim.push(part(rbox(1.62, 0.22, 0.26, 0.09, 1), 0x2a2d36, M(0, 0.3, -1.9)));
  trim.push(part(BOX(0.92, 0.07, 1.0), 0x15171d, M(0, 0.82, -0.2)));
  trim.push(part(rbox(0.74, 0.74, 0.18, 0.08, 1), 0x30343e, M(0, 1.04, -0.66, -0.2, 0, 0)));
  trim.push(part(BOX(0.66, 0.26, 0.44), 0x3a3f4b, M(0, 0.62, -1.46)));
  gloss.push(part(CYL(0.24, 0.24, 0.03, 14), 0xffffff, M(0, 0.76, 1.24, -0.28, 0, 0)));
  gloss.push(part(CYL(0.14, 0.14, 0.035, 12), 0x2a2d36, M(0, 0.765, 1.24, -0.28, 0, 0)));
  trim.push(part(new THREE.TorusGeometry(0.19, 0.035, 4, 12), 0x1d2028, M(0, 1.02, 0.36, -0.55, 0, 0)));
  metal.push(part(CYL(0.03, 0.03, 0.42, 6), 0x8a909c, M(0, 0.88, 0.52, -0.55 + Math.PI / 2, 0, 0)));
  const hp = { paint: [], gloss: [], glass: [] };
  headParts(hp, 0.34, null, 0xffffff);
  const hm = M(0, 1.52, -0.3);
  hp.paint.forEach(g => { g.applyMatrix4(hm); paint.push(g); });
  hp.gloss.forEach(g => { g.applyMatrix4(hm); gloss.push(g); });
  hp.glass.forEach(g => { g.applyMatrix4(hm); glass.push(g); });
  gloss.push(part(rbox(0.62, 0.5, 0.42, 0.18, 1), 0xf2f3f7, M(0, 1.02, -0.34)));
  gloss.push(part(CYL(0.13, 0.15, 0.1, 8), 0x2a2d36, M(0, 1.28, -0.32)));
  for (const s of [-1, 1]) {
    gloss.push(limb(new THREE.Vector3(s * 0.3, 1.14, -0.3), new THREE.Vector3(s * 0.24, 1.0, 0.1), 0.075, 0xf2f3f7));
    gloss.push(limb(new THREE.Vector3(s * 0.24, 1.0, 0.1), new THREE.Vector3(s * 0.17, 1.05, 0.3), 0.07, 0xf2f3f7));
    gloss.push(part(SPH(0.08, 6, 4), 0x2a2d36, M(s * 0.17, 1.05, 0.33)));
  }
  const wheels = W.map(([x, y, z, R, w]) => ({ pos: new THREE.Vector3(x, y, z), ...buildWheel(R, w, Math.sign(x)) }));
  return {
    body: { paint: merge(paint), trim: merge(trim), gloss: merge(gloss), metal: merge(metal), glass: merge(glass), head: merge(head), tail: merge(tail) },
    wheels
  };
}

function initShared() {
  const std = (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); assets.shared.push(m); return m; };
  assets.trimMat = std({ roughness: 0.55, metalness: 0.15 });
  assets.metalMat = std({ roughness: 0.22, metalness: 0.95 });
  assets.tireMat = std({ roughness: 0.88, metalness: 0 });
  assets.rimMat = std({ roughness: 0.25, metalness: 0.85 });
  assets.figMat = std({ roughness: 0.5, metalness: 0 });
  assets.glossMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  assets.glassMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.4, clearcoat: 1 });
  assets.headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff4d8, emissiveIntensity: 0.3, roughness: 0.2 });
  assets.tailMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff1010, emissiveIntensity: 0.5, roughness: 0.3 });
  assets.shared.push(assets.glossMat, assets.glassMat, assets.headMat, assets.tailMat);
}

export async function loadAssets(onProgress) {
  initShared();
  assets.kart = buildKart();
  assets.shadowTex = blobShadowTexture();
  assets.shadowGeo = new THREE.PlaneGeometry(2.5, 4.4);
  assets.shadowGeo.userData.keep = true;
  if (onProgress) onProgress(1);
}

export function kartTriangles() {
  const count = g => g.attributes.position.count / 3;
  const k = assets.kart;
  let n = 0;
  for (const g of Object.values(k.body)) n += count(g);
  for (const w of k.wheels) n += count(w.tire) + count(w.rim);
  return n;
}

export function createCar(paint, lod = 'high') {
  const k = assets.kart;
  const high = lod !== 'low';
  const group = new THREE.Group();
  const bodyMat = makePaintMaterial(paint);
  const chassis = new THREE.Group();
  group.add(chassis);
  const b = k.body;
  const mats = [[b.paint, bodyMat], [b.trim, assets.trimMat], [b.gloss, assets.glossMat], [b.metal, assets.metalMat], [b.glass, assets.glassMat], [b.head, assets.headMat], [b.tail, assets.tailMat]];
  for (const [g, m] of mats) {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = high && m !== assets.headMat && m !== assets.tailMat;
    chassis.add(mesh);
  }
  const wheels = k.wheels.map(w => {
    const pivot = new THREE.Group();
    pivot.position.copy(w.pos);
    pivot.rotation.order = 'YXZ';
    const t = new THREE.Mesh(w.tire, assets.tireMat);
    const r = new THREE.Mesh(w.rim, assets.rimMat);
    t.castShadow = high;
    pivot.add(t, r);
    group.add(pivot);
    return pivot;
  });
  const shadow = new THREE.Mesh(assets.shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: assets.shadowTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = 2;
  group.add(shadow);
  return { group, chassis, wheels, bodyMat, shadow };
}

function buildFigure(color) {
  const out = { paint: [], gloss: [], glass: [] };
  headParts(out, 0.25, color, 0xffffff);
  const head = merge(out.gloss, false);
  const visor = merge(out.glass, false);
  const white = 0xf4f5f9;
  const dark = 0x2a2d36;
  const body = [
    part(rbox(0.36, 0.32, 0.26, 0.11, 2), color, M(0, 0.44, 0)),
    part(BOX(0.1, 0.3, 0.02), white, M(0, 0.45, 0.128)),
    part(rbox(0.37, 0.05, 0.27, 0.02, 1), dark, M(0, 0.31, 0)),
    part(CYL(0.085, 0.095, 0.06, 10), white, M(0, 0.61, 0))
  ];
  for (const s of [-1, 1]) {
    body.push(part(new THREE.CapsuleGeometry(0.075, 0.14, 2, 8), color, M(s * 0.09, 0.2, 0)));
    body.push(part(BOX(0.02, 0.2, 0.05), white, M(s * 0.166, 0.2, 0)));
    body.push(part(rbox(0.14, 0.08, 0.21, 0.035, 1), dark, M(s * 0.09, 0.045, 0.025)));
    body.push(part(BOX(0.145, 0.02, 0.215), white, M(s * 0.09, 0.008, 0.025)));
  }
  const arm = () => merge([
    part(new THREE.CapsuleGeometry(0.058, 0.14, 2, 8), color, M(0, -0.1, 0)),
    part(BOX(0.12, 0.03, 0.12), white, M(0, -0.18, 0)),
    part(SPH(0.07, 8, 6), white, M(0, -0.22, 0.01))
  ], false);
  return { head, visor, body: merge(body, false), armL: arm(), armR: arm() };
}

export function createDriver(color, pose = 'Idle', height = 1.8) {
  const f = buildFigure(color);
  const holder = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(height / 1.02);
  holder.add(rig);
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };
  const mat = assets.figMat;
  const body = new THREE.Group();
  rig.add(body);
  body.add(mesh(f.body, mat));
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  const headInner = new THREE.Group();
  headInner.position.y = 0.2;
  headInner.add(mesh(f.head, mat), mesh(f.visor, assets.glassMat));
  head.add(headInner);
  body.add(head);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group();
    a.position.set(s * 0.22, 0.55, 0);
    a.add(mesh(s < 0 ? f.armL : f.armR, mat));
    body.add(a);
    return a;
  });
  let cur = pose;
  let t = Math.random() * 10;
  let since = 0;
  const target = { hop: 0, sway: 0, tilt: 0, nod: 0, lz: -0.12, rz: 0.12, lx: 0, rx: 0 };
  const now = Object.assign({}, target);
  const play = name => { if (name !== cur) { cur = name; since = 0; } };
  const update = dt => {
    t += dt;
    since += dt;
    const T = target;
    T.hop = 0; T.sway = 0; T.tilt = Math.sin(t * 1.3) * 0.06; T.nod = 0;
    T.lz = -0.14 - Math.sin(t * 2) * 0.03; T.rz = 0.14 + Math.sin(t * 2) * 0.03; T.lx = 0; T.rx = 0;
    const breathe = Math.sin(t * 2.2) * 0.008;
    if (cur === 'Wave') {
      T.rz = 2.45 + Math.sin(t * 9) * 0.35;
      T.tilt = -0.12;
    } else if (cur === 'ThumbsUp') {
      T.lz = -2.6 + Math.sin(t * 10) * 0.15;
      T.rz = 2.6 - Math.sin(t * 10) * 0.15;
      T.hop = Math.abs(Math.sin(t * 5.5)) * 0.07;
      T.nod = 0.12;
    } else if (cur === 'Dance') {
      const b = Math.sin(t * 5);
      T.sway = b * 0.14;
      T.lz = -1.3 - b * 0.9;
      T.rz = 1.3 - b * 0.9;
      T.hop = Math.abs(Math.sin(t * 10)) * 0.035;
      T.tilt = -b * 0.18;
    } else if (cur === 'Jump') {
      T.hop = since < 0.7 ? Math.sin(since / 0.7 * Math.PI) * 0.4 : Math.abs(Math.sin(t * 5.5)) * 0.05;
      T.lz = -2.7;
      T.rz = 2.7;
      T.nod = -0.1;
    }
    const k = Math.min(1, dt * 12);
    for (const key of Object.keys(T)) now[key] += (T[key] - now[key]) * (key === 'hop' ? 1 : k);
    body.position.y = now.hop + breathe;
    body.rotation.z = now.sway;
    head.rotation.z = now.tilt;
    head.rotation.x = -now.nod;
    arms[0].rotation.set(now.lx, 0, now.lz);
    arms[1].rotation.set(now.rx, 0, now.rz);
  };
  update(0);
  return { holder, play, update };
}
