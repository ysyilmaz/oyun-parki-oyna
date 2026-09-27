import * as THREE from 'three';
import { SPECIES } from './data.js';
import { M, part, merge } from './geo.js';

const G = {};
export function geos() {
  if (G.sphere) return G;
  G.sphere = new THREE.SphereGeometry(1, 28, 20);
  G.lowSphere = new THREE.SphereGeometry(1, 7, 5);
  G.cone = new THREE.ConeGeometry(1, 1, 18, 2);
  G.lowCone = new THREE.ConeGeometry(1, 1, 5, 1);
  G.capsule = new THREE.CapsuleGeometry(1, 1, 6, 14);
  G.torusArc = new THREE.TorusGeometry(1, 0.28, 8, 16, Math.PI);
  G.torus = new THREE.TorusGeometry(1, 0.3, 10, 26);
  return G;
}

const MATS = {};
export function mats() {
  if (MATS.body) return MATS;
  MATS.body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 });
  MATS.eye = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.6 });
  MATS.crystal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.25, flatShading: true, emissive: 0x4a6dff, emissiveIntensity: 0.35, envMapIntensity: 1.8 });
  MATS.gold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.95, envMapIntensity: 1.6 });
  MATS.rainbow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.12, envMapIntensity: 1.4 });
  return MATS;
}

const GOLD = new THREE.Color('#ffc62e');
const GOLD_DARK = new THREE.Color('#b8740a');
const _t = new THREE.Color();
const _hsl = {};

class Builder {
  constructor(variant, crystal) {
    this.body = [];
    this.eyes = [];
    this.wings = [];
    this.variant = variant;
    this.crystal = crystal;
  }
  sphere(color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, target) {
    const g = this.crystal && target !== 'eyes' ? geos().lowSphere : geos().sphere;
    this.add(g, color, M(x, y, z, rx, ry, rz, sx, sy, sz), target);
  }
  add(geo, color, matrix, target = 'body') {
    const v = this.variant;
    const fn = (c, x, y, z) => {
      c.set(color);
      if (target === 'eyes') return;
      if (v === 1) {
        c.getHSL(_hsl);
        c.copy(GOLD_DARK).lerp(GOLD, 0.35 + _hsl.l * 0.75);
      } else if (v === 2) {
        c.getHSL(_hsl);
        _t.setHSL((y * 0.55 + x * 0.25 + z * 0.15 + 10) % 1, 0.85, 0.5 + _hsl.l * 0.2);
        c.copy(_t);
      }
    };
    const p = part(geo, color, matrix, fn);
    (target === 'eyes' ? this.eyes : this.body).push(p);
  }
  eyes2(x, y, z, r = 0.1, look = 0) {
    for (const s of [-1, 1]) {
      this.sphere('#161a2e', s * x, y, z, r * 0.85, r * 1.1, r * 0.6, 0, s * 0.3, 0, 'eyes');
      this.sphere('#ffffff', s * x - r * 0.28 + look, y + r * 0.42, z + r * 0.5, r * 0.36, r * 0.36, r * 0.2, 0, 0, 0, 'eyes');
      this.sphere('#ffffff', s * x + r * 0.3 + look, y - r * 0.35, z + r * 0.5, r * 0.16, r * 0.16, r * 0.1, 0, 0, 0, 'eyes');
    }
  }
  blush(x, y, z, color = '#ff8fab') {
    for (const s of [-1, 1]) this.sphere(color, s * x, y, z, 0.085, 0.05, 0.03, 0, s * 0.55, 0);
  }
  mouth(y, z, w = 0.05, color = '#5a2a2a') {
    for (const s of [-1, 1]) this.add(geos().torusArc, color, M(s * w, y, z, 0, 0, Math.PI, w, w, w));
  }
  build() {
    const res = {};
    res.body = merge(this.body);
    res.eyes = this.eyes.length ? merge(this.eyes) : null;
    res.wings = this.wings;
    res.fly = !!this.fly;
    return res;
  }
}

