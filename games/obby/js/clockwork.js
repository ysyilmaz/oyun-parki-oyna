import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

const cache = new Map();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(key, S, draw, repeat = true) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    draw(c.getContext('2d'), S);
    const t = new THREE.CanvasTexture(c);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
  }
  return cache.get(key);
}

export function tileTop() {
  return canvasTex('w6tile', 256, (x, S) => {
    const r = rng(611);
    x.fillStyle = '#6e6458';
    x.fillRect(0, 0, S, S);
    const n = 2;
    const w = S / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x0 = i * w + 3;
        const y0 = j * w + 3;
        const g = x.createLinearGradient(x0, y0, x0 + w, y0 + w);
        const v = 236 + r() * 10;
        g.addColorStop(0, `rgb(${v},${v - 4},${v - 14})`);
        g.addColorStop(1, `rgb(${v - 22},${v - 26},${v - 36})`);
        x.fillStyle = g;
        x.beginPath();
        x.roundRect(x0, y0, w - 6, w - 6, 9);
        x.fill();
        x.strokeStyle = 'rgba(70,60,50,0.28)';
        x.lineWidth = 2;
        x.beginPath();
        x.roundRect(x0 + 12, y0 + 12, w - 30, w - 30, 5);
        x.stroke();
        x.fillStyle = 'rgba(255,255,255,0.35)';
        x.beginPath();
        x.ellipse(x0 + w * 0.28, y0 + w * 0.22, w * 0.18, w * 0.05, -0.6, 0, Math.PI * 2);
        x.fill();
      }
    }
  });
}

export function plazaTop() {
  return canvasTex('w6plaza', 256, (x, S) => {
    x.fillStyle = '#6a5e52';
    x.fillRect(0, 0, S, S);
    const n = 4;
    const w = S / n;
    const r = rng(633);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 226 + r() * 14;
        const blue = (i + j) % 2 === 0;
        x.fillStyle = blue ? `rgb(${v - 10},${v - 12},${v - 18})` : `rgb(${v},${v - 6},${v - 18})`;
        x.beginPath();
        x.roundRect(i * w + 2, j * w + 2, w - 4, w - 4, 5);
        x.fill();
        if (blue) {
          x.strokeStyle = 'rgba(42,82,200,0.75)';
          x.lineWidth = 3;
          x.beginPath();
          x.arc(i * w + w / 2, j * w + w / 2, w * 0.28, 0, Math.PI * 2);
          x.stroke();
        }
      }
    }
  });
}

export function panelSide() {
  return canvasTex('w6panel', 256, (x, S) => {
    const r = rng(647);
    x.fillStyle = '#5c3624';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) {
      const x0 = i * 64;
      const g = x.createLinearGradient(x0, 0, x0 + 64, 0);
      g.addColorStop(0, '#4a2a1a');
      g.addColorStop(0.5, '#6e4430');
      g.addColorStop(1, '#4a2a1a');
      x.fillStyle = g;
      x.fillRect(x0 + 3, 0, 58, S);
      x.strokeStyle = 'rgba(30,16,10,0.6)';
      x.lineWidth = 2;
      x.strokeRect(x0 + 9, 10, 46, S - 20);
      for (let k = 0; k < 40; k++) {
        x.strokeStyle = `rgba(${r() < 0.5 ? '30,16,8' : '130,86,58'},${0.08 + r() * 0.1})`;
        x.lineWidth = 1;
        const xx = x0 + 6 + r() * 52;
        x.beginPath();
        x.moveTo(xx, 0);
        x.bezierCurveTo(xx + r() * 4 - 2, S * 0.3, xx + r() * 4 - 2, S * 0.7, xx + r() * 4 - 2, S);
        x.stroke();
      }
    }
  });
}

function bandify(m) {
  if (m.userData.band) return m;
  m.userData.band = true;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n float brassBand = smoothstep(0.935, 0.955, vColor.r) * step(abs(vNormal.y), 0.6);\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.44, 0.2), brassBand);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.85, brassBand);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.5, brassBand);');
  };
  m.customProgramCacheKey = () => 'w6band';
  return m;
}

