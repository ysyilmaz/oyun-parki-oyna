import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BREAKABLES, ZONE_HP, ZONE_REWARD, ZONE_W, Z_MIN, Z_MAX, fmt } from './data.js';
import { M, part, merge, gradientY } from './geo.js';
import { heightAt, gateX, PLAZA, zoneAt } from './world.js';
import { easeOutBack, rng } from './util.js';

const GIFT_COLORS = [
  [['#ff4f6d', '#ffd23a'], ['#4fb6ff', '#ffffff'], ['#7cdf5a', '#ff4f6d']],
  [['#ff7a2e', '#ffffff'], ['#3fc27a', '#ffe14f'], ['#b86bff', '#ffd23a']],
  [['#ff9d2e', '#4fd6ff'], ['#e8443a', '#ffd23a'], ['#2fb6c9', '#ffffff']],
  [['#4f9dff', '#ffffff'], ['#e8443a', '#ffffff'], ['#8fd6ff', '#3a5bd6']],
  [['#ff6fb5', '#fff3a8'], ['#7ee6ff', '#ff6fb5'], ['#b98cff', '#9ff0d0']],
  [['#7a5cff', '#6fe8ff'], ['#ff5fe0', '#ffffff'], ['#3fd6ff', '#ff8af0']],
];
const CRYSTAL_COLORS = ['#6fe8ff', '#8fff9f', '#ffb14f', '#9fd8ff', '#ff8fd0', '#c58bff'];

let GEO = null;
let MAT = null;