function catLike(b, c, sp) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.42, 0, 0.42, 0.39, 0.44);
  b.sphere(belly, 0, 0.4, 0.2, 0.28, 0.28, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(belly, s * 0.2, 0.09, 0.22, 0.13, 0.09, 0.15);
    b.sphere(main, s * 0.22, 0.1, -0.2, 0.13, 0.1, 0.15);
  }
  b.sphere(main, 0, 1.0, 0.04, 0.54, 0.48, 0.5);
  b.sphere(belly, 0, 0.88, 0.4, 0.2, 0.13, 0.12);
  b.sphere(acc, 0, 0.95, 0.52, 0.055, 0.04, 0.035);
  b.eyes2(0.2, 1.07, 0.47, 0.125);
  b.blush(0.33, 0.92, 0.38);
  b.mouth(0.88, 0.52, 0.035);
  const ek = sp.ears || 1;
  for (const s of [-1, 1]) {
    b.add(geos().cone, main, M(s * 0.3, 1.47 + (ek - 1) * 0.16, 0, 0, 0, -s * 0.38, 0.17 * ek, 0.34 * ek, 0.14));
    b.add(geos().cone, acc, M(s * 0.29, 1.44 + (ek - 1) * 0.15, 0.05, 0, 0, -s * 0.38, 0.1 * ek, 0.22 * ek, 0.06));
    if (ek > 1) b.add(geos().cone, '#3a2a22', M(s * (0.3 + 0.2 * ek * 0.55), 1.47 + 0.34 * ek * 0.72 + (ek - 1) * 0.16, 0, 0, 0, -s * 0.38, 0.045, 0.2, 0.04));
  }
  if (sp.crystal) {
    for (let i = 0; i < 3; i++) b.add(geos().lowCone, acc, M(0, 0.78 - i * 0.18, -0.3 - i * 0.12, -0.5 - i * 0.25, 0, 0, 0.1 - i * 0.015, 0.34 - i * 0.06, 0.1 - i * 0.015));
  }
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.35, -0.36), new THREE.Vector3(0.05, 0.45, -0.62), new THREE.Vector3(0.12, 0.8, -0.7), new THREE.Vector3(0.05, 1.0, -0.58)]);
  const tube = new THREE.TubeGeometry(curve, 16, 0.075, 8, false);
  b.add(tube, main, null);
  b.sphere(sp.base === 'cat' ? acc : main, 0.05, 1.0, -0.58, 0.085);
  tube.dispose();
}

function dogLike(b, c) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.42, 0, 0.43, 0.4, 0.46);
  b.sphere(belly, 0, 0.4, 0.22, 0.28, 0.28, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(belly, s * 0.21, 0.09, 0.24, 0.14, 0.09, 0.16);
    b.sphere(main, s * 0.22, 0.1, -0.2, 0.13, 0.1, 0.15);
  }
  b.sphere(main, 0, 1.0, 0.02, 0.53, 0.49, 0.5);
  b.sphere(acc, 0.2, 1.1, 0.34, 0.17, 0.17, 0.12);
  b.sphere(belly, 0, 0.87, 0.42, 0.24, 0.16, 0.15);
  b.sphere('#1d1d28', 0, 0.94, 0.57, 0.075, 0.055, 0.05);
  b.eyes2(0.2, 1.08, 0.43, 0.1);
  b.blush(0.34, 0.92, 0.36);
  b.mouth(0.82, 0.54, 0.04);
  b.sphere('#ff6f8f', 0, 0.76, 0.52, 0.06, 0.07, 0.03, 0.3);
  for (const s of [-1, 1]) b.sphere(acc, s * 0.48, 1.02, 0.02, 0.13, 0.28, 0.08, 0, 0, s * 0.35);
  b.add(geos().capsule, main, M(0, 0.55, -0.43, -0.7, 0, 0, 0.07, 0.14, 0.07));
}

