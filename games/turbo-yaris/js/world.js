import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';
import { createDriver } from './assets.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) { s += amp * vnoise(x * f, z * f); f *= 2.03; amp *= 0.5; }
  return s;
}

export const coastX = z => 330 + 25 * Math.sin(z * 0.012) + 10 * Math.sin(z * 0.031);
const WATER_Y = -1.2;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = `
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bottom;
uniform vec3 glowColor;
uniform vec3 glowDir;
uniform float starAmt;
varying vec3 vDir;
float h21(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(mid, bottom, pow(clamp(-h, 0.0, 1.0), 0.35));
  float g = max(dot(d, normalize(glowDir)), 0.0);
  c += glowColor * (pow(g, 8.0) * 0.6 + pow(g, 400.0) * 3.0);
  if (starAmt > 0.0 && h > 0.05) {
    vec3 q = floor(d * 260.0);
    float s = h21(q);
    float tw = step(0.9965, s) * smoothstep(0.05, 0.4, h);
    c += vec3(tw) * starAmt * (0.6 + 0.4 * fract(s * 91.7));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

function scaledSky(scale) {
  const sky = new Sky();
  sky.material.uniforms.skyScale = { value: scale };
  sky.material.fragmentShader = 'uniform float skyScale;\n' + sky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor * skyScale, vec3( 1.2 ) ), 1.0 );');
  return sky;
}

function gradientSky(top, mid, bottom, glowColor, glowDir, stars) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(top) },
      mid: { value: new THREE.Color(mid) },
      bottom: { value: new THREE.Color(bottom) },
      glowColor: { value: new THREE.Color(glowColor) },
      glowDir: { value: glowDir.clone() },
      starAmt: { value: stars }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), m);
  mesh.scale.setScalar(3000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

const WATER_FRAG = `
uniform float time;
uniform vec3 sunDir;
uniform vec3 deep;
uniform vec3 shallow;
uniform vec3 skyTop;
uniform vec3 skyHor;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec3 vW;
float coast(float z) { return 330.0 + 25.0 * sin(z * 0.012) + 10.0 * sin(z * 0.031); }
vec2 wave(vec2 p, vec2 d, float f, float s, float a) { float ph = dot(d, p) * f + time * s; return d * cos(ph) * a * f; }
void main() {
  vec2 p = vW.xz;
  vec2 g = vec2(0.0);
  g += wave(p, normalize(vec2(1.0, 0.3)), 0.09, 1.1, 1.2);
  g += wave(p, normalize(vec2(-0.4, 1.0)), 0.13, 1.5, 0.8);
  g += wave(p, normalize(vec2(0.7, -0.8)), 0.31, 2.3, 0.35);
  g += wave(p, normalize(vec2(-0.9, -0.2)), 0.57, 3.1, 0.18);
  g += wave(p, normalize(vec2(0.2, 0.9)), 1.13, 4.3, 0.08);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vW);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(skyHor, skyTop, clamp(r.y * 1.8, 0.0, 1.0));
  float sd = coast(p.y) - p.x;
  float sh = smoothstep(-70.0, -12.0, sd);
  vec3 col = mix(deep, shallow, sh);
  col = mix(col, sky, clamp(fres * 0.9, 0.0, 1.0));
  float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0) * 5.0;
  col += vec3(1.0, 0.95, 0.85) * spec;
  float foamBand = smoothstep(-20.0, -13.5, sd) * (1.0 - smoothstep(-13.5, -11.0, sd));
  float foam = foamBand * (0.55 + 0.45 * sin(sd * 1.4 - time * 2.2 + sin(p.y * 0.2) * 2.0));
  col = mix(col, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0) * 0.85);
  float alpha = mix(0.55, 0.96, 1.0 - sh * 0.7);
  alpha = max(alpha, foam * 0.9);
  float dist = length(cameraPosition - vW);
  col = mix(col, fogColor, smoothstep(fogNear, fogFar, dist));
  gl_FragColor = vec4(col, alpha);
}`;

const WATER_VERT = `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function inst(geo, mat, list, { cast = true, receive = false, colors = null } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((m, i) => {
    im.setMatrixAt(i, m);
    if (colors) im.setColorAt(i, colors[i]);
  });
  im.count = list.length;
  im.castShadow = cast;
  im.receiveShadow = receive;
  return im;
}

function mat4(x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, 'YXZ'));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

const lin = v => Math.pow(Math.max(0, v), 2.2);

