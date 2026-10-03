import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blockGeo } from './geo.js';
import { glowColor } from './shaders.js';

const WARN = 0.5;
const PRE = 0.6;
const FENCE_H = 3.2;
const LATCH = 0.9;
const RAIL_STEP = 0.75;
const RAIL_SPEED = 14;
const EXTEND = 0.6;
const DOOR_T = 0.55;
const FREEZE_T = 15;
const FREEZE_WARN = 3;
const BODY = [0x24409a, 0x30285e, 0x1c4e72];
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function timerMaterial(top) {
  return new THREE.ShaderMaterial({
    uniforms: { left: { value: 1 }, color: { value: new THREE.Color(0xa77aff) } },
    transparent: true,
    depthWrite: false,
    depthTest: !top,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float left;',
      'uniform vec3 color;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec2 q = vUv - 0.5;',
      '  float r = length(q);',
      '  float a = fract(atan(q.x, q.y) / 6.2831853 + 1.0);',
      '  float aa = fwidth(r) * 1.5;',
      '  float ring = smoothstep(0.25 - aa, 0.25, r) * (1.0 - smoothstep(0.46, 0.46 + aa, r));',
      '  float edge = smoothstep(0.22 - aa, 0.22, r) * (1.0 - smoothstep(0.5 - aa, 0.5, r));',
      '  float on = step(1.0 - left, a);',
      '  float hand = (1.0 - smoothstep(0.02, 0.02 + aa, abs(dot(q, vec2(cos(6.2831853 * (1.0 - left)), -sin(6.2831853 * (1.0 - left))))))) * step(r, 0.22) * step(0.0, dot(q, vec2(sin(6.2831853 * (1.0 - left)), cos(6.2831853 * (1.0 - left)))));',
      '  float dot0 = 1.0 - smoothstep(0.045, 0.045 + aa, r);',
      '  vec3 track = vec3(0.10, 0.07, 0.18);',
      '  vec3 c = mix(track, color, on * ring);',
      '  c = mix(c, vec3(1.0), (edge - ring) * 0.9);',
      '  float face = step(r, 0.22) * 0.85;',
      '  c = mix(c, vec3(0.97, 0.95, 1.0), face * (1.0 - hand - dot0));',
      '  c = mix(c, color * 0.8, max(hand, dot0) * step(r, 0.22));',
      '  float alpha = max(edge, max(face, max(hand, dot0) * step(r, 0.22)));',
      '  if (alpha < 0.01) discard;',
      '  gl_FragColor = vec4(c, alpha);',
      '}',
    ].join(String.fromCharCode(10)),
  });
}

export function makeRhythm(world) {
  const specs = world.course.specs.filter((s) => ['beatgroup', 'beat', 'switch', 'freeze', 'door', 'xbridge'].includes(s.t));
  return specs.length ? new Rhythm(world, specs) : null;
}

function col(x, y, z, hx, hy, hz, style, spec) {
  return { shape: 'box', x, y, z, hx, hy, hz, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0, style, stage: spec.stage, spec, obj: null, squash: 0 };
}