function bunnyLike(b, c) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.42, 0, 0.42, 0.4, 0.44);
  b.sphere(belly, 0, 0.4, 0.2, 0.28, 0.28, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(belly, s * 0.2, 0.09, 0.24, 0.13, 0.09, 0.18);
    b.sphere(main, s * 0.23, 0.12, -0.18, 0.16, 0.12, 0.18);
  }
  b.sphere(main, 0, 1.0, 0.03, 0.52, 0.47, 0.5);
  b.sphere(belly, 0, 0.88, 0.42, 0.18, 0.12, 0.12);
  b.sphere(acc, 0, 0.95, 0.52, 0.05, 0.035, 0.03);
  b.sphere('#ffffff', 0, 0.8, 0.5, 0.05, 0.06, 0.02);
  b.eyes2(0.2, 1.06, 0.43, 0.105);
  b.blush(0.33, 0.92, 0.36);
  for (const s of [-1, 1]) {
    b.add(geos().capsule, main, M(s * 0.17, 1.66, -0.03, -0.1, 0, -s * 0.15, 0.1, 0.36, 0.08));
    b.add(geos().capsule, acc, M(s * 0.17, 1.64, 0.03, -0.1, 0, -s * 0.15, 0.055, 0.28, 0.03));
  }
  b.sphere('#ffffff', 0, 0.42, -0.45, 0.14);
}

function bearLike(b, c, panda) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.43, 0, 0.45, 0.42, 0.46);
  b.sphere(panda ? main : belly, 0, 0.4, 0.22, 0.28, 0.28, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(panda ? acc : main, s * 0.22, 0.1, 0.22, 0.15, 0.11, 0.17);
    b.sphere(panda ? acc : main, s * 0.24, 0.12, -0.2, 0.15, 0.11, 0.16);
    b.sphere(panda ? acc : main, s * 0.36, 0.5, 0.18, 0.12, 0.18, 0.12, 0.5, 0, s * 0.5);
  }
  b.sphere(main, 0, 1.0, 0.03, 0.54, 0.49, 0.5);
  b.sphere(panda ? '#f4f4f4' : belly, 0, 0.87, 0.42, 0.21, 0.15, 0.14);
  b.sphere('#1d1d28', 0, 0.93, 0.55, 0.07, 0.05, 0.045);
  if (panda) for (const s of [-1, 1]) b.sphere(acc, s * 0.2, 1.06, 0.36, 0.15, 0.18, 0.11, 0, s * 0.3, s * 0.5);
  b.eyes2(0.2, 1.07, 0.43, 0.1);
  b.blush(0.34, 0.92, 0.35);
  b.mouth(0.83, 0.54, 0.035);
  for (const s of [-1, 1]) {
    b.sphere(panda ? acc : main, s * 0.36, 1.4, -0.02, 0.16, 0.16, 0.1);
    b.sphere(panda ? '#555566' : acc, s * 0.36, 1.4, 0.04, 0.09, 0.09, 0.06);
  }
  b.sphere(main, 0, 0.35, -0.44, 0.1);
}

function foxLike(b, c, fennec) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.42, 0, 0.41, 0.39, 0.45);
  b.sphere(belly, 0, 0.42, 0.22, 0.27, 0.3, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(fennec ? belly : acc, s * 0.2, 0.09, 0.22, 0.13, 0.09, 0.16);
    b.sphere(fennec ? main : acc, s * 0.22, 0.1, -0.2, 0.12, 0.1, 0.14);
  }
  b.sphere(main, 0, 1.0, 0.03, 0.53, 0.47, 0.5);
  b.sphere(belly, 0, 0.88, 0.4, 0.26, 0.16, 0.2);
  for (const s of [-1, 1]) b.sphere(belly, s * 0.26, 0.92, 0.3, 0.2, 0.14, 0.14);
  b.sphere('#1d1d28', 0, 0.93, 0.6, 0.06, 0.045, 0.04);
  b.eyes2(0.2, 1.08, 0.42, 0.1);
  b.blush(0.35, 0.95, 0.33);
  b.mouth(0.84, 0.55, 0.035);
  const er = fennec ? 0.27 : 0.2;
  const eh = fennec ? 0.62 : 0.42;
  for (const s of [-1, 1]) {
    b.add(geos().cone, main, M(s * 0.33, 1.42 + eh * 0.3, -0.02, 0, 0, -s * 0.45, er, eh, er * 0.6));
    b.add(geos().cone, fennec ? acc : belly, M(s * 0.32, 1.4 + eh * 0.28, 0.05, 0, 0, -s * 0.45, er * 0.55, eh * 0.7, er * 0.25));
    if (!fennec) b.add(geos().cone, acc, M(s * (0.33 + 0.08), 1.42 + eh * 0.68, -0.02, 0, 0, -s * 0.45, er * 0.35, eh * 0.25, er * 0.3));
  }
  if (fennec) {
    b.sphere(main, 0.04, 0.6, -0.6, 0.22, 0.22, 0.4, -0.8, 0.15, 0);
    b.sphere('#5a3b25', 0.07, 0.9, -0.82, 0.13, 0.13, 0.15, -0.8, 0.15, 0);
  } else {
    b.sphere(main, 0.05, 0.62, -0.58, 0.25, 0.25, 0.42, -0.8, 0.15, 0);
    b.sphere(belly, 0.08, 0.95, -0.82, 0.16, 0.16, 0.2, -0.8, 0.15, 0);
  }
}

