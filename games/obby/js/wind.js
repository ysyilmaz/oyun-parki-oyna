import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowColor, nearFade } from './shaders.js';

const LIFT = 6.5;
const RELEASE_VY = 6;
const LIP_H = 2.8;
const FOOT = 0.42;
const PULL = 3;
const PULL_V = 4;
const SLOTS = 48;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _z = new THREE.Vector3(0, 0, 1);
const _y = new THREE.Vector3(0, 1, 0);

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function makeWind(world) {
  const specs = world.course.specs.filter((s) => s.t === 'wind' || s.t === 'updraft' || s.t === 'fans');
  return specs.length ? new Wind(world, specs) : null;
}

const STREAK_VERT = `
attribute vec4 wa;
attribute float wb;
uniform vec3 focus;
varying vec4 vA;
varying float vB;
varying float vD;
varying float vL;
varying float vT;
void main(){
  vA = wa;
  vB = wb;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vD = distance(wp.xyz, cameraPosition);
  vec3 ab = focus + vec3(0.0, 0.9, 0.0) - cameraPosition;
  float t = clamp(dot(wp.xyz - cameraPosition, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
  vL = length(wp.xyz - cameraPosition - ab * t);
  vT = t;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const STREAK_FRAG = `
uniform float time;
uniform float k[${SLOTS}];
uniform vec3 color;
varying vec4 vA;
varying float vB;
varying float vD;
varying float vL;
varying float vT;
void main(){
  int i = int(vA.z + 0.5);
  float s = 0.0;
  for (int j = 0; j < ${SLOTS}; j++) if (j == i) s = k[j];
  if (s < 0.01) discard;
  float u = vA.x;
  float d = fract(u * vB - time * vA.w + vA.y * 3.7);
  float dash = smoothstep(0.0, 0.12, d) * smoothstep(0.62, 0.38, d);
  float ends = smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.72, 1.0, u));
  float a = dash * ends * s * smoothstep(2.6, 4.5, vD) * smoothstep(0.7, 1.6, vL) * mix(smoothstep(1.4, 2.4, vL), 1.0, step(0.995, vT)) * (1.0 - smoothstep(55.0, 95.0, vD));
  gl_FragColor = vec4(color * (0.8 + 0.4 * dash), a * 0.82);
}`;

const SPECK_VERT = `
uniform float time;
uniform float k[${SLOTS}];
uniform float scale;
uniform vec3 focus;
attribute vec4 sa;
attribute vec4 sb;
varying float vA;
void main(){
  int i = int(sb.w + 0.5);
  float s = 0.0;
  for (int j = 0; j < ${SLOTS}; j++) if (j == i) s = k[j];
  float f = fract(sa.w + time * sb.z / sb.y);
  float ang = sb.x + f * 7.0;
  vec3 p = vec3(sa.x + cos(ang) * sa.y * 0.75, sa.z + f * sb.y, position.z + sin(ang) * sa.y * 0.75);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vec3 ab = focus + vec3(0.0, 0.9, 0.0) - cameraPosition;
  float t = clamp(dot(p - cameraPosition, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
  float l = length(p - cameraPosition - ab * t);
  vA = s * smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.75, 1.0, f)) * mix(smoothstep(0.9, 1.8, l), 1.0, step(0.995, t));
  gl_PointSize = s > 0.01 ? scale * 0.16 / -mv.z : 0.0;
  gl_Position = projectionMatrix * mv;
}`;

const SPECK_FRAG = `
uniform vec3 color;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(c)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(color, a);
}`;

class Wind {
  constructor(world, specs) {
    this.w = world;
    this.lanes = [];
    this.drafts = [];
    this.rings = [];
    this.ride = null;
    this.pushT = 0;
    this.color = new THREE.Color(world.def.wind || 0x2fa8d8);
    for (const s of specs) {
      const view = world.viewOf(s);
      if (s.t === 'wind') {
        this.lanes.push({ s, view, stage: s.stage, x0: s.x - s.sx / 2, x1: s.x + s.sx / 2, z0: s.z - s.sz / 2, z1: s.z + s.sz / 2, y0: s.y0, y1: s.y + s.h, top: s.y, vx: s.vx, vz: s.vz, k: s.pulse ? 0 : 1, spin: 1, u: 0 });
      } else if (s.t === 'updraft') this.drafts.push({ s, view, stage: s.stage, x: s.x, y: s.y, z: s.z, r: s.r, rise: s.rise, exit: s.exit, target: s.target, spin: 1 });
      else this.rings.push({ s, view });
    }
    this.k = new Float32Array(SLOTS);
    this.addLips();
    this.build();
  }

  addLips() {
    this.lips = [];
    for (const L of this.lanes) {
      if (!L.s.lip || !L.vx) continue;
      const side = Math.sign(L.vx);
      const x = (side > 0 ? L.x1 : L.x0) + side * 0.14;
      const c = { shape: 'box', x, y: L.top + LIP_H / 2, z: (L.z0 + L.z1) / 2, hx: 0.14, hy: LIP_H / 2, hz: (L.z1 - L.z0) / 2, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0, style: 'curb', stage: L.stage, spec: null, obj: null, squash: 0 };
      this.w.colliders.push(c);
      this.lips.push({ L, x, side, len: L.z1 - L.z0 });
    }
  }

  fanSpots() {
    const out = [];
    for (const L of this.lanes) {
      if (L.vx) {
        const side = -Math.sign(L.vx);
        const x = (side > 0 ? L.x1 : L.x0) + side * 1.15;
        const len = L.z1 - L.z0;
        const n = Math.max(1, Math.round(len / 4.6));
        for (let i = 0; i < n; i++) out.push({ L, x, y: L.top + 1.25, z: L.z1 - ((i + 0.5) * len) / n, dir: [Math.sign(L.vx), 0, 0], r: 1.05 });
      } else {
        const w = L.x1 - L.x0;
        for (const side of [-1, 1]) out.push({ L, x: (L.x0 + L.x1) / 2 + side * (w / 2 + 1.15), y: L.top + 1.25, z: L.z1 - 0.6, dir: [-side * 0.35, 0, Math.sign(L.vz) * 0.94], r: 1.05 });
      }
    }
    for (const R of this.rings) {
      const n = R.s.n;
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        if (sa > 0.2 && Math.abs(ca) < 0.6) continue;
        out.push({ R, x: R.s.x + ca * R.s.r, y: R.s.y + 1.4, z: R.s.z + sa * R.s.r, dir: [ca * 0.8, 0.6, sa * 0.8], r: 1.15 });
      }
    }
    return out;
  }

  build() {
    const w = this.w;
    const T = (o) => w.track(o);
    const g = new THREE.Group();
    w.group.add(g);
    this.group = g;
    const brass = T(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.55 }));
    const ivory = T(new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.45, metalness: 0.05 }));
    const iron = T(new THREE.MeshStandardMaterial({ color: 0x46505e, roughness: 0.55, metalness: 0.5 }));
    const glow = T(new THREE.MeshBasicMaterial({ color: glowColor(this.color, 2.9) }));

    this.fans = this.fanSpots();
    const drafts = this.drafts;
    const cowlG = T(this.cowlGeo());
    const rotorG = T(this.rotorGeo());
    const pylonG = T(new THREE.CylinderGeometry(0.16, 0.24, 1, 8, 1).translate(0, -0.5, 0));
    const nF = this.fans.length + drafts.length;
    this.cowl = new THREE.InstancedMesh(cowlG, brass, Math.max(1, nF));
    this.rotor = new THREE.InstancedMesh(rotorG, ivory, Math.max(1, nF));
    this.pylon = new THREE.InstancedMesh(pylonG, iron, Math.max(1, this.fans.length));
    this.cowl.castShadow = true;
    this.rotor.castShadow = true;
    for (const im of [this.cowl, this.rotor, this.pylon]) {
      im.frustumCulled = false;
      im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(im);
    }
    this.fans.forEach((f) => {
      const d = _p.set(...f.dir).normalize();
      f.q = new THREE.Quaternion().setFromUnitVectors(_z, d);
      f.view = f.L ? f.L.view : f.R.view;
      f.spin = 0;
      f.ang = Math.random() * 6;
    });
    drafts.forEach((d) => {
      d.q = new THREE.Quaternion().setFromUnitVectors(_z, _y);
      d.ang = 0;
    });

    const ringG = T(new THREE.TorusGeometry(1, 0.07, 8, 48).rotateX(Math.PI / 2));
    this.ring = new THREE.InstancedMesh(ringG, glow, Math.max(1, drafts.length * 2));
    this.ring.frustumCulled = false;
    g.add(this.ring);

    const poleG = T(new THREE.CylinderGeometry(0.06, 0.1, 8.2, 8).translate(0, -0.9, 0));
    const sockG = T(this.sockGeo());
    const sockM = T(nearFade(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), 'windSock', 9));
    this.socks = this.lanes.filter((L) => L.s.sock).map((L) => {
      const vx = L.vx;
      const vz = L.vz;
      const x = vx ? (vx > 0 ? L.x0 - 1.6 : L.x1 + 1.6) : L.x0 - 1.6;
      return { L, x, y: L.top - 0.2, z: L.z1 - 0.7, yaw: Math.atan2(-vz, vx), droop: 1, t: Math.random() * 5 };
    });
    this.pole = new THREE.InstancedMesh(poleG, iron, Math.max(1, this.socks.length));
    this.sock = new THREE.InstancedMesh(sockG, sockM, Math.max(1, this.socks.length));
    this.pole.castShadow = true;
    for (const im of [this.pole, this.sock]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(im);
    }

    const postG = T(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 8).translate(0, 0.55, 0));
    const railG = T(new THREE.BoxGeometry(0.12, 0.1, 1));
    const posts = [];
    const rails = [];
    for (const lp of this.lips) {
      const n = Math.max(2, Math.round(lp.len / 1.6) + 1);
      for (let i = 0; i < n; i++) posts.push({ lp, x: lp.x, y: lp.L.top, z: lp.L.z0 + 0.15 + ((lp.len - 0.3) * i) / (n - 1) });
      for (const h of [0.5, 1.02]) rails.push({ lp, x: lp.x, y: lp.L.top + h, z: (lp.L.z0 + lp.L.z1) / 2, len: lp.len - 0.2 });
    }
    this.lipPosts = posts;
    this.lipRails = rails;
    this.post = new THREE.InstancedMesh(postG, ivory, Math.max(1, posts.length));
    const railM = T(new THREE.MeshStandardMaterial({ color: 0x4f72b0, roughness: 0.4, metalness: 0.3 }));
    this.rail = new THREE.InstancedMesh(railG, railM, Math.max(1, rails.length));
    this.post.castShadow = true;
    this.rail.castShadow = true;
    for (const im of [this.post, this.rail]) {
      im.frustumCulled = false;
      im.receiveShadow = true;
      g.add(im);
    }

    this.chevs = this.chevronSpots();
    const chevG = T(this.chevGeo());
    const chevM = T(new THREE.MeshBasicMaterial({ color: glowColor(this.color, 3.4), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    this.chev = new THREE.InstancedMesh(chevG, chevM, Math.max(1, this.chevs.length));
    this.chev.frustumCulled = false;
    this.chev.renderOrder = 2;
    g.add(this.chev);

    this.buildStreaks(g, T);
    this.buildSpecks(g, T);
    this.placeStatic();
  }

  cowlGeo() {
    const ring = new THREE.TorusGeometry(1, 0.16, 10, 32);
    const back = new THREE.CylinderGeometry(1.02, 1.02, 0.35, 32, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.12);
    const hub = new THREE.CylinderGeometry(0.2, 0.26, 0.5, 14).rotateX(Math.PI / 2).translate(0, 0, -0.18);
    const bars = [];
    for (let i = 0; i < 3; i++) bars.push(new THREE.BoxGeometry(0.05, 1, 0.05).translate(0, -0.5, -0.22).rotateZ((i * Math.PI * 2) / 3));
    const bronze = new THREE.Color(0x7a5a34);
    const verdigris = new THREE.Color(0x4fa89c);
    const parts = [ring, back, hub, ...bars].map((p) => {
      const q = p.index ? p.toNonIndexed() : p;
      q.deleteAttribute('uv');
      const c = p === back ? verdigris : bronze;
      const col = new Float32Array(q.attributes.position.count * 3);
      for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
      q.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return q;
    });
    const m = mergeGeometries(parts, false);
    for (const p of [ring, back, hub, ...bars, ...parts]) p.dispose();
    return m;
  }

  rotorGeo() {
    const blades = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Shape();
      s.moveTo(0.14, -0.1);
      s.quadraticCurveTo(0.55, -0.34, 0.86, -0.26);
      s.quadraticCurveTo(0.98, 0.0, 0.84, 0.2);
      s.quadraticCurveTo(0.5, 0.2, 0.14, 0.1);
      const bg = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
      bg.rotateX(0.35);
      bg.rotateZ((i / 5) * Math.PI * 2);
      blades.push(bg.index ? bg.toNonIndexed() : bg.clone());
      bg.dispose();
    }
    const cap = new THREE.SphereGeometry(0.18, 12, 8).toNonIndexed();
    const all = [...blades, cap];
    for (const p of all) p.deleteAttribute('uv');
    const m = mergeGeometries(all, false);
    for (const p of all) p.dispose();
    return m;
  }

  sockGeo() {
    const gm = new THREE.CylinderGeometry(0.07, 0.22, 1.7, 14, 6, true);
    gm.rotateZ(-Math.PI / 2);
    gm.translate(0.85, 0, 0);
    const pos = gm.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = this.color;
    for (let i = 0; i < pos.count; i++) {
      const band = Math.floor((pos.getX(i) / 1.7) * 5 - 0.001);
      const c = band % 2 ? [1, 1, 1] : [a.r, a.g, a.b];
      col.set(c, i * 3);
    }
    gm.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return gm;
  }

  chevGeo() {
    const s = new THREE.Shape();
    s.moveTo(-0.55, -0.7);
    s.lineTo(0.35, 0);
    s.lineTo(-0.55, 0.7);
    s.lineTo(-0.2, 0.7);
    s.lineTo(0.7, 0);
    s.lineTo(-0.2, -0.7);
    s.closePath();
    return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
  }

  chevronSpots() {
    const out = [];
    const cols = this.w.colliders;
    for (const L of this.lanes) {
      if (!L.s.chev) continue;
      const along = L.vx ? [1, 0] : [0, 1];
      const cx = (L.x0 + L.x1) / 2;
      const cz = (L.z0 + L.z1) / 2;
      const len = L.vx ? L.z1 - L.z0 : L.x1 - L.x0;
      const n = Math.max(1, Math.floor(len / 3.2));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const x = L.vx ? cx : cx + t * len;
        const z = L.vx ? cz + t * len : cz;
        let top = -Infinity;
        let conv = false;
        for (const c of cols) {
          if (!c.spec || c.spec.side || !this.w.overlapXZ(c, x, z, 0)) continue;
          const tt = c.y + c.hy;
          if (tt > top && tt <= L.top + 0.05) {
            top = tt;
            conv = !!c.conv || !!c.move;
          }
        }
        if (top < L.top - 0.05 || conv) continue;
        out.push({ L, x, y: top + 0.04, z, yaw: Math.atan2(-(L.vz || 0), L.vx || 0), along });
      }
    }
    return out;
  }

  buildStreaks(g, T) {
    const pos = [];
    const wa = [];
    const wb = [];
    const quad = (a, b, c, d, u0, u1, v, idx, sp, len) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      wa.push(u0, v, idx, sp, u1, v, idx, sp, u1, v, idx, sp, u0, v, idx, sp, u1, v, idx, sp, u0, v, idx, sp);
      for (let i = 0; i < 6; i++) wb.push(len);
    };
    const rnd = (() => {
      let s = 9137;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    })();
    this.lanes.forEach((L, li) => {
      const ax = L.vx ? 0 : 2;
      const sx = L.x1 - L.x0;
      const sz = L.z1 - L.z0;
      const cross = L.vx ? sz : sx;
      const along = L.vx ? sx : sz;
      const n = Math.max(10, Math.min(24, Math.round((cross * along) / 5)));
      const speed = Math.hypot(L.vx, L.vz) * 1.4;
      const sgn = Math.sign(L.vx || L.vz);
      const start = L.vx ? (sgn > 0 ? L.x0 - 1.2 : L.x1 + 1.2) : sgn > 0 ? L.z0 - 1.2 : L.z1 + 1.2;
      const span = along + 1.2;
      for (let i = 0; i < n; i++) {
        const c = (L.vx ? L.z0 : L.x0) + (0.06 + rnd() * 0.88) * cross;
        const y = L.top + 0.3 + rnd() * 2.3;
        const v = rnd();
        const len = span / 2.4;
        const p0 = start;
        const p1 = start + sgn * span;
        const P = (a, h, off) => (ax === 0 ? [a, y + h, c + off] : [c + off, y + h, a]);
        quad(P(p0, -0.035, 0), P(p1, -0.035, 0), P(p1, 0.035, 0), P(p0, 0.035, 0), 0, 1, v, li, speed, len);
        quad(P(p0, 0, -0.06), P(p1, 0, -0.06), P(p1, 0, 0.06), P(p0, 0, 0.06), 0, 1, v, li, speed, len);
      }
    });
    this.drafts.forEach((d, di) => {
      const idx = this.lanes.length + di;
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2;
        const segs = 28;
        const turns = 1.1 + d.rise * 0.06;
        const rr = d.r * 0.82;
        const v = rnd();
        for (let j = 0; j < segs; j++) {
          const u0 = j / segs;
          const u1 = (j + 1) / segs;
          const at = (u) => {
            const a = a0 + u * turns * Math.PI * 2;
            return [d.x + Math.cos(a) * rr, d.y + 0.2 + u * d.rise, d.z + Math.sin(a) * rr];
          };
          const A = at(u0);
          const B = at(u1);
          quad([A[0], A[1] - 0.06, A[2]], [B[0], B[1] - 0.06, B[2]], [B[0], B[1] + 0.06, B[2]], [A[0], A[1] + 0.06, A[2]], u0, u1, v, idx, 1.6, d.rise / 2.6);
        }
      }
    });
    const geo = T(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('wa', new THREE.Float32BufferAttribute(wa, 4));
    geo.setAttribute('wb', new THREE.Float32BufferAttribute(wb, 1));
    this.streakM = T(
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, k: { value: this.k }, color: { value: new THREE.Color(0xffffff).lerp(this.color, 0.35) }, focus: { value: new THREE.Vector3(0, -999, 0) } },
        vertexShader: STREAK_VERT,
        fragmentShader: STREAK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    const mesh = new THREE.Mesh(geo, this.streakM);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    g.add(mesh);
  }

  buildSpecks(g, T) {
    const pos = [];
    const sa = [];
    const sb = [];
    this.drafts.forEach((d, di) => {
      const idx = this.lanes.length + di;
      for (let i = 0; i < 26; i++) {
        pos.push(d.x, d.y, d.z);
        sa.push(d.x, d.r * Math.sqrt(Math.random()), d.y + 0.2, Math.random());
        sb.push(Math.random() * 6.28, d.rise, 2.2 + Math.random() * 1.6, idx);
      }
    });
    if (!pos.length) return;
    const geo = T(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('sa', new THREE.Float32BufferAttribute(sa, 4));
    geo.setAttribute('sb', new THREE.Float32BufferAttribute(sb, 4));
    this.speckM = T(
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, k: { value: this.k }, focus: { value: new THREE.Vector3(0, -999, 0) }, scale: { value: 1080 }, color: { value: new THREE.Color(0xffffff).lerp(this.color, 0.35) } },
        vertexShader: SPECK_VERT,
        fragmentShader: SPECK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const pts = new THREE.Points(geo, this.speckM);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    g.add(pts);
  }

  placeStatic() {
    const on = (v) => this.w.window === null || this.w.inWindow(v);
    this.lipPosts.forEach((p, i) => {
      const k = on(p.lp.L.view) ? 1 : 0;
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(k, k, k));
      this.post.setMatrixAt(i, _m);
    });
    this.lipRails.forEach((r, i) => {
      const k = on(r.lp.L.view) ? 1 : 0;
      _m.compose(_p.set(r.x, r.y, r.z), _q.identity(), _s.set(k, k, r.len * k));
      this.rail.setMatrixAt(i, _m);
    });
    this.chevs.forEach((c, i) => {
      const k = on(c.L.view) ? 1 : 0;
      _e.set(0, c.yaw, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(c.x, c.y, c.z), _q, _s.set(k, k, k));
      this.chev.setMatrixAt(i, _m);
    });
    this.fans.forEach((f, i) => {
      const k = on(f.view) ? 1 : 0;
      const h = f.L ? f.y - f.L.y0 + 2 : f.y - f.R.s.y + 3;
      _m.compose(_p.set(f.x, f.y - f.r - 0.1, f.z), _q.identity(), _s.set(k, h * k, k));
      this.pylon.setMatrixAt(i, _m);
    });
    this.drafts.forEach((d, i) => {
      const k = on(d.view) ? 1 : 0;
      _m.compose(_p.set(d.x, d.y + 0.05, d.z), _q.identity(), _s.set(d.r * k, k, d.r * k));
      this.ring.setMatrixAt(i * 2, _m);
      _m.compose(_p.set(d.x, d.y + 0.05, d.z), _q.identity(), _s.set(d.r * 0.62 * k, k, d.r * 0.62 * k));
      this.ring.setMatrixAt(i * 2 + 1, _m);
    });
    for (const im of [this.post, this.rail, this.chev, this.pylon, this.ring]) im.instanceMatrix.needsUpdate = true;
    this.placed = this.w.window;
  }

  inside(L, p) {
    return p.x > L.x0 && p.x < L.x1 && p.z > L.z0 && p.z < L.z1 && p.y > L.y0 && p.y < L.y1;
  }

  step(dt) {
    const p = this.player;
    for (const L of this.lanes) {
      const pu = L.s.pulse;
      if (!pu) continue;
      const P = pu.on + pu.off;
      const here = p && this.inside(L, p.pos) && L.u >= pu.on;
      if (!(here && L.u + dt >= P - pu.spin)) L.u = (L.u + dt) % P;
      const u = L.u;
      const want = u < pu.on ? 1 : 0;
      L.k += (want - L.k) * (1 - Math.exp(-dt / 0.12));
      L.spin = u < pu.on ? 1 : u >= P - pu.spin ? (u - (P - pu.spin)) / pu.spin : Math.max(0.05, 1 - (u - pu.on) / 0.8);
    }
  }

  strength(L) {
    return L.k * (this.w.assistStage === L.stage ? 0.5 : 1);
  }

  pull(p, v) {
    for (const d of this.drafts) {
      const dx = d.x - p.x;
      const dz = d.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.01 || dist > d.r + PULL || Math.abs(p.y - d.y) > 0.2) continue;
      v.x = (dx / dist) * PULL_V;
      v.z = (dz / dist) * PULL_V;
      return;
    }
  }

  act(player, dt, hasInput, gdt) {
    this.player = player;
    const p = player.pos;
    const v = player.vel;
    if (this.ride && Math.hypot(p.x - this.ride.x, p.z - this.ride.z) > this.ride.r + 2.5) this.ride = null;
    if (!this.ride && !player.padFlight) {
      for (const d of this.drafts) {
        const dx = p.x - d.x;
        const dz = p.z - d.z;
        if (dx * dx + dz * dz < (d.r + FOOT) * (d.r + FOOT) && p.y > d.y - 0.6 && p.y < d.y + d.rise - 0.6) {
          this.ride = d;
          player.push('lift', d);
          break;
        }
      }
      if (!this.ride && player.grounded && !hasInput) this.pull(p, v);
    }
    if (this.ride) {
      const d = this.ride;
      const f = Math.max(0, Math.min(1, (p.y - d.y) / d.rise));
      const e = smooth(0.5, 1, f);
      const ex = d.x + (d.exit.x - d.x) * e;
      const ez = d.z + (d.exit.z - d.z) * e;
      v.y += gdt;
      v.y += (LIFT - v.y) * (1 - Math.exp(-6 * dt));
      const hx = (ex - p.x) * 5;
      const hz = (ez - p.z) * 5;
      const hs = Math.hypot(hx, hz);
      const cap = hs > 4 ? 4 / hs : 1;
      v.x = hx * cap;
      v.z = hz * cap;
      player.launched = true;
      if (p.y >= d.y + d.rise) {
        this.ride = null;
        v.y = RELEASE_VY;
        player.aimAt(d.target);
        player.liftFlight = true;
        player.launched = true;
        player.push('liftOff', d);
      }
      return;
    }
    if (player.padFlight || (player.grounded && !hasInput)) return;
    let wx = 0;
    let wz = 0;
    for (const L of this.lanes) {
      if (L.k < 0.01 || !this.inside(L, p)) continue;
      const k = this.strength(L);
      wx += L.vx * k;
      wz += L.vz * k;
    }
    if (!wx && !wz) return;
    p.x += wx * dt;
    p.z += wz * dt;
    this.pushT -= dt;
    if (!player.grounded && this.pushT <= 0) {
      this.pushT = 0.25;
      player.push('wind', { x: p.x, y: p.y, z: p.z });
    }
  }

  update(t, dt) {
    if (this.placed !== this.w.window) this.placeStatic();
    const on = (v) => this.w.inWindow(v);
    this.lanes.forEach((L, i) => {
      this.k[i] = on(L.view) ? Math.max(0.12, L.k) * (L.k > 0.01 ? 1 : 0.35) : 0;
    });
    this.drafts.forEach((d, i) => {
      this.k[this.lanes.length + i] = on(d.view) ? 1 : 0;
    });
    this.streakM.uniforms.time.value = t;
    if (this.w.focus && this.w.view) this.streakM.uniforms.focus.value.copy(this.w.focus);
    else this.streakM.uniforms.focus.value.set(0, -999, 0);
    if (this.speckM) {
      this.speckM.uniforms.time.value = t;
      this.speckM.uniforms.focus.value.copy(this.streakM.uniforms.focus.value);
    }
    let n = 0;
    for (const f of this.fans) {
      const k = on(f.view) ? 1 : 0;
      const target = f.L ? (f.L.s.pulse ? f.L.spin : 1) : 0.6;
      f.spin += (target - f.spin) * (1 - Math.exp(-4 * dt));
      f.ang += dt * 13 * f.spin;
      _s.set(f.r * k, f.r * k, f.r * k);
      _m.compose(_p.set(f.x, f.y, f.z), f.q, _s);
      this.cowl.setMatrixAt(n, _m);
      _q2.setFromAxisAngle(_z, f.ang);
      _q.copy(f.q).multiply(_q2);
      _m.compose(_p.set(f.x, f.y, f.z), _q, _s);
      this.rotor.setMatrixAt(n, _m);
      n++;
    }
    for (const d of this.drafts) {
      const k = on(d.view) ? 1 : 0;
      d.ang += dt * 9;
      _s.set(d.r * 0.92 * k, d.r * 0.92 * k, 0.6 * k);
      _m.compose(_p.set(d.x, d.y - 0.1, d.z), d.q, _s);
      this.cowl.setMatrixAt(n, _m);
      _q2.setFromAxisAngle(_z, d.ang);
      _q.copy(d.q).multiply(_q2);
      _m.compose(_p.set(d.x, d.y - 0.02, d.z), _q, _s.set(d.r * 0.85 * k, d.r * 0.85 * k, 0.4 * k));
      this.rotor.setMatrixAt(n, _m);
      n++;
    }
    this.cowl.instanceMatrix.needsUpdate = true;
    this.rotor.instanceMatrix.needsUpdate = true;
    this.socks.forEach((s, i) => {
      const k = on(s.L.view) ? 1 : 0;
      const str = s.L.k;
      s.droop += (1 - str - s.droop) * (1 - Math.exp(-3 * dt));
      _m.compose(_p.set(s.x, s.y, s.z), _q.identity(), _s.set(k, k, k));
      this.pole.setMatrixAt(i, _m);
      const fl = Math.sin(t * 9 + s.t) * 0.06 * str;
      _e.set(fl, s.yaw + Math.sin(t * 5.3 + s.t) * 0.08 * str, -0.12 - s.droop * 1.15 + fl, 'YZX');
      _q.setFromEuler(_e);
      _m.compose(_p.set(s.x, s.y + 3.05, s.z), _q, _s.set(k, k, k));
      this.sock.setMatrixAt(i, _m);
    });
    this.pole.instanceMatrix.needsUpdate = true;
    this.sock.instanceMatrix.needsUpdate = true;
    this.chev.material.opacity = 0.45 + 0.25 * (0.5 + 0.5 * Math.sin(t * 4));
  }
}
