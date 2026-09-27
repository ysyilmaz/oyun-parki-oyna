import * as THREE from 'three';
import { angleDamp, clamp, damp } from './util.js';
import { blobShadow, Creator } from './chars.js';

const HERO = { id: '__hero', name: '', r: 0, k: -1, niche: 'dance', look: { skin: '#f2c29b', hair: 'bald', hairC: '#3a2216', top: 'player', topC: '#ff6a13', acc: '#ffd23a', pants: '#1d2a5a', shoes: '#ffffff', head: 'herocap', headC: '#ff6a13', eye: '#3a6bd6', prop: 'none' } };

export class Player {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.floorY = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.grounded = true;
    this.busy = 0;
    this.stepT = 0;
    this.land = 0;
    this.state = 'idle';
    this.shadow = blobShadow(1.9);
    scene.add(this.shadow);
    const rc = document.createElement('canvas');
    rc.width = rc.height = 128;
    const g = rc.getContext('2d');
    g.strokeStyle = '#ffffff';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      g.lineTo(64 + Math.cos(a + 0.18) * 50, 64 + Math.sin(a + 0.18) * 50);
      g.lineTo(64 + Math.cos(a - 0.18) * 50, 64 + Math.sin(a - 0.18) * 50);
      g.fill();
    }
    const rt = new THREE.CanvasTexture(rc);
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ map: rt, color: new THREE.Color('#35e0ff').multiplyScalar(1.6), transparent: true, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 2;
    scene.add(this.ring);
  }

  attach() {
    const hero = new Creator(HERO, null);
    hero.shadow.visible = false;
    hero.root.scale.setScalar(1.45);
    hero.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.material === hero.mainMat;
        o.receiveShadow = false;
      }
    });
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
    this.ghost = hero.addGhost(this.ghostMat);
    this.occluded = false;
    this.root.add(hero.root);
    this.hero = hero;
    this.anim = 'idle';
    this.animT = 0;
  }

  setOccluded(on) {
    this.occluded = on;
  }

  emote(name, dur) {
    this.busy = dur || 1.5;
    this.anim = name === 'Dance' ? 'dance' : 'cheer';
  }

  loop(name) {
    this.busy = 999;
    this.anim = name === 'Dance' ? 'dance' : 'cheer';
  }

  release() {
    this.busy = 0;
  }

  teleport(x, y, z, facing) {
    this.pos.set(x, y, z);
    this.floorY = y;
    this.jumpY = 0;
    this.vy = 0;
    this.grounded = true;
    this.vel.set(0, 0, 0);
    if (facing !== undefined) this.facing = facing;
  }

  update(dt, ax, camYaw, collide, locked, jumpPressed) {
    const len = locked ? 0 : Math.hypot(ax.x, ax.y);
    const speed = 9;
    let tx = 0;
    let tz = 0;
    if (len > 0.05) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      tx = (ax.x * cos + ax.y * sin) * speed;
      tz = (-ax.x * sin + ax.y * cos) * speed;
      this.facing = angleDamp(this.facing, Math.atan2(tx, tz), 16, dt);
    }
    this.vel.x = damp(this.vel.x, tx, 18, dt);
    this.vel.z = damp(this.vel.z, tz, 18, dt);
    if (!locked) {
      const nx = this.pos.x + this.vel.x * dt;
      const nz = this.pos.z + this.vel.z * dt;
      const r = collide(nx, nz, 0.55);
      this.pos.x = r.x;
      this.pos.z = r.z;
    }
    if (jumpPressed && this.grounded && !locked) {
      this.vy = 8.5;
      this.grounded = false;
      this.audio.jump();
    }
    if (!this.grounded) {
      this.vy -= (this.vy > 0 ? 24 : 38) * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.grounded = true;
        this.land = 0.12;
      }
    }
    this.pos.y = this.floorY + this.jumpY;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    this.state = !this.grounded ? 'air' : moving ? 'run' : 'idle';
    if (this.busy > 0) this.busy -= dt;
    else this.anim = this.state;
    if (moving && this.grounded) {
      this.stepT += dt * Math.hypot(this.vel.x, this.vel.z);
      if (this.stepT > 2.4) {
        this.stepT = 0;
        this.audio.footstep();
      }
    }
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    let sq = 1;
    if (this.land > 0) {
      this.land -= dt;
      sq = 1 - Math.sin((this.land / 0.12) * Math.PI) * 0.12;
    }
    this.root.scale.set(2 - sq, sq, 2 - sq);
    if (this.hero) {
      const h = this.hero;
      const a = this.anim;
      h.mode = a === 'run' ? 'run' : a === 'air' ? 'air' : a === 'dance' ? 'film' : 'idle';
      h.walkSpeed = 1;
      if (a === 'cheer') h.cheerT = Math.max(h.cheerT, 0.1);
      h.update(dt, this.animT += dt);
      const go = this.occluded ? 0.6 : 0;
      this.ghostMat.opacity = damp(this.ghostMat.opacity, go, 12, dt);
      this.ghost.visible = this.ghostMat.opacity > 0.02;
    }
    this.shadow.position.set(this.pos.x, this.floorY + 0.03, this.pos.z);
    this.ring.position.set(this.pos.x, this.floorY + 0.05, this.pos.z);
    this.ring.rotation.z += dt * 1.2;
    this.shadow.scale.setScalar(1 - Math.min(0.5, this.jumpY * 0.12));
  }
}