function build() {
  if (GEO) return;
  MAT = {
    gold: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.28, emissive: '#ff9d00', emissiveIntensity: 0.18 }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    gift: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }),
    gem: new THREE.MeshStandardMaterial({ color: '#8ff0ff', emissive: '#2aa8ff', emissiveIntensity: 2.4, metalness: 0.1, roughness: 0.05 }),
    rock: new THREE.MeshStandardMaterial({ color: '#5a5470', roughness: 0.9 }),
    crystals: CRYSTAL_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.8, metalness: 0.15, roughness: 0.08 })),
    diamond: new THREE.MeshStandardMaterial({ color: '#c9f7ff', emissive: '#5fd8ff', emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.02, envMapIntensity: 2.5 }),
  };
  GEO = {};
  const r = rng(5);
  const coin = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 18);
  const G1 = new THREE.Color('#ffd23a');
  const G2 = new THREE.Color('#ff9d00');
  const goldC = (c, x, y) => c.copy(G1).lerp(G2, Math.max(0, 0.5 - y * 0.3));
  const parts = [];
  const dome = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  parts.push(part(dome, null, M(0, 0, 0, 0, 0, 0, 1.15, 0.55, 1.15), goldC));
  for (let i = 0; i < 44; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 1.15;
    const y = Math.sqrt(Math.max(0, 1 - (d / 1.2) ** 2)) * 0.55 + 0.02;
    parts.push(part(coin, null, M(Math.cos(a) * d, y, Math.sin(a) * d, (r() - 0.5) * 0.9, r() * 3, (r() - 0.5) * 0.9), goldC));
  }
  for (let s = 0; s < 3; s++) {
    const a = (s / 3) * Math.PI * 2 + 0.4;
    const n = 4 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) parts.push(part(coin, null, M(Math.cos(a) * 1.25 + (r() - 0.5) * 0.05, 0.04 + k * 0.085, Math.sin(a) * 1.25, 0, r(), 0), goldC));
  }
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const d = 1.3 + r() * 0.6;
    parts.push(part(coin, null, M(Math.cos(a) * d, 0.04, Math.sin(a) * d, (r() - 0.5) * 0.3, r() * 3, 0), goldC));
  }
  GEO.coinsGold = merge(parts);
  const gemG = new THREE.OctahedronGeometry(0.2, 0);
  GEO.coinsGem = merge([
    part(gemG, '#ffffff', M(0.3, 0.55, 0.5, 0.3, 0.2, 0)),
    part(gemG, '#ffffff', M(-0.5, 0.45, 0.2, 0.1, 0.8, 0.2, 0.8)),
  ]);

  const wood = (c, x, y) => {
    c.set(Math.floor((y + 5) * 4) % 2 ? '#a4652e' : '#8c5424');
  };
  GEO.chestWood = merge([
    part(new RoundedBoxGeometry(2.1, 1.1, 1.4, 3, 0.12), null, M(0, 0.55, 0), wood),
    part(new THREE.CylinderGeometry(0.7, 0.7, 2.1, 20, 1, false, 0, Math.PI), null, M(0, 1.1, 0, 0, 0, Math.PI / 2, 1, 1, 1), (c, x, y) => c.set('#b8743a').lerp(new THREE.Color('#d08a48'), Math.min(1, (y - 1.1) * 1.4))),
  ]);
  const band = new RoundedBoxGeometry(0.2, 1.16, 1.46, 2, 0.05);
  const bandTop = new THREE.TorusGeometry(0.71, 0.09, 8, 24, Math.PI);
  const goldPlain = (c) => c.set('#ffcb2e');
  const chestGold = [
    part(band, null, M(-0.7, 0.55, 0), goldPlain),
    part(band, null, M(0.7, 0.55, 0), goldPlain),
    part(bandTop, null, M(-0.7, 1.1, 0, 0, Math.PI / 2, 0), goldPlain),
    part(bandTop, null, M(0.7, 1.1, 0, 0, Math.PI / 2, 0), goldPlain),
    part(new RoundedBoxGeometry(0.45, 0.55, 0.2, 2, 0.06), null, M(0, 0.95, 0.72), goldPlain),
    part(new RoundedBoxGeometry(2.2, 0.14, 1.5, 2, 0.05), null, M(0, 1.1, 0), goldPlain),
  ];
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    chestGold.push(part(coin, null, M(Math.cos(a) * (1.3 + r() * 0.5), 0.04 + (i % 3) * 0.08, Math.sin(a) * (1.0 + r() * 0.4), 0, r() * 3, 0), goldC));
  }
  GEO.chestGold = merge(chestGold);
  GEO.chestGem = merge([part(gemG, '#ffffff', M(0, 0.95, 0.86, 0, 0, 0, 0.6))]);

  GEO.gift = [];
  const box = new RoundedBoxGeometry(1.6, 1.4, 1.6, 3, 0.14);
  const rib1 = new RoundedBoxGeometry(1.66, 1.46, 0.34, 2, 0.06);
  const rib2 = new RoundedBoxGeometry(0.34, 1.46, 1.66, 2, 0.06);
  const lid = new RoundedBoxGeometry(1.75, 0.3, 1.75, 2, 0.1);
  const loop = new THREE.TorusGeometry(0.3, 0.1, 10, 20);
  const knot = new THREE.SphereGeometry(0.16, 12, 10);
  for (const zc of GIFT_COLORS) {
    GEO.gift.push(
      zc.map(([a, b]) =>
        merge([
          part(box, a, M(0, 0.7, 0)),
          part(lid, a, M(0, 1.45, 0)),
          part(rib1, b, M(0, 0.73, 0)),
          part(rib2, b, M(0, 0.73, 0)),
          part(new RoundedBoxGeometry(1.8, 0.34, 0.36, 2, 0.06), b, M(0, 1.46, 0)),
          part(new RoundedBoxGeometry(0.36, 0.34, 1.8, 2, 0.06), b, M(0, 1.46, 0)),
          part(loop, b, M(-0.28, 1.85, 0, 0, 0, 0.5, 1, 1.1, 0.8)),
          part(loop, b, M(0.28, 1.85, 0, 0, 0, -0.5, 1, 1.1, 0.8)),
          part(knot, b, M(0, 1.66, 0)),
        ])
      )
    );
  }

  const shard = new THREE.CylinderGeometry(0.0, 0.35, 0.6, 6);
  const shaft = new THREE.CylinderGeometry(0.35, 0.3, 1.6, 6);
  const cparts = [];
  const shards = [[0, 0, 1.25, 0, 0], [0.55, 0.1, 0.9, 0.2, -0.45], [-0.5, -0.1, 0.95, -0.15, 0.5], [0.1, 0.55, 0.8, 0.5, 0.1], [-0.2, -0.55, 0.7, -0.45, -0.15]];
  for (const s of shards) {
    const base = M(s[0], 0.1, s[1], s[3], r() * 2, s[4], s[2]);
    cparts.push(part(shaft, '#ffffff', new THREE.Matrix4().multiplyMatrices(base, M(0, 0.8, 0))));
    cparts.push(part(shard, '#ffffff', new THREE.Matrix4().multiplyMatrices(base, M(0, 1.9, 0))));
  }
  GEO.crystal = merge(cparts).toNonIndexed();
  GEO.crystal.computeVertexNormals();
  const rock = new THREE.DodecahedronGeometry(0.8, 0);
  GEO.crystalRock = merge([part(rock, '#ffffff', M(0, 0.1, 0, 0, 0, 0, 1.3, 0.45, 1.2)), part(rock, '#ffffff', M(0.8, 0.05, 0.3, 0.3, 1, 0, 0.6, 0.35, 0.6))]).toNonIndexed();
  GEO.crystalRock.computeVertexNormals();

  const crown = new THREE.CylinderGeometry(0.75, 1.25, 0.5, 10);
  const pav = new THREE.ConeGeometry(1.25, 1.5, 10);
  GEO.diamond = merge([part(crown, '#ffffff', M(0, 0.25, 0)), part(pav, '#ffffff', M(0, -0.75, 0, Math.PI, 0, 0))]).toNonIndexed();
  GEO.diamond.computeVertexNormals();
  GEO.pedestal = merge([
    part(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 24), null, M(0, 0.25, 0), gradientY(0, 0.5, '#8a7fb0', '#d9d2f0')),
    part(new THREE.TorusGeometry(1.5, 0.12, 8, 32), '#ffd23a', M(0, 0.5, 0, Math.PI / 2, 0, 0)),
  ]);
}