function frogLike(b, c) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.38, 0, 0.46, 0.36, 0.44);
  b.sphere(belly, 0, 0.36, 0.2, 0.32, 0.26, 0.24);
  for (const s of [-1, 1]) {
    b.sphere(main, s * 0.36, 0.14, 0.12, 0.2, 0.12, 0.26);
    b.sphere(main, s * 0.25, 0.1, 0.34, 0.12, 0.07, 0.12);
  }
  b.sphere(main, 0, 0.9, 0.04, 0.6, 0.42, 0.5);
  b.sphere(belly, 0, 0.78, 0.26, 0.45, 0.2, 0.3);
  for (const s of [-1, 1]) b.sphere(main, s * 0.28, 1.24, 0.12, 0.2);
  b.eyes2(0.28, 1.26, 0.28, 0.12);
  b.blush(0.42, 0.88, 0.3, acc);
  b.add(geos().torusArc, '#b0304a', M(0, 0.86, 0.48, 0, 0, Math.PI, 0.16, 0.1, 0.1));
}

function penguinLike(b, c) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.55, 0, 0.44, 0.52, 0.42);
  b.sphere(belly, 0, 0.52, 0.16, 0.34, 0.44, 0.3);
  for (const s of [-1, 1]) {
    b.sphere(acc, s * 0.18, 0.05, 0.2, 0.14, 0.05, 0.2);
    b.sphere(main, s * 0.45, 0.6, 0, 0.08, 0.3, 0.16, 0, 0, s * 0.35);
  }
  b.sphere(main, 0, 1.12, 0.02, 0.48, 0.44, 0.46);
  for (const s of [-1, 1]) b.sphere(belly, s * 0.16, 1.1, 0.28, 0.2, 0.24, 0.16);
  b.add(geos().cone, acc, M(0, 1.02, 0.52, Math.PI / 2, 0, 0, 0.09, 0.2, 0.07));
  b.eyes2(0.17, 1.15, 0.41, 0.09);
  b.blush(0.3, 1.02, 0.35);
}

function unicornLike(b, c, sp) {
  const [main, belly, acc] = c;
  const mane = sp.mane;
  b.sphere(main, 0, 0.55, -0.05, 0.4, 0.36, 0.5);
  for (const s of [-1, 1]) {
    for (const f of [-1, 1]) {
      b.add(geos().capsule, main, M(s * 0.2, 0.25, f * 0.25 - 0.05, 0, 0, 0, 0.1, 0.18, 0.1));
      b.sphere(acc === '#ffd23f' ? '#c99a2e' : '#9aaccf', s * 0.2, 0.06, f * 0.25 - 0.05, 0.11, 0.07, 0.11);
    }
  }
  b.sphere(main, 0, 1.08, 0.18, 0.46, 0.44, 0.44);
  b.sphere(belly, 0, 0.95, 0.52, 0.26, 0.2, 0.2);
  for (const s of [-1, 1]) b.sphere('#e89ab8', s * 0.08, 0.98, 0.69, 0.03, 0.02, 0.02);
  b.eyes2(0.19, 1.13, 0.53, 0.1);
  b.blush(0.31, 0.99, 0.46);
  for (const s of [-1, 1]) b.add(geos().cone, main, M(s * 0.24, 1.5, 0.1, 0, 0, -s * 0.3, 0.09, 0.22, 0.07));
  if (!sp.noHorn) {
    const hornM = M(0, 1.66, 0.3, 0.35, 0, 0, 0.09, 0.5, 0.09);
    b.add(geos().cone, acc, hornM);
    b.add(geos().torus, '#fff3b0', new THREE.Matrix4().multiplyMatrices(M(0, 1.6, 0.28, 0.35 + Math.PI / 2, 0, 0), M(0, 0, 0, 0, 0, 0, 0.06, 0.06, 0.06)));
  } else {
    b.sphere(sp.mane[0], 0, 1.5, 0.3, 0.12, 0.1, 0.12);
  }
  if (sp.wing) featherWing(b, sp.wing, sp.wingTip, [0.24, 0.82, -0.12], 0.8);
  mane.forEach((mc, i) => {
    const t = i / (mane.length - 1);
    b.sphere(mc, 0, 1.45 - t * 0.55, -0.08 - t * 0.28, 0.16 - t * 0.03);
  });
  mane.forEach((mc, i) => b.sphere(mc, 0, 0.62 - i * 0.07, -0.58 - i * 0.07, 0.13, 0.13, 0.15));
}

