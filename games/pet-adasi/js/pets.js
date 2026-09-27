import * as THREE from 'three';
import { createPetObject } from './petModels.js';
import { RARITIES, findPetDef } from './data.js';
import { heightAt } from './world.js';
import { angleDamp, damp } from './util.js';
import { blobShadow } from './player.js';

let haloTex = null;
function getHaloTex() {
  if (haloTex) return haloTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(cv);
  return haloTex;
}

let ringTex = null;
function getRingTex() {
  if (ringTex) return ringTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ringTex = new THREE.CanvasTexture(cv);
  return ringTex;
}

const shadowMat = { m: null };
const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class Pet {
  constructor(scene, data, fx, power) {
    this.scene = scene;
    this.fx = fx;
    this.data = data;
    const def = findPetDef(data.sp);
    this.rarity = def.entry[1];
    this.power = power;
    this.obj = createPetObject(data.sp, data.v, true);
    this.root = this.obj.root;
    this.root.scale.setScalar(1.2);
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.phase = Math.random() * 6;
    this.face = 0;
    this.attackT = Math.random() * 0.6;
    this.lunge = 0;
    this.appear = 0;
    this.trailT = 0;
    if (!shadowMat.m) shadowMat.m = blobShadow();
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), shadowMat.m);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    const glowRarity = Math.max(this.rarity, data.v === 1 ? 4 : data.v === 2 ? 5 : 0);
    this.glowRarity = glowRarity;
    if (glowRarity >= 1) {
      const col = new THREE.Color(RARITIES[glowRarity].glow);
      const k = [0, 0.9, 1.4, 1.8, 2.4, 2.4][glowRarity];
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHaloTex(), color: col.clone().multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glowRarity >= 3 ? 0.55 : 0.35 }));
      halo.scale.setScalar(glowRarity >= 4 ? 3.2 : 2.4);
      halo.position.y = 0.8;
      halo.renderOrder = 3;
      this.root.add(halo);
      this.halo = halo;
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: getRingTex(), color: col.clone().multiplyScalar(k * 1.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glowRarity >= 2 ? 0.8 : 0.45 }));
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 3;
      scene.add(ring);
      this.ring = ring;
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.shadow);
    if (this.ring) this.scene.remove(this.ring);
  }

  place(p) {
    this.pos.copy(p);
    this.root.position.copy(p);
  }

  update(dt, time, desired, faceTo, target, speedMult, onHit) {
    const dx = desired.x - this.pos.x;
    const dz = desired.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const maxSp = 16 * speedMult;
    let vx = 0;
    let vz = 0;
    if (dist > 0.15) {
      const sp = Math.min(maxSp, dist * 5);
      vx = (dx / dist) * sp;
      vz = (dz / dist) * sp;
    }
    if (dist > 40) {
      this.pos.x = desired.x;
      this.pos.z = desired.z;
    }
    this.vel.x = damp(this.vel.x, vx, 10, dt);
    this.vel.z = damp(this.vel.z, vz, 10, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const gy = heightAt(this.pos.x, this.pos.z);
    let hop = 0;
    let squash = 1;
    const flying = this.obj.flying;
    if (speed > 0.8) {
      this.phase += dt * (7 + speed * 0.5);
      const s = Math.abs(Math.sin(this.phase));
      hop = flying ? 0 : s * 0.55;
      squash = flying ? 1 : 0.9 + s * 0.18;
      this.face = angleDamp(this.face, Math.atan2(this.vel.x, this.vel.z), 12, dt);
    } else {
      this.phase += dt * 2.2;
      hop = flying ? 0 : Math.max(0, Math.sin(this.phase * 1.3)) * 0.08;
      squash = 1 + Math.sin(this.phase * 2) * 0.03;
      if (faceTo) this.face = angleDamp(this.face, Math.atan2(faceTo.x - this.pos.x, faceTo.z - this.pos.z), 8, dt);
    }
    if (target && dist < 1.2) {
      this.attackT -= dt * speedMult;
      if (this.attackT <= 0) {
        this.attackT = 0.8;
        this.lunge = 1;
        onHit(this);
      }
    }
    let lx = 0;
    let lz = 0;
    let ly = 0;
    if (this.lunge > 0) {
      this.lunge = Math.max(0, this.lunge - dt * 4);
      const k = Math.sin(this.lunge * Math.PI);
      lx = Math.sin(this.face) * k * 0.6;
      lz = Math.cos(this.face) * k * 0.6;
      ly = k * 0.5;
      squash = 1 + k * 0.15;
    }
    const fy = flying ? 1.3 + Math.sin(time * 2.5 + this.phase) * 0.25 : 0;
    if (this.appear < 1) this.appear = Math.min(1, this.appear + dt * 3);
    const ap = this.appear < 1 ? Math.sin(this.appear * Math.PI * 0.5) * (1 + Math.sin(this.appear * Math.PI) * 0.25) : 1;
    this.root.position.set(this.pos.x + lx, gy + hop + ly + fy, this.pos.z + lz);
    this.root.rotation.y = this.face;
    this.obj.inner.scale.set((2 - squash) * ap, squash * ap, (2 - squash) * ap);
    this.obj.inner.rotation.z = flying ? Math.sin(time * 2) * 0.1 : Math.sin(this.phase) * (speed > 0.8 ? 0.08 : 0.02);
    for (const w of this.obj.wings) w.rotation.z = w.userData.side * (0.35 + Math.sin(time * 10 + this.phase) * 0.45);
    if (this.obj.mixer) this.obj.mixer.update(dt);
    this.shadow.position.set(this.root.position.x, gy + 0.05, this.root.position.z);
    this.shadow.scale.setScalar(1 - Math.min(0.5, (hop + fy) * 0.25));
    if (this.ring) {
      this.ring.position.set(this.root.position.x, gy + 0.07, this.root.position.z);
      this.ring.rotation.z = time * 0.8;
      const p = 1 + Math.sin(time * 3 + this.phase) * 0.06;
      this.ring.scale.setScalar(p);
    }
    if (this.halo) {
      this.halo.material.opacity = (this.glowRarity >= 3 ? 0.5 : 0.3) + Math.sin(time * 3 + this.phase) * 0.1;
      if (this.glowRarity === 5) this.halo.material.color.setHSL((time * 0.2) % 1, 1, 0.6).multiplyScalar(2.2);
    }
    const gr = this.glowRarity;
    if (gr >= 3) {
      this.trailT -= dt;
      const rate = gr >= 4 ? (speed > 0.8 ? 0.03 : 0.12) : 0.2;
      if (this.trailT <= 0) {
        this.trailT = rate;
        const col = gr === 5 ? _c.setHSL(Math.random(), 1, 0.65).getStyle() : RARITIES[gr].color;
        _v.set(this.root.position.x + (Math.random() - 0.5) * 1.2, this.root.position.y + 0.3 + Math.random() * 1.2, this.root.position.z + (Math.random() - 0.5) * 1.2);
        this.fx.sparkle(_v.x, _v.y, _v.z, col, gr >= 4 ? 0.55 : 0.4, gr >= 4 ? 0.9 : 0.6, 2.5);
      }
    }
  }
}