function colorize(geo, fn) {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const col = fn(p.getX(i), p.getY(i), p.getZ(i));
    c[i * 3] = lin(col[0]); c[i * 3 + 1] = lin(col[1]); c[i * 3 + 2] = lin(col[2]);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function strip(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

function palmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.22, 0.36, 9, 8, 12);
  trunk.translate(0, 4.5, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.pow(y / 9, 2) * 1.6);
  }
  trunk.computeVertexNormals();
  colorize(trunk, (x, y) => {
    const ring = (Math.sin(y * 7) * 0.5 + 0.5) * 0.12;
    return [0.45 - ring, 0.3 - ring * 0.8, 0.17 - ring * 0.5];
  });
  const nuts = [];
  for (let k = 0; k < 3; k++) {
    const s = new THREE.SphereGeometry(0.22, 6, 5);
    s.translate(1.6 + Math.cos(k * 2.1) * 0.3, 8.7, Math.sin(k * 2.1) * 0.3);
    colorize(s, () => [0.3, 0.2, 0.08]);
    nuts.push(strip(s));
  }
  const trunkGeo = mergeGeometries([strip(trunk), ...nuts]);
  const leaves = [];
  const count = 8;
  for (let k = 0; k < count; k++) {
    const leaf = new THREE.PlaneGeometry(1.3, 5, 2, 8);
    const lp = leaf.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i), y = lp.getY(i) + 2.5;
      const t = y / 5;
      const w = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * (1 - t * 0.4);
      lp.setXYZ(i, x * w, -Math.pow(t, 1.8) * 2.6 + Math.abs(x) * 0.35, y);
    }
    leaf.computeVertexNormals();
    colorize(leaf, (x, y, z) => { const t = z / 5; return [0.16 + t * 0.12, 0.5 + t * 0.15 - Math.abs(x) * 0.1, 0.12]; });
    const tilt = 0.25 + (k % 2) * 0.2;
    leaf.rotateX(-tilt);
    leaf.rotateY((k / count) * Math.PI * 2 + (k % 2) * 0.2);
    leaf.translate(1.6, 9, 0);
    leaves.push(strip(leaf));
  }
  return { trunkGeo, leafGeo: mergeGeometries(leaves) };
}

function treeGeometries(seed, colA, colB) {
  const r = T.rng(seed);
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6);
  trunk.translate(0, 1.6, 0);
  colorize(trunk, () => [0.36, 0.24, 0.14]);
  const blobs = [];
  for (let k = 0; k < 4; k++) {
    const b = new THREE.IcosahedronGeometry(1.5 + r() * 0.9, 1);
    const bp = b.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const f = 1 + (hash2(bp.getX(i) * 3.1 + k, bp.getZ(i) * 2.7) - 0.5) * 0.25;
      bp.setXYZ(i, bp.getX(i) * f, bp.getY(i) * f, bp.getZ(i) * f);
    }
    b.translate((r() - 0.5) * 2, 3.8 + r() * 1.6, (r() - 0.5) * 2);
    b.computeVertexNormals();
    colorize(b, (x, y) => { const t = Math.min(1, Math.max(0, (y - 2.5) / 4)); return [colA[0] + (colB[0] - colA[0]) * t, colA[1] + (colB[1] - colA[1]) * t, colA[2] + (colB[2] - colA[2]) * t]; });
    blobs.push(strip(b));
  }
  return { trunk: strip(trunk), crown: mergeGeometries(blobs) };
}

function bakeEnv(pmrem, envScene, sigma, near, far) {
  const rt = pmrem.fromScene(envScene, sigma, near, far);
  envScene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt;
}

