import * as THREE from 'three';
import { M, part, merge } from './geo.js';
import { mats, geos } from './petModels.js';
import { damp } from './util.js';

const SKIN = '#ffd6b3';
const SUIT = '#2f7cff';
const SUIT_DARK = '#1f4fb8';
const PANTS = '#24346e';
const GOLDC = '#ffc21a';
const RED = '#ff3d4f';
const HAIR = '#5a3420';
const SHOE = '#ff3d4f';

let outlineMat = null;
function getOutlineMat() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: 0x1d1b3a, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.028;');
  };
  outlineMat.customProgramCacheKey = () => 'avatarOutline';
  return outlineMat;
}

let capeMat = null;
function getCapeMat() {
  if (capeMat) return capeMat;
  capeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  return capeMat;
}

function limb(parent, geo, eyesGeo, x, y, z, outline = true) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const m = new THREE.Mesh(geo, mats().body);
  m.castShadow = true;
  g.add(m);
  if (outline) {
    const o = new THREE.Mesh(geo, getOutlineMat());
    o.userData.outline = true;
    g.add(o);
  }
  if (eyesGeo) {
    const e = new THREE.Mesh(eyesGeo, mats().eye);
    g.add(e);
  }
  return g;
}

function gradient(c0, c1, y0, y1) {
  const a = new THREE.Color(c0);
  const b = new THREE.Color(c1);
  return (out, x, y) => out.copy(a).lerp(b, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
}

export function buildAvatar() {
  const G = geos();
  const S = G.sphere;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.74;
  root.add(hips);

  const legGeo = merge([
    part(G.capsule, PANTS, M(0, -0.26, 0, 0, 0, 0, 0.13, 0.2, 0.13)),
    part(S, SHOE, M(0, -0.6, 0.06, 0, 0, 0, 0.16, 0.11, 0.23)),
    part(S, '#ffffff', M(0, -0.66, 0.06, 0, 0, 0, 0.165, 0.04, 0.235)),
  ]);
  const legL = limb(hips, legGeo, null, 0.17, 0, 0);
  const legR = limb(hips, legGeo, null, -0.17, 0, 0);

  const torsoGeo = merge([
    part(S, null, M(0, 0.32, 0, 0, 0, 0, 0.38, 0.4, 0.31), gradient(SUIT_DARK, SUIT, 0, 0.6)),
    part(G.torus, GOLDC, M(0, 0.07, 0, Math.PI / 2, 0, 0, 0.33, 0.33, 0.2)),
    part(S, GOLDC, M(0, 0.07, 0.3, 0, 0, 0, 0.07, 0.06, 0.03)),
    part(S, GOLDC, M(0, 0.4, 0.27, 0, 0, 0, 0.14, 0.14, 0.05)),
    part(G.cone, RED, M(0, 0.4, 0.31, Math.PI / 2, 0, Math.PI, 0.07, 0.04, 0.12)),
    part(S, RED, M(0, 0.66, 0.02, 0, 0, 0, 0.2, 0.08, 0.17)),
  ]);
  const torso = limb(hips, torsoGeo, null, 0, 0, 0);

  const armGeo = merge([
    part(S, SUIT, M(0, -0.02, 0, 0, 0, 0, 0.13)),
    part(G.capsule, SUIT, M(0, -0.2, 0, 0, 0, 0, 0.1, 0.13, 0.1)),
    part(S, '#ffffff', M(0, -0.42, 0.01, 0, 0, 0, 0.12, 0.12, 0.12)),
  ]);
  const armL = limb(torso, armGeo, null, 0.42, 0.56, 0);
  const armR = limb(torso, armGeo, null, -0.42, 0.56, 0);

  const hairCap = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const band = new THREE.TorusGeometry(1.02, 0.09, 8, 40);
  const headParts = [
    part(S, SKIN, M(0, 0.44, 0, 0, 0, 0, 0.52, 0.49, 0.49)),
    part(hairCap, HAIR, M(0, 0.5, -0.05, -0.45, 0, 0, 0.555, 0.52, 0.53)),
    part(S, HAIR, M(0.22, 0.86, 0.14, 0.6, 0, -0.5, 0.13, 0.2, 0.1)),
    part(S, HAIR, M(0, 0.9, 0.16, 0.7, 0, 0, 0.14, 0.22, 0.1)),
    part(S, HAIR, M(-0.22, 0.86, 0.14, 0.6, 0, 0.5, 0.13, 0.2, 0.1)),
    part(band, RED, M(0, 0.63, 0.02, Math.PI / 2 - 0.3, 0, 0, 0.5, 0.5, 0.5)),
    part(S, RED, M(0.05, 0.62, -0.5, 0.3, 0.4, 0, 0.1, 0.06, 0.16)),
    part(S, RED, M(-0.06, 0.58, -0.52, 0.5, -0.4, 0, 0.09, 0.05, 0.15)),
    part(S, '#ffb49a', M(0, 0.36, 0.48, 0, 0, 0, 0.06, 0.05, 0.04)),
  ];
  for (const s of [-1, 1]) {
    headParts.push(part(S, '#ff9fb0', M(s * 0.3, 0.3, 0.38, 0, s * 0.55, 0, 0.09, 0.055, 0.03)));
    headParts.push(part(S, SKIN, M(s * 0.5, 0.42, 0, 0, 0, 0, 0.08, 0.11, 0.07)));
    headParts.push(part(G.torusArc, '#c0504a', M(s * 0.035, 0.22, 0.475, 0.2, 0, Math.PI, 0.035, 0.035, 0.03)));
  }
  const headGeo = merge(headParts);
  hairCap.dispose();
  band.dispose();
  const eyeParts = [];
  for (const s of [-1, 1]) {
    eyeParts.push(part(S, '#161a2e', M(s * 0.18, 0.46, 0.43, 0, s * 0.3, 0, 0.095, 0.13, 0.06)));
    eyeParts.push(part(S, '#ffffff', M(s * 0.18 - 0.03, 0.51, 0.49, 0, 0, 0, 0.035, 0.035, 0.02)));
    eyeParts.push(part(S, '#ffffff', M(s * 0.18 + 0.03, 0.42, 0.49, 0, 0, 0, 0.018, 0.018, 0.01)));
  }
  const eyeGeo = merge(eyeParts);
  const head = limb(torso, headGeo, eyeGeo, 0, 0.72, 0);

  const capeGeo = new THREE.PlaneGeometry(0.78, 0.95, 6, 8);
  const cp = capeGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const t = (0.475 - y) / 0.95;
    cp.setX(i, x * (0.75 + t * 0.45));
    cp.setZ(i, -Math.abs(x) * 0.25 - t * 0.12);
    cp.setY(i, y - 0.475);
  }
  capeGeo.computeVertexNormals();
  const capeFinal = part(capeGeo, null, null, gradient('#c81e3a', RED, -0.95, 0));
  capeGeo.dispose();
  const cape = new THREE.Group();
  cape.position.set(0, 0.66, -0.27);
  torso.add(cape);
  const capeMesh = new THREE.Mesh(capeFinal, getCapeMat());
  capeMesh.castShadow = true;
  cape.add(capeMesh);

  root.traverse((o) => {
    if (o.isMesh) o.renderOrder = 10;
  });
  return { root, hips, torso, head, armL, armR, legL, legR, cape };
}

