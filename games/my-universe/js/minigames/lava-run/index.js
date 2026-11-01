import * as THREE from 'three';
import { WORLDS } from '../../engine/themes.js';
import { World } from '../../engine/world.js';
import { buildSeq, PIECES as P, PHYS } from '../../engine/levels.js';
import { lavaMaterial } from '../../engine/shaders.js';

export const ID = 'lavaRun';
export const DEF = { ...WORLDS[1], name: 'Lav Parkuru', belowY: -14, fog: { color: 0x9a4a3a, near: 60, far: 300 } };

export const STAGES = [
  {
    n: 1,
    name: 'Isınma',
    xp: 40,
    coins: 10,
    speed: 0.3,
    finishDy: 0,
    cpDy: 0,
    seq: [
      (b) => {
        P.bridge(b, { len: 10, w: 3.2, gap: 0.6 });
        P.steps(b, { n: 2, size: 5, gap: 0.6, rise: 0.4, zig: 0 });
        b.nextGap = 0.8;
      },
      (b) => {
        P.bridge(b, { len: 9, w: 3.4, gap: 0.6 });
        P.steps(b, { n: 1, size: 9, gap: 2.6, rise: 0, zig: 0 });
        b.nextGap = 0.8;
      },
      (b) => {
        P.stairs(b, { n: 4, rise: 0.5, size: 4.2, gap: 0.6 });
        P.bridge(b, { len: 8, w: 3.4, gap: 0.6 });
        P.steps(b, { n: 1, size: 9, gap: 2.6, rise: 0, zig: 0 });
        b.nextGap = 0.8;
      },
      (b) => {
        P.bridge(b, { len: 9, w: 3.4, gap: 0.6 });
        P.steps(b, { n: 1, size: 9, gap: 2.6, rise: 0, zig: 0 });
        b.nextGap = 0.8;
      },
    ],
  },
  {
    n: 2,
    name: 'Yükseliş',
    xp: 70,
    coins: 20,
    speed: 0.42,
    seq: [
      (b) => P.crumble(b, { n: 4, size: 3.4, gap: 1.1, delay: 1.0 }),
      (b) => P.sideMovers(b, { n: 2, amp: 2.2, speed: 0.8, size: 4, gap: 1.8 }),
      (b) => P.stairs(b, { n: 5, rise: 1, size: 3.2, gap: 1.3 }),
      (b) => P.tramps(b, { n: 2 }),
      (b) => {
        P.elevator(b, { rise: 5, speed: 0.8 });
        P.steps(b, { n: 4, size: 3.6, gap: 1.9, rise: 0.8, zig: 1.6 });
      },
    ],
  },
  {
    n: 3,
    name: 'Zirve',
    xp: 110,
    coins: 30,
    speed: 0.55,
    seq: [
      (b) => P.crumble(b, { n: 5, size: 3, gap: 1.2, delay: 0.7 }),
      (b) => P.spinPlanks(b, { n: 2, len: 8, w: 2 }),
      (b) => P.stairs(b, { n: 6, rise: 1.1, size: 3, gap: 1.4 }),
      (b) => P.pad(b, { rise: 6 }),
      (b) => P.sideMovers(b, { n: 3, amp: 2.8, speed: 1, size: 3.5, gap: 2 }),
      (b) => P.disks(b, { n: 3, r: 2.8, spin: 0.6, gap: 1.6 }),
      (b) => {
        P.barBeam(b, { len: 10, w: 2, bars: 1, speed: 1.2, floor: 4, push: true });
        P.tramps(b, { n: 3 });
      },
    ],
  },
];

const WORDS = ['Süper!', 'Harika!', 'Bravo!', 'Aferin!', 'Müthiş!'];

export function create(ctx, stageIndex) {
  return new LavaRun(ctx, STAGES[stageIndex]);
}