function dragonLike(b, c, sp) {
  const [main, belly, acc] = c;
  b.sphere(main, 0, 0.45, 0, 0.43, 0.4, 0.47);
  b.sphere(belly, 0, 0.42, 0.22, 0.28, 0.3, 0.2);
  for (const s of [-1, 1]) {
    b.sphere(main, s * 0.22, 0.12, 0.2, 0.14, 0.12, 0.17);
    b.sphere(main, s * 0.24, 0.13, -0.2, 0.15, 0.12, 0.17);
    for (let k = 0; k < 3; k++) b.sphere('#ffffff', s * 0.22 + (k - 1) * 0.05, 0.06, 0.34, 0.03);
  }
  b.sphere(main, 0, 1.02, 0.06, 0.52, 0.46, 0.5);
  b.sphere(belly, 0, 0.9, 0.43, 0.27, 0.17, 0.18);
  for (const s of [-1, 1]) b.sphere('#1d1d28', s * 0.08, 0.95, 0.6, 0.025);
  b.eyes2(0.2, 1.1, 0.43, 0.105);
  b.blush(0.34, 0.95, 0.36);
  b.mouth(0.86, 0.58, 0.035);
  for (const s of [-1, 1]) {
    b.add(geos().cone, acc, M(s * 0.22, 1.5, -0.06, -0.4, 0, -s * 0.3, 0.08, 0.32, 0.08));
    b.add(geos().cone, main, M(s * 0.44, 1.18, 0, 0, 0, -s * 1.1, 0.08, 0.22, 0.05));
  }
  for (let i = 0; i < 4; i++) b.add(geos().cone, acc, M(0, 1.4 - i * 0.24, -0.38 - i * 0.05, -0.5 - i * 0.2, 0, 0, 0.07, 0.16, 0.07));
  const tailM = M(0, 0.32, -0.62, -Math.PI / 2 - 0.3, 0, 0, 0.16, 0.6, 0.16);
  b.add(geos().cone, main, tailM);
  b.add(geos().cone, acc, M(0, 0.24, -0.95, -Math.PI / 2 - 0.3, 0, 0, 0.1, 0.18, 0.04));
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.35, 0.45, 0.85, 0.55);
  shape.quadraticCurveTo(0.7, 0.35, 0.78, 0.18);
  shape.quadraticCurveTo(0.55, 0.12, 0.6, -0.05);
  shape.quadraticCurveTo(0.35, 0.0, 0.35, -0.2);
  shape.quadraticCurveTo(0.2, -0.05, 0, 0);
  const wg = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
  const wing = part(wg, sp.wing, null, (col) => {
    col.set(sp.wing);
    if (b.variant === 1) col.copy(GOLD);
    if (b.variant === 2) col.setHSL(Math.random(), 0.8, 0.6);
  });
  wg.dispose();
  b.wings.push({ geo: wing, pos: [0.18, 0.72, -0.2] });
}

