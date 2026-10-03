import * as THREE from 'three';
import { makeWind } from './wind.js';
import { STORM_LOOK } from './storm.js';
import { makeRhythm } from './rhythm.js';
import { makeTrain } from './train.js';
import { CLOCK_LOOK } from './clockwork.js';
import { blockGeo, diskGeo, vertexGradient } from './geo.js';
import * as TX from './textures.js';
import { lavaMaterial, beamMaterial, portalMaterial, nearFade, nearDim, glowColor } from './shaders.js';
import { buildDecor } from './decor.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FULL_HELP, PHYS, SWING_REACH, holdWait, swingFar, swingWait } from './levels.js';

const UP = new THREE.Vector3(0, 1, 0);
const WIDEN = new Set(['block', 'mover', 'beam', 'ice', 'stone', 'spinner', 'plank']);
const ARCH_H = 6.9;
const VINE_N = 7;
const SECRET_VIEW = 1000;
const FINISH_STAGES = 9;
const RESULT_STAGES = 2;
const PORTAL = 0xc8ff4a;
const MUSHROOM = 0x8f6cf0;
const _mm = new THREE.Matrix4();
const _mp = new THREE.Vector3();
const _mq = new THREE.Quaternion();
const _mq2 = new THREE.Quaternion();
const _ms = new THREE.Vector3();
const _me = new THREE.Euler();
const _mv = new THREE.Vector3();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
const _vd = new THREE.Vector3();
const GO = new THREE.Color(0x3ddc5a);

function oneGroup(g) {
  g.clearGroups();
  return g;
}

export const LOOKS = {
  meadow: {
    groundCap: true,
    band: false,
    mushrooms: false,
    bar: { color: 0xff4d5e, emissive: 0xff4d5e, glow: 0.5, tip: 0.2 },
    conveyor: { color: 0xffc21a, glow: 0.9 },
    gate: ['#ffffff', '#ff4d5e'],
    mats: (H) => ({
      groundTop: H.grass,
      groundSide: H.dirt,
      blockTop: H.studTop,
      blockSide: H.studSide,
      hazard: H.stripes,
      spinnerSide: H.candy,
      spinnerTop: H.studTop,
      plankSide: H.wood,
      plankTop: H.wood,
      beamSide: H.wood,
      beamTop: H.wood,
      swingSide: H.wood,
      swingTop: H.wood,
      crumble: H.crumbleSand,
      trampTop: H.trampTop,
      trampSide: H.trampSide,
      hubTop: () => H.metal(0x777d8c),
      pillarSide: H.dirt,
      pillarTop: () => H.metal(0x777d8c),
    }),
  },
  castle: {
    groundCap: false,
    band: false,
    mushrooms: false,
    bar: { color: 0xff4a1a, emissive: 0xff4a1a, glow: 2.4, tip: 1.2, tipColor: 0xffffff, flash: 1 },
    conveyor: { color: 0xff7a1a, glow: 1.8 },
    gate: ['#ffffff', '#ff4d5e'],
    curb: ['#ffffff', '#ff4d5e'],
    mats: (H) => ({
      groundTop: H.stoneTop,
      groundSide: H.brick,
      blockTop: H.metal,
      blockSide: H.metal,
      hazard: H.stripes,
      spinnerSide: H.candy,
      spinnerTop: H.metal,
      plankSide: H.metal,
      plankTop: H.metal,
      beamSide: H.stripes,
      beamTop: () => H.metal(0x9098a8),
      swingSide: () => H.metal(0x9098a8),
      swingTop: () => H.metal(0x9098a8),
      crumble: H.crumbleBasalt,
      trampTop: H.trampTop,
      trampSide: H.trampSide,
      hubTop: () => H.metal(0x777d8c),
      pillarSide: H.brick,
      pillarTop: () => H.metal(0x777d8c),
    }),
  },
  space: {
    groundCap: false,
    band: true,
    mushrooms: false,
    bar: { color: 0xff4fd8, emissive: 0xff4fd8, glow: 2.4, tip: 1.2, tipColor: 0xffffff, flash: 1 },
    conveyor: { color: 0x35e0ff, glow: 1.8 },
    gate: ['#ffffff', '#ff4d5e'],
    curb: ['#ffffff', '#ff4d5e'],
    mats: (H) => ({
      groundTop: H.snow,
      groundSide: H.iceRock,
      blockTop: H.neon,
      blockSide: H.darkSide,
      hazard: H.trim,
      spinnerSide: H.darkSide,
      spinnerTop: H.neon,
      plankSide: H.darkSide,
      plankTop: H.neon,
      beamSide: H.darkSide,
      beamTop: () => H.neon(0x35e0ff),
      swingSide: H.darkSide,
      swingTop: () => H.neon(0x35e0ff),
      crumble: H.crumbleIce,
      trampTop: () => H.neon(0xff4fd8),
      trampSide: H.darkSide,
      hubTop: () => H.neon(0xff4fd8),
      pillarSide: H.darkSide,
      pillarTop: () => H.metal(0x777d8c),
    }),
  },
  grove: {
    groundCap: true,
    band: false,
    mushrooms: true,
    bar: { color: 0xb47e50, emissive: 0x000000, glow: 0, tip: 0, tipColor: 0xc89a66, line: 0xc8202a, lineW: 0.16, edge: 0xd02a2a, bark: true, flash: 0 },
    conveyor: { color: 0x38c8dc, glow: 1.4 },
    gate: ['#6a4a30', '#3f6a3a'],
    grab: 0x38c8dc,
    strip: 0.3,
    lip: 0x7affd8,
    barkCurb: true,
    portalRing: (w) => w.std({ map: TX.bark(), color: 0xb89a78, roughness: 0.85 }),
    mats: (H) => ({
      groundTop: H.moss,
      groundSide: H.bark,
      blockTop: H.mossWood,
      blockSide: H.bark,
      hazard: H.bark,
      spinnerSide: H.bark,
      spinnerTop: H.leaf,
      plankSide: H.bark,
      plankTop: H.wood,
      beamSide: H.bark,
      beamTop: H.wood,
      swingSide: H.bark,
      swingTop: H.wood,
      crumble: H.puff,
      crumbleWarn: H.puffWarn,
      trampTop: H.trampTop,
      trampSide: H.trampSide,
      hubTop: H.wood,
      pillarSide: H.bark,
      pillarTop: H.wood,
    }),
  },
  storm: STORM_LOOK,
  clock: CLOCK_LOOK,
};

export class World {
  constructor(scene, def, course) {
    this.scene = scene;
    this.def = def;
    this.course = course;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = [];
    this.dynamic = [];
    this.crumbles = [];
    this.bars = [];
    this.cps = [];
    this.coins = [];
    this.bigStars = [];
    this.animated = [];
    this.chests = [];
    this.mats = new Map();
    this.owned = [];
    this.convTex = [];
    this.ferryFx = [];
    this.shaderMats = [];
    this.time = 0;
    this.landP = { value: new THREE.Vector4(0, -999, 0, -99) };
    this.landNow = { value: 0 };
    this.events = null;
    this.nextCp = 1;
    this.help = def.help;
    this.look = LOOKS[def.look];
    this.padFx = [];
    this.swings = [];
    this.lastStage = course.specs.reduce((m, s) => (s.secret ? m : Math.max(m, s.stage || 0)), 0);
    this.waiting = new Map();
    this.waitD = new Map();
    this.farView = null;
    this.holders = [];
    this.holding = new Set();
    this.mushrooms = [];
    this.portals = [];
    this.stageGroups = [];
    this.statics = new Set();
    this.batches = [];
    this.window = null;
    this.beamOn = new THREE.Color(def.cpColor);
    this.stopA = new THREE.Color(def.waitStrip[0]);
    this.stopB = new THREE.Color(def.waitStrip[1]);
    this.beamNext = new THREE.Color(0xffc21a);
    this.beamFinish = new THREE.Color(0xfff2cc);
    this.buildCourse();
    this.buildCoins();
    this.wind = makeWind(this);
    this.rhythm = makeRhythm(this);
    this.train = makeTrain(this);
    this.decor = buildDecor(this);
    this.setWindow(0);
  }

  stageGroup(i) {
    if (!this.stageGroups[i]) {
      const g = new THREE.Group();
      g.userData.stage = i;
      this.group.add(g);
      this.stageGroups[i] = g;
    }
    return this.stageGroups[i];
  }

  viewOf(s) {
    return s.secret ? SECRET_VIEW + s.stage : s.stage;
  }

  setWindow(cp) {
    if (this.window === cp) return;
    this.window = cp;
    this.stageGroups.forEach((g, i) => {
      if (g) g.visible = this.inWindow(i);
    });
    if (this.stemMesh) this.placeStems();
    if (this.vinePosts) this.placeFrames();
  }

  inWindow(view) {
    if (this.window === 'all') return view < SECRET_VIEW && view > this.lastStage - FINISH_STAGES;
    if (this.window === 'end') return view < SECRET_VIEW && view > this.lastStage - RESULT_STAGES;
    if (view >= SECRET_VIEW) return this.window === view - SECRET_VIEW;
    return view >= this.window - 1 && view <= this.window + 4;
  }

  track(o) {
    this.owned.push(o);
    return o;
  }

  mat(key, make) {
    if (!this.mats.has(key)) this.mats.set(key, this.track(make()));
    return this.mats.get(key);
  }

  std(o) {
    return new THREE.MeshStandardMaterial(o);
  }

  paletteColor(i) {
    const p = this.def.palette;
    return p[(i || 0) % p.length];
  }

  styleMats(style, ci, shape, spec) {
    const c = this.paletteColor(ci);
    const box = (side, top) => [side, side, top, side, side, side];
    const pick = (side, top) => (shape === 'box' ? box(side, top) : [top, side]);
    const key = `${style}_${ci}_${shape}_${spec.conv ? spec.conv.dir : ''}`;
    const cached = this.mats.get(key);
    if (cached) return cached;
    const L = this.lookMats();
    const S = (o) => this.std({ vertexColors: true, ...o });
    let m;
    switch (style) {
      case 'ground':
      case 'arena':
        m = pick(L.groundSide(), L.groundTop());
        break;
      case 'block':
      case 'mover':
        m = pick(L.blockSide(c), L.blockTop(c));
        break;
      case 'swing':
        m = pick(L.swingSide(), L.swingTop());
        break;
      case 'spinner':
        m = pick(L.spinnerSide(c), L.spinnerTop(c));
        break;
      case 'plank':
        m = pick(L.plankSide(c), L.plankTop(c));
        break;
      case 'beam':
        m = pick(L.beamSide(), L.beamTop());
        break;
      case 'crumble': {
        const top = L.crumble();
        m = pick(top, top);
        break;
      }
      case 'pad': {
        const top = this.mat('padTop', () => S({ color: 0x2a4fb8, emissiveMap: TX.padArrows(), emissive: 0xffd22e, emissiveIntensity: 2.2, roughness: 0.4 }));
        m = pick(L.hazard(), top);
        break;
      }
      case 'tramp':
        m = pick(L.trampSide(), L.trampTop());
        break;
      case 'conveyor': {
        const dir = spec.conv.dir;
        const t = TX.conveyor(dir).clone();
        t.needsUpdate = true;
        this.track(t);
        const f = LOOKS[this.def.look].conveyor;
        const top = this.track(S({ map: t, emissiveMap: t, emissive: f.color, emissiveIntensity: f.glow, roughness: 0.6 }));
        this.convTex.push({ t, dir, speed: spec.conv.speed });
        m = pick(L.hazard(), top);
        break;
      }
      case 'curb': {
        if (LOOKS[this.def.look].barkCurb) {
          m = pick(L.groundSide(), L.blockTop());
          break;
        }
        const rc = this.look.curb || this.def.rail || ['#ffffff', '#ff4d5e'];
        const cm = this.mat('candyRed', () => S({ map: TX.candy(rc[0], rc[1]), roughness: 0.5 }));
        m = pick(cm, cm);
        break;
      }
      case 'gate': {
        const gc = LOOKS[this.def.look].gate;
        const gm = this.mat('gate', () => S({ map: TX.candy(gc[0], gc[1]), roughness: 0.5 }));
        m = pick(gm, gm);
        break;
      }
      case 'hub':
      case 'axle':
        m = pick(L.hazard(), L.hubTop());
        break;
      case 'pillar':
        m = pick(L.pillarSide(), L.pillarTop());
        break;
      case 'stone': {
        const st = this.mat('stoneGlow', () => S({ map: TX.rock('basalt'), emissiveMap: TX.crackGlow(), emissive: 0xff4a00, emissiveIntensity: 1.2, roughness: 0.85 }));
        const t = this.mat('stoneTopDark', () => S({ map: TX.stoneTop(), color: 0x8a7a90, roughness: 0.8 }));
        m = pick(st, t);
        break;
      }
      case 'ice': {
        const im = this.mat('ice', () => S({ map: TX.ice(), color: 0x9cdcff, roughness: 0.06, metalness: 0.05, envMapIntensity: 1.6 }));
        m = pick(im, im);
        break;
      }
      case 'lava': {
        const l = this.mat('lava', () => lavaMaterial());
        if (!this.shaderMats.includes(l)) this.shaderMats.push(l);
        m = pick(l, l);
        break;
      }
      default:
        m = pick(L.blockSide(c), L.blockTop(c));
    }
    this.mats.set(key, m);
    return m;
  }