export const CLOCK_LOOK = {
  groundCap: false,
  band: false,
  mushrooms: false,
  bar: { color: 0xc82a1a, emissive: 0xff3a1a, glow: 1.1, tip: 1.2, tipColor: 0xffffff, flash: 1, line: 0xff3020, lineGlow: 4.4 },
  conveyor: { color: 0x7a9cff, glow: 1.3 },
  gate: ['#f1e9d6', '#2a52c8'],
  curb: ['#2a52c8', '#2448b8'],
  spinArrows: true,
  portalRing: (w) => w.std({ map: TX.brushed(), color: 0xc8954a, metalness: 0.8, roughness: 0.3 }),
  mats: (H) => {
    const side = () => bandify(H.std('w6panelSide', { map: panelSide(), roughness: 0.55, metalness: 0.1 }));
    const brass = () => H.std('w6brass', { map: TX.brushed(), color: 0xb5873c, roughness: 0.32, metalness: 0.8 });
    return {
      groundTop: () => H.std('w6plaza', { map: plazaTop(), color: 0xd6cab2, roughness: 0.32, metalness: 0.02 }),
      groundSide: side,
      blockTop: (col) => H.tint('w6tile', col, { map: tileTop(), roughness: 0.28, metalness: 0.02 }),
      blockSide: side,
      hazard: brass,
      spinnerSide: brass,
      spinnerTop: (col) => H.tint('w6tile', col, { map: tileTop(), roughness: 0.28, metalness: 0.02 }),
      plankSide: side,
      plankTop: () => H.std('w6ruler', { map: H.woodMap(), color: 0xf0e2c0, roughness: 0.5 }),
      beamSide: side,
      beamTop: () => H.std('w6deck', { map: H.woodMap(), color: 0x9a6a48, roughness: 0.6 }),
      swingSide: side,
      swingTop: () => H.std('w6deck', { map: H.woodMap(), color: 0x9a6a48, roughness: 0.6 }),
      crumble: () => H.std('w6crumble', { map: tileTop(), color: 0xd8c8b0, roughness: 0.6 }),
      trampTop: () => H.tint('w6tile', 0x2a52c8, { map: tileTop(), roughness: 0.28, metalness: 0.02 }),
      trampSide: brass,
      hubTop: brass,
      pillarSide: side,
      pillarTop: brass,
    };
  },
};

export function mechanismMaterial(cols) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        haze: { value: new THREE.Color(cols.haze) },
        deep: { value: new THREE.Color(cols.deep) },
        metal: { value: new THREE.Color(cols.metal) },
      },
    ]),
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
      uniform float time; uniform vec3 haze; uniform vec3 deep; uniform vec3 metal;
      varying vec3 vW;
      float h1(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float gear(vec2 p, vec2 c, float R, float N, float w, float ph, float layer){
        vec2 d = p - c;
        float r = length(d);
        float a = atan(d.y, d.x) - w * time + ph;
        float tooth = smoothstep(0.42, 0.5, abs(fract(a * N / 6.2831853) - 0.5) * 2.0 * 0.5 + 0.25);
        float edge = R + tooth * R * 0.09;
        float body = 1.0 - smoothstep(edge - 0.35, edge + 0.35, r);
        float spokes = smoothstep(0.32, 0.38, abs(sin((a) * 3.0)));
        float rim = smoothstep(R * 0.72, R * 0.76, r);
        float hub = 1.0 - smoothstep(R * 0.16, R * 0.2, r);
        float hole = (1.0 - rim) * (1.0 - hub) * spokes;
        return body * (1.0 - hole * 0.85);
      }
      void main(){
        vec2 p = vW.xz;
        float cell = 150.0;
        vec2 ci = floor(p / cell);
        float m = 0.0;
        float edge = 0.0;
        float hubs = 0.0;
        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 c0 = (ci + vec2(float(i), float(j))) * cell;
            float r0 = h1(c0 * 0.013);
            vec2 a = c0 + vec2(30.0 + r0 * 90.0, 40.0 + h1(c0 * 0.07) * 70.0);
            float R1 = 26.0 + r0 * 16.0;
            float N1 = floor(R1 * 0.75);
            float R2 = R1 * (0.45 + h1(c0 * 0.21) * 0.25);
            float N2 = floor(N1 * R2 / R1);
            float ang = h1(c0 * 0.33) * 6.2831;
            vec2 b = a + vec2(cos(ang), sin(ang)) * (R1 + R2 + R1 * 0.06);
            float w1 = 0.05;
            float g1 = gear(p, a, R1, N1, w1, 0.0, 0.0);
            float g2 = gear(p, b, R2, N2, -w1 * N1 / N2, 3.14159 / N2, 1.0);
            float gg = max(g1, g2);
            m = max(m, gg);
            float e1 = smoothstep(0.0, 0.5, g1) * (1.0 - smoothstep(0.5, 1.0, g1));
            float e2 = smoothstep(0.0, 0.5, g2) * (1.0 - smoothstep(0.5, 1.0, g2));
            edge = max(edge, max(e1, e2));
            hubs = max(hubs, max(1.0 - smoothstep(R1 * 0.08, R1 * 0.1, length(p - a)), 1.0 - smoothstep(R2 * 0.12, R2 * 0.15, length(p - b))));
          }
        }
        float soft = sin(p.x * 0.011 + 1.3) * sin(p.y * 0.008) * 0.5 + 0.5;
        vec3 base = mix(deep * 0.55, deep, soft);
        vec3 col = mix(base, metal, m);
        col += haze * 0.22 * edge + haze * 0.35 * hubs;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: true,
  });
}

