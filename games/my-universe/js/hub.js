import * as THREE from 'three';
import { WORLDS } from './engine/themes.js';
import { World } from './engine/world.js';
import * as TX from './engine/textures.js';
import { GAMES } from './registry.js';

export const HUB_DEF = { ...WORLDS[0], name: 'Ana Meydan', fog: { color: 0x9fd0f2, near: 140, far: 560 }, belowY: -16 };
export const SPAWN = { x: 0, y: 0, z: 14, face: Math.PI };
const PORTAL_R = 25;
const SHOP = { x: -9, z: -3 };
const PEDESTAL = { x: 9, z: -3 };

function portalAngle(i) {
  const n = GAMES.length;
  return Math.PI + ((i - (n - 1) / 2) * (Math.PI * 1.4)) / (n - 1);
}

function hubCourse() {
  const specs = [];
  const add = (s) => specs.push({ stage: 0, yaw: 0, ...s });
  add({ t: 'block', x: 0, y: 0, z: 0, sx: 72, sz: 72, sy: 3, style: 'ground' });
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    add({ t: 'block', x: Math.sin(a) * 35.4, y: 0.9, z: Math.cos(a) * 35.4, sx: 8.2, sz: 0.7, sy: 0.9, style: 'curb', yaw: a });
  }
  GAMES.forEach((g, i) => {
    const a = portalAngle(i);
    add({ t: 'disk', x: Math.sin(a) * PORTAL_R, y: 0.6, z: Math.cos(a) * PORTAL_R, r: 3.4, sy: 0.6, style: 'arena' });
    add({ t: 'block', x: Math.sin(a) * (PORTAL_R - 5.2), y: 0.12, z: Math.cos(a) * (PORTAL_R - 5.2), sx: 2.6, sz: 4.2, sy: 0.12, style: 'plank', yaw: a, color: i });
  });
  add({ t: 'block', x: SHOP.x, y: 4.6, z: SHOP.z, sx: 8, sz: 7, sy: 4.6, style: 'block', color: 2 });
  add({ t: 'block', x: SHOP.x, y: 5.5, z: SHOP.z, sx: 9.2, sz: 8.2, sy: 0.9, style: 'curb' });
  add({ t: 'block', x: SHOP.x, y: 7.4, z: SHOP.z, sx: 5.6, sz: 5, sy: 1.9, style: 'block', color: 4 });
  add({ t: 'block', x: SHOP.x, y: 2.3, z: SHOP.z + 4.1, sx: 6, sz: 1.3, sy: 0.3, style: 'curb', nocollide: true });
  add({ t: 'block', x: SHOP.x, y: 0.1, z: SHOP.z + 5.6, sx: 5, sz: 4.2, sy: 0.1, style: 'plank', color: 1 });
  add({ t: 'disk', x: PEDESTAL.x, y: 0.5, z: PEDESTAL.z, r: 2.8, sy: 0.5, style: 'arena' });
  add({ t: 'disk', x: PEDESTAL.x, y: 1.7, z: PEDESTAL.z, r: 0.6, sy: 1.2, style: 'hub' });
  for (const [dx, dz] of [[-24, 20], [24, 20], [0, -30], [-30, -8], [30, -8]]) {
    add({ t: 'disk', x: dx, y: 0.8, z: dz, r: 1.6, sy: 0.8, style: 'spinner', color: (dx + dz) & 3 });
  }
  return { specs, coins: [], cps: [], bigStars: [], bounds: { minX: -36, maxX: 36, minY: 0, maxY: 0, minZ: -36, maxZ: 36 } };
}

const SWIRL_VS = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SWIRL_FS = `uniform float time; uniform vec3 color; uniform float lock; varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float s = sin(a * 3.0 - time * 2.2 + r * 9.0) * 0.5 + 0.5;
  float s2 = sin(a * 5.0 + time * 1.4 - r * 14.0) * 0.5 + 0.5;
  float v = smoothstep(1.0, 0.55, r);
  float core = smoothstep(0.35, 0.0, r);
  vec3 c = mix(color * 0.25, color * 1.9, s * 0.7 + s2 * 0.3) * v + vec3(1.0) * core * 0.8;
  float alpha = v * 0.95;
  if (lock > 0.5) { c = mix(c, vec3(0.22, 0.24, 0.3), 0.85); alpha *= 0.85; }
  gl_FragColor = vec4(c, alpha);
}`;

