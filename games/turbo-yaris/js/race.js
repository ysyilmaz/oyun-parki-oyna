import * as THREE from 'three';
import { Track, buildTrackMeshes } from './track.js';
import { buildWorld } from './world.js';
import { Kart, MAX_SPEED, SPARK_COLORS, sharedKartAssets } from './kart.js';
import { Items } from './items.js';
import { Particles, SkidMarks, Confetti } from './effects.js';
import { sparkTexture, smokeTexture } from './textures.js';
import { PAINTS, cssColor } from './paints.js';
import { assets } from './assets.js';
import { input } from './input.js';
import { sound } from './audio.js';
import { ICONS } from './hud.js';

const REVERSE_ICON = '<svg viewBox="0 0 64 64"><rect x="4" y="3" width="56" height="9" rx="3" fill="#fff"/><path d="M8 3h8l-5 9H3zM28 3h8l-5 9h-8zM48 3h8l-5 9h-8z" fill="#ff3b4a"/><rect x="9" y="19" width="6" height="10" rx="2" fill="#111"/><rect x="31" y="19" width="6" height="10" rx="2" fill="#111"/><rect x="9" y="40" width="6" height="10" rx="2" fill="#111"/><rect x="31" y="40" width="6" height="10" rx="2" fill="#111"/><rect x="13" y="15" width="20" height="38" rx="8" fill="#ffd21f" stroke="#111" stroke-width="3"/><path d="M52 18v26" stroke="#3bff8a" stroke-width="7" stroke-linecap="round"/><path d="M42 40l10 16 10-16z" fill="#3bff8a" stroke="#0b3a1c" stroke-width="2" stroke-linejoin="round"/></svg>';
const DRIFT_ICON ='<svg viewBox="0 0 64 64"><path d="M8 46c14-2 18-24 34-28" fill="none" stroke="#ffb31a" stroke-width="7" stroke-linecap="round"/><path d="M36 8l20 8-14 14z" fill="#ffb31a"/><circle cx="12" cy="54" r="5" fill="#5ab8ff"/><circle cx="24" cy="52" r="4" fill="#c63bff"/></svg>';

const STEER_KEYS = '<span class="kc">←</span><span class="kc">→</span><span class="alt">veya <b>A</b><b>D</b></span>';
const GAS_KEYS = '<span class="kc">↑</span><span class="alt">veya <b>W</b></span>';
const IDLE_HINT_T = 1.5;
const YAW_FREE = 0.1;
const YAW_FADE = 0.14;
const GUIDE_T = 1.9;
const CATCH_UP = 1.06;

export const LAPS = 3;
const STEP = 1 / 60;
const GO_T = 3.6;
const AI_NAMES = ['Roket', 'Şimşek', 'Kaplan', 'Bulut', 'Yıldız'];
const AI_SKILL = [0.95, 0.92, 0.9, 0.88, 0.85];
export const DIFFS = {
  easy: { ai: 0.97, slow: 0.16, catchUp: 0.05, itemDelay: 3.5, assist: 'smart', coins: 1, padAim: 0 },
  normal: { ai: 1.0, slow: 0.12, catchUp: 0.1, itemDelay: 2.5, assist: 'wall', coins: 1.25, padAim: 0.85 },
  hard: { ai: 1.075, slow: 0.04, catchUp: 0.08, itemDelay: 1.2, assist: 'none', coins: 1.5, padAim: 0.85 }
};

export class Race {
  constructor(app, def, opts) {
    this.app = app;
    this.def = def;
    this.opts = opts;
    this.difficulty = DIFFS[opts.difficulty] ? opts.difficulty : 'easy';
    this.diff = DIFFS[this.difficulty];
    this.easy = this.difficulty === 'easy';
    this.events = opts.events || [];
    this.time = 0;
    this.raceTime = 0;
    this.state = 'loading';
    this.acc = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.stopT = 0;
    this.shake = 0;
    this.perfect = 'none';
    this.autodrive = !!(opts.debug && opts.debug.autodrive);
  }

