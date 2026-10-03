import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { skyMaterial, nearFade } from './shaders.js';
import { vertexGradient } from './geo.js';

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

function grid(n, seed) {
  const r = rng(seed);
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const fx = x * n;
    const fy = y * n;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const at = (a, b) => g[(((b % n) + n) % n) * n + (((a % n) + n) % n)];
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(seed, base = 4, oct = 4) {
  const ns = [];
  for (let o = 0; o < oct; o++) ns.push(grid(base << o, seed + o * 31));
  return (x, y) => {
    let v = 0;
    let a = 0.5;
    let t = 0;
    for (const n of ns) {
      v += n(x, y) * a;
      t += a;
      a *= 0.5;
    }
    return v / t;
  };
}

function paint(S, fn) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, g, b] = fn(x / S, y / S);
      const i = (y * S + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, r));
      img.data[i + 1] = Math.max(0, Math.min(255, g));
      img.data[i + 2] = Math.max(0, Math.min(255, b));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(key, make) {
  if (!cache.has(key)) {
    const t = new THREE.CanvasTexture(make());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
  }
  return cache.get(key);
}

export function limeSide() {
  return tex('limeSide', () => {
    const n = fbm(401, 4, 5);
    const m = fbm(433, 8, 3);
    return paint(256, (x, y) => {
      const w = n(x, y);
      const strata = 0.5 + 0.5 * Math.sin(y * Math.PI * 2 * 7 + w * 5);
      const fine = 0.5 + 0.5 * Math.sin(y * Math.PI * 2 * 23 + m(x, y) * 4);
      let v = 196 + strata * 30 + fine * 10 + (m(x, y) - 0.5) * 34;
      if (strata < 0.08) v -= 48;
      return [v * 1.0, v * 0.965, v * 0.88];
    });
  });
}

