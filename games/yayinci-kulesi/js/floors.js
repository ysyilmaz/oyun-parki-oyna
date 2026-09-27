import * as THREE from 'three';
import { M, part, merge, rbox, vcMat, vcGloss, vcMetal, vcGlow, instanced, shadeY } from './geo.js';
import { H, ROOM, WALL_T, FRONT_DOOR, ELEV, STATIONS, PAD_OFF, stationLocal } from './layout.js';
import { THEMES, RARITIES } from './data.js';
import { floorTex, posterTex, neonText, floorNumberTex, glowTex, ringTex } from './textures.js';
import { ScreenAtlas } from './screens.js';

const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const CYL = (a, b, h, s = 20) => new THREE.CylinderGeometry(a, b, h, s);

const glassMat = new THREE.MeshStandardMaterial({ color: '#cfeeff', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.6 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#c9d0de', roughness: 0.35, metalness: 0.6 });
const darkFrame = new THREE.MeshStandardMaterial({ color: '#2a2e3d', roughness: 0.4, metalness: 0.4 });

const deskGeoCache = {};
function deskGeo() {
  if (deskGeoCache.desk) return deskGeoCache.desk;
  const p = [];
  p.push(part(rbox(2.5, 0.1, 0.95, 0.04), '#dfe4ee', M(0, 0.92, 0.95)));
  p.push(part(rbox(2.3, 0.78, 0.08, 0.03), '#2b2f40', M(0, 0.5, 1.3)));
  for (const s of [-1, 1]) p.push(part(rbox(0.1, 0.86, 0.8, 0.03), '#2b2f40', M(s * 1.15, 0.45, 0.95)));
  p.push(part(rbox(0.9, 0.04, 0.3, 0.015), '#1c1f2b', M(-0.2, 0.99, 0.95)));
  p.push(part(rbox(0.16, 0.03, 0.22, 0.02), '#1c1f2b', M(0.55, 0.985, 0.95)));
  p.push(part(CYL(0.02, 0.02, 0.5, 8), '#1c1f2b', M(0.85, 1.2, 0.8, 0.3, 0, 0)));
  p.push(part(CYL(0.06, 0.06, 0.18, 12), '#3a3f55', M(0.85, 1.45, 0.72, 0.9, 0, 0)));
  p.push(part(rbox(3.5, 2.1, 0.14, 0.06), '#15171f', M(0, 2.85, -1.5)));
  p.push(part(rbox(0.2, 1.9, 0.12, 0.04), '#2b2f40', M(0, 1.0, -1.6)));
  p.push(part(rbox(1.2, 0.06, 0.6, 0.03), '#2b2f40', M(0, 0.2, -1.6)));
  deskGeoCache.desk = merge(p);
  return deskGeoCache.desk;
}

function platformGeo() {
  if (deskGeoCache.plat) return deskGeoCache.plat;
  deskGeoCache.plat = merge([part(rbox(4.0, 0.16, 3.5, 0.08), '#ffffff', M(0, 0.08, -0.3))]);
  return deskGeoCache.plat;
}

function rimGeo() {
  if (deskGeoCache.rim) return deskGeoCache.rim;
  const p = [];
  const t = 0.07;
  p.push(part(new THREE.BoxGeometry(4.08, t, t), '#ffffff', M(0, 0.17, 1.46)));
  p.push(part(new THREE.BoxGeometry(4.08, t, t), '#ffffff', M(0, 0.17, -2.06)));
  p.push(part(new THREE.BoxGeometry(t, t, 3.58), '#ffffff', M(2.04, 0.17, -0.3)));
  p.push(part(new THREE.BoxGeometry(t, t, 3.58), '#ffffff', M(-2.04, 0.17, -0.3)));
  p.push(part(new THREE.BoxGeometry(3.5, 0.06, 0.05), '#ffffff', M(0, 0.95, 1.43)));
  deskGeoCache.rim = merge(p);
  return deskGeoCache.rim;
}

function ringStandGeo() {
  if (deskGeoCache.rs) return deskGeoCache.rs;
  const p = [];
  p.push(part(CYL(0.025, 0.025, 1.7, 8), '#2b2f40', M(-1.75, 0.95, 0.35)));
  for (let i = 0; i < 3; i++) p.push(part(CYL(0.02, 0.02, 0.5, 6), '#2b2f40', M(-1.75 + Math.cos(i * 2.1) * 0.18, 0.18, 0.35 + Math.sin(i * 2.1) * 0.18, Math.sin(i * 2.1) * 0.6, 0, -Math.cos(i * 2.1) * 0.6)));
  p.push(part(new THREE.TorusGeometry(0.34, 0.05, 8, 28), '#2b2f40', M(-1.75, 1.95, 0.35, 0, 0.9, 0)));
  p.push(part(CYL(0.025, 0.025, 1.3, 8), '#2b2f40', M(1.65, 0.65, 1.0)));
  for (let i = 0; i < 3; i++) p.push(part(CYL(0.02, 0.02, 0.6, 6), '#2b2f40', M(1.65 + Math.cos(i * 2.1) * 0.2, 0.2, 1.0 + Math.sin(i * 2.1) * 0.2, Math.sin(i * 2.1) * 0.6, 0, -Math.cos(i * 2.1) * 0.6)));
  p.push(part(rbox(0.36, 0.26, 0.3, 0.05), '#20222c', M(1.65, 1.42, 1.0, 0, -0.5, 0)));
  p.push(part(CYL(0.1, 0.1, 0.16, 16), '#3a3f55', M(1.56, 1.42, 0.86, Math.PI / 2, -0.5, 0, 1, 1, 1)));
  p.push(part(S(0.07, 12, 8), '#0a0a12', M(1.53, 1.42, 0.8)));
  deskGeoCache.rs = merge(p);
  return deskGeoCache.rs;
}

function ringLightGeo() {
  if (deskGeoCache.rl) return deskGeoCache.rl;
  deskGeoCache.rl = merge([part(new THREE.TorusGeometry(0.34, 0.03, 6, 28), '#fff6e8', M(-1.75, 1.95, 0.35, 0, 0.9, 0)), part(S(0.03, 8, 6), '#ff3040', M(1.78, 1.54, 0.95))]);
  return deskGeoCache.rl;
}

function padGeo() {
  if (deskGeoCache.pad) return deskGeoCache.pad;
  deskGeoCache.pad = merge([part(CYL(1.05, 1.1, 0.1, 40), '#2a2e3d', M(0, 0.05, 0))]);
  return deskGeoCache.pad;
}

function padGlowGeo() {
  if (deskGeoCache.pg) return deskGeoCache.pg;
  deskGeoCache.pg = merge([part(new THREE.RingGeometry(0.72, 0.92, 40), '#ffffff', M(0, 0.105, 0, -Math.PI / 2, 0, 0)), part(new THREE.CircleGeometry(0.5, 32), '#ffffff', M(0, 0.104, 0, -Math.PI / 2, 0, 0))]);
  return deskGeoCache.pg;
}

function coinGeo() {
  if (deskGeoCache.coin) return deskGeoCache.coin;
  deskGeoCache.coin = merge([part(CYL(0.2, 0.2, 0.07, 18), '#ffc21a', null, (o, x, y) => o.set(y > 0.03 ? '#ffd84a' : '#e39a00'))]);
  return deskGeoCache.coin;
}

function plantGeo() {
  if (deskGeoCache.plant) return deskGeoCache.plant;
  const p = [part(CYL(0.36, 0.28, 0.6, 18), '#f4f6fb', M(0, 0.3, 0)), part(CYL(0.33, 0.33, 0.04, 18), '#5a3a22', M(0, 0.58, 0))];
  const leaf = new THREE.SphereGeometry(0.3, 10, 8);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = i < 3 ? 0.05 : 0.28;
    p.push(part(leaf, i % 2 ? '#3fae4a' : '#56c95a', M(Math.cos(a) * r, 0.9 + (i < 3 ? 0.55 : 0.2 + (i % 3) * 0.15), Math.sin(a) * r, a, a, 0.6, 0.55, 1.5, 0.4)));
  }
  deskGeoCache.plant = merge(p);
  return deskGeoCache.plant;
}

function beanGeo() {
  if (deskGeoCache.bean) return deskGeoCache.bean;
  const g = S(0.8, 22, 16);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setY(i, y < 0 ? y * 0.35 : y * 0.7 - Math.max(0, pos.getZ(i)) * 0.3);
  }
  g.computeVertexNormals();
  deskGeoCache.bean = merge([part(g, '#ffffff', M(0, 0.32, 0), shadeY(0, 0.8, '#ffffff', 0.75))]);
  return deskGeoCache.bean;
}