function gearShape(R, N, spokes) {
  const s = new THREE.Shape();
  const n = N * 4;
  const r0 = R * 0.9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const q = i % 4;
    const rr = q === 1 || q === 2 ? R : r0;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const inner = R * 0.72;
  const hub = R * 0.2;
  for (let k = 0; k < spokes; k++) {
    const a0 = (k / spokes) * Math.PI * 2 + 0.22;
    const a1 = ((k + 1) / spokes) * Math.PI * 2 - 0.22;
    const h = new THREE.Path();
    h.moveTo(Math.cos(a0) * hub * 1.4, Math.sin(a0) * hub * 1.4);
    h.absarc(0, 0, inner, a0, a1, false);
    h.lineTo(Math.cos(a1) * hub * 1.4, Math.sin(a1) * hub * 1.4);
    h.closePath();
    s.holes.push(h);
  }
  return s;
}

function dialTex() {
  return canvasTex(
    'w6dial',
    256,
    (x, S) => {
      x.fillStyle = '#f6eedc';
      x.beginPath();
      x.arc(128, 128, 126, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#2a3a8a';
      x.lineWidth = 10;
      x.beginPath();
      x.arc(128, 128, 118, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 3;
      x.beginPath();
      x.arc(128, 128, 98, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = '#1e2a6a';
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const big = i % 5 === 0;
        x.save();
        x.translate(128 + Math.cos(a) * 107, 128 + Math.sin(a) * 107);
        x.rotate(a);
        x.fillRect(-(big ? 9 : 4), -(big ? 3.5 : 1.5), big ? 18 : 8, big ? 7 : 3);
        x.restore();
      }
      x.font = 'bold 30px serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      const R = ['XII', 'III', 'VI', 'IX'];
      R.forEach((t, i) => {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        x.fillText(t, 128 + Math.cos(a) * 74, 128 + Math.sin(a) * 74);
      });
    },
    false,
  );
}

function drumGeo() {
  const prof = [[0, 0], [1, 0], [1, -0.1], [0.97, -0.13], [0.97, -0.3], [0.86, -0.33], [0.86, -0.37], [0.8, -0.39], [0.8, -0.56], [0.66, -0.59], [0.66, -0.63], [0.58, -0.65], [0.58, -0.8], [0.4, -0.84], [0.34, -0.9], [0.14, -0.97], [0, -1]];
  const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const g = lathe.toNonIndexed();
  lathe.dispose();
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const walnut = new THREE.Color(0x4a2a1a);
  const brass = new THREE.Color(0xb88c48);
  const cream = new THREE.Color(0xe8dcc4);
  const c = new THREE.Color();
  for (let t = 0; t < pos.count; t += 3) {
    const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
    if (y > -0.11) c.copy(cream);
    else if ((y < -0.3 && y > -0.4) || (y < -0.56 && y > -0.66) || y < -0.8) c.copy(brass);
    else c.copy(walnut).multiplyScalar(0.75 + 0.25 * (1 + y));
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildClockwork(ctx) {
  const { world, g, T, R, rnd, updaters, clear, yAt, b, len, def } = ctx;
  const brassM = T(new THREE.MeshStandardMaterial({ map: TX.brushed(), color: 0xc08a40, metalness: 0.85, roughness: 0.3 }));
  const darkBrassM = T(new THREE.MeshStandardMaterial({ map: TX.brushed(), color: 0x7a5228, metalness: 0.85, roughness: 0.38 }));

  const sizes = [
    { N: 12, R: 2.4 },
    { N: 24, R: 4.8 },
    { N: 36, R: 7.2 },
  ];
  const geos = sizes.map((z) => {
    const ge = new THREE.ExtrudeGeometry(gearShape(z.R, z.N, z.N > 12 ? 6 : 4), { depth: 0.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1, curveSegments: 4 });
    ge.translate(0, 0, -0.45);
    ge.deleteAttribute('uv');
    const pos = ge.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) * 0.15;
      uv[i * 2 + 1] = pos.getY(i) * 0.15;
    }
    ge.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return T(ge);
  });
  const gears = [[], [], []];
  const trains = [];
  for (let i = 0, tries = 0; i < 12 && tries < 300; tries++) {
    const z = b.maxZ + 10 - (i / 12) * (len + 60) + R(-10, 10);
    const side = i % 2 ? 1 : -1;
    const x = side * R(44, 70);
    if (!clear(x, z, 16)) continue;
    const y = yAt(z) + R(-18, 2);
    const yaw = side > 0 ? -Math.PI / 2 + R(-0.25, 0.25) : Math.PI / 2 + R(-0.25, 0.25);
    const pick = [[2, 0, 1], [1, 0], [2, 1], [1, 0, 0]][i % 4];
    let cx = 0;
    let cy = 0;
    let w = 0.35 * (rnd() > 0.5 ? 1 : -1);
    let prev = null;
    const list = [];
    for (const k of pick) {
      const z0 = sizes[k];
      if (prev) {
        const ang = R(-0.9, 0.9) + (list.length % 2 ? Math.PI : 0) * 0;
        const d = prev.R + z0.R - prev.R * 0.06;
        cx += Math.cos(ang) * d;
        cy += Math.sin(ang) * d;
        w = (-w * prev.N) / z0.N;
      }
      const gi = { k, lx: cx, ly: cy, w, ph: prev ? Math.PI / z0.N : 0, N: z0.N, R: z0.R };
      list.push(gi);
      prev = z0;
    }
    trains.push({ x, y, z, yaw, list, view: null });
    for (const gi of list) gears[gi.k].push({ t: trains[trains.length - 1], gi });
    i++;
  }
  const gm = geos.map((ge, k) => {
    const im = new THREE.InstancedMesh(ge, k === 1 ? darkBrassM : brassM, Math.max(1, gears[k].length));
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(im);
    return im;
  });
  const axleG = T(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 12).rotateX(Math.PI / 2));
  const axCount = gears.reduce((n, l) => n + l.length, 0);
  const axles = new THREE.InstancedMesh(axleG, darkBrassM, Math.max(1, axCount));
  let ai = 0;
  for (const t of trains) {
    for (const gi of t.list) {
      _e.set(0, t.yaw, 0);
      _q.setFromEuler(_e);
      _p.set(gi.lx, gi.ly, 0).applyQuaternion(_q).add(_s.set(t.x, t.y, t.z));
      _m.compose(_p, _q, _s.setScalar(1));
      axles.setMatrixAt(ai++, _m);
    }
  }
  let frame = 0;
  updaters.push((t) => {
    frame++;
    if (frame % 2) return;
    for (let k = 0; k < 3; k++) {
      gears[k].forEach(({ t: tr, gi }, i) => {
        _e.set(0, tr.yaw, 0);
        _q.setFromEuler(_e);
        _p.set(gi.lx, gi.ly, 0).applyQuaternion(_q).add(_s.set(tr.x, tr.y, tr.z));
        const q2 = new THREE.Quaternion().setFromAxisAngle(_s.set(0, 0, 1), gi.w * t + gi.ph);
        _q.multiply(q2);
        _m.compose(_p, _q, _s.setScalar(1));
        gm[k].setMatrixAt(i, _m);
      });
      gm[k].instanceMatrix.needsUpdate = true;
    }
  });

  const towers = [];
  for (let i = 0, tries = 0; i < 6 && tries < 300; tries++) {
    const z = b.maxZ - 30 - (i / 6) * (len - 10) + R(-14, 14);
    const side = i % 2 ? -1 : 1;
    const x = side * R(62, 72);
    if (!clear(x, z, 14)) continue;
    const cy = yAt(z) + R(7, 11);
    const w = R(4.4, 5.4);
    towers.push({ x, z, w, cy, top: cy + w * 0.9, base: def.belowY - 2 });
    i++;
  }
  const bodyG = T(new THREE.BoxGeometry(1, 1, 1, 1, 30, 1).translate(0, 0.5, 0).toNonIndexed());
  {
    const pos = bodyG.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let t = 0; t < pos.count; t += 3) {
      const y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3;
      const row = Math.floor(y * 30);
      if (y < 0.55) c.set(0x3a2216).lerp(new THREE.Color(0x6a4430), y / 0.55);
      else if (row === 17 || row === 27) c.set(0x2a52c8);
      else c.set(0xcdbfa4).multiplyScalar(0.85 + 0.15 * (y - 0.55) / 0.45);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (t + k) * 3);
    }
    bodyG.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const bodyM = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05 }));
  const tb = new THREE.InstancedMesh(bodyG, bodyM, Math.max(1, towers.length));
  const capG = T(new THREE.BoxGeometry(1.18, 0.16, 1.18).translate(0, 0, 0));
  const caps = new THREE.InstancedMesh(capG, brassM, Math.max(1, towers.length * 2));
  const roofG = T(new THREE.ConeGeometry(0.8, 0.75, 4, 1).rotateY(Math.PI / 4).translate(0, 0.375, 0));
  const roofM = T(new THREE.MeshStandardMaterial({ color: 0x2a52c8, roughness: 0.3, metalness: 0.25 }));
  const roofs = new THREE.InstancedMesh(roofG, roofM, Math.max(1, towers.length));
  const faceG = T(new THREE.CircleGeometry(1, 48));
  const faceM = T(new THREE.MeshStandardMaterial({ map: dialTex(), emissiveMap: dialTex(), emissive: 0xfff2d8, emissiveIntensity: 0.7, roughness: 0.5 }));
  const faces = new THREE.InstancedMesh(faceG, faceM, Math.max(1, towers.length * 2));
  const handG = T(new THREE.BoxGeometry(1, 1, 0.08).translate(0, 0.42, 0));
  const handM = T(new THREE.MeshStandardMaterial({ color: 0x141a46, roughness: 0.35, metalness: 0.5 }));
  const hands = new THREE.InstancedMesh(handG, handM, Math.max(1, towers.length * 4));
  hands.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  towers.forEach((tw, i) => {
    _m.compose(_p.set(tw.x, tw.base, tw.z), _q.identity(), _s.set(tw.w, tw.top - tw.base, tw.w));
    tb.setMatrixAt(i, _m);
    _m.compose(_p.set(tw.x, tw.top, tw.z), _q.identity(), _s.set(tw.w, tw.w, tw.w));
    caps.setMatrixAt(i * 2, _m);
    _m.compose(_p.set(tw.x, tw.cy - tw.w * 0.62, tw.z), _q.identity(), _s.set(tw.w, tw.w, tw.w));
    caps.setMatrixAt(i * 2 + 1, _m);
    _m.compose(_p.set(tw.x, tw.top + 0.08, tw.z), _q.identity(), _s.set(tw.w * 1.3, tw.w * 1.2, tw.w * 1.3));
    roofs.setMatrixAt(i, _m);
    for (let k = 0; k < 2; k++) {
      _q.setFromAxisAngle(_p.set(0, 1, 0), k * Math.PI);
      _p.set(0, 0, tw.w / 2 + 0.02).applyQuaternion(_q).add(_s.set(tw.x, tw.cy, tw.z));
      _m.compose(_p, _q, _s.setScalar(tw.w * 0.42));
      faces.setMatrixAt(i * 2 + k, _m);
    }
  });
  for (const im of [tb, roofs, faces, hands]) {
    im.frustumCulled = false;
    g.add(im);
  }
  const _qy = new THREE.Quaternion();
  const _qz = new THREE.Quaternion();
  const _z = new THREE.Vector3(0, 0, 1);
  const _y = new THREE.Vector3(0, 1, 0);
  updaters.push(() => {
    const run = world.runClock ? world.runClock() : 0;
    const secA = (run / 60) * Math.PI * 2;
    const minA = (run / 600) * Math.PI * 2;
    towers.forEach((tw, i) => {
      for (let k = 0; k < 2; k++) {
        _qy.setFromAxisAngle(_y, k * Math.PI);
        [[secA, 0.92, 0.06, 0.08], [minA, 0.62, 0.1, 0.13]].forEach(([ang, L, wd, off], j) => {
          _qz.setFromAxisAngle(_z, -ang);
          _q.copy(_qy).multiply(_qz);
          _p.set(0, 0, tw.w / 2 + off).applyQuaternion(_qy).add(_s.set(tw.x, tw.cy, tw.z));
          _m.compose(_p, _q, _s.set(tw.w * wd, tw.w * 0.42 * L, 1));
          hands.setMatrixAt(i * 4 + k * 2 + j, _m);
        });
      }
    });
    hands.instanceMatrix.needsUpdate = true;
  });

  const dn = 220;
  const dPos = new Float32Array(dn * 3);
  const dSeed = new Float32Array(dn * 4);
  for (let i = 0; i < dn; i++) {
    dSeed[i * 4] = R(-36, 36);
    dSeed[i * 4 + 1] = R(-8, 18);
    dSeed[i * 4 + 2] = R(-36, 36);
    dSeed[i * 4 + 3] = rnd() * 40;
  }
  const dg = T(new THREE.BufferGeometry());
  dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dm = T(new THREE.PointsMaterial({ map: TX.sprite('glow'), color: 0xffe2b0, size: 0.22, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  const motes = new THREE.Points(dg, dm);
  motes.frustumCulled = false;
  g.add(motes);
  updaters.push((t) => {
    const c = world.camera ? world.camera.position : _p.set(0, 0, 0);
    for (let i = 0; i < dn; i++) {
      const s = dSeed[i * 4 + 3];
      dPos[i * 3] = dSeed[i * 4] + Math.sin(t * 0.13 + s) * 1.6;
      dPos[i * 3 + 1] = dSeed[i * 4 + 1] + Math.sin(t * 0.21 + s * 1.3) * 0.8;
      dPos[i * 3 + 2] = dSeed[i * 4 + 2] + Math.cos(t * 0.11 + s * 0.7) * 1.6;
    }
    motes.position.set(Math.round(c.x / 24) * 24, Math.round(c.y / 8) * 8, Math.round(c.z / 24) * 24);
    dg.attributes.position.needsUpdate = true;
  });

  const spinners = world.colliders.filter((c) => c.style === 'spinner' && c.shape === 'cyl');
  if (spinners.length) {
    const teeth = T(new THREE.ExtrudeGeometry(gearShape(1, 22, 0), { depth: 0.5, bevelEnabled: false, curveSegments: 2 }));
    teeth.rotateX(Math.PI / 2);
    teeth.translate(0, 0.25, 0);
    const tm = new THREE.InstancedMesh(teeth, brassM, spinners.length);
    tm.frustumCulled = false;
    tm.receiveShadow = true;
    tm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(tm);
    updaters.push(() => {
      tm.visible = spinners.some((c) => world.window === null || world.inWindow(world.viewOf(c.spec)));
      if (!tm.visible) return;
      spinners.forEach((c, i) => {
        const vis = world.window === null || world.inWindow(world.viewOf(c.spec)) ? 1 : 0;
        _e.set(0, c.yaw, 0);
        _q.setFromEuler(_e);
        _m.compose(_p.set(c.x, c.y - 0.05, c.z), _q, _s.set((c.r + 0.1) * vis, 0.82 * vis, (c.r + 0.1) * vis));
        tm.setMatrixAt(i, _m);
      });
      tm.instanceMatrix.needsUpdate = true;
    });
  }
  const pistons = world.colliders.filter((c) => c.spec && c.spec.piston);
  if (pistons.length) {
    const rodG = T(new THREE.CylinderGeometry(0.32, 0.32, 1, 14).translate(0, -0.5, 0));
    const sleeveG = T(new THREE.CylinderGeometry(0.62, 0.7, 1, 16).translate(0, -0.5, 0));
    const rods = new THREE.InstancedMesh(rodG, T(new THREE.MeshStandardMaterial({ color: 0xd8dce4, metalness: 0.9, roughness: 0.18 })), pistons.length);
    const sleeves = new THREE.InstancedMesh(sleeveG, darkBrassM, pistons.length);
    for (const im of [rods, sleeves]) {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      g.add(im);
    }
    updaters.push(() => {
      rods.visible = sleeves.visible = pistons.some((c) => world.window === null || world.inWindow(world.viewOf(c.spec)));
      if (!rods.visible) return;
      pistons.forEach((c, i) => {
        const vis = world.window === null || world.inWindow(world.viewOf(c.spec)) ? 1 : 0;
        const base = c.base.y - c.hy - 2.2;
        _m.compose(_p.set(c.x, c.y - c.hy, c.z), _q.identity(), _s.set(vis, Math.max(0.01, c.y - c.hy - base) * vis, vis));
        rods.setMatrixAt(i, _m);
        _m.compose(_p.set(c.x, base, c.z), _q.identity(), _s.set(vis, 7 * vis, vis));
        sleeves.setMatrixAt(i, _m);
      });
      rods.instanceMatrix.needsUpdate = true;
      sleeves.instanceMatrix.needsUpdate = true;
    });
  }

  const tramps = world.colliders.filter((c) => c.style === 'tramp' && c.obj);
  if (tramps.length) {
    for (const c of tramps) c.obj.children.forEach((o) => {
      if (o.geometry && o.geometry.type === 'CylinderGeometry') o.visible = false;
    });
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const a = t * Math.PI * 2 * 5;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.62, -t * 1.5, Math.sin(a) * 0.62));
    }
    const coil = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.09, 6, false);
    const plate = new THREE.CylinderGeometry(0.85, 0.95, 0.16, 20).translate(0, -1.55, 0);
    const parts = [coil.toNonIndexed(), plate.toNonIndexed()];
    for (const p of parts) p.deleteAttribute('uv');
    const sg = T(mergeGeometries(parts, false));
    for (const p of [coil, plate, ...parts]) p.dispose();
    const springs = new THREE.InstancedMesh(sg, brassM, tramps.length);
    springs.frustumCulled = false;
    springs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(springs);
    updaters.push(() => {
      springs.visible = tramps.some((c) => world.window === null || world.inWindow(world.viewOf(c.spec)));
      if (!springs.visible) return;
      tramps.forEach((c, i) => {
        const sq = c.obj.scale.y;
        _m.compose(_p.set(c.x, c.y - c.hy * sq, c.z), _q.identity(), _s.set(c.r / 2, 0.85 + (sq - 1) * 2, c.r / 2));
        springs.setMatrixAt(i, _m);
      });
      springs.instanceMatrix.needsUpdate = true;
    });
  }
  const unders = g.children.find((o) => o.isInstancedMesh && o.material && o.material.flatShading);
  if (unders) {
    unders.geometry = T(drumGeo());
    unders.material = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.35, map: TX.brushed() }));
  }
  const face = world.coinMesh && Array.isArray(world.coinMesh.material) ? world.coinMesh.material[1] : null;
  if (face) face.emissiveIntensity = 2.0;
}
