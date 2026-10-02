import * as THREE from 'three';

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _look = new THREE.Vector3();
const MIN_DIST = 2.8;

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0.36;
    this.dist = 8.0;
    this.distTarget = 8.0;
    this.curDist = 8.0;
    this.target = new THREE.Vector3();
    this.baseFov = 62;
    this.fovKick = 0;
    this.shake = 0;
    this.mode = 'follow';
    this.orbitT = 0;
    this.lookAhead = new THREE.Vector3();
    this.frozenY = null;
    this.lift = 0;
    this.watch = null;
    this.watchK = 0;
    this.flightK = 0;
  }

  dirAt(pitch) {
    const cp = Math.cos(pitch);
    _d.set(Math.sin(this.yaw) * cp, Math.sin(pitch), Math.cos(this.yaw) * cp);
  }

  snap(pos, yaw = this.yaw) {
    this.yaw = yaw;
    this.target.set(pos.x, pos.y + 1.4, pos.z);
    this.curDist = this.dist;
    this.lookAhead.set(0, 0, 0);
    this.frozenY = null;
    this.lift = 0;
    this.watch = null;
    this.watchK = 0;
    this.flightK = 0;
  }

  kick(amount) {
    this.fovKick = Math.max(this.fovKick, amount);
  }

  addShake(a) {
    this.shake = Math.max(this.shake, a);
  }

  applyLook(look, touch) {
    const sens = touch ? 0.006 : 0.0055;
    this.yaw -= look.x * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y * sens, -0.15, 1.25);
    if (look.zoom) this.distTarget = THREE.MathUtils.clamp(this.distTarget + look.zoom * 1.2, 4.5, 17);
  }

  follow(dt, player, world) {
    const p = player.pos;
    const ty = this.frozenY !== null ? this.frozenY : p.y + 1.4;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const fwd = Math.max(0, player.vel.x * fx + player.vel.z * fz) * 0.18;
    const la = _t.set(fx * fwd, 0, fz * fwd);
    this.lookAhead.lerp(la, 1 - Math.exp(-3 * dt));
    const kx = this.frozenY !== null ? 0 : 1 - Math.exp(-11 * dt);
    const ky = 1 - Math.exp(-(player.grounded ? 9 : 5) * dt);
    this.target.x += (p.x + this.lookAhead.x - this.target.x) * kx;
    this.target.z += (p.z + this.lookAhead.z - this.target.z) * kx;
    this.target.y += (ty - this.target.y) * ky;
    this.dist += (this.distTarget - this.dist) * (1 - Math.exp(-8 * dt));
    let want = this.dist;
    let lift = 0;
    if (world) {
      for (let k = 0; k < 5; k++) {
        lift = Math.min(k * 0.22, 1.4 - this.pitch);
        this.dirAt(this.pitch + lift);
        want = world.raycast(this.target, _d, this.dist) - 0.35;
        if (want >= Math.min(this.dist, 3.6)) break;
      }
      want = Math.max(MIN_DIST, want);
    }
    this.lift += (lift - this.lift) * (1 - Math.exp(-(lift > this.lift ? 14 : 3) * dt));
    if (this.watch) this.watchK = Math.min(1, this.watchK + dt * 4);
    const aim = player.padFlight && !player.grounded && player.aim ? player.aim.target : null;
    this.flightK += ((aim ? 1 : 0) - this.flightK) * (1 - Math.exp(-(aim ? 3 : 6) * dt));
    const pitch = this.pitch + this.lift;
    this.dirAt(pitch + this.watchK * Math.max(0, 0.48 - pitch) - this.flightK * Math.max(0, pitch - 0.12));
    const kd = want < this.curDist ? 1 - Math.exp(-25 * dt) : 1 - Math.exp(-4 * dt);
    this.curDist += (want - this.curDist) * kd;
    this.cam.position.copy(this.target).addScaledVector(_d, this.curDist);
    const minY = this.target.y - 1.2;
    if (this.cam.position.y < minY && this.pitch < 0) this.cam.position.y = minY;
    _look.copy(this.target);
    if (this.watch) {
      _t.copy(this.watch);
      _t.y = Math.max(_t.y, this.target.y - 3.5);
      _look.lerp(_t, this.watchK * 0.25);
    }
    if (aim) {
      this.flightAt = this.flightAt || new THREE.Vector3();
      this.flightAt.set(aim.x, aim.y + 0.5, aim.z);
    }
    if (this.flightK > 0.01 && this.flightAt) _look.lerp(this.flightAt, this.flightK * 0.45);
    this.applyShake(dt);
    this.cam.lookAt(_look);
    this.updateFov(dt);
  }

  orbit(dt, center, radius, height, speed, sideOffset = 0) {
    this.orbitT += dt * speed;
    const a = this.orbitT;
    this.cam.position.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
    _look.set(center.x, center.y + 1.1, center.z);
    if (sideOffset) {
      _d.set(Math.cos(a), 0, -Math.sin(a));
      _look.addScaledVector(_d, -sideOffset);
    }
    this.cam.lookAt(_look);
    this.updateFov(dt);
  }

  applyShake(dt) {
    if (this.shake > 0) {
      const s = this.shake;
      _look.x += (Math.random() - 0.5) * s;
      _look.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
  }

  updateFov(dt) {
    this.fovKick = Math.max(0, this.fovKick - dt * 18);
    const f = this.baseFov + this.fovKick;
    if (Math.abs(this.cam.fov - f) > 0.01) {
      this.cam.fov += (f - this.cam.fov) * (1 - Math.exp(-10 * dt));
      this.cam.updateProjectionMatrix();
    }
  }
}