class LavaRun {
  constructor(ctx, stage) {
    this.ctx = ctx;
    this.stage = stage;
    this.id = ID;
    this.def = DEF;
    this.state = 'play';
    this.world = null;
    this.course = null;
    this.lava = null;
    this.lavaY = -6;
    this.cp = 0;
    this.coins = 0;
    this.deaths = 0;
    this.time = 0;
    this.deathT = 0;
    this.finishT = 0;
    this.invuln = 0;
    this.fails = 0;
    this.fading = false;
    this.pushT = 0;
  }

  enter() {
    const c = this.ctx;
    this.course = buildSeq(2, this.stage.seq, { startSize: 9, finishDy: this.stage.finishDy ?? 0.5, cpDy: this.stage.cpDy ?? null });
    this.course.specs = this.course.specs.filter((s) => s.t !== 'start');
    this.moved = false;
    this.world = new World(c.scene, DEF, this.course);
    this.world.camera = c.camera;
    this.world.events = (type) => {
      if (type === 'crack') c.audio.crack();
    };
    const lavaM = lavaMaterial();
    const g = new THREE.PlaneGeometry(700, 700);
    g.rotateX(-Math.PI / 2);
    this.lava = new THREE.Mesh(g, lavaM);
    this.lava.renderOrder = 1;
    c.scene.add(this.lava);
    this.world.shaderMats.push(lavaM);
    this.world.track(lavaM);
    this.world.track(g);
    c.applyTheme(DEF);
    this.spawnAt(0, true);
    c.ui.banner(`Bölüm ${this.stage.n}: ${this.stage.name}`);
    c.audio.whoosh();
    c.log('start', { game: ID, stage: this.stage.n });
  }

  spawnAt(i, fresh) {
    const c = this.ctx;
    const p = c.player;
    const cp = this.course.cps[i];
    p.animOverride = null;
    p.frozen = false;
    p.spawn(cp.x, cp.y, cp.z + (i === 0 ? 1.5 : 0), Math.PI);
    c.rig.pitch = 0.36;
    c.rig.frozenY = null;
    c.rig.snap(p.pos, 0);
    if (fresh) c.input.reset();
    this.lavaY = cp.y - (i === 0 ? 6 : 7);
    this.lava.position.y = this.lavaY;
    this.state = 'play';
  }

  restart() {
    this.world.resetCoins();
    this.world.resetCheckpoints();
    this.world.resetCrumbles();
    this.world.nextCp = 1;
    this.cp = 0;
    this.coins = 0;
    this.deaths = 0;
    this.time = 0;
    this.fails = 0;
    this.invuln = 0;
    this.moved = false;
    this.ctx.fade(false);
    this.fading = false;
    this.spawnAt(0, true);
  }

  hud() {
    const p = this.ctx.player;
    const n = this.course.cps.length - 1;
    return {
      stage: Math.min(this.cp + 1, n),
      stageMax: n,
      time: this.time,
      coins: this.coins,
      coinsMax: this.course.coins.length,
      danger: this.state === 'play' ? THREE.MathUtils.clamp(1 - (p.pos.y - this.lavaY) / 7, 0, 1) : 0,
      label: this.stage.name,
      stageNo: this.stage.n,
    };
  }

  fixed(dt) {
    const c = this.ctx;
    const p = c.player;
    this.world.step(dt);
    if (this.state !== 'play') return;
    p.step(dt, c.input, this.world, c.rig.yaw);
    if (c.playerEvents(0x8a7a80)) {
      this.die('hazard');
      return;
    }
    this.lavaY += this.stage.speed * dt;
    this.rules(dt);
  }