function makeGroup(type, zone, seed) {
  build();
  const g = new THREE.Group();
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  let spin = null;
  if (type === 'coins') {
    add(GEO.coinsGold, MAT.gold);
    add(GEO.coinsGem, MAT.gem);
  } else if (type === 'chest') {
    add(GEO.chestWood, MAT.wood);
    add(GEO.chestGold, MAT.gold);
    add(GEO.chestGem, MAT.gem);
  } else if (type === 'gift') {
    add(GEO.gift[zone][seed % 3], MAT.gift);
  } else if (type === 'crystal') {
    add(GEO.crystalRock, MAT.rock);
    add(GEO.crystal, MAT.crystals[zone]);
  } else if (type === 'diamond') {
    add(GEO.pedestal, MAT.wood);
    spin = add(GEO.diamond, MAT.diamond);
    spin.position.y = 2.6;
  }
  return { g, spin };
}

export class Breakables {
  constructor(scene, world, fx, drops, overlay, audio, hooks) {
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.drops = drops;
    this.overlay = overlay;
    this.audio = audio;
    this.hooks = hooks;
    this.list = [];
    this.rand = rng(1234);
  }

  async populateAll(step) {
    await step(-1);
    build();
    await step(-1);
    for (let z = 0; z < 6; z++) {
      this.populateZone(z);
      await step(z);
    }
  }

  populateZone(zone) {
    const count = zone === 0 ? 18 : 17;
    for (let i = 0; i < count; i++) this.spawn(zone, null, true);
    this.spawn(zone, 'diamond', true);
  }

  pickType() {
    const types = Object.entries(BREAKABLES).filter(([, d]) => d.weight > 0);
    const total = types.reduce((s, [, d]) => s + d.weight, 0);
    let x = this.rand() * total;
    for (const [k, d] of types) {
      x -= d.weight;
      if (x <= 0) return k;
    }
    return 'coins';
  }

