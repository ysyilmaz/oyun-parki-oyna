import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

const cache = new Map();
const IVORY = '#f2ece0';
const KRAFT = 0xa8865e;
const GRAPHITE = 0x3a3a44;
const SAGE = 0x8fa38a;
const SLATE = 0x5e6a7e;
const WALL_BASE = new THREE.Color(0x3a322b);
const _wc = new THREE.Color();

function canvasTex(key, S, draw) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    draw(c.getContext('2d'), S);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
  }
  return cache.get(key);
}

export function cardTop() {
  return canvasTex('w7card', 256, (x, S) => {
    const r = TX.rng(7071);
    x.fillStyle = IVORY;
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 900; k++) {
      const v = r() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.10)';
      x.fillStyle = v;
      x.fillRect(r() * S, r() * S, 1 + r() * 3, 1);
    }
    x.strokeStyle = 'rgba(110,90,60,0.22)';
    x.lineWidth = 1.5;
    x.setLineDash([7, 5]);
    for (const p of [S * 0.12, S * 0.88]) {
      x.beginPath();
      x.moveTo(p, 0);
      x.lineTo(p, S);
      x.stroke();
      x.beginPath();
      x.moveTo(0, p);
      x.lineTo(S, p);
      x.stroke();
    }
    x.setLineDash([]);
    x.fillStyle = 'rgba(90,70,45,0.18)';
    for (let i = 0; i < S; i += 2) {
      const d = 2 + r() * 3;
      x.fillRect(i, 0, 2, d);
      x.fillRect(i, S - d, 2, d);
      x.fillRect(0, i, d, 2);
      x.fillRect(S - d, i, d, 2);
    }
  });
}

function tissueTop() {
  return canvasTex('w7tissue', 256, (x, S) => {
    const r = TX.rng(4417);
    x.fillStyle = '#c9d2da';
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 70; k++) {
      let px = r() * S;
      let py = r() * S;
      x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(70,84,100,0.24)';
      x.lineWidth = 1 + r() * 1.5;
      x.beginPath();
      x.moveTo(px, py);
      for (let j = 0; j < 4; j++) {
        px += (r() - 0.5) * 60;
        py += (r() - 0.5) * 60;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,0.85)';
    const d = S * 0.07;
    for (let i = 0; i < S; i += 16) {
      for (const [ax, ay, bx, by, cx, cy] of [[i, 0, i + 8, d, i + 16, 0], [i, S, i + 8, S - d, i + 16, S], [0, i, d, i + 8, 0, i + 16], [S, i, S - d, i + 8, S, i + 16]]) {
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(bx, by);
        x.lineTo(cx, cy);
        x.fill();
      }
    }
  });
}

export function cardSide() {
  return canvasTex('w7side', 256, (x, S) => {
    const r = TX.rng(7093);
    const tones = ['#bcab8e', '#a68f70', '#cbbca0', '#8f7758'];
    let y = 0;
    let i = 0;
    while (y < S) {
      const h = 10 + Math.floor(r() * 14);
      x.fillStyle = tones[i++ % tones.length];
      x.fillRect(0, y, S, h);
      x.fillStyle = 'rgba(60,45,30,0.35)';
      x.fillRect(0, y + h - 1.5, S, 1.5);
      y += h;
    }
  });
}

export const PAPER_LOOK = {
  groundCap: false,
  band: false,
  mushrooms: false,
  bar: { color: 0xc82a1a, emissive: 0xff3a1a, glow: 1.1, tip: 1.2, tipColor: 0xffffff, flash: 1, line: 0xff3020, lineGlow: 4.4 },
  conveyor: { color: KRAFT, glow: 1.2 },
  gate: ['#f2ece0', '#3a3a44'],
  chevron: [0xf2ece0, GRAPHITE],
  curb: ['#a8865e', '#8a6a48'],
  spinArrows: true,
  arrow: GRAPHITE,
  postW: 0.6,
  postOut: 2.6,
  portalRing: (w) => w.std({ color: GRAPHITE, roughness: 0.8 }),
  mats: (H) => {
    const side = () => H.std('w7side', { map: cardSide(), roughness: 0.9 });
    const top = () => H.std('w7top', { map: cardTop(), roughness: 0.88 });
    const kraft = () => H.std('w7kraft', { map: cardTop(), color: KRAFT, roughness: 0.9 });
    return {
      groundTop: top,
      groundSide: side,
      blockTop: (col) => H.tint('w7tile', col, { map: cardTop(), roughness: 0.86 }),
      blockSide: side,
      hazard: () => H.std('w7graph', { color: GRAPHITE, roughness: 0.7 }),
      spinnerSide: side,
      spinnerTop: (col) => H.tint('w7tile', col, { map: cardTop(), roughness: 0.86 }),
      plankSide: side,
      plankTop: kraft,
      beamSide: side,
      beamTop: kraft,
      swingSide: side,
      swingTop: kraft,
      crumble: () => H.std('w7tissue', { map: tissueTop(), color: 0xffffff, roughness: 0.95 }),
      trampTop: () => H.std('w7tramp', { map: cardTop(), color: 0xd9cbb0, roughness: 0.9 }),
      trampSide: side,
      hubTop: kraft,
      pillarSide: side,
      pillarTop: kraft,
    };
  },
};