export function buildWorld(track, renderer, scene, trackVisual) {
  const theme = track.def.theme;
  const group = new THREE.Group();
  scene.add(group);
  const updaters = [];
  const pmrem = new THREE.PMREMGenerator(renderer);
  const W = track.halfWall;
  const b = track.bounds;
  const cx = b.cx, cz = b.cz;

  let sunDir;
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target, hemi);

  let envRT;
  let fogCol;
  if (theme === 'beach') {
    sunDir = new THREE.Vector3(0.62, 0.52, -0.58).normalize();
    const sky = scaledSky(0.42);
    sky.scale.setScalar(4500);
    const u = sky.material.uniforms;
    u.turbidity.value = 2.2;
    u.rayleigh.value = 1.3;
    u.mieCoefficient.value = 0.0022;
    u.mieDirectionalG.value = 0.78;
    u.sunPosition.value.copy(sunDir);
    u.cloudCoverage.value = 0.38;
    u.cloudDensity.value = 0.5;
    u.cloudScale.value = 0.00025;
    group.add(sky);
    updaters.push((dt, time) => { u.time.value = time; });
    const envScene = new THREE.Scene();
    const sky2 = scaledSky(0.42);
    sky2.scale.setScalar(100);
    sky2.material.uniforms.sunPosition.value.copy(sunDir);
    sky2.material.uniforms.turbidity.value = 2.2;
    sky2.material.uniforms.rayleigh.value = 1.3;
    sky2.material.uniforms.cloudCoverage.value = 0.2;
    envScene.add(sky2);
    const g = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x9a8f6a }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -3;
    envScene.add(g);
    envRT = bakeEnv(pmrem, envScene, 0.02, 0.1, 100);
    fogCol = new THREE.Color(0xc6dcef);
    scene.fog = new THREE.Fog(fogCol, 380, 1600);
    sun.color.setHex(0xfff0dc);
    sun.intensity = 3.2;
    hemi.color.setHex(0xcfe6ff);
    hemi.groundColor.setHex(0x8a7a52);
    hemi.intensity = 1.1;
    scene.environmentIntensity = 0.8;
  } else if (theme === 'neon') {
    sunDir = new THREE.Vector3(-0.4, 0.75, 0.5).normalize();
    group.add(gradientSky(0x050314, 0x3a1060, 0x0c0616, 0xff3fbf, new THREE.Vector3(0.2, 0.05, -1), 1.4));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 2.4), fog: false, toneMapped: false }));
    moon.position.set(cx - 900, 700, cz + 1100);
    moon.lookAt(cx, 0, cz);
    group.add(moon);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x07050f);
    const panel = (col, x, y, z, w, h, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    panel(0xff2bd6, 40, 10, 10, 30, 8, 6);
    panel(0x00e5ff, -40, 14, -8, 34, 7, 6);
    panel(0xff8a1f, 8, 18, 40, 20, 6, 5);
    panel(0x7a5bff, -12, 30, -40, 40, 6, 4);
    panel(0xffffff, 0, 45, 0, 30, 30, 1.2);
    panel(0x00e5ff, 30, 6, -35, 12, 12, 4);
    panel(0xff2bd6, -30, 6, 35, 12, 12, 4);
    envRT = bakeEnv(pmrem, envScene, 0.03, 0.1, 100);
    fogCol = new THREE.Color(0x1e0c34);
    scene.fog = new THREE.Fog(fogCol, 120, 900);
    sun.color.setHex(0x9fb4ff);
    sun.intensity = 1.1;
    hemi.color.setHex(0x6a4ad0);
    hemi.groundColor.setHex(0x120a20);
    hemi.intensity = 1.2;
    scene.environmentIntensity = 1.0;
  } else {
    sunDir = new THREE.Vector3(0.5, 0.6, -0.62).normalize();
    group.add(gradientSky(0x6fb6ff, 0xffd6f0, 0xffc2e2, 0xfff2b0, sunDir, 0));
    const envScene = new THREE.Scene();
    envScene.add(gradientSky(0x8cc6ff, 0xffe0f4, 0xd8a8ff, 0xffffff, sunDir, 0));
    envScene.children[0].scale.setScalar(50);
    envRT = bakeEnv(pmrem, envScene, 0.02, 0.1, 100);
    fogCol = new THREE.Color(0xffd8ef);
    scene.fog = new THREE.Fog(fogCol, 240, 1200);
    sun.color.setHex(0xfff4e8);
    sun.intensity = 3.0;
    hemi.color.setHex(0xffe8f8);
    hemi.groundColor.setHex(0x9a7ad0);
    hemi.intensity = 1.2;
    scene.environmentIntensity = 0.9;
  }
  scene.environment = envRT.texture;
  pmrem.dispose();

  const terrainInfo = buildTerrain(track, theme, group);

  const r = T.rng(theme === 'beach' ? 101 : theme === 'neon' ? 202 : 303);
  const nearTrack = (x, z) => track.nearest(x, z, 90).d;
  const terrainH = (x, z) => terrainInfo.height(x, z);

  if (theme === 'beach') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunDir: { value: sunDir },
        deep: { value: new THREE.Color(0x06506e) },
        shallow: { value: new THREE.Color(0x2fd3c8) },
        skyTop: { value: new THREE.Color(0x3f86d8) },
        skyHor: { value: new THREE.Color(0xcfe4f4) },
        fogColor: { value: fogCol },
        fogNear: { value: 400 },
        fogFar: { value: 2200 }
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, WATER_Y, cz);
    water.renderOrder = 1;
    group.add(water);
    updaters.push((dt, time) => { water.material.uniforms.time.value = time; });

    const { trunkGeo, leafGeo } = palmGeometries();
    const palms = [];
    for (let n = 0; n < 2600 && palms.length < 240; n++) {
      const x = cx + (r() - 0.5) * 760, z = cz + (r() - 0.5) * 760;
      const sd = coastX(z) - x;
      const d = nearTrack(x, z);
      const nearOk = d > W + 6 && d < W + 34 && r() < 0.35;
      const beachOk = sd > 4 && sd < 42 && d > W + 6;
      if (!nearOk && !beachOk) continue;
      const s = 0.8 + r() * 0.5;
      palms.push(mat4(x, terrainH(x, z) - 0.2, z, r() * Math.PI * 2, s, s * (0.85 + r() * 0.3), s));
    }
    const trunkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    group.add(inst(trunkGeo, trunkMat, palms), inst(leafGeo, leafMat, palms));

    const tg = treeGeometries(7, [0.18, 0.42, 0.12], [0.36, 0.66, 0.2]);
    const trees = [];
    for (let n = 0; n < 3000 && trees.length < 260; n++) {
      const x = cx + (r() - 0.5) * 900, z = cz + (r() - 0.5) * 900;
      const sd = coastX(z) - x;
      const d = nearTrack(x, z);
      if (sd < 70 || d < W + 12) continue;
      const s = 0.9 + r() * 0.8;
      trees.push(mat4(x, terrainH(x, z) - 0.3, z, r() * 6.28, s));
    }
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    group.add(inst(tg.trunk, vc, trees), inst(tg.crown, vc, trees));

    const umb = [];
    const umbCols = [];
    const palette = [0xff4a4a, 0xffd23b, 0x3b8bff, 0xff7ad9, 0x3bdc6a, 0xff8a1f];
    for (let n = 0; n < 400 && umb.length < 34; n++) {
      const z = cz + (r() - 0.5) * 700;
      const x = coastX(z) - 6 - r() * 26;
      if (nearTrack(x, z) < W + 8) continue;
      umb.push(mat4(x, terrainH(x, z), z, r() * 6.28, 1, 1, 1, (r() - 0.5) * 0.2));
      umbCols.push(new THREE.Color(palette[Math.floor(r() * palette.length)]));
    }
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5);
    pole.translate(0, 1.3, 0);
    const canopy = new THREE.ConeGeometry(1.7, 0.7, 10, 1, true);
    canopy.translate(0, 2.55, 0);
    group.add(inst(pole, new THREE.MeshStandardMaterial({ color: 0xffffff }), umb));
    group.add(inst(canopy, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), umb, { colors: umbCols }));
    const towel = new THREE.BoxGeometry(1, 0.05, 1.9);
    const towels = umb.map((m, i) => new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(1.6, 0.05, 0.3)));
    group.add(inst(towel, new THREE.MeshStandardMaterial({ roughness: 0.9 }), towels, { colors: umbCols.map(c => c.clone().offsetHSL(0.3, 0, 0)), cast: false }));

    const rocks = [];
    for (let n = 0; n < 500 && rocks.length < 70; n++) {
      const z = cz + (r() - 0.5) * 900;
      const x = coastX(z) - 16 + (r() - 0.5) * 10;
      const s = 0.8 + r() * 2.4;
      rocks.push(mat4(x, WATER_Y - 0.2, z, r() * 6, s, s * 0.7, s));
    }
    group.add(inst(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95, flatShading: true }), rocks));

    const lh = lighthouse();
    const lz = cz - 330;
    lh.position.set(coastX(lz) - 10, terrainH(coastX(lz) - 10, lz), lz);
    group.add(lh);
    for (let k = 0; k < 6; k++) {
      const boat = sailboat(k);
      const z = cz + (k - 2.5) * 140 + r() * 40;
      boat.position.set(coastX(z) + 70 + r() * 260, WATER_Y, z);
      boat.rotation.y = r() * 6.28;
      group.add(boat);
      const ph = r() * 6;
      updaters.push((dt, time) => { boat.position.y = WATER_Y + Math.sin(time * 1.3 + ph) * 0.18; boat.rotation.z = Math.sin(time * 1.1 + ph) * 0.06; });
    }
  }

  if (theme === 'neon') buildCity(track, group, r);
  if (theme === 'candy') buildCandy(track, group, r, terrainH, updaters);

  const robots = [];
  const robotColors = [0x3bd1ff, 0xff4fa8, 0xffd23b, 0x7cff5b];
  const clips = ['Dance', 'Wave', 'Dance', 'ThumbsUp'];
  (trackVisual.standSpots || []).slice(0, 4).forEach((sp, n) => {
    const rb = createDriver(robotColors[n % 4], clips[n % 4], 2.1);
    rb.holder.position.set(sp.x, sp.y, sp.z);
    rb.holder.rotation.y = sp.yaw;
    group.add(rb.holder);
    robots.push(rb);
  });
  updaters.push(dt => robots.forEach(rb => rb.update(dt)));

  return {
    group,
    sun,
    sunDir,
    theme,
    envRT,
    update(dt, time, focus) {
      sun.position.copy(focus).addScaledVector(sunDir, 150);
      sun.target.position.copy(focus);
      updaters.forEach(u => u(dt, time));
    },
    dispose() {
      scene.remove(group, sun, sun.target, hemi);
      envRT.dispose();
      sun.shadow.dispose();
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  };
}