  findSpot(zone, r, near) {
    const x0 = zone * ZONE_W - ZONE_W / 2;
    for (let t = 0; t < 60; t++) {
      let x;
      let z;
      if (near && t < 30) {
        const a = this.rand() * Math.PI * 2;
        const d = 7 + this.rand() * 12;
        x = near.x + Math.cos(a) * d;
        z = near.z + Math.sin(a) * d;
      } else {
        x = x0 + 5 + this.rand() * (ZONE_W - 10);
        z = Z_MIN + 3 + this.rand() * (Z_MAX - Z_MIN - 6);
      }
      if (x < x0 + 4 || x > x0 + ZONE_W - 4) continue;
      if (z < Z_MIN + 2 || z > Z_MAX - 2) continue;
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + r + 0.5) continue;
      let ok = true;
      for (let i = 1; i < 6; i++) if (Math.abs(x - gateX(i)) < 5 && Math.abs(z) < 8) ok = false;
      for (const s of this.world.stands) if (Math.hypot(x - s.x, z - s.z) < 4 + r) ok = false;
      if (!ok) continue;
      const near2 = this.world.grid.query(x, z, r + 2, []);
      for (const c of near2) if (Math.hypot(c.x - x, c.z - z) < c.r + r + 1.2) ok = false;
      if (!ok) continue;
      return { x, z };
    }
    return null;
  }

  spawnAt(type, x, z) {
    const b = this.spawn(0, type, true, null, { x, z });
    return b;
  }

  spawn(zone, forcedType, instant, near, fixed) {
    const type = forcedType || this.pickType();
    const def = BREAKABLES[type];
    const spot = fixed || this.findSpot(zone, def.r, near);
    if (!spot) return null;
    const seed = Math.floor(this.rand() * 99);
    const { g, spin } = makeGroup(type, zone, seed);
    const y = heightAt(spot.x, spot.z);
    g.position.set(spot.x, y, spot.z);
    g.rotation.y = this.rand() * Math.PI * 2;
    const scale = type === 'diamond' ? 1 : 0.95 + this.rand() * 0.15;
    g.scale.setScalar(instant ? scale : 0.001);
    this.scene.add(g);
    const hpMult = ZONE_HP[zone];
    const first = zone === 0 && def.hp0;
    const hp = Math.round((first ? def.hp0 : def.hp) * hpMult);
    const b = {
      type, zone, def,
      x: spot.x, y, z: spot.z, r: def.r * scale,
      g, spin, scale,
      maxHp: hp,
      hp,
      coins: Math.round((first ? def.coins0 : def.coins) * ZONE_REWARD[zone]),
      gems: def.gems,
      alive: true, shake: 0, appear: instant ? 1 : 0, lastHit: -10, attackers: 0,
    };
    b.collider = this.world.addCollider(b.x, b.z, b.r, { breakable: b });
    this.list.push(b);
    return b;
  }

  nearest(x, z, maxD, maxZone, type, skip) {
    let best = null;
    let bd = maxD;
    for (const b of this.list) {
      if (!b.alive || b.zone > maxZone || b === skip || (type && b.type !== type)) continue;
      const d = Math.hypot(b.x - x, b.z - z) - b.r;
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  damage(b, amount, crit) {
    if (!b.alive) return false;
    b.hp -= amount;
    b.shake = 0.25;
    b.lastHit = this.time ?? 0;
    this.fx.burst(b.x, b.y + 1, b.z, b.type === 'crystal' ? CRYSTAL_COLORS[b.zone] : '#fff2a8', 5, { speed: 3, up: 3, life: 0.45, size: 0.35 });
    this.audio.hit(crit);
    if (b.hp <= 0) {
      this.kill(b);
      return true;
    }
    return false;
  }

  kill(b) {
    b.alive = false;
    b.hp = 0;
    this.world.grid.remove(b.collider);
    const mult = this.hooks.coinMult();
    const value = Math.round(b.coins * mult);
    const n = Math.min(14, 4 + Math.floor(Math.log2(1 + b.def.hp / 10)) * 2);
    this.drops.spawn('coin', b.x, b.y + 1, b.z, value, n);
    if (b.gems) this.drops.spawn('gem', b.x, b.y + 1, b.z, b.gems, Math.min(6, b.gems));
    this.fx.burst(b.x, b.y + 1.2, b.z, '#ffd23a', 26, { speed: 7, up: 6, life: 0.9, size: 0.55 });
    this.fx.burst(b.x, b.y + 0.6, b.z, '#ffffff', 10, { speed: 4, up: 2, life: 0.5, size: 0.9, solid: true, g: 1, drag: 3 });
    if (b.type === 'crystal' || b.type === 'diamond') this.fx.burst(b.x, b.y + 1.5, b.z, CRYSTAL_COLORS[b.zone], 24, { speed: 6, up: 6, life: 1, size: 0.5 });
    this.audio.breakSfx();
    b.dying = 0;
    this.hooks.onBreak(b, value);
  }

  update(dt, time, playerPos, maxZone, focusX) {
    this.time = time;
    const bars = [];
    const zc = zoneAt(focusX ?? playerPos.x);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (!b.alive) {
        b.dying += dt;
        const s = Math.max(0.001, b.scale * (1 - b.dying / 0.18) * (1 + b.dying * 2));
        b.g.scale.setScalar(s);
        if (b.dying > 0.18) {
          this.scene.remove(b.g);
          this.list.splice(i, 1);
          const zone = b.zone;
          const type = b.type === 'diamond' ? 'diamond' : null;
          const delay = type ? 25 : 2.5 + Math.random() * 3;
          setTimeout(() => this.spawn(zone, type, false, zone <= maxZone ? playerPos : null), delay * 1000);
        }
        continue;
      }
      b.g.visible = Math.abs(b.zone - zc) <= 1;
      if (b.appear < 1) {
        b.appear = Math.min(1, b.appear + dt * 3);
        b.g.scale.setScalar(b.scale * Math.max(0.001, easeOutBack(b.appear)));
        if (b.appear === 1) this.fx.burst(b.x, b.y + 0.5, b.z, '#ffffff', 8, { speed: 3, up: 2, life: 0.4, size: 0.6, solid: true, g: 0, drag: 4 });
      }
      if (b.shake > 0) {
        b.shake = Math.max(0, b.shake - dt);
        const k = b.shake / 0.25;
        const sq = 1 + Math.sin(k * 20) * 0.08 * k;
        b.g.scale.set(b.scale * (2 - sq), b.scale * sq, b.scale * (2 - sq));
        b.g.rotation.z = Math.sin(time * 60) * 0.06 * k;
        b.g.rotation.x = Math.cos(time * 53) * 0.05 * k;
      }
      if (b.spin) {
        b.spin.rotation.y = time * 0.8;
        b.spin.position.y = 2.6 + Math.sin(time * 1.6 + b.x) * 0.2;
        if (Math.random() < dt * 3) this.fx.sparkle(b.x + (Math.random() - 0.5) * 2, b.y + 2 + Math.random() * 2, b.z + (Math.random() - 0.5) * 2, '#bff4ff', 0.6);
      }
      if (b.type === 'crystal' && Math.random() < dt * 1.2) this.fx.sparkle(b.x + (Math.random() - 0.5) * 1.5, b.y + 1 + Math.random() * 1.5, b.z + (Math.random() - 0.5) * 1.5, CRYSTAL_COLORS[b.zone], 0.45);
      const d = Math.hypot(b.x - playerPos.x, b.z - playerPos.z);
      const recently = time - b.lastHit < 4;
      const hurt = b.hp < b.maxHp;
      if (b.zone <= maxZone && ((d < 14 && (recently || b.attackers > 0 || d < 7)) || (hurt && d < 32))) {
        bars.push({ b, d, k: d - (hurt || b.attackers > 0 ? 40 : 0) - (b === this.picked ? 100 : 0) });
      }
    }
    bars.sort((a, c) => a.k - c.k);
    bars.length = Math.min(bars.length, 8);
    return bars.map(({ b }) => ({
      x: b.x,
      y: b.y + (b.type === 'diamond' ? 5 : 3.1) * b.scale,
      z: b.z,
      pct: b.hp / b.maxHp,
      text: `+<span class="ic-coin"></span>${fmt(Math.round(b.coins * this.hooks.coinMult()))}${b.gems ? ` +<span class="ic-gem"></span>${b.gems}` : ''}`,
      target: b.attackers > 0,
      picked: b === this.picked,
      hit: time - b.lastHit < 0.14,
    }));
  }
}