  build() {
    const app = this.app;
    this.scene = new THREE.Scene();
    this.track = new Track(this.def);
    this.trackVisual = buildTrackMeshes(this.track);
    this.scene.add(this.trackVisual.group);
    this.world = buildWorld(this.track, app.renderer, this.scene, this.trackVisual);
    this.theme = this.def.theme;
    this.shared = sharedKartAssets();
    this.curbSet = new Uint8Array(this.track.N);
    for (const z of this.track.curbZones) for (let i = z.a - 4; i <= z.b + 4; i++) this.curbSet[this.track.w(i)] = 1;
    this.smoke = new Particles(900, smokeTexture(), false);
    this.sparks = new Particles(1400, sparkTexture(), true);
    this.skids = new SkidMarks(1600, this.theme === 'neon' ? 0x05050a : 0x141414, this.theme === 'neon' ? 0.6 : 0.4);
    this.confetti = new Confetti(500);
    this.scene.add(this.smoke.points, this.sparks.points, this.skids.mesh, this.confetti.mesh);
    const playerPaint = PAINTS.find(p => p.id === this.opts.paintId) || PAINTS[0];
    const others = PAINTS.filter(p => p.id !== playerPaint.id && !p.special && p.id !== 'black');
    const aiPaints = [];
    const pick = ['blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'white', 'red'];
    for (const id of pick) { const p = others.find(o => o.id === id); if (p && aiPaints.length < 5) aiPaints.push(p); }
    this.karts = [];
    const gridOrder = [0, 1, 2, 3, 4, 5];
    const playerSlot = 3;
    let ai = 0;
    for (const slot of gridOrder) {
      let k;
      if (slot === playerSlot) {
        k = new Kart(this, { isPlayer: true, paint: playerPaint, name: 'SEN', robotColor: playerPaint.special ? 0xffd23b : playerPaint.color });
        this.player = k;
        k.grip = this.easy ? 13 : this.difficulty === 'normal' ? 12 : 11;
      } else {
        k = new Kart(this, { isPlayer: false, paint: aiPaints[ai], name: AI_NAMES[ai], skill: AI_SKILL[ai], robotColor: aiPaints[ai].color });
        ai++;
      }
      const row = Math.floor(slot / 2);
      const s = -9 - row * 9 - (slot % 2) * 3.5;
      const lat = slot % 2 ? 3.4 : -3.4;
      k.placeAt(this.track.wrapS(s), lat);
      k.slot = slot;
      this.scene.add(k.obj);
      this.karts.push(k);
    }
    this.kartColors = this.karts.map(k => cssColor(k.paint).startsWith('#') ? cssColor(k.paint) : '#ffd23b');
    this.items = new Items(this);
    this.camera = new THREE.PerspectiveCamera(60, app.aspect, 0.3, 6000);
    this.camYaw = this.player.heading;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camY = this.player.y;
    this.fov = 60;
    const neon = this.theme === 'neon';
    if (assets.headMat) assets.headMat.emissiveIntensity = neon ? 3 : 0.2;
    if (assets.tailMat) assets.tailMat.emissiveIntensity = neon ? 2.5 : 0.5;
    this.gantryLights = this.trackVisual.gantryLights;
    this.hud = app.hud;
    this.hud.buildMinimap(this.track, this.theme);
    this.hud.setLap(1, LAPS);
    this.hud.setTime(0);
    this.hud.gasLock(false);
    this.hud.setItem(null);
    this.hud.center('');
    this.state = 'countdown';
    this.countT = 0;
    this.lastCount = 4;
    this.finishOrder = [];
    this.sorted = this.karts.slice();
    this.prevPos = 0;
    if (this.opts.debug && this.opts.debug.drift) {
      const z = this.track.curbZones.find(q => q.b - q.a > 20) || this.track.curbZones[0];
      const s0 = this.track.wrapS(z.a * this.track.ds - 45);
      this.player.placeAt(s0, 0);
      this.player.dist = 0;
      const f = Math.sin(this.player.heading), g = Math.cos(this.player.heading);
      this.player.vx = f * 32; this.player.vz = g * 32;
    }
    if (this.opts.skipCountdown) { this.countT = GO_T; this.lastCount = 0; this.go(); }
    this.syncAll(0);
    this.updateCamera(0.016, true);
    const kartObjs = new Set(this.karts.map(k => k.obj));
    this.sceneryCasters = [];
    this.scene.traverse(o => {
      if (!o.isMesh || !o.castShadow) return;
      for (let q = o; q; q = q.parent) if (kartObjs.has(q)) return;
      this.sceneryCasters.push(o);
    });
  }

  setSceneryShadows(on) {
    for (const o of this.sceneryCasters) o.castShadow = on;
  }

  isCurb(i) { return this.curbSet[i] === 1; }

  log(type, data) {
    this.events.push({ t: performance.now(), type, data: data || null });
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
  }

  addShake(v) {
    if (this.opts.shake === false) return;
    this.shake = Math.max(this.shake, Math.min(0.6, v));
  }

  applyAssist(racing) {
    const p = this.player;
    const c = p.control;
    let steer = this.rawSteer || 0;
    const raw = steer;
    const lat = p.p.lat, lim = this.track.halfWall - 3.2;
    const guided = p.guideT > 0;
    const helping = this.helpT > 0 || guided;
    if ((this.diff.assist !== 'none' || helping) && Math.abs(lat) > lim && Math.sign(steer) === Math.sign(lat) && !p.drift.active) steer *= 0.4;
    if ((this.diff.assist === 'smart' || helping) && racing && p.fwd > 1 && (!p.drift.active || this.easy)) {
      const as = this.assistSteer(p);
      if (p.drift.active) steer = Math.max(-1, Math.min(1, as + raw * 0.25));
      else if (guided) steer = Math.abs(raw) < 0.1 ? as : Math.max(-1, Math.min(1, steer * 0.5 + as * 0.7));
      else if (this.easy) steer = Math.abs(raw) < 0.1 ? as * 0.9 : Math.max(-1, Math.min(1, steer * 0.6 + as * 0.5));
      else steer = Math.abs(raw) < 0.1 ? as * 0.9 : Math.max(-1, Math.min(1, steer + as * 0.3));
    }
    c.steer = steer;
  }

  pathError(k) {
    const tr = this.track;
    const look = 10 + Math.max(0, k.fwd) * 0.5;
    const ti = tr.w(k.p.i + Math.round(look / tr.ds));
    const lat = Math.max(-(tr.halfRoad - 2.5), Math.min(tr.halfRoad - 2.5, k.p.lat * 0.85));
    const tx = tr.px[ti] + tr.rx[ti] * lat, tz = tr.pz[ti] + tr.rz[ti] * lat;
    let d = Math.atan2(tx - k.x, tz - k.z) - k.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  assistSteer(k) {
    return Math.max(-1, Math.min(1, -this.pathError(k) * 2.2));
  }

  guardYaw(k, dh) {
    const d = this.pathError(k);
    if (dh * d >= 0 || k.fwd < 5) return dh;
    const free = YAW_FREE + 0.22 * (1 - Math.min(1, k.fwd / MAX_SPEED));
    return dh * Math.max(0, Math.min(1, 1 - (Math.abs(d) - free) / YAW_FADE));
  }

  go() {
    this.state = 'racing';
    this.raceTime = 0;
    this.karts.forEach(k => { k.lapStart = 0; });
    this.gantryLights.forEach(m => { m.color.setHex(0x22ff55); m.emissive.setHex(0x22ff55); m.emissiveIntensity = 3; });
    sound.countBeep(0);
    this.log('go');
    this.hud.center('BAŞLA!', 'go');
    setTimeout(() => { if (this.state === 'racing') this.hud.center(''); }, 900);
    if (this.perfect === 'armed') this.perfectStart();
    this.perfect = this.perfect === 'armed' ? 'done' : 'window';
    this.karts.forEach(k => { if (!k.isPlayer && Math.random() < 0.35) k.boostT = 0.6; });
    this.hints = { item: false, drift: false };
    const touch = document.body.classList.contains('touch-mode');
    if (!touch) {
      if (this.easy) {
        if (!this.gasLatched) { this.hud.hint(GAS_KEYS, 60000); this.pendingSteerHint = STEER_KEYS; }
        else setTimeout(() => { if (this.state === 'racing') this.hud.hint(STEER_KEYS, 4500); }, 600);
      } else setTimeout(() => { if (this.state === 'racing') this.hud.hint(GAS_KEYS + '<span class="arrow">+</span>' + STEER_KEYS, 5000); }, 600);
    }
  }

  maybeHints() {
    const p = this.player;
    if (!this.hints || this.state !== 'racing') return;
    const touch = document.body.classList.contains('touch-mode');
    if (!this.hints.item && p.item && p.rouletteT <= 0) {
      this.hints.item = true;
      this.hud.hint((touch ? '' : '<span class="kc wide">SPACE</span><span class="arrow">→</span>') + '<span class="ic">' + ICONS[p.item] + '</span>', 3500);
    } else if (!this.hints.drift && this.raceTime > 14 && !this.hud.hintEl.classList.contains('show') && !p.drift.active && Math.abs(this.track.curv[this.track.w(p.p.i + 25)]) > 0.015) {
      this.hints.drift = true;
      if (!touch) this.hud.hint('<span class="kc wide">SHIFT</span><span class="arrow">+</span><span class="kc">←</span><span class="kc">→</span><span class="ic">' + DRIFT_ICON + '</span>', 4000);
    }
    if (p.drift.active && this.hints.drift) this.hud.clearHint();
  }

  perfectStart() {
    this.player.boostT = 1.3;
    this.perfect = 'done';
    this.log('boost', { kind: 'perfectStart' });
    this.log('reward', { kind: 'perfectStart' });
    this.hud.popup('SÜPER ÇIKIŞ!', 'gold');
    sound.boost();
  }

  update(realDt) {
    const sf = this.opts.debug && this.opts.debug.speed ? Number(this.opts.debug.speed) : 1;
    const dt = Math.min(realDt, 0.1 * sf);
    this.time += dt;
    if (this.stopT > 0) { this.stopT -= realDt; this.render(dt); return; }
    if (this.slowT > 0) { this.slowT -= realDt; this.timeScale = 0.55; } else this.timeScale = 1;
    if (this.state === 'countdown') this.updateCountdown(dt);
    const gasEdge = input.consume('gas');
    if (gasEdge && this.easy && !this.gasLatched) {
      this.gasLatched = true;
      this.log('input', { key: 'gasLatch', value: true });
      if (this.pendingSteerHint) { const h = this.pendingSteerHint; this.pendingSteerHint = null; this.hud.hint(h, 4500); }
      else this.hud.clearHint();
    }
    if (this.state === 'countdown' && gasEdge && this.countT > GO_T - 0.2) this.perfect = 'armed';
    if (this.state === 'racing' && gasEdge && this.perfect === 'window' && this.raceTime < 0.2) this.perfectStart();
    if (this.state === 'racing' && this.raceTime > 0.2 && this.perfect === 'window') this.perfect = 'done';
    this.acc += Math.min(dt, this.opts.debug && this.opts.debug.speed ? 0.25 * Number(this.opts.debug.speed) : 0.25) * this.timeScale;
    const racing = this.state === 'racing' || this.state === 'finish';
    this.readPlayerInput(racing);
    this.watchIdle(dt);
    let steps = 0;
    const maxSteps = this.opts.debug && this.opts.debug.speed ? 12 * Number(this.opts.debug.speed) : 12;
    while (this.acc >= STEP && steps < maxSteps) {
      this.acc -= STEP;
      steps++;
      this.physics(STEP, racing);
    }
    if (this.state === 'racing' || this.state === 'finish') this.raceTime += dt * this.timeScale;
    if (this.helpT > 0) this.helpT -= dt;
    this.render(dt);
  }

  readPlayerInput(racing) {
    const p = this.player;
    const c = p.control;
    if (this.state === 'finish' || this.autodrive) return;
    const raw = input.steer;
    let steer = raw;
    input.autoGas = false;
    const prev = this.lastInput || {};
    const now = { steer: raw, gas: input.gas, brake: input.brake, drift: input.drift };
    if (this.gasLatched && now.brake) { this.gasLatched = false; this.log('input', { key: 'gasLatch', value: false }); }
    for (const key of ['steer', 'gas', 'brake', 'drift']) if (now[key] !== prev[key]) this.log('input', { key, value: now[key] });
    this.lastInput = now;
    c.gas = now.gas || (this.easy && this.gasLatched);
    if (this.easy) {
      this.handsOffT = Math.abs(raw) < 0.1 && !input.gasPressedManually ? (this.handsOffT || 0) + 1 / 60 : 0;
      const pos = this.positionOf(p);
      const cruise = pos <= 2 ? 0.84 : pos >= 5 ? 1 : 0.93;
      const target = this.handsOffT > 1.2 ? cruise : pos >= 5 ? CATCH_UP : 1;
      p.maxMul = (p.maxMul || 1) + (target - (p.maxMul || 1)) * 0.02;
    }
    c.brake = now.brake;
    c.drift = now.drift;
    this.rawSteer = steer;
    this.applyAssist(racing);
    const dbg = this.opts.debug || {};
    if (dbg.drift && racing) {
      p.aiThink(1 / 60, this.sorted, p, this.items.hazards);
      const cv = this.track.curv[this.track.w(p.p.i + 8)];
      if (Math.abs(cv) > 0.008 && Math.abs(c.steer) > 0.25) c.drift = true;
      else if (p.drift.active && Math.abs(cv) > 0.004) c.drift = true;
      this.rawSteer = c.steer;
      c.gas = true;
      return;
    }
    const driftPress = input.consume('drift');
    if (racing && driftPress && !p.grounded && !p.hop && p.airT > 0.03 && !p.trick) { p.trick = true; sound.jump(); }
    if (input.consume('item') && racing && p.item && p.rouletteT <= 0) { this.log('item', { item: p.item }); this.items.use(p); }
    if (input.consume('respawn') && racing) p.respawn();
  }

  watchIdle(dt) {
    const p = this.player;
    const idle = this.state === 'racing' && !this.autodrive && !p.control.gas && !p.control.brake && Math.abs(this.rawSteer || 0) < 0.1 && Math.abs(p.fwd) < 2 && p.spinT <= 0 && !this.pendingSteerHint;
    this.idleT = idle ? (this.idleT || 0) + dt : 0;
    if (this.idleT > IDLE_HINT_T && !this.idleHint) {
      this.idleHint = true;
      this.log('hint', { kind: 'idle' });
      if (!document.body.classList.contains('touch-mode')) this.hud.hint(GAS_KEYS, 60000);
    }
    if (this.idleHint && (p.control.gas || this.state !== 'racing')) { this.idleHint = false; this.hud.clearHint(); }
  }

  physics(dt, racing) {
    const sorted = this.sorted;
    for (const k of this.karts) {
      if (!k.isPlayer || this.state === 'finish' || this.autodrive) { if (racing) k.aiThink(dt, sorted, this.player, this.items.hazards); }
      else if (this.rawSteer !== undefined) this.applyAssist(racing);
      if (k.rouletteT > 0) {
        k.rouletteT -= dt;
        if (k.rouletteT <= 0) { k.item = k.pendingItem; k.pendingItem = null; if (k.isPlayer) sound.itemReady(); }
      }
      k.step(dt, this.time, racing);
    }
    this.collideKarts();
    for (const k of this.karts) this.checkLaps(k);
    this.items.update(dt, this.time);
  }

  collideKarts() {
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      if (Math.abs(a.y - b.y) > 1.6) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      const R = 2.7;
      if (d2 >= R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const push = (R - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) {
        const ma = a.shieldT > 0 ? 3 : 1, mb = b.shieldT > 0 ? 3 : 1;
        const imp = -rv * 1.25 / (1 / ma + 1 / mb);
        a.vx -= nx * imp / ma; a.vz -= nz * imp / ma;
        b.vx += nx * imp / mb; b.vz += nz * imp / mb;
        if (-rv > 3 && (a.isPlayer || b.isPlayer)) {
          sound.bump(-rv);
          this.addShake(0.25);
          this.burstSparks((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.6, (a.z + b.z) / 2, 14, [2, 1.6, 0.8]);
        }
      }
    }
  }

  checkLaps(k) {
    if (k.finished) return;
    const L = this.track.L;
    const lap = Math.floor(k.dist / L) + 1;
    if (lap > k.maxLapSeen && k.dist > 0) {
      const lapTime = this.raceTime - k.lapStart;
      k.lapTimes.push(lapTime);
      k.lapStart = this.raceTime;
      k.maxLapSeen = lap;
      if (k.isPlayer) { this.log('lap', { lap: lap - 1, time: lapTime }); this.log('reward', { kind: 'lap' }); }
      if (lap > LAPS) {
        k.finished = true;
        k.finishTime = this.raceTime;
        this.finishOrder.push(k);
        if (k.isPlayer) this.playerFinished();
      } else if (k.isPlayer) {
        this.hud.setLap(lap, LAPS);
        if (lap === LAPS) { this.hud.popup(`SON TUR!<small>${fmtLap(lapTime)}</small>`, 'final', 1800); sound.finalLap(); }
        else { this.hud.popup(`TUR ${lap}<small>${fmtLap(lapTime)}</small>`, 'lap', 1600); sound.lap(); }
      }
    }
    k.lap = Math.min(LAPS, Math.max(1, lap));
  }

  playerFinished() {
    this.state = 'finish';
    this.finishT = 0;
    const pos = this.finishOrder.indexOf(this.player) + 1;
    this.log('finish', { position: pos, time: this.raceTime });
    this.hud.center(`${pos}.`, 'finish p' + pos);
    this.hud.popup('BİTİRDİN!', 'gold', 2500);
    sound.fanfare(pos <= 3);
    this.confetti.burst(this.player.x, this.player.y + 3, this.player.z, 10, 400, 12);
    this.player.control.drift = false;
  }

  positionOf(k) { return this.sorted.indexOf(k) + 1; }

  kartAhead(k) {
    const i = this.sorted.indexOf(k);
    return i > 0 ? this.sorted[i - 1] : null;
  }

  sortKarts() {
    this.sorted = this.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
  }

  updateCountdown(dt) {
    this.countT += dt;
    const t = this.countT;
    const n = t < 0.6 ? 4 : t < 1.6 ? 3 : t < 2.6 ? 2 : t < GO_T ? 1 : 0;
    if (n !== this.lastCount) {
      this.lastCount = n;
      if (n >= 1 && n <= 3) {
        this.hud.center(String(n), 'count');
        sound.countBeep(n);
        this.log('countdown', { n });
        const lit = 3 - n;
        this.gantryLights.forEach((m, i) => {
          const on = i <= lit;
          m.color.setHex(on ? 0xff2020 : 0x222222);
          m.emissive.setHex(on ? 0xff1010 : 0x000000);
          m.emissiveIntensity = on ? 3 : 0;
        });
      }
      if (n === 0) this.go();
    }
  }

  syncAll(dt) {
    for (const k of this.karts) k.syncVisual(dt, this.time);
  }

  render(dt) {
    this.sortKarts();
    this.syncAll(dt);
    this.emitEffects(dt);
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.skids.update();
    this.confetti.update(dt);
    if (this.state === 'finish') {
      this.finishT += dt;
      if (this.finishT > 1.5) this.confetti.rain(this.player.x, this.player.y + 14, this.player.z, 24, 3);
      if (this.finishT > 5 || (this.finishT > 3 && this.karts.every(k => k.finished))) this.end();
    }
    this.trackVisual.update(dt, this.time);
    this.world.update(dt, this.time, this.player.obj.position);
    this.shared.shieldMat.uniforms.time.value = this.time;
    this.updateCamera(dt, false);
    this.updateHud(dt);
    this.updateMagnetWarn(dt);
    this.maybeHints();
    this.updateAudio();
  }

  emitEffects(dt) {
    const sm = this.smoke, sp = this.sparks;
    const dustCol = this.theme === 'beach' ? [0.9, 0.8, 0.6] : this.theme === 'candy' ? [1, 0.75, 0.9] : [0.5, 0.5, 0.6];
    for (const k of this.karts) {
      const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
      const rx = -fz, rz = fx;
      const rearX = k.x - fx * 1.45, rearZ = k.z - fz * 1.45;
      const near = k.isPlayer || Math.hypot(k.x - this.player.x, k.z - this.player.z) < 90;
      if (k.drift.active && k.grounded) {
        const lvl = k.drift.level;
        const c = SPARK_COLORS[lvl];
        for (const side of [-1, 1]) {
          const wx = rearX + rx * side * 0.85, wz = rearZ + rz * side * 0.85;
          const n = lvl > 0 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            if (!near) break;
            sp.emit(wx, k.y + 0.15, wz, (Math.random() - 0.5) * 5 - fx * 4 + rx * side * 2, 2 + Math.random() * 4, (Math.random() - 0.5) * 5 - fz * 4 + rz * side * 2, 0.25 + Math.random() * 0.2, lvl > 0 ? 0.55 : 0.3, 0.1, c[0], c[1], c[2], 1, 14, 1);
          }
          if (near && Math.random() < 0.45) sm.emit(wx, k.y + 0.3, wz, rx * side * 2 + (Math.random() - 0.5) * 2, 1 + Math.random(), rz * side * 2 + (Math.random() - 0.5) * 2, 0.8, 0.9, 2.6, 0.92, 0.92, 0.95, 0.35, -0.5, 1.5);
          this.skids.mark(k.slot * 4 + (side > 0 ? 1 : 0), wx, k.y + 0.06, wz, rx, rz, 0.17, true);
        }
      } else {
        this.skids.mark(k.slot * 4, 0, 0, 0, 0, 0, 0, false);
        this.skids.mark(k.slot * 4 + 1, 0, 0, 0, 0, 0, 0, false);
      }
      if (k.offroad && k.grounded && Math.abs(k.fwd) > 6 && near && Math.random() < 0.35) {
        for (const side of [-1, 1]) sm.emit(rearX + rx * side * 0.9, k.y + 0.2, rearZ + rz * side * 0.9, -fx * 3 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, -fz * 3 + (Math.random() - 0.5) * 3, 1.0, 1.0, 3.2, dustCol[0], dustCol[1], dustCol[2], 0.35, 2, 1.5);
      }
      if (k.boostT > 0 && near) {
        for (const side of [-1, 1]) {
          const ex = k.x - fx * 2.2 + rx * side * 0.36, ez = k.z - fz * 2.2 + rz * side * 0.36;
          sp.emit(ex, k.y + 0.6, ez, -fx * 8 + (Math.random() - 0.5) * 2, Math.random() * 1.5, -fz * 8 + (Math.random() - 0.5) * 2, 0.22, 0.9, 0.2, 2.4, 0.9 + Math.random() * 0.5, 0.2, 1, 0, 2);
        }
      }
      if (k.spinT > 0 && near && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        sp.emit(k.x, k.y + 1.6, k.z, Math.cos(a) * 3, 2, Math.sin(a) * 3, 0.5, 0.8, 0.3, 2.5, 2.2, 0.6, 1, 2, 1);
      }
    }
  }

  burstSparks(x, y, z, n, c, speed = 7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
      this.sparks.emit(x, y, z, Math.cos(a) * speed * (0.4 + Math.random()), Math.sin(e) * speed + 2, Math.sin(a) * speed * (0.4 + Math.random()), 0.35 + Math.random() * 0.35, 0.7, 0.1, c[0], c[1], c[2], 1, 12, 1.5);
    }
  }

  updateCamera(dt, snap) {
    const k = this.player;
    const cam = this.camera;
    if (this.state === 'countdown' && !this.opts.skipCountdown) {
      const t = Math.min(1, this.countT / (GO_T - 0.3));
      const e = t * t * (3 - 2 * t);
      const ang = k.heading + Math.PI * (1 - e) * 0.95 + 0.0001;
      const dist = 12 - e * 4.8;
      const h = 3.6 - e * 1.0;
      cam.position.set(k.x - Math.sin(ang) * dist, k.y + h, k.z - Math.cos(ang) * dist);
      cam.lookAt(k.x + Math.sin(k.heading) * 4 * e, k.y + 1.1, k.z + Math.cos(k.heading) * 4 * e);
      this.camYaw = k.heading;
      this.camY = k.y;
      cam.fov = 60;
      cam.updateProjectionMatrix();
      this.smoke.setScale(this.app.height, cam.fov);
      this.sparks.setScale(this.app.height, cam.fov);
      return;
    }
    if (this.state === 'finish') {
      const a = this.time * 0.35;
      const tx = k.x - Math.sin(a) * 9, tz = k.z - Math.cos(a) * 9;
      cam.position.lerp(new THREE.Vector3(tx, k.y + 3.2, tz), Math.min(1, dt * 2.5));
      cam.lookAt(k.x, k.y + 1, k.z);
      return;
    }
    const sr = k.speedRatio;
    let target = k.heading + k.visualYaw * 0.55;
    if (k.fwd < -2) target = k.heading;
    let d = target - this.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.camYaw += d * (snap ? 1 : Math.min(1, dt * 4.2));
    this.camY += (k.y - this.camY) * (snap ? 1 : Math.min(1, dt * (k.grounded ? 8 : 3)));
    const dist = 6.1 + sr * 1.5 + (k.boostT > 0 ? 0.8 : 0);
    const h = 2.05 + sr * 0.3;
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    this.camPos.set(k.x - fx * dist, this.camY + h, k.z - fz * dist);
    const g = this.track.groundY(k.p);
    if (this.camPos.y < g + 1.2) this.camPos.y = g + 1.2;
    const hf = Math.sin(k.heading), hz = Math.cos(k.heading);
    this.camLook.set(k.x + hf * 6, this.camY + 1.05, k.z + hz * 6);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * 0.5;
    cam.position.copy(this.camPos);
    cam.position.x += (Math.random() - 0.5) * sh;
    cam.position.y += (Math.random() - 0.5) * sh;
    cam.lookAt(this.camLook);
    const fovT = Math.min(75, 60 + sr * 9 + (k.boostT > 0 ? 7 : 0));
    this.fov += (fovT - this.fov) * Math.min(1, dt * 4);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    this.smoke.setScale(this.app.height, cam.fov);
    this.sparks.setScale(this.app.height, cam.fov);
  }

  updateHud() {
    const k = this.player;
    const hud = this.hud;
    const total = this.karts.length;
    const pos = this.positionOf(k);
    hud.setPos(pos, total);
    hud.counting(this.state === 'countdown');
    hud.gasLock(this.easy && !!this.gasLatched && this.state === 'racing' && !this.autodrive);
    if (this.state === 'racing') {
      hud.setTime(this.raceTime);
      hud.setLap(k.lap, LAPS);
    }
    hud.setItem(k.item, k.rouletteT > 0, this.time);
    if (k.rouletteT > 0 && Math.floor(this.time * 14) !== this.lastRoul) { this.lastRoul = Math.floor(this.time * 14); sound.roulette(); }
    hud.wrong(k.wrongT > 1.2 && this.state === 'racing');
    hud.drawMinimap(this.karts, k, this.kartColors);
    hud.drawSpeedo(k.speedRatio, Math.round(Math.abs(k.fwd) * 4.6), k.boostT > 0, k.drift.level, k.drift.active ? k.drift.charge : 0);
    const tint = this.theme === 'neon' ? 'rgba(160,240,255,A)' : 'rgba(255,255,255,A)';
    this.app.speedLines.draw(1 / 60, k.boostT > 0 ? 1 : Math.max(0, (k.speedRatio - 0.85) * 3), tint);
  }

  updateMagnetWarn(dt) {
    const k = this.player;
    let near = Infinity;
    if (this.state === 'racing') {
      for (const s of this.items.shots) {
        if (s.target !== k) continue;
        if (!s.warned) { s.warned = true; this.log('magnetWarn'); }
        near = Math.min(near, Math.hypot(s.x - k.x, s.z - k.z));
      }
    }
    const on = near < Infinity;
    this.hud.magnet(on ? (near < 30 ? 2 : 1) : 0);
    if (!on) { this.magBeepT = 0; return; }
    const closeness = Math.max(0, Math.min(1, 1 - near / 90));
    this.magBeepT -= dt;
    if (this.magBeepT <= 0) { sound.magnetWarn(closeness); this.magBeepT = 0.45 - closeness * 0.32; }
  }

  updateAudio() {
    const k = this.player;
    if (this.state === 'countdown' || this.state === 'racing' || this.state === 'finish') {
      sound.setEngine(k.speedRatio, k.control.gas ? 1 : 0, k.boostT > 0, k.drift.active && k.grounded, k.drift.level, k.speedRatio);
    }
  }

  end() {
    if (this.state === 'done') return;
    this.state = 'done';
    const remaining = this.karts.filter(k => !k.finished).sort((a, b) => b.dist - a.dist);
    const order = this.finishOrder.concat(remaining);
    const results = order.map((k, i) => ({
      name: k.name,
      isPlayer: k.isPlayer,
      paint: k.paint,
      robotColor: k.robotColor,
      time: k.finished ? k.finishTime : null,
      pos: i + 1,
      bestLap: k.lapTimes.length ? Math.min(...k.lapTimes) : null
    }));
    this.app.finishRace(results, this);
  }

  onDriftLevel(level) { sound.driftLevel(level); this.log('drift', { level }); }

  onMiniTurbo(k, level) {
    if (k.isPlayer) {
      this.log('boost', { kind: 'miniTurbo', level });
      this.log('reward', { kind: 'miniTurbo', level });
      sound.miniTurbo(level);
      this.hud.popup(['', 'TURBO!', 'SÜPER TURBO!', 'ULTRA TURBO!'][level], 'turbo t' + level, 900);
    }
    const c = SPARK_COLORS[level];
    this.burstSparks(k.x - Math.sin(k.heading) * 2, k.y + 0.4, k.z - Math.cos(k.heading) * 2, 26, c, 6);
  }

  onWallHit(k, vn, x, z) {
    if (vn > 4) {
      this.burstSparks(x, k.y + 0.6, z, Math.min(30, Math.floor(vn * 1.5)), [2.6, 1.6, 0.6]);
      if (k.isPlayer) {
        this.wallHits = (this.wallHits || []).filter(t => this.raceTime - t < 12);
        this.wallHits.push(this.raceTime);
        if (this.wallHits.length >= 3 && this.diff.assist !== 'smart') { this.helpT = 10; this.wallHits = []; this.log('assist', { on: true }); }
      }
      if (k.isPlayer) { this.log('wallHit', { speed: +vn.toFixed(1) }); sound.bump(vn); this.addShake(Math.min(0.5, vn * 0.03)); if (vn > 12) this.stopT = 0.05; }
    }
  }

  onWallStuck(k) {
    if (!k.isPlayer || this.state !== 'racing') return;
    this.log('hint', { kind: 'wallStuck' });
    if (document.body.classList.contains('touch-mode')) return;
    this.wallHintAt = this.raceTime;
    this.hud.hint('<span class="ic">' + REVERSE_ICON + '</span><span class="kc">↓</span><span class="arrow">+</span><span class="kc">←</span><span class="kc">→</span><span class="sep"></span><span class="kc">R</span>', 4500);
  }

  onLaunch(k, vy) {
    if (k.isPlayer && vy > 3) { this.log('jump', { vy: +vy.toFixed(1) }); this.slowT = 0.45; sound.jump(); this.hud.popup('UÇUŞ! <small>SHIFT = TAKLA</small>', 'air', 900); }
  }

  onLand(k, trick) {
    if (k.isPlayer) sound.land();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.smoke.emit(k.x + Math.cos(a) * 1.4, k.y + 0.2, k.z + Math.sin(a) * 1.4, Math.cos(a) * 5, 0.8, Math.sin(a) * 5, 0.8, 1.2, 3.5, 0.95, 0.93, 0.9, 0.6, 0, 3);
    }
    if (trick) {
      k.trick = false;
      k.boostT = Math.max(k.boostT, 1.1);
      if (k.isPlayer) { this.hud.popup('HARİKA TAKLA!', 'gold', 1100); sound.miniTurbo(2); }
    }
    if (k.isPlayer) { this.addShake(0.3); this.log('land', { trick: !!trick }); }
  }