const CAM_MIN_DIST = 7;
const CAM_MAX_PITCH = 0.85;
const CAM_CLEARANCE = 1.5;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.baseYaw = 0.34;
    this.yawOff = 0;
    this.yaw = this.baseYaw;
    this.pitch = 0.68;
    this.dist = 18;
    this.target = new THREE.Vector3();
    this.shakeT = 0;
    this.shakeA = 0;
    this.idleDrag = 0;
    this.goalPitch = 0.68;
    this.goalDist = 18;
    this.goalYaw = 0.34;
    this.minY = 2;
    this.boxes = [];
    this.pull = 1e9;
  }

  hitDist(ox, oy, oz, dx, dy, dz, len) {
    let best = len;
    const m = CAM_CLEARANCE;
    for (const b0 of this.boxes) {
      if (ox > b0[0] && ox < b0[1] && oy > b0[2] && oy < b0[3] && oz > b0[4] && oz < b0[5]) continue;
      const bi = [b0[0] - m, b0[1] + m, b0[2] - m, b0[3] + m, b0[4] - m, b0[5] + m];
      const inFoot = ox > bi[0] && ox < bi[1] && oz > bi[4] && oz < bi[5];
      const b = inFoot && ((oy > bi[2] && oy < bi[3]) || oy < b0[2]) ? b0 : bi;
      let t0 = 0;
      let t1 = best;
      const o = [ox, oy, oz];
      const d = [dx, dy, dz];
      let ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        const lo = b[k * 2];
        const hi = b[k * 2 + 1];
        if (Math.abs(d[k]) < 1e-9) {
          if (o[k] < lo || o[k] > hi) ok = false;
        } else {
          let a = (lo - o[k]) / d[k];
          let c = (hi - o[k]) / d[k];
          if (a > c) [a, c] = [c, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, c);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }

  shake(a = 0.2, t = 0.15) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  }

  snap(focus) {
    this.target.copy(focus);
    this.target.y += 1.4;
    this.pitch = this.goalPitch;
    this.dist = this.goalDist;
    this.yaw = this.goalYaw + this.yawOff;
    this.swing = 0;
    this.pull = this.dist;
    this.place(0);
    this.camera.lookAt(this.target);
  }

  clearAt(yaw, p) {
    const c = Math.cos(p);
    const dx = Math.sin(yaw) * c;
    const dy = Math.sin(p);
    const dz = Math.cos(yaw) * c;
    const L = this.dist + 0.6;
    const head = this.hitDist(this.target.x, this.target.y, this.target.z, dx, dy, dz, L);
    const feet = this.hitDist(this.target.x, this.target.y - 1.1, this.target.z, dx, dy, dz, L);
    return Math.min(head, feet) - 0.6;
  }

  place(dt) {
    const maxP = Math.max(this.pitch, CAM_MAX_PITCH);
    const need = this.dist * 0.9;
    const cur = this.swing || 0;
    const offs = [0, cur, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5];
    let pick = null;
    let best = null;
    let bestD = -1;
    for (const o of offs) {
      for (let b = 0; this.pitch + b <= maxP + 1e-6; b += 0.1) {
        const d = this.clearAt(this.yaw + o, this.pitch + b);
        if (d >= need) {
          pick = [o, b];
          break;
        }
        if (d > bestD + 0.5) {
          bestD = d;
          best = [o, b];
        }
      }
      if (pick) break;
    }
    pick = pick || best || [0, 0];
    this.swing = dt <= 0 ? pick[0] : damp(cur, pick[0], 3, dt);
    this.lift = dt <= 0 ? pick[1] : damp(this.lift || 0, pick[1], 4, dt);
    const pitch = Math.min(maxP, this.pitch + this.lift);
    this.viewYaw = this.yaw + this.swing;
    const cp = Math.cos(pitch);
    const dx = Math.sin(this.viewYaw) * cp;
    const dy = Math.sin(pitch);
    const dz = Math.cos(this.viewYaw) * cp;
    const hit = this.clearAt(this.viewYaw, pitch);
    const want = Math.max(Math.min(CAM_MIN_DIST, this.dist), Math.min(this.dist, hit));
    this.pull = want < this.pull || dt <= 0 ? want : damp(this.pull, want, 4, dt);
    const d = this.pull;
    this.camera.position.set(this.target.x + dx * d, Math.max(this.minY, this.target.y + dy * d), this.target.z + dz * d);
  }

  update(dt, drag, focus) {
    if (drag) {
      this.yawOff = clamp(this.yawOff - drag * 0.005, -1.0, 1.0);
      this.idleDrag = 0;
    } else {
      this.idleDrag += dt;
      if (this.idleDrag > 4) this.yawOff = damp(this.yawOff, 0, 1.5, dt);
    }
    this.pitch = Math.max(0.35, damp(this.pitch, this.goalPitch, 3, dt));
    this.dist = damp(this.dist, this.goalDist, 3, dt);
    this.yaw = damp(this.yaw, this.goalYaw + this.yawOff, 5, dt);
    this.target.x = damp(this.target.x, focus.x, 9, dt);
    this.target.y = damp(this.target.y, focus.y + 1.4, 7, dt);
    this.target.z = damp(this.target.z, focus.z, 9, dt);
    this.place(dt);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT / 0.15);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    } else this.shakeA = 0;
    this.camera.lookAt(this.target);
  }
}