function featherWing(b, color, tip, pos, size = 1) {
  const g = geos().sphere;
  const parts = [];
  const fn = (col, x) => {
    col.set(color);
    if (tip && x > 0.55 * size) col.set(tip);
    if (b.variant === 1) col.copy(GOLD).multiplyScalar(x > 0.55 * size ? 0.8 : 1);
    if (b.variant === 2) col.setHSL((x * 0.7 + 0.2) % 1, 0.85, 0.6);
  };
  parts.push(part(g, color, M(0.34 * size, 0.08 * size, 0, 0, 0, 0.25, 0.36 * size, 0.2 * size, 0.07), fn));
  parts.push(part(g, color, M(0.46 * size, -0.02 * size, 0.02, 0, 0, 0.05, 0.34 * size, 0.13 * size, 0.06), fn));
  parts.push(part(g, color, M(0.5 * size, -0.12 * size, 0.04, 0, 0, -0.18, 0.3 * size, 0.1 * size, 0.05), fn));
  b.wings.push({ geo: merge(parts), pos });
}

function birdLike(b, c, sp) {
  const [main, belly, face] = c;
  b.sphere(main, 0, 0.5, 0, 0.42, 0.44, 0.44);
  b.sphere(belly, 0, 0.45, 0.22, 0.28, 0.3, 0.2);
  b.sphere(main, 0, 1.0, 0.05, 0.46, 0.44, 0.44);
  b.sphere(face, 0, 0.98, 0.3, 0.32, 0.27, 0.2);
  b.sphere('#3a3a44', 0, 0.94, 0.5, 0.13, 0.12, 0.14);
  b.add(geos().cone, '#3a3a44', M(0, 0.8, 0.56, Math.PI - 0.35, 0, 0, 0.08, 0.16, 0.08));
  b.eyes2(0.2, 1.08, 0.42, 0.105);
  b.blush(0.32, 0.93, 0.36);
  for (let i = 0; i < 3; i++) b.sphere(main, 0, 1.42 + i * 0.04, -0.02 - i * 0.12, 0.09, 0.2 - i * 0.03, 0.08, -0.5 - i * 0.3);
  const tails = [sp.wing, sp.wingTip, sp.wing];
  tails.forEach((tc, i) => b.sphere(tc, (i - 1) * 0.1, 0.3, -0.55, 0.08, 0.08, 0.36, 0.7, (i - 1) * 0.25, 0));
  for (const s of [-1, 1]) b.sphere('#ffa33a', s * 0.14, 0.08, 0.12, 0.11, 0.06, 0.14);
  featherWing(b, sp.wing, sp.wingTip, [0.36, 0.62, -0.02], 0.95);
  b.fly = true;
}

function wadingBird(b, c, sp, long) {
  const [main, belly, beak] = c;
  b.sphere(main, 0, 0.62, -0.05, 0.4, 0.36, 0.48);
  b.sphere(belly, 0, 0.58, 0.14, 0.28, 0.28, 0.24);
  for (const s of [-1, 1]) {
    b.add(geos().capsule, beak, M(s * 0.12, 0.2, 0, 0, 0, 0, 0.045, 0.22, 0.045));
    b.sphere(beak, s * 0.12, 0.03, 0.06, 0.09, 0.04, 0.13);
  }
  const neck = new THREE.CatmullRomCurve3(long ? [new THREE.Vector3(0, 0.8, 0.18), new THREE.Vector3(0, 1.05, 0.05), new THREE.Vector3(0, 1.22, 0.22)] : [new THREE.Vector3(0, 0.82, 0.16), new THREE.Vector3(0, 1.08, 0.2)]);
  const tube = new THREE.TubeGeometry(neck, 12, 0.13, 10, false);
  b.add(tube, main, null);
  tube.dispose();
  const hy = long ? 1.36 : 1.24;
  b.sphere(main, 0, hy, 0.22, 0.34, 0.32, 0.32);
  b.eyes2(0.14, hy + 0.05, 0.47, 0.085);
  b.blush(0.24, hy - 0.07, 0.43);
  if (long) {
    b.sphere('#ffffff', 0, hy - 0.04, 0.52, 0.07, 0.06, 0.1);
    b.add(geos().cone, beak, M(0, hy - 0.15, 0.58, Math.PI - 0.6, 0, 0, 0.06, 0.2, 0.06));
  } else {
    b.add(geos().cone, beak, M(0, hy - 0.06, 0.72, Math.PI / 2 + 0.25, 0, 0, 0.075, 0.46, 0.06));
  }
  b.sphere(sp.wingTip, 0, 0.62, -0.5, 0.18, 0.12, 0.2, 0.4);
  featherWing(b, sp.wing, sp.wingTip, [0.32, 0.72, -0.08], 0.95);
  b.fly = true;
}

