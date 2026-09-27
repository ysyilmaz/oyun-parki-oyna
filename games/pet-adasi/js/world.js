import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ZONES, ZONE_W, Z_MIN, Z_MAX, EGGS, GOLD_EGG, fmt } from './data.js';
import { fbm, noise2, smoothstep, lerp, clamp, rng } from './util.js';
import { M, part, merge, displace, gradientY, windMaterial, windUniform } from './geo.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawCoin, drawGem, drawLock, outlinedText, roundRect, FONT } from './canvas.js';
import { getEggGeometry, makeEggMaterial } from './eggs.js';

export const X_MIN = -ZONE_W / 2 - 34;
export const X_MAX = 5 * ZONE_W + ZONE_W / 2 + 34;
export const PLAZA = { x: -10, z: 2, r: 11 };
const PLAZA_Y = 0.9;
const HILL = [5, 8, 7, 18, 7, 13];
export const LIGHT_K = 0.5;

const SKY = [
  { top: 0x2f7fff, hor: 0xc4ecff, sun: 0xfff1d6, sunI: 3.2, hemiS: 0xcfe9ff, hemiG: 0x6b8a4a, hemiI: 1.1, exp: 1.0 },
  { top: 0x2c78e6, hor: 0xc2ecd8, sun: 0xfff0d0, sunI: 3.0, hemiS: 0xc9ecdf, hemiG: 0x3f6a3a, hemiI: 1.05, exp: 1.0 },
  { top: 0x2d8cff, hor: 0xffe2b0, sun: 0xffe2b0, sunI: 3.4, hemiS: 0xffe9c9, hemiG: 0xb08a50, hemiI: 1.1, exp: 1.0 },
  { top: 0x4c8fe6, hor: 0xe9f3ff, sun: 0xf4f8ff, sunI: 2.6, hemiS: 0xe6f1ff, hemiG: 0x9fb2cc, hemiI: 1.2, exp: 0.95 },
  { top: 0x9a7bff, hor: 0xffd3ee, sun: 0xffe6f3, sunI: 3.0, hemiS: 0xffe0f2, hemiG: 0xa0e8d0, hemiI: 1.2, exp: 1.0 },
  { top: 0x1b1450, hor: 0x9384e0, sun: 0xd9c9ff, sunI: 1.9, hemiS: 0xa89cff, hemiG: 0x3a2a70, hemiI: 1.0, exp: 1.05 },
];

export function gateX(i) {
  return i * ZONE_W - ZONE_W / 2;
}

export function zoneAt(x) {
  return clamp(Math.floor((x + ZONE_W / 2) / ZONE_W), 0, 5);
}

export function zoneMix(x) {
  const f = x / ZONE_W;
  let i = Math.floor(f);
  const t = smoothstep(0.42, 0.58, f - i);
  const a = clamp(i, 0, 5);
  const b = clamp(i + 1, 0, 5);
  return { a, b, t };
}

export function pathZ(x) {
  return 4.5 * Math.sin(((x - 35) / ZONE_W) * Math.PI * 2) + 1.2 * Math.sin(x * 0.19);
}

function coastNear(x) {
  return 42 + 4 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.11 + 2);
}

function coastFar(x) {
  return 64 + 5 * Math.sin(x * 0.037 + 1);
}

function landMask(x, z) {
  let m = z >= 0 ? 1 - smoothstep(coastNear(x) - 12, coastNear(x), z) : 1 - smoothstep(coastFar(x) - 14, coastFar(x), -z);
  m *= smoothstep(X_MIN, X_MIN + 26, x) * (1 - smoothstep(X_MAX - 26, X_MAX, x));
  return m;
}

export function heightAt(x, z) {
  const zm = zoneMix(x);
  let h = 0.9 + (fbm(x * 0.05 + 3, z * 0.05 - 7, 3) - 0.5) * 1.0;
  const dp = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  h = lerp(PLAZA_Y, h, smoothstep(PLAZA.r - 1, PLAZA.r + 5, dp));
  const amp = lerp(HILL[zm.a], HILL[zm.b], zm.t);
  const snow = lerp(zm.a === 3 ? 1 : 0, zm.b === 3 ? 1 : 0, zm.t);
  const ridged = 1 - Math.abs(fbm(x * 0.03, z * 0.035 + 5, 4) * 2 - 1);
  const hn = 0.35 + 0.95 * fbm(x * 0.03 + 11, z * 0.03, 4);
  const back = smoothstep(Z_MIN - 1, Z_MIN - 18, z);
  h += back * amp * lerp(hn, ridged * ridged * 1.6, snow);
  const front = smoothstep(Z_MAX + 1, Z_MAX + 5, z) * (1 - smoothstep(Z_MAX + 6, Z_MAX + 12, z));
  h += front * 0.7;
  const m = landMask(x, z);
  return lerp(-4.2, h, m);
}

const _ca = new THREE.Color();
const _cb = new THREE.Color();
const _cc = new THREE.Color();
const SAND = new THREE.Color('#f2dca2');
const WET = new THREE.Color('#c7ae76');
const ROCK = ['#8a8f7a', '#6d6a5e', '#c79a5e', '#8e9db3', '#b58ad6', '#2a2045'].map((c) => new THREE.Color(c));

function zoneColor(out, zi, x, z, h, slope, pathW) {
  const Z = ZONES[zi];
  const n = fbm(x * 0.12, z * 0.12, 3);
  out.set(Z.ground[0]).lerp(_cc.set(Z.ground[1]), smoothstep(0.35, 0.7, n));
  const n2 = noise2(x * 0.5, z * 0.5);
  out.multiplyScalar(0.94 + n2 * 0.1);
  const back = smoothstep(Z_MIN - 1, Z_MIN - 12, z);
  out.lerp(_cc.set(Z.hill), back * 0.8);
  if (zi === 3 && h > 3) out.lerp(_cc.set('#ffffff'), smoothstep(3, 8, h));
  out.lerp(ROCK[zi], smoothstep(0.55, 0.95, slope) * 0.85);
  out.lerp(_cc.set(Z.path), pathW);
  return out;
}

function terrainColor(out, x, z, h, slope) {
  const zm = zoneMix(x);
  const pd = Math.abs(z - pathZ(x));
  const inPlay = x > -ZONE_W / 2 - 4 ? 1 : 0;
  const pathW = (1 - smoothstep(1.3, 2.3, pd)) * inPlay * (1 - smoothstep(PLAZA.r - 3, PLAZA.r, Math.hypot(x - PLAZA.x, z - PLAZA.z)) * 0) ;
  zoneColor(_ca, zm.a, x, z, h, slope, pathW);
  if (zm.t > 0) {
    zoneColor(_cb, zm.b, x, z, h, slope, pathW);
    _ca.lerp(_cb, zm.t);
  }
  const m = landMask(x, z);
  const beach = 1 - smoothstep(0.55, 1.1, h);
  const nearCoast = smoothstep(0.985, 0.8, m);
  const sandT = Math.max(beach * smoothstep(Z_MAX + 3, Z_MAX + 9, z), nearCoast);
  const sand = zm.a === 3 || zm.a === 5 ? _cc.set(zm.a === 3 ? '#e4eef8' : '#6d5fa8') : SAND;
  _ca.lerp(sand, clamp(sandT, 0, 1));
  if (h < 0.05) _ca.lerp(WET, smoothstep(0.05, -1.5, h));
  const ao = 1 - smoothstep(Z_MIN, Z_MIN - 6, z) * (1 - smoothstep(Z_MIN - 6, Z_MIN - 14, z)) * 0.18;
  out.copy(_ca).multiplyScalar(ao);
  return out;
}