function buildTerrain(track, theme, group) {
  const W = track.halfWall;
  const b = track.bounds;
  const cx = b.cx, cz = b.cz;
  if (theme === 'neon') {
    const tex = cityGroundTexture();
    tex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: tex, color: 0x9a9ab0, roughness: 0.55, metalness: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, -0.3, cz);
    ground.receiveShadow = true;
    group.add(ground);
    return { height: () => -0.3 };
  }
  const size = 1500, seg = 230;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const baseH = (x, z) => {
    if (theme === 'beach') {
      const sd = coastX(z) - x;
      if (sd < 0) return Math.max(-7, -0.3 + sd * 0.1);
      const inland = smooth(0, 160, sd);
      const hills = (fbm(x * 0.006, z * 0.006) - 0.35) * 26 * inland;
      const dc = Math.hypot(x - cx, z - cz);
      const mtn = Math.max(0, dc - 420) * 0.32 * smooth(80, 260, sd) * (0.6 + fbm(x * 0.01, z * 0.01));
      return Math.max(0.15 * smooth(0, 20, sd) - 0.3 * (1 - smooth(0, 20, sd)), hills) + mtn;
    }
    const hills = (fbm(x * 0.008, z * 0.008) - 0.3) * 34;
    const dc = Math.hypot(x - cx, z - cz);
    return hills + Math.max(0, dc - 380) * 0.4 * (0.5 + fbm(x * 0.012, z * 0.012));
  };
  const heights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    const n = track.nearest(x, z, 80);
    const base = baseH(x, z);
    let h = base;
    if (n.i >= 0) {
      const near = track.py[n.i] - 0.45;
      const t = smooth(W + 4, W + 48, n.d);
      h = near + (base - near) * t;
      if (n.d < W + 6) h = Math.min(h, near);
    }
    heights[i] = h;
    pos.setY(i, h);
    let c;
    const nz = fbm(x * 0.05, z * 0.05);
    if (theme === 'beach') {
      const sd = coastX(z) - x;
      const grassA = [0.3 + nz * 0.12, 0.58 + nz * 0.12, 0.2];
      const sand = [0.93, 0.83, 0.6];
      const wet = [0.66, 0.56, 0.4];
      const s = 1 - smooth(34, 62, sd);
      c = [grassA[0] + (sand[0] - grassA[0]) * s, grassA[1] + (sand[1] - grassA[1]) * s, grassA[2] + (sand[2] - grassA[2]) * s];
      if (sd < 3) { const w2 = smooth(3, -6, sd); c = [c[0] + (wet[0] - c[0]) * w2, c[1] + (wet[1] - c[1]) * w2, c[2] + (wet[2] - c[2]) * w2]; }
      if (h > 22) { const m = smooth(22, 45, h); c = [c[0] + (0.5 - c[0]) * m, c[1] + (0.47 - c[1]) * m, c[2] + (0.42 - c[2]) * m]; }
    } else {
      const band = Math.sin(x * 0.02 + fbm(x * 0.01, z * 0.01) * 6) * 0.5 + 0.5;
      const mint = [0.6, 0.9, 0.66], pink = [1.0, 0.72, 0.86];
      const t = smooth(0.55, 0.75, band);
      c = [mint[0] + (pink[0] - mint[0]) * t, mint[1] + (pink[1] - mint[1]) * t, mint[2] + (pink[2] - mint[2]) * t];
      c = c.map(v => v * (0.9 + nz * 0.2));
      if (h > 30) { const m = smooth(30, 60, h); c = [c[0] + (1 - c[0]) * m, c[1] + (0.97 - c[1]) * m, c[2] + (1 - c[2]) * m]; }
    }
    col[i * 3] = lin(c[0]); col[i * 3 + 1] = lin(c[1]); col[i * 3 + 2] = lin(c[2]);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const nt = T.noiseTexture(21, 256, 90);
  nt.repeat.set(120, 120);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: nt, roughness: 0.95 }));
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  group.add(mesh);
  const step = size / seg;
  const height = (x, z) => {
    const gx = (x - cx + size / 2) / step, gz = (z - cz + size / 2) / step;
    const ix = Math.max(0, Math.min(seg - 1, Math.floor(gx))), iz = Math.max(0, Math.min(seg - 1, Math.floor(gz)));
    const fx = gx - ix, fz = gz - iz;
    const h00 = heights[iz * (seg + 1) + ix], h10 = heights[iz * (seg + 1) + ix + 1];
    const h01 = heights[(iz + 1) * (seg + 1) + ix], h11 = heights[(iz + 1) * (seg + 1) + ix + 1];
    return h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
  };
  return { height };
}

function cityGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1c24';
  g.fillRect(0, 0, 256, 256);
  const r = T.rng(8);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(120,130,170,0.25)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.lineWidth = 1;
  g.strokeRect(20, 20, 216, 216);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function lighthouse() {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#f4f4f4' : '#d8232a'; x.fillRect(0, i * 256 / 6, 64, 256 / 6); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.6, 22, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  tower.position.y = 11;
  const room = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 2.6, 16), new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe28a, emissiveIntensity: 0.8, roughness: 0.1 }));
  room.position.y = 23.3;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 }));
  cap.position.y = 25.8;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  deck.position.y = 22;
  [tower, room, cap, deck].forEach(m => { m.castShadow = true; g.add(m); });
  return g;
}

function sailboat(k) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1, 6, 2, 0.4), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xffffff : 0x2255aa, roughness: 0.4 }));
  hull.position.y = 0.3;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  mast.position.y = 4;
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0); sailShape.lineTo(0, 6); sailShape.lineTo(2.6, 0.2); sailShape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: [0xffffff, 0xffd23b, 0xff5a5a][k % 3], side: THREE.DoubleSide, roughness: 0.8 }));
  sail.position.set(0, 1.2, 0.2);
  sail.rotation.y = Math.PI / 2;
  g.add(hull, mast, sail);
  return g;
}

