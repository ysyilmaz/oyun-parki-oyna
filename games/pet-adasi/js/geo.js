import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

export function part(geo, color, matrix, colorFn) {
  let g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.index) g = mergeVertices(g);
  if (matrix) g.applyMatrix4(matrix);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  if (!colorFn) _c.set(color);
  for (let i = 0; i < pos.count; i++) {
    if (colorFn) colorFn(_c, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i), color);
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return g;
}

export function displace(geo, amount, freq, seed = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * freq + seed) * Math.cos(v.y * freq * 1.3 + seed * 2) * Math.sin(v.z * freq * 0.9 + seed * 3);
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amount) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function gradientY(y0, y1, c0, c1) {
  const a = new THREE.Color(c0);
  const b = new THREE.Color(c1);
  return (out, x, y) => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    out.copy(a).lerp(b, t);
  };
}

export const windUniform = { value: 0 };

export function windMaterial(opts, strength = 0.06) {
  const mat = new THREE.MeshStandardMaterial(opts);
  const k = { value: strength };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.uniforms.uWindK = k;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindK;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
        vec3 ip = vec3(0.0);
        #endif
        float wy = max(position.y - 0.3, 0.0);
        float ws = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.21) + 0.4 * sin(uWind * 3.1 + ip.x * 0.8);
        transformed.x += ws * uWindK * wy;
        transformed.z += ws * uWindK * 0.6 * wy;`
      );
  };
  mat.customProgramCacheKey = () => 'wind';
  return mat;
}

const _white = new THREE.Color(1, 1, 1);

export function normalizeMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.isMeshStandardMaterial || m.map || m.vertexColors) continue;
      if (o.morphTargetInfluences) continue;
      m.vertexColors = true;
      m.needsUpdate = true;
    }
    const g = o.geometry;
    if (mats.some((m) => m && m.vertexColors) && !g.attributes.color) {
      const n = g.attributes.position.count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    }
    if (o.isInstancedMesh && !o.instanceColor) {
      const cap = o.instanceMatrix.count;
      for (let i = 0; i < cap; i++) o.setColorAt(i, _white);
    }
  });
}