  lookMats() {
    if (this.lookCache) return this.lookCache;
    const S = (o) => this.std({ vertexColors: true, ...o });
    const tint = (key, col, o, post = (m) => m) =>
      this.mat(key + col, () => {
        const m = post(S({ ...o, color: col }));
        m.userData.tint = { base: this.mat(key + 'base', () => post(S({ ...o, color: 0xffffff }))), color: new THREE.Color(col) };
        return m;
      });
    const glowMoss = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.landP = this.landP;
        sh.uniforms.landNow = this.landNow;
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n { vec4 q = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n q = instanceMatrix * q;\n#endif\n vWP = (modelMatrix * q).xyz; }');
        sh.fragmentShader =
          'uniform vec4 landP;\nuniform float landNow;\nvarying vec3 vWP;\n' +
          sh.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n { vec2 mc = floor(vWP.xz * 3.0); float mh = fract(sin(dot(mc, vec2(12.9898, 78.233))) * 43758.5453); float md = step(0.8, mh) * smoothstep(0.3, 0.08, length(fract(vWP.xz * 3.0) - 0.5)); float age = landNow - landP.w; float ring = (1.0 - smoothstep(0.6, 2.6, length(vWP.xz - landP.xz))) * (1.0 - smoothstep(0.0, 1.5, age)) * step(abs(vWP.y - landP.y), 0.6) * step(0.0, age); totalEmissiveRadiance += vec3(0.48, 1.0, 0.85) * (md * (0.12 + 1.7 * ring) + ring * 0.1); }',
          );
      };
      m.customProgramCacheKey = () => 'mossGlow';
      return m;
    };
    const H = {
      studTop: (col) => tint('studTop', col, { map: TX.studTop(), roughness: 0.48, metalness: 0.02 }),
      studSide: (col) => tint('studSide', col, { map: TX.studSide(), roughness: 0.55 }),
      metal: (col) => tint('metal', col, { map: TX.metal(), roughness: 0.4, metalness: 0.45 }),
      neon: (col) => this.mat('neon' + col, () => S({ map: TX.darkPanel(), color: 0xb8c0e8, emissiveMap: TX.neonPanel(), emissive: col, emissiveIntensity: 2.4, roughness: 0.35, metalness: 0.3 })),
      darkSide: () => this.mat('darkSide', () => S({ map: TX.darkPanel(), color: 0x9aa4d8, roughness: 0.4, metalness: 0.3 })),
      stripes: () => this.mat('hazard', () => S({ map: TX.hazard(), roughness: 0.5 })),
      trim: () => this.mat('trim', () => S({ map: TX.darkPanel(), color: 0x7a6aa8, emissive: 0xff4fd8, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.3 })),
      wood: () => this.mat('wood', () => S({ map: TX.wood(), roughness: 0.75 })),
      candy: (col) => this.mat('candy' + col, () => S({ map: TX.candy('#ffffff', '#' + new THREE.Color(col).getHexString()), roughness: 0.5 })),
      trampTop: () => this.mat('trampTop', () => S({ map: TX.trampTop(), roughness: 0.45 })),
      trampSide: () => this.mat('trampSide', () => S({ color: 0x2f7fe8, roughness: 0.35, metalness: 0.3 })),
      grass: () => this.mat('grass', () => S({ map: TX.grass(), roughness: 0.92 })),
      dirt: () => this.mat('dirt', () => S({ map: TX.rock('dirt'), roughness: 0.95 })),
      stoneTop: () => this.mat('stoneTop', () => S({ map: TX.stoneTop(), color: 0xd8c8e0, roughness: 0.8 })),
      brick: () => this.mat('brick', () => S({ map: TX.brick(), roughness: 0.9 })),
      snow: () => this.mat('snow', () => S({ map: TX.snow(), color: 0x8a9ade, roughness: 0.6, envMapIntensity: 0.9 })),
      iceRock: () =>
        this.mat('iceRock', () => {
          const m = S({ map: TX.rock('ice'), roughness: 0.15, metalness: 0.05, envMapIntensity: 1.3 });
          m.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(0.42, 0.34, 0.7), vec3(1.0), smoothstep(0.6, 0.92, vColor.r));');
          };
          m.customProgramCacheKey = () => 'iceRockLav';
          return m;
        }),
      crumbleSand: () => this.mat('crumble1', () => S({ map: TX.crackedTop(), color: 0xffc56b, roughness: 0.8 })),
      crumbleBasalt: () => this.mat('crumble2', () => S({ map: TX.rock('basalt'), emissiveMap: TX.crackGlow(), emissive: 0xff5a00, emissiveIntensity: 2.2, roughness: 0.85 })),
      crumbleIce: () => this.mat('crumble3', () => S({ map: TX.ice(), color: 0xcfefff, emissiveMap: TX.crackGlow(), emissive: 0x35d8ff, emissiveIntensity: 1.8, roughness: 0.1, envMapIntensity: 1.4 })),
      moss: () => this.mat('moss', () => glowMoss(S({ map: TX.moss(), roughness: 0.95 }))),
      bark: () => this.mat('bark', () => S({ map: TX.bark(), roughness: 0.92 })),
      mossWood: (col) => tint('mossWood', new THREE.Color(0xffffff).lerp(new THREE.Color(col), 0.45).getHex(), { map: TX.mossWood(), roughness: 0.82 }, glowMoss),
      leaf: () => this.mat('leaf', () => S({ map: TX.leaf(), roughness: 0.55 })),
      puff: () => this.mat('puff', () => S({ map: TX.puff(), color: 0xbfb39a, roughness: 0.9, emissiveMap: TX.crackGlow(), emissive: 0x8a3020, emissiveIntensity: 0.6 })),
      puffWarn: () => this.mat('puffWarn', () => S({ map: TX.puff(), color: 0xb89a90, roughness: 0.9, emissiveMap: TX.crackGlow(), emissive: 0xff3020, emissiveIntensity: 2.2 })),
      tint,
      std: (key, o) => this.mat(key, () => S(o)),
      woodMap: () => TX.wood(),
    };
    this.lookCache = LOOKS[this.def.look].mats(H);
    return this.lookCache;
  }

  buildCourse() {
    for (const s of this.course.specs) {
      const sg = this.stageGroup(this.viewOf(s));
      const n0 = this.group.children.length;
      this.addSpec(s);
      while (this.group.children.length > n0) sg.add(this.group.children[n0]);
    }
    for (const c of this.colliders) {
      if (c.surface === 'tramp' && c.target) c.targetCol = this.colliders.find((k) => k.crumble && k.spec.x === c.target.x && k.spec.y === c.target.y && k.spec.z === c.target.z) || null;
    }
    if (this.mushrooms.length) this.buildMushrooms();
    if (this.swings.length) this.buildVines();
    if (this.look.lip) this.buildLips();
    this.stageGroups.forEach((g, i) => {
      if (g) this.batchStage(g, i);
    });
  }

  batchStage(sg, stage) {
    sg.updateMatrixWorld(true);
    const buckets = new Map();
    const originals = [];
    sg.traverse((o) => {
      if (!o.isMesh || !this.statics.has(o)) return;
      originals.push(o);
      const geo = o.geometry;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = geo.groups.length && Array.isArray(o.material) ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }];
      const sig = Object.keys(geo.attributes).sort().join(',');
      for (const g of groups) {
        const src = mats[g.materialIndex];
        const t = src.userData.tint && geo.attributes.color ? src.userData.tint : null;
        const mat = t ? t.base : src;
        const key = mat.uuid + '|' + sig + '|' + (o.castShadow ? 1 : 0);
        if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, parts: [] });
        buckets.get(key).parts.push({ o, g, t });
      }
    });
    if (!originals.length) return;
    const merged = [];
    for (const b of buckets.values()) {
      const pieces = b.parts.map(({ o, g, t }) => {
        const src = o.geometry;
        const idx = src.index ? src.index.array.subarray(g.start, g.start + g.count) : Uint32Array.from({ length: g.count }, (_, i) => g.start + i);
        const used = new Map();
        const order = [];
        for (const v of idx) if (!used.has(v)) {
          used.set(v, order.length);
          order.push(v);
        }
        const piece = new THREE.BufferGeometry();
        for (const [name, a] of Object.entries(src.attributes)) {
          const out = new Float32Array(order.length * a.itemSize);
          order.forEach((v, i) => {
            for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.array[v * a.itemSize + k];
          });
          piece.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
        }
        piece.setIndex(Array.from(idx, (v) => used.get(v)));
        piece.applyMatrix4(o.matrixWorld);
        if (t) {
          const ca = piece.attributes.color;
          for (let i = 0; i < ca.count; i++) ca.setXYZ(i, ca.getX(i) * t.color.r, ca.getY(i) * t.color.g, ca.getZ(i) * t.color.b);
        }
        return piece;
      });
      const geo = this.track(mergeGeometries(pieces, false));
      for (const pc of pieces) pc.dispose();
      const mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      sg.add(mesh);
      merged.push(mesh);
    }
    for (const o of originals) o.visible = false;
    this.batches[stage] = { merged, originals };
  }

  addSpec(s) {
    if (s.t === 'block') this.addBlock(s);
    else if (s.t === 'disk') this.addDisk(s);
    else if (s.t === 'bar') this.addBar(s);
    else if (s.t === 'cp') this.addCheckpoint(s, false);
    else if (s.t === 'finish') this.addCheckpoint(s, true);
    else if (s.t === 'start') this.addArch(s.x, s.y, s.z - 1.4, 'BAŞLA', false);
    else if (s.t === 'bigstar') this.addBigStar(s);
    else if (s.t === 'takeoff') this.addTakeoff(s);
    else if (s.t === 'chest') this.addChest(s);
    else if (s.t === 'rail') this.addRail(s);
    else if (s.t === 'portal') this.addPortal(s);
    else if (s.t === 'secretcp') this.addSecretPad(s);
    else if (s.t === 'trunk') this.addTrunk(s);
  }

  addCollider(c, s, obj) {
    Object.assign(c, {
      dx: 0,
      dy: 0,
      dz: 0,
      dyaw: 0,
      active: true,
      surface: s.surface || null,
      kill: !!s.kill,
      power: s.power || 0,
      target: s.target || null,
      obj,
      spec: s,
      style: s.style,
      stage: s.stage,
      squash: 0,
    });
    if (s.conv) {
      const d = { z: [0, 1], 'x+': [1, 0], 'x-': [-1, 0] }[s.conv.dir];
      c.conv = { vx: d[0] * s.conv.speed, vz: d[1] * s.conv.speed };
    }
    if (s.move || s.spin || s.swing) {
      c.base = { x: c.x, y: c.y, z: c.z, yaw: c.yaw };
      c.move = s.move || null;
      c.swing = s.swing || null;
      c.spin = s.spin || 0;
      c.ph = 0;
      c.slow = 1;
      if (s.wait) {
        c.wait = s.wait;
        this.holders.push(c);
      }
      this.dynamic.push(c);
    }
    if (s.guard) {
      c.guard = true;
      c.open = 0;
    }
    if (s.crumble) {
      c.crumble = { delay: s.crumble.delay, hold: !!s.crumble.hold, on: -1, state: 'idle', t: 0, base: obj.position.clone() };
      this.crumbles.push(c);
    }
    if (!s.nocollide) this.colliders.push(c);
    return c;
  }

  coalesce(geo, mats) {
    const uniq = [...new Set(geo.groups.map((g) => mats[g.materialIndex]))];
    if (uniq.length === geo.groups.length) return [geo, mats];
    const slots = geo.groups.map((g) => uniq.indexOf(mats[g.materialIndex]));
    const key = geo.uuid + ':' + slots.join('');
    this.merged = this.merged || new Map();
    let out = this.merged.get(key);
    if (!out) {
      out = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(geo.attributes)) out.setAttribute(k, a);
      const src = geo.index ? geo.index.array : Uint32Array.from({ length: geo.attributes.position.count }, (_, i) => i);
      const idx = new src.constructor(geo.groups.reduce((n, g) => n + g.count, 0));
      let o = 0;
      for (let u = 0; u < uniq.length; u++) {
        const start = o;
        geo.groups.forEach((g, i) => {
          if (slots[i] !== u) return;
          idx.set(src.subarray(g.start, g.start + g.count), o);
          o += g.count;
        });
        if (uniq.length > 1) out.addGroup(start, o - start, u);
      }
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      this.merged.set(key, this.track(out));
    }
    return [out, uniq.length === 1 ? uniq[0] : uniq];
  }

  addMesh(geo, mats, cast = true) {
    if (Array.isArray(mats) && geo.groups.length > 1) [geo, mats] = this.coalesce(geo, mats);
    const m = new THREE.Mesh(geo, mats);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  }

  addBlock(s) {
    const cy = s.y - s.sy / 2;
    const obj = new THREE.Group();
    obj.position.set(s.x, cy, s.z);
    obj.rotation.y = s.yaw || 0;
    if (s.style === 'ground' && this.look.groundCap) {
      const body = this.addMesh(blockGeo(s.sx, s.sy - 0.3, s.sz, 0.3, 2.5), this.styleMats('ground', 0, 'box', s)[0]);
      body.position.y = -0.15;
      const cap = this.addMesh(blockGeo(s.sx + 0.26, 0.44, s.sz + 0.26, 0.2, 2.5), this.styleMats('ground', 0, 'box', s)[2]);
      cap.position.y = s.sy / 2 - 0.22;
      obj.add(body, cap);
      if (this.isStatic(s)) this.statics.add(body).add(cap);
    } else {
      const tile = s.style === 'ground' || s.style === 'stone' ? 2.5 : s.style === 'conveyor' ? 1.6 : 2;
      const mesh = this.addMesh(blockGeo(s.sx, s.sy, s.sz, s.style === 'beam' || s.style === 'curb' ? 0.14 : 0.24, tile), this.styleMats(s.style, s.color, 'box', s));
      obj.add(mesh);
      if (this.isStatic(s)) this.statics.add(mesh);
      if (this.look.band && (s.style === 'block' || s.style === 'mover' || s.style === 'plank')) {
        const band = this.addMesh(blockGeo(s.sx + 0.14, 0.14, s.sz + 0.14, 0.07, 2), this.mat('band' + s.color, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(this.paletteColor(s.color)).multiplyScalar(2.2) })), false);
        band.position.y = -s.sy * 0.18;
        obj.add(band);
        if (this.isStatic(s)) this.statics.add(band);
      }
    }
    this.group.add(obj);
    const c = { shape: 'box', x: s.x, y: cy, z: s.z, hx: s.sx / 2, hy: s.sy / 2, hz: s.sz / 2, yaw: s.yaw || 0 };
    const col = this.addCollider(c, s, obj);
    if (s.chevrons) this.addChevrons(col, obj, s);
    if (s.swing) this.swings.push(col);
    if (s.style === 'pad') this.addPadFx(obj, s);
    return col;
  }

  padLook() {
    return this.def.pad || { top: 0x39425e, idle: 0x9fb4d8, idleK: 0.5, onK: 0.9 };
  }

  landed(x, y, z) {
    this.landP.value.set(x, y, z, this.time);
  }

  isStatic(s) {
    return !s.move && !s.spin && !s.swing && !s.crumble && !s.chevrons && s.style !== 'tramp';
  }

  alphaBasic(key, o) {
    return this.mat(key, () => {
      const m = new THREE.MeshBasicMaterial(o);
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float instAlpha;\nvarying float vIA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vIA = instAlpha;');
        sh.fragmentShader = 'varying float vIA;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a *= vIA;');
      };
      m.customProgramCacheKey = () => 'instAlpha' + key;
      return m;
    });
  }

  alphaInst(geo, mat, n) {
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    const g = this.track(geo.clone());
    g.setAttribute('instAlpha', alpha);
    const im = new THREE.InstancedMesh(g, mat, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { im, alpha };
  }

  addPadFx(obj, s) {
    const r = Math.min(s.sx, s.sz) * 0.46;
    const g = this.mat('padRingGeo' + r.toFixed(2), () => new THREE.TorusGeometry(r, 0.14, 8, 40).rotateX(Math.PI / 2));
    const rm = this.alphaBasic('padRing', { color: 0xffe14a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const rings = this.alphaInst(g, rm, 3);
    rings.im.renderOrder = 3;
    obj.add(rings.im);
    const ag = this.mat('padArrowGeo', () => {
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, 0.55);
      arrowShape.lineTo(0.5, 0);
      arrowShape.lineTo(0.2, 0);
      arrowShape.lineTo(0.2, -0.5);
      arrowShape.lineTo(-0.2, -0.5);
      arrowShape.lineTo(-0.2, 0);
      arrowShape.lineTo(-0.5, 0);
      arrowShape.closePath();
      const a0 = new THREE.ShapeGeometry(arrowShape).scale(1.4, 1.4, 1.4);
      const a1 = a0.clone().rotateY(Math.PI / 2);
      const m = mergeGeometries([a0, a1], false);
      a0.dispose();
      a1.dispose();
      return m;
    });
    const am = this.mat('padArrow', () => new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    const arrow = new THREE.Mesh(ag, am);
    arrow.renderOrder = 3;
    obj.add(arrow);
    this.padFx.push({ rings, arrow, am, base: s.sy / 2 });
  }

  addChevrons(c, obj, s) {
    const g = this.mat('chevGeo', () => {
      const shape = new THREE.Shape();
      const w = 1.35;
      const t = 0.5;
      shape.moveTo(-w, -0.35);
      shape.lineTo(0, 0.35);
      shape.lineTo(w, -0.35);
      shape.lineTo(w, -0.35 - t);
      shape.lineTo(0, 0.35 - t);
      shape.lineTo(-w, -0.35 - t);
      shape.closePath();
      return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
    });
    const group = new THREE.Group();
    group.position.y = s.sy / 2 + 0.03;
    const cm = this.alphaBasic('chevron', { color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const grab = this.look.grab;
    const ch = this.alphaInst(grab ? this.mat('grabGeo' + s.sx.toFixed(2), () => new THREE.BoxGeometry(s.sx - 0.5, 0.06, 0.22)) : g, cm, 6);
    const yellow = new THREE.Color(0xffe600);
    const navy = new THREE.Color(0x1f2a44);
    if (grab) {
      const edge = new THREE.Color(grab).multiplyScalar(1.6);
      for (let i = 0; i < 6; i++) {
        _mm.compose(_mp.set(0, 0.02, -(s.sz / 2 - 0.2)), _mq.identity(), _ms.setScalar(i === 3 ? 1 : 0));
        ch.im.setMatrixAt(i, _mm);
        ch.im.setColorAt(i, edge);
        ch.alpha.setX(i, i === 3 ? 1 : 0);
      }
    }
    for (let i = 0; i < 3 && !grab; i++) {
      _mm.compose(_mp.set(0, 0, (1 - i) * 1.25 + 0.12), _mq.identity(), _ms.set(1.22, 1, 1.5));
      ch.im.setMatrixAt(i, _mm);
      ch.im.setColorAt(i, navy);
      ch.alpha.setX(i, 0.85);
      _mm.makeTranslation(0, 0.004, (1 - i) * 1.25);
      ch.im.setMatrixAt(i + 3, _mm);
      ch.im.setColorAt(i + 3, yellow);
    }
    ch.im.renderOrder = 3;
    group.add(ch.im);
    obj.add(group);
    const gates = [];
    let gateMesh = null;
    if (s.guard) {
      const gateG = this.mat('gateGeo' + s.sx.toFixed(2), () => {
        const parts = [blockGeo(s.sx - 0.3, 0.22, 0.22, 0.08, 1).clone().translate(0, 0.62, 0)];
        for (const sx of [-1, 1]) parts.push(blockGeo(0.24, 0.75, 0.24, 0.08, 1).clone().translate(sx * (s.sx / 2 - 0.2), 0.36, 0));
        const merged = mergeGeometries(parts, false);
        for (const pc of parts) pc.dispose();
        return merged;
      });
      gateMesh = new THREE.InstancedMesh(gateG, this.styleMats('gate', 0, 'box', s)[0], 2);
      gateMesh.castShadow = true;
      gateMesh.receiveShadow = true;
      gateMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      obj.add(gateMesh);
      [1, -1].forEach((side, i) => gates.push({ i, side, k: 1, z: side * (s.sz / 2 - 0.14) }));
    }
    this.ferryFx.push({ c, ch, gates, gateMesh, edges: [] });
  }

  addRail(s) {
    const len = s.z0 - s.z1;
    const cz = (s.z0 + s.z1) / 2;
    const railM = this.mat('ferryRail', () => this.std({ color: 0x8c95a8, roughness: 0.35, metalness: 0.6 }));
    const railG = this.track(new THREE.BoxGeometry(0.18, 0.16, len));
    const stopG = this.track(new THREE.BoxGeometry(0.4, 0.5, 0.3));
    const stopM = this.mat('ferryStop', () => this.std({ color: 0xffc21a, roughness: 0.5 }));
    const obj = new THREE.Group();
    obj.position.set(s.x, s.y - 0.9, cz);
    for (const side of s.bare ? [] : [-1, 1]) {
      const r = this.addMesh(railG, railM);
      r.position.x = side * s.w * 0.3;
      obj.add(r);
      this.statics.add(r);
      for (const end of [-1, 1]) {
        const st = this.addMesh(stopG, stopM);
        st.position.set(side * s.w * 0.3, 0.1, end * (len / 2 - 0.15));
        obj.add(st);
        this.statics.add(st);
      }
    }
    this.group.add(obj);
    const f = this.ferryFx[this.ferryFx.length - 1];
    if (!f) return;
    const sd = this.look.strip || 0.9;
    const edgeG = this.track(new THREE.BoxGeometry(s.w + 0.6, 0.1, sd));
    for (const [z, side] of [[s.z0 + sd / 2 + 0.01, 1], [s.z1 - sd / 2 - 0.01, -1]]) {
      const m = this.track(new THREE.MeshBasicMaterial({ color: this.def.waitStrip[0], toneMapped: false }));
      const e = new THREE.Mesh(edgeG, m);
      e.position.set(s.x, s.y + 0.8 + 0.04, z);
      this.group.add(e);
      f.edges.push({ m, side });
    }
  }

  addDisk(s) {
    const cy = s.y - s.sy / 2;
    const obj = new THREE.Group();
    obj.position.set(s.x, cy, s.z);
    if (s.style === 'tramp' && this.look.mushrooms) {
      this.group.add(obj);
      const mc = this.addCollider({ shape: 'cyl', x: s.x, y: cy, z: s.z, r: s.r, hy: s.sy / 2, yaw: 0 }, s, obj);
      this.mushrooms.push({ c: mc, x: s.x, y: s.y, z: s.z, r: s.r, view: this.viewOf(s), ph: this.mushrooms.length * 1.7 });
      return mc;
    }
    const mats = this.styleMats(s.style, s.color, 'disk', s);
    const mesh = this.addMesh(diskGeo(s.r, s.sy, s.style === 'tramp' ? 0.25 : 0.2, s.style === 'tramp' ? s.r * 2 : 2), mats);
    if (s.style === 'tramp') {
      const t = mesh.geometry;
      if (!t.userData.trampUv) {
        const pos = t.attributes.position;
        const uv = t.attributes.uv;
        const nor = t.attributes.normal;
        for (let i = 0; i < pos.count; i++) {
          if (nor.getY(i) > 0.75) uv.setXY(i, pos.getX(i) / (s.r * 2) + 0.5, -pos.getZ(i) / (s.r * 2) + 0.5);
        }
        uv.needsUpdate = true;
        t.userData.trampUv = true;
      }
      const legM = this.mat('trampLeg', () => this.std({ color: 0x3a3f4f, roughness: 0.4, metalness: 0.6 }));
      const legG = this.mat('trampLegs' + s.r.toFixed(2), () => {
        const legs = [];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          legs.push(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8).translate(Math.cos(a) * s.r * 0.75, -0.9, Math.sin(a) * s.r * 0.75));
        }
        const m = mergeGeometries(legs, false);
        for (const l of legs) l.dispose();
        return m;
      });
      obj.add(this.addMesh(legG, legM));
    }
    obj.add(mesh);
    if (s.style === 'spinner' && s.spin && this.look.spinArrows) obj.add(this.spinArrows(s));
    if (this.isStatic(s)) this.statics.add(mesh);
    this.group.add(obj);
    const c = { shape: 'cyl', x: s.x, y: cy, z: s.z, r: s.r, hy: s.sy / 2, yaw: 0 };
    if (s.style === 'tramp') c.meshY = mesh;
    return this.addCollider(c, s, obj);
  }

  poleKnobGeo() {
    const paint = (g, hex) => {
      const c = new THREE.Color(hex);
      const col = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    };
    const pole = paint(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 10).translate(0, 1.8, 0), 0xf2f4f8);
    const knob = paint(new THREE.SphereGeometry(0.2, 12, 10).translate(0, 3.65, 0), 0xffc21a);
    const m = mergeGeometries([pole, knob], false);
    pole.dispose();
    knob.dispose();
    return m;
  }

  poleKnobMat() {
    const m = this.std({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.55 });
    const glow = new THREE.Color(0xffa000).multiplyScalar(0.6);
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 totalEmissiveRadiance += vec3(${glow.r.toFixed(4)}, ${glow.g.toFixed(4)}, ${glow.b.toFixed(4)}) * step(vColor.b, 0.5);`);
    };
    m.customProgramCacheKey = () => 'poleKnob';
    return m;
  }

  padNear(x, y, z) {
    if (!this.def.padJump) return null;
    for (const c of this.colliders) {
      if (c.surface !== 'pad' || !c.active) continue;
      if (Math.abs(x - c.x) < c.hx + 0.9 && Math.abs(z - c.z) < c.hz + 0.9 && Math.abs(y - (c.y + c.hy)) < 0.5) return c;
    }
    return null;
  }

  spinArrows(s) {
    const g = this.mat('spinArrowGeo' + s.r.toFixed(2), () => {
      const parts = [];
      const r0 = s.r * 0.66;
      const r1 = s.r * 0.84;
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3) * Math.PI * 2;
        const a1 = a0 + 1.1;
        const sh = new THREE.Shape();
        sh.absarc(0, 0, r1, a0, a1, false);
        const rm = (r0 + r1) / 2;
        const w = (r1 - r0) * 1.1;
        sh.lineTo(Math.cos(a1) * (r1 + w * 0.45), Math.sin(a1) * (r1 + w * 0.45));
        sh.lineTo(Math.cos(a1 + 0.42) * rm, Math.sin(a1 + 0.42) * rm);
        sh.lineTo(Math.cos(a1) * (r0 - w * 0.45), Math.sin(a1) * (r0 - w * 0.45));
        sh.absarc(0, 0, r0, a1, a0, true);
        sh.closePath();
        const sg = new THREE.ShapeGeometry(sh, 10);
        parts.push(sg.index ? sg.toNonIndexed() : sg);
      }
      const m = mergeGeometries(parts, false).rotateX(-Math.PI / 2);
      for (const p of parts) p.dispose();
      return m;
    });
    const c = new THREE.Color(this.paletteColor(s.color));
    const dark = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.3;
    const am = this.mat('spinArrow' + (dark ? 'L' : 'D'), () => new THREE.MeshBasicMaterial({ color: dark ? 0xf1e9d6 : 0x2a52c8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    const m = new THREE.Mesh(g, am);
    m.position.y = s.sy / 2 + 0.012;
    if (s.spin < 0) m.scale.x = -1;
    return m;
  }

  addBar(s) {
    const f = this.look.bar;
    const m = this.mat('bar', () => {
      if (!f.bark) return this.std({ color: f.color, emissive: f.emissive, emissiveIntensity: f.glow, roughness: 0.35, metalness: 0.2 });
      const t = TX.bark().clone();
      t.repeat.set(1, 3);
      t.needsUpdate = true;
      this.track(t);
      return this.std({ map: t, color: f.color, emissive: f.emissive, emissiveIntensity: f.glow, roughness: 0.9 });
    });
    const tipC = f.tipColor || 0xffffff;
    const tipM = this.mat('barTip', () => this.std({ color: tipC, emissive: tipC, emissiveIntensity: f.tip, roughness: 0.3 }));
    const obj = new THREE.Group();
    obj.position.set(s.x, s.y, s.z);
    const g = this.track(new THREE.CylinderGeometry(s.radius, s.radius, s.len, 16, 1));
    g.rotateZ(Math.PI / 2);
    g.translate(s.len / 2, 0, 0);
    const tg = this.track(f.bark ? new THREE.CylinderGeometry(s.radius * 1.01, s.radius * 1.01, 0.08, 16, 1).rotateZ(Math.PI / 2) : new THREE.SphereGeometry(s.radius * 1.35, 16, 12));
    const lw = f.lineW || 0.7;
    const lg = f.line ? this.mat('barLineGeo' + s.len + '|' + lw, () => new THREE.PlaneGeometry(s.len, lw).rotateX(-Math.PI / 2).translate(s.len / 2, 0, 0)) : null;
    const near = (mm, key) => (f.near ? nearDim(mm, key, f.near[0], f.near[1]) : mm);
    const lm = f.line ? this.mat('barLine', () => near(f.lineW ? new THREE.MeshBasicMaterial({ color: f.line, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }) : new THREE.MeshBasicMaterial({ color: glowColor(f.line, f.lineGlow), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 'barLine')) : null;
    const eg = f.edge ? this.track(new THREE.CylinderGeometry(s.radius * 1.08, s.radius * 1.08, 0.16, 16, 1).rotateZ(Math.PI / 2)) : null;
    const em = f.edge ? this.mat('barEdge', () => this.std({ color: f.edge, roughness: 0.7 })) : null;
    for (let k = 0; k < s.arms; k++) {
      const arm = new THREE.Group();
      arm.rotation.y = (k / s.arms) * Math.PI * 2;
      const bar = this.addMesh(g, m);
      const tip = this.addMesh(tg, tipM);
      tip.position.x = s.len;
      arm.add(bar, tip);
      if (eg) {
        const edge = this.addMesh(eg, em);
        edge.position.x = s.len - 0.32;
        arm.add(edge);
      }
      if (lg) {
        const line = new THREE.Mesh(lg, lm);
        line.position.y = -0.52;
        line.renderOrder = 2;
        arm.add(line);
      }
      obj.add(arm);
    }
    this.group.add(obj);
    this.barMat = m;
    this.barGlow = f.glow;
    this.barFlash = f.flash ?? 1;
    this.bars.push({ x: s.x, y: s.y, z: s.z, len: s.len, radius: s.radius, speed: s.speed, arms: s.arms, phase: s.phase || 0, angle: s.phase || 0, push: !!s.push, line: !!f.line, flash: 0, stage: s.stage, ph: 0, slow: 1, obj });
  }

  addCheckpoint(s, finish) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const pd = this.padLook();
    const padTop = this.track(this.std({ color: pd.top, emissiveMap: TX.ring(), emissive: finish ? 0xffc21a : pd.idle, emissiveIntensity: finish ? 1.2 : pd.idleK, roughness: 0.4 }));
    const padSide = this.mat('padSide', () => this.std({ color: 0xe8eef8, roughness: 0.4, vertexColors: true }));
    const pad = this.addMesh(diskGeo(finish ? 3.2 : 2, 0.2, 0.08, 4), [padTop, padSide], false);
    const uv = pad.geometry.attributes.uv;
    const pos = pad.geometry.attributes.position;
    const nor = pad.geometry.attributes.normal;
    const R = finish ? 3.2 : 2;
    if (!pad.geometry.userData.ringUv) {
      for (let i = 0; i < pos.count; i++) if (nor.getY(i) > 0.75) uv.setXY(i, pos.getX(i) / (R * 2) + 0.5, -pos.getZ(i) / (R * 2) + 0.5);
      uv.needsUpdate = true;
      pad.geometry.userData.ringUv = true;
    }
    pad.position.y = -0.08;
    g.add(pad);
    const cp = { index: s.index, x: s.x, y: s.y, z: s.z, group: g, padTop, active: s.index === 0, finish, pop: 0, flag: null, beam: null };
    if (!finish) {
      const side = (this.course.cps[s.index] && this.course.cps[s.index].r) || 3.2;
      const pole = this.addMesh(this.mat('poleKnobGeo', () => this.poleKnobGeo()), this.mat('poleKnob', () => this.poleKnobMat()));
      pole.position.set(side - 0.7, 0, side - 0.7);
      this.statics.add(pole);
      const flagGeo = this.track(new THREE.PlaneGeometry(1.7, 1.05, 12, 4));
      flagGeo.translate(0.85, 0, 0);
      const texOff = this.track(TX.flag(s.index + 1, false));
      const texOn = this.track(TX.flag(s.index + 1, true, this.def.flagOn));
      const flagM = this.track(this.std({ map: texOff, side: THREE.DoubleSide, roughness: 0.7, forceSinglePass: true }));
      flagM.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef FLIP_SIDED
bool flagFront = !gl_FrontFacing;
#else
bool flagFront = gl_FrontFacing;
#endif
diffuseColor *= texture2D( map, flagFront ? vMapUv : vec2( 1.0 - vMapUv.x, vMapUv.y ) );`);
      };
      flagM.customProgramCacheKey = () => 'flag3';
      const flag = new THREE.Mesh(flagGeo, flagM);
      flag.castShadow = true;
      flag.position.set(side - 0.7, 2.95, side - 0.7);
      flag.rotation.y = Math.PI / 4 + Math.PI;
      flag.userData.base = Float32Array.from(flagGeo.attributes.position.array);
      g.add(pole, flag);
      cp.flag = flag;
      cp.flagC = new THREE.Vector3(s.x + side - 0.7 - 0.6, s.y + 2.95, s.z + side - 0.7 + 0.6);
      cp.flagA = 1;
      flagM.transparent = true;
      cp.texOn = texOn;
      cp.texOff = texOff;
      cp.flagM = flagM;
      if (s.index === 0) this.activateCheckpoint(cp, true);
    } else {
      this.addArch(s.x, s.y, s.z + 3.2, 'BİTİŞ', true);
      const star = this.makeStar();
      star.position.set(s.x, s.y + 8.9, s.z + 3.2);
      this.group.add(star);
      this.animated.push((t) => {
        star.rotation.y = t * 1.6;
        star.position.y = s.y + 8.9 + Math.sin(t * 2) * 0.25;
      });
      cp.star = star;
    }
    const beamM = this.track(beamMaterial(0xffc21a));
    const R2 = finish ? 3.4 : 2.1;
    const beam = new THREE.Mesh(this.track(new THREE.CylinderGeometry(R2, R2, finish ? 30 : 16, 32, 1, true)), beamM);
    beam.position.y = finish ? 15 : 8;
    beam.renderOrder = 3;
    g.add(beam);
    cp.beam = beam;
    cp.beamM = beamM;
    this.shaderMats.push(beamM);
    this.group.add(g);
    this.cps.push(cp);
  }

  heroCut(u, on, x, z, r) {
    const f = this.focus;
    const d = f && on ? Math.hypot(f.x - x, f.z - z) : Infinity;
    u.hero.value.set(f ? f.x : 0, f ? f.y : -1e4, f ? f.z : 0, d < r ? 1 : d < r + 6 ? 0.9 : 0);
  }

  addPortal(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.yaw || 0;
    const ringM = this.mat('portalRing', () => (this.look.portalRing ? this.look.portalRing(this) : this.std({ map: TX.bark(), color: 0xb89a78, roughness: 0.85 })));
    const ring = this.addMesh(this.mat('portalRingGeo', () => new THREE.TorusGeometry(1.25, 0.2, 10, 36)), ringM);
    ring.position.y = 1.45;
    this.statics.add(ring);
    const m = this.track(portalMaterial(PORTAL));
    const disc = new THREE.Mesh(this.mat('portalDiscGeo', () => new THREE.CircleGeometry(1.12, 40)), m);
    disc.position.y = 1.45;
    disc.renderOrder = 3;
    const glint = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: TX.sprite('glow'), color: PORTAL, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glint.scale.setScalar(5.5);
    glint.position.y = 1.45;
    g.add(ring, disc, glint);
    const bud = this.mat('portalBudM', () => this.std({ color: 0xf4ffd0, emissive: PORTAL, emissiveIntensity: 2.2, roughness: 0.4 }));
    const budG = this.mat('portalBudGeo', () => new THREE.SphereGeometry(0.13, 10, 8));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const b = this.addMesh(budG, bud, false);
      b.position.set(Math.cos(a) * 1.3, 1.45 + Math.sin(a) * 1.3, 0.18);
      g.add(b);
      this.statics.add(b);
    }
    let beamM = null;
    if (s.out) {
      beamM = this.track(beamMaterial(PORTAL));
      beamM.uniforms.strength.value = this.def.beamK || 1;
      const beam = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.5, 1.5, 18, 24, 1, true)), beamM);
      beam.position.y = 9;
      beam.renderOrder = 3;
      g.add(beam);
      this.shaderMats.push(beamM);
    }
    this.group.add(g);
    this.portals.push({ x: s.x, y: s.y, z: s.z, to: s.to, out: s.out, view: this.viewOf(s), disc, m, glint, beamM });
  }

  addSecretPad(s) {
    const m = this.mat('secretPad', () => this.std({ color: 0x6a7a50, emissiveMap: TX.ring(), emissive: PORTAL, emissiveIntensity: 1.1, roughness: 0.4 }));
    const pad = this.addMesh(diskGeo(1.6, 0.16, 0.06, 3.2), [m, this.mat('padSide', () => this.std({ color: 0xe8eef8, roughness: 0.4, vertexColors: true }))], false);
    const uv = pad.geometry.attributes.uv;
    const pos = pad.geometry.attributes.position;
    const nor = pad.geometry.attributes.normal;
    if (!pad.geometry.userData.ringUv) {
      for (let i = 0; i < pos.count; i++) if (nor.getY(i) > 0.75) uv.setXY(i, pos.getX(i) / 3.2 + 0.5, -pos.getZ(i) / 3.2 + 0.5);
      uv.needsUpdate = true;
      pad.geometry.userData.ringUv = true;
    }
    pad.position.set(s.x, s.y - 0.05, s.z);
    this.group.add(pad);
  }

  addTrunk(s) {
    const m = this.mat('trunkShell', () => {
      const t = TX.bark().clone();
      t.repeat.set(3, 2);
      t.needsUpdate = true;
      this.track(t);
      return this.std({ map: t, color: 0x9a8070, roughness: 0.92, side: THREE.DoubleSide });
    });
    for (const a of [0, Math.PI]) {
      const g = this.track(new THREE.CylinderGeometry(s.r, s.r * 1.18, s.h, 18, 1, true, a + 0.55, Math.PI - 1.1));
      const shell = this.addMesh(g, m);
      this.statics.add(shell);
      shell.position.set(s.x, s.y + s.h / 2, s.z);
      this.group.add(shell);
    }
  }

  buildLips() {
    const parts = [];
    for (const c of this.course.cps) {
      if (c.finish || c.index === 0 || !c.r) continue;
      if (this.groundBelow(c.x, c.z - c.r - 0.8, c.y + 0.5, 0.3) > c.y - 1.5) continue;
      parts.push(new THREE.BoxGeometry(c.r * 2 - 0.6, 0.05, 0.14).translate(c.x, c.y + 0.026, c.z - c.r + 0.12));
    }
    if (!parts.length) return;
    const geo = this.track(mergeGeometries(parts, false));
    for (const pc of parts) pc.dispose();
    const m = this.track(new THREE.MeshBasicMaterial({ color: new THREE.Color(this.look.lip).multiplyScalar(0.9), toneMapped: false }));
    this.group.add(new THREE.Mesh(geo, m));
  }

  buildMushrooms() {
    const n = this.mushrooms.length;
    const pts = [[0.0, -0.57], [0.22, -0.58], [0.5, -0.6], [0.78, -0.62], [0.95, -0.62], [1.0, -0.55], [0.98, -0.45], [0.9, -0.3], [0.76, -0.16], [0.55, -0.04], [0.3, 0.03], [0, 0.06]];
    const cap = this.track(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 36));
    const pos = cap.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(MUSHROOM);
    const ring = new THREE.Color(0xc8b8ff);
    const gill = new THREE.Color(0xc8a0ff);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if ((y < -0.58 && r < 0.97) || (r > 0.93 && y < -0.42)) c.setRGB(1 + gill.r, 1 + gill.g, 1 + gill.b);
      else {
        const band = 0.5 + 0.5 * Math.cos(r * 22);
        c.copy(top).lerp(ring, band * 0.15 * Math.min(1, r * 2) + 0.35 * (1 - Math.min(1, r * 4)));
      }
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    cap.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const capM = this.track(this.std({ vertexColors: true, roughness: 0.45, emissive: 0x000000 }));
    capM.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= min(vColor.rgb, vec3(1.0));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += max(vColor.rgb - 1.0, 0.0) * 2.4;');
    };
    capM.customProgramCacheKey = () => 'mushroomCap';
    const sp = [];
    for (let k = 10; k >= 0; k--) {
      const t = k / 10;
      sp.push(new THREE.Vector2(0.16 + 0.05 * Math.sin(t * Math.PI) + (t > 0.85 ? (t - 0.85) * 1.6 : 0), -t * 3.6));
    }
    const stem = this.track(new THREE.LatheGeometry(sp, 14));
    const sPos = stem.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const y = sPos.getY(i);
      sPos.setX(i, sPos.getX(i) + Math.sin(-y * 0.9) * 0.22);
    }
    stem.computeVertexNormals();
    vertexGradient(stem, 0x6a5a48, 0xf2e8d2);
    const stemM = this.track(this.std({ vertexColors: true, roughness: 0.7 }));
    this.capMesh = new THREE.InstancedMesh(cap, capM, n);
    this.stemMesh = new THREE.InstancedMesh(stem, stemM, n);
    for (const im of [this.capMesh, this.stemMesh]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.placeStems();
    this.updateMushrooms(0);
  }

  placeStems() {
    this.mushrooms.forEach((mu, i) => {
      const k = this.window === null || this.inWindow(mu.view) ? mu.r / 1.6 : 0;
      _mm.compose(_mp.set(mu.x, mu.y - 0.5 * mu.r * 0.62, mu.z), _mq.identity(), _ms.set(k * 1.5, k ? 1.2 : 0, k * 1.5));
      this.stemMesh.setMatrixAt(i, _mm);
    });
    this.stemMesh.instanceMatrix.needsUpdate = true;
  }

  updateMushrooms(t) {
    this.mushrooms.forEach((mu, i) => {
      const on = this.window === null || this.inWindow(mu.view);
      const sc = mu.c.obj.scale;
      const br = 1 + Math.sin(t * Math.PI + mu.ph) * 0.03;
      const k = on ? 1 : 0;
      _mm.compose(_mp.set(mu.x, mu.y + 0.02, mu.z), _mq.identity(), _ms.set(mu.r * sc.x * br * k, mu.r * 0.8 * sc.y * (2 - br) * k, mu.r * sc.z * br * k));
      this.capMesh.setMatrixAt(i, _mm);
    });
    this.capMesh.instanceMatrix.needsUpdate = true;
  }

  buildVines() {
    const n = this.swings.length;
    const segG = this.track(new THREE.CylinderGeometry(0.1, 0.12, 1, 6, 1));
    const vineM = this.track(this.std({ color: 0x8cbf6a, emissive: 0x3f7a34, emissiveIntensity: 0.6, roughness: 0.8 }));
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.22, 0.18, 0, 0.55);
    leafShape.quadraticCurveTo(-0.22, 0.18, 0, 0);
    const leafG = this.track(new THREE.ShapeGeometry(leafShape, 4));
    const leafM = this.track(nearFade(this.std({ color: 0x5aa05a, roughness: 0.6, side: THREE.DoubleSide }), 'vineLeaf', 4));
    const knotG = this.track(new THREE.IcosahedronGeometry(0.2, 1));
    const knotM = this.track(this.std({ color: 0xd8fff8, emissive: 0x38c8dc, emissiveIntensity: 2.2, roughness: 0.4 }));
    const postG = this.track(new THREE.CylinderGeometry(0.3, 0.42, 1, 9, 1));
    postG.translate(0, -0.5, 0);
    const beamG = this.track(new THREE.CylinderGeometry(0.28, 0.28, 1, 9, 1));
    beamG.rotateZ(Math.PI / 2);
    const barkM = this.mat('vineBark', () => {
      const t = TX.bark().clone();
      t.repeat.set(1, 4);
      t.needsUpdate = true;
      this.track(t);
      return this.std({ map: t, color: 0x8a7462, roughness: 0.92 });
    });
    this.vineSeg = new THREE.InstancedMesh(segG, vineM, n * 2 * VINE_N);
    this.vineLeaf = new THREE.InstancedMesh(leafG, leafM, n * 2 * VINE_N);
    this.vineKnot = new THREE.InstancedMesh(knotG, knotM, n * 2);
    const posts = new THREE.InstancedMesh(postG, barkM, n * 2);
    const beams = new THREE.InstancedMesh(beamG, barkM, n);
    this.vinePosts = posts;
    this.vineBeams = beams;
    this.swings.forEach((c) => {
      const sw = c.swing;
      const hw = c.hx * 0.82;
      const py = c.base.y + c.hy + sw.L * Math.cos(sw.A) + 0.25;
      c.pivot = { x: c.base.x, y: py, z: c.base.z, hw };
    });
    this.placeFrames();
    posts.castShadow = true;
    beams.castShadow = true;
    for (const im of [this.vineSeg, this.vineLeaf, this.vineKnot, posts, beams]) {
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.vineSeg.castShadow = true;
    this.updateVines(0);
  }

  placeFrames() {
    this.swings.forEach((c, i) => {
      const k = this.inWindow(this.viewOf(c.spec)) ? 1 : 0;
      const pv = c.pivot;
      const span = c.hx + 1.4;
      [-1, 1].forEach((sx, j) => {
        _mm.compose(_mp.set(c.base.x + sx * span, pv.y + 0.35, c.base.z), _mq.identity(), _ms.set(k, 15 * k, k));
        this.vinePosts.setMatrixAt(i * 2 + j, _mm);
      });
      _mm.compose(_mp.set(c.base.x, pv.y + 0.1, c.base.z), _mq.identity(), _ms.set((span * 2 + 0.6) * k, k, k));
      this.vineBeams.setMatrixAt(i, _mm);
    });
    this.vinePosts.instanceMatrix.needsUpdate = true;
    this.vineBeams.instanceMatrix.needsUpdate = true;
  }

  updateVines(dt) {
    const up = _mv.set(0, 1, 0);
    this.swings.forEach((c, i) => {
      const on = this.inWindow(this.viewOf(c.spec));
      const pv = c.pivot;
      const w = dt > 0 ? (c.angle - (c.prevAngle ?? c.angle)) / dt : 0;
      c.prevAngle = c.angle;
      c.lag = (c.lag || 0) + (w - (c.lag || 0)) * Math.min(1, dt * 6);
      [-1, 1].forEach((sx, k) => {
        const ax = pv.x + sx * pv.hw;
        const bx = c.x + sx * pv.hw;
        const by = c.y + c.hy;
        const bz = c.z;
        const base = (i * 2 + k) * VINE_N;
        for (let j = 0; j < VINE_N; j++) {
          const t0 = j / VINE_N;
          const t1 = (j + 1) / VINE_N;
          const bend = (t) => -c.lag * 0.22 * Math.sin(Math.PI * t);
          _va.set(ax + (bx - ax) * t0, pv.y + (by - pv.y) * t0, pv.z + (bz - pv.z) * t0 + bend(t0));
          _vb.set(ax + (bx - ax) * t1, pv.y + (by - pv.y) * t1, pv.z + (bz - pv.z) * t1 + bend(t1));
          _vd.subVectors(_vb, _va);
          const len = _vd.length();
          _mq.setFromUnitVectors(up, _vd.multiplyScalar(1 / len));
          _mp.addVectors(_va, _vb).multiplyScalar(0.5);
          _ms.set(on ? 1 : 0, on ? len * 1.08 : 0, on ? 1 : 0);
          _mm.compose(_mp, _mq, _ms);
          this.vineSeg.setMatrixAt(base + j, _mm);
          _me.set(0.4 * (j % 2 ? 1 : -1), j * 1.3 + i, (j % 2 ? -1 : 1) * 1.1);
          _mq2.setFromEuler(_me);
          _mq2.premultiply(_mq);
          _mp.x += (j % 2 ? 0.1 : -0.1) * sx;
          _ms.setScalar(on ? 0.9 + (j % 3) * 0.15 : 0);
          _mm.compose(_mp, _mq2, _ms);
          this.vineLeaf.setMatrixAt(base + j, _mm);
        }
        _mm.compose(_mp.set(bx, by + 0.12, bz), _mq.identity(), _ms.setScalar(on ? 1 : 0));
        this.vineKnot.setMatrixAt(i * 2 + k, _mm);
      });
    });
    this.vineSeg.instanceMatrix.needsUpdate = true;
    this.vineLeaf.instanceMatrix.needsUpdate = true;
    this.vineKnot.instanceMatrix.needsUpdate = true;
  }

  cpAt(i) {
    return this.cps.find((c) => c.index === i);
  }

  addTakeoff(s) {
    const geo = this.mat('takeoffGeo', () => {
      const parts = [0, 0.75].map((o) => {
        const sh = new THREE.Shape();
        sh.moveTo(-0.3 + o, -0.55);
        sh.lineTo(0.2 + o, 0);
        sh.lineTo(-0.3 + o, 0.55);
        sh.lineTo(-0.05 + o, 0.55);
        sh.lineTo(0.45 + o, 0);
        sh.lineTo(-0.05 + o, -0.55);
        sh.closePath();
        const g = new THREE.ShapeGeometry(sh);
        g.deleteAttribute('uv');
        return g;
      });
      const m = mergeGeometries(parts, false).rotateX(-Math.PI / 2);
      for (const g of parts) g.dispose();
      return m;
    });
    const mat = this.mat('takeoffMat', () => new THREE.MeshBasicMaterial({ color: 0xd0208e, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y + 0.03, s.z);
    m.rotation.y = s.dir > 0 ? 0 : Math.PI;
    m.scale.setScalar(0.8);
    this.group.add(m);
  }

  addBigStar(s) {
    const g = new THREE.Group();
    const star = this.makeStar(0xff5ad8);
    star.scale.setScalar(0.62);
    const halo = new THREE.Sprite(this.mat('haloMat', () => new THREE.SpriteMaterial({ map: TX.sprite('glow'), color: 0xff8ae8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    halo.scale.setScalar(3.2);
    g.add(halo, star);
    g.position.set(s.x, s.y, s.z);
    this.group.add(g);
    const b = { x: s.x, y: s.y, z: s.z, obj: g, taken: false, t: 0 };
    this.bigStars.push(b);
    this.animated.push((t, dt) => {
      if (b.taken) {
        b.t += dt;
        const k = Math.min(1, b.t / 0.5);
        g.scale.setScalar(Math.max(0.001, 1 + k * 0.8 - k * k * 1.8));
        g.position.y = s.y + k * 2;
        if (k >= 1) g.visible = false;
      } else {
        g.visible = true;
        g.scale.setScalar(1);
        g.position.y = s.y + Math.sin(t * 2.4) * 0.2;
      }
      star.rotation.y = t * 2.2 + (b.taken ? b.t * 20 : 0);
    });
  }

  setAssist(stage) {
    this.assistStage = stage;
    this.help = stage === null ? this.def.help : FULL_HELP;
    for (const c of this.colliders) {
      if (!WIDEN.has(c.style) || c.crumble || c.guard || c.wait || !c.obj) continue;
      const k = c.stage === stage ? 1.3 : 1;
      if (c.shape === 'cyl') {
        c.r0 = c.r0 || c.r;
        c.r = c.r0 * k;
      } else {
        c.hx0 = c.hx0 || c.hx;
        c.hz0 = c.hz0 || c.hz;
        c.hx = c.hx0 * k;
        c.hz = c.hz0 * k;
      }
      c.obj.scale.set(k, 1, k);
    }
    this.batches.forEach((b, i) => {
      if (!b) return;
      const raw = i === stage;
      for (const m of b.merged) m.visible = !raw;
      for (const m of b.originals) m.visible = raw;
    });
    for (const c of this.dynamic) c.slow = c.stage === stage ? 0.7 : 1;
    for (const b of this.bars) b.slow = b.stage === stage ? 0.7 : 1;
    const list = stage === null ? [] : this.coins.filter((c) => c.stage === stage);
    this.assistCoins = list;
    const pos = this.assistGlow.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const c = list[i];
      pos.setXYZ(i, c ? c.x : 0, c ? c.y : -9999, c ? c.z : 0);
    }
    pos.needsUpdate = true;
    this.assistGlow.visible = list.length > 0;
  }

  addChest(s) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = Math.PI / 4;
    const wood = this.mat('chestWood', () => this.std({ map: TX.wood(), color: 0xb86a3a, roughness: 0.7 }));
    const gold = this.mat('chestGold', () => this.std({ color: 0xffc21a, emissive: 0xff9a00, emissiveIntensity: 0.35, metalness: 0.75, roughness: 0.3 }));
    const body = this.addMesh(blockGeo(1.3, 0.8, 0.9, 0.08, 1), wood);
    body.position.y = 0.4;
    const bandG = blockGeo(1.36, 0.14, 0.96, 0.05, 1);
    const goldG = this.mat('chestGoldGeo', () => {
      const a0 = bandG.clone().translate(0, 0.72, 0);
      const a1 = blockGeo(0.26, 0.3, 0.12, 0.04, 1).clone().translate(0, 0.62, 0.47);
      const m = mergeGeometries([a0, a1], false);
      a0.dispose();
      a1.dispose();
      return m;
    });
    const band = this.addMesh(goldG, gold);
    const lid = new THREE.Group();
    lid.position.set(0, 0.8, -0.45);
    const lidM = this.addMesh(blockGeo(1.3, 0.34, 0.9, 0.12, 1), wood);
    lidM.position.set(0, 0.17, 0.45);
    const lidBand = this.addMesh(blockGeo(0.2, 0.38, 0.96, 0.06, 1), gold);
    lidBand.position.set(0, 0.17, 0.45);
    lid.add(lidM, lidBand);
    g.add(body, band, lid);
    this.group.add(g);
    const ch = { index: s.index, x: s.x, y: s.y, z: s.z, lid, open: 0, target: 0 };
    this.chests.push(ch);
    this.animated.push((t, dt) => {
      ch.open += (ch.target - ch.open) * (1 - Math.exp(-9 * dt));
      ch.lid.rotation.x = -ch.open * 1.9;
      g.scale.setScalar(ch.target ? 1 : 1 + Math.sin(t * 3) * 0.03);
    });
  }

  chestAt(i) {
    return this.chests.find((c) => c.index === i);
  }

  openChest(i, instant) {
    const ch = this.chestAt(i);
    if (!ch) return null;
    ch.target = 1;
    if (instant) ch.open = 1;
    return ch;
  }

  resetBigStars(taken) {
    this.bigStars.forEach((b, i) => {
      b.taken = !!(taken && taken.includes(i));
      b.t = b.taken ? 1 : 0;
    });
  }

  makeStar(tint) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.55 : 1.3;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const g = this.track(new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 3 }));
    g.center();
    const m = this.track(this.std({ color: tint || 0xffc21a, emissive: tint || 0xffa000, emissiveIntensity: tint ? 1.4 : 1.1, metalness: 0.6, roughness: 0.25 }));
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  addArch(x, y, z, text, finish) {
    const pillarM = this.mat('archPillar', () => this.std({ map: TX.brushed(), color: 0xe8b64a, metalness: 0.7, roughness: 0.3, vertexColors: true }));
    const bannerTex = this.track(TX.banner(text, finish ? '#141a2c' : '#2f7fe8', finish ? '#f4f6fb' : '#56b0ff'));
    const bannerM = this.track(this.std({ map: bannerTex, roughness: 0.5, emissiveMap: bannerTex, emissive: 0xffffff, emissiveIntensity: 0.25 }));
    const edgeM = this.mat('archEdge', () => this.std({ map: TX.brushed(), color: 0xffd466, roughness: 0.28, metalness: 0.75, vertexColors: true }));
    const span = 4.3;
    const H = finish ? ARCH_H : 4.6;
    const pm = this.track(pillarM.clone());
    const cm = this.track(edgeM.clone());
    for (const m of [pm, cm]) m.transparent = true;
    for (const sx of [-span, span]) {
      const p = this.addMesh(blockGeo(0.9, H, 0.9, 0.3, 1), pm);
      p.position.set(x + sx, y + H / 2, z);
      this.group.add(p);
      const cap = this.addMesh(this.mat('archCapGeo', () => oneGroup(diskGeo(0.7, 0.5, 0.2).clone())), cm);
      cap.position.set(x + sx, y + H + 0.2, z);
      this.group.add(cap);
      this.colliders.push({ shape: 'box', x: x + sx, y: y + H / 2, z, hx: 0.45, hy: H / 2, hz: 0.45, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0 });
    }
    const bgeo = this.track(new THREE.BoxGeometry(span * 2 - 0.9, 1.5, 0.35));
    bgeo.clearGroups();
    bgeo.addGroup(0, 24, 0);
    bgeo.addGroup(24, 12, 4);
    const fadeEdge = this.track(edgeM.clone());
    for (const m of [fadeEdge, bannerM]) m.transparent = true;
    const banner = new THREE.Mesh(bgeo, [fadeEdge, fadeEdge, fadeEdge, fadeEdge, bannerM, bannerM]);
    banner.castShadow = true;
    banner.position.set(x, y + H - 0.7, z);
    this.group.add(banner);
    const arch = { x, y: y + H - 0.7, z, half: span, finish, banner, mats: [fadeEdge, bannerM], a: 1, pmats: [pm, cm], pa: 1 };
    this.arches = this.arches || [];
    this.arches.push(arch);
  }

  buildCoins() {
    const list = this.course.coins;
    const g = this.track(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 28));
    g.rotateX(Math.PI / 2);
    const face = this.track(this.std({ map: TX.coinFace(), emissiveMap: TX.coinFace(), emissive: 0xffc21a, emissiveIntensity: 1.6, metalness: 0.55, roughness: 0.28 }));
    const rim = this.track(this.std({ color: 0xffb300, emissive: 0xff9500, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.25 }));
    const [cg, cmats] = this.coalesce(g, [rim, face, face]);
    const mesh = new THREE.InstancedMesh(cg, cmats, list.length);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.coinMesh = mesh;
    this.coins = list.map((c, i) => ({ x: c.x, y: c.y, z: c.z, stage: c.stage, view: this.viewOf(c), secret: !!c.secret, taken: false, t: 0, phase: i * 0.7, hide: 0 }));
    this.group.add(mesh);
    const maxStage = list.reduce((m, c) => Math.max(m, list.filter((x) => x.stage === c.stage).length), 0);
    const ag = this.track(new THREE.BufferGeometry());
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, maxStage) * 3), 3));
    const am = this.track(new THREE.PointsMaterial({ map: TX.sprite('glow'), color: 0xffe066, size: 3.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.assistGlow = new THREE.Points(ag, am);
    this.assistGlow.frustumCulled = false;
    this.assistGlow.visible = false;
    this.assistStage = null;
    this.group.add(this.assistGlow);
    this.animated.push((t) => {
      if (this.assistGlow.visible) am.size = 3.4 + Math.sin(t * 5) * 0.9;
    });
    this.view = null;
    this.updateCoins(0);
  }

  setView(eye, target) {
    this.view = eye ? { eye, target } : null;
    this.focus = target;
  }

  fadeFlags(dt) {
    const e = this.camera.position;
    const f = this.focus;
    const k = 1 - Math.exp(-12 * dt);
    const dx = f.x - e.x;
    const dy = f.y + 0.9 - e.y;
    const dz = f.z - e.z;
    const L2 = dx * dx + dy * dy + dz * dz;
    for (const cp of this.cps) {
      if (!cp.flagM) continue;
      const c = cp.flagC;
      const px = c.x - e.x;
      const py = c.y - e.y;
      const pz = c.z - e.z;
      const t = L2 > 1e-4 ? Math.max(0, Math.min(1, (px * dx + py * dy + pz * dz) / L2)) : 0;
      const qx = px - dx * t;
      const qy = py - dy * t;
      const qz = pz - dz * t;
      const want = t > 0 && t < 1 && qx * qx + qy * qy + qz * qz < 1.3 * 1.3 ? 0.2 : 1;
      if (Math.abs(want - cp.flagA) < 0.005) continue;
      cp.flagA += (want - cp.flagA) * k;
      if (Math.abs(want - cp.flagA) < 0.01) cp.flagA = want;
      cp.flagM.opacity = cp.flagA;
      cp.flagM.depthWrite = cp.flagA > 0.95;
    }
  }

  archBlocks(a, eye, f) {
    const dx = f.x - eye.x;
    const dz = f.z - eye.z;
    const L2 = dx * dx + dz * dz;
    if (L2 < 1e-4) return false;
    for (const sx of [-a.half, a.half]) {
      const px = a.x + sx - eye.x;
      const pz = a.z - eye.z;
      if (px * px + pz * pz < 1.8 * 1.8) return true;
      const t = (px * dx + pz * dz) / L2;
      if (t <= 0 || t >= 1) continue;
      const ex = px - dx * t;
      const ez = pz - dz * t;
      if (ex * ex + ez * ez < 1.3 * 1.3) return true;
    }
    return false;
  }

  hidesPlayer(x, y, z) {
    const v = this.view;
    if (!v) return false;
    const ax = v.eye.x;
    const ay = v.eye.y;
    const az = v.eye.z;
    const bx = v.target.x - ax;
    const by = v.target.y + 0.9 - ay;
    const bz = v.target.z - az;
    const len2 = bx * bx + by * by + bz * bz;
    if (len2 < 1e-4) return false;
    const t = ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / len2;
    if (t <= 0 || (1 - t) * Math.sqrt(len2) < 0.6) return false;
    const dx = x - ax - bx * t;
    const dy = y - ay - by * t;
    const dz = z - az - bz * t;
    return dx * dx + dy * dy + dz * dz < 9;
  }

  resetCoins() {
    for (const c of this.coins) {
      c.taken = false;
      c.t = 0;
    }
  }

  updateCoins(dt) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const t = this.time;
    this.coins.forEach((c, i) => {
      let s = c.view >= SECRET_VIEW && !this.inWindow(c.view) ? 0 : 1;
      let lift = 0;
      if (c.taken) {
        c.t += dt;
        const k = Math.min(1, c.t / 0.22);
        s = 1 - k;
        lift = k * 0.8;
      }
      q.setFromAxisAngle(UP, t * 3 + c.phase + (c.taken ? c.t * 30 : 0));
      p.set(c.x, c.y + Math.sin(t * 2.2 + c.phase) * 0.15 + lift, c.z);
      const f = this.focus;
      const away = !f || (p.x - f.x) ** 2 + (p.y - f.y - 0.9) ** 2 + (p.z - f.z) ** 2 > 6.25;
      const ghost = s > 0 && (away || c.taken) && this.hidesPlayer(p.x, p.y, p.z);
      c.hide += ((ghost ? 1 : 0) - c.hide) * Math.min(1, dt * 12);
      const cam = !this.view && this.camera ? this.camera.position : null;
      if (cam && (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2 < 49) s = 0;
      sc.setScalar(s * (1 - c.hide));
      m.compose(p, q, sc);
      this.coinMesh.setMatrixAt(i, m);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
    if (this.assistGlow.visible) {
      const pos = this.assistGlow.geometry.attributes.position;
      this.assistCoins.forEach((c, i) => pos.setY(i, c.taken ? -9999 : c.y + Math.sin(t * 2.2 + c.phase) * 0.15));
      pos.needsUpdate = true;
    }
  }

  activateCheckpoint(cp, silent) {
    cp.active = true;
    if (cp.flagM) {
      cp.flagM.map = cp.texOn;
      cp.flagM.needsUpdate = true;
    }
    cp.padTop.emissive.set(this.def.cpColor);
    cp.padTop.emissiveIntensity = this.padLook().onK;
    cp.pop = silent ? 0 : 1;
    cp.beamT = silent ? 1 : 0;
  }

  resetCheckpoints() {
    for (const ch of this.chests) {
      ch.target = 0;
      ch.open = 0;
    }
    for (const cp of this.cps) {
      if (cp.finish || cp.index === 0) continue;
      cp.active = false;
      if (cp.flagM) {
        cp.flagM.map = cp.texOff;
        cp.flagM.needsUpdate = true;
      }
      cp.padTop.emissive.set(this.padLook().idle);
      cp.padTop.emissiveIntensity = this.padLook().idleK;
      cp.beamT = 0;
    }
  }

  waitFor(p, dt) {
    this.player = p;
    if (!p) {
      this.waiting.clear();
      this.holding.clear();
      this.farView = null;
      return;
    }
    for (const c of this.crumbles) {
      if (c.crumble.hold && c.active && Math.abs(p.pos.x - c.x) < c.hx && Math.abs(p.pos.z - c.z) < c.hz && p.pos.y >= c.y + c.hy - 0.05) c.crumble.on = this.time;
    }
    const ride = p.ground && p.ground.swing ? this.viewOf(p.ground.spec) : null;
    if (p.ground || p.grounded) {
      this.waiting.clear();
      let best = null;
      let bestDz = SWING_REACH;
      for (const c of this.swings) {
        if (ride !== null && this.viewOf(c.spec) === ride) continue;
        const top = c.base.y + c.hy;
        const dz = p.pos.z - (c.base.z + c.swing.L * Math.sin(c.swing.A) + c.hz);
        if (dz > -c.hz && dz < bestDz && Math.abs(p.pos.x - c.base.x) < c.hx + 5 && p.pos.y - top > -5 && p.pos.y - top < 1.6) {
          best = c;
          bestDz = dz;
        }
      }
      if (best && best.swing.hold && bestDz > -(PHYS.radius + 0.1)) this.waiting.set(this.viewOf(best.spec), best);
      this.farView = ride !== null && p.ground.swing.hold ? ride : null;
      if (this.farView !== null) this.waiting.set(ride, p.ground);
      this.holding.clear();
      for (const c of this.holders) {
        const dy = p.pos.y - c.base.y - c.hy;
        if (p.ground === c || (Math.abs(p.pos.x - c.base.x) < c.hx + 3 && dy > -3 && dy < 1.6 && p.pos.z > c.base.z - c.hz && p.pos.z < c.base.z + c.hz + SWING_REACH)) this.holding.add(c);
      }
    }
    this.waitD.clear();
    for (const [v, c] of this.waiting) this.waitD.set(v, v === this.farView ? swingFar(c.swing, c.ph, dt) : swingWait(c.swing, c.ph, dt));
  }

  dockFor(p) {
    this.waitFor(p, 1e3);
    for (const c of this.holding) c.ph += holdWait(c.wait, c.ph, 1e3);
    if (this.rhythm) this.rhythm.dock(p);
    if (this.train) this.train.dock(p);
    for (const c of this.swings) {
      const d = this.waitD.get(this.viewOf(c.spec));
      if (d !== undefined) c.ph += d;
    }
    this.waitD.clear();
  }

  step(dt) {
    this.time += dt;
    for (const c of this.dynamic) {
      const wd = c.swing ? this.waitD.get(this.viewOf(c.spec)) : undefined;
      if (this.holding.has(c)) c.ph += holdWait(c.wait, c.ph, dt);
      else c.ph += wd ?? dt * c.slow;
      const t = c.ph;
      const ox = c.x;
      const oy = c.y;
      const oz = c.z;
      const oyaw = c.yaw;
      if (c.swing) {
        const sw = c.swing;
        const a = sw.A * this.holdWave(c, t + sw.t0, sw);
        c.z = c.base.z + sw.L * Math.sin(a);
        c.y = c.base.y + sw.L * (Math.cos(sw.A) - Math.cos(a));
        c.angle = a;
      }
      if (c.move) {
        const s = c.move.hold ? this.holdWave(c, t, c.move) : Math.sin(t * c.move.speed + (c.move.phase || 0));
        c.x = c.base.x + (c.move.x || 0) * s;
        c.y = c.base.y + (c.move.y || 0) * s;
        c.z = c.base.z + (c.move.z || 0) * s;
      }
      if (c.spin) c.yaw = c.base.yaw + c.spin * t;
      c.dx = c.x - ox;
      c.dy = c.y - oy;
      c.dz = c.z - oz;
      c.dyaw = c.yaw - oyaw;
      if (!c.crumble) {
        c.obj.position.set(c.x, c.y, c.z);
        c.obj.rotation.y = c.yaw;
      }
    }
    for (const b of this.bars) {
      b.ph += dt * b.slow;
      b.angle = b.phase + b.speed * b.ph;
    }
    for (const c of this.crumbles) this.stepCrumble(c, dt);
    if (this.wind) this.wind.step(dt);
    if (this.rhythm) this.rhythm.step(dt);
    if (this.train) this.train.step(dt);
  }

  holdWave(c, t, m) {
    const leg = Math.PI / m.speed;
    const P = 2 * (leg + m.hold);
    const u = ((t % P) + P) % P;
    c.heading = u < m.hold + leg ? -1 : 1;
    if (u < m.hold) {
      c.moving = 0;
      c.open = 1;
      return 1;
    }
    c.open = 0;
    if (u < m.hold + leg) {
      c.moving = 1;
      return Math.cos((Math.PI * (u - m.hold)) / leg);
    }
    if (u < 2 * m.hold + leg) {
      c.moving = 0;
      c.open = -1;
      return -1;
    }
    c.moving = 1;
    return -Math.cos((Math.PI * (u - 2 * m.hold - leg)) / leg);
  }

  touchCrumble(c) {
    if (c.crumble) c.crumble.on = this.time;
    if (c.crumble && c.crumble.state === 'idle') {
      c.crumble.state = 'shake';
      c.crumble.t = 0;
      this.crumbleLook(c, true);
      if (this.events) this.events('crack', c);
    }
  }

  stepCrumble(c, dt) {
    const k = c.crumble;
    k.t += dt;
    const o = c.obj;
    if (k.state === 'shake') {
      if (k.hold && this.time - k.on < 0.1) k.t = Math.min(k.t, k.delay * 0.5);
      const a = 0.05 + (k.t / k.delay) * 0.08;
      o.position.set(k.base.x + (Math.random() - 0.5) * a, k.base.y + (Math.random() - 0.5) * a * 0.5, k.base.z + (Math.random() - 0.5) * a);
      if (k.t > k.delay) {
        k.state = 'fall';
        k.t = 0;
        k.v = 0;
        c.active = false;
        if (this.events) this.events('drop', c);
      }
    } else if (k.state === 'fall') {
      k.v += 25 * dt;
      o.position.y -= k.v * dt;
      o.rotation.x += dt * 0.8;
      o.rotation.z += dt * 0.5;
      o.scale.setScalar(Math.max(0.01, 1 - k.t / 1.3));
      if (k.t > 1.3) {
        k.state = 'gone';
        k.t = 0;
        o.visible = false;
      }
    } else if (k.state === 'gone') {
      if (k.t > 2.2) {
        k.state = 'back';
        k.t = 0;
        o.visible = true;
        o.position.copy(k.base);
        o.rotation.set(0, c.yaw, 0);
        o.scale.setScalar(0.01);
      }
    } else if (k.state === 'back') {
      const s = Math.min(1, k.t / 0.35);
      o.scale.setScalar(s < 1 ? 1 + Math.sin(s * Math.PI) * 0.15 * s : 1);
      if (s < 1) o.scale.setScalar(Math.max(0.01, s + Math.sin(s * Math.PI) * 0.15));
      if (k.t > 0.35) {
        o.scale.setScalar(1);
        this.crumbleLook(c, false);
        k.state = 'idle';
        c.active = true;
        if (k.hold && this.time - k.on < 0.1) this.touchCrumble(c);
      }
    }
  }

  crumbleLook(c, warn) {
    const L = this.lookMats();
    if (!L.crumbleWarn) return;
    const mesh = c.obj.children[0];
    if (!c.crumble.mat0) c.crumble.mat0 = mesh.material;
    const w = L.crumbleWarn();
    mesh.material = warn ? (Array.isArray(c.crumble.mat0) ? c.crumble.mat0.map(() => w) : w) : c.crumble.mat0;
  }

  resetCrumbles() {
    if (this.rhythm) this.rhythm.reset();
    if (this.train) this.train.reset();
    for (const c of this.crumbles) {
      this.crumbleLook(c, false);
      c.crumble.state = 'idle';
      c.active = true;
      c.obj.visible = true;
      c.obj.position.copy(c.crumble.base);
      c.obj.rotation.set(0, c.yaw, 0);
      c.obj.scale.setScalar(1);
    }
  }

  animate(dt) {
    const t = this.time;
    let flash = 0;
    for (const b of this.bars) {
      b.obj.rotation.y = b.angle;
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 1.2);
      flash = Math.max(flash, b.flash);
    }
    if (this.barMat) this.barMat.emissiveIntensity = this.barGlow + flash * this.barFlash * (1.5 + Math.sin(t * 30));
    for (const cv of this.convTex) {
      const v = (cv.speed / 1.6) * dt;
      if (cv.dir === 'z') cv.t.offset.y += v;
      else if (cv.dir === 'x+') cv.t.offset.x -= v;
      else cv.t.offset.x += v;
    }
    for (const m of this.shaderMats) if (m.uniforms && m.uniforms.time) m.uniforms.time.value = t;
    this.landNow.value = this.time;
    for (const f of this.ferryFx) {
      f.ch.im.parent.rotation.y = f.c.heading > 0 ? Math.PI : 0;
      for (let i = 0; i < 3; i++) {
        const wave = Math.sin(t * 7 - i * 2.1);
        f.ch.alpha.setX(i + 3, f.c.moving ? 0.65 + 0.35 * Math.max(0, wave) : 0.55 + 0.2 * Math.sin(t * 3));
      }
      f.ch.alpha.needsUpdate = true;
      for (const g of f.gates) {
        const want = f.c.open === g.side ? 0 : 1;
        g.k += (want - g.k) * (1 - Math.exp(-14 * dt));
        _mm.compose(_mp.set(0, f.c.hy - 0.72 * (1 - g.k), g.z), _mq.identity(), _ms.setScalar(g.k > 0.02 ? 1 : 0));
        f.gateMesh.setMatrixAt(g.i, _mm);
      }
      if (f.gateMesh) f.gateMesh.instanceMatrix.needsUpdate = true;
      for (const e of f.edges) {
        if (f.c.open === e.side) e.m.color.copy(GO);
        else e.m.color.lerpColors(this.stopA, this.stopB, 0.5 + 0.5 * Math.sin(t * 6));
      }
    }
    for (const pf of this.padFx) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.9 + i / 3) % 1;
        _mm.compose(_mp.set(0, pf.base + 0.15 + k * 2.2, 0), _mq.identity(), _ms.setScalar(1 - k * 0.35));
        pf.rings.im.setMatrixAt(i, _mm);
        pf.rings.alpha.setX(i, (1 - k) * Math.min(1, k * 6));
      }
      pf.rings.im.instanceMatrix.needsUpdate = true;
      pf.rings.alpha.needsUpdate = true;
      pf.arrow.position.y = pf.base + 1.1 + Math.sin(t * 4) * 0.2;
      pf.am.opacity = 0.75 + 0.25 * Math.sin(t * 4);
    }
    const padM = this.mats.get('padTop');
    if (padM) padM.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.6;
    for (const c of this.colliders) {
      if (c.squash > 0) {
        c.squash = Math.max(0, c.squash - dt * 3.2);
        const s = Math.sin(c.squash * Math.PI * 3) * c.squash * 0.35;
        c.obj.scale.set(1 + s * 0.4, 1 - s, 1 + s * 0.4);
      }
    }
    const bk = this.def.beamK || 1;
    for (const cp of this.cps) {
      if (cp.flag && cp.group.parent.visible) {
        const g = cp.flag.geometry;
        const base = cp.flag.userData.base;
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3];
          const y = base[i * 3 + 1];
          const w = Math.sin(x * 3 - t * 6 + cp.index) * 0.12 * (x / 1.7);
          pos.setXYZ(i, x, y - (x / 1.7) * 0.06 * (1 + Math.sin(t * 3)), w);
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
      }
      if (cp.pop > 0) {
        cp.pop = Math.max(0, cp.pop - dt * 2.2);
        const s = 1 + Math.sin((1 - cp.pop) * Math.PI) * 0.35;
        if (cp.flag) cp.flag.scale.setScalar(s);
      }
      if (cp.beam) {
        const u = cp.beamM.uniforms;
        if (cp.active && !cp.finish) {
          cp.beamT = Math.min(1, (cp.beamT || 0) + dt * 1.5);
          const k = cp.beamT;
          u.strength.value = (k < 1 ? (this.def.cpFlash || 1.4) * Math.sin(k * Math.PI) + k * this.def.cpBeam : this.def.cpBeam) * bk;
          u.color.value.copy(this.beamOn);
        } else if (cp.index === this.nextCp) {
          u.strength.value = (0.6 + 0.25 * Math.sin(t * 3)) * bk;
          u.color.value.copy(cp.finish ? this.beamFinish : this.beamNext);
        } else u.strength.value = 0;
        cp.beam.visible = u.strength.value > 0.03;
        const f = this.focus;
        this.heroCut(u, cp.beam.visible, cp.x, cp.z, cp.finish ? 3.9 : 2.6);
      }
    }
    for (const f of this.animated) f(t, dt);
    if (this.mushrooms.length) this.updateMushrooms(t);
    if (this.swings.length) this.updateVines(dt);
    for (const pt of this.portals) {
      if (pt.beamM) this.heroCut(pt.beamM.uniforms, true, pt.x, pt.z, 1.9);
      pt.disc.rotation.z = -t * 1.6;
      pt.m.uniforms.time.value = t;
      const fd = this.focus ? Math.hypot(this.focus.x - pt.x, this.focus.z - pt.z) : 99;
      pt.glint.material.opacity = (0.65 + 0.35 * Math.sin(t * 3 + pt.x)) * Math.min(1, Math.max(0.2, (fd - 1.5) / 5));
    }
    if (this.arches && this.camera) {
      const c = this.camera.position;
      for (const a of this.arches) {
        const near = !!this.view && Math.abs(c.z - a.z) < 8 && Math.abs(c.x - a.x) < a.half + 3 && c.y < a.y + 2.2;
        const block = !!this.focus && this.archBlocks(a, c, this.focus);
        const close = !a.finish && Math.abs(c.z - a.z) < 5 && Math.abs(c.x - a.x) < a.half + 2 && c.y < a.y + 4;
        const k = 1 - Math.exp(-12 * dt);
        a.a += ((close ? 0 : near || block || a.label ? 0.12 : 1) - a.a) * (close ? 1 - Math.exp(-24 * dt) : k);
        a.banner.visible = a.a > 0.02;
        a.pa += ((block ? 0.15 : 1) - a.pa) * k;
        for (const m of a.mats) {
          m.opacity = a.a;
          m.depthWrite = a.a > 0.95;
        }
        for (const m of a.pmats) {
          m.opacity = a.pa;
          m.depthWrite = a.pa > 0.95;
        }
      }
    }
    if (this.camera && this.focus) this.fadeFlags(dt);
    if (this.mats.has('puffWarn')) this.mats.get('puffWarn').emissiveIntensity = 2.2 + Math.sin(t * Math.PI * 3) * 0.8;
    this.updateCoins(dt);
    if (this.decor && this.decor.update) this.decor.update(t, dt);
    if (this.wind) this.wind.update(t, dt);
    if (this.rhythm) this.rhythm.update(t, dt);
    if (this.train) this.train.update(t, dt);
  }

  groundBelow(x, z, fromY, r = 0.3) {
    let best = -Infinity;
    for (const c of this.colliders) {
      if (!c.active) continue;
      const top = c.y + c.hy;
      if (top > fromY + 0.05) continue;
      if (this.overlapXZ(c, x, z, r) && top > best) best = top;
    }
    return best;
  }

  overlapXZ(c, x, z, r) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (c.shape === 'cyl') return dx * dx + dz * dz < (c.r + r) * (c.r + r);
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    const qx = Math.max(-c.hx, Math.min(c.hx, lx));
    const qz = Math.max(-c.hz, Math.min(c.hz, lz));
    const ex = lx - qx;
    const ez = lz - qz;
    return ex * ex + ez * ez < r * r;
  }

  raycast(o, d, maxD) {
    let best = maxD;
    for (const c of this.colliders) {
      if (!c.active || c.noCam) continue;
      const hx = c.shape === 'cyl' ? c.r : c.hx;
      const hz = c.shape === 'cyl' ? c.r : c.hz;
      const cs = Math.cos(c.yaw);
      const sn = Math.sin(c.yaw);
      const ox = o.x - c.x;
      const oz = o.z - c.z;
      const lox = ox * cs - oz * sn;
      const loz = ox * sn + oz * cs;
      const ldx = d.x * cs - d.z * sn;
      const ldz = d.x * sn + d.z * cs;
      const loy = o.y - c.y;
      const pad = 0.25;
      let t0 = 0;
      let t1 = best;
      const slab = (p, v, h) => {
        if (Math.abs(v) < 1e-6) return p >= -h - pad && p <= h + pad;
        let a = (-h - pad - p) / v;
        let b = (h + pad - p) / v;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        return t0 <= t1;
      };
      if (!slab(lox, ldx, hx)) continue;
      if (!slab(loy, d.y, c.hy)) continue;
      if (!slab(loz, ldz, hz)) continue;
      if (t0 > 0.3 && t0 < best) best = t0;
    }
    return best;
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.decor && this.decor.dispose) this.decor.dispose();
    this.group.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      }
    });
    for (const o of this.owned) if (o && o.dispose) o.dispose();
  }
}
