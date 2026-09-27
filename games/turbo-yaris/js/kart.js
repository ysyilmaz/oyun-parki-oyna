import * as THREE from 'three';
import { createCar, assets, WHEEL_R } from './assets.js';
import { tickRainbow } from './paints.js';

export const MAX_SPEED = 38;
const ACCEL = 21;
const BRAKE = 36;
const GRAVITY = 24;
export const DRIFT_LEVELS = [0.8, 1.6, 2.5];
const DRIFT_BOOST = [0, 0.7, 1.1, 1.6];
const PAD_BOOST = 1.0;
export const SPARK_COLORS = [[1.0, 0.9, 0.6], [0.35, 0.7, 2.6], [2.6, 1.1, 0.15], [1.8, 0.4, 2.6]];

const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Kart {
  constructor(race, { isPlayer, paint, name, skill = 1, robotColor }) {
    this.race = race;
    this.track = race.track;
    this.isPlayer = isPlayer;
    this.paint = paint;
    this.name = name;
    this.skill = skill;
    this.robotColor = robotColor;
    const car = createCar(paint, isPlayer ? 'high' : 'low');
    this.car = car;
    this.obj = car.group;
    this.x = 0; this.z = 0; this.y = 0; this.vy = 0;
    this.vx = 0; this.vz = 0;
    this.heading = 0;
    this.fwd = 0;
    this.steer = 0;
    this.grounded = true;
    this.airT = 0;
    this.groundVy = 0;
    this.p = { i: 0, s: 0, lat: 0, y: 0 };
    this.hint = -1;
    this.dist = 0;
    this.lap = 1;
    this.maxLapSeen = 1;
    this.finished = false;
    this.finishTime = 0;
    this.lapStart = 0;
    this.lapTimes = [];
    this.drift = { active: false, dir: 0, charge: 0, level: 0 };
    this.boostT = 0;
    this.spinT = 0;
    this.spinAngle = 0;
    this.shieldT = 0;
    this.item = null;
    this.rouletteT = 0;
    this.pendingItem = null;
    this.invulnT = 0;
    this.stuckT = 0;
    this.wallStuckT = 0;
    this.wallRecent = 0;
    this.moveSpd = 0;
    this.wrongT = 0;
    this.offroad = false;
    this.onCurb = false;
    this.trick = false;
    this.trickT = 0;
    this.wheelSpin = 0;
    this.visualYaw = 0;
    this.lean = 0;
    this.squash = 0;
    this.control = { steer: 0, gas: false, brake: false, drift: false };
    this.ai = {
      lane: (Math.random() - 0.5) * 5,
      laneTarget: 0,
      laneT: 0,
      itemDelay: 2 + Math.random() * 3,
      wobble: Math.random() * 10,
      mul: 1
    };
    this.grip = 11;
    this.buildExtras();
  }

  buildExtras() {
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.2, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.flameMat = flameMat;
    const geo = new THREE.ConeGeometry(0.16, 1, 10, 1, true);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -0.5);
    this.flames = [-0.42, 0.42].map(x => {
      const m = new THREE.Mesh(geo, flameMat);
      m.position.set(x * 0.86, 0.6, -2.1);
      m.scale.set(1, 1, 0.001);
      m.visible = false;
      this.obj.add(m);
      return m;
    });
    this.shield = new THREE.Mesh(this.race.shared.shieldGeo, this.race.shared.shieldMat);
    this.shield.visible = false;
    this.shield.position.y = 0.85;
    this.shield.scale.set(1.7, 1.3, 2.7);
    this.obj.add(this.shield);
  }

  placeAt(s, lat) {
    const pt = this.track.pointAt(s, lat);
    this.x = pt.x; this.z = pt.z; this.y = pt.y;
    this.heading = pt.heading;
    this.vx = this.vz = this.vy = 0;
    this.fwd = 0;
    this.hint = -1;
    this.track.project(this.x, this.z, -1, this.p);
    this.hint = this.p.i;
    this.dist = s > this.track.L / 2 ? s - this.track.L : s;
    this.lastS = this.p.s;
    this.syncVisual(0, 0);
  }

  get speedRatio() { return Math.min(1.4, Math.abs(this.fwd) / MAX_SPEED); }

  step(dt, now, racing) {
    const tr = this.track;
    const c = this.control;
    let steerIn = c.steer, gas = c.gas, brake = c.brake, driftBtn = c.drift;
    if (!racing) { steerIn = 0; gas = false; brake = false; driftBtn = false; this.vx = this.vz = 0; }
    if (this.spinT > 0) {
      this.spinT -= dt;
      steerIn = 0; gas = false; brake = false; driftBtn = false;
      this.spinAngle += dt * 13;
    } else this.spinAngle *= Math.max(0, 1 - dt * 10);
    this.boostT = Math.max(0, this.boostT - dt);
    this.guideT = Math.max(0, (this.guideT || 0) - dt);
    const guard = this.isPlayer && racing && this.spinT <= 0 && (this.race.easy || this.guideT > 0);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    if (this.isPlayer) {
      const growing = Math.abs(steerIn) > Math.abs(this.steer) && (Math.sign(steerIn) === Math.sign(this.steer) || this.steer === 0);
      const rate = growing ? (this.race.easy ? 4.2 - 1.8 * Math.min(1, Math.abs(this.fwd) / MAX_SPEED) : 4.2) : 9;
      this.steer += Math.max(-rate * dt, Math.min(rate * dt, steerIn - this.steer));
    } else this.steer += (steerIn - this.steer) * Math.min(1, dt * 6);
    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.fwd = this.vx * fx + this.vz * fz;
    const sa = Math.abs(this.fwd);
    const d = this.drift;
    if (!d.active && driftBtn && this.grounded && Math.abs(steerIn) > 0.3 && this.fwd > 13 && this.spinT <= 0) {
      d.active = true;
      d.dir = Math.sign(steerIn);
      d.charge = 0;
      d.level = 0;
      this.vy = 3.2;
      this.grounded = false;
      this.hop = true;
    }
    if (d.active) {
      if (!driftBtn || this.fwd < 9 || this.spinT > 0) this.endDrift(true);
      else {
        const inward = this.steer * d.dir;
        d.charge += dt * (0.85 + 0.3 * Math.max(0, inward));
        const lvl = d.charge >= DRIFT_LEVELS[2] ? 3 : d.charge >= DRIFT_LEVELS[1] ? 2 : d.charge >= DRIFT_LEVELS[0] ? 1 : 0;
        if (lvl > d.level) { d.level = lvl; if (this.isPlayer) this.race.onDriftLevel(lvl); }
      }
    }
    const turnScale = Math.min(1, sa / 5) * (1 - 0.42 * Math.min(1, sa / MAX_SPEED));
    let dh;
    if (d.active) {
      const inward = this.steer * d.dir;
      dh = guard ? -2.35 * turnScale * this.steer : -d.dir * 2.35 * turnScale * (0.62 + 0.38 * inward);
    } else {
      dh = -this.steer * 2.35 * turnScale * Math.sign(this.fwd || 1);
    }
    if (!this.grounded && !this.hop) dh *= 0.35;
    if (guard) dh = this.race.guardYaw(this, dh);
    this.heading += dh * dt;
    fx = Math.sin(this.heading); fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    let fwd = this.vx * fx + this.vz * fz;
    let lat = this.vx * rx + this.vz * rz;
    const boostMul = this.boostT > 0 ? 1.34 : 1;
    const offMul = this.offroad && this.boostT <= 0 ? 0.58 : 1;
    const maxS = MAX_SPEED * boostMul * offMul * (this.isPlayer ? (this.maxMul || 1) : this.ai.mul);
    if (this.grounded || this.hop) {
      if (this.boostT > 0) fwd = Math.min(maxS, fwd + 48 * dt);
      if (gas) {
        if (fwd < maxS) fwd = Math.min(maxS, fwd + ACCEL * dt * (1 - 0.55 * Math.max(0, fwd / maxS) ** 2) * (fwd < 0 ? 2 : 1));
      } else if (brake) {
        if (fwd > 0.5) fwd -= BRAKE * dt;
        else fwd = Math.max(-11, fwd - 14 * dt);
      } else {
        fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 5 * dt);
      }
      if (fwd > maxS) fwd -= (fwd - maxS) * Math.min(1, (this.offroad ? 2.4 : 1.4) * dt);
    }
    if (this.spinT > 0) fwd *= Math.max(0, 1 - 2.2 * dt);
    const grip = d.active ? (guard ? 7 : 3.4) : (!this.grounded ? 0.8 : this.grip);
    lat *= Math.exp(-grip * dt);
    this.vx = fx * fwd + rx * lat;
    this.vz = fz * fwd + rz * lat;
    this.fwd = fwd;
    const x0 = this.x, z0 = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    tr.project(this.x, this.z, this.hint, this.p);
    this.hint = this.p.i;
    const p = this.p;
    let ds = p.s - this.lastS;
    if (ds < -tr.L / 2) ds += tr.L;
    if (ds > tr.L / 2) ds -= tr.L;
    this.dist += ds;
    this.lastS = p.s;
    if (racing && this.grounded && this.spinT <= 0) this.checkPads();

    const alat = Math.abs(p.lat);
    this.offroad = alat > tr.halfRoad + 0.6 && tr.rampHeight(p.s, 0) === 0;
    this.onCurb = !this.offroad && alat > tr.halfRoad - 0.4 && this.race.isCurb(p.i);
    const limit = tr.halfWall - 1.05;
    this.wallRecent = Math.max(0, this.wallRecent - dt);
    if (alat > limit) {
      this.wallRecent = 0.3;
      const sgn = Math.sign(p.lat);
      const nx = p.rx * sgn, nz = p.rz * sgn;
      const over = alat - limit;
      this.x -= nx * over;
      this.z -= nz * over;
      const vn = this.vx * nx + this.vz * nz;
      if (vn > 0) {
        this.vx -= nx * vn * 1.3;
        this.vz -= nz * vn * 1.3;
        const sp = Math.hypot(this.vx, this.vz) || 1;
        const loss = 1 - 0.22 * Math.min(1, vn / sp);
        this.vx *= loss; this.vz *= loss;
        const th = Math.atan2(p.tx, p.tz);
        const diff = wrapAngle(th - this.heading);
        if (Math.abs(diff) < Math.PI / 2) this.heading += diff * 0.35;
        if (vn > 9 && d.active) this.endDrift(false);
        this.race.onWallHit(this, vn, this.x + nx * 1.1, this.z + nz * 1.1);
      }
    }

    const g = tr.groundY(p);
    if (this.grounded) {
      if (g < this.y - 0.2) {
        this.grounded = false;
        this.vy = Math.max(0, this.groundVy);
        this.airT = 0;
        this.trick = false;
        this.race.onLaunch(this, this.vy);
      } else {
        this.groundVy = (g - this.y) / dt;
        this.y = g;
      }
    } else {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      this.airT += dt;
      if (this.y <= g) {
        this.y = g;
        const wasBig = this.airT > 0.35;
        this.grounded = true;
        this.groundVy = 0;
        if (this.hop) this.hop = false;
        else if (wasBig) {
          this.squash = 1;
          this.race.onLand(this, this.trick);
        }
        this.vy = 0;
      }
    }

    if (racing && this.spinT <= 0) {
      const wantGo = gas && !this.finished;
      if (wantGo && Math.abs(this.fwd) < 2.2) this.stuckT += dt; else this.stuckT = 0;
      if (this.stuckT > (this.isPlayer && this.wallRecent > 0 ? 3.0 : 1.0)) this.respawn();
      this.moveSpd += (Math.hypot(this.x - x0, this.z - z0) / dt - this.moveSpd) * Math.min(1, dt * 6);
      if (wantGo && this.wallRecent > 0 && this.moveSpd < 2.5) this.wallStuckT += dt; else this.wallStuckT = 0;
      if (this.wallStuckT > 2.0 && !this.wallStuckShown) { this.wallStuckShown = true; this.race.onWallStuck(this); }
      if (this.wallStuckT === 0) this.wallStuckShown = false;
      if (alat > tr.halfWall + 2 || this.y < g - 6) this.respawn();
      const th = Math.atan2(p.tx, p.tz);
      const dd = Math.abs(wrapAngle(th - this.heading));
      if (dd > 1.9 && Math.abs(this.fwd) > 2) this.wrongT += dt; else this.wrongT = Math.max(0, this.wrongT - dt * 2);
      if (this.wrongT > 2.8) { this.wrongT = 0; this.respawn(); }
    }
    this.wheelSpin += this.fwd * dt / WHEEL_R;
  }

  checkPads() {
    const tr = this.track;
    const extra = this.isPlayer && this.race.easy ? 1.5 : 0.6;
    let on = -1;
    for (let i = 0; i < tr.pads.length; i++) {
      const pad = tr.pads[i];
      let d = this.p.s - pad.s;
      if (d < -tr.L / 2) d += tr.L;
      if (d >= 0 && d <= pad.len && Math.abs(this.p.lat - pad.lat) < pad.halfW + extra) { on = i; break; }
    }
    if (on >= 0 && on !== this.padOn) {
      this.boostT = Math.max(this.boostT, PAD_BOOST);
      this.race.onPad(this);
    }
    this.padOn = on;
  }

  endDrift(reward) {
    const d = this.drift;
    if (reward && d.level > 0) {
      this.boostT = Math.max(this.boostT, DRIFT_BOOST[d.level]);
      this.race.onMiniTurbo(this, d.level);
    }
    d.active = false;
    d.charge = 0;
    d.level = 0;
  }

  respawn() {
    const tr = this.track;
    const s = this.p.s - 4;
    const pt = tr.pointAt(s, 0);
    this.x = pt.x; this.z = pt.z; this.y = pt.y + tr.rampHeight(tr.wrapS(s), 0);
    this.heading = pt.heading;
    this.vx = this.vz = this.vy = 0;
    this.fwd = 0;
    this.grounded = true;
    this.drift.active = false;
    this.spinT = 0;
    this.stuckT = 0;
    this.invulnT = 1.5;
    this.hint = -1;
    tr.project(this.x, this.z, -1, this.p);
    this.hint = this.p.i;
    let ds = this.p.s - this.lastS;
    if (ds < -tr.L / 2) ds += tr.L;
    if (ds > tr.L / 2) ds -= tr.L;
    this.dist += ds;
    this.lastS = this.p.s;
    this.race.onRespawn(this);
  }

  hit(kind) {
    if (this.invulnT > 0 || this.spinT > 0) return false;
    if (this.shieldT > 0) {
      this.shieldT = 0;
      this.race.onShieldPop(this);
      return false;
    }
    this.spinT = 1.1;
    this.invulnT = 2.1;
    this.endDrift(false);
    this.boostT = 0;
    this.race.onSpin(this, kind);
    return true;
  }

  aiThink(dt, racers, player, hazards) {
    const tr = this.track;
    const p = this.p;
    const a = this.ai;
    const look = 8 + Math.max(0, this.fwd) * 0.5;
    const ti = tr.w(p.i + Math.round(look / tr.ds));
    a.laneT -= dt;
    if (a.laneT <= 0) { a.laneTarget = (Math.random() - 0.5) * 5; a.laneT = 2 + Math.random() * 3; }
    let avoid = 0;
    for (const o of racers) {
      if (o === this) continue;
      let ahead = o.dist - this.dist;
      if (ahead > 0 && ahead < 11) {
        const dl = o.p.lat - p.lat;
        if (Math.abs(dl) < 2.6) avoid += (dl >= 0 ? -1 : 1) * (2.8 - Math.abs(dl)) * 1.4;
      }
    }
    for (const h of hazards) {
      let ahead = h.s - p.s;
      if (ahead < -tr.L / 2) ahead += tr.L;
      if (ahead > 0 && ahead < 26) {
        const dl = h.lat - p.lat;
        if (Math.abs(dl) < 3) avoid += (dl >= 0 ? -1 : 1) * 3;
      }
    }
    a.lane += (a.laneTarget - a.lane) * Math.min(1, dt * 0.8);
    let pull = 0;
    for (const pad of tr.pads) {
      let ahead = pad.s - p.s;
      if (ahead < -tr.L / 2) ahead += tr.L;
      if (ahead > -pad.len && ahead < 35) { pull = (pad.lat - tr.line[ti] * 0.8 - a.lane) * this.race.diff.padAim; break; }
    }
    const maxLat = tr.halfRoad - 1.8;
    const lt = THREE.MathUtils.clamp(tr.line[ti] * 0.8 + a.lane + avoid + pull + Math.sin(this.race.time * 0.7 + a.wobble) * 0.6, -maxLat, maxLat);
    const tx = tr.px[ti] + tr.rx[ti] * lt, tz = tr.pz[ti] + tr.rz[ti] * lt;
    const desired = Math.atan2(tx - this.x, tz - this.z);
    const diff = wrapAngle(desired - this.heading);
    const steer = THREE.MathUtils.clamp(-diff * 2.6, -1, 1);
    let vt = 99;
    for (let k = 0; k < 16; k++) vt = Math.min(vt, tr.vmax[tr.w(p.i + k)]);
    const gap = this.dist - player.dist;
    const df = this.race.diff;
    let rb = 1;
    if (gap > 25) rb = 1 - Math.min(df.slow, (gap - 25) / 700);
    else if (gap < -40) rb = 1 + Math.min(df.catchUp, (-gap - 40) / 600);
    a.mul = this.skill * rb * df.ai;
    vt = Math.min(vt * (0.9 + 0.1 * this.skill), MAX_SPEED * a.mul * (this.boostT > 0 ? 1.34 : 1));
    this.control.steer = steer;
    this.control.gas = this.fwd < vt;
    this.control.brake = this.fwd > vt + 4;
    this.control.drift = false;
    if (this.item) {
      a.itemDelay -= dt;
      if (a.itemDelay <= 0) {
        this.race.items.use(this);
        a.itemDelay = this.race.diff.itemDelay + Math.random() * 4;
      }
    }
  }

  syncVisual(dt, time) {
    const o = this.obj;
    o.position.set(this.x, this.y, this.z);
    const tr = this.track;
    const d = this.drift;
    const driftYaw = d.active ? d.dir * -0.32 : 0;
    this.visualYaw += (driftYaw - this.visualYaw) * Math.min(1, dt * 8);
    const leanT = (d.active ? d.dir * 0.07 : this.steer * 0.045 * this.speedRatio);
    this.lean += (leanT - this.lean) * Math.min(1, dt * 6);
    let pitch = -Math.atan(this.p.slope || 0);
    if (!this.grounded && !this.hop) pitch = THREE.MathUtils.clamp(-this.vy * 0.025, -0.35, 0.35);
    let roll = this.lean;
    if (this.trick) { this.trickT = Math.min(1, this.trickT + dt * 2.4); roll += this.trickT * Math.PI * 2; } else this.trickT = 0;
    o.rotation.set(pitch, this.heading + this.visualYaw + this.spinAngle, roll, 'YXZ');
    this.squash = Math.max(0, this.squash - dt * 5);
    const ch = this.car.chassis;
    ch.position.y = -this.squash * 0.12 + (this.onCurb ? Math.sin(time * 70) * 0.025 : 0) + (this.offroad ? Math.sin(time * 40) * 0.02 : 0);
    const w = this.car.wheels;
    for (let i = 0; i < 4; i++) w[i].rotation.x = this.wheelSpin;
    const st = -this.steer * 0.42;
    w[0].rotation.y = st;
    w[1].rotation.y = st;
    const gy = tr.groundY(this.p);
    this.car.shadow.position.y = Math.min(0.02, gy - this.y + 0.02);
    const air = this.y - gy;
    this.car.shadow.material.opacity = Math.max(0.3, 1 - air * 0.15);
    const b = this.boostT > 0;
    for (const f of this.flames) {
      f.visible = b;
      if (b) f.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.3, 0.8 + Math.random() * 0.7);
    }
    if (b) this.flameMat.color.setRGB(2.4, 1.1 + Math.random() * 0.3, 0.3);
    this.shield.visible = this.shieldT > 0 && (this.shieldT > 1.5 || Math.floor(time * 10) % 2 === 0);
    o.visible = this.invulnT <= 0 || Math.floor(time * 8) % 2 === 0;
    tickRainbow(this.car.bodyMat, time);
  }
}

export function sharedKartAssets() {
  const shieldMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); vec3 c = mix(vec3(0.2,0.7,1.6), vec3(1.2,0.5,1.8), 0.5+0.5*sin(time*3.0)); gl_FragColor = vec4(c * (0.25 + f * 1.6), 0.15 + f * 0.8); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return { shieldGeo: new THREE.SphereGeometry(1, 24, 16), shieldMat, assets };
}