function buildCity(track, group, r) {
  const W = track.halfWall;
  const b = track.bounds;
  const palettes = [
    ['#ffcf6a', '#ffe7a8', '#ffb347'],
    ['#4af0ff', '#9ffcff', '#3aa8ff'],
    ['#ff5ad9', '#ff9bea', '#b36bff']
  ];
  const mats = palettes.map((p, k) => {
    const t = T.windowTexture(50 + k, p);
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.5, metalness: 0.3 });
  });
  const variants = [[16, 34, 16], [18, 56, 18], [14, 80, 14], [22, 26, 20], [16, 110, 16], [24, 44, 16]];
  const geos = variants.map(([w, h, d]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    const nrm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ny = nrm.getY(i);
      if (Math.abs(ny) > 0.5) { uv.setXY(i, 0.005, 0.005); continue; }
      const across = Math.abs(nrm.getX(i)) > 0.5 ? d : w;
      uv.setXY(i, uv.getX(i) * across / 20, uv.getY(i) * h / 56);
    }
    return g;
  });
  const buckets = variants.map(() => mats.map(() => []));
  const signs = [], signCols = [];
  const neonCols = [0xff2bd6, 0x00e5ff, 0xffb31a, 0x7a5bff, 0x39ff88];
  const step = 30;
  for (let x = b.minX - 260; x <= b.maxX + 260; x += step) {
    for (let z = b.minZ - 260; z <= b.maxZ + 260; z += step) {
      const px = x + (r() - 0.5) * 8, pz = z + (r() - 0.5) * 8;
      const n = track.nearest(px, pz, 90);
      if (n.d < W + 17) continue;
      const far = n.i < 0 ? 1 : 0;
      let v = Math.floor(r() * variants.length);
      if (far && r() < 0.6) v = [1, 2, 4][Math.floor(r() * 3)];
      if (!far && n.d < W + 30 && r() < 0.5) v = [0, 3, 5][Math.floor(r() * 3)];
      const mi = Math.floor(r() * mats.length);
      const yaw = Math.round(r() * 4) * Math.PI / 2;
      buckets[v][mi].push(mat4(px, -0.3, pz, yaw));
      if (!far && r() < 0.55) {
        const [bw, bh] = variants[v];
        const i = n.i;
        const dx = track.px[i] - px, dz = track.pz[i] - pz;
        const faceYaw = Math.atan2(dx, dz);
        const snapped = Math.round((faceYaw - yaw) / (Math.PI / 2)) * (Math.PI / 2) + yaw;
        const off = bw / 2 + 0.3;
        const sx = px + Math.sin(snapped) * off, sz = pz + Math.cos(snapped) * off;
        const sh = Math.min(bh - 4, 8 + r() * 14);
        signs.push(mat4(sx, sh, sz, snapped, 5 + r() * 5, 1.6 + r() * 1.6, 1));
        signCols.push(new THREE.Color(neonCols[Math.floor(r() * neonCols.length)]).multiplyScalar(2.6));
      }
    }
  }
  buckets.forEach((row, v) => row.forEach((list, mi) => {
    if (!list.length) return;
    const im = inst(geos[v], mats[mi], list, { cast: true, receive: true });
    group.add(im);
  }));
  const signGeo = new THREE.PlaneGeometry(1, 1);
  group.add(inst(signGeo, new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }), signs, { colors: signCols, cast: false }));

  const lampPoles = [], lampHeads = [], pools = [], poolCols = [];
  const warm = new THREE.Color(0xffc27a), cyan = new THREE.Color(0x7ae8ff);
  for (let i = 0; i < track.N; i += 15) {
    for (const side of [-1, 1]) {
      if ((i / 15) % 2 === (side > 0 ? 1 : 0)) continue;
      const lat = side * (W + 1.6);
      const x = track.px[i] + track.rx[i] * lat, z = track.pz[i] + track.rz[i] * lat, y = track.py[i];
      const yaw = Math.atan2(-side * track.rx[i], -side * track.rz[i]);
      lampPoles.push(mat4(x, y, z, yaw));
      lampHeads.push(mat4(x, y, z, yaw));
      const pl = side * (track.halfRoad - 3.2);
      pools.push(mat4(track.px[i] + track.rx[i] * pl, y + 0.09, track.pz[i] + track.rz[i] * pl, 0));
      poolCols.push((i / 15) % 4 < 2 ? warm : cyan);
    }
  }
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.12, 0.16, 8, 6).translate(0, 4, 0),
    new THREE.BoxGeometry(0.14, 0.14, 3.6).translate(0, 7.9, 1.7)
  ]);
  const headGeo = new THREE.BoxGeometry(0.6, 0.18, 1.2).translate(0, 7.78, 3.3);
  group.add(inst(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2c38, metalness: 0.7, roughness: 0.4 }), lampPoles));
  group.add(inst(headGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.7, 2.2), toneMapped: false }), lampHeads, { cast: false }));
  const poolGeo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: T.radialTexture('rgba(255,255,255,0.55)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
  group.add(inst(poolGeo, poolMat, pools, { colors: poolCols, cast: false }));

  const pillars = [];
  for (let i = 0; i < track.N; i += 7) {
    if (track.py[i] < 1.2) continue;
    for (const side of [-1, 1]) {
      const lat = side * (track.halfRoad - 1);
      pillars.push(mat4(track.px[i] + track.rx[i] * lat, 0, track.pz[i] + track.rz[i] * lat, track.head[i], 1, track.py[i], 1));
    }
  }
  if (pillars.length) {
    const pg = new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0);
    group.add(inst(pg, new THREE.MeshStandardMaterial({ color: 0x4a4c5a, roughness: 0.8 }), pillars));
  }

  const screens = [
    ['TURBO YARIŞ', 'NEON ŞEHİR', '#ff2bd6', '#6a1bff'],
    ['HIZLAN!', 'DRİFT YAP', '#00c8ff', '#1b3bff'],
    ['SÜPER!', 'TURBO', '#ffb31a', '#ff2b6a']
  ];
  [0.3, 0.52, 0.78].forEach((f, k) => {
    const i = Math.floor(f * track.N);
    const side = k % 2 ? 1 : -1;
    const lat = side * (W + 9);
    const x = track.px[i] + track.rx[i] * lat, z = track.pz[i] + track.rz[i] * lat;
    const t = T.screenTexture(...screens[k]);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
    scr.position.set(x, track.py[i] + 13, z);
    scr.rotation.y = Math.atan2(-track.tx[i] * 0.6 - side * track.rx[i], -track.tz[i] * 0.6 - side * track.rz[i]);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 0.6), new THREE.MeshStandardMaterial({ color: 0x15151c, metalness: 0.6, roughness: 0.4 }));
    frame.position.copy(scr.position);
    frame.rotation.copy(scr.rotation);
    frame.translateZ(-0.35);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, track.py[i] + 9, 8), frame.material);
    post.position.set(x, (track.py[i] + 9) / 2 - 0.3, z);
    group.add(scr, frame, post);
  });
}

