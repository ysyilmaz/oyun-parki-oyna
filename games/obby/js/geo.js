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

function planarUv(g, tile, vertical = false) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let t = 0; t < pos.count; t += 3) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let k = 0; k < 3; k++) {
      ax += nor.getX(t + k);
      ay += nor.getY(t + k);
      az += nor.getZ(t + k);
    }
    const top = Math.abs(ay) / (Math.hypot(ax, ay, az) || 1) > 0.9;
    ax = Math.abs(ax);
    az = Math.abs(az);
    for (let k = t; k < t + 3; k++) {
      const x = pos.getX(k);
      const y = pos.getY(k);
      const z = pos.getZ(k);
      if (top) uv.set([x / tile, -z / tile], k * 2);
      else if (ax >= az) uv.set(vertical ? [y / tile, z / tile] : [z / tile, y / tile], k * 2);
      else uv.set(vertical ? [y / tile, x / tile] : [x / tile, y / tile], k * 2);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export function kitBox(tpl, name, sx, sy, sz, k, tile = 2) {
  const key = `k${name}_${sx.toFixed(3)}_${sy.toFixed(3)}_${sz.toFixed(3)}_${k.toFixed(4)}_${tile}`;
  if (cache.has(key)) return cache.get(key);
  const src = tpl.index ? tpl.toNonIndexed() : tpl.clone();
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const tc = src.attributes.color;
  const tw = src.attributes.kitW;
  const n = pos.count;
  const half = [sx / 2, sy / 2, sz / 2];
  const dmax = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) dmax[a] = Math.max(dmax[a], 1 - Math.abs(pos.getComponent(i, a)));
  const ks = half.map((h, a) => Math.min(k, (0.49 * h * 2) / Math.max(dmax[a], 1e-6)));
  const col = new Float32Array(n * 3);
  const wear = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = [0, 0, 0];
    const nn = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      const t = pos.getComponent(i, a);
      p[a] = Math.sign(t) * (half[a] - (1 - Math.abs(t)) * ks[a]);
      nn[a] = nor.getComponent(i, a) / ks[a];
    }
    const l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    pos.setXYZ(i, p[0], p[1], p[2]);
    nor.setXYZ(i, nn[0] / l, nn[1] / l, nn[2] / l);
    const s = shade(p[1], sy, nn[1] / l);
    col[i * 3] = s * tc.getX(i);
    col[i * 3 + 1] = s * tc.getY(i);
    col[i * 3 + 2] = s * 1.02 * tc.getZ(i);
    wear[i] = tw ? tw.getX(i) : 0;
  }
  src.deleteAttribute('color');
  src.setAttribute('color', new THREE.BufferAttribute(col, 3));
  src.setAttribute('kitW', new THREE.BufferAttribute(wear, 1));
  planarUv(src, tile);
  cache.set(key, src);
  return src;
}

export function kitUv(g, tile, vertical = false) {
  const out = g.index ? g.toNonIndexed() : g;
  planarUv(out, tile, vertical);
  return out;
}