  rules(dt) {
    const c = this.ctx;
    const p = c.player;
    const w = this.world;
    const pos = p.pos;
    if (pos.y < this.lavaY + 0.25 || pos.y < DEF.belowY) {
      this.die('lava');
      return;
    }
    this.pushT -= dt;
    for (const b of w.bars) {
      if (!b.push && this.invuln > 0) continue;
      if (pos.y > b.y + b.radius || pos.y + PHYS.height < b.y - b.radius) continue;
      for (let k = 0; k < b.arms; k++) {
        const a = b.angle + (k / b.arms) * Math.PI * 2;
        const dx = Math.cos(a);
        const dz = -Math.sin(a);
        const rx = pos.x - b.x;
        const rz = pos.z - b.z;
        const t = Math.max(0, Math.min(b.len, rx * dx + rz * dz));
        const ex = rx - dx * t;
        const ez = rz - dz * t;
        const rr = PHYS.radius + b.radius - 0.05;
        if (ex * ex + ez * ez < rr * rr) {
          if (!b.push) {
            this.die('hazard');
            return;
          }
          this.pushOff(b, a);
          break;
        }
      }
    }
    const cy = pos.y + 0.9;
    for (const coin of w.coins) {
      if (coin.taken) continue;
      const dx = coin.x - pos.x;
      const dy = coin.y - cy;
      const dz = coin.z - pos.z;
      if (dx * dx + dy * dy * 0.6 + dz * dz >= 1.35) continue;
      coin.taken = true;
      coin.t = 0;
      this.coins++;
      c.progress.addCoins(1);
      c.audio.coin();
      c.ui.coinPop();
      c.fx.coinBurst(coin.x, coin.y, coin.z);
    }
    const next = this.cp + 1;
    if (next < this.course.cps.length) {
      const cp = this.course.cps[next];
      const r = cp.finish ? 4 : cp.r - 0.3;
      if (Math.abs(pos.x - cp.x) < r && Math.abs(pos.z - cp.z) < r && Math.abs(pos.y - cp.y) < 1.2 && p.grounded) this.reach(next);
    }
  }

  pushOff(b, a) {
    if (this.pushT > 0) return;
    const c = this.ctx;
    const p = c.player;
    const sg = Math.sign(b.speed) || 1;
    const tx = -Math.sin(a) * sg;
    const tz = -Math.cos(a) * sg;
    let dir = null;
    for (const [cx, cz] of [[tx, tz], [-tx, -tz], [0, 1], [0, -1]]) {
      const gy = this.world.groundBelow(p.pos.x + cx * 1.8, p.pos.z + cz * 1.8, p.pos.y + 0.3, 0.2);
      if (gy > p.pos.y - 1.2) {
        dir = [cx, cz];
        break;
      }
    }
    this.pushT = 0.6;
    p.vel.x = dir ? dir[0] * 5 : 0;
    p.vel.z = dir ? dir[1] * 5 : 0;
    p.vel.y = Math.max(p.vel.y, 4);
    p.grounded = false;
    p.ground = null;
    c.audio.boing();
    c.rig.addShake(0.25);
  }

  reach(i) {
    const c = this.ctx;
    const w = this.world;
    const cp = this.course.cps[i];
    this.cp = i;
    this.fails = 0;
    w.nextCp = i + 1;
    if (w.assistStage !== null) w.setAssist(null);
    if (cp.finish) {
      this.finish();
      return;
    }
    this.lavaY = Math.min(this.lavaY, cp.y - 7);
    w.activateCheckpoint(w.cpAt(i), false);
    c.audio.checkpoint();
    c.fx.confetti.burst(cp.x, cp.y + 1, cp.z, 90, 9);
    c.fx.ringBurst(cp.x, cp.y, cp.z, 0x3ddc5a);
    c.ui.toast(WORDS[i % WORDS.length]);
    c.log('checkpoint', { game: ID, stage: this.stage.n, index: i });
  }

  die(reason) {
    if (this.state !== 'play') return;
    const c = this.ctx;
    const p = c.player;
    this.state = 'dead';
    this.deathT = 0;
    this.deaths++;
    this.fails++;
    c.log('fail', { game: ID, reason, checkpoint: this.cp });
    if (reason === 'lava') {
      c.audio.splash();
      c.rig.frozenY = p.pos.y + 1.4;
      c.fx.lavaSplash(p.pos.x, this.lavaY, p.pos.z);
      c.ui.toast('Lava düştün!');
    } else {
      c.ui.toast('Ah!');
      c.audio.death();
      p.dead = true;
      c.fx.deathBurst(p.pos.x, p.pos.y + 0.9, p.pos.z, 0xff7a1a);
    }
  }