const BUILDERS = {
  bird: (b, c, sp) => birdLike(b, c, sp),
  flamingo: (b, c, sp) => wadingBird(b, c, sp, true),
  stork: (b, c, sp) => wadingBird(b, c, sp, false),
  pony: (b, c, sp) => unicornLike(b, c, sp),
  cat: (b, c, sp) => catLike(b, c, sp),
  dog: (b, c) => dogLike(b, c),
  bunny: (b, c) => bunnyLike(b, c),
  bear: (b, c) => bearLike(b, c, false),
  panda: (b, c) => bearLike(b, c, true),
  fox: (b, c) => foxLike(b, c, false),
  fennec: (b, c) => foxLike(b, c, true),
  frog: (b, c) => frogLike(b, c),
  penguin: (b, c) => penguinLike(b, c),
  unicorn: (b, c, sp) => unicornLike(b, c, sp),
  dragon: (b, c, sp) => dragonLike(b, c, sp),
};

function extras(b, sp) {
  if (!sp.extra) return;
  if (sp.extra === 'scarf') {
    b.add(geos().torus, sp.ex, M(0, 0.68, 0.02, Math.PI / 2 - 0.1, 0, 0, 0.36, 0.36, 0.36));
    b.sphere(sp.ex, 0.18, 0.55, 0.3, 0.08, 0.16, 0.05, 0.2, 0, 0.3);
  } else if (sp.extra === 'crown') {
    b.add(new THREE.CylinderGeometry(0.2, 0.17, 0.14, 12, 1, true), sp.ex, M(0, 1.5, 0.02));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(geos().cone, sp.ex, M(Math.cos(a) * 0.18, 1.62, Math.sin(a) * 0.18 + 0.02, 0, 0, 0, 0.05, 0.12, 0.05));
    }
    b.sphere('#ff3d6b', 0, 1.52, 0.22, 0.045);
  } else if (sp.extra === 'bow') {
    b.sphere(sp.ex, 0.32, 1.42, 0.1, 0.14, 0.1, 0.06, 0, 0, 0.5);
    b.sphere(sp.ex, 0.14, 1.5, 0.1, 0.14, 0.1, 0.06, 0, 0, -0.5);
    b.sphere(sp.ex, 0.23, 1.46, 0.13, 0.06);
  }
}

const cache = new Map();
function buildProcedural(spId, variant) {
  const key = spId + ':' + variant;
  if (cache.has(key)) return cache.get(key);
  const sp = SPECIES[spId];
  const b = new Builder(variant, !!sp.crystal && variant === 0);
  BUILDERS[sp.base](b, sp.c, sp);
  extras(b, sp);
  const r = b.build();
  cache.set(key, r);
  return r;
}

function materialFor(sp, variant) {
  const m = mats();
  if (variant === 1) return m.gold;
  if (variant === 2) return m.rainbow;
  if (sp.crystal) return m.crystal;
  return m.body;
}

let outlineMat = null;
function getOutlineMat() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: '#1d1b3a', side: THREE.BackSide });
  outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.035;');
  };
  return outlineMat;
}

export function createPetObject(spId, variant = 0, outline = false) {
  const sp = SPECIES[spId];
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const obj = { root, inner, wings: [], mixer: null, height: 1.6, flying: false };
  const geo = buildProcedural(spId, variant);
  const mat = materialFor(sp, variant);
  const body = new THREE.Mesh(geo.body, mat);
  inner.add(body);
  if (outline) inner.add(new THREE.Mesh(geo.body, getOutlineMat()));
  if (geo.eyes) {
    const e = new THREE.Mesh(geo.eyes, mats().eye);
    inner.add(e);
  }
  for (const w of geo.wings) {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * w.pos[0], w.pos[1], w.pos[2]);
      const m = new THREE.Mesh(w.geo, mat);
      m.scale.set(s, 1, 1);
      m.rotation.y = s * 0.0;
      pivot.add(m);
      pivot.rotation.y = s * -0.5;
      pivot.userData.side = s;
      inner.add(pivot);
      obj.wings.push(pivot);
    }
  }
  obj.height = 1.6;
  obj.flying = geo.fly;
  return obj;
}

