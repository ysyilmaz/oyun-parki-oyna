import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const parts = new Map();
const textures = {};
let pieces = null;

function splitColor(g) {
  const c = g.attributes.color;
  if (!c || c.itemSize !== 4) return g;
  const rgb = new Float32Array(c.count * 3);
  const w = new Float32Array(c.count);
  for (let i = 0; i < c.count; i++) {
    rgb[i * 3] = c.getX(i);
    rgb[i * 3 + 1] = c.getY(i);
    rgb[i * 3 + 2] = c.getZ(i);
    w[i] = c.getW(i);
  }
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.setAttribute('kitW', new THREE.BufferAttribute(w, 1));
  return g;
}

export async function loadKit(base = 'assets/') {
  if (pieces) return;
  try {
    const loader = new THREE.TextureLoader();
    const [gltf, spec, albedo, normal] = await Promise.all([
      new GLTFLoader().loadAsync(base + 'kit.glb'),
      fetch(base + 'kit.json').then((r) => r.json()),
      loader.loadAsync(base + 'stud_albedo.png'),
      loader.loadAsync(base + 'stud_normal.png'),
    ]);
    gltf.scene.traverse((o) => {
      if (o.isMesh) parts.set(o.name, splitColor(o.geometry));
    });
    albedo.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    for (const t of [albedo, normal]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
    }
    textures.studAlbedo = albedo;
    textures.studNormal = normal;
    pieces = spec.pieces;
  } catch (e) {
    parts.clear();
    pieces = null;
  }
}

export function kitReady() {
  return !!pieces;
}

export function kitPiece(name) {
  return pieces ? pieces[name] : null;
}

export function kitTexture(name) {
  return textures[name] || null;
}

export function kitPart(name) {
  return parts.get(name) || null;
}

export function kitMulti(name) {
  const list = [];
  for (let i = 0; parts.has(`${name}_${i}`); i++) list.push(parts.get(`${name}_${i}`));
  if (!list.length) return null;
  return list.length === 1 ? list[0].clone() : mergeGeometries(list.map((g) => g.clone()), true);
}