async function makeTerrain(step) {
  const x0 = X_MIN - 30;
  const x1 = X_MAX + 30;
  const z0 = -84;
  const z1 = 64;
  const cell = 1.5;
  const nx = Math.round((x1 - x0) / cell);
  const nz = Math.round((z1 - z0) / cell);
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const W = nx + 1;
  const D = nz + 1;
  const depth = new Uint8Array(W * D);
  const chunk = W * 30;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const ix = Math.round((x - x0) / cell);
    const iz = Math.round((z - z0) / cell);
    depth[iz * W + ix] = Math.round(clamp(-h / 4, 0, 1) * 255);
    if (i % chunk === chunk - 1) await step();
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nor.getY(i);
    terrainColor(c, pos.getX(i), pos.getZ(i), pos.getY(i), slope * 3.2);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    if (i % chunk === chunk - 1) await step();
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  const tex = new THREE.DataTexture(depth, W, D, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { mesh, depthTex: tex, bounds: [x0 - cell / 2, z0 - cell / 2, W * cell, D * cell] };
}

function makeWater(bounds, sunDir, depthTex) {
  const geo = new THREE.PlaneGeometry(1400, 1000, 160, 110);
  geo.rotateX(-Math.PI / 2);
  geo.translate((X_MIN + X_MAX) / 2, 0, 0);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uDepth: { value: null },
      uBounds: { value: new THREE.Vector4(...bounds) },
      uSun: { value: sunDir.clone() },
      uDeep: { value: new THREE.Color('#1f86c9') },
      uShallow: { value: new THREE.Color('#4fe3e0') },
      uSky: { value: new THREE.Color('#bfe8ff') },
      uSunCol: { value: new THREE.Color('#fff4d8') },
    },
  ]);
  uniforms.uDepth.value = depthTex;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      uniform float uTime;
      uniform sampler2D uDepth;
      uniform vec4 uBounds;
      varying vec3 vWorld;
      varying float vDepth;
      #include <fog_pars_vertex>
      float depthAt(vec2 p) {
        vec2 uv = (p - uBounds.xy) / uBounds.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
        return texture2D(uDepth, uv).r;
      }
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float d = depthAt(wp.xz);
        float amp = 0.05 + 0.18 * smoothstep(0.0, 0.6, d);
        wp.y += (sin(wp.x * 0.35 + uTime * 1.2) * 0.5 + sin(wp.z * 0.28 - uTime * 0.9) * 0.5 + sin((wp.x + wp.z) * 0.6 + uTime * 1.9) * 0.25) * amp;
        vWorld = wp.xyz;
        vDepth = d;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunCol;
      uniform sampler2D uDepth;
      uniform vec4 uBounds;
      varying vec3 vWorld;
      varying float vDepth;
      #include <fog_pars_fragment>
      float depthAtF(vec2 p) {
        vec2 uv = (p - uBounds.xy) / uBounds.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
        return texture2D(uDepth, uv).r;
      }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        float rd = depthAtF(p);
        if (rd <= 0.0) discard;
        float d = rd * 4.0;
        vec3 n = normalize(vec3(
          cos(p.x * 0.35 + t * 1.2) * 0.06 + (vnoise(p * 0.9 + t * 0.4) - 0.5) * 0.25,
          1.0,
          cos(p.y * 0.28 - t * 0.9) * 0.05 + (vnoise(p * 0.8 - t * 0.35 + 7.0) - 0.5) * 0.25));
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 2.6, d));
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(base, uSky, fres * 0.55);
        vec3 h = normalize(uSun + v);
        float spec = pow(max(dot(n, h), 0.0), 220.0) * 7.0;
        col += uSunCol * spec;
        float sparkle = step(0.985, vnoise(p * 3.0 + t * 0.8)) * step(0.5, d) * 1.4;
        col += sparkle;
        float wave = sin(d * 7.0 - t * 2.2 + vnoise(p * 0.5) * 4.0);
        float foamBand = 1.0 - smoothstep(0.05, 0.45 + 0.15 * sin(t * 1.3 + p.x * 0.2), d);
        float foamLine = smoothstep(0.75, 0.95, wave) * (1.0 - smoothstep(0.3, 1.2, d));
        float foamN = vnoise(p * 2.5 + vec2(t * 0.3, 0.0));
        float foam = clamp(foamBand * (0.6 + foamN * 0.6) + foamLine * 0.8, 0.0, 1.0);
        col = mix(col, vec3(1.0), foam * 0.92);
        float alpha = mix(0.55, 0.93, smoothstep(0.0, 1.6, d));
        alpha = max(alpha, foam);
        gl_FragColor = vec4(col * 0.5, alpha);
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

function makeSky() {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(SKY[0].top) },
      uHor: { value: new THREE.Color(SKY[0].hor) },
      uSun: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
      uSunCol: { value: new THREE.Color('#fff2cc') },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHor;
      uniform vec3 uSun;
      uniform vec3 uSunCol;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.6, h), 0.7));
        col = mix(col, uHor * 0.92, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, uSun), 0.0);
        col += uSunCol * (pow(s, 8.0) * 0.25 + pow(s, 64.0) * 0.6);
        col += uSunCol * smoothstep(0.9975, 0.999, s) * 6.0;
        gl_FragColor = vec4(col * 0.5, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

function cloudGeometry() {
  const parts = [];
  const r = rng(77);
  const blobs = [[0, 0, 0, 3.2], [2.8, -0.3, 0.4, 2.4], [-2.8, -0.4, -0.2, 2.5], [1.2, 1.4, -0.3, 2.3], [-1.3, 1.1, 0.5, 2.1], [4.6, -0.8, 0, 1.6], [-4.5, -0.9, 0.2, 1.5]];
  const sph = new THREE.SphereGeometry(1, 14, 10);
  for (const b of blobs) {
    parts.push(part(sph, null, M(b[0], b[1], b[2], 0, 0, 0, b[3], b[3] * 0.85, b[3]), (c, x, y) => {
      c.set('#ffffff').lerp(_cc.set('#c9d9ff'), smoothstep(1.2, -1.8, y));
    }));
  }
  const g = merge(parts);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -1.3) pos.setY(i, -1.3 + (pos.getY(i) + 1.3) * 0.2);
  g.computeVertexNormals();
  sph.dispose();
  void r;
  return g;
}

function roundTreeGeo(dark) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 8, 3);
  const parts = [part(trunk, null, M(0, 1.3, 0), gradientY(0, 2.6, '#6b4128', '#9a6a42'))];
  const s = new THREE.SphereGeometry(1, 12, 9);
  const blobs = [[0, 3.1, 0, 1.55], [0.95, 2.6, 0.3, 1.1], [-0.9, 2.7, -0.25, 1.15], [0.1, 2.5, -0.95, 1.05], [0.15, 4.05, 0.1, 1.05], [-0.2, 2.6, 0.95, 1.0]];
  const c0 = dark ? '#1f6a2e' : '#3f9b2f';
  const c1 = dark ? '#5fb04a' : '#b8e65a';
  blobs.forEach((b, i) => {
    const g = displace(s.clone(), 0.12, 3.1, i * 1.7);
    parts.push(part(g, null, M(b[0], b[1], b[2], 0, i, 0, b[3]), gradientY(1.8, 5, c0, c1)));
    g.dispose();
  });
  trunk.dispose();
  s.dispose();
  return merge(parts);
}

function pineGeo(snowy) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 1.6, 7);
  const parts = [part(trunk, null, M(0, 0.8, 0), gradientY(0, 1.6, '#5a3620', '#7a4d2e'))];
  const layers = [[1.9, 2.0, 1.2], [1.5, 1.8, 2.3], [1.1, 1.6, 3.3], [0.7, 1.3, 4.2]];
  const cone = new THREE.ConeGeometry(1, 1, 10, 3);
  const cA = new THREE.Color(snowy ? '#2c6a52' : '#1d5a36');
  const cB = new THREE.Color(snowy ? '#4f9a78' : '#3f9a4d');
  const white = new THREE.Color('#f6fbff');
  layers.forEach((l, i) => {
    const g = cone.clone();
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k);
      if (y < -0.45) pos.setY(k, y - 0.12 * Math.sin(Math.atan2(pos.getZ(k), pos.getX(k)) * 5 + i) - 0.05);
    }
    g.computeVertexNormals();
    parts.push(part(g, null, M(0, l[2] + l[1] / 2, 0, 0, i * 0.7, 0, l[0], l[1], l[0]), (c, x, y, z, nx, ny) => {
      const t = clamp((y - l[2]) / l[1], 0, 1);
      c.copy(cA).lerp(cB, t);
      if (snowy && ny > 0.35 && t > 0.15) c.lerp(white, 0.85);
    }));
    g.dispose();
  });
  cone.dispose();
  trunk.dispose();
  return merge(parts);
}