function themeProp(theme) {
  const p = [];
  const glow = [];
  const id = theme.id;
  if (id === 'gaming') {
    p.push(part(rbox(1.3, 2.4, 1.1, 0.08), '#2b1f5a', M(0, 1.2, 0)));
    p.push(part(rbox(1.2, 0.5, 0.9, 0.05), '#1a1433', M(0, 1.2, 0.35, -0.5, 0, 0)));
    glow.push(part(new THREE.PlaneGeometry(0.95, 0.75), '#34f0ff', M(0, 1.85, 0.56, -0.12, 0, 0)));
    glow.push(part(S(0.07, 10, 8), '#ff3cf0', M(-0.2, 1.38, 0.62)));
    glow.push(part(S(0.07, 10, 8), '#ffd23a', M(0.15, 1.38, 0.62)));
    glow.push(part(rbox(1.34, 0.12, 1.14, 0.03), '#ff3cf0', M(0, 2.45, 0)));
  } else if (id === 'cooking') {
    p.push(part(rbox(3.2, 0.95, 1.2, 0.06), '#ffffff', M(0, 0.48, 0)));
    p.push(part(rbox(3.3, 0.08, 1.3, 0.03), '#ff6b3c', M(0, 0.99, 0)));
    p.push(part(CYL(0.28, 0.26, 0.3, 18), '#c9ccd8', M(-0.8, 1.18, 0)));
    p.push(part(CYL(0.22, 0.2, 0.2, 18), '#ff4a4a', M(0.3, 1.13, 0.1)));
    p.push(part(CYL(0.02, 0.02, 0.4, 6), '#3a2418', M(0.62, 1.15, 0.1, 0, 0, Math.PI / 2)));
    for (let i = 0; i < 3; i++) p.push(part(S(0.12, 10, 8), ['#ff3b3b', '#ffd23a', '#35c96b'][i], M(1.1 + i * 0.22, 1.1, -0.2)));
  } else if (id === 'sports') {
    const post = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10);
    p.push(part(post, '#ffffff', M(-1.8, 1.1, 0)));
    p.push(part(post, '#ffffff', M(1.8, 1.1, 0)));
    p.push(part(new THREE.CylinderGeometry(0.06, 0.06, 3.7, 10), '#ffffff', M(0, 2.2, 0, 0, 0, Math.PI / 2)));
    const net = new THREE.PlaneGeometry(3.6, 2.1, 12, 8);
    p.push(part(net, '#dfe6f0', M(0, 1.1, -0.6, -0.3, 0, 0)));
    const g = new THREE.IcosahedronGeometry(0.3, 1);
    p.push(part(g, '#ffffff', M(1.2, 0.3, 1.2)));
  } else if (id === 'music') {
    for (const s of [-1, 1]) {
      p.push(part(rbox(0.9, 1.8, 0.8, 0.05), '#16161c', M(s * 1.6, 0.9, 0)));
      p.push(part(CYL(0.3, 0.3, 0.05, 24), '#2a2a33', M(s * 1.6, 1.2, 0.41, Math.PI / 2, 0, 0)));
      p.push(part(CYL(0.16, 0.16, 0.05, 20), '#2a2a33', M(s * 1.6, 0.55, 0.41, Math.PI / 2, 0, 0)));
      glow.push(part(new THREE.TorusGeometry(0.31, 0.02, 6, 24), '#ffcc33', M(s * 1.6, 1.2, 0.44)));
    }
    p.push(part(CYL(0.45, 0.45, 0.5, 24), '#ff2e63', M(0, 0.45, 0, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.44, 0.44, 0.52, 24), '#f4f4f8', M(0, 0.45, 0, Math.PI / 2, 0, 0, 0.98, 1, 0.98)));
    p.push(part(CYL(0.3, 0.3, 0.12, 20), '#ffcc33', M(0.6, 1.05, 0.2, 0.3, 0, 0)));
  } else if (id === 'space') {
    p.push(part(CYL(0.55, 0.6, 2.6, 24), '#f4f6fb', M(0, 1.6, 0)));
    p.push(part(new THREE.ConeGeometry(0.55, 1.1, 24), '#ff4a4a', M(0, 3.45, 0)));
    for (let i = 0; i < 3; i++) p.push(part(rbox(0.1, 1.0, 0.7, 0.03), '#ff4a4a', M(Math.cos(i * 2.1) * 0.6, 0.7, Math.sin(i * 2.1) * 0.6, 0, -i * 2.1, 0)));
    p.push(part(CYL(0.22, 0.22, 0.05, 20), '#2a3a6a', M(0, 2.3, 0.56, Math.PI / 2, 0, 0)));
    glow.push(part(CYL(0.17, 0.17, 0.02, 20), '#7df9ff', M(0, 2.3, 0.59, Math.PI / 2, 0, 0)));
    glow.push(part(new THREE.ConeGeometry(0.4, 0.5, 16), '#ffb13b', M(0, 0.05, 0, Math.PI, 0, 0)));
  } else if (id === 'candy') {
    p.push(part(CYL(0.07, 0.07, 2.6, 10), '#ffffff', M(0, 1.3, 0)));
    const sw = new THREE.CylinderGeometry(0.9, 0.9, 0.2, 40);
    p.push(part(sw, '#ff5fb8', M(0, 2.9, 0, Math.PI / 2, 0, 0), (o, x, y, z) => o.set(Math.floor((Math.atan2(z, x) + Math.PI) * 3 + Math.hypot(x, z) * 8) % 2 ? '#ff5fb8' : '#ffffff')));
    for (let i = 0; i < 4; i++) p.push(part(S(0.3, 14, 10), ['#35d6ff', '#ffd23a', '#9aff5a', '#ff5fb8'][i], M(Math.cos(i * 1.6) * 1.2, 0.3, Math.sin(i * 1.6) * 1.2)));
  }
  return { body: merge(p), glow: glow.length ? merge(glow) : null };
}

