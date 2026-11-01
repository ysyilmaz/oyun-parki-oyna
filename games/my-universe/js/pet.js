import * as THREE from 'three';
import { createPetObject } from './engine/pets/petModels.js';

const _dir = new THREE.Vector3();

export class PetFollower {
  constructor(scene) {
    this.scene = scene;
    this.obj = null;
    this.id = 'none';
    this.pos = new THREE.Vector3();
    this.face = 0;
    this.hop = 0;
    this.vy = 0;
  }

  set(id, player) {
    if (this.obj) {
      this.scene.remove(this.obj.root);
      this.obj = null;
    }
    this.id = id;
    if (!id || id === 'none') return;
    this.obj = createPetObject(id, 0);
    this.obj.root.scale.setScalar(0.55);
    this.scene.add(this.obj.root);
    this.snap(player);
  }

  snap(player) {
    if (!this.obj) return;
    const p = player.pos;
    this.pos.set(p.x - Math.sin(player.face) * 1.6 + Math.cos(player.face) * 0.9, p.y, p.z - Math.cos(player.face) * 1.6 - Math.sin(player.face) * 0.9);
    this.face = player.face;
    this.sync();
  }

  update(dt, player, world, t) {
    if (!this.obj) return;
    const o = this.obj;
    const p = player.pos;
    const tx = p.x - Math.sin(player.face) * 1.5 + Math.cos(player.face) * 0.95;
    const tz = p.z - Math.cos(player.face) * 1.5 - Math.sin(player.face) * 0.95;
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 14) {
      this.pos.set(tx, p.y, tz);
    } else if (d > 0.35) {
      const k = 1 - Math.exp(-(d > 4 ? 6 : 3.2) * dt);
      this.pos.x += dx * k;
      this.pos.z += dz * k;
      this.face += Math.atan2(Math.sin(Math.atan2(dx, dz) - this.face), Math.cos(Math.atan2(dx, dz) - this.face)) * (1 - Math.exp(-10 * dt));
    }
    let gy = world ? world.groundBelow(this.pos.x, this.pos.z, p.y + 1.2, 0.3) : -Infinity;
    if (gy === -Infinity || gy < p.y - 6) gy = p.y;
    this.pos.y += (gy - this.pos.y) * (1 - Math.exp(-12 * dt));
    const moving = d > 0.4;
    if (o.flying) {
      this.hop = 1.1 + Math.sin(t * 3) * 0.15;
      for (const w of o.wings) w.rotation.z = Math.sin(t * 14) * 0.6 * w.userData.side;
    } else {
      if (moving) this.hop = Math.abs(Math.sin(t * 11)) * 0.28;
      else this.hop += (Math.sin(t * 2.4) * 0.03 - this.hop) * (1 - Math.exp(-6 * dt));
      for (const w of o.wings) w.rotation.z = Math.sin(t * (moving ? 12 : 4)) * (moving ? 0.5 : 0.2) * w.userData.side;
    }
    if (o.mixer) o.mixer.update(dt);
    o.inner.rotation.z = moving && !o.flying ? Math.sin(t * 11) * 0.06 : 0;
    this.sync();
  }

  sync() {
    const o = this.obj;
    o.root.position.set(this.pos.x, this.pos.y + this.hop, this.pos.z);
    o.root.rotation.y = this.face;
  }

  dispose() {
    this.set('none');
  }
}