function palmGeo() {
  const parts = [];
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 1.8, 0), new THREE.Vector3(0.9, 3.4, 0), new THREE.Vector3(1.7, 4.8, 0)]);
  const tube = new THREE.TubeGeometry(curve, 10, 0.26, 8, false);
  parts.push(part(tube, null, null, (c, x, y) => {
    c.set(Math.floor(y * 2.4) % 2 ? '#a8753e' : '#8a5a2b');
  }));
  const leaf = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const g = leaf.clone();
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      pos.setY(k, pos.getY(k) - x * x * 0.35);
    }
    g.computeVertexNormals();
    parts.push(part(g, null, M(1.7 + Math.cos(a) * 1.3, 4.7, Math.sin(a) * 1.3, 0, -a, -0.35, 1.5, 0.12, 0.42), gradientY(3.6, 5.0, '#2f8f3a', '#8fd65a')));
    g.dispose();
  }
  const nut = new THREE.SphereGeometry(0.22, 8, 6);
  [[1.55, 4.5, 0.2], [1.8, 4.45, -0.2], [1.6, 4.4, -0.05]].forEach((p) => parts.push(part(nut, '#6b4020', M(...p))));
  tube.dispose();
  leaf.dispose();
  nut.dispose();
  return merge(parts);
}

function cactusGeo() {
  const parts = [];
  const cap = new THREE.CapsuleGeometry(0.5, 2.6, 6, 12);
  const stripes = (c, x, y, z) => {
    const a = Math.atan2(z, x);
    c.set(Math.cos(a * 8) > 0.2 ? '#3fae4a' : '#2d8a3a');
    c.multiplyScalar(0.85 + clamp(y / 4, 0, 1) * 0.3);
  };
  parts.push(part(cap, null, M(0, 1.8, 0), stripes));
  const arm = new THREE.CapsuleGeometry(0.3, 1.0, 5, 10);
  parts.push(part(arm, null, M(0.75, 2.2, 0, 0, 0, 0), stripes));
  parts.push(part(arm, null, M(0.5, 1.6, 0, 0, 0, Math.PI / 2, 0.9), stripes));
  parts.push(part(arm, null, M(-0.72, 2.8, 0, 0, 0, 0, 0.9), stripes));
  parts.push(part(arm, null, M(-0.45, 2.35, 0, 0, 0, Math.PI / 2, 0.8), stripes));
  const fl = new THREE.SphereGeometry(0.2, 8, 6);
  parts.push(part(fl, '#ff5fa0', M(0, 3.62, 0, 0, 0, 0, 1, 0.6, 1)));
  parts.push(part(fl, '#ffd84a', M(0, 3.72, 0, 0, 0, 0, 0.4)));
  cap.dispose();
  arm.dispose();
  fl.dispose();
  return merge(parts);
}

function snowmanGeo() {
  const parts = [];
  const s = new THREE.SphereGeometry(1, 16, 12);
  const snow = gradientY(0, 3.5, '#d9e6f5', '#ffffff');
  parts.push(part(s, null, M(0, 0.9, 0, 0, 0, 0, 1.05), snow));
  parts.push(part(s, null, M(0, 2.2, 0, 0, 0, 0, 0.75), snow));
  parts.push(part(s, null, M(0, 3.25, 0, 0, 0, 0, 0.55), snow));
  const eye = new THREE.SphereGeometry(0.08, 8, 6);
  parts.push(part(eye, '#1a1a22', M(0.2, 3.38, 0.48)));
  parts.push(part(eye, '#1a1a22', M(-0.2, 3.38, 0.48)));
  [2.45, 2.2, 1.95].forEach((y) => parts.push(part(eye, '#1a1a22', M(0, y, 0.74))));
  const nose = new THREE.ConeGeometry(0.09, 0.5, 8);
  parts.push(part(nose, '#ff7a1a', M(0, 3.25, 0.72, Math.PI / 2, 0, 0)));
  const scarf = new THREE.TorusGeometry(0.52, 0.14, 8, 18);
  parts.push(part(scarf, '#e8443a', M(0, 2.82, 0, Math.PI / 2, 0, 0)));
  const hat = new THREE.CylinderGeometry(0.34, 0.36, 0.55, 14);
  parts.push(part(hat, '#2b2b3a', M(0, 3.85, 0)));
  const brim = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16);
  parts.push(part(brim, '#2b2b3a', M(0, 3.6, 0)));
  [s, eye, nose, scarf, hat, brim].forEach((g) => g.dispose());
  return merge(parts);
}

function lollipopGeo() {
  const parts = [];
  const stick = new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8);
  parts.push(part(stick, '#fffaf2', M(0, 1.8, 0)));
  const disc = new THREE.SphereGeometry(1, 36, 18);
  const cols = [new THREE.Color('#ff4f8b'), new THREE.Color('#ffffff'), new THREE.Color('#7ee6ff'), new THREE.Color('#ffffff')];
  parts.push(part(disc, null, M(0, 4.3, 0, 0, 0, 0, 1.45, 1.45, 0.42), (c, x, y) => {
    const dy = y - 4.3;
    const r = Math.hypot(x, dy);
    const a = Math.atan2(dy, x);
    const k = Math.floor(((a / (Math.PI * 2)) * 4 + r * 1.6 + 8) % 4);
    c.copy(cols[k]);
  }));
  stick.dispose();
  disc.dispose();
  return merge(parts);
}

function iceCreamGeo() {
  const parts = [];
  const cone = new THREE.ConeGeometry(0.75, 2.4, 14, 4);
  parts.push(part(cone, null, M(0, 1.2, 0, Math.PI, 0, 0), (c, x, y, z) => {
    const a = Math.atan2(z, x);
    c.set(Math.sin(a * 6 + y * 5) * Math.sin(a * 6 - y * 5) > 0 ? '#e0a45c' : '#c98a42');
  }));
  const s = new THREE.SphereGeometry(1, 16, 12);
  parts.push(part(displace(s.clone(), 0.05, 5, 1), '#ff9fcf', M(0, 2.7, 0, 0, 0, 0, 0.9)));
  parts.push(part(displace(s.clone(), 0.05, 5, 2), '#9ff0d0', M(0.05, 3.55, 0, 0, 0, 0, 0.72)));
  parts.push(part(s, '#ff3d5a', M(0.1, 4.3, 0, 0, 0, 0, 0.24)));
  cone.dispose();
  s.dispose();
  return merge(parts);
}

function candyCaneGeo() {
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(0, i * 0.45, 0));
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new THREE.Vector3(0.6 - Math.cos(a) * 0.6, 3.6 + Math.sin(a) * 0.6, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 48, 0.2, 10, false);
  const uv = tube.attributes.uv;
  const cols = new Float32Array(uv.count * 3);
  const red = new THREE.Color('#ff2d4a');
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i < uv.count; i++) {
    const t = uv.getX(i) * 14 + uv.getY(i) * 1;
    const c = Math.floor(t * 2) % 2 ? red : white;
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  tube.deleteAttribute('uv');
  tube.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return tube;
}

function mushroomGeo(glow) {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.25, 0.35, 1.1, 10);
  parts.push(part(stem, glow ? '#e8dcff' : '#fff4e0', M(0, 0.55, 0)));
  const cap = new THREE.SphereGeometry(0.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  parts.push(part(cap, null, M(0, 1.0, 0, 0, 0, 0, 1, 0.75, 1), (c, x, y) => {
    c.set(glow ? '#7a5cff' : '#ff3b3b').lerp(_cc.set(glow ? '#c9b8ff' : '#ff8a6b'), smoothstep(1.0, 1.7, y));
  }));
  const dot = new THREE.SphereGeometry(0.13, 8, 6);
  const r = rng(glow ? 5 : 9);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const el = 0.25 + r() * 0.9;
    const x = Math.cos(a) * Math.sin(el) * 0.9;
    const z = Math.sin(a) * Math.sin(el) * 0.9;
    const y = 1.0 + Math.cos(el) * 0.9 * 0.75;
    parts.push(part(dot, glow ? '#9ff6ff' : '#ffffff', M(x, y, z, 0, 0, 0, 1, 0.5, 1)));
  }
  stem.dispose();
  cap.dispose();
  dot.dispose();
  return merge(parts);
}

function flowerGeo(petal) {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5);
  parts.push(part(stem, '#3f8f2f', M(0, 0.3, 0)));
  const leaf = new THREE.SphereGeometry(0.12, 6, 4);
  parts.push(part(leaf, '#4fae3a', M(0.1, 0.18, 0, 0, 0, 0.6, 1, 0.3, 0.6)));
  const p = new THREE.SphereGeometry(0.11, 6, 4);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(part(p, petal, M(Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12, 0, -a, 0, 1.1, 0.45, 0.8)));
  }
  parts.push(part(p, '#ffd23a', M(0, 0.65, 0, 0, 0, 0, 0.7, 0.5, 0.7)));
  stem.dispose();
  leaf.dispose();
  p.dispose();
  return merge(parts);
}