function glyphAtlas() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S * 4;
  c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S * 4, S);
  const note = (cx, cy, s, flag) => {
    x.beginPath();
    x.ellipse(cx, cy, 26 * s, 19 * s, -0.45, 0, Math.PI * 2);
    x.fill();
    x.fillRect(cx + 19 * s, cy - 92 * s, 9 * s, 92 * s);
    if (flag) {
      x.beginPath();
      x.moveTo(cx + 28 * s, cy - 92 * s);
      x.quadraticCurveTo(cx + 70 * s, cy - 62 * s, cx + 52 * s, cy - 28 * s);
      x.quadraticCurveTo(cx + 58 * s, cy - 58 * s, cx + 28 * s, cy - 66 * s);
      x.fill();
    }
  };
  for (let k = 0; k < 4; k++) {
    const o = k * S;
    x.save();
    x.translate(o, 0);
    x.strokeStyle = '#fff';
    x.fillStyle = '#fff';
    x.lineWidth = 11;
    x.beginPath();
    x.roundRect(14, 14, S - 28, S - 28, 30);
    x.stroke();
    x.lineWidth = 3;
    x.globalAlpha = 0.55;
    x.beginPath();
    x.roundRect(34, 34, S - 68, S - 68, 18);
    x.stroke();
    x.globalAlpha = 1;
    if (k < 2) {
      x.translate(128, 128);
      x.scale(0.6, 0.6);
      x.translate(-128, -128);
    }
    if (k === 0) note(118, 168, 1, true);
    else if (k === 1) {
      note(92, 176, 0.9, false);
      note(160, 158, 0.9, false);
      x.save();
      x.translate(0, 0);
      x.beginPath();
      x.moveTo(92 + 17, 176 - 83);
      x.lineTo(160 + 26, 158 - 83);
      x.lineTo(160 + 26, 158 - 66);
      x.lineTo(92 + 17, 176 - 66);
      x.closePath();
      x.fill();
      x.restore();
    } else if (k === 2) {
      for (const [a, r] of [[0, 0], [2.1, 1], [4.2, 2]]) {
        x.beginPath();
        x.arc(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46, 20, 0, Math.PI * 2);
        x.fill();
      }
      x.lineWidth = 7;
      x.beginPath();
      x.arc(128, 128, 46, 0, Math.PI * 2);
      x.stroke();
    } else {
      x.lineWidth = 9;
      for (const r of [34, 62]) {
        x.beginPath();
        x.arc(128, 128, r, 0, Math.PI * 2);
        x.stroke();
      }
    }
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

class Rhythm {
  constructor(world, specs) {
    this.w = world;
    this.groups = [];
    this.tiles = [];
    this.fences = [];
    this.switches = [];
    this.doors = [];
    this.bridges = [];
    this.lamps = [];
    this.beatC = new THREE.Color(world.def.beat || 0xfff1d6);
    this.locks = world.def.locks || {};
    this.lockC = (k) => glowColor(this.locks[k] || 0xffffff, 1);
    const byId = new Map();
    for (const s of specs.filter((x) => x.t === 'beatgroup')) {
      const g = { s, id: s.id, mode: s.mode, sets: s.sets, cycle: s.cycle, solid: s.solid, entry: s.entry, tiles: [], u: 0, cur: -1, engaged: false, frozen: 0, armed: false, view: world.viewOf(s), stage: s.stage, last: -1, tickAt: -1 };
      this.groups.push(g);
      byId.set(s.id, g);
    }
    for (const s of specs.filter((x) => x.t === 'beat')) {
      const g = byId.get(s.gid);
      const top = s.y;
      const c = col(s.x, top - s.sy / 2, s.z, s.sx / 2, s.sy / 2, s.sz / 2, 'beat', s);
      world.colliders.push(c);
      const t = { s, g, i: s.i, set: s.set, c, top, gap: s.gap, on: true, nat: true, held: false, k: 1, warn: 0, pop: 0, view: g.view };
      g.tiles[s.i] = t;
      this.tiles.push(t);
    }
    for (const g of this.groups) this.addFences(g);
    for (const s of specs.filter((x) => x.t === 'switch' || x.t === 'freeze')) {
      const c = col(s.x, s.y + 0.06, s.z, 0.75, 0.06, 0.75, 'switch', s);
      world.colliders.push(c);
      const sw = { s, c, id: s.id, freeze: s.t === 'freeze', target: s.target, lock: s.lock, color: this.lockC(s.lock), pressed: false, t: 0, sink: 0, view: world.viewOf(s), lamps: [], off: 0 };
      sw.lamps = this.addRail(sw, s.rail);
      this.switches.push(sw);
    }
    for (const s of specs.filter((x) => x.t === 'xbridge')) {
      const c = col(s.x, s.y - s.sy / 2, s.z, s.sx / 2, s.sy / 2, s.sz / 2, 'bridge', s);
      c.active = false;
      world.colliders.push(c);
      this.bridges.push({ s, c, id: s.id, color: this.lockC(s.lock), e: 0, view: world.viewOf(s) });
    }
    for (const s of specs.filter((x) => x.t === 'door')) {
      const c = col(s.x, s.y + FENCE_H / 2, s.z, s.w / 2, FENCE_H / 2, 0.16, 'door', s);
      c.noCam = true;
      world.colliders.push(c);
      this.doors.push({ s, c, ids: s.ids, colors: s.lock.map((k) => this.lockC(k)), open: 0, view: world.viewOf(s) });
    }
    for (const g of this.groups) {
      g.hasFreeze = this.switches.some((sw) => sw.freeze && sw.target === g.id);
      g.flash = 0;
    }
    this.freezeTiles = this.tiles.filter((t) => t.g.hasFreeze);
    this.build();
  }

  addFences(g) {
    const n = g.tiles.length;
    const mk = (x, y, ze, w, kind, tile, other, side) => {
      const c = col(x, y + FENCE_H / 2, ze - side * 0.6, w / 2, FENCE_H / 2, 0.6, 'fence', tile ? tile.s : g.s);
      c.active = false;
      c.noCam = true;
      this.w.colliders.push(c);
      const f = { g, c, kind, tile, other, x, y, z: ze - side * 0.1, w, k: 0, side };
      this.fences.push(f);
      return f;
    };
    const t0 = g.tiles[0];
    mk(t0.s.x, g.entry.y, g.entry.z, Math.max(t0.s.sx + 1.2, Math.min(g.entry.w, t0.s.sx + 3)), 'entry', null, t0, 1);
    for (let i = 0; i < n; i++) {
      const t = g.tiles[i];
      if (i + 1 < n) mk(t.s.x, t.top, t.s.z - t.s.sz / 2, t.s.sx, 'front', t, g.tiles[i + 1], 1);
      if (i > 0) mk(t.s.x, t.top, t.s.z + t.s.sz / 2, t.s.sx, 'back', t, g.tiles[i - 1], -1);
    }
  }

  addRail(sw, pts) {
    const out = [];
    if (!pts || pts.length < 2) return out;
    let carry = 0;
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      let d = carry;
      while (d <= L) {
        const t = d / L;
        out.push(this.lamps.length);
        this.lamps.push({ sw, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + 0.03, z: a.z + (b.z - a.z) * t, at: (dist + d) / RAIL_SPEED, lit: 0 });
        d += RAIL_STEP;
      }
      carry = d - L;
      dist += L;
    }
    sw.runT = dist / RAIL_SPEED + 0.15;
    sw.rail = pts;
    return out;
  }

  build() {
    const w = this.w;
    const T = (o) => w.track(o);
    const g = new THREE.Group();
    w.group.add(g);
    this.group = g;
    const inst = (geo, mat, n, cast = false) => {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
      im.frustumCulled = false;
      im.castShadow = cast;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(im);
      return im;
    };
    const bodyG = blockGeo(1, 0.7, 1, 0.06, 1);
    const bodyM = T(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.15, vertexColors: true, envMapIntensity: 1.2 }));
    this.body = inst(bodyG, bodyM, this.tiles.length, true);
    this.tiles.forEach((t, i) => this.body.setColorAt(i, _c.set(BODY[t.set % BODY.length])));
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    const atlas = T(glyphAtlas());
    const inlayM = T(new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    inlayM.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float gIdx;\nvarying float vG;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vG = gIdx;');
      sh.fragmentShader = 'varying float vG;\n' + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D( map, vec2( ( vMapUv.x + vG ) / 4.0, vMapUv.y ) );\n diffuseColor *= sampledDiffuseColor;');
    };
    inlayM.customProgramCacheKey = () => 'beatInlay';
    const inlayG = T(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    const gi = new Float32Array(this.tiles.length + this.switches.length);
    this.tiles.forEach((t, i) => (gi[i] = t.set % 3));
    this.switches.forEach((s, i) => (gi[this.tiles.length + i] = 3));
    inlayG.setAttribute('gIdx', new THREE.InstancedBufferAttribute(gi, 1));
    this.inlay = inst(inlayG, inlayM, this.tiles.length + this.switches.length);
    this.inlay.renderOrder = 3;
    const fillM = T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.fill = inst(T(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), fillM, this.tiles.length);
    this.fill.receiveShadow = false;
    this.fill.renderOrder = 2;
    this.fillOn = glowColor(0xffffff, 0.95);
    this.fillFrozen = glowColor(0xb89cff, 0.6);

    const postG = T(new THREE.CylinderGeometry(0.07, 0.09, 1.25, 8).translate(0, 0.62, 0));
    const brass = T(new THREE.MeshStandardMaterial({ color: 0xb58a46, metalness: 0.75, roughness: 0.32 }));
    this.post = inst(postG, brass, this.fences.length * 2);
    const barG = T(new THREE.BoxGeometry(1, 0.08, 0.08));
    const glowM = T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    this.bar = inst(barG, glowM, this.fences.length * 2);

    const capG = T(new THREE.CylinderGeometry(0.62, 0.66, 0.16, 28));
    const rimG = T(new THREE.CylinderGeometry(0.82, 0.9, 0.12, 28, 1).translate(0, -0.02, 0));
    this.swRim = inst(rimG, brass, this.switches.length);
    this.swCap = inst(capG, T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), this.switches.length);

    const lampG = T(new THREE.SphereGeometry(0.09, 10, 6));
    this.lampM = inst(lampG, T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), this.lamps.length);
    const stripParts = [];
    for (const sw of this.switches) {
      const pts = sw.rail || [];
      for (let i = 0; i < pts.length - 1; i++) stripParts.push([pts[i], pts[i + 1], sw]);
    }
    this.strips = stripParts;
    this.strip = inst(T(new THREE.BoxGeometry(0.22, 0.05, 1)), brass, stripParts.length);

    const frameParts = [];
    for (const sx of [-1, 1]) frameParts.push(new THREE.BoxGeometry(0.26, 3, 0.36).translate(sx * 0.5, 1.5, 0).toNonIndexed());
    for (const p of frameParts) p.deleteAttribute('uv');
    const frameG = T(mergeGeometries(frameParts, false));
    for (const p of frameParts) p.dispose();
    const walnut = T(new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.6 }));
    this.doorFrame = inst(frameG, walnut, this.doors.length * 2);
    const lintelG = T(new THREE.BoxGeometry(1, 0.34, 0.42).translate(0, 3.1, 0));
    this.lintel = inst(lintelG, walnut, this.doors.length);
    const shutterG = blockGeo(1, 1, 0.14, 0.05, 1);
    this.shutterM = T(new THREE.MeshStandardMaterial({ color: 0xa89c86, roughness: 0.55, metalness: 0.05, vertexColors: true }));
    this.shutter = inst(shutterG, this.shutterM, this.doors.length);
    const dl = this.doors.reduce((n, d) => n + d.colors.length, 0);
    this.doorLamp = inst(T(new THREE.SphereGeometry(0.17, 14, 10)), T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), dl);
    this.gearG = T(this.gearGeo(0.42, 10));
    this.doorGear = inst(this.gearG, brass, this.doors.length);

    this.arrows = [];
    this.doors.forEach((d) => {
      for (const [x0, z0, x1, z1] of d.s.arrows || []) {
        const L = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.round(L / 0.9));
        const yaw = Math.atan2(x1 - x0, z1 - z0);
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n;
          this.arrows.push({ d, k, x: x0 + (x1 - x0) * f, y: d.s.y + 0.02, z: z0 + (z1 - z0) * f, yaw });
        }
      }
    });
    const chev = [-1, 1].map((sx) => new THREE.BoxGeometry(0.62, 0.03, 0.17).rotateY(sx * 0.7).translate(sx * 0.21, 0, -0.18));
    const chevG = T(mergeGeometries(chev, false));
    for (const c of chev) c.dispose();
    this.arrowM = inst(chevG, T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), this.arrows.length);
    this.arrowM.receiveShadow = false;
    const brG = blockGeo(1, 1, 1, 0.08, 1);
    this.bridgeM = T(new THREE.MeshStandardMaterial({ color: 0x9a6a48, roughness: 0.5, vertexColors: true }));
    this.bridge = inst(brG, this.bridgeM, this.bridges.length, true);
    this.bridgeEdge = inst(T(new THREE.BoxGeometry(1, 0.06, 1)), T(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), this.bridges.length * 2 + dl + this.freezeTiles.length);
    this.timerM = T(timerMaterial(false));
    this.timerTopM = T(timerMaterial(true));
    const plane = T(new THREE.PlaneGeometry(1, 1));
    this.timerFloor = new THREE.Mesh(plane, this.timerM);
    this.timerFloor.rotation.x = -Math.PI / 2;
    this.timerFloor.frustumCulled = false;
    this.timerFloor.visible = false;
    this.timerFloor.renderOrder = 5;
    this.timerTop = new THREE.Mesh(plane, this.timerTopM);
    this.timerTop.frustumCulled = false;
    this.timerTop.visible = false;
    this.timerTop.renderOrder = 20;
    g.add(this.timerFloor, this.timerTop);
    this.placeStatic();
  }

  updateTimer(t) {
    const g = this.groups.find((x) => x.hasFreeze && (x.armed || x.frozen > 0));
    const sw = g && this.switches.find((x) => x.freeze && x.target === g.id);
    const p = this.w.player;
    const show = !!(g && sw && this.on(sw.view));
    this.timerFloor.visible = show;
    this.timerTop.visible = show && !!p && !p.dead;
    if (!show) return;
    const left = g.armed ? 1 : g.frozen / FREEZE_T;
    const warn = !g.armed && g.frozen < FREEZE_WARN;
    const pulse = warn ? 0.75 + 0.25 * Math.cos(g.frozen * Math.PI * 4) : 1;
    for (const m of [this.timerM, this.timerTopM]) {
      m.uniforms.left.value = left;
      m.uniforms.color.value.set(warn ? 0xff4a00 : 0x8a3cff).multiplyScalar(pulse);
    }
    this.timerFloor.position.set(sw.s.x, sw.s.y + 0.14, sw.s.z);
    this.timerFloor.scale.setScalar(3.4);
    if (this.timerTop.visible) {
      this.timerTop.position.set(p.pos.x, p.pos.y + 2.9 + 0.05 * Math.sin(t * 3), p.pos.z);
      if (this.w.camera) this.timerTop.quaternion.copy(this.w.camera.quaternion);
      this.timerTop.scale.setScalar(warn ? 1.9 + 0.15 * Math.max(0, Math.cos(g.frozen * Math.PI * 2)) : 1.7);
    }
  }

  gearGeo(r, teeth) {
    const s = new THREE.Shape();
    const n = teeth * 4;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const q = i % 4;
      const rr = q === 1 || q === 2 ? r : r * 0.8;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
  }

  on(v) {
    return this.w.window === null || this.w.inWindow(v);
  }

  placeStatic() {
    this.placed = this.w.window;
    this.strips.forEach(([a, b, sw], i) => {
      const k = this.on(sw.view) ? 1 : 0;
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      _q.setFromAxisAngle(_p.set(0, 1, 0), Math.atan2(b.x - a.x, b.z - a.z));
      _m.compose(_p.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.005, (a.z + b.z) / 2), _q, _s.set(k, k, (L + 0.22) * k));
      this.strip.setMatrixAt(i, _m);
    });
    this.strip.instanceMatrix.needsUpdate = true;
    this.switches.forEach((sw, i) => {
      const k = this.on(sw.view) ? 1 : 0;
      _m.compose(_p.set(sw.s.x, sw.s.y + 0.06, sw.s.z), _q.identity(), _s.setScalar(k));
      this.swRim.setMatrixAt(i, _m);
    });
    this.swRim.instanceMatrix.needsUpdate = true;
  }

  natural(g, t) {
    const step = g.cycle / g.sets;
    const p = (((g.u - t.set * step) % g.cycle) + g.cycle) % g.cycle;
    const on = p < g.solid;
    return { on, left: on ? g.solid - p : 0, until: on ? 0 : g.cycle - p };
  }

  near(t, p, pad) {
    const s = t.s;
    const dx = Math.max(0, Math.abs(p.x - s.x) - s.sx / 2);
    const dz = Math.max(0, Math.abs(p.z - s.z) - s.sz / 2);
    return dx * dx + dz * dz < pad * pad && p.y > t.top - 3 && p.y < t.top + 3.2;
  }

  engage(g, p) {
    if (!p) return false;
    const e = g.entry;
    let x0 = e.x - 4;
    let x1 = e.x + 4;
    let z1 = e.z + 4;
    let z0 = e.z;
    let top = e.y;
    for (const t of g.tiles) {
      x0 = Math.min(x0, t.s.x - t.s.sx / 2 - 3);
      x1 = Math.max(x1, t.s.x + t.s.sx / 2 + 3);
      z0 = Math.min(z0, t.s.z - t.s.sz / 2 - 3);
      top = Math.max(top, t.top);
    }
    return p.pos.x > x0 && p.pos.x < x1 && p.pos.z > z0 && p.pos.z < z1 && p.pos.y > top - 6 && p.pos.y < top + 6;
  }

  step(dt) {
    const p = this.w.player && !this.w.player.dead ? this.w.player : null;
    const as = this.w.assistStage;
    for (const sw of this.switches) this.stepSwitch(sw, p, dt);
    for (const g of this.groups) {
      g.u += dt * (as === g.stage ? 0.7 : 1);
      g.engaged = this.engage(g, p);
      const n = g.tiles.length;
      if (!g.engaged) g.cur = -1;
      else if (p.grounded && p.ground) {
        const tile = g.tiles.find((t) => t.c === p.ground);
        if (tile) g.cur = tile.i;
        else if (p.pos.z > g.entry.z - 0.05) g.cur = -1;
        else if (p.pos.z < g.tiles[n - 1].s.z - g.tiles[n - 1].s.sz / 2) g.cur = n;
      }
      if (g.armed && g.engaged && g.cur >= 0 && g.frozen <= 0) {
        g.armed = false;
        g.frozen = FREEZE_T;
      }
      g.flash = Math.max(0, g.flash - dt);
      if (g.frozen > 0) {
        const before = Math.ceil(g.frozen);
        g.frozen -= dt;
        if (Math.ceil(g.frozen) !== before && g.frozen > 0) this.sound(g.frozen < FREEZE_WARN ? 'freezeTick' : 'freezeTock', g);
        if (g.frozen <= 0) {
          g.frozen = 0;
          this.sound('thaw', g);
        }
      }
      const frozen = g.armed || g.frozen > 0;
      let flips = 0;
      for (const t of g.tiles) {
        const nat = this.natural(g, t);
        const forced = frozen || (g.engaged && t.i <= g.cur + 1 && (g.mode === 'wait' || (g.hasFreeze && t.i <= 1)));
        const was = t.on;
        if (p && this.near(t, p.pos, t.gap + LATCH)) {
          if (was) t.held = true;
        } else if (!p || !this.near(t, p.pos, t.gap + LATCH + 0.3)) t.held = false;
        t.on = nat.on || t.held || forced;
        t.warn = t.on && !t.held && !forced && nat.left < WARN ? 1 - nat.left / WARN : 0;
        t.safe = t.on && (t.held || forced || t.warn === 0);
        t.pre = !t.on && nat.until < PRE ? 1 - nat.until / PRE : 0;
        t.c.active = t.on;
        if (t.on !== was) {
          t.pop = 1;
          flips++;
        }
      }
      if (flips && this.on(g.view) && p && g.engaged) this.sound('tock', g);
      const warnNow = g.tiles.some((t) => t.warn > 0);
      if (warnNow && !g.warnSnd && this.on(g.view) && g.engaged) this.sound('tick', g);
      g.warnSnd = warnNow;
    }
    for (const f of this.fences) {
      const g = f.g;
      let want = false;
      if (g.engaged && !g.armed && !(g.frozen > 0)) {
        if (f.kind === 'entry') want = g.cur === -1 && !f.other.safe;
        else want = g.cur === f.tile.i && !f.other.safe;
      }
      if (want && !f.c.active && p && this.overlaps(f.c, p.pos) && (p.pos.z - f.c.z) * f.side < 0.05) want = false;
      f.c.active = want;
    }
    for (const b of this.bridges) {
      const sw = this.switches.find((s) => s.id === b.id && !s.freeze);
      if (sw && sw.pressed && sw.t >= sw.runT) b.e = Math.min(1, b.e + dt / EXTEND);
      b.c.active = b.e >= 1;
    }
    for (const d of this.doors) {
      const ready = d.ids.every((id) => this.bridges.filter((b) => b.id === id).every((b) => b.e >= 1));
      if (ready) {
        if (d.open === 0) this.sound('door', d);
        d.open = Math.min(1, d.open + dt / DOOR_T);
      }
      d.c.active = d.open < 0.6;
    }
  }

  overlaps(c, pos) {
    return Math.abs(pos.x - c.x) < c.hx + 0.42 && Math.abs(pos.z - c.z) < c.hz + 0.42 && pos.y < c.y + c.hy && pos.y + 1.7 > c.y - c.hy;
  }

  stepSwitch(sw, p, dt) {
    const on = !!p && p.grounded && p.ground === sw.c;
    if (sw.pressed) sw.t += dt;
    if (on && !sw.pressed) {
      sw.pressed = true;
      sw.t = 0;
      this.sound('press', sw);
      if (sw.freeze) {
        const g = this.groups.find((x) => x.id === sw.target);
        if (g) {
          g.armed = true;
          g.frozen = 0;
          g.flash = 0.7;
          for (const t of g.tiles) t.pop = 1;
          this.sound('freezeOn', g);
        }
      }
      if (this.w.events) this.w.events('switch', sw.c);
    }
    if (sw.freeze && sw.pressed) {
      const g = this.groups.find((x) => x.id === sw.target);
      if (on) sw.off = 0;
      else sw.off += dt;
      if (g && !g.armed && g.frozen <= 0 && sw.off > 1) sw.pressed = false;
    }
    sw.sink += ((sw.pressed ? 1 : 0) - sw.sink) * (1 - Math.exp(-18 * dt));
    sw.c.y = sw.s.y + 0.06 - sw.sink * 0.08;
  }

  sound(kind, o) {
    const a = this.w.audio;
    if (!a || !a.ctx) return;
    if (kind === 'tock') {
      a.tone(660, 0.09, { type: 'square', vol: 0.035 });
      a.tone(1320, 0.05, { type: 'sine', vol: 0.03 });
    } else if (kind === 'tick') a.tone(1760, 0.035, { type: 'square', vol: 0.03 });
    else if (kind === 'press') {
      a.tone(220, 0.06, { type: 'square', vol: 0.06 });
      [1047, 1319, 1568].forEach((f, i) => a.tone(f, 0.5, { type: 'sine', vol: 0.08, when: 0.05 + i * 0.09 }));
    } else if (kind === 'door') {
      a.noise(0.5, { vol: 0.05, freq: 900, type: 'bandpass' });
      a.tone(784, 0.4, { type: 'triangle', vol: 0.07, when: 0.1 });
    } else if (kind === 'freezeTick') {
      a.tone(1397, 0.07, { type: 'triangle', vol: 0.07 });
      a.tone(1397, 0.05, { type: 'triangle', vol: 0.05, when: 0.25 });
    } else if (kind === 'freezeTock') a.tone(880, 0.05, { type: 'triangle', vol: 0.04 });
    else if (kind === 'freezeOn') [784, 988, 1175, 1568].forEach((f, i) => a.tone(f, 0.3, { type: 'triangle', vol: 0.07, when: i * 0.07 }));
    else if (kind === 'thaw') a.tone(587, 0.3, { type: 'triangle', vol: 0.06, slide: 0.7 });
  }

  dock() {
    for (const g of this.groups) {
      g.cur = -1;
      for (const t of g.tiles) t.held = false;
    }
  }

  reset() {
    for (const sw of this.switches) {
      sw.pressed = false;
      sw.t = 0;
      sw.sink = 0;
      sw.off = 0;
      sw.again = false;
    }
    for (const b of this.bridges) {
      b.e = 0;
      b.c.active = false;
    }
    for (const d of this.doors) {
      d.open = 0;
      d.c.active = true;
    }
    for (const g of this.groups) {
      g.armed = false;
      g.frozen = 0;
      g.u = 0;
    }
    for (const l of this.lamps) l.lit = 0;
  }

  placeArrows(t) {
    this.arrows.forEach((a, i) => {
      const vis = this.on(a.d.view) ? 1 : 0;
      const open = a.d.open > 0;
      _q.setFromAxisAngle(_p.set(0, 1, 0), a.yaw);
      const k = open ? 1.15 : 0.9;
      _m.compose(_p.set(a.x, a.y, a.z), _q, _s.set(k * vis, vis, k * vis));
      this.arrowM.setMatrixAt(i, _m);
      const beat = open ? Math.max(0, Math.sin(t * 6 - a.k * 1.1)) : 0;
      this.arrowM.setColorAt(i, _c.copy(this.beatC).multiplyScalar(open ? 1.4 + 2.2 * beat : 0.22));
    });
    this.arrowM.instanceMatrix.needsUpdate = true;
    if (this.arrowM.instanceColor) this.arrowM.instanceColor.needsUpdate = true;
  }

  respawned() {
    for (const sw of this.switches) {
      if (!sw.freeze) continue;
      const g = this.groups.find((x) => x.id === sw.target);
      if (!g || !(sw.pressed || g.armed || g.frozen > 0)) continue;
      g.armed = false;
      g.frozen = 0;
      sw.pressed = false;
      sw.t = 0;
      sw.off = 0;
      sw.again = true;
    }
  }

  update(t, dt) {
    if (this.placed !== this.w.window) this.placeStatic();
    const anyT = this.tiles.some((x) => this.on(x.view));
    const anyS = this.switches.some((x) => this.on(x.view));
    const anyD = this.doors.some((x) => this.on(x.view));
    const anyB = this.bridges.some((x) => this.on(x.view));
    const anyF = this.fences.some((x) => x.k > 0.01 && this.on(x.g.view));
    this.body.visible = anyT;
    this.fill.visible = anyT;
    this.inlay.visible = anyT || anyS;
    this.post.visible = anyF;
    this.bar.visible = anyF;
    for (const im of [this.swRim, this.swCap, this.lampM, this.strip]) im.visible = anyS;
    for (const im of [this.doorFrame, this.lintel, this.shutter, this.doorLamp, this.doorGear]) im.visible = anyD;
    this.arrowM.visible = anyD && this.arrows.length > 0;
    if (this.arrowM.visible) this.placeArrows(t);
    this.bridge.visible = anyB;
    this.bridgeEdge.visible = anyB || anyD || this.freezeTiles.some((t) => this.on(t.view) && (t.g.armed || t.g.frozen > 0));
    const ke = 1 - Math.exp(-14 * dt);
    const violet = new THREE.Color(0x9a6aff);
    const frost = new THREE.Color(0x4a2a9a);
    this.tiles.forEach((tl, i) => {
      const vis = this.on(tl.view) ? 1 : 0;
      tl.k += ((tl.on ? 1 : 0) - tl.k) * (tl.on ? 1 - Math.exp(-22 * dt) : ke);
      tl.pop = Math.max(0, tl.pop - dt * 4);
      const s = tl.s;
      const k = tl.k;
      const sink = tl.warn * 0.12;
      const sq = tl.on ? 1 + Math.sin(tl.pop * Math.PI) * 0.06 : 1;
      _m.compose(_p.set(s.x, tl.top - 0.35 - sink - (1 - k) * 0.25, s.z), _q.identity(), _s.set(s.sx * k * sq * vis, k * vis + 0.0001, s.sz * k * sq * vis));
      this.body.setMatrixAt(i, _m);
      _m.compose(_p.set(s.x, tl.top + 0.012 - sink, s.z), _q.identity(), _s.set(s.sx * 0.96 * vis, 1, s.sz * 0.96 * vis));
      this.inlay.setMatrixAt(i, _m);
      const g = tl.g;
      const frozen = g.armed || g.frozen > 0;
      let glow = tl.on ? 2.9 : 0.55;
      if (tl.warn > 0) glow = 0.6 + 2.0 * (0.5 + 0.5 * Math.cos(tl.warn * Math.PI * 3));
      else if (!tl.on && tl.pre > 0) glow = 0.55 + 1.5 * tl.pre * tl.pre;
      if (frozen && g.frozen > 0 && g.frozen < 2) glow *= 0.65 + 0.35 * Math.cos(g.frozen * Math.PI * 2);
      if (g.flash > 0) glow += 3.5 * (g.flash / 0.7);
      _c.copy(frozen ? violet : this.beatC).multiplyScalar(frozen ? glow * 1.3 : glow);
      this.inlay.setColorAt(i, _c);
      const lit = tl.on ? (tl.warn > 0 ? 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(tl.warn * Math.PI * 3)) : 1) : 0;
      _m.compose(_p.set(s.x, tl.top + 0.006 - sink, s.z), _q.identity(), _s.set(s.sx * 0.97 * k * vis * (lit > 0 ? 1 : 0), 1, s.sz * 0.97 * k * vis * (lit > 0 ? 1 : 0)));
      this.fill.setMatrixAt(i, _m);
      this.fill.setColorAt(i, _c.copy(frozen ? this.fillFrozen : this.fillOn).multiplyScalar(lit));
      if (frozen !== tl.frozenLook) {
        tl.frozenLook = frozen;
        this.body.setColorAt(i, _c.set(frozen ? frost : BODY[tl.set % BODY.length]));
        this.body.instanceColor.needsUpdate = true;
      }
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.inlay.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
    const nT = this.tiles.length;
    this.switches.forEach((sw, i) => {
      const vis = this.on(sw.view) ? 1 : 0;
      if (sw.pressed) sw.again = false;
      const beat = sw.again ? Math.max(0, Math.sin(t * 7)) : 0;
      _m.compose(_p.set(sw.s.x, sw.s.y + 0.13 - sw.sink * 0.1, sw.s.z), _q.identity(), _s.set(vis * (1 + 0.3 * beat), vis, vis * (1 + 0.3 * beat)));
      this.swCap.setMatrixAt(i, _m);
      const idle = sw.again ? 0.9 + 2.2 * beat : 0.55 + 0.2 * Math.sin(t * 4 + i);
      const under = this.w.player && Math.hypot(this.w.player.pos.x - sw.s.x, this.w.player.pos.z - sw.s.z) < 1.6 && Math.abs(this.w.player.pos.y - sw.s.y) < 2.5;
      _c.copy(sw.color).multiplyScalar(sw.pressed ? (under ? 1.8 : 3.4) : idle);
      this.swCap.setColorAt(i, _c);
      _m.compose(_p.set(sw.s.x, sw.s.y + 0.215 - sw.sink * 0.1, sw.s.z), _q.identity(), _s.set(1.1 * vis, 1, 1.1 * vis));
      this.inlay.setMatrixAt(nT + i, _m);
      _c.set(0xffffff).multiplyScalar(sw.pressed ? 0.25 : 0.9 + 0.4 * Math.sin(t * 4 + i));
      this.inlay.setColorAt(nT + i, _c);
    });
    this.swCap.instanceMatrix.needsUpdate = true;
    if (this.swCap.instanceColor) this.swCap.instanceColor.needsUpdate = true;
    if (this.inlay.instanceColor) this.inlay.instanceColor.needsUpdate = true;
    this.lamps.forEach((l, i) => {
      const sw = l.sw;
      const vis = this.on(sw.view) ? 1 : 0;
      const want = sw.pressed && sw.t >= l.at ? (sw.t - l.at < 0.25 ? 4.5 : 2.9) : 0.45 + 0.2 * Math.max(0, Math.sin(t * 3 - l.at * 4));
      l.lit += (want - l.lit) * (1 - Math.exp(-20 * dt));
      _m.compose(_p.set(l.x, l.y, l.z), _q.identity(), _s.setScalar(vis * (l.lit > 3.5 ? 1.5 : 1)));
      this.lampM.setMatrixAt(i, _m);
      _c.copy(sw.color).multiplyScalar(l.lit);
      this.lampM.setColorAt(i, _c);
    });
    this.lampM.instanceMatrix.needsUpdate = true;
    if (this.lampM.instanceColor) this.lampM.instanceColor.needsUpdate = true;
    this.fences.forEach((f, i) => {
      const vis = this.on(f.g.view) ? 1 : 0;
      f.k += ((f.c.active ? 1 : 0) - f.k) * (1 - Math.exp(-16 * dt));
      const k = f.k * vis;
      [-1, 1].forEach((sx, j) => {
        _m.compose(_p.set(f.x + sx * (f.w / 2 - 0.1), f.y - 1.25 * (1 - f.k), f.z), _q.identity(), _s.set(k, k, k));
        this.post.setMatrixAt(i * 2 + j, _m);
      });
      [0.55, 1.1].forEach((h, j) => {
        _m.compose(_p.set(f.x, f.y + h - 1.25 * (1 - f.k), f.z), _q.identity(), _s.set((f.w - 0.2) * k, k, k));
        this.bar.setMatrixAt(i * 2 + j, _m);
      });
    });
    this.post.instanceMatrix.needsUpdate = true;
    this.bar.instanceMatrix.needsUpdate = true;
    this.bar.material.color.copy(this.beatC).multiplyScalar(1.7 + 0.4 * Math.sin(t * Math.PI * 4));
    let li = 0;
    const nE = this.bridges.length * 2;
    const cam = this.w.camera ? this.w.camera.position : null;
    this.doors.forEach((d, i) => {
      const near = cam && Math.abs(cam.x - d.s.x) < d.s.w / 2 + 1.2 && Math.abs(cam.z - d.s.z) < 4 && cam.y < d.s.y + 5.5;
      const vis = this.on(d.view) && !near ? 1 : 0;
      const s = d.s;
      [-1, 1].forEach((sx, j) => {
        _m.compose(_p.set(s.x + sx * (s.w / 2 + 0.05), s.y, s.z), _q.identity(), _s.setScalar(vis));
        this.doorFrame.setMatrixAt(i * 2 + j, _m);
      });
      _m.compose(_p.set(s.x, s.y, s.z), _q.identity(), _s.set((s.w + 0.6) * vis, vis, vis));
      this.lintel.setMatrixAt(i, _m);
      const o = smooth(0, 1, d.open);
      _m.compose(_p.set(s.x, s.y + 1.5 + o * 1.45, s.z), _q.identity(), _s.set(s.w * vis, 3 * (1 - o * 0.9) * vis + 0.0001, vis));
      this.shutter.setMatrixAt(i, _m);
      this.shutter.setColorAt(i, _c.set(0xffffff).lerp(d.colors[0], 0.5 * (1 - o)));
      d.colors.forEach((c, j) => {
        const off = d.colors.length > 1 ? (j - 0.5) * 0.7 : 0;
        _m.compose(_p.set(s.x + off, s.y + 3.1, s.z + 0.24), _q.identity(), _s.setScalar(vis));
        this.doorLamp.setMatrixAt(li, _m);
        const sw = this.switches.find((x) => x.id === d.ids[j]);
        const lit = sw && sw.pressed && sw.t >= sw.runT;
        _c.copy(c).multiplyScalar(lit ? 3.4 : 1.1 + 0.3 * Math.sin(t * 3 + j));
        this.doorLamp.setColorAt(li, _c);
        const band = d.colors.length > 1 ? 1.15 + j * 0.55 : 1.4;
        _m.compose(_p.set(s.x, s.y + band + o * 1.45, s.z + 0.09), _q.identity(), _s.set((s.w - 0.3) * vis * (1 - o), 2.2 * vis * (1 - o) + 0.0001, 0.06 * vis));
        this.bridgeEdge.setMatrixAt(nE + li, _m);
        this.bridgeEdge.setColorAt(nE + li, _c);
        li++;
      });
      _q.setFromAxisAngle(_p.set(0, 0, 1), d.open * 6 + (d.open > 0 && d.open < 1 ? t * 4 : 0));
      _m.compose(_p.set(s.x + s.w / 2 - 0.15, s.y + 2.75, s.z + 0.26), _q, _s.setScalar(vis));
      this.doorGear.setMatrixAt(i, _m);
    });
    for (const im of [this.shutter, this.doorLamp, this.doorGear, this.doorFrame, this.lintel]) im.instanceMatrix.needsUpdate = true;
    if (this.shutter.instanceColor) this.shutter.instanceColor.needsUpdate = true;
    if (this.doorLamp.instanceColor) this.doorLamp.instanceColor.needsUpdate = true;
    this.bridges.forEach((b, i) => {
      const vis = this.on(b.view) ? 1 : 0;
      const s = b.s;
      const e = smooth(0, 1, b.e);
      const len = s.sz * e;
      const z = s.z + s.sz / 2 - len / 2;
      _m.compose(_p.set(s.x, s.y - s.sy / 2, z), _q.identity(), _s.set(s.sx * vis, s.sy * vis, Math.max(0.001, len) * vis));
      this.bridge.setMatrixAt(i, _m);
      [-1, 1].forEach((sx, j) => {
        _m.compose(_p.set(s.x + sx * (s.sx / 2 - 0.12), s.y + 0.02, z), _q.identity(), _s.set(0.14 * vis, vis, Math.max(0.001, len - 0.1) * vis));
        this.bridgeEdge.setMatrixAt(i * 2 + j, _m);
        _c.copy(b.color).multiplyScalar(b.e > 0 ? 2.9 : 0);
        this.bridgeEdge.setColorAt(i * 2 + j, _c);
      });
    });
    this.updateTimer(t);
    const nF = this.bridges.length * 2 + li;
    this.freezeTiles.forEach((tl, i) => {
      const g = tl.g;
      const left = g.armed ? 1 : g.frozen / FREEZE_T;
      const vis = this.on(tl.view) && left > 0 ? 1 : 0;
      const s = tl.s;
      const w = (s.sx - 0.5) * left;
      _m.compose(_p.set(s.x - (s.sx - 0.5) / 2 + w / 2, tl.top + 0.05, s.z + s.sz / 2 - 0.35), _q.identity(), _s.set(Math.max(0.001, w) * vis, 1.6 * vis + 0.0001, 0.22 * vis));
      this.bridgeEdge.setMatrixAt(nF + i, _m);
      _c.set(0x9a6aff);
      this.bridgeEdge.setColorAt(nF + i, _c.multiplyScalar(2.9 / (0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b)));
    });
    this.bridge.instanceMatrix.needsUpdate = true;
    this.bridgeEdge.instanceMatrix.needsUpdate = true;
    if (this.bridgeEdge.instanceColor) this.bridgeEdge.instanceColor.needsUpdate = true;
  }
}