  onRespawn(k) {
    if (k.isPlayer) {
      this.hud.popup('YOLA DÖNDÜN!', 'lap', 900);
      this.log('respawn');
      if (this.wallHintAt !== undefined && this.raceTime - this.wallHintAt < 4.5) this.hud.clearHint();
    }
    this.burstSparks(k.x, k.y + 1, k.z, 16, [1.2, 1.8, 2.6], 4);
  }

  onShieldPop(k) {
    sound.shield();
    this.burstSparks(k.x, k.y + 1, k.z, 24, [0.6, 1.4, 2.6], 6);
    if (k.isPlayer) this.hud.popup('KALKAN KORUDU!', 'lap', 900);
  }

  onSpin(k, kind) {
    if (k.isPlayer || Math.hypot(k.x - this.player.x, k.z - this.player.z) < 60) sound.spin();
    if (k.isPlayer) { this.addShake(0.45); this.stopT = 0.08; this.hud.popup(kind === 'goo' ? 'KAYDIN!' : 'YAKALANDIN!', 'bad', 900); this.log('fail', { kind }); }
  }

  onBoxBreak(b, k) {
    for (let i = 0; i < 22; i++) {
      const c = new THREE.Color().setHSL(Math.random(), 1, 0.6);
      const a = Math.random() * Math.PI * 2;
      this.sparks.emit(b.x, b.y, b.z, Math.cos(a) * 6, Math.random() * 6, Math.sin(a) * 6, 0.5, 0.9, 0.2, c.r * 2, c.g * 2, c.b * 2, 1, 10, 1);
    }
    if (k.isPlayer) { sound.pickup(); this.log('reward', { kind: 'itemBox' }); }
  }