export class Floor {
  constructor(index, sceneRoot) {
    this.index = index;
    this.theme = THEMES[index % THEMES.length];
    this.group = new THREE.Group();
    this.group.position.y = index * H;
    this.shell = new THREE.Group();
    this.interior = new THREE.Group();
    this.cut = new THREE.Group();
    this.group.add(this.shell, this.interior, this.cut);
    sceneRoot.add(this.group);
    this.atlas = new ScreenAtlas();
    this.creators = new Array(8).fill(null);
    this.coinLevel = new Array(8).fill(-1);
    this.buildShell();
    this.buildStations();
    this.buildDecor();
  }

  buildShell() {
    const th = this.theme;
    const f = this.index;
    const w = ROOM.x1 - ROOM.x0;
    const d = ROOM.z1 - ROOM.z0;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorTex(th), roughness: th.id === 'music' ? 0.45 : 0.6, metalness: 0.05 }));
    top.material.map.repeat.set(w / 4, d / 4);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    top.position.set(0, 0.001, 0);
    this.shell.add(top);
    const slab = merge([
      part(new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), '#e8ebf2', M(0, -0.3, 0)),
      part(new THREE.BoxGeometry(w + 1.24, 0.12, d + 1.24), th.accent, M(0, -0.18, 0)),
    ]);
    const slabM = new THREE.Mesh(slab, vcMat);
    slabM.receiveShadow = true;
    this.shell.add(slabM);
    const t = WALL_T;
    const wallC = (y0, y1) => shadeY(y0, y1, th.wall, 0.78);
    const walls = [
      part(new THREE.BoxGeometry(w + t, H, t), th.wall, M(0, H / 2, ROOM.z0), wallC(0, H)),
      part(new THREE.BoxGeometry(t, H, ELEV.door0 - ROOM.z0), th.wall, M(ROOM.x0, H / 2, (ELEV.door0 + ROOM.z0) / 2), wallC(0, H)),
      part(new THREE.BoxGeometry(t, H, ROOM.z1 - ELEV.door1), th.wall, M(ROOM.x0, H / 2, (ROOM.z1 + ELEV.door1) / 2), wallC(0, H)),
      part(new THREE.BoxGeometry(t, H - 3.2, ELEV.door1 - ELEV.door0), th.wall, M(ROOM.x0, 3.2 + (H - 3.2) / 2, (ELEV.door0 + ELEV.door1) / 2), wallC(0, H)),
      part(new THREE.BoxGeometry(t, 1.1, d), th.wall2, M(ROOM.x1, 0.55, 0)),
    ];
    const wm = new THREE.Mesh(merge(walls), vcMat);
    wm.receiveShadow = true;
    this.shell.add(wm);
    const upperR = new THREE.Mesh(merge([part(new THREE.BoxGeometry(t, H - 1.1, d), th.wall, M(ROOM.x1, 1.1 + (H - 1.1) / 2, 0), wallC(0, H))]), vcMat);
    upperR.receiveShadow = true;
    this.cut.add(upperR);
    const fac = '#2c2f5e';
    const ext = merge([
      part(new THREE.BoxGeometry(w + t + 0.3, H, 0.12), fac, M(0, H / 2, ROOM.z0 - t / 2 - 0.06), shadeY(0, H, fac, 0.75)),
      part(new THREE.BoxGeometry(0.12, H, d + t), fac, M(ROOM.x1 + t / 2 + 0.06, H / 2, 0), shadeY(0, H, fac, 0.75)),
      part(new THREE.BoxGeometry(0.12, H, d + t), fac, M(ROOM.x0 - t / 2 - 0.06, H / 2, 0), shadeY(0, H, fac, 0.75)),
      part(new THREE.BoxGeometry(0.16, 0.35, d + t + 0.1), th.accent, M(ROOM.x1 + t / 2 + 0.1, H - 0.9, 0)),
      part(new THREE.BoxGeometry(0.16, 0.35, d + t + 0.1), th.accent, M(ROOM.x0 - t / 2 - 0.1, H - 0.9, 0)),
    ]);
    const extM = new THREE.Mesh(ext, vcMat);
    this.shellOuter = extM;
    this.cut.add(extM);
    const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.led).multiplyScalar(2.2) });
    const led2Mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(th.led2).multiplyScalar(2.2) });
    const leds = merge([
      part(new THREE.BoxGeometry(w, 0.07, 0.07), '#fff', M(0, 0.1, ROOM.z0 + t / 2 + 0.04)),
      part(new THREE.BoxGeometry(0.07, 0.07, ELEV.door0 - ROOM.z0), '#fff', M(ROOM.x0 + t / 2 + 0.04, 0.1, (ELEV.door0 + ROOM.z0) / 2)),
      part(new THREE.BoxGeometry(0.07, 0.07, ROOM.z1 - ELEV.door1), '#fff', M(ROOM.x0 + t / 2 + 0.04, 0.1, (ROOM.z1 + ELEV.door1) / 2)),
      part(new THREE.BoxGeometry(0.07, 0.07, d), '#fff', M(ROOM.x1 - t / 2 - 0.04, 1.12, 0)),
    ]);
    this.shell.add(new THREE.Mesh(leds, ledMat));
    const ledsTop = merge([
      part(new THREE.BoxGeometry(w, 0.08, 0.08), '#fff', M(0, H - 0.25, ROOM.z0 + t / 2 + 0.05)),
      part(new THREE.BoxGeometry(0.08, 0.08, d), '#fff', M(ROOM.x0 + t / 2 + 0.05, H - 0.25, 0)),
    ]);
    this.shell.add(new THREE.Mesh(ledsTop, led2Mat));
    const frontLow = [];
    const frontGlass = [];
    const segs = f === 0 ? [[ROOM.x0, FRONT_DOOR.x0], [FRONT_DOOR.x1, ROOM.x1]] : [[ROOM.x0, ROOM.x1]];
    for (const [a, b] of segs) {
      frontGlass.push(part(new THREE.BoxGeometry(b - a, 1.05, 0.05), '#fff', M((a + b) / 2, 0.55, ROOM.z1)));
      frontLow.push(part(rbox(b - a, 0.1, 0.18, 0.04), '#fff', M((a + b) / 2, 1.1, ROOM.z1)));
      frontLow.push(part(new THREE.BoxGeometry(b - a, 0.12, 0.2), '#fff', M((a + b) / 2, 0.06, ROOM.z1)));
      for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 3))) frontLow.push(part(new THREE.BoxGeometry(0.08, 1.1, 0.08), '#fff', M(x, 0.55, ROOM.z1)));
    }
    const fg = new THREE.Mesh(merge(frontGlass), glassMat);
    fg.renderOrder = 2;
    this.shell.add(fg, new THREE.Mesh(merge(frontLow), frameMat));
    const upperGlass = new THREE.Mesh(merge([part(new THREE.BoxGeometry(w, H - 1.15, 0.05), '#fff', M(0, 1.15 + (H - 1.15) / 2, ROOM.z1))]), glassMat);
    upperGlass.renderOrder = 2;
    const mull = [];
    for (let i = 0; i <= 8; i++) mull.push(part(rbox(0.22, H - 1.1, 0.3, 0.05), '#fff', M(ROOM.x0 + (i * w) / 8, 1.1 + (H - 1.1) / 2, ROOM.z1)));
    mull.push(part(rbox(w + 0.3, 0.3, 0.34, 0.05), '#fff', M(0, H - 0.15, ROOM.z1)));
    for (let i = 0; i <= 4; i++) mull.push(part(rbox(0.22, H - 1.1, 0.3, 0.05), '#fff', M(ROOM.x1 + 0.1, 1.1 + (H - 1.1) / 2, ROOM.z0 + (i * d) / 4)));
    this.cut.add(upperGlass, new THREE.Mesh(merge(mull), frameMat));
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e0').multiplyScalar(1.3) });
    const pan = [];
    for (let x = -12; x <= 12; x += 8) for (let z = -6; z <= 6; z += 6) pan.push(part(new THREE.BoxGeometry(3.6, 0.06, 0.9), '#fff', M(x, H - 0.35, z)));
    this.cut.add(new THREE.Mesh(merge(pan), panelMat));
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: floorNumberTex(f + 1, th.led), color: new THREE.Color(1.3, 1.3, 1.3) }));
    ind.position.set(ROOM.x0 + t / 2 + 0.03, 3.8, (ELEV.door0 + ELEV.door1) / 2);
    ind.rotation.y = Math.PI / 2;
    this.shell.add(ind);
    const doorFrame = merge([
      part(rbox(0.3, 3.3, 0.3, 0.06), '#fff', M(ROOM.x0 + 0.05, 1.6, ELEV.door0)),
      part(rbox(0.3, 3.3, 0.3, 0.06), '#fff', M(ROOM.x0 + 0.05, 1.6, ELEV.door1)),
      part(rbox(0.3, 0.3, ELEV.door1 - ELEV.door0 + 0.3, 0.06), '#fff', M(ROOM.x0 + 0.05, 3.25, (ELEV.door0 + ELEV.door1) / 2)),
    ]);
    this.shell.add(new THREE.Mesh(doorFrame, frameMat));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: neonText(th.name.toLocaleUpperCase('tr-TR'), th.led), transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }));
    sign.position.set(0, 4.95, ROOM.z0 + t / 2 + 0.05);
    this.shell.add(sign);
    const posters = [
      [ROOM.x0 + t / 2 + 0.03, 3.4, -5.6, Math.PI / 2],
      [ROOM.x0 + t / 2 + 0.03, 3.4, 8.6, Math.PI / 2],
      [-7, 4.6, ROOM.z0 + t / 2 + 0.03, 0],
      [7, 4.6, ROOM.z0 + t / 2 + 0.03, 0],
    ];
    posters.forEach(([x, y, z, ry], i) => {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.75), new THREE.MeshStandardMaterial({ map: posterTex(th, i + f), roughness: 0.5 }));
      pm.position.set(x, y, z);
      pm.rotation.y = ry;
      if (i >= 2) pm.scale.setScalar(0.72);
      this.shell.add(pm);
    });
  }

  buildStations() {
    const th = this.theme;
    const mats = STATIONS.map((st) => M(st.x, 0, st.z, 0, st.yaw, 0));
    this.platforms = instanced(platformGeo(), vcMat, mats, STATIONS.map(() => th.id === 'cooking' || th.id === 'candy' || th.id === 'sports' ? '#3a3f55' : '#2e3246'));
    this.platforms.castShadow = false;
    this.rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 2.3, 2.3) });
    this.rims = instanced(rimGeo(), this.rimMat, mats, STATIONS.map(() => '#5b6478'), false);
    this.desks = instanced(deskGeo(), vcMat, mats, null);
    this.stands = instanced(ringStandGeo(), vcMat, mats, null);
    this.rings = instanced(ringLightGeo(), vcGlow, mats, null, false);
    this.interior.add(this.platforms, this.rims, this.desks, this.stands, this.rings);
    const padMats = STATIONS.map((st) => {
      const p = stationLocal(st, 0, PAD_OFF);
      return M(p.x, 0, p.z);
    });
    this.pads = instanced(padGeo(), vcMat, padMats, null, false);
    this.padGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.0, 2.0) });
    this.padGlow = instanced(padGlowGeo(), this.padGlowMat, padMats, STATIONS.map(() => '#3a4a3a'), false);
    this.interior.add(this.pads, this.padGlow);
    this.padPos = STATIONS.map((st) => stationLocal(st, 0, PAD_OFF));
    this.coins = new THREE.InstancedMesh(coinGeo(), vcGloss, 8 * 12);
    this.coins.count = 8 * 12;
    this.coins.castShadow = true;
    const hide = M(0, -50, 0, 0, 0, 0, 0.001);
    for (let i = 0; i < 96; i++) this.coins.setMatrixAt(i, hide);
    this.coins.frustumCulled = false;
    this.interior.add(this.coins);
    const sp = [];
    const uvs = [];
    const idx = [];
    STATIONS.forEach((st, i) => {
      const uv = this.atlas.uv(i);
      const corners = [[-1.62, 1.88], [1.62, 1.88], [1.62, 3.82], [-1.62, 3.82]];
      const base = sp.length / 3;
      for (const [lx, y] of corners) {
        const p = stationLocal(st, lx, -1.42);
        sp.push(p.x, y, p.z);
      }
      uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sg.setIndex(idx);
    sg.computeVertexNormals();
    this.screens = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: this.atlas.tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
    this.interior.add(this.screens);
    this.slotGroups = STATIONS.map((st) => {
      const g = new THREE.Group();
      g.position.set(st.x, 0.16, st.z);
      g.rotation.y = st.yaw;
      this.interior.add(g);
      return g;
    });
    this.bulk = new THREE.Group();
    const bp = this.bulkPos();
    this.bulk.position.set(bp.x, 0, bp.z);
    const bpl = new THREE.Mesh(merge([part(CYL(1.35, 1.45, 0.12, 48), '#2a2e3d', M(0, 0.06, 0))]), vcMat);
    this.bulkGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc21a').multiplyScalar(1.8) });
    const bg = new THREE.Mesh(merge([part(new THREE.RingGeometry(0.95, 1.2, 48), '#fff', M(0, 0.125, 0, -Math.PI / 2, 0, 0)), part(new THREE.RingGeometry(0.4, 0.62, 5, 1), '#fff', M(0, 0.125, 0, -Math.PI / 2, 0, 0))]), this.bulkGlowMat);
    this.bulk.add(bpl, bg);
    this.bulk.visible = false;
    this.interior.add(this.bulk);
  }

  bulkPos() {
    return this.index === 0 ? { x: 0, z: 7.6 } : { x: ROOM.x0 + 2.6, z: (ELEV.door0 + ELEV.door1) / 2 };
  }

  buildDecor() {
    const th = this.theme;
    const plantSpots = [[-15.6, -8.6], [15.6, -8.6], [15.6, 2.6], [-15.6, 9.0]];
    this.interior.add(instanced(plantGeo(), vcMat, plantSpots.map(([x, z], i) => M(x, 0, z, 0, i, 0, 1.1)), null));
    const beanSpots = [[-3.2, 1.2, 0.6], [3.3, 1.4, -0.5]];
    const bc = [th.led, th.led2, th.accent];
    this.interior.add(instanced(beanGeo(), vcMat, beanSpots.map(([x, z, r]) => M(x, 0, z, 0, r, 0)), bc));
    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), new THREE.MeshStandardMaterial({ color: th.accent, roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 0.6);
    rug.receiveShadow = true;
    const rug2 = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.15, 48), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(0, 0.016, 0.6);
    this.interior.add(rug, rug2);
    const tp = themeProp(th);
    const tg = new THREE.Group();
    const tb = new THREE.Mesh(tp.body, vcMat);
    tb.castShadow = true;
    tg.add(tb);
    if (tp.glow) tg.add(new THREE.Mesh(tp.glow, vcGlow));
    tg.position.set(th.id === 'space' || th.id === 'candy' ? 7.5 : -6.8, 0, th.id === 'sports' ? -2.6 : -2.4);
    if (th.id === 'gaming' || th.id === 'music') tg.rotation.y = 0.3;
    this.interior.add(tg);
  }

  setVisible(shell, interior, cutaway) {
    this.group.visible = shell;
    this.interior.visible = interior;
    this.cut.visible = !cutaway;
  }

  setRim(i, color) {
    this.rims.setColorAt(i, new THREE.Color(color));
    this.rims.instanceColor.needsUpdate = true;
  }

  setPadGlow(i, color) {
    this.padGlow.setColorAt(i, new THREE.Color(color));
    this.padGlow.instanceColor.needsUpdate = true;
  }

  setCoins(i, level) {
    if (this.coinLevel[i] === level) return;
    this.coinLevel[i] = level;
    const counts = [0, 3, 7, 12];
    const n = counts[level] || 0;
    const p = this.padPos[i];
    const m = new THREE.Matrix4();
    for (let k = 0; k < 12; k++) {
      if (k < n) {
        const stack = k % 3;
        const h = Math.floor(k / 3);
        const a = stack * 2.1 + i;
        m.copy(M(p.x + Math.cos(a) * 0.28 * (stack > 0 ? 1 : 0.2), 0.14 + h * 0.075, p.z + Math.sin(a) * 0.28 * (stack > 0 ? 1 : 0.2), 0, a, (k % 2) * 0.05));
      } else m.copy(M(0, -50, 0, 0, 0, 0, 0.001));
      this.coins.setMatrixAt(i * 12 + k, m);
    }
    this.coins.instanceMatrix.needsUpdate = true;
  }
}
