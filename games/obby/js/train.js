import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blockGeo } from './geo.js';

const HX = 1.4;
const HZ = 1.8;
const WALL = 0.16;
const WALL_H = 3.2;
const BOARD = 0.7;
const BACK_SPEED = 9;
const ENGINE = 4.5;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

export function makeTrain(world) {
  const specs = world.course.specs.filter((s) => s.t === 'cart');
  return specs.length ? new Train(world, specs) : null;
}

function box(hx, hy, hz, style, spec) {
  return { shape: 'box', x: 0, y: 0, z: 0, hx, hy, hz, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0, style, stage: spec.stage, spec, obj: null, squash: 0 };
}

function colored(g, hex) {
  const p = g.index ? g.toNonIndexed() : g;
  if (p !== g) g.dispose();
  p.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const n = p.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  p.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return p;
}

class Train {
  constructor(world, specs) {
    this.w = world;
    this.carts = specs.map((s) => this.makeCart(s));
    this.build();
  }

  makeCart(s) {
    const pts = s.path;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const floor = box(HX, 0.15, HZ, 'cart', s);
    const walls = {
      left: box(WALL / 2, WALL_H / 2, HZ + WALL, 'curb', s),
      right: box(WALL / 2, WALL_H / 2, HZ + WALL, 'curb', s),
      front: box(HX, WALL_H / 2, WALL / 2, 'curb', s),
      back: box(HX, WALL_H / 2, WALL / 2, 'curb', s),
    };
    walls.back.active = false;
    for (const c of Object.values(walls)) c.noCam = true;
    for (const c of [floor, ...Object.values(walls)]) this.w.colliders.push(c);
    const cart = { s, pts, cum, L: cum[cum.length - 1], d: 0, mode: 'wait', board: 0, away: 0, floor, walls, finale: !!s.finale, view: this.w.viewOf(s), gateF: 0, gateB: 1, x: 0, y: 0, z: 0, yaw: 0 };
    this.place(cart, true);
    return cart;
  }

