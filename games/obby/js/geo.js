import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const cache = new Map();

function shade(y, h, ny) {
  const t = Math.max(0, Math.min(1, y / h + 0.5));
  let s = 0.58 + 0.42 * Math.pow(t, 0.8);
  if (ny < -0.5) s *= 0.7;
  return s;
}

export function blockGeo(sx, sy, sz, radius = 0.2, tile = 2) {
  const key = `b${sx.toFixed(2)}_${sy.toFixed(2)}_${sz.toFixed(2)}_${radius}_${tile}`;
  if (cache.has(key)) return cache.get(key);
  const r = Math.min(radius, sy * 0.45, sx * 0.45, sz * 0.45);
  const g = new RoundedBoxGeometry(sx, sy, sz, 2, r);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = pos.count;
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = x / tile;
      v = -z / tile;
    } else if (ax >= az) {
      u = z / tile;
      v = y / tile;
    } else {
      u = x / tile;
      v = y / tile;
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
    const s = shade(y, sy, nor.getY(i));
    col[i * 3] = s;
    col[i * 3 + 1] = s;
    col[i * 3 + 2] = s * 1.02;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cache.set(key, g);
  return g;
}

export function diskGeo(r, h, bevel = 0.18, tile = 2, seg = 32) {
  const key = `d${r.toFixed(2)}_${h.toFixed(2)}_${bevel}_${tile}_${seg}`;
  if (cache.has(key)) return cache.get(key);
  const b = Math.min(bevel, h * 0.45, r * 0.4);
  const pts = [];
  const hh = h / 2;
  pts.push(new THREE.Vector2(0, -hh));
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, -hh + b + Math.sin(a) * b));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, hh - b + Math.sin(a) * b));
  }
  pts.push(new THREE.Vector2(0, hh));
  const lathe = new THREE.LatheGeometry(pts, seg);
  const g = lathe.toNonIndexed();
  lathe.dispose();
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = pos.count;
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const topIdx = [];
  const sideIdx = [];
  for (let t = 0; t < n; t += 3) {
    let ny = 0;
    for (let k = 0; k < 3; k++) ny += nor.getY(t + k);
    (ny / 3 > 0.75 ? topIdx : sideIdx).push(t, t + 1, t + 2);
  }
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getY(i)) > 0.75) {
      uv[i * 2] = x / tile;
      uv[i * 2 + 1] = -z / tile;
    } else {
      const a = Math.atan2(z, x);
      uv[i * 2] = (a * r) / tile;
      uv[i * 2 + 1] = y / tile;
    }
    const s = shade(y, h, nor.getY(i));
    col[i * 3] = s;
    col[i * 3 + 1] = s;
    col[i * 3 + 2] = s * 1.02;
  }
  const idx = topIdx.concat(sideIdx);
  g.setIndex(idx);
  g.clearGroups();
  g.addGroup(0, topIdx.length, 0);
  g.addGroup(topIdx.length, sideIdx.length, 1);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cache.set(key, g);
  return g;
}

export function jitter(g, amt, seed = 1, keepTop = false) {
  const pos = g.attributes.position;
  const h = (x, y, z) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    return s - Math.floor(s) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (keepTop && y > -0.001) continue;
    pos.setXYZ(i, x + h(x, y, z) * amt, y + h(y, z, x) * amt, z + h(z, x, y) * amt);
  }
  g.computeVertexNormals();
  return g;
}

export function vertexGradient(g, bottom, top, axis = 'y') {
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const lo = bb.min[axis];
  const hi = bb.max[axis];
  const c0 = new THREE.Color(bottom);
  const c1 = new THREE.Color(top);
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos['get' + axis.toUpperCase()](i) - lo) / (hi - lo || 1);
    c.copy(c0).lerp(c1, t);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function clearGeoCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
