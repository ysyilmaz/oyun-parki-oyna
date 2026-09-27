import * as THREE from 'three';
import { buildAvatar, AvatarAnimator } from './avatar.js';
import { heightAt, gateX } from './world.js';
import { Z_MIN, Z_MAX, ZONE_W } from './data.js';
import { angleDamp, clamp, damp } from './util.js';

export function blobShadow() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}

export class Player {
  constructor(scene, fx, audio) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pos = new THREE.Vector3(-10, 0, 12);
    this.vel = new THREE.Vector3();
    this.facing = Math.PI;
    this.vy = 0;
    this.jumpY = 0;
    this.grounded = true;
    this.actions = {};
    this.current = null;
    this.busy = 0;
    this.punchCd = 0;
    this.stepT = 0;
    this.maxX = gateX(1) - 1;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), blobShadow());
    sh.rotation.x = -Math.PI / 2;
    sh.renderOrder = 2;
    scene.add(sh);
    this.shadow = sh;
  }

  load() {
    const rig = buildAvatar();
    this.rig = rig;
    this.model = rig.root;
    this.anim = new AvatarAnimator(rig);
    this.animState = { name: 'idle', t: 0, speed: 0 };
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3aa0ff, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, opacity: 0.62, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
    const ghost = rig.root.clone(true);
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = ghostMat;
        o.renderOrder = 5;
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (o.userData.outline) o.visible = false;
      }
    });
    this.ghostSrc = [];
    this.ghostDst = [];
    rig.root.traverse((o) => this.ghostSrc.push(o));
    ghost.traverse((o) => this.ghostDst.push(o));
    this.ghost = ghost;
    this.root.add(ghost);
    this.root.add(rig.root);
    return Promise.resolve();
  }

  get animName() {
    return this.animState ? this.animState.name : 'none';
  }

  fadeTo(name) {
    if (!this.animState || this.animState.name === name) return;
    this.animState.name = name;
    this.animState.t = 0;
  }

  emote(name, dur) {
    this.busy = dur || 2;
    if (this.animState) {
      this.animState.name = name;
      this.animState.t = 0;
    }
  }

  punch() {
    if (this.punchCd > 0) return false;
    this.punchCd = 0.36;
    this.busy = 0.36;
    if (this.animState) {
      this.animState.name = 'punch';
      this.animState.t = 0;
    }
    return true;
  }

  update(dt, input, camYaw, world, speedMult, breakables, maxZone) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    const ax = input.axis();
    const len = Math.hypot(ax.x, ax.y);
    const speed = 9.5 * speedMult;
    let tx = 0;
    let tz = 0;
    if (len > 0.05) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      tx = (ax.x * cos + ax.y * sin) * speed;
      tz = (-ax.x * sin + ax.y * cos) * speed;
      this.facing = angleDamp(this.facing, Math.atan2(tx, tz), 14, dt);
    }
    this.vel.x = damp(this.vel.x, tx, 14, dt);
    this.vel.z = damp(this.vel.z, tz, 14, dt);
    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    const r = 0.6;
    this.maxX = maxZone >= 5 ? 5 * ZONE_W + ZONE_W / 2 - 2 : gateX(maxZone + 1) - 1.2;
    for (let i = 1; i <= 5; i++) {
      const gx = gateX(i);
      const crossing = (this.pos.x < gx && nx >= gx - 0.6) || (this.pos.x > gx && nx <= gx + 0.6);
      if (crossing && Math.abs(nz) > 3.2 && Math.abs(this.pos.x - gx) < 2.5) {
        nx = this.pos.x < gx ? Math.min(nx, gx - 0.8) : Math.max(nx, gx + 0.8);
      }
    }
    nx = clamp(nx, -ZONE_W / 2 + 1.5, this.maxX);
    nz = clamp(nz, Z_MIN, Z_MAX);
    const near = world.grid.query(nx, nz, r, []);
    let bumped = null;
    for (const c of near) {
      const dx = nx - c.x;
      const dz = nz - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 0.0001) {
        nx = c.x + (dx / d) * min;
        nz = c.z + (dz / d) * min;
        if (c.data && c.data.breakable) bumped = c.data.breakable;
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    const gy = heightAt(nx, nz);
    if (input.consumeJump && this.grounded) {
      this.vy = 9;
      this.grounded = false;
      this.fx.dust(nx, gy, nz, 6);
      if (this.busy <= 0) this.fadeTo('jump');
    }
    if (!this.grounded) {
      this.vy -= 26 * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.grounded = true;
        this.fx.dust(nx, gy, nz, 8);
        this.audio.land();
        this.land = 0.12;
      }
    }
    this.pos.y = gy + this.jumpY;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1;
    this.base = !this.grounded ? 'jump' : moving ? 'run' : 'idle';
    if (this.busy > 0) this.busy -= dt;
    else this.fadeTo(this.base);
    if (moving && this.grounded) {
      this.stepT += dt * Math.hypot(this.vel.x, this.vel.z);
      if (this.stepT > 2.6) {
        this.stepT = 0;
        this.fx.dust(nx, gy, nz, 2);
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
    if (this.anim) {
      this.animState.t += dt;
      this.animState.speed = Math.hypot(this.vel.x, this.vel.z);
      this.anim.update(dt, this.animState);
    }
    if (this.ghost && this.ghost.visible) {
      const src = this.ghostSrc;
      const dst = this.ghostDst;
      for (let i = 0; i < src.length; i++) {
        const a = src[i];
        const d = dst[i];
        d.position.copy(a.position);
        d.quaternion.copy(a.quaternion);
        d.scale.copy(a.scale);
      }
    }
    this.shadow.position.set(nx, gy + 0.06, nz);
    const ss = 1 - Math.min(0.5, this.jumpY * 0.12);
    this.shadow.scale.setScalar(ss);
    let hitTarget = null;
    if (bumped && bumped.alive && len > 0.05) {
      const bx = bumped.x - this.pos.x;
      const bz = bumped.z - this.pos.z;
      const into = (tx * bx + tz * bz) / ((Math.hypot(tx, tz) * Math.hypot(bx, bz)) || 1);
      if (into > 0.5) hitTarget = bumped;
    }
    return { hitTarget, moving };
  }
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.72;
    this.dist = 20;
    this.target = new THREE.Vector3();
    this.shakeT = 0;
    this.shakeA = 0;
    this.auto = false;
    this.lift = 0;
    this.occluded = false;
  }

  shake(a = 0.25, t = 0.12) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  }

  update(dt, input, focus) {
    this.yaw -= input.dx * 0.0055;
    this.pitch = clamp(this.pitch + input.dy * 0.004, 0.25, 1.25);
    this.dist = clamp(this.dist + input.zoom, 8, 32);
    this.target.x = damp(this.target.x, focus.x, 10, dt);
    this.target.y = damp(this.target.y, focus.y + 1.6, 6, dt);
    this.target.z = damp(this.target.z, focus.z, 10, dt);
    this.lift = damp(this.lift, this.occluded ? Math.max(0, 1.2 - this.pitch) : 0, 3, dt);
    const pitch = this.pitch + this.lift;
    const cp = Math.cos(pitch);
    const x = this.target.x + Math.sin(this.yaw) * cp * this.dist;
    const z = this.target.z + Math.cos(this.yaw) * cp * this.dist;
    let y = this.target.y + Math.sin(pitch) * this.dist;
    y = Math.max(y, heightAt(x, z) + 1.5);
    this.camera.position.set(x, y, z);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT / 0.12);
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    } else this.shakeA = 0;
    this.camera.lookAt(this.target);
  }
}