  at(c, d) {
    const { pts, cum } = c;
    if (d <= 0) {
      const a = pts[0];
      const b = pts[1];
      const L = cum[1];
      return { x: a.x + ((b.x - a.x) * d) / L, y: a.y, z: a.z + ((b.z - a.z) * d) / L, fx: (b.x - a.x) / L, fz: (b.z - a.z) / L };
    }
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const L = cum[i] - cum[i - 1];
    const t = (d - cum[i - 1]) / L;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, fx: (b.x - a.x) / L, fz: (b.z - a.z) / L };
  }

  pose(c, d) {
    const back = this.at(c, d - 1.2);
    const front = this.at(c, d + 1.2);
    const p = this.at(c, d);
    const fx = front.x - back.x;
    const fz = front.z - back.z;
    const l = Math.hypot(fx, fz) || 1;
    return { x: p.x, y: p.y, z: p.z, fx: fx / l, fz: fz / l, yaw: Math.atan2(-fx / l, -fz / l) };
  }

  place(c, first) {
    const q = this.pose(c, c.d);
    let yaw = q.yaw;
    if (!first) {
      let dyaw = yaw - c.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      yaw = c.yaw + dyaw;
    }
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const set = (k, lx, ly, lz) => {
      const nx = q.x + lx * cs + lz * sn;
      const nz = q.z - lx * sn + lz * cs;
      const ny = q.y + ly;
      if (first) {
        k.dx = k.dy = k.dz = k.dyaw = 0;
      } else {
        k.dx = nx - k.x;
        k.dy = ny - k.y;
        k.dz = nz - k.z;
        k.dyaw = yaw - k.yaw;
      }
      k.x = nx;
      k.y = ny;
      k.z = nz;
      k.yaw = yaw;
    };
    set(c.floor, 0, -0.15, 0);
    set(c.walls.left, -(HX + WALL / 2), WALL_H / 2, 0);
    set(c.walls.right, HX + WALL / 2, WALL_H / 2, 0);
    set(c.walls.front, 0, WALL_H / 2, -(HZ + WALL / 2));
    set(c.walls.back, 0, WALL_H / 2, HZ + WALL / 2);
    c.x = q.x;
    c.y = q.y;
    c.z = q.z;
    c.yaw = yaw;
  }

  riding(c, p) {
    if (!p) return false;
    if (p.grounded && p.ground === c.floor) return true;
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    const dx = p.pos.x - c.x;
    const dz = p.pos.z - c.z;
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    return Math.abs(lx) < HX + 0.3 && Math.abs(lz) < HZ + 0.3 && p.pos.y > c.y - 0.5 && p.pos.y < c.y + 4;
  }

  step(dt) {
    const p = this.w.player && !this.w.player.dead ? this.w.player : null;
    for (const c of this.carts) {
      const on = this.riding(c, p);
      const slow = this.w.assistStage === c.s.stage ? 0.7 : 1;
      if (c.mode === 'wait') {
        c.board = p && p.grounded && p.ground === c.floor ? c.board + dt : 0;
        if (c.board >= BOARD) {
          c.mode = 'go';
          c.walls.back.active = true;
          this.sound('go', c);
          if (this.w.events) this.w.events('cartGo', c.floor);
        }
      } else if (c.mode === 'go') {
        c.d = Math.min(c.L, c.d + c.s.speed * slow * dt);
        if (c.d >= c.L) {
          c.mode = 'arrived';
          c.walls.front.active = false;
          c.away = 0;
          this.sound('stop', c);
        }
      } else if (c.mode === 'arrived') {
        c.away = on ? 0 : c.away + dt;
        if (!c.finale && c.away > 1.2) {
          c.mode = 'back';
          c.walls.front.active = true;
        }
      } else if (c.mode === 'back') {
        c.d = Math.max(0, c.d - BACK_SPEED * dt);
        if (c.d <= 0) {
          c.mode = 'wait';
          c.walls.back.active = false;
        }
      }
      this.place(c, false);
    }
  }

  dock(p) {
    for (const c of this.carts) {
      if (c.mode === 'wait' || this.riding(c, p)) continue;
      const a = c.pts[0];
      if (Math.hypot(p.pos.x - a.x, p.pos.z - a.z) > 16) continue;
      c.d = 0;
      c.mode = 'wait';
      c.board = 0;
      c.walls.back.active = false;
      c.walls.front.active = true;
      this.place(c, true);
    }
  }

  reset() {
    for (const c of this.carts) {
      c.d = 0;
      c.mode = 'wait';
      c.board = 0;
      c.walls.back.active = false;
      c.walls.front.active = true;
      this.place(c, true);
    }
  }

  sound(kind, c) {
    const a = this.w.audio;
    if (!a || !a.ctx) return;
    if (kind === 'go') {
      [784, 988, 1175, 1568].forEach((f, i) => a.tone(f, 0.35, { type: 'triangle', vol: 0.09, when: i * 0.08 }));
      a.noise(0.6, { vol: 0.05, freq: 500, type: 'lowpass' });
    } else if (kind === 'stop') a.tone(523, 0.5, { type: 'triangle', vol: 0.08, slide: 0.8 });
  }

  build() {
    const w = this.w;
    const T = (o) => w.track(o);
    this.group = new THREE.Group();
    w.group.add(this.group);
    const vm = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.35 }));
    this.mat = vm;
    const walnut = 0x5a3220;
    const brass = 0xb58a46;
    const cobalt = 0x2a52c8;
    const cream = 0xf1e9d6;
    const iron = 0x2a2a30;
    const parts = [];
    const add = (g, hex) => parts.push(colored(g, hex));
    add(blockGeo(HX * 2, 0.34, HZ * 2, 0.06, 1).clone().translate(0, -0.17, 0), walnut);
    for (const sx of [-1, 1]) {
      add(blockGeo(WALL, 0.9, HZ * 2 + WALL * 2, 0.04, 1).clone().translate(sx * (HX + WALL / 2), 0.45, 0), cobalt);
      add(new THREE.BoxGeometry(WALL + 0.08, 0.1, HZ * 2 + WALL * 2 + 0.08).translate(sx * (HX + WALL / 2), 0.92, 0), brass);
      add(new THREE.BoxGeometry(0.06, 0.5, HZ * 2 - 0.2).translate(sx * (HX + WALL + 0.02), 0.45, 0), cream);
    }
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 12).rotateX(Math.PI / 2).translate(sx * (HX - 0.4), -0.2, sz * (HZ + 0.32)), brass);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 16).rotateZ(Math.PI / 2).translate(sx * (HX - 0.05), -0.42, sz * (HZ - 0.7)), iron);
    const body = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    const gateParts = [colored(blockGeo(HX * 2, 0.9, WALL, 0.04, 1).clone().translate(0, 0.45, 0), cobalt), colored(new THREE.BoxGeometry(HX * 2 + 0.08, 0.1, WALL + 0.08).translate(0, 0.92, 0), brass)];
    const gate = mergeGeometries(gateParts, false);
    for (const g of gateParts) g.dispose();
    const eng = [];
    const ae = (g, hex) => eng.push(colored(g, hex));
    ae(blockGeo(HX * 2, 0.5, HZ * 2.2, 0.08, 1).clone().translate(0, -0.05, 0), walnut);
    ae(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 22).rotateX(Math.PI / 2).translate(0, 1.0, -0.6), cobalt);
    for (const z of [-1.7, -0.6, 0.5]) ae(new THREE.CylinderGeometry(1.06, 1.06, 0.14, 22).rotateX(Math.PI / 2).translate(0, 1.0, z), brass);
    ae(blockGeo(2.4, 1.9, 1.5, 0.12, 1).clone().translate(0, 1.15, 1.35), cream);
    ae(new THREE.BoxGeometry(2.7, 0.18, 1.9).translate(0, 2.18, 1.35), cobalt);
    ae(new THREE.CylinderGeometry(0.28, 0.36, 1.0, 14).translate(0, 2.3, -1.4), iron);
    ae(new THREE.CylinderGeometry(0.42, 0.3, 0.22, 14).translate(0, 2.85, -1.4), brass);
    for (const sz of [-1, 0, 1]) for (const sx of [-1, 1]) ae(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 18).rotateZ(Math.PI / 2).translate(sx * (HX - 0.05), -0.4, sz * 1.25), iron);
    ae(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12).rotateX(Math.PI / 2).translate(0, 0.1, -HZ * 1.1 - 0.15), brass);
    const engine = mergeGeometries(eng, false);
    for (const g of eng) g.dispose();
    T(body);
    T(gate);
    T(engine);
    for (const c of this.carts) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(body, vm);
      const gf = new THREE.Mesh(gate, vm);
      const gb = new THREE.Mesh(gate, vm);
      gf.position.z = -(HZ + WALL / 2);
      gb.position.z = HZ + WALL / 2;
      const e = new THREE.Mesh(engine, vm);
      for (const m of [b, gf, gb, e]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      g.add(b, gf, gb);
      this.group.add(g, e);
      c.mesh = g;
      c.gf = gf;
      c.gb = gb;
      c.engine = e;
    }
    this.buildTrack(vm);
  }

  buildTrack(vm) {
    const w = this.w;
    const lampPos = [];
    for (const c of this.carts) {
      const parts = [];
      const add = (g, hex) => parts.push(colored(g, hex));
      const n = Math.ceil(c.L + ENGINE + 3);
      for (let d = -2; d < n; d += 0.9) {
        const q = this.pose(c, d);
        const g = new THREE.BoxGeometry(2.6, 0.12, 0.34);
        g.rotateY(q.yaw);
        g.translate(q.x, q.y - 0.62, q.z);
        add(g, 0x4a2a1a);
      }
      for (let d = -2; d < n; d += 1) {
        const a = this.pose(c, d);
        const b = this.pose(c, d + 1);
        for (const sx of [-0.85, 0.85]) {
          const ax = a.x + Math.cos(a.yaw) * sx;
          const az = a.z - Math.sin(a.yaw) * sx;
          const bx = b.x + Math.cos(b.yaw) * sx;
          const bz = b.z - Math.sin(b.yaw) * sx;
          const L = Math.hypot(bx - ax, bz - az);
          const g = new THREE.BoxGeometry(0.12, 0.14, L + 0.02);
          g.rotateY(Math.atan2(bx - ax, bz - az));
          g.translate((ax + bx) / 2, a.y - 0.5, (az + bz) / 2);
          add(g, 0xb58a46);
        }
      }
      const onGround = (x, z, y) => w.groundBelow(x, z, y + 0.1, 0.1) > y - 1.2;
      for (let d = 2; d < c.L + ENGINE; d += 6) {
        const q = this.pose(c, d);
        if (onGround(q.x, q.z, q.y)) continue;
        const h = 14;
        add(new THREE.CylinderGeometry(0.22, 0.32, h, 8).translate(q.x, q.y - 0.7 - h / 2, q.z), 0x5a3a26);
        const cap = new THREE.BoxGeometry(3.0, 0.24, 0.5);
        cap.rotateY(q.yaw);
        cap.translate(q.x, q.y - 0.78, q.z);
        add(cap, 0xb58a46);
        if (c.finale) {
          for (const sx of [-1, 1]) lampPos.push({ c, x: q.x + Math.cos(q.yaw) * sx * 2.1, y: q.y - 0.7, z: q.z - Math.sin(q.yaw) * sx * 2.1, d });
        }
      }
      const geo = w.track(mergeGeometries(parts, false));
      for (const g of parts) g.dispose();
      const mesh = new THREE.Mesh(geo, vm);
      mesh.receiveShadow = true;
      w.stageGroup(c.view).add(mesh);
    }
    this.lamps = lampPos;
    if (lampPos.length) {
      const pg = w.track(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 8).translate(0, 0.8, 0));
      const posts = new THREE.InstancedMesh(pg, w.track(new THREE.MeshStandardMaterial({ color: 0xb58a46, metalness: 0.75, roughness: 0.3 })), lampPos.length);
      const bulbs = new THREE.InstancedMesh(w.track(new THREE.SphereGeometry(0.22, 14, 10)), w.track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), lampPos.length);
      lampPos.forEach((l, i) => {
        _m.compose(_p.set(l.x, l.y, l.z), _q.identity(), _s.setScalar(1));
        posts.setMatrixAt(i, _m);
        _m.compose(_p.set(l.x, l.y + 1.75, l.z), _q.identity(), _s.setScalar(1));
        bulbs.setMatrixAt(i, _m);
        bulbs.setColorAt(i, _c.set(0xffffff));
      });
      const sg = w.stageGroup(lampPos[0].c.view);
      sg.add(posts, bulbs);
      this.bulbs = bulbs;
    }
  }

  update(t, dt) {
    const beat = 0.5 + 0.5 * Math.cos(t * Math.PI * 4);
    for (const c of this.carts) {
      const vis = this.w.window === null || this.w.inWindow(c.view);
      c.mesh.visible = vis;
      c.engine.visible = vis;
      if (!vis) continue;
      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.rotation.y = c.yaw;
      const q = this.pose(c, c.d + ENGINE);
      c.engine.position.set(q.x, q.y, q.z);
      c.engine.rotation.y = q.yaw;
      c.gateF += ((c.walls.front.active ? 1 : 0) - c.gateF) * (1 - Math.exp(-10 * dt));
      c.gateB += ((c.walls.back.active ? 1 : 0) - c.gateB) * (1 - Math.exp(-10 * dt));
      c.gf.rotation.x = -(1 - c.gateF) * 1.45;
      c.gb.rotation.x = (1 - c.gateB) * 1.45;
      c.gf.position.y = -(1 - c.gateF) * 0.05;
      c.gb.position.y = -(1 - c.gateB) * 0.05;
    }
    if (this.bulbs) {
      const live = this.carts.find((c) => c.finale);
      const going = live && (live.mode === 'go' || live.mode === 'arrived');
      this.lamps.forEach((l, i) => {
        const near = going ? Math.max(0, 1 - Math.abs(l.d - live.d) / 18) : 0;
        const k = 0.8 + (going ? 1.4 * beat + 1.6 * near : 0.6 * beat);
        _c.set(0xffd8a0).multiplyScalar(k);
        this.bulbs.setColorAt(i, _c);
      });
      this.bulbs.instanceColor.needsUpdate = true;
    }
  }
}