export function canyonMaterial(cols) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { shade: { value: new THREE.Color(cols.shade) }, paper: { value: new THREE.Color(cols.paper) }, line: { value: new THREE.Color(cols.line) } }]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 shade; uniform vec3 paper; uniform vec3 line;
      varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float fold = abs(fract(p.x / 46.0) - 0.5) * 2.0;
        vec3 c = mix(shade, paper, 0.35 + 0.4 * fold);
        vec2 g = abs(fract(p / 4.0) - 0.5);
        float aa = fwidth(p.x) * 0.25 + 0.01;
        float grid = 1.0 - smoothstep(0.0, aa, min(g.x, g.y) - 0.47);
        vec2 G = abs(fract(p / 20.0) - 0.5);
        float big = 1.0 - smoothstep(0.0, aa * 0.2 + 0.004, min(G.x, G.y) - 0.49);
        c = mix(c, line, clamp(grid * 0.35 + big * 0.6, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
}

function hillShape(w, h, seed) {
  const r = TX.rng(seed);
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = h * (0.45 + 0.55 * Math.sin(t * Math.PI) * (0.6 + 0.4 * r()));
    s.lineTo(-w / 2 + w * t, y);
  }
  s.lineTo(w / 2, 0);
  s.closePath();
  return s;
}

function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  return geo;
}

export function buildPaper(ctx) {
  const { g, T, R, b, len } = ctx;
  const layers = [
    { d: 150, h: 34, col: 0xd9cbb0 },
    { d: 190, h: 52, col: SAGE },
    { d: 235, h: 70, col: KRAFT },
    { d: 280, h: 92, col: SLATE },
  ];
  const parts = [];
  const zc = (b.minZ + b.maxZ) / 2;
  layers.forEach((L, li) => {
    for (const side of [-1, 1]) {
      const n = Math.ceil((len + 400) / 120);
      for (let i = 0; i < n; i++) {
        const w = 150 + R(0, 60);
        const geo = new THREE.ShapeGeometry(hillShape(w, L.h * R(0.8, 1.15), 900 + li * 97 + i * 13 + (side > 0 ? 7 : 0)), 1);
        geo.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
        geo.translate(side * (L.d + R(-10, 10)), -40, b.maxZ + 200 - i * 120 + R(-20, 20));
        parts.push(paint(geo, L.col));
      }
    }
    const end = new THREE.ShapeGeometry(hillShape(L.d * 2.4, L.h * 1.1, 1300 + li), 1);
    end.translate(0, -40, b.minZ - L.d * 0.8);
    parts.push(paint(end, L.col));
  });
  const hillGeo = T(mergeGeometries(parts, false));
  for (const p of parts) p.dispose();
  const hillM = T(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide }));
  const hills = new THREE.Mesh(hillGeo, hillM);
  hills.frustumCulled = false;
  hills.renderOrder = -5;
  g.add(hills);

  const wallM = T(new THREE.MeshStandardMaterial({ map: cardSide(), roughness: 0.92, vertexColors: true }));
  const tones = [0xffffff, 0xece4d4, 0xd8ccb4];
  const CH = 96;
  for (let z0 = b.maxZ + 40; z0 > b.minZ - 60; z0 -= CH) {
    const pieces = [];
    for (const side of [-1, 1]) {
      let z = z0;
      while (z > z0 - CH) {
        const d = R(10, 22);
        const x = side * R(52, 78);
        const y = (zc - z) / len;
        const top = THREE.MathUtils.lerp(0, b.maxY, THREE.MathUtils.clamp(-z / len, 0, 1)) + R(-14, 4);
        const h = top + 40;
        const geo = new THREE.BoxGeometry(R(10, 18), h, d, 1, 6, 1);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * (h / 12));
        geo.translate(x, top - h / 2 + y * 0, z - d / 2);
        const c = new THREE.Color(tones[Math.floor(R(0, 3)) % 3]);
        const pos = geo.attributes.position;
        const a = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const k = THREE.MathUtils.smoothstep(pos.getY(i), top - 14, top);
          _wc.copy(WALL_BASE).lerp(c, k);
          a[i * 3] = _wc.r;
          a[i * 3 + 1] = _wc.g;
          a[i * 3 + 2] = _wc.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
        pieces.push(geo);
        z -= d + R(0, 6);
      }
    }
    const wg = T(mergeGeometries(pieces, false));
    for (const p of pieces) p.dispose();
    const wall = new THREE.Mesh(wg, wallM);
    wall.receiveShadow = true;
    g.add(wall);
  }
}