  onBoost(k) { if (k.isPlayer) { k.guideT = GUIDE_T; this.log('boost', { kind: 'item' }); sound.boost(); this.hud.popup('TURBO!', 'turbo t2', 800); } }
  onPad(k) {
    this.burstSparks(k.x - Math.sin(k.heading) * 2, k.y + 0.4, k.z - Math.cos(k.heading) * 2, 18, [0.5, 1.8, 2.6], 5);
    if (k.isPlayer) { this.log('boost', { kind: 'pad' }); sound.boost(); this.addShake(0.12); }
  }
  onShield(k) { if (k.isPlayer) sound.shield(); }
  onGooDrop(k) { if (k.isPlayer) sound.goo(); }
  onGooHit(h, k) { if (k.isPlayer || h.owner.isPlayer) sound.goo(); if (h.owner.isPlayer && !k.isPlayer) this.hud.popup('YAKALADIN!', 'gold', 900); }
  onMagnetFire(k) { if (k.isPlayer) sound.magnet(); }
  onMagnetHit(s, k) {
    this.burstSparks(k.x, k.y + 1, k.z, 30, [2.6, 0.5, 0.6], 8);
    if (s.owner.isPlayer) this.hud.popup('YAKALADIN!', 'gold', 900);
  }

  onMagnetTrail(s) {
    if (Math.random() < 0.8) this.sparks.emit(s.x, s.y, s.z, (Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2, 0.4, 0.8, 0.1, Math.random() < 0.5 ? 2.6 : 0.4, 0.4, Math.random() < 0.5 ? 0.4 : 2.6, 1, 0, 1);
  }

  dispose() {
    this.items.dispose();
    const keep = new Set(assets.shared);
    const mats = new Set();
    this.scene.traverse(o => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!keep.has(m)) mats.add(m); });
    });
    this.world.dispose();
    this.scene.traverse(o => {
      if ((o.isMesh || o.isPoints) && o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    });
    mats.forEach(m => {
      for (const k of ['map', 'emissiveMap', 'roughnessMap', 'normalMap', 'alphaMap']) if (m[k] && m[k].isTexture && m[k] !== assets.shadowTex) m[k].dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    });
  }

  debugInfo() {
    const k = this.player;
    return {
      state: this.state,
      track: this.def.id,
      speed: +k.fwd.toFixed(2),
      kmh: Math.round(Math.abs(k.fwd) * 4.6),
      lap: k.lap,
      position: this.positionOf(k),
      progress: +(k.dist / this.track.L).toFixed(3),
      lat: +k.p.lat.toFixed(2),
      heading: +k.heading.toFixed(3),
      drift: k.drift.active ? k.drift.level : -1,
      boost: +k.boostT.toFixed(2),
      item: k.item,
      raceTime: +this.raceTime.toFixed(2),
      ai: this.karts.filter(x => !x.isPlayer).map(x => +(x.dist / this.track.L).toFixed(3)),
      trackLength: Math.round(this.track.L)
    };
  }
}

function fmtLap(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export { MAX_SPEED };