function grassGeo() {
  const parts = [];
  const blade = new THREE.ConeGeometry(0.07, 0.7, 3, 1);
  const r = rng(3);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.25;
    parts.push(part(blade, null, M(Math.cos(a) * d, 0.3, Math.sin(a) * d, (r() - 0.5) * 0.5, a, (r() - 0.5) * 0.6, 1, 0.7 + r() * 0.6, 1), gradientY(0, 0.8, '#5b9a3a', '#c9f07a')));
  }
  blade.dispose();
  return merge(parts);
}

function bushGeo() {
  const parts = [];
  const s = new THREE.SphereGeometry(1, 12, 9);
  [[0, 0.55, 0, 0.8], [0.6, 0.45, 0.2, 0.6], [-0.55, 0.45, -0.1, 0.62], [0.1, 0.9, -0.2, 0.55]].forEach((b, i) => {
    const g = displace(s.clone(), 0.08, 4, i);
    parts.push(part(g, null, M(b[0], b[1], b[2], 0, 0, 0, b[3]), gradientY(0, 1.4, '#2f7d2a', '#8fd65a')));
    g.dispose();
  });
  s.dispose();
  return merge(parts);
}

function rockGeo(seed) {
  let g = new THREE.DodecahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise2(v.x * 1.5 + seed, v.z * 1.5 + v.y * 1.2) * 0.3 + noise2(v.x * 4 + seed, v.y * 4) * 0.06;
    v.multiplyScalar(0.86 + n);
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const lo = new THREE.Color('#8d8a86');
  const hi = new THREE.Color('#ffffff');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) + 0.6) / 1.2));
    c.copy(lo).lerp(hi, t * t * (3 - 2 * t));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function crystalGeo() {
  const parts = [];
  const c = new THREE.CylinderGeometry(0, 0.5, 1, 6, 1);
  const b = new THREE.CylinderGeometry(0.5, 0.42, 3, 6, 1);
  const r = rng(11);
  const shards = [[0, 0, 0, 1, 0, 0], [0.7, 0, 0.2, 0.6, 0.35, 0.4], [-0.6, 0, 0.3, 0.7, -0.4, -0.3], [0.2, 0, -0.6, 0.5, 0.3, -0.45]];
  for (const s of shards) {
    const m = M(s[0], 0, s[2], s[4], r() * 3, s[5], s[3]);
    const mb = new THREE.Matrix4().multiplyMatrices(m, M(0, 1.5, 0));
    const mt = new THREE.Matrix4().multiplyMatrices(m, M(0, 3.5, 0));
    parts.push(part(b, null, mb, gradientY(0, 3, '#ffffff', '#ffffff')));
    parts.push(part(c, '#ffffff', mt));
  }
  c.dispose();
  b.dispose();
  const g = merge(parts).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function fenceGeo() {
  const parts = [];
  const post = new RoundedBoxGeometry(0.28, 1.4, 0.28, 2, 0.06);
  const rail = new RoundedBoxGeometry(2.2, 0.2, 0.12, 2, 0.05);
  parts.push(part(post, null, M(0, 0.7, 0), gradientY(0, 1.4, '#9a6a3c', '#d6a56a')));
  parts.push(part(rail, '#c38f55', M(1.1, 1.05, 0)));
  parts.push(part(rail, '#b5824a', M(1.1, 0.55, 0)));
  post.dispose();
  rail.dispose();
  return merge(parts);
}

class ColliderGrid {
  constructor() {
    this.cells = new Map();
    this.size = 8;
  }
  key(cx, cz) {
    return cx * 10007 + cz;
  }
  add(c) {
    const cx = Math.floor(c.x / this.size);
    const cz = Math.floor(c.z / this.size);
    const k = this.key(cx, cz);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(c);
    c.k = k;
    return c;
  }
  remove(c) {
    const arr = this.cells.get(c.k);
    if (!arr) return;
    const i = arr.indexOf(c);
    if (i >= 0) arr.splice(i, 1);
  }
  query(x, z, r, out) {
    out.length = 0;
    const s = this.size;
    const x0 = Math.floor((x - r - 3) / s);
    const x1 = Math.floor((x + r + 3) / s);
    const z0 = Math.floor((z - r - 3) / s);
    const z1 = Math.floor((z + r + 3) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = this.cells.get(this.key(cx, cz));
        if (arr) for (const c of arr) out.push(c);
      }
    }
    return out;
  }
}

function makeSign(lines, w = 512, h = 200) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.52, 0.52, 0.52), transparent: true, depthWrite: false, fog: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.canvas = cv;
  sp.userData.draw = (fn) => {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    fn(ctx, w, h);
    tex.needsUpdate = true;
  };
  if (lines) sp.userData.draw(lines);
  return sp;
}

function signPanel(ctx, w, h, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, 10, 16, w - 20, h - 22, 34);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e4ecff');
  ctx.fillStyle = g;
  roundRect(ctx, 10, 8, w - 20, h - 24, 32);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = accent;
  ctx.stroke();
}

function makeBarrierMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uFade: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uDissolve; uniform float uFade; uniform vec3 uColor; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
      void main(){
        vec2 p = vUv * vec2(7.0, 6.0);
        vec2 hx = vec2(p.x + mod(floor(p.y), 2.0) * 0.5, p.y);
        vec2 f = fract(hx) - 0.5;
        float cell = smoothstep(0.38, 0.47, max(abs(f.x), abs(f.y)));
        float scan = smoothstep(0.9, 1.0, sin(vUv.y * 12.0 - uTime * 3.0));
        float edge = smoothstep(0.35, 0.5, abs(vUv.x - 0.5)) + smoothstep(0.4, 0.5, abs(vUv.y - 0.5));
        float n = vn(vUv * vec2(9.0, 8.0) + 3.0);
        if (n < uDissolve) discard;
        float burn = smoothstep(uDissolve + 0.08, uDissolve, n) * step(0.001, uDissolve);
        float a = 0.18 + cell * 0.45 + scan * 0.3 + edge * 0.4 + burn;
        vec3 col = uColor * (1.2 + cell * 1.4 + scan) + vec3(1.0, 0.9, 0.6) * burn * 4.0;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * (1.0 - uDissolve * 0.3) * uFade);
      }
    `,
  });
}

function makePlazaTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#cdbfa8';
  ctx.fillRect(0, 0, 1024, 1024);
  const cx = 512;
  const r = rng(21);
  for (let ring = 0; ring < 11; ring++) {
    const r0 = 40 + ring * 44;
    const r1 = r0 + 42;
    const n = Math.max(6, Math.round((Math.PI * 2 * r0) / 70));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + ring * 0.3;
      const a1 = ((i + 1) / n) * Math.PI * 2 + ring * 0.3;
      const l = 78 + r() * 12;
      const tint = ring === 5 || ring === 9 ? `hsl(12, 45%, ${l - 18}%)` : `hsl(38, ${18 + r() * 10}%, ${l}%)`;
      ctx.beginPath();
      ctx.arc(cx, cx, r1 - 3, a0 + 0.012, a1 - 0.012);
      ctx.arc(cx, cx, r0 + 3, a1 - 0.012, a0 + 0.012, true);
      ctx.closePath();
      ctx.fillStyle = tint;
      ctx.fill();
    }
  }
  ctx.fillStyle = '#e8a33d';
  ctx.beginPath();
  ctx.arc(cx, cx, 40, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class World {
  constructor(scene, sunDir) {
    this.ready = false;
    this.zoneMeshes = [];
    this.focusZone = -1;
    this.scene = scene;
    this.sunDir = sunDir;
    this.grid = new ColliderGrid();
    this.gates = [];
    this.stands = [];
    this.animated = [];
    this.skyState = { top: new THREE.Color(), hor: new THREE.Color() };
  }

  async buildAsync(step) {
    const scene = this.scene;
    const t = await makeTerrain(() => step(0.05));
    scene.add(t.mesh);
    this.terrain = t.mesh;
    await step(0.12);
    this.water = makeWater(t.bounds, this.sunDir, t.depthTex);
    scene.add(this.water);
    this.sky = makeSky();
    this.sky.material.uniforms.uSun.value.copy(this.sunDir);
    scene.add(this.sky);
    this.buildClouds();
    await step(0.2);
    this.buildPlaza();
    this.buildGates();
    this.buildStands();
    await step(0.28);
    const zones = this.decorZones();
    for (let i = 0; i < zones.length; i++) {
      zones[i]();
      await step(0.28 + ((i + 1) / zones.length) * 0.3);
    }
  }

  addCollider(x, z, r, data) {
    return this.grid.add({ x, z, r, data });
  }

  buildClouds() {
    const g = cloudGeometry();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.15, fog: false });
    const count = 26;
    const mesh = new THREE.InstancedMesh(g, mat, count);
    const r = rng(8);
    this.clouds = [];
    for (let i = 0; i < count; i++) {
      const c = {
        x: X_MIN - 60 + r() * (X_MAX - X_MIN + 120),
        y: 42 + r() * 30,
        z: -150 + r() * 120 - (r() < 0.3 ? -150 : 0),
        s: 1.8 + r() * 2.2,
        sp: 0.6 + r() * 0.8,
      };
      this.clouds.push(c);
    }
    mesh.frustumCulled = false;
    this.cloudMesh = mesh;
    this.scene.add(mesh);
    this.updateClouds(0);
  }

  updateClouds(dt) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += c.sp * dt;
      if (c.x > X_MAX + 80) c.x = X_MIN - 80;
      m.copy(M(c.x, c.y, c.z, 0, 0, 0, c.s, c.s * 0.8, c.s));
      this.cloudMesh.setMatrixAt(i, m);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  buildPlaza() {
    const P = PLAZA;
    const floorMat = new THREE.MeshStandardMaterial({ map: makePlazaTexture(), roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r + 0.4, 0.6, 64), [
      new THREE.MeshStandardMaterial({ color: '#b3a38a', roughness: 0.9 }),
      floorMat,
      floorMat,
    ]);
    floor.position.set(P.x, PLAZA_Y - 0.18, P.z);
    floor.receiveShadow = true;
    this.scene.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(P.r + 0.15, 0.32, 8, 72), new THREE.MeshStandardMaterial({ color: '#efe4cf', roughness: 0.7 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(P.x, PLAZA_Y + 0.15, P.z);
    rim.receiveShadow = true;
    this.scene.add(rim);

    const fx = P.x;
    const fz = P.z;
    const prof = [[0, 0], [3.1, 0], [3.2, 0.9], [2.8, 0.95], [2.7, 0.55], [0.7, 0.5], [0.55, 1.9], [1.7, 2.1], [1.75, 2.5], [1.45, 2.5], [0.35, 2.3], [0.3, 3.3], [0.75, 3.4], [0.7, 3.6], [0, 3.7]];
    const lathe = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), 40);
    const stone = new THREE.MeshStandardMaterial({ color: '#f1eadb', roughness: 0.55 });
    const fountain = new THREE.Mesh(lathe, stone);
    fountain.position.set(fx, PLAZA_Y + 0.05, fz);
    fountain.castShadow = true;
    fountain.receiveShadow = true;
    this.scene.add(fountain);
    const wmat = new THREE.MeshStandardMaterial({ color: '#4fd6ff', emissive: '#2aa8ff', emissiveIntensity: 0.3, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 });
    const w1 = new THREE.Mesh(new THREE.CircleGeometry(2.75, 40), wmat);
    w1.rotation.x = -Math.PI / 2;
    w1.position.set(fx, PLAZA_Y + 0.75, fz);
    this.scene.add(w1);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(1.45, 32), wmat);
    w2.rotation.x = -Math.PI / 2;
    w2.position.set(fx, PLAZA_Y + 2.45, fz);
    this.scene.add(w2);
    this.fountainPos = new THREE.Vector3(fx, PLAZA_Y + 3.8, fz);
    this.addCollider(fx, fz, 3.4);

    const lampGeo = merge([
      part(new THREE.CylinderGeometry(0.12, 0.2, 3.6, 8), '#3a3f55', M(0, 1.8, 0)),
      part(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8), '#3a3f55', M(0, 0.15, 0)),
      part(new THREE.ConeGeometry(0.55, 0.4, 8), '#3a3f55', M(0, 4.3, 0)),
    ]);
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf6b', emissiveIntensity: 2.6 });
    const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 });
    const bulbGeo = new THREE.SphereGeometry(0.38, 14, 10);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.52;
      const x = fx + Math.cos(a) * (P.r - 0.9);
      const z = fz + Math.sin(a) * (P.r - 0.9);
      if (Math.abs(Math.sin(a)) > 0.9 && Math.sin(a) > 0) continue;
      const l = new THREE.Mesh(lampGeo, lampMat);
      l.position.set(x, PLAZA_Y, z);
      l.castShadow = true;
      this.scene.add(l);
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(x, PLAZA_Y + 3.7, z);
      this.scene.add(b);
      this.addCollider(x, z, 0.5);
    }
  }

  buildGates() {
    for (let i = 1; i < ZONES.length; i++) {
      const gx = gateX(i);
      const Z = ZONES[i];
      const group = new THREE.Group();
      group.position.set(gx, heightAt(gx, 0) - 0.1, 0);
      const pillarGeo = new RoundedBoxGeometry(2.2, 8, 2.2, 3, 0.35);
      const pm = new THREE.MeshStandardMaterial({ color: '#f3ecdf', roughness: 0.6, transparent: true });
      const tm = new THREE.MeshStandardMaterial({ color: Z.path, roughness: 0.45, metalness: 0.2, emissive: Z.path, emissiveIntensity: 0.15, transparent: true });
      const om = new THREE.MeshStandardMaterial({ color: Z.path, emissive: Z.path, emissiveIntensity: 2.2, transparent: true });
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(pillarGeo, pm);
        p.position.set(0, 4, s * 4.9);
        p.castShadow = true;
        p.receiveShadow = true;
        group.add(p);
        const cap = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.8, 2.8, 2, 0.25), tm);
        cap.position.set(0, 8.3, s * 4.9);
        cap.castShadow = true;
        group.add(cap);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), om);
        orb.position.set(0, 9.4, s * 4.9);
        group.add(orb);
        this.addCollider(gx, s * 4.9, 1.5);
      }
      const beam = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.2, 12.2, 2, 0.3), tm);
      beam.position.set(0, 7.6, 0);
      beam.castShadow = true;
      group.add(beam);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.2), makeBarrierMaterial(ZONES[i].path));
      bar.rotation.y = Math.PI / 2;
      bar.position.set(0, 3.6, 0);
      group.add(bar);
      const sign = makeSign(null, 512, 240);
      sign.scale.set(7.2, 3.4, 1);
      sign.position.set(0.9, 10.1, 0);
      group.add(sign);
      this.scene.add(group);
      const gate = { i, x: gx, group, barrier: bar, sign, unlocked: false, dissolve: -1, fadeMats: [pm, tm, om], parts: group.children.filter((o) => o !== bar && o !== sign), fade: 1, signFade: 1, barFade: 1 };
      this.drawGateSign(gate, false);
      this.gates.push(gate);
    }
    const r = rng(41);
    const geo = rockGeo(3);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: false, color: '#ffffff', roughness: 0.9 });
    const list = [];
    for (let i = 1; i < ZONES.length; i++) {
      const gx = gateX(i);
      for (const side of [-1, 1]) {
        const zEnd = side > 0 ? Z_MAX + 6 : Z_MIN - 5;
        for (let z = 6.8; z < Math.abs(zEnd); z += 1.9 + r() * 0.5) {
          const zz = side * z;
          const s = 1.5 + r() * 1.1;
          list.push({ x: gx + (r() - 0.5) * 1.2, z: zz, s, c: ZONES[i - 1].hill, rot: r() * 6 });
        }
      }
    }
    mat.transparent = true;
    this.gateRockMat = mat;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((o, k) => {
      mesh.setMatrixAt(k, M(o.x, heightAt(o.x, o.z) + o.s * 0.45, o.z, 0, o.rot, 0, o.s, o.s * 1.3, o.s));
      col.set(o.c).lerp(_cc.set('#8a8f99'), 0.45);
      mesh.setColorAt(k, col);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  drawGateSign(gate, unlocked, pct = 0) {
    const Z = ZONES[gate.i];
    gate.pct = pct;
    gate.sign.userData.draw((ctx, w, h) => {
      signPanel(ctx, w, h, Z.path);
      if (unlocked) {
        outlinedText(ctx, Z.name, w / 2, h / 2 - 6, 70, '#ffffff', '#2a2350');
      } else {
        drawLock(ctx, 70, 78, 70);
        outlinedText(ctx, Z.name, w / 2 + 30, 56, 54, '#ffffff', '#2a2350');
        drawCoin(ctx, 150, 126, 26);
        outlinedText(ctx, fmt(Z.gate), w / 2 + 40, 126, 52, '#ffd23a', '#5a3300');
        roundRect(ctx, 40, 166, w - 80, 34, 17);
        ctx.fillStyle = '#2a2350';
        ctx.fill();
        if (pct > 0) {
          roundRect(ctx, 46, 172, Math.max(22, (w - 92) * Math.min(1, pct)), 22, 11);
          ctx.fillStyle = pct >= 1 ? '#4fe36a' : '#ffc21a';
          ctx.fill();
        }
      }
    });
  }

  updateGateProgress(zones, coins) {
    const g = this.gates.find((x) => x.i === zones);
    if (!g || g.unlocked) return;
    const pct = Math.min(1, coins / ZONES[g.i].gate);
    if (Math.abs(pct - (g.pct || 0)) > 0.02 || (pct >= 1) !== ((g.pct || 0) >= 1)) this.drawGateSign(g, false, pct);
  }

  relockAll() {
    for (const g of this.gates) {
      g.unlocked = false;
      g.dissolve = -1;
      g.barrier.visible = true;
      g.barrier.material.uniforms.uDissolve.value = 0;
      this.drawGateSign(g, false, 0);
    }
  }

  unlockGate(i, instant) {
    const gate = this.gates.find((g) => g.i === i);
    if (!gate || gate.unlocked) return;
    gate.unlocked = true;
    this.drawGateSign(gate, true);
    if (instant) {
      gate.barrier.visible = false;
    } else {
      gate.dissolve = 0;
    }
  }

  buildStands() {
    const eggGeo = getEggGeometry();
    const pedGeo = new THREE.LatheGeometry(
      [[0, 0], [1.9, 0], [2.0, 0.35], [1.6, 0.5], [1.2, 0.6], [1.0, 1.4], [1.35, 1.6], [1.4, 1.85], [0, 1.9]].map((p) => new THREE.Vector2(p[0], p[1])),
      36
    );
    const pedMat = new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 0.5 });
    const defs = [];
    defs.push({ kind: 'gold', x: PLAZA.x - 6.2, z: PLAZA.z - 6.6 });
    defs.push({ kind: 0, x: PLAZA.x + 6.2, z: PLAZA.z - 6.6 });
    for (let i = 1; i < EGGS.length; i++) defs.push({ kind: i, x: gateX(i) + 10, z: -13 });
    for (const d of defs) {
      const isGold = d.kind === 'gold';
      const egg = isGold ? null : EGGS[d.kind];
      const colors = isGold ? GOLD_EGG.colors : egg.colors;
      const g = new THREE.Group();
      g.position.set(d.x, heightAt(d.x, d.z) - 0.05, d.z);
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.castShadow = true;
      ped.receiveShadow = true;
      g.add(ped);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.12, 8, 40), new THREE.MeshStandardMaterial({ color: colors[0], emissive: colors[0], emissiveIntensity: 2 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.72;
      g.add(ring);
      const em = makeEggMaterial(colors, (isGold ? 99 : d.kind) + 1, isGold);
      const eggMesh = new THREE.Mesh(eggGeo, em);
      eggMesh.position.y = 1.9;
      eggMesh.scale.setScalar(1.25);
      eggMesh.castShadow = true;
      g.add(eggMesh);
      const sign = makeSign(null, 512, 220);
      sign.scale.set(4.8, 2.05, 1);
      sign.position.y = 5.35;
      g.add(sign);
      sign.userData.draw((ctx, w, h) => {
        signPanel(ctx, w, h, colors[0]);
        outlinedText(ctx, isGold ? GOLD_EGG.name : egg.name, w / 2, 66, 50, '#ffffff', '#2a2350');
        if (isGold) drawGem(ctx, w / 2 - 70, 146, 30);
        else drawCoin(ctx, w / 2 - 70, 146, 30);
        outlinedText(ctx, fmt(isGold ? GOLD_EGG.gems : egg.price), w / 2 + 30, 146, 58, isGold ? '#8ff0ff' : '#ffd23a', isGold ? '#16306b' : '#5a3300');
      });
      this.scene.add(g);
      this.addCollider(d.x, d.z, 2.0);
      this.stands.push({ kind: d.kind, x: d.x, z: d.z, group: g, egg: eggMesh, ring, sign, zone: isGold ? 0 : d.kind });
    }
  }

  scatter(opts, count, seed) {
    const r = rng(seed);
    const out = [];
    const hash = new Map();
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const zi = opts.zone;
      const x0 = zi * ZONE_W - ZONE_W / 2 + 1;
      const x = x0 + r() * (ZONE_W - 2) + (opts.xpad ? (r() - 0.5) * opts.xpad : 0);
      let z;
      if (opts.band === 'play') z = Z_MIN + 1 + r() * (Z_MAX - Z_MIN - 2);
      else if (opts.band === 'edge') z = r() < 0.5 ? Z_MIN - 2 + r() * 5 : Z_MAX - 2 + r() * 5;
      else if (opts.band === 'hill') z = Z_MIN - 3 - r() * 34;
      else if (opts.band === 'beach') z = Z_MAX + 5 + r() * (coastNear(x) - Z_MAX - 12);
      else if (opts.band === 'far') z = Z_MIN - 1 - r() * 12;
      else z = Z_MIN - 20 + r() * (Z_MAX - Z_MIN + 26);
      if (zi === 0 && x < -ZONE_W / 2 + 1 && opts.band !== 'beach') continue;
      const h = heightAt(x, z);
      if (h < (opts.minH ?? 0.35)) continue;
      let ok = true;
      for (const g of this.gates) if (Math.abs(x - g.x) < 6) ok = false;
      if (!ok) continue;
      if (Math.abs(z - pathZ(x)) < (opts.pathPad ?? 3)) continue;
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 2) continue;
      if (opts.band === 'play' && Math.hypot(x - PLAZA.x, z - 16) < 12) continue;
      if (opts.band === 'play' || opts.band === 'edge') {
        for (const s of this.stands) if (Math.hypot(x - s.x, z - s.z) < 5) ok = false;
        if (!ok) continue;
        const near = this.grid.query(x, z, 3, []);
        for (const c of near) if (Math.hypot(c.x - x, c.z - z) < c.r + (opts.r || 1) + 0.6) ok = false;
        if (!ok) continue;
      }
      const sp = opts.spacing || 1;
      const gx = Math.floor(x / sp);
      const gz = Math.floor(z / sp);
      for (let ix = gx - 1; ix <= gx + 1 && ok; ix++) {
        for (let iz = gz - 1; iz <= gz + 1 && ok; iz++) {
          const cell = hash.get(ix * 100003 + iz);
          if (cell) for (const o of cell) if (Math.hypot(o.x - x, o.z - z) < sp) ok = false;
        }
      }
      if (!ok) continue;
      const hk = gx * 100003 + gz;
      if (!hash.has(hk)) hash.set(hk, []);
      hash.get(hk).push({ x, z });
      out.push({ x, z, y: h, s: (opts.s0 || 1) + r() * ((opts.s1 || 1) - (opts.s0 || 1)), rot: r() * Math.PI * 2, k: r() });
    }
    return out;
  }

  instanced(geo, mat, items, opts = {}) {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const col = new THREE.Color();
    if (!geo.attributes.color) {
      const n = geo.attributes.position.count;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    if (!mat.vertexColors) {
      mat.vertexColors = true;
      mat.needsUpdate = true;
    }
    items.forEach((o, i) => {
      const sy = o.sy || o.s;
      mesh.setMatrixAt(i, M(o.x, o.y + (opts.yOff || 0) * o.s, o.z, o.rx || 0, o.rot, o.rz || 0, o.s, sy, o.s));
      if (opts.tint) opts.tint(col, o);
      else col.setRGB(1, 1, 1);
      mesh.setColorAt(i, col);
      if (opts.collide) this.addCollider(o.x, o.z, opts.collide * o.s);
    });
    mesh.castShadow = !!opts.shadow;
    mesh.receiveShadow = opts.receive !== false;
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
    const zi = zoneAt(items.reduce((s, o) => s + o.x, 0) / items.length);
    if (!this.zoneMeshes[zi]) this.zoneMeshes[zi] = [];
    this.zoneMeshes[zi].push(mesh);
    return mesh;
  }

  setFocusZone(zc) {
    if (this.focusZone === zc) return;
    this.focusZone = zc;
    this.zoneMeshes.forEach((list, zi) => {
      const vis = Math.abs(zi - zc) <= 1;
      if (list) for (const m of list) m.visible = vis;
    });
  }

  decorZones() {
    const vc = { vertexColors: true, roughness: 0.8 };
    const treeMat = windMaterial(vc, 0.05);
    const grassMat = windMaterial({ vertexColors: true, roughness: 0.8 }, 0.35);
    const plainMat = new THREE.MeshStandardMaterial(vc);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
    const round = roundTreeGeo(false);
    const roundDark = roundTreeGeo(true);
    const pine = pineGeo(false);
    const snowPine = pineGeo(true);
    const palm = palmGeo();
    const cactus = cactusGeo();
    const bush = bushGeo();
    const grass = grassGeo();
    const flowers = ['#ff5f8f', '#ffffff', '#b98cff', '#ffcf3a'].map((c) => flowerGeo(c));
    const rocks = rockGeo(1);
    const mush = mushroomGeo(false);
    const glowMush = mushroomGeo(true);
    const lolli = lollipopGeo();
    const ice = iceCreamGeo();
    const cane = candyCaneGeo();
    const crystal = crystalGeo();
    const snowman = snowmanGeo();
    const fence = fenceGeo();
    const tintV = (amt) => (c, o) => c.setHSL(0, 0, 1 - o.k * amt);
    const rockTint = (hex) => (c, o) => c.set(hex).multiplyScalar(0.85 + o.k * 0.3);

    const zoneFns = [];
    zoneFns.push(() => {
    const Z0 = 0;
    this.instanced(round, treeMat, this.scatter({ zone: Z0, band: 'edge', spacing: 4, s0: 0.9, s1: 1.4, r: 1 }, 16, 1), { shadow: true, collide: 0.7, tint: tintV(0.25) });
    this.instanced(round, treeMat, this.scatter({ zone: Z0, band: 'hill', spacing: 3.5, s0: 1, s1: 1.6 }, 60, 2), { shadow: false, tint: tintV(0.3) });
    this.instanced(round, treeMat, this.scatter({ zone: Z0, band: 'beach', spacing: 5, s0: 0.9, s1: 1.3, xpad: 50 }, 8, 3), { shadow: false, tint: tintV(0.2) });
    this.instanced(round, treeMat, this.scatter({ zone: Z0, band: 'play', spacing: 6, s0: 1.0, s1: 1.3, r: 1.2 }, 5, 33), { shadow: true, collide: 0.7, tint: tintV(0.2) });
    this.instanced(bush, treeMat, this.scatter({ zone: Z0, band: 'edge', spacing: 2, s0: 0.8, s1: 1.4 }, 30, 4), { shadow: true, tint: tintV(0.2) });
    const plazaFlowers = [];
    const rr = rng(66);
    for (let i = 0; i < 70; i++) {
      const a = rr() * Math.PI * 2;
      const d = PLAZA.r + 1.2 + rr() * 2.2;
      const x = PLAZA.x + Math.cos(a) * d;
      const z = PLAZA.z + Math.sin(a) * d;
      if (Math.abs(z - pathZ(x)) < 2.5) continue;
      plazaFlowers.push({ x, z, y: heightAt(x, z), s: 0.9 + rr() * 0.6, rot: rr() * 6, k: rr() });
    }
    flowers.forEach((fg, i) => {
      const items = this.scatter({ zone: Z0, band: 'any', spacing: 0.6, s0: 0.8, s1: 1.4, pathPad: 2 }, 90, 10 + i).concat(plazaFlowers.filter((_, k) => k % 4 === i));
      this.instanced(fg, treeMat, items, {});
    });
    for (const zi of [0, 1]) {
      const items = this.scatter({ zone: zi, band: 'any', spacing: 0.45, s0: 0.8, s1: 1.5, pathPad: 1.9 }, zi === 0 ? 2200 : 1600, 20 + zi);
      this.instanced(grass, grassMat, items, { tint: (c, o) => c.set(zi === 0 ? '#ffffff' : '#9fc79a').multiplyScalar(0.85 + o.k * 0.25), receive: false });
    }
    this.instanced(rocks, rockMat, this.scatter({ zone: Z0, band: 'edge', spacing: 3, s0: 0.5, s1: 1.1 }, 10, 5), { shadow: true, collide: 0.9, tint: rockTint('#b9b5a6') });
    const fenceItems = [];
    for (let x = -30; x < 30; x += 2.2) {
      if (Math.abs(x - PLAZA.x) < 3 || Math.abs(Math.sin(x)) < 0.1) continue;
      fenceItems.push({ x, z: Z_MAX + 1.4, y: heightAt(x, Z_MAX + 1.4), s: 1, rot: 0, k: 0 });
    }
    this.instanced(fence, plainMat, fenceItems, { shadow: true });

    });
    zoneFns.push(() => {
    const Z1 = 1;
    this.instanced(pine, treeMat, this.scatter({ zone: Z1, band: 'edge', spacing: 3, s0: 1, s1: 1.6 }, 26, 31), { shadow: true, collide: 0.6, tint: tintV(0.25) });
    this.instanced(pine, treeMat, this.scatter({ zone: Z1, band: 'hill', spacing: 2.8, s0: 1.2, s1: 2.1 }, 110, 32), { shadow: false, tint: tintV(0.3) });
    this.instanced(pine, treeMat, this.scatter({ zone: Z1, band: 'play', spacing: 7, s0: 1.1, s1: 1.4, r: 1.2 }, 7, 38), { shadow: true, collide: 0.6, tint: tintV(0.2) });
    this.instanced(roundDark, treeMat, this.scatter({ zone: Z1, band: 'beach', spacing: 4, s0: 1, s1: 1.4 }, 14, 34), { shadow: false, tint: tintV(0.2) });
    this.instanced(mush, plainMat, this.scatter({ zone: Z1, band: 'any', spacing: 2.5, s0: 0.7, s1: 1.5, pathPad: 2.5 }, 36, 35), { shadow: true, tint: tintV(0.1) });
    this.instanced(bush, treeMat, this.scatter({ zone: Z1, band: 'edge', spacing: 2, s0: 0.9, s1: 1.5 }, 30, 36), { shadow: true, tint: (c) => c.set('#9fcf8a') });
    this.instanced(rocks, rockMat, this.scatter({ zone: Z1, band: 'edge', spacing: 3, s0: 0.6, s1: 1.4 }, 16, 37), { shadow: true, collide: 0.9, tint: rockTint('#8f9486') });

    });
    zoneFns.push(() => {
    const Z2 = 2;
    this.instanced(cactus, plainMat, this.scatter({ zone: Z2, band: 'play', spacing: 6, s0: 0.9, s1: 1.4, r: 1 }, 8, 41), { shadow: true, collide: 0.6 });
    this.instanced(cactus, plainMat, this.scatter({ zone: Z2, band: 'edge', spacing: 3, s0: 0.9, s1: 1.5 }, 18, 42), { shadow: true, collide: 0.6 });
    this.instanced(cactus, plainMat, this.scatter({ zone: Z2, band: 'hill', spacing: 5, s0: 1, s1: 1.8 }, 20, 43), { shadow: false });
    this.instanced(palm, treeMat, this.scatter({ zone: Z2, band: 'beach', spacing: 4, s0: 1, s1: 1.4 }, 16, 44), { shadow: false });
    this.instanced(palm, treeMat, this.scatter({ zone: Z2, band: 'far', spacing: 5, s0: 1, s1: 1.4 }, 8, 45), { shadow: false });
    this.instanced(rocks, rockMat, this.scatter({ zone: Z2, band: 'any', spacing: 3, s0: 0.6, s1: 1.8, pathPad: 3 }, 34, 46), { shadow: true, tint: rockTint('#e0a868') });
    this.instanced(grass, grassMat, this.scatter({ zone: Z2, band: 'any', spacing: 1.2, s0: 0.8, s1: 1.2, pathPad: 2 }, 260, 47), { tint: (c) => c.set('#e8c56a'), receive: false });

    });
    zoneFns.push(() => {
    const Z3 = 3;
    this.instanced(snowPine, treeMat, this.scatter({ zone: Z3, band: 'edge', spacing: 3, s0: 1, s1: 1.6 }, 24, 51), { shadow: true, collide: 0.6, tint: tintV(0.15) });
    this.instanced(snowPine, treeMat, this.scatter({ zone: Z3, band: 'hill', spacing: 3.2, s0: 1.2, s1: 2 }, 70, 52), { shadow: false, tint: tintV(0.15) });
    this.instanced(snowPine, treeMat, this.scatter({ zone: Z3, band: 'play', spacing: 7, s0: 1.1, s1: 1.4, r: 1.2 }, 6, 53), { shadow: true, collide: 0.6 });
    this.instanced(snowman, plainMat, this.scatter({ zone: Z3, band: 'play', spacing: 10, s0: 0.9, s1: 1.1, r: 1.2 }, 5, 54), { shadow: true, collide: 1 });
    this.instanced(rocks, rockMat, this.scatter({ zone: Z3, band: 'any', spacing: 3, s0: 0.6, s1: 1.4, pathPad: 3 }, 24, 55), { shadow: true, tint: rockTint('#a9c9e8') });

    });
    zoneFns.push(() => {
    const Z4 = 4;
    this.instanced(lolli, plainMat, this.scatter({ zone: Z4, band: 'edge', spacing: 3.5, s0: 0.9, s1: 1.4 }, 20, 61), { shadow: true, collide: 0.4 });
    this.instanced(lolli, plainMat, this.scatter({ zone: Z4, band: 'hill', spacing: 4, s0: 1.2, s1: 2 }, 30, 62), { shadow: false });
    this.instanced(ice, plainMat, this.scatter({ zone: Z4, band: 'play', spacing: 8, s0: 0.9, s1: 1.2, r: 1.2 }, 6, 63), { shadow: true, collide: 0.9 });
    this.instanced(ice, plainMat, this.scatter({ zone: Z4, band: 'hill', spacing: 5, s0: 1.2, s1: 1.9 }, 16, 64), { shadow: false });
    this.instanced(cane, plainMat, this.scatter({ zone: Z4, band: 'edge', spacing: 3, s0: 0.9, s1: 1.4 }, 20, 65), { shadow: true, collide: 0.3 });
    const gum = new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const gumMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0 });
    const gumCols = ['#ff4f8b', '#7ee6ff', '#ffd84a', '#9dff7a', '#b88cff'];
    this.instanced(gum, gumMat, this.scatter({ zone: Z4, band: 'any', spacing: 1.2, s0: 0.6, s1: 1.4, pathPad: 2.5 }, 80, 66), { tint: (c, o) => c.set(gumCols[Math.floor(o.k * 5)]), shadow: true });

    });
    zoneFns.push(() => {
    const Z5 = 5;
    const crys = [['#6fe8ff', '#1fb8ff'], ['#ff8af0', '#ff3fd8'], ['#b58bff', '#7a4dff']];
    crys.forEach((cc, i) => {
      const cm = new THREE.MeshStandardMaterial({ color: cc[0], emissive: cc[1], emissiveIntensity: 2.4, roughness: 0.15, metalness: 0.1 });
      this.instanced(crystal, cm, this.scatter({ zone: Z5, band: 'edge', spacing: 3, s0: 0.8, s1: 1.6 }, 10, 71 + i), { shadow: true, collide: 0.9 });
      this.instanced(crystal, cm, this.scatter({ zone: Z5, band: 'hill', spacing: 3.5, s0: 1.2, s1: 2.6 }, 24, 74 + i), { shadow: false });
      this.instanced(crystal, cm, this.scatter({ zone: Z5, band: 'play', spacing: 8, s0: 0.6, s1: 1, r: 1 }, 3, 77 + i), { shadow: true, collide: 0.8 });
    });
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#6a4dff', emissiveIntensity: 1.3, roughness: 0.6 });
    this.instanced(glowMush, gm, this.scatter({ zone: Z5, band: 'any', spacing: 2.2, s0: 0.6, s1: 1.4, pathPad: 2.5 }, 40, 80), { tint: tintV(0.1) });
    this.instanced(rocks, rockMat, this.scatter({ zone: Z5, band: 'any', spacing: 3, s0: 0.6, s1: 1.6, pathPad: 3 }, 30, 81), { shadow: true, tint: rockTint('#3f3470') });
  });
    return zoneFns;
  }

  fadeGates(dt, cam) {
    let rockFade = 1;
    for (const g of this.gates) {
      const dx = Math.abs(cam.x - g.x);
      const sy = g.group.position.y + 10.1;
      const dSign = Math.hypot(cam.x - g.x, cam.y - sy, cam.z);
      const dPillar = Math.min(Math.hypot(cam.x - g.x, cam.z - 4.9), Math.hypot(cam.x - g.x, cam.z + 4.9));
      const pl = this.focus;
      let crosses = false;
      if (pl && Math.sign(cam.x - g.x) !== Math.sign(pl.x - g.x)) {
        const t = (g.x - cam.x) / (pl.x - cam.x);
        const zc = cam.z + (pl.z - cam.z) * t;
        crosses = Math.abs(zc) < 8;
      }
      const plNear = pl && Math.abs(pl.x - g.x) < 7 && Math.abs(pl.z) < 12 && Math.abs(cam.x - g.x) < 18;
      const near = dSign < 10 || dPillar < 5 || crosses || plNear;
      const k = Math.min(1, dt * 8);
      g.fade += ((near ? 0 : 1) - g.fade) * k;
      g.signFade += ((dSign < 10 ? 0.18 : 1) - g.signFade) * k;
      g.barFade += ((crosses ? 0.2 : 1) - g.barFade) * k;
      for (const m of g.fadeMats) {
        m.opacity = g.fade;
        m.depthWrite = g.fade > 0.95;
      }
      for (const o of g.parts) o.visible = g.fade > 0.05;
      g.barrier.material.uniforms.uFade.value = g.barFade;
      g.sign.material.opacity = g.signFade * (g.hudFade ?? 1);
      if (dx < 4.5) rockFade = Math.min(rockFade, 0.25 + (dx / 4.5) * 0.75);
    }
    if (this.gateRockMat) {
      this.gateRockMat.opacity = rockFade;
      this.gateRockMat.depthWrite = rockFade > 0.95;
    }
  }

  applyAmbience(x, dt, lights, scene, renderer) {
    const zm = zoneMix(x);
    const A = SKY[zm.a];
    const B = SKY[zm.b];
    const t = zm.t;
    const k = dt < 0 ? 1 : 1 - Math.exp(-dt * 2.5);
    const lerpC = (target, a, b) => {
      _ca.set(a).lerp(_cb.set(b), t);
      target.lerp(_ca, k);
    };
    const u = this.sky.material.uniforms;
    lerpC(u.uTop.value, A.top, B.top);
    lerpC(u.uHor.value, A.hor, B.hor);
    _cc.set(A.hor).lerp(_cb.set(B.hor), t).multiplyScalar(LIGHT_K);
    scene.fog.color.lerp(_cc, k);
    lerpC(lights.sun.color, A.sun, B.sun);
    lerpC(lights.hemi.color, A.hemiS, B.hemiS);
    lerpC(lights.hemi.groundColor, A.hemiG, B.hemiG);
    lights.sun.intensity = lerp(lights.sun.intensity, lerp(A.sunI, B.sunI, t) * LIGHT_K, k);
    lights.hemi.intensity = lerp(lights.hemi.intensity, lerp(A.hemiI, B.hemiI, t) * LIGHT_K * 0.7, k);
    renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, (lerp(A.exp, B.exp, t) * 0.72) / LIGHT_K, k);
    this.water.material.uniforms.uSky.value.copy(u.uHor.value);
  }

  update(dt, time, cam, focus) {
    this.focus = focus;
    if (cam) this.fadeGates(dt, cam);
    windUniform.value = time;
    this.water.material.uniforms.uTime.value = time;
    this.updateClouds(dt);
    for (const g of this.gates) {
      g.barrier.material.uniforms.uTime.value = time;
      if (g.dissolve >= 0) {
        g.dissolve += dt * 0.7;
        g.barrier.material.uniforms.uDissolve.value = Math.min(1, g.dissolve);
        if (g.dissolve >= 1) {
          g.barrier.visible = false;
          g.dissolve = -1;
        }
      }
    }
    for (const s of this.stands) {
      s.egg.rotation.y = time * 0.8 + s.x;
      s.egg.position.y = 1.95 + Math.sin(time * 2 + s.x) * 0.12;
      s.ring.rotation.z = time;
    }
  }
}