const REST = { hipsY: 0.74 };

export class AvatarAnimator {
  constructor(rig) {
    this.r = rig;
    this.phase = 0;
    this.t = 0;
    this.j = {};
  }

  set(obj, prop, target, lambda, dt) {
    obj[prop] = damp(obj[prop], target, lambda, dt);
  }

  update(dt, s) {
    const r = this.r;
    this.t += dt;
    const t = this.t;
    let legL = 0;
    let legR = 0;
    let armLx = 0;
    let armRx = 0;
    let armLz = 0.12;
    let armRz = -0.12;
    let lean = 0;
    let twist = 0;
    let headX = Math.sin(t * 0.9) * 0.04;
    let headZ = 0;
    let bob = Math.sin(t * 2.2) * 0.015;
    let capeX = 0.15 + Math.sin(t * 1.7) * 0.05;
    let spin = 0;
    const lam = 14;
    if (s.name === 'run') {
      this.phase += dt * (6 + s.speed * 0.9);
      const p = Math.sin(this.phase);
      legL = p * 0.9;
      legR = -p * 0.9;
      armLx = -p * 0.8;
      armRx = p * 0.8;
      armLz = 0.2;
      armRz = -0.2;
      lean = 0.16;
      bob = Math.abs(Math.cos(this.phase)) * 0.09;
      capeX = 0.55 + Math.abs(p) * 0.2;
    } else if (s.name === 'jump') {
      legL = -0.7;
      legR = 0.3;
      armLx = -0.4;
      armRx = -0.4;
      armLz = 1.9;
      armRz = -1.9;
      capeX = 0.9;
    } else if (s.name === 'punch') {
      const k = Math.sin(Math.min(1, s.t / 0.36) * Math.PI);
      armRx = -1.55 * k;
      armRz = -0.1;
      armLx = 0.5 * k;
      twist = -0.35 * k;
      lean = 0.1 * k;
    } else if (s.name === 'Dance') {
      const p = s.t * 7;
      armLz = 2.4 + Math.sin(p) * 0.4;
      armRz = -2.4 + Math.sin(p + 1) * 0.4;
      legL = Math.sin(p) * 0.3;
      legR = -Math.sin(p) * 0.3;
      bob = Math.abs(Math.sin(p)) * 0.12;
      spin = s.t * 4;
      headZ = Math.sin(p) * 0.15;
      capeX = 0.6;
    } else if (s.name === 'ThumbsUp') {
      armRx = -2.7;
      armRz = -0.2;
      armLz = 0.3;
      headZ = 0.12;
      bob = Math.abs(Math.sin(s.t * 6)) * 0.05;
    } else if (s.name === 'Yes') {
      headX = Math.sin(s.t * 12) * 0.25;
      armLz = 0.5;
      armRz = -0.5;
      bob = Math.abs(Math.sin(s.t * 8)) * 0.05;
    }
    const fast = s.name === 'punch' ? 30 : lam;
    this.set(r.legL.rotation, 'x', legL, lam, dt);
    this.set(r.legR.rotation, 'x', legR, lam, dt);
    this.set(r.armL.rotation, 'x', armLx, fast, dt);
    this.set(r.armR.rotation, 'x', armRx, fast, dt);
    this.set(r.armL.rotation, 'z', armLz, lam, dt);
    this.set(r.armR.rotation, 'z', armRz, lam, dt);
    this.set(r.torso.rotation, 'x', lean, 10, dt);
    this.set(r.torso.rotation, 'y', twist, fast, dt);
    this.set(r.head.rotation, 'x', headX, 12, dt);
    this.set(r.head.rotation, 'z', headZ, 10, dt);
    this.set(r.cape.rotation, 'x', capeX, 8, dt);
    r.cape.rotation.z = Math.sin(t * 3.1) * 0.06;
    this.set(r.hips.position, 'y', REST.hipsY + bob, 18, dt);
    r.root.rotation.y = spin;
    const breathe = 1 + Math.sin(t * 2.2) * 0.012;
    r.torso.scale.set(1, breathe, 1);
  }
}