export class Hub {
  constructor(scene, progress) {
    this.scene = scene;
    this.progress = progress;
    this.course = hubCourse();
    this.world = new World(scene, HUB_DEF, this.course);
    this.portals = [];
    this.time = 0;
    this.buildPortals();
    this.buildShop();
    this.buildPedestal();
    this.refresh();
  }

  bannerMesh(text, bg1, bg2, w = 5.2, h = 1) {
    const w0 = this.world;
    const tex = w0.track(TX.banner(text, bg1, bg2));
    const m = w0.track(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.5, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(w0.track(new THREE.PlaneGeometry(w, h)), m);
    mesh.castShadow = false;
    return mesh;
  }

  buildPortals() {
    const w = this.world;
    const ringG = w.track(new THREE.TorusGeometry(2.4, 0.32, 18, 56));
    const discG = w.track(new THREE.CircleGeometry(2.15, 48));
    const postG = w.track(new THREE.CylinderGeometry(0.22, 0.3, 2.8, 12));
    GAMES.forEach((g, i) => {
      const a = portalAngle(i);
      const x = Math.sin(a) * PORTAL_R;
      const z = Math.cos(a) * PORTAL_R;
      const grp = new THREE.Group();
      grp.position.set(x, 0.6, z);
      grp.rotation.y = a + Math.PI;
      const ringM = w.track(new THREE.MeshStandardMaterial({ color: 0xe9eef8, emissive: g.color, emissiveIntensity: 0.9, metalness: 0.65, roughness: 0.25 }));
      const ring = new THREE.Mesh(ringG, ringM);
      ring.position.y = 2.75;
      ring.castShadow = true;
      const swirlM = w.track(new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, color: { value: new THREE.Color(g.color) }, lock: { value: 0 } }, vertexShader: SWIRL_VS, fragmentShader: SWIRL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const disc = new THREE.Mesh(discG, swirlM);
      disc.position.y = 2.75;
      const postM = w.track(new THREE.MeshStandardMaterial({ color: 0x3a4260, metalness: 0.6, roughness: 0.4 }));
      for (const sx of [-2.6, 2.6]) {
        const p = new THREE.Mesh(postG, postM);
        p.position.set(sx, 1.4, 0);
        p.castShadow = true;
        grp.add(p);
      }
      const name = this.bannerMesh(g.name, '#' + new THREE.Color(g.color).getHexString(), '#1f2a44', 6, 1.15);
      name.position.y = 5.9;
      const lock = this.bannerMesh('', '#2a2f3a', '#3b4766', 4.2, 0.8);
      lock.position.y = 0.9;
      lock.position.z = 0.9;
      lock.rotation.x = -0.35;
      grp.add(ring, disc, name, lock);
      w.group.add(grp);
      this.portals.push({ game: g, x, z, grp, ring, swirlM, lock, lockText: null, open: true });
    });
  }

  buildShop() {
    const w = this.world;
    const sign = this.bannerMesh('MAĞAZA', '#ffc21a', '#ff8a2a', 6.4, 1.2);
    sign.position.set(SHOP.x, 3.4, SHOP.z + 3.56);
    const doorM = w.track(new THREE.MeshStandardMaterial({ map: TX.darkPanel(), color: 0x6a74a8, roughness: 0.5 }));
    const door = new THREE.Mesh(w.track(new THREE.PlaneGeometry(2.2, 2.9)), doorM);
    door.position.set(SHOP.x, 1.45, SHOP.z + 3.52);
    const winM = w.track(new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0xfff2c4, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2 }));
    const winG = w.track(new THREE.PlaneGeometry(1.4, 1.2));
    for (const dx of [-2.4, 2.4]) {
      const win = new THREE.Mesh(winG, winM);
      win.position.set(SHOP.x + dx, 2.6, SHOP.z + 3.52);
      w.group.add(win);
    }
    const lampM = w.track(new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd36b, emissiveIntensity: 2.2 }));
    const lampG = w.track(new THREE.SphereGeometry(0.28, 14, 10));
    for (const dx of [-1.6, 1.6]) {
      const lamp = new THREE.Mesh(lampG, lampM);
      lamp.position.set(SHOP.x + dx, 3.0, SHOP.z + 3.8);
      w.group.add(lamp);
    }
    const coin = new THREE.Mesh(w.track(new THREE.CylinderGeometry(0.9, 0.9, 0.22, 28)), w.track(new THREE.MeshStandardMaterial({ map: TX.coinFace(), color: 0xffd34d, emissive: 0xffa000, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 })));
    coin.rotation.x = Math.PI / 2;
    coin.position.set(SHOP.x, 9.2, SHOP.z);
    coin.castShadow = true;
    this.shopCoin = coin;
    w.group.add(sign, door, coin);
    this.shopMats = [];
    for (const c of w.colliders) {
      if (c.style !== 'block' || Math.abs(c.x - SHOP.x) > 0.1 || Math.abs(c.z - SHOP.z) > 0.1) continue;
      c.obj.traverse((o) => {
        if (!o.isMesh) return;
        const src = Array.isArray(o.material) ? o.material : [o.material];
        const out = src.map((m) => {
          const k = w.track(m.clone());
          k.transparent = true;
          this.shopMats.push(k);
          return k;
        });
        o.material = Array.isArray(o.material) ? out : out[0];
      });
    }
    this.shopFade = 1;
  }

  buildPedestal() {
    const w = this.world;
    this.star = w.makeStar(0xffc21a);
    this.star.position.set(PEDESTAL.x, 3.4, PEDESTAL.z);
    w.group.add(this.star);
    const title = this.bannerMesh('HAFTANIN OYUNU', '#36a2ff', '#1b6fd6', 5.6, 1);
    title.position.set(PEDESTAL.x, 5.6, PEDESTAL.z);
    w.group.add(title);
    this.title = title;
    this.topName = null;
  }

  setMostPlayed(game) {
    if (this.topName) {
      this.world.group.remove(this.topName);
      this.topName.material.map.dispose();
      this.topName.material.dispose();
    }
    this.topName = this.bannerMesh(game ? game.name : 'Sen oyna!', game ? game.css : '#8a93a8', '#1f2a44', 5.2, 0.9);
    this.topName.position.set(PEDESTAL.x, 4.6, PEDESTAL.z);
    this.world.group.add(this.topName);
  }

  refresh() {
    const p = this.progress;
    for (const pt of this.portals) {
      const g = pt.game;
      pt.open = p.portalOpen(g);
      pt.swirlM.uniforms.lock.value = pt.open ? 0 : 1;
      const text = pt.open ? (g.load ? '' : 'Yakında') : g.unlock.level ? `Seviye ${g.unlock.level}` : `${g.unlock.coins} altın`;
      if (text !== pt.lockText) {
        pt.lockText = text;
        pt.lock.visible = !!text;
        if (text) {
          pt.lock.material.map.dispose();
          const tex = TX.banner(text, pt.open ? '#3ddc5a' : '#2a2f3a', pt.open ? '#1f9e3a' : '#3b4766');
          pt.lock.material.map = tex;
          pt.lock.material.emissiveMap = tex;
          pt.lock.material.needsUpdate = true;
        }
      }
    }
  }

  nearest(pos) {
    for (const pt of this.portals) {
      const d = Math.hypot(pos.x - pt.x, pos.z - pt.z);
      if (d < 3.2 && pos.y > -0.5 && pos.y < 3) return { type: 'portal', portal: pt, dist: d };
    }
    const sd = Math.hypot(pos.x - SHOP.x, pos.z - (SHOP.z + 5.2));
    if (sd < 3) return { type: 'shop', dist: sd };
    return null;
  }

  setView(eye, target) {
    let want = 1;
    if (eye) {
      const ax = eye.x;
      const az = eye.z;
      const bx = target.x - ax;
      const bz = target.z - az;
      const l2 = bx * bx + bz * bz || 1;
      const t = THREE.MathUtils.clamp(((SHOP.x - ax) * bx + (SHOP.z - az) * bz) / l2, 0, 1);
      const dx = SHOP.x - ax - bx * t;
      const dz = SHOP.z - az - bz * t;
      if (dx * dx + dz * dz < 36 && t < 0.9 && Math.hypot(target.x - SHOP.x, target.z - SHOP.z) < 12) want = 0.25;
    }
    this.shopFade += (want - this.shopFade) * 0.15;
    for (const m of this.shopMats) m.opacity = this.shopFade;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const pt of this.portals) {
      pt.swirlM.uniforms.time.value = t;
      pt.ring.rotation.z = Math.sin(t * 0.8) * 0.08;
      pt.ring.position.y = 2.75 + Math.sin(t * 1.6 + pt.x) * 0.08;
    }
    this.star.rotation.y = t * 1.2;
    this.star.position.y = 3.4 + Math.sin(t * 2) * 0.15;
    this.shopCoin.rotation.z = t * 1.5;
  }

  dispose() {
    this.world.dispose();
  }
}