  respawn() {
    const c = this.ctx;
    const p = c.player;
    this.spawnAt(this.cp, false);
    p.root.visible = true;
    this.invuln = 1;
    c.audio.respawn();
    const cp = this.course.cps[this.cp];
    c.fx.ringBurst(cp.x, cp.y, cp.z, 0x9ff4ff);
    if (this.fails >= 3 && this.world.assistStage !== this.cp) this.world.setAssist(this.cp);
  }

  finish() {
    const c = this.ctx;
    const p = c.player;
    this.state = 'finish';
    this.finishT = 0;
    p.frozen = true;
    p.vel.set(0, 0, 0);
    p.animOverride = 'Dance';
    c.audio.win();
    const cp = this.course.cps[this.cp];
    c.fx.confetti.burst(cp.x, cp.y + 2, cp.z, 160, 11, 1, [0xffc21a, 0xffd84a, 0xff6a1a, 0xffffff]);
    c.ui.toast('BİTİŞ!');
    c.log('finish', { game: ID, stage: this.stage.n, time: Math.round(this.time * 10) / 10, deaths: this.deaths });
  }

  update(dt) {
    const c = this.ctx;
    const p = c.player;
    this.lava.position.y = this.lavaY;
    const d = this.hud().danger;
    this.lava.material.uniforms.time.value = this.world.time;
    if (this.state === 'play') {
      if (!this.moved && (Math.hypot(p.vel.x, p.vel.z) > 0.5 || !p.grounded)) this.moved = true;
      if (this.moved) this.time += dt;
      this.autoCamera(dt);
      if (this.invuln > 0) {
        this.invuln -= dt;
        p.setRim(0xffffff, 0.7 + Math.sin(this.invuln * 12) * 0.4);
        if (this.invuln <= 0) p.setRim(0x8fd8ff, 0.9);
      }
      if (d > 0.55 && Math.random() < dt * 6) c.fx.ember(p.pos.x + (Math.random() - 0.5) * 8, this.lavaY, p.pos.z + (Math.random() - 0.5) * 8);
    } else if (this.state === 'dead') {
      this.deathT += dt;
      if (this.deathT > 0.75 && !this.fading) {
        this.fading = true;
        c.fade(true);
        if (p.dead) p.root.visible = false;
      }
      if (this.deathT > 1.0) {
        this.fading = false;
        c.fade(false);
        this.respawn();
      }
    } else if (this.state === 'finish') {
      this.finishT += dt;
      if (this.finishT > 1.2 && this.finishT - dt <= 1.2) c.fx.confetti.burst(p.pos.x - 2, p.pos.y + 3, p.pos.z, 100, 9, 1);
      if (this.finishT > 2.6) {
        this.state = 'done';
        c.finish({ game: ID, stage: this.stage.n, stageName: this.stage.name, time: this.time, coins: this.coins, coinsMax: this.course.coins.length, deaths: this.deaths, xp: this.stage.xp, reward: this.stage.coins, hasNext: this.stage.n < STAGES.length });
      }
    }
    this.world.animate(dt);
  }

  autoCamera(dt) {
    const c = this.ctx;
    if (c.lookIdle < 1.8) return;
    const cps = this.course.cps;
    const a = cps[this.cp];
    const b = cps[Math.min(this.cp + 1, cps.length - 1)];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.hypot(dx, dz) < 1) return;
    const want = Math.atan2(-dx, -dz);
    let d = want - c.rig.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    c.rig.yaw += d * (1 - Math.exp(-1.1 * dt));
  }

  exit() {
    this.ctx.scene.remove(this.lava);
    this.world.dispose();
    this.ctx.fade(false);
  }
}