let thumbRenderer = null;
let thumbEnv = null;
let thumbScene = null;
let thumbCam = null;
let thumbRT = null;
let thumbBuf = null;
let thumbCanvas = null;
const thumbCache = new Map();
const TS = 256;
const OUT = 160;

export function setPetThumbRenderer(renderer, env) {
  thumbRenderer = renderer;
  thumbEnv = env;
}

function initThumbs() {
  thumbScene = new THREE.Scene();
  thumbScene.environment = thumbEnv;
  thumbScene.environmentIntensity = 0.55;
  thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 2.6);
  d.position.set(2, 4, 5);
  thumbScene.add(d);
  thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  thumbRT = new THREE.WebGLRenderTarget(TS, TS, { type: THREE.FloatType });
  thumbBuf = new Float32Array(TS * TS * 4);
  thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbCanvas.height = TS;
}

function aces(r, g, b) {
  r /= 0.6;
  g /= 0.6;
  b /= 0.6;
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const ig = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const ib = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const f = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const fr = f(ir);
  const fg = f(ig);
  const fb = f(ib);
  return [1.60475 * fr - 0.53108 * fg - 0.07367 * fb, -0.10208 * fr + 1.10813 * fg - 0.00605 * fb, -0.00327 * fr - 0.07276 * fg + 1.07602 * fb];
}

function srgb(c) {
  c = Math.min(1, Math.max(0, c));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
}

export function petThumb(spId, variant = 0) {
  const key = spId + ':' + variant;
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbRenderer) return '';
  if (!thumbScene) initThumbs();
  const o = createPetObject(spId, variant);
  if (o.mixer) o.mixer.update(0.3);
  o.root.rotation.y = 0.45;
  thumbScene.add(o.root);
  o.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tb = new THREE.Box3();
  const vp = new THREE.Vector3();
  o.root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.morphTargetInfluences || m.isSkinnedMesh) {
      const n = m.geometry.attributes.position.count;
      const stepV = Math.max(1, Math.floor(n / 1500));
      for (let i = 0; i < n; i += stepV) {
        m.getVertexPosition(i, vp);
        box.expandByPoint(vp.applyMatrix4(m.matrixWorld));
      }
    } else {
      tb.setFromBufferAttribute(m.geometry.attributes.position).applyMatrix4(m.matrixWorld);
      box.union(tb);
    }
  });
  const c = new THREE.Vector3();
  const s = new THREE.Vector3();
  box.getCenter(c);
  box.getSize(s);
  const r = Math.max(s.x, s.y, s.z) * 0.62;
  const dist = r / Math.tan(THREE.MathUtils.degToRad(15));
  thumbCam.position.set(c.x + dist * 0.12, c.y + dist * 0.18, c.z + dist);
  thumbCam.lookAt(c);
  const R = thumbRenderer;
  const prevRT = R.getRenderTarget();
  const prevColor = new THREE.Color();
  R.getClearColor(prevColor);
  const prevAlpha = R.getClearAlpha();
  R.setRenderTarget(thumbRT);
  R.setClearColor(0x000000, 0);
  R.clear();
  R.render(thumbScene, thumbCam);
  R.readRenderTargetPixels(thumbRT, 0, 0, TS, TS, thumbBuf);
  R.setRenderTarget(prevRT);
  R.setClearColor(prevColor, prevAlpha);
  thumbScene.remove(o.root);
  const ctx = thumbCanvas.getContext('2d');
  const img = ctx.createImageData(TS, TS);
  const d = img.data;
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      const si = ((TS - 1 - y) * TS + x) * 4;
      const di = (y * TS + x) * 4;
      const a = Math.min(1, thumbBuf[si + 3]);
      if (a <= 0) {
        d[di + 3] = 0;
        continue;
      }
      const t = aces(thumbBuf[si] / a * 1.1, thumbBuf[si + 1] / a * 1.1, thumbBuf[si + 2] / a * 1.1);
      d[di] = srgb(t[0]);
      d[di + 1] = srgb(t[1]);
      d[di + 2] = srgb(t[2]);
      d[di + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = out.height = OUT;
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(thumbCanvas, 0, 0, OUT, OUT);
  const url = out.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
