import * as THREE from 'three';
import * as TX from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { jitter, vertexGradient } from './geo.js';
import { skyMaterial, waterMaterial, lavaMaterial, gridMaterial, canopyMaterial, nearFade, cloudMaterial } from './shaders.js';
import { stormSky, cloudSeaMaterial, buildStorm } from './storm.js';
import { mechanismMaterial, buildClockwork } from './clockwork.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

function glowVertexMaterial(o, key, k = 2.2) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= min(vColor.rgb, vec3(1.0));')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += max(vColor.rgb - 1.0, 0.0) * ' + k.toFixed(2) + ';');
  };
  m.customProgramCacheKey = () => key;
  return m;
}

function setInst(mesh, i, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  _p.set(x, y, z);
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

export function buildDecor(world) {
  const def = world.def;
  const d = def.decor;
  const w = def.id;
  const g = new THREE.Group();
  world.group.add(g);
  world.decorGroup = g;
  const T = (o) => world.track(o);
  const b = world.course.bounds;
  const rnd = TX.rng(w * 1013 + 5);
  const R = (a, c) => a + (c - a) * rnd();
  const updaters = [];
  const len = b.maxZ - b.minZ;
  const yAt = (z) => THREE.MathUtils.lerp(0, b.maxY, THREE.MathUtils.clamp(-z / len, 0, 1));

  const skyM = T(def.sky.clouds ? stormSky(def) : skyMaterial(def));
  const sky = new THREE.Mesh(T(new THREE.SphereGeometry(1500, 48, 24)), skyM);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  g.add(sky);
  updaters.push((t) => {
    skyM.uniforms.time.value = t;
    if (world.camera) sky.position.copy(world.camera.position);
  });

  const floorGeo = T(new THREE.PlaneGeometry(4000, 4000, 1, 1));
  floorGeo.rotateX(-Math.PI / 2);
  const BELOW = { water: () => waterMaterial(def), lava: lavaMaterial, void: gridMaterial, canopy: () => canopyMaterial(def.belowColors), cloudsea: () => cloudSeaMaterial(def.belowColors), mechanism: () => mechanismMaterial(def.belowColors) };
  const floorM = T(BELOW[def.below]());
  const floor = new THREE.Mesh(floorGeo, floorM);
  floor.position.set(0, def.belowY, (b.minZ + b.maxZ) / 2);
  g.add(floor);
  world.shaderMats.push(floorM);
  updaters.push(() => {
    if (world.camera) {
      floor.position.x = Math.round(world.camera.position.x / 50) * 50;
      floor.position.z = Math.round(world.camera.position.z / 50) * 50;
    }
  });

  const islands = [];
  const islandCount = d.islands;
  const solid = world.course.specs.filter((sp) => sp.t === 'block' || sp.t === 'disk');
  const clear = (x, z, s) => solid.every((sp) => Math.hypot(sp.x - x, sp.z - z) > s + 9);
  for (let i = 0, tries = 0; i < islandCount && tries < 400; tries++) {
    const z = R(b.minZ - 80, b.maxZ + 60);
    const side = rnd() > 0.5 ? 1 : -1;
    const far = rnd() > 0.7;
    const x = side * (far ? R(70, 160) : R(20, 62));
    const s = far ? R(8, 18) : R(3, 9);
    const y = yAt(z) + (far ? R(-25, 25) : R(-16, 10));
    if (!clear(x, z, s)) continue;
    islands.push({ x, y, z, s, depth: R(1.2, 2) });
    i++;
  }
  const under = [];
  for (const sp of world.course.specs) {
    if (sp.t === 'block' && !sp.bare && d.underStyles.includes(sp.style) && !sp.move && !sp.spin) {
      under.push({ x: sp.x, y: sp.y - (sp.sy || 1) + 0.05, z: sp.z, s: Math.max(sp.sx, sp.sz) * 0.62, d: Math.min(sp.sx, sp.sz) * 0.75 + 1.5 });
    }
    if (sp.t === 'disk' && sp.style === 'arena') under.push({ x: sp.x, y: sp.y - sp.sy + 0.05, z: sp.z, s: sp.r * 0.95, d: sp.r * 0.9 + 1 });
  }

  const topGeo = T(new THREE.CylinderGeometry(1, 0.94, 0.5, 18, 1));
  const topTex = T(TX[d.top]().clone());
  topTex.repeat.set(3, 3);
  topTex.needsUpdate = true;
  const topM = T(new THREE.MeshStandardMaterial({ map: topTex, color: d.topTint, roughness: 0.9 }));
  const tops = new THREE.InstancedMesh(topGeo, topM, islands.length);
  tops.receiveShadow = true;
  islands.forEach((il, i) => setInst(tops, i, il.x, il.y, il.z, il.s, 1, il.s, rnd() * 6));
  g.add(tops);

  const coneGeo = T(new THREE.ConeGeometry(1, 1, 12, 6));
  coneGeo.rotateX(Math.PI);
  coneGeo.translate(0, -0.5, 0);
  jitter(coneGeo, 0.16, w * 3, true);
  vertexGradient(coneGeo, d.under[0], d.under[1]);
  const underTex = T(TX.rock(d.underRock).clone());
  underTex.repeat.set(3, 1.5);
  underTex.needsUpdate = true;
  const underM = T(new THREE.MeshStandardMaterial({ map: underTex, vertexColors: true, roughness: d.underRough, flatShading: true, emissive: d.underGlow, emissiveIntensity: 0.4 }));
  const unders = new THREE.InstancedMesh(coneGeo, underM, islands.length + under.length);
  islands.forEach((il, i) => setInst(unders, i, il.x, il.y - 0.2, il.z, il.s * 0.95, il.s * il.depth, il.s * 0.95, rnd() * 6));
  under.forEach((u, k) => setInst(unders, islands.length + k, u.x, u.y, u.z, u.s, u.d * d.underDepth, u.s, rnd() * 6));
  unders.receiveShadow = true;
  g.add(unders);

  const SETS = { trees: () => buildTrees(islands), clouds: buildClouds, lava: buildLavaWorld, space: buildSpace, grove: buildGrove, storm: () => buildStorm({ world, g, T, R, rnd, updaters, clear, yAt, b, len, def, floorM }), clock: () => buildClockwork({ world, g, T, R, rnd, updaters, clear, yAt, b, len, def }) };
  for (const k of d.sets) SETS[k]();

  function buildTrees(isl) {
    const spots = [];
    for (const il of isl) {
      const n = Math.floor(il.s / 2.2) + 1;
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * il.s * 0.6;
        spots.push({ x: il.x + Math.cos(a) * r, y: il.y + 0.25, z: il.z + Math.sin(a) * r, s: R(0.9, 1.9) });
      }
    }
    const trunkGeo = T(new THREE.CylinderGeometry(0.16, 0.28, 1.8, 7));
    trunkGeo.translate(0, 0.9, 0);
    const trunkM = T(new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.9 }));
    const crownGeo = T(new THREE.IcosahedronGeometry(1, 1));
    jitter(crownGeo, 0.18, 4);
    const crownM = T(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }));
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkM, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownM, spots.length * 2);
    const greens = [0x49b83a, 0x6ccc3e, 0x3a9e3a, 0x8fd84a, 0x2f8f4a];
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      if (s.bush) {
        setInst(trunks, i, s.x, s.y - 5, s.z, 0.01, 0.01, 0.01);
        setInst(crowns, i * 2, s.x, s.y + 0.35, s.z, 0.9, 0.7, 0.9, rnd() * 6);
        setInst(crowns, i * 2 + 1, s.x + 0.5, s.y + 0.25, s.z - 0.3, 0.6, 0.5, 0.6, rnd() * 6);
      } else {
        setInst(trunks, i, s.x, s.y, s.z, s.s, s.s, s.s);
        setInst(crowns, i * 2, s.x, s.y + 2.1 * s.s, s.z, 1.25 * s.s, 1.1 * s.s, 1.25 * s.s, rnd() * 6);
        setInst(crowns, i * 2 + 1, s.x + 0.2 * s.s, s.y + 3 * s.s, s.z, 0.85 * s.s, 0.85 * s.s, 0.85 * s.s, rnd() * 6);
      }
      col.set(greens[i % greens.length]);
      crowns.setColorAt(i * 2, col);
      col.offsetHSL(0.02, 0, 0.06);
      crowns.setColorAt(i * 2 + 1, col);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    crowns.receiveShadow = true;
    g.add(trunks, crowns);
  }

  function buildClouds() {
    const cl = d.clouds;
    const n = cl.n;
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const z = R(b.minZ - 150, b.maxZ + 120);
      const side = rnd() > 0.5 ? 1 : -1;
      const low = rnd() < 0.35;
      const x = side * R(14, 150);
      let y = low ? def.belowY + R(3, 10) : yAt(z) + R(-6, 45);
      const s = R(2.5, 6);
      const hit = solid.find((sp) => Math.hypot(sp.x - x, sp.z - z) < s * 3 + 9 && Math.abs(sp.y - y) < s + 6);
      if (hit) y = hit.y - 12 - s;
      const k = 5 + Math.floor(rnd() * 4);
      for (let j = 0; j < k; j++) {
        pieces.push({ x: x + (j - k / 2) * s * 0.7 + R(-1, 1), y: y + R(-0.4, 0.8) * s * 0.3, z: z + R(-1, 1) * s * 0.6, r: s * R(0.6, 1.15) * (1 - Math.abs(j - k / 2) / k) });
      }
    }
    const cg = T(new THREE.IcosahedronGeometry(1, 2));
    const cm = T(
      cl.lit !== undefined
        ? cloudMaterial(def, cl.lit, cl.shade, cl.opacity)
        : new THREE.MeshStandardMaterial({
            color: cl.color,
            emissive: cl.emissive,
            emissiveIntensity: cl.glow,
            roughness: 1,
            transparent: cl.opacity < 1,
            opacity: cl.opacity,
          }),
    );
    const clouds = new THREE.InstancedMesh(cg, cm, pieces.length);
    pieces.forEach((p, i) => setInst(clouds, i, p.x, p.y, p.z, p.r, p.r * 0.62, p.r));
    g.add(clouds);
    updaters.push((t) => {
      clouds.position.x = Math.sin(t * 0.03) * 8;
    });
  }

  function buildLavaWorld() {
    const n = 46;
    const sg = T(new THREE.ConeGeometry(1, 1, 7, 5));
    sg.translate(0, 0.5, 0);
    jitter(sg, 0.12, 9);
    vertexGradient(sg, 0xff6a2a, 0x2a2230);
    const sm = T(new THREE.MeshStandardMaterial({ map: T(TX.rock('basalt').clone()), vertexColors: true, roughness: 0.9, flatShading: true }));
    const spires = new THREE.InstancedMesh(sg, sm, n);
    for (let i = 0; i < n; i++) {
      const z = R(b.minZ - 120, b.maxZ + 60);
      const x = (rnd() > 0.5 ? 1 : -1) * R(14, 130);
      const h = R(10, 40) + (yAt(z) - def.belowY) * R(0.3, 0.9);
      const r = R(2, 7);
      setInst(spires, i, x, def.belowY - 1, z, r, h, r, rnd() * 6);
    }
    spires.receiveShadow = true;
    g.add(spires);

    const wc = document.createElement('canvas');
    wc.width = 128;
    wc.height = 128;
    const wx = wc.getContext('2d');
    wx.fillStyle = '#000';
    wx.fillRect(0, 0, 128, 128);
    wx.fillStyle = '#ffb040';
    for (const [x, y] of [[20, 30], [84, 30], [52, 86]]) {
      wx.beginPath();
      wx.moveTo(x, y + 26);
      wx.lineTo(x, y + 8);
      wx.arc(x + 12, y + 8, 12, Math.PI, 0);
      wx.lineTo(x + 24, y + 26);
      wx.fill();
    }
    const winTex = T(new THREE.CanvasTexture(wc));
    winTex.colorSpace = THREE.SRGBColorSpace;
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    winTex.repeat.set(3, 4);
    const brickTex = T(TX.brick().clone());
    brickTex.repeat.set(3, 4);
    brickTex.needsUpdate = true;
    const towerM = T(new THREE.MeshStandardMaterial({ map: brickTex, emissiveMap: winTex, emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.9 }));
    const roofM = T(new THREE.MeshStandardMaterial({ color: 0xc8283a, roughness: 0.6, metalness: 0.1, flatShading: true }));
    const tg = T(new THREE.CylinderGeometry(1, 1.12, 1, 14, 1));
    tg.translate(0, 0.5, 0);
    const rg = T(new THREE.ConeGeometry(1.35, 1.5, 14));
    rg.translate(0, 0.75, 0);
    const bg = T(new THREE.CylinderGeometry(1.25, 1.25, 0.5, 14));
    const tn = 14;
    const towers = new THREE.InstancedMesh(tg, towerM, tn);
    const roofs = new THREE.InstancedMesh(rg, roofM, tn);
    const rims = new THREE.InstancedMesh(bg, T(new THREE.MeshStandardMaterial({ map: T(TX.stoneTop().clone()), color: 0x9a8aa0 })), tn);
    for (let i = 0; i < tn; i++) {
      const z = b.maxZ + 20 - (i / tn) * (len + 140) + R(-8, 8);
      const x = (i % 2 ? 1 : -1) * R(22, 60);
      const r = R(2, 3.6);
      const top = yAt(z) + R(-2, 16);
      const base = def.belowY - 1;
      const h = top - base;
      setInst(towers, i, x, base, z, r, h, r);
      setInst(rims, i, x, top + 0.25, z, r, 1, r);
      setInst(roofs, i, x, top + 0.5, z, r, r * 1.6, r);
    }
    towers.castShadow = true;
    g.add(towers, roofs, rims);

    const vg = T(new THREE.ConeGeometry(1, 1, 24, 6, true));
    vg.translate(0, 0.5, 0);
    jitter(vg, 0.04, 2);
    vertexGradient(vg, 0x2a1a24, 0x5a2a2a);
    const vm = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    const craterM = T(lavaMaterial());
    world.shaderMats.push(craterM);
    for (const [x, z, s] of [[-240, b.minZ - 160, 120], [260, b.minZ - 60, 90], [-200, b.maxZ + 40, 80]]) {
      const v = new THREE.Mesh(vg, vm);
      v.position.set(x, def.belowY - 5, z);
      v.scale.set(s, s * 0.9, s);
      g.add(v);
      const cr = new THREE.Mesh(T(new THREE.CircleGeometry(1, 24)), craterM);
      cr.rotation.x = -Math.PI / 2;
      cr.position.set(x, def.belowY - 5 + s * 0.9 * 0.86, z);
      cr.scale.setScalar(s * 0.14);
      g.add(cr);
    }

    const en = 260;
    const ePos = new Float32Array(en * 3);
    const eSeed = new Float32Array(en);
    for (let i = 0; i < en; i++) {
      ePos[i * 3] = R(-40, 40);
      ePos[i * 3 + 1] = R(-20, 30);
      ePos[i * 3 + 2] = R(-40, 40);
      eSeed[i] = rnd();
    }
    const eg = T(new THREE.BufferGeometry());
    eg.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    const em = T(new THREE.PointsMaterial({ map: TX.sprite('glow'), color: 0xff8a2a, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const embers = new THREE.Points(eg, em);
    embers.frustumCulled = false;
    g.add(embers);
    updaters.push((t, dt) => {
      const c = world.camera ? world.camera.position : _p.set(0, 0, 0);
      const a = eg.attributes.position.array;
      for (let i = 0; i < en; i++) {
        a[i * 3 + 1] += dt * (1 + eSeed[i] * 2.5);
        a[i * 3] += Math.sin(t * 1.3 + eSeed[i] * 20) * dt * 0.6;
        if (a[i * 3 + 1] > 30) a[i * 3 + 1] = -20;
      }
      embers.position.set(Math.round(c.x / 80) * 80, c.y - 5, Math.round(c.z / 80) * 80);
      eg.attributes.position.needsUpdate = true;
    });

    const torchSpots = [];
    for (const sp of world.course.specs) {
      if (sp.t === 'block' && sp.style === 'ground' && sp.sx >= 6) {
        const hx = sp.sx / 2 - 0.5;
        const hz = sp.sz / 2 - 0.5;
        torchSpots.push([sp.x - hx, sp.y, sp.z + hz], [sp.x + hx, sp.y, sp.z + hz]);
      }
    }
    const postG = T(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8));
    postG.translate(0, 0.7, 0);
    const bowlG = T(new THREE.CylinderGeometry(0.34, 0.2, 0.3, 10));
    const pa = new THREE.PlaneGeometry(0.95, 1.9);
    const pb = pa.clone().rotateY(Math.PI / 2);
    const flameG = T(mergeGeometries([pa, pb]));
    pa.dispose();
    pb.dispose();
    flameG.translate(0, 0.7, 0);
    const postM = T(new THREE.MeshStandardMaterial({ color: 0x3a3440, metalness: 0.6, roughness: 0.5 }));
    const flameM = T(new THREE.MeshBasicMaterial({ map: TX.flame(), color: new THREE.Color(0xffa050).multiplyScalar(2.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const posts = new THREE.InstancedMesh(postG, postM, torchSpots.length);
    const bowls = new THREE.InstancedMesh(bowlG, postM, torchSpots.length);
    const flames = new THREE.InstancedMesh(flameG, flameM, torchSpots.length);
    flames.frustumCulled = false;
    torchSpots.forEach(([x, y, z], i) => {
      setInst(posts, i, x, y, z, 1, 1, 1);
      setInst(bowls, i, x, y + 1.5, z, 1, 1, 1);
    });
    posts.castShadow = true;
    const per = 6;
    const emN = torchSpots.length * per;
    const tPos = new Float32Array(emN * 3);
    const tCol = new Float32Array(emN * 3);
    const tSeed = new Float32Array(emN);
    for (let i = 0; i < emN; i++) tSeed[i] = rnd();
    const emG = T(new THREE.BufferGeometry());
    emG.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    emG.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    const tm = T(new THREE.PointsMaterial({ map: TX.sprite('glow'), size: 0.26, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const sparks = new THREE.Points(emG, tm);
    sparks.frustumCulled = false;
    g.add(posts, bowls, flames, sparks);
    updaters.push((t) => {
      torchSpots.forEach(([x, y, z], i) => {
        const f = 1 + Math.sin(t * 56.5 + i * 1.7) * 0.1 + Math.sin(t * 23 + i * 2.9) * 0.05;
        setInst(flames, i, x, y + 1.55, z, f, f, f, i * 0.7);
        for (let k = 0; k < per; k++) {
          const j = i * per + k;
          const u = (t * (0.7 + tSeed[j] * 0.6) + tSeed[j]) % 1;
          tPos[j * 3] = x + Math.sin(t * 3 + j) * 0.12 * u + (tSeed[j] - 0.5) * 0.3;
          tPos[j * 3 + 1] = y + 1.8 + u * 1.8;
          tPos[j * 3 + 2] = z + Math.cos(t * 2.3 + j) * 0.12 * u;
          const a = (1 - u) * (u < 0.1 ? u * 10 : 1);
          tCol[j * 3] = a * 2.4;
          tCol[j * 3 + 1] = a * 1.2;
          tCol[j * 3 + 2] = a * 0.3;
        }
      });
      flames.instanceMatrix.needsUpdate = true;
      emG.attributes.position.needsUpdate = true;
      emG.attributes.color.needsUpdate = true;
    });
  }

  function buildSpace() {
    const planets = [
      { x: -320, y: 160, z: b.minZ - 260, r: 90, seed: 7, cols: [0xff9a5a, 0xffd28a, 0xc8603a, 0xffe6b0], ring: true },
      { x: 280, y: 220, z: b.maxZ - 220, r: 38, seed: 13, cols: [0x6ad0ff, 0x3a6aff, 0xbff0ff], ring: false },
      { x: 120, y: 70, z: b.minZ - 520, r: 60, seed: 21, cols: [0xff5ad8, 0x9a3aff, 0xffb0f0, 0x6a2ad8], ring: false },
    ];
    for (const pl of planets) {
      const tex = TX.planet(pl.seed, pl.cols);
      const m = T(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.8, fog: false }));
      const mesh = new THREE.Mesh(T(new THREE.SphereGeometry(pl.r, 48, 32)), m);
      mesh.position.set(pl.x, pl.y, pl.z);
      mesh.rotation.z = 0.3;
      g.add(mesh);
      updaters.push((t) => {
        mesh.rotation.y = t * 0.02;
      });
      if (pl.ring) {
        const rm = T(
          new THREE.ShaderMaterial({
            vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `varying vec3 vP; void main(){ float r = length(vP.xy); float t = (r - ${(pl.r * 1.35).toFixed(1)}) / ${(pl.r * 0.9).toFixed(1)};
              float bands = 0.55 + 0.45 * sin(t * 40.0) * sin(t * 13.0);
              float a = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t) * bands;
              gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * 1.1, a * 0.8); }`,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
          }),
        );
        const ring = new THREE.Mesh(T(new THREE.RingGeometry(pl.r * 1.35, pl.r * 2.25, 96)), rm);
        ring.position.copy(mesh.position);
        ring.rotation.set(-Math.PI / 2 + 0.35, 0.2, 0);
        g.add(ring);
      }
    }

    const an = 70;
    const ag = T(new THREE.DodecahedronGeometry(1, 1));
    jitter(ag, 0.25, 11);
    const am = T(new THREE.MeshStandardMaterial({ color: 0x8a80a8, roughness: 0.85, flatShading: true, map: T(TX.rock('basalt').clone()) }));
    const ast = new THREE.InstancedMesh(ag, am, an);
    const aData = [];
    for (let i = 0; i < an; i++) {
      const z = R(b.minZ - 120, b.maxZ + 80);
      aData.push({ x: (rnd() > 0.5 ? 1 : -1) * R(16, 140), y: yAt(z) + R(-30, 40), z, s: R(0.8, 5), rx: rnd() * 6, ry: rnd() * 6, sp: R(0.05, 0.3) });
    }
    g.add(ast);
    updaters.push((t) => {
      aData.forEach((a, i) => setInst(ast, i, a.x, a.y + Math.sin(t * 0.3 + i) * 0.6, a.z, a.s, a.s * 0.8, a.s, a.ry + t * a.sp, a.rx + t * a.sp * 0.7));
      ast.instanceMatrix.needsUpdate = true;
    });

    const spots = [];
    for (const il of islands) {
      const n = 3 + Math.floor(il.s / 2);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * il.s * 0.55;
        spots.push({ x: il.x + Math.cos(a) * r, y: il.y + 0.2, z: il.z + Math.sin(a) * r, s: R(0.6, 1.8), tilt: R(-0.4, 0.4) });
      }
    }
    for (const sp of world.course.specs) {
      if (sp.t === 'block' && sp.style === 'ground') {
        const hx = sp.sx / 2 - 0.6;
        const hz = sp.sz / 2 - 0.6;
        spots.push({ x: sp.x - hx, y: sp.y, z: sp.z + hz, s: 0.7, tilt: 0.2 }, { x: sp.x + hx, y: sp.y, z: sp.z - hz, s: 0.55, tilt: -0.25 });
      }
    }
    const cg = T(new THREE.ConeGeometry(0.38, 2.1, 5, 1));
    cg.translate(0, 0.95, 0);
    const cm = T(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.15, metalness: 0.1, flatShading: true }));
    cm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * 1.6;');
    };
    const crystals = new THREE.InstancedMesh(cg, cm, spots.length);
    const cc = [0x35e0ff, 0xff4fd8, 0x8a7bff, 0x7cff6b];
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      setInst(crystals, i, s.x, s.y, s.z, s.s, s.s, s.s, rnd() * 6, s.tilt, s.tilt * 0.5);
      col.set(cc[i % cc.length]);
      crystals.setColorAt(i, col);
    });
    crystals.castShadow = true;
    g.add(crystals);

    const sn = 500;
    const sPos = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      sPos[i * 3] = R(-200, 200);
      sPos[i * 3 + 1] = R(-40, 120);
      sPos[i * 3 + 2] = R(b.minZ - 150, b.maxZ + 100);
    }
    const sg = T(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const smat = T(new THREE.PointsMaterial({ map: TX.sprite('star'), color: 0xcfe0ff, size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const sparkles = new THREE.Points(sg, smat);
    g.add(sparkles);
    updaters.push((t) => {
      smat.opacity = 0.7 + Math.sin(t * 2) * 0.3;
    });
  }

  function buildGrove() {
    const trunks = [];
    for (let i = 0, tries = 0; i < 16 && tries < 300; tries++) {
      const z = b.maxZ + 20 - (i / 16) * (len + 120) + R(-10, 10);
      const x = (i % 2 ? 1 : -1) * R(17, 58);
      const r = R(2.2, 4.4);
      if (!clear(x, z, r + 6)) continue;
      const top = yAt(z) + R(18, 34);
      trunks.push({ x, z, r, base: def.belowY - 2, top });
      i++;
    }
    const tg = T(new THREE.CylinderGeometry(0.72, 1, 1, 14, 6));
    tg.translate(0, 0.5, 0);
    jitter(tg, 0.05, 31);
    vertexGradient(tg, 0x3a3024, 0x9a8470);
    const barkTex = T(TX.bark().clone());
    barkTex.repeat.set(3, 10);
    barkTex.needsUpdate = true;
    const trunkM = T(new THREE.MeshStandardMaterial({ map: barkTex, vertexColors: true, roughness: 0.95 }));
    const tm = new THREE.InstancedMesh(tg, trunkM, trunks.length);
    trunks.forEach((t, i) => setInst(tm, i, t.x, t.base, t.z, t.r, t.top - t.base, t.r, rnd() * 6));
    tm.receiveShadow = true;
    g.add(tm);

    const fg = T(new THREE.CylinderGeometry(1, 1, 0.22, 18, 1, false, -Math.PI / 2, Math.PI));
    const fPos = fg.attributes.position;
    const fCol = new Float32Array(fPos.count * 3);
    const bone = new THREE.Color(0xb8a27e);
    const rimC = new THREE.Color(0xffb070);
    for (let i = 0; i < fPos.count; i++) {
      const y = fPos.getY(i);
      const rr = Math.hypot(fPos.getX(i), fPos.getZ(i));
      const c = y < -0.05 && rr > 0.75 ? new THREE.Color(1 + rimC.r * 1.4, 1 + rimC.g * 1.4, 1 + rimC.b * 1.4) : bone.clone().multiplyScalar(y < 0 ? 0.5 : 0.62 + 0.14 * Math.cos(rr * 18));
      fCol[i * 3] = c.r;
      fCol[i * 3 + 1] = c.g;
      fCol[i * 3 + 2] = c.b;
    }
    fg.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
    const fm = T(glowVertexMaterial({ roughness: 0.75 }, 'shelfFungus', 1.5));
    const shelves = [];
    for (const t of trunks) {
      const k = 8 + Math.floor(rnd() * 4);
      for (let j = 0; j < k; j++) {
        const y = THREE.MathUtils.lerp(t.base + 10, t.top - 2, rnd());
        const a = rnd() * Math.PI * 2;
        const f = (y - t.base) / (t.top - t.base);
        const rr = t.r * (1 - 0.28 * f);
        const s = R(0.9, 2.1);
        shelves.push({ x: t.x + Math.cos(a) * rr, y, z: t.z + Math.sin(a) * rr, s, a });
      }
    }
    const sm = new THREE.InstancedMesh(fg, fm, shelves.length);
    shelves.forEach((sh, i) => setInst(sm, i, sh.x, sh.y, sh.z, sh.s, sh.s * 1.6, sh.s * 0.8, -sh.a + Math.PI / 2));
    g.add(sm);

    const strandTex = TX.strand();
    const pg = T(new THREE.PlaneGeometry(1, 1, 1, 4));
    pg.translate(0, -0.5, 0);
    const vm = T(new THREE.MeshStandardMaterial({ map: strandTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xb8d8b0 }));
    const sway = { value: 0 };
    vm.onBeforeCompile = (sh) => {
      sh.uniforms.swayT = sway;
      sh.vertexShader = 'uniform float swayT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float sw = -position.y; vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); transformed.x += sin(swayT * 1.3 + ip.x * 0.3 + ip.z * 0.2) * 0.18 * sw; transformed.z += cos(swayT * 1.1 + ip.z * 0.3) * 0.12 * sw;');
    };
    vm.customProgramCacheKey = () => 'vineCurtain';
    const strands = [];
    for (const il of [...islands, ...under.map((u) => ({ x: u.x, y: u.y + 0.2, z: u.z, s: u.s }))]) {
      const k = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < k; j++) {
        const a = rnd() * Math.PI * 2;
        const r = il.s * R(0.55, 0.9);
        strands.push({ x: il.x + Math.cos(a) * r, y: il.y - 0.2, z: il.z + Math.sin(a) * r, h: R(2.5, 6), w: R(0.9, 1.8), a });
      }
    }
    for (const t of trunks) {
      for (let j = 0; j < 4; j++) {
        const a = rnd() * Math.PI * 2;
        strands.push({ x: t.x + Math.cos(a) * t.r * 0.9, y: THREE.MathUtils.lerp(t.base + 14, t.top, rnd()), z: t.z + Math.sin(a) * t.r * 0.9, h: R(5, 10), w: R(1.4, 2.4), a });
      }
    }
    const vines = new THREE.InstancedMesh(pg, vm, strands.length);
    strands.forEach((v, i) => setInst(vines, i, v.x, v.y, v.z, v.w, v.h, 1, v.a));
    g.add(vines);
    updaters.push((t) => {
      sway.value = t;
    });

    const lp = [[0, -0.32], [0.12, -0.32], [0.07, -0.25], [0.08, 0.06], [0.2, 0.055], [0.3, 0.07], [0.38, 0.1], [0.37, 0.14], [0.32, 0.22], [0.18, 0.3], [0, 0.32]];
    const mg = T(new THREE.LatheGeometry(lp.map(([x, y]) => new THREE.Vector2(x, y)), 12));
    mg.translate(0, 0.32, 0);
    const mPos = mg.attributes.position;
    const mCol = new Float32Array(mPos.count * 3);
    const mGlow = new Float32Array(mPos.count);
    const capC = new THREE.Color(0xcabfa6);
    const stemC = new THREE.Color(0xcfc4a8);
    for (let i = 0; i < mPos.count; i++) {
      const y = mPos.getY(i);
      const rr = Math.hypot(mPos.getX(i), mPos.getZ(i));
      const gill = y >= 0.3 && y <= 0.44 && rr > 0.1;
      const cap = y > 0.44;
      const c = cap || gill ? capC : stemC;
      mCol[i * 3] = c.r;
      mCol[i * 3 + 1] = c.g;
      mCol[i * 3 + 2] = c.b;
      mGlow[i] = gill ? 1 : cap ? Math.pow(Math.min(1, rr / 0.38), 3) * 0.15 : 0;
    }
    mg.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
    mg.setAttribute('glow', new THREE.BufferAttribute(mGlow, 1));
    const gm = T(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    gm.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\nvarying vec3 vTint;\n' + sh.vertexShader.replace('#include <color_vertex>', 'vColor.xyz = color.xyz; vGlow = glow; vTint = vec3(1.0);\n#ifdef USE_INSTANCING_COLOR\n vTint = instanceColor.rgb;\n#endif');
      sh.fragmentShader = 'varying float vGlow;\nvarying vec3 vTint;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.rgb;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vTint * vGlow * 2.4;');
    };
    nearFade(gm, 'glowShroom3', 9);
    const spots = [];
    for (const il of islands) {
      const n = 2 + Math.floor(il.s / 2.5);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * il.s * 0.7;
        const cx = il.x + Math.cos(a) * r;
        const cz = il.z + Math.sin(a) * r;
        for (let j = 0; j < 3; j++) spots.push({ x: cx + R(-0.6, 0.6), y: il.y + 0.25, z: cz + R(-0.6, 0.6), s: R(0.8, 2.2) });
      }
    }
    const keepOut = [];
    for (const sp of world.course.specs) {
      if (sp.t === 'secretcp' || sp.t === 'portal') keepOut.push(sp);
      if (sp.t === 'portal' && sp.to) keepOut.push(sp.to);
    }
    const nearWalk = (x, z, y) => keepOut.some((sp) => Math.hypot(sp.x - x, sp.z - z) < 4 && Math.abs(sp.y - y) < 3);
    for (const sp of world.course.specs) {
      if (sp.t === 'block' && sp.style === 'ground' && sp.sx >= 5 && !sp.bare) {
        const hx = sp.sx / 2 - 0.55;
        const hz = sp.sz / 2 - 0.55;
        for (const [cx, cz] of [[sp.x - hx, sp.z - hz], [sp.x + hx, sp.z - hz]]) {
          if (nearWalk(cx, cz, sp.y)) continue;
          spots.push({ x: cx, y: sp.y, z: cz, s: 1.1 }, { x: cx + 0.35, y: sp.y, z: cz - 0.3, s: 0.7 }, { x: cx - 0.3, y: sp.y, z: cz - 0.25, s: 0.55 });
        }
      }
    }
    const shrooms = new THREE.InstancedMesh(mg, gm, spots.length);
    const tints = [new THREE.Color(0x7affd8), new THREE.Color(0xffc070)];
    spots.forEach((m, i) => {
      setInst(shrooms, i, m.x, m.y, m.z, m.s, m.s * R(0.8, 1.3), m.s, rnd() * 6, R(-0.15, 0.15), R(-0.15, 0.15));
      shrooms.setColorAt(i, tints[rnd() < 0.7 ? 0 : 1]);
    });
    shrooms.castShadow = true;
    shrooms.receiveShadow = true;
    g.add(shrooms);

    const fn = 400;
    const FR = 25;
    const fPos2 = new Float32Array(fn * 3);
    const fSeed = new Float32Array(fn * 4);
    const fBlink = new Float32Array(fn * 3);
    for (let i = 0; i < fn; i++) {
      fSeed[i * 4] = R(-FR, FR);
      fSeed[i * 4 + 1] = R(-5, 9);
      fSeed[i * 4 + 2] = R(-FR, FR);
      fSeed[i * 4 + 3] = rnd() * 50;
      fBlink[i * 3] = R(0.6, 0.9);
      fBlink[i * 3 + 1] = rnd() * 4;
      fBlink[i * 3 + 2] = R(1.4, 3.4);
    }
    const ffg = T(new THREE.BufferGeometry());
    ffg.setAttribute('position', new THREE.BufferAttribute(fPos2, 3));
    ffg.setAttribute('blink', new THREE.BufferAttribute(fBlink, 3));
    const ffm = T(
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, scale: { value: 360 }, map: { value: TX.sprite('glow') }, color: { value: new THREE.Color(0xd8ff9a).multiplyScalar(3) }, cam: { value: new THREE.Vector3() } },
        vertexShader: `
          attribute vec3 blink; uniform float time; uniform float scale; uniform vec3 cam; varying float vA;
          void main(){
            float c = mod(time + blink.y, blink.z);
            vA = smoothstep(0.0, 0.08, c) * (1.0 - smoothstep(0.32, 0.4, c)) * smoothstep(5.0, 9.0, distance(position, cam));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = vA < 0.01 ? 0.0 : blink.x * scale / max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D map; uniform vec3 color; varying float vA;
          void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(color * a * a * vA, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const flies = new THREE.Points(ffg, ffm);
    flies.frustumCulled = false;
    const _sz = new THREE.Vector2();
    flies.onBeforeRender = (r, sc, cam) => {
      r.getDrawingBufferSize(_sz);
      ffm.uniforms.scale.value = (_sz.y * 0.5) / Math.tan(THREE.MathUtils.degToRad((cam.fov || 50) * 0.5));
    };
    g.add(flies);
    const wrap = (v) => ((((v + FR) % (2 * FR)) + 2 * FR) % (2 * FR)) - FR;
    updaters.push((t) => {
      const c = world.camera ? world.camera.position : _p.set(0, 0, 0);
      const f = world.focus || c;
      ffm.uniforms.time.value = t;
      ffm.uniforms.cam.value.copy(c);
      for (let i = 0; i < fn; i++) {
        const s = fSeed[i * 4 + 3];
        const x = f.x + wrap(fSeed[i * 4] + Math.sin(t * 0.21 + s) * 2.4 - f.x);
        let y = f.y + fSeed[i * 4 + 1] + Math.sin(t * 0.33 + s * 1.7) * 1.2;
        const z = f.z + wrap(fSeed[i * 4 + 2] + Math.cos(t * 0.17 + s * 0.6) * 2.4 - f.z);
        if (world.focus && world.view) {
          const ax = f.x - c.x;
          const ay = f.y + 0.9 - c.y;
          const az = f.z - c.z;
          const px = x - c.x;
          const py = y - c.y;
          const pz = z - c.z;
          const L2 = ax * ax + ay * ay + az * az;
          const k = Math.max(0, Math.min(1, (px * ax + py * ay + pz * az) / L2));
          const ex = px - ax * k;
          const ey = py - ay * k;
          const ez = pz - az * k;
          if (ex * ex + ey * ey + ez * ez < 9) y -= 40;
        }
        fPos2[i * 3] = x;
        fPos2[i * 3 + 1] = y;
        fPos2[i * 3 + 2] = z;
      }
      ffg.attributes.position.needsUpdate = true;
    });

  }

  return {
    sky,
    update(t, dt) {
      for (const u of updaters) u(t, dt);
    },
    dispose() {},
  };
}