export class Squad {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.pets = [];
  }

  sync(petDatas, playerPos, powerFn) {
    const keep = [];
    for (const p of this.pets) {
      if (petDatas.find((d) => d.uid === p.data.uid)) keep.push(p);
      else p.dispose();
    }
    this.pets = keep;
    for (const d of petDatas) {
      if (!this.pets.find((p) => p.data.uid === d.uid)) {
        const p = new Pet(this.scene, d, this.fx, powerFn(d));
        p.place(_v.set(playerPos.x + (Math.random() - 0.5) * 2, 0, playerPos.z + 1 + Math.random()));
        this.fx.burst(playerPos.x, playerPos.y + 1, playerPos.z, RARITIES[p.rarity].color, 12, { speed: 3, up: 3, life: 0.6 });
        this.pets.push(p);
      }
    }
    for (const p of this.pets) p.power = powerFn(p.data);
    this.pets.sort((a, b) => b.power - a.power);
  }

  totalPower() {
    return this.pets.reduce((s, p) => s + p.power, 0);
  }

  update(dt, time, player, facing, target, speedMult, onHit) {
    const n = this.pets.length;
    const cos = Math.cos(facing);
    const sin = Math.sin(facing);
    this.pets.forEach((p, i) => {
      let desired;
      let faceTo = null;
      if (target && target.alive) {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + target.x * 0.1;
        const rr = target.r + 0.9 + (i % 2) * 0.35;
        desired = _v.set(target.x + Math.cos(a) * rr, 0, target.z + Math.sin(a) * rr);
        faceTo = target;
      } else {
        const row = Math.floor(i / 4);
        const inRow = Math.min(4, n - row * 4);
        const col = (i % 4) - (inRow - 1) / 2;
        const lx = col * 1.7;
        const lz = -2.4 - row * 1.6 - Math.abs(col) * 0.3;
        desired = _v.set(player.x + lx * cos + lz * sin, 0, player.z - lx * sin + lz * cos);
        faceTo = { x: player.x + sin * 50, z: player.z + cos * 50 };
      }
      p.update(dt, time, desired, faceTo, target && target.alive ? target : null, speedMult, onHit);
    });
  }
}