export function limeTop() {
  return tex('limeTop', () => {
    const n = fbm(457, 4, 5);
    const r = rng(461);
    const c = paint(256, (x, y) => {
      const v = 204 + (n(x, y) - 0.5) * 36;
      return [v, v * 0.975, v * 0.91];
    });
    const ctx = c.getContext('2d');
    for (let i = 0; i < 140; i++) {
      const lich = r() < 0.6;
      ctx.fillStyle = lich ? `rgba(${170 + r() * 30},${172 + r() * 20},${120 + r() * 20},${0.25 + r() * 0.25})` : `rgba(90,96,104,${0.12 + r() * 0.12})`;
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, 1.5 + r() * (lich ? 6 : 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(70,74,84,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      let x = r() * 256;
      let y = r() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 40;
        y += (r() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return c;
  });
}

export function plateTop() {
  return tex('plateTop', () => {
    const n = fbm(479, 8, 4);
    const c = paint(256, (x, y) => {
      const gx = x * 256;
      const gy = y * 256;
      const edge = Math.min(gx, gy, 255 - gx, 255 - gy);
      let v = 222 + (n(x, y) - 0.5) * 22;
      if (edge < 3) v = 120;
      else if (edge < 7) v -= 26;
      const scuff = n(x * 3, y * 3);
      if (scuff > 0.66) v -= (scuff - 0.66) * 70;
      return [v, v, v];
    });
    const ctx = c.getContext('2d');
    for (const [x, y] of [[16, 16], [240, 16], [16, 240], [240, 240], [128, 16], [128, 240], [16, 128], [240, 128]]) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(x + 1, y + 2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

export const STORM_LOOK = {
  groundCap: true,
  band: false,
  mushrooms: false,
  bar: { color: 0xff4d5e, emissive: 0xff2a3a, glow: 0.8, tip: 1.2, tipColor: 0xffffff, flash: 1, line: 0xff3020, lineGlow: 4.4, near: [3, 7] },
  conveyor: { color: 0xfff2d8, glow: 1.2 },
  gate: ['#5e6a7e', '#56627a'],
  curb: ['#cfc8b8', '#b8b0a0'],
  mats: (H) => ({
    groundTop: () => H.std('limeTop', { map: limeTop(), roughness: 0.9 }),
    groundSide: () => H.std('limeSide', { map: limeSide(), roughness: 0.92 }),
    blockTop: (col) => H.tint('plateTop', col, { map: plateTop(), roughness: 0.42, metalness: 0.28 }),
    blockSide: () => H.std('limeSide', { map: limeSide(), roughness: 0.92 }),
    hazard: H.stripes,
    spinnerSide: () => H.std('limeSide', { map: limeSide(), roughness: 0.92 }),
    spinnerTop: (col) => H.tint('plateTop', col, { map: plateTop(), roughness: 0.42, metalness: 0.28 }),
    plankSide: H.wood,
    plankTop: H.wood,
    beamSide: () => H.std('ropeSide', { map: H.woodMap(), color: 0x9a8a74, roughness: 0.8 }),
    beamTop: () => H.std('deck', { map: H.woodMap(), color: 0xe6d6bc, roughness: 0.75 }),
    swingSide: H.wood,
    swingTop: H.wood,
    crumble: () => H.std('limeCrumble', { map: limeTop(), color: 0xd8cfc0, roughness: 0.9 }),
    trampTop: H.trampTop,
    trampSide: H.trampSide,
    hubTop: () => H.metal(0x7a5a34),
    pillarSide: () => H.std('limeSide', { map: limeSide(), roughness: 0.92 }),
    pillarTop: () => H.metal(0x7a5a34),
  }),
};

export function stormSky(def) {
  const m = skyMaterial(def);
  m.fragmentShader = m.fragmentShader.replace(
    'gl_FragColor = vec4(col, 1.0);',
    `{
          float ang = atan(d.z, d.x);
          float band = smoothstep(-0.08, 0.03, h) * (1.0 - smoothstep(0.16, 0.44, h));
          float n1 = fbm2(vec2(ang * 2.4 + time * 0.004, h * 6.0 + 1.0));
          float n2 = fbm2(vec2(ang * 6.0 - time * 0.007, h * 15.0 + 5.0));
          float cl = smoothstep(0.46, 0.7, n1 * 0.75 + n2 * 0.4 - h * 0.25) * band;
          vec2 dh = normalize(d.xz + 1e-4);
          vec2 sh = normalize(sunDir.xz + 1e-4);
          float lit = pow(max(dot(dh, sh), 0.0), 4.0);
          vec3 shadeC = mix(bottomColor, topColor, 0.35) * 0.95;
          vec3 litC = mix(vec3(0.96, 0.97, 1.0), sunColor, 0.25);
          vec3 cc = mix(shadeC, litC, clamp(0.25 + n2 * 0.55 + h * 1.6 + lit * 0.35, 0.0, 1.0));
          col = mix(col, cc, cl * (0.92 - lit * 0.45));
          float tower = smoothstep(0.55, 0.8, fbm2(vec2(ang * 3.1, 2.0))) * smoothstep(0.5, 0.0, h) * smoothstep(-0.02, 0.06, h);
          col = mix(col, shadeC * 1.05, tower * 0.4 * (1.0 - lit));
          col *= mix(0.58, 1.0, pow(max(dot(dh, sh), 0.0), 1.5));
        }
        gl_FragColor = vec4(col, 1.0);`,
  );
  return m;
}

export function cloudSeaMaterial(cols) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        top: { value: new THREE.Color(cols.top) },
        shade: { value: new THREE.Color(cols.shade) },
        flash: { value: new THREE.Color(cols.flash) },
        flashAt: { value: new THREE.Vector3(0, 0, -9999) },
        flashK: { value: 0 },
        sunDir: { value: new THREE.Vector3(-0.3, 0.3, -0.62).normalize() },
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
      uniform float time; uniform vec3 top; uniform vec3 shade; uniform vec3 flash; uniform vec3 flashAt; uniform float flashK; uniform vec3 sunDir;
      varying vec3 vW;
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<4;i++){ v += a*vnoise(p); p = p*2.03 + vec2(1.7,9.2); a *= 0.5; } return v; }
      void main(){
        vec2 p = vW.xz * 0.016;
        vec2 w1 = vec2(time * 0.012, time * 0.007);
        vec2 w2 = vec2(-time * 0.019, time * 0.004);
        float h = fbm(p + w1) * 0.65 + fbm(p * 2.2 + w2) * 0.35;
        float hx = fbm(p + w1 + vec2(0.06, 0.0)) * 0.65 + fbm((p + vec2(0.06, 0.0)) * 2.2 + w2) * 0.35;
        float hz = fbm(p + w1 + vec2(0.0, 0.06)) * 0.65 + fbm((p + vec2(0.0, 0.06)) * 2.2 + w2) * 0.35;
        vec3 n = normalize(vec3((h - hx) * 9.0, 1.0, (h - hz) * 9.0));
        float lit = clamp(dot(n, normalize(sunDir)) * 0.9 + 0.35, 0.0, 1.0);
        float body = smoothstep(0.28, 0.72, h);
        vec3 col = mix(shade, top, clamp(body * 0.65 + lit * 0.45, 0.0, 1.0));
        float fd = length(vW.xz - flashAt.xz);
        col += flash * flashK * exp(-fd / 28.0) * (0.4 + body) * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: true,
  });
}

function puffMaterial(top, under) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.08 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying float vWy;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWy = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader =
      'varying float vWy;\n' +
      sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(${under.r.toFixed(3)}, ${under.g.toFixed(3)}, ${under.b.toFixed(3)}), vec3(${top.r.toFixed(3)}, ${top.g.toFixed(3)}, ${top.b.toFixed(3)}), smoothstep(-20.0, 70.0, vWy));`,
      );
  };
  m.customProgramCacheKey = () => 'stormPuff';
  return m;
}

export function buildStorm(ctx) {
  const { world, g, T, R, rnd, updaters, clear, yAt, b, len, def, floorM } = ctx;

  const turbines = [];
  for (let i = 0, tries = 0; i < 14 && tries < 300; tries++) {
    const z = b.maxZ + 30 - (i / 14) * (len + 160) + R(-12, 12);
    const x = (i % 2 ? 1 : -1) * R(120, 170);
    if (!clear(x, z, 10)) continue;
    const top = yAt(z) + R(6, 26);
    turbines.push({ x, z, base: def.belowY - 8, top, s: R(0.9, 1.4), yaw: R(-0.5, 0.5) + (x > 0 ? 0.25 : -0.25), ph: rnd() * 6, sp: R(0.7, 1.2) });
    i++;
  }
  const towerG = T(new THREE.CylinderGeometry(0.45, 1, 1, 12, 4));
  towerG.translate(0, 0.5, 0);
  vertexGradient(towerG, 0x3a4458, 0x9aa4b4);
  const towerM = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  const towers = new THREE.InstancedMesh(towerG, towerM, turbines.length);
  const nacG = T(mergeGeometries([new THREE.CapsuleGeometry(0.75, 2.4, 4, 10).rotateX(Math.PI / 2).toNonIndexed(), new THREE.SphereGeometry(0.62, 12, 8).translate(0, 0, -1.9).toNonIndexed()].map((x) => (x.deleteAttribute('uv'), x)), false));
  const nacM = T(new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.4, metalness: 0.15 }));
  const nacs = new THREE.InstancedMesh(nacG, nacM, turbines.length);
  const blades = [];
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Shape();
    s.moveTo(-0.32, 0.4);
    s.quadraticCurveTo(-0.55, 6, -0.08, 15);
    s.lineTo(0.12, 15);
    s.quadraticCurveTo(0.42, 5, 0.32, 0.4);
    s.closePath();
    const bg = new THREE.ShapeGeometry(s, 6);
    bg.rotateZ((k / 3) * Math.PI * 2);
    blades.push(bg.index ? bg.toNonIndexed() : bg.clone());
    bg.dispose();
  }
  for (const x of blades) x.deleteAttribute('uv');
  const rotG = T(mergeGeometries(blades, false));
  const rotM = T(new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.45, side: THREE.DoubleSide }));
  const rots = new THREE.InstancedMesh(rotG, rotM, turbines.length);
  turbines.forEach((t, i) => {
    const h = t.top - t.base;
    _m.compose(_p.set(t.x, t.base, t.z), _q.identity(), _s.set(1.4 * t.s, h, 1.4 * t.s));
    towers.setMatrixAt(i, _m);
    _e.set(0, t.yaw, 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(t.x, t.top + 0.5, t.z), _q, _s.setScalar(t.s * 1.3));
    nacs.setMatrixAt(i, _m);
    t.hub = new THREE.Vector3(Math.sin(t.yaw) * 2.2 * t.s, 0, Math.cos(t.yaw) * 2.2 * t.s).add(_p.set(t.x, t.top + 0.5, t.z));
  });
  rots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const im of [towers, nacs, rots]) im.frustumCulled = false;
  g.add(towers, nacs, rots);
  updaters.push((t) => {
    turbines.forEach((tb, i) => {
      _e.set(0, tb.yaw, t * tb.sp + tb.ph, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(tb.hub, _q, _s.setScalar(tb.s * 1.3));
      rots.setMatrixAt(i, _m);
    });
    rots.instanceMatrix.needsUpdate = true;
  });

  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const z = R(b.minZ - 260, b.maxZ + 120);
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * R(150, 320);
    const base = def.belowY - 6;
    const H = R(60, 140);
    const k = 12;
    for (let j = 0; j < k; j++) {
      const f = j / (k - 1);
      const r = R(16, 26) * (1 - f * 0.4) + (j === k - 1 ? 10 : 0);
      puffs.push({ x: x + R(-12, 12) * (1 - f), y: base + f * H, z: z + R(-12, 12), r, flat: j === k - 1 ? 0.5 : 0.85 });
    }
  }
  const pg = T(new THREE.IcosahedronGeometry(1, 3));
  const pm = T(puffMaterial(new THREE.Color(0x9aa4b4), new THREE.Color(0x323c54)));
  const pillars = new THREE.InstancedMesh(pg, pm, puffs.length);
  puffs.forEach((p, i) => {
    _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(p.r * 1.25, p.r * p.flat, p.r));
    pillars.setMatrixAt(i, _m);
  });
  g.add(pillars);

  const sn = 150;
  const corner = [];
  const base = [];
  for (let i = 0; i < sn; i++) {
    const bx = R(0, 80);
    const by = R(0, 40);
    const bz = R(0, 80);
    const sd = rnd();
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
      corner.push(u, v, sd);
      base.push(bx, by, bz);
    }
  }
  const sg = T(new THREE.BufferGeometry());
  sg.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
  sg.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 3));
  const sm = T(
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, focus: { value: new THREE.Vector3() } },
      vertexShader: `
        uniform float time; uniform vec3 cam; uniform vec3 focus;
        attribute vec3 corner;
        varying float vA;
        void main(){
          vec3 dir = normalize(vec3(1.0, 0.02, -0.25));
          vec3 off = position + dir * time * (9.0 + corner.z * 5.0);
          vec3 c = cam + mod(off - cam + vec3(40.0, 20.0, 40.0), vec3(80.0, 40.0, 80.0)) - vec3(40.0, 20.0, 40.0);
          vec3 wp = c + dir * corner.x * 1.1 + vec3(0.0, corner.y * 0.022, 0.0);
          vec3 ab = focus + vec3(0.0, 0.9, 0.0) - cam;
          float t = clamp(dot(c - cam, ab) / dot(ab, ab), 0.0, 1.0);
          float dl = length(c - cam - ab * t);
          float dc = distance(c, cam);
          vA = smoothstep(3.0, 5.0, dl) * smoothstep(4.0, 9.0, dc) * (1.0 - smoothstep(26.0, 40.0, dc)) * (0.5 + 0.5 * sin(time * 1.3 + corner.z * 40.0));
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0), vA * 0.25); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const streaks = new THREE.Mesh(sg, sm);
  streaks.frustumCulled = false;
  g.add(streaks);
  updaters.push((t) => {
    sm.uniforms.time.value = t;
    if (world.camera) sm.uniforms.cam.value.copy(world.camera.position);
    if (world.focus) sm.uniforms.focus.value.copy(world.focus);
  });

  const spots = [];
  for (const sp of world.course.specs) {
    if (sp.t === 'block' && sp.style === 'ground' && sp.sx >= 6.5 && !sp.bare && !sp.secret && !world.course.cps.some((c) => c.x === sp.x && c.z === sp.z)) {
      const hx = sp.sx / 2 - 0.45;
      const hz = sp.sz / 2 - 0.45;
      spots.push([sp.x - hx, sp.y, sp.z - hz, sp.stage], [sp.x + hx, sp.y, sp.z - hz, sp.stage]);
    }
  }
  const postG = T(new THREE.CylinderGeometry(0.06, 0.09, 2.3, 8).translate(0, 1.15, 0));
  const postM = T(nearFade(new THREE.MeshStandardMaterial({ color: 0x9aa2ae, roughness: 0.6, metalness: 0.1 }), 'anemoPost', 9));
  const cupParts = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const arm = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5).rotateZ(Math.PI / 2).translate(0.27, 0, 0).rotateY(a);
    const cup = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2).translate(0.56, 0, 0.0).rotateY(a);
    cupParts.push(arm.toNonIndexed(), cup.toNonIndexed());
    arm.dispose();
    cup.dispose();
  }
  for (const x of cupParts) x.deleteAttribute('uv');
  const cupG = T(mergeGeometries(cupParts, false));
  const cupM = T(nearFade(new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.55, metalness: 0.5 }), 'anemoCup', 9));
  const posts = new THREE.InstancedMesh(postG, postM, Math.max(1, spots.length));
  const cups = new THREE.InstancedMesh(cupG, cupM, Math.max(1, spots.length));
  spots.forEach(([x, y, z], i) => {
    _m.compose(_p.set(x, y, z), _q.identity(), _s.setScalar(1));
    posts.setMatrixAt(i, _m);
  });
  posts.castShadow = true;
  cups.frustumCulled = false;
  posts.frustumCulled = false;
  cups.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  g.add(posts, cups);
  updaters.push((t) => {
    spots.forEach(([x, y, z, st], i) => {
      const on = world.window === null || world.inWindow(st) ? 1 : 0;
      _e.set(0, t * (4 + (i % 3)) + i, 0);
      _q.setFromEuler(_e);
      _m.compose(_p.set(x, y + 2.32, z), _q, _s.setScalar(on));
      cups.setMatrixAt(i, _m);
    });
    cups.instanceMatrix.needsUpdate = true;
  });

  const fl = { next: 4, t: -1, at: new THREE.Vector3() };
  updaters.push((t, dt) => {
    const u = floorM.uniforms;
    if (!u || !u.flashK) return;
    fl.next -= dt;
    if (fl.next <= 0 && world.camera) {
      fl.next = 4 + rnd() * 5;
      fl.t = 0;
      const c = world.focus || world.camera.position;
      const a = rnd() * Math.PI * 2;
      const d = 45 + rnd() * 60;
      fl.at.set(c.x + Math.cos(a) * d, def.belowY, c.z + Math.sin(a) * d - 30);
      u.flashAt.value.copy(fl.at);
    }
    if (fl.t >= 0) {
      fl.t += dt;
      const k = fl.t < 0.08 ? fl.t / 0.08 : fl.t < 0.15 ? 1 - (fl.t - 0.08) / 0.07 : fl.t < 0.24 ? 0.0 : fl.t < 0.3 ? 0.7 : Math.max(0, 0.7 - (fl.t - 0.3) * 5);
      u.flashK.value = k;
      if (fl.t > 0.6) {
        fl.t = -1;
        u.flashK.value = 0;
      }
    }
  });
}