function buildCandy(track, group, r, terrainH, updaters) {
  const W = track.halfWall;
  const b = track.bounds;
  const swirl = T.swirlTexture('#ffffff', '#ff4fa3');
  const lolliSide = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const lolliCap = new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.2, metalness: 0.05 });
  const discGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.5, 32);
  discGeo.rotateX(Math.PI / 2);
  discGeo.translate(0, 6.2, 0);
  const stickGeo = new THREE.CylinderGeometry(0.14, 0.14, 6, 8).translate(0, 3, 0);
  const lollis = [], lcol = [];
  const cols = [0xffffff, 0xffe066, 0x9be7ff, 0xc9a2ff, 0xa6ffb5];
  const puffs = [], pcol = [];
  const drops = [], dcol = [];
  const dropCols = [0xff4f6d, 0x4fd1ff, 0xffd84f, 0x7cff6b, 0xb86bff, 0xff8a3d];
  for (let n = 0; n < 4000 && (lollis.length < 90 || puffs.length < 160 || drops.length < 140); n++) {
    const x = b.cx + (r() - 0.5) * 900, z = b.cz + (r() - 0.5) * 900;
    const d = track.nearest(x, z, 90).d;
    if (d < W + 6) continue;
    const y = terrainH(x, z);
    const k = r();
    if (k < 0.3 && lollis.length < 90 && d < W + 60) {
      const s = 0.8 + r() * 0.8;
      lollis.push(mat4(x, y - 0.3, z, r() * 6.28, s));
      lcol.push(new THREE.Color(cols[Math.floor(r() * cols.length)]));
    } else if (k < 0.7 && puffs.length < 160) {
      const s = 0.9 + r() * 0.9;
      puffs.push(mat4(x, y - 0.3, z, r() * 6.28, s));
      pcol.push(new THREE.Color().setHSL(0.8 + r() * 0.35, 0.8, 0.8));
    } else if (drops.length < 140 && d < W + 40) {
      const s = 0.8 + r() * 1.2;
      drops.push(mat4(x, y - 0.2, z, r() * 6.28, s));
      dcol.push(new THREE.Color(dropCols[Math.floor(r() * dropCols.length)]));
    }
  }
  group.add(inst(stickGeo, lolliSide, lollis));
  group.add(inst(discGeo, [lolliSide, lolliCap, lolliCap], lollis, { colors: lcol }));
  const tg = treeGeometries(12, [1, 1, 1], [1, 1, 1]);
  const stick = new THREE.CylinderGeometry(0.18, 0.22, 3.2, 6).translate(0, 1.6, 0);
  group.add(inst(stick, new THREE.MeshStandardMaterial({ color: 0xfff4e0, roughness: 0.6 }), puffs));
  group.add(inst(tg.crown, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), puffs, { colors: pcol }));
  const dropGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dropGeo.scale(1, 1.3, 1);
  group.add(inst(dropGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 1 }), drops, { colors: dcol }));

  const caneCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 6, 0), new THREE.Vector3(0.6, 7.6, 0), new THREE.Vector3(1.8, 7.8, 0), new THREE.Vector3(2.6, 6.8, 0)]);
  const caneGeo = new THREE.TubeGeometry(caneCurve, 40, 0.35, 10);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8203a';
  for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 48, 64); g.lineTo(k * 32 + 32, 64); g.fill(); }
  const ct = new THREE.CanvasTexture(c);
  ct.colorSpace = THREE.SRGBColorSpace;
  ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
  ct.repeat.set(14, 1);
  const canes = [];
  for (let i = 0; i < track.N; i += 22) {
    for (const side of [-1, 1]) {
      const lat = side * (W + 3.2);
      const x = track.px[i] + track.rx[i] * lat, z = track.pz[i] + track.rz[i] * lat;
      canes.push(mat4(x, track.py[i] - 0.2, z, Math.atan2(-side * track.rx[i], -side * track.rz[i]) - Math.PI / 2, 0.8));
    }
  }
  group.add(inst(caneGeo, new THREE.MeshStandardMaterial({ map: ct, roughness: 0.3 }), canes));

  const clouds = [];
  for (let k = 0; k < 16; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.cloudTexture(k + 3), transparent: true, depthWrite: false, color: 0xfff4fb, fog: false }));
    const a = r() * Math.PI * 2, rad = 350 + r() * 500;
    sp.position.set(b.cx + Math.cos(a) * rad, 90 + r() * 90, b.cz + Math.sin(a) * rad);
    sp.scale.set(160 + r() * 80, 70 + r() * 30, 1);
    group.add(sp);
    clouds.push(sp);
  }
  updaters.push(dt => clouds.forEach(cl => { cl.position.x += dt * 2; }));
}
