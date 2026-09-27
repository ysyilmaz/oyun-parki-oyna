import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  let g = geo.index || geo.attributes.uv ? geo.clone() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.index) g = mergeVertices(g);
  if (matrix) g.applyMatrix4(matrix);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  if (!colorFn) _c.set(color);
  for (let i = 0; i < pos.count; i++) {
    if (colorFn) colorFn(_c, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i), i);
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts.filter(Boolean), false);
  for (const p of parts) if (p) p.dispose();
  g.computeBoundingSphere();
  return g;
}

export function rbox(w, h, d, r = 0.08, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}

export function shadeY(y0, y1, c0, dark = 0.72) {
  const base = new THREE.Color(c0);
  return (out, x, y) => {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    out.copy(base).multiplyScalar(dark + (1 - dark) * t);
  };
}

export function rainbowFn(scale = 1.4, offset = 0) {
  return (out, x, y, z) => {
    const h = ((Math.atan2(z, x) / (Math.PI * 2) + y * scale + offset) % 1 + 1) % 1;
    out.setHSL(h, 0.9, 0.58);
  };
}

export const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0 });
export const vcGloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05 });
export const vcMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75 });
export const vcGlow = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) });

export function glowMat(color, k = 2.2) {
  const c = new THREE.Color(color).multiplyScalar(k);
  return new THREE.MeshBasicMaterial({ color: c });
}

export function outlineMaterial(width = 0.022, color = '#17122a') {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: width }, uC: { value: new THREE.Color(color) } },
    side: THREE.BackSide,
    vertexShader: `uniform float uW;
      #include <common>
      #include <skinning_pars_vertex>
      void main(){
        vec3 transformed = position;
        vec3 objectNormal = normal;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed + normalize(objectNormal) * uW, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0); }`,
  });
}

export const outlineMat = outlineMaterial(0.02);
export const outlineMatThin = outlineMaterial(0.012);

export function withOutline(geo, mat = vcMat, oMat = outlineMat, cast = true) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = false;
  const o = new THREE.Mesh(geo, oMat);
  g.add(m, o);
  g.userData.main = m;
  return g;
}

export function canvasTex(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  return t;
}

export function instanced(geo, mat, matrices, colors, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => im.setColorAt(i, _c.set(c)));
  im.castShadow = shadow;
  im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}
