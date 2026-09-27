import * as THREE from 'three';
import { blockGeo, diskGeo } from './geo.js';
import * as TX from './textures.js';
import { lavaMaterial, beamMaterial } from './shaders.js';
import { buildDecor } from './decor.js';

const UP = new THREE.Vector3(0, 1, 0);
const WIDEN = new Set(['block', 'mover', 'beam', 'ice', 'stone', 'spinner', 'plank']);
const ARCH_H = 6.9;

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
    this.events = null;
    this.nextCp = 1;
    this.beamOn = new THREE.Color(def.id === 3 ? 0x35e0ff : 0x3ddc5a);
    this.beamNext = new THREE.Color(0xffc21a);
    this.beamFinish = new THREE.Color(0xfff2cc);
    this.buildCourse();
    this.buildCoins();
    this.decor = buildDecor(this);
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
    const w = this.def.id;
    const c = this.paletteColor(ci);
    const S = (o) => this.std({ vertexColors: true, ...o });
    const box = (side, top) => [side, side, top, side, side, side];
    const pick = (side, top) => (shape === 'box' ? box(side, top) : [top, side]);
    const key = `${style}_${ci}_${shape}_${spec.conv ? spec.conv.dir : ''}`;
    const cached = this.mats.get(key);
    if (cached) return cached;
    let m;
    const studTop = (col) => this.mat('studTop' + col, () => S({ map: TX.studTop(), color: col, roughness: 0.48, metalness: 0.02 }));
    const studSide = (col) => this.mat('studSide' + col, () => S({ map: TX.studSide(), color: col, roughness: 0.55 }));
    const metalT = (col) => this.mat('metal' + col, () => S({ map: TX.metal(), color: col, roughness: 0.4, metalness: 0.45 }));
    const neonTop = (col) => this.mat('neon' + col, () => S({ map: TX.darkPanel(), color: 0xb8c0e8, emissiveMap: TX.neonPanel(), emissive: col, emissiveIntensity: 2.4, roughness: 0.35, metalness: 0.3 }));
    const darkSide = () => this.mat('darkSide', () => S({ map: TX.darkPanel(), color: 0x9aa4d8, roughness: 0.4, metalness: 0.3 }));
    const hazard = () => (w === 3 ? this.mat('trim', () => S({ map: TX.darkPanel(), color: 0x7a6aa8, emissive: 0xff4fd8, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.3 })) : this.mat('hazard', () => S({ map: TX.hazard(), roughness: 0.5 })));
    const wood = () => this.mat('wood', () => S({ map: TX.wood(), roughness: 0.75 }));
    const iceM = () => this.mat('ice', () => S({ map: TX.ice(), color: 0x9cdcff, roughness: 0.06, metalness: 0.05, envMapIntensity: 1.6 }));
    const groundTop = () => {
      if (w === 1) return this.mat('grass', () => S({ map: TX.grass(), roughness: 0.92 }));
      if (w === 2) return this.mat('stoneTop', () => S({ map: TX.stoneTop(), color: 0xd8c8e0, roughness: 0.8 }));
      return this.mat('snow', () => S({ map: TX.snow(), color: 0x8a9ade, roughness: 0.6, envMapIntensity: 0.9 }));
    };
    const groundSide = () => {
      if (w === 1) return this.mat('dirt', () => S({ map: TX.rock('dirt'), roughness: 0.95 }));
      if (w === 2) return this.mat('brick', () => S({ map: TX.brick(), roughness: 0.9 }));
      return this.mat('iceRock', () => {
        const m = S({ map: TX.rock('ice'), roughness: 0.15, metalness: 0.05, envMapIntensity: 1.3 });
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(0.42, 0.34, 0.7), vec3(1.0), smoothstep(0.6, 0.92, vColor.r));');
        };
        m.customProgramCacheKey = () => 'iceRockLav';
        return m;
      });
    };
    const blockTop = (col) => (w === 1 ? studTop(col) : w === 2 ? metalT(col) : neonTop(col));
    const blockSide = (col) => (w === 1 ? studSide(col) : w === 2 ? metalT(col) : darkSide());
    switch (style) {
      case 'ground':
      case 'arena':
        m = pick(groundSide(), groundTop());
        break;
      case 'block':
      case 'mover':
        m = pick(blockSide(c), blockTop(c));
        break;
      case 'spinner':
        m = pick(
          w === 3 ? darkSide() : this.mat('candy' + c, () => S({ map: TX.candy('#ffffff', '#' + new THREE.Color(c).getHexString()), roughness: 0.5 })),
          blockTop(c),
        );
        break;
      case 'plank':
        m = pick(w === 1 ? wood() : blockSide(c), w === 1 ? wood() : blockTop(c));
        break;
      case 'beam':
        m = pick(w === 1 ? wood() : w === 2 ? hazard() : darkSide(), w === 1 ? wood() : w === 2 ? metalT(0x9098a8) : neonTop(0x35e0ff));
        break;
      case 'crumble': {
        let top;
        if (w === 1) top = this.mat('crumble1', () => S({ map: TX.crackedTop(), color: 0xffc56b, roughness: 0.8 }));
        else if (w === 2) top = this.mat('crumble2', () => S({ map: TX.rock('basalt'), emissiveMap: TX.crackGlow(), emissive: 0xff5a00, emissiveIntensity: 2.2, roughness: 0.85 }));
        else top = this.mat('crumble3', () => S({ map: TX.ice(), color: 0xcfefff, emissiveMap: TX.crackGlow(), emissive: 0x35d8ff, emissiveIntensity: 1.8, roughness: 0.1, envMapIntensity: 1.4 }));
        m = pick(top, top);
        break;
      }
      case 'pad': {
        const top = this.mat('padTop', () => S({ color: 0x2a4fb8, emissiveMap: TX.padArrows(), emissive: 0xffd22e, emissiveIntensity: 2.2, roughness: 0.4 }));
        m = pick(hazard(), top);
        break;
      }
      case 'tramp': {
        const top = w === 3 ? neonTop(0xff4fd8) : this.mat('trampTop', () => S({ map: TX.trampTop(), roughness: 0.45 }));
        const side = w === 3 ? darkSide() : this.mat('trampSide', () => S({ color: 0x2f7fe8, roughness: 0.35, metalness: 0.3 }));
        m = pick(side, top);
        break;
      }
      case 'conveyor': {
        const dir = spec.conv.dir;
        const t = TX.conveyor(dir).clone();
        t.needsUpdate = true;
        this.track(t);
        const glow = { 1: 0xffc21a, 2: 0xff7a1a, 3: 0x35e0ff }[w];
        const top = this.track(S({ map: t, emissiveMap: t, emissive: glow, emissiveIntensity: w === 1 ? 0.9 : 1.8, roughness: 0.6 }));
        this.convTex.push({ t, dir, speed: spec.conv.speed });
        m = pick(hazard(), top);
        break;
      }
      case 'curb': {
        const cm = this.mat('candyRed', () => S({ map: TX.candy('#ffffff', '#ff4d5e'), roughness: 0.5 }));
        m = pick(cm, cm);
        break;
      }
      case 'hub':
      case 'axle':
        m = pick(hazard(), w === 3 ? neonTop(0xff4fd8) : metalT(0x777d8c));
        break;
      case 'pillar':
        m = pick(w === 3 ? darkSide() : groundSide(), metalT(0x777d8c));
        break;
      case 'stone': {
        const s = this.mat('stoneGlow', () => S({ map: TX.rock('basalt'), emissiveMap: TX.crackGlow(), emissive: 0xff4a00, emissiveIntensity: 1.2, roughness: 0.85 }));
        const t = this.mat('stoneTopDark', () => S({ map: TX.stoneTop(), color: 0x8a7a90, roughness: 0.8 }));
        m = pick(s, t);
        break;
      }
      case 'ice':
        m = pick(iceM(), iceM());
        break;
      case 'lava': {
        const l = this.mat('lava', () => lavaMaterial());
        if (!this.shaderMats.includes(l)) this.shaderMats.push(l);
        m = pick(l, l);
        break;
      }
      default:
        m = pick(studSide(c), studTop(c));
    }
    this.mats.set(key, m);
    return m;
  }

  buildCourse() {
    for (const s of this.course.specs) {
      if (s.t === 'block') this.addBlock(s);
      else if (s.t === 'disk') this.addDisk(s);
      else if (s.t === 'bar') this.addBar(s);
      else if (s.t === 'cp') this.addCheckpoint(s, false);
      else if (s.t === 'finish') this.addCheckpoint(s, true);
      else if (s.t === 'start') this.addArch(s.x, s.y, s.z, 'BAŞLA', false);
      else if (s.t === 'bigstar') this.addBigStar(s);
      else if (s.t === 'chest') this.addChest(s);
      else if (s.t === 'rail') this.addRail(s);
    }
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
      style: s.style,
      stage: s.stage,
      squash: 0,
    });
    if (s.conv) {
      const d = { z: [0, 1], 'x+': [1, 0], 'x-': [-1, 0] }[s.conv.dir];
      c.conv = { vx: d[0] * s.conv.speed, vz: d[1] * s.conv.speed };
    }
    if (s.move || s.spin) {
      c.base = { x: c.x, y: c.y, z: c.z, yaw: c.yaw };
      c.move = s.move || null;
      c.spin = s.spin || 0;
      c.ph = 0;
      c.slow = 1;
      this.dynamic.push(c);
    }
    if (s.crumble) {
      c.crumble = { delay: s.crumble.delay, state: 'idle', t: 0, base: obj.position.clone() };
      this.crumbles.push(c);
    }
    if (!s.nocollide) this.colliders.push(c);
    return c;
  }

  addMesh(geo, mats, cast = true) {
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
    const w = this.def.id;
    if (s.style === 'ground' && w === 1) {
      const body = this.addMesh(blockGeo(s.sx, s.sy - 0.3, s.sz, 0.3, 2.5), this.styleMats('ground', 0, 'box', s)[0]);
      body.position.y = -0.15;
      const cap = this.addMesh(blockGeo(s.sx + 0.26, 0.44, s.sz + 0.26, 0.2, 2.5), this.styleMats('ground', 0, 'box', s)[2]);
      cap.position.y = s.sy / 2 - 0.22;
      obj.add(body, cap);
    } else {
      const tile = s.style === 'ground' || s.style === 'stone' ? 2.5 : s.style === 'conveyor' ? 1.6 : 2;
      const mesh = this.addMesh(blockGeo(s.sx, s.sy, s.sz, s.style === 'beam' || s.style === 'curb' ? 0.14 : 0.24, tile), this.styleMats(s.style, s.color, 'box', s));
      obj.add(mesh);
      if (w === 3 && (s.style === 'block' || s.style === 'mover' || s.style === 'plank')) {
        const band = this.addMesh(blockGeo(s.sx + 0.14, 0.14, s.sz + 0.14, 0.07, 2), this.mat('band' + s.color, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(this.paletteColor(s.color)).multiplyScalar(2.2) })), false);
        band.position.y = -s.sy * 0.18;
        obj.add(band);
      }
    }
    this.group.add(obj);
    const c = { shape: 'box', x: s.x, y: cy, z: s.z, hx: s.sx / 2, hy: s.sy / 2, hz: s.sz / 2, yaw: s.yaw || 0 };
    const col = this.addCollider(c, s, obj);
    if (s.chevrons) this.addChevrons(col, obj, s);
    return col;
  }

  addChevrons(c, obj, s) {
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
    const g = this.track(new THREE.ShapeGeometry(shape));
    g.rotateX(-Math.PI / 2);
    const group = new THREE.Group();
    group.position.y = s.sy / 2 + 0.03;
    const mats = [];
    for (let i = 0; i < 3; i++) {
      const m = this.track(new THREE.MeshBasicMaterial({ color: 0xfff04a, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      const mesh = new THREE.Mesh(g, m);
      mesh.position.z = (1 - i) * 1.25;
      mesh.renderOrder = 2;
      group.add(mesh);
      mats.push(m);
    }
    obj.add(group);
    this.ferryFx.push({ c, group, mats });
  }

  addRail(s) {
    const len = s.z0 - s.z1;
    const cz = (s.z0 + s.z1) / 2;
    const railM = this.mat('ferryRail', () => this.std({ color: 0x8c95a8, roughness: 0.35, metalness: 0.6 }));
    const tieM = this.mat('ferryTie', () => this.std({ color: 0x9a6b3f, roughness: 0.8 }));
    const railG = this.track(new THREE.BoxGeometry(0.22, 0.2, len));
    const tieG = this.track(new THREE.BoxGeometry(s.w * 0.72, 0.14, 0.34));
    const stopG = this.track(new THREE.BoxGeometry(0.4, 0.5, 0.3));
    const stopM = this.mat('ferryStop', () => this.std({ color: 0xffc21a, roughness: 0.5 }));
    const obj = new THREE.Group();
    obj.position.set(s.x, s.y - 0.12, cz);
    for (const side of [-1, 1]) {
      const r = this.addMesh(railG, railM);
      r.position.x = side * s.w * 0.3;
      obj.add(r);
      for (const end of [-1, 1]) {
        const st = this.addMesh(stopG, stopM);
        st.position.set(side * s.w * 0.3, 0.1, end * (len / 2 + 0.15));
        obj.add(st);
      }
    }
    const n = Math.max(2, Math.round(len / 1.1));
    for (let i = 0; i <= n; i++) {
      const tie = this.addMesh(tieG, tieM);
      tie.position.set(0, -0.12, -len / 2 + 0.2 + ((len - 0.4) * i) / n);
      obj.add(tie);
    }
    this.group.add(obj);
  }

  addDisk(s) {
    const cy = s.y - s.sy / 2;
    const obj = new THREE.Group();
    obj.position.set(s.x, cy, s.z);
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
      const legG = this.track(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = this.addMesh(legG, legM);
        leg.position.set(Math.cos(a) * s.r * 0.75, -0.9, Math.sin(a) * s.r * 0.75);
        obj.add(leg);
      }
    }
    obj.add(mesh);
    this.group.add(obj);
    const c = { shape: 'cyl', x: s.x, y: cy, z: s.z, r: s.r, hy: s.sy / 2, yaw: 0 };
    if (s.style === 'tramp') c.meshY = mesh;
    return this.addCollider(c, s, obj);
  }

  addBar(s) {
    const w = this.def.id;
    const col = w === 3 ? 0xff4fd8 : w === 2 ? 0xff4a1a : 0xff4d5e;
    const m = this.mat('bar' + w, () => this.std({ color: col, emissive: col, emissiveIntensity: w === 1 ? 0.5 : 2.4, roughness: 0.35, metalness: 0.2 }));
    const tipM = this.mat('barTip', () => this.std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: w === 1 ? 0.2 : 1.2, roughness: 0.3 }));
    const obj = new THREE.Group();
    obj.position.set(s.x, s.y, s.z);
    const g = this.track(new THREE.CylinderGeometry(s.radius, s.radius, s.len, 16, 1));
    g.rotateZ(Math.PI / 2);
    g.translate(s.len / 2, 0, 0);
    const tg = this.track(new THREE.SphereGeometry(s.radius * 1.35, 16, 12));
    for (let k = 0; k < s.arms; k++) {
      const arm = new THREE.Group();
      arm.rotation.y = (k / s.arms) * Math.PI * 2;
      const bar = this.addMesh(g, m);
      const tip = this.addMesh(tg, tipM);
      tip.position.x = s.len;
      arm.add(bar, tip);
      obj.add(arm);
    }
    this.group.add(obj);
    this.bars.push({ x: s.x, y: s.y, z: s.z, len: s.len, radius: s.radius, speed: s.speed, arms: s.arms, phase: s.phase || 0, angle: s.phase || 0, push: !!s.push, stage: s.stage, ph: 0, slow: 1, obj });
  }

  addCheckpoint(s, finish) {
    const w = this.def.id;
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const padTop = this.track(this.std({ color: 0x39425e, emissiveMap: TX.ring(), emissive: finish ? 0xffc21a : 0x9fb4d8, emissiveIntensity: finish ? 1.2 : 0.5, roughness: 0.4 }));
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
      const poleM = this.mat('pole', () => this.std({ color: 0xf2f4f8, roughness: 0.3, metalness: 0.6 }));
      const pole = this.addMesh(this.mat('poleGeo', () => new THREE.CylinderGeometry(0.09, 0.11, 3.6, 10)), poleM);
      const side = (this.course.cps[s.index] && this.course.cps[s.index].r) || 3.2;
      pole.position.set(side - 0.7, 1.8, side - 0.7);
      const knob = this.addMesh(this.mat('knobGeo', () => new THREE.SphereGeometry(0.2, 12, 10)), this.mat('knob', () => this.std({ color: 0xffc21a, emissive: 0xffa000, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 })));
      knob.position.set(side - 0.7, 3.65, side - 0.7);
      const flagGeo = this.track(new THREE.PlaneGeometry(1.7, 1.05, 12, 4));
      flagGeo.translate(0.85, 0, 0);
      const texOff = this.track(TX.flag(s.index + 1, false));
      const texOn = this.track(TX.flag(s.index + 1, true));
      const flagM = this.track(this.std({ map: texOff, side: THREE.DoubleSide, roughness: 0.7 }));
      flagM.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= texture2D( map, gl_FrontFacing ? vMapUv : vec2( 1.0 - vMapUv.x, vMapUv.y ) );');
      };
      flagM.customProgramCacheKey = () => 'flag2';
      const flag = new THREE.Mesh(flagGeo, flagM);
      flag.castShadow = true;
      flag.position.set(side - 0.7, 2.95, side - 0.7);
      flag.rotation.y = Math.PI / 4 + Math.PI;
      flag.userData.base = Float32Array.from(flagGeo.attributes.position.array);
      g.add(pole, knob, flag);
      cp.flag = flag;
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

  cpAt(i) {
    return this.cps.find((c) => c.index === i);
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
    for (const c of this.colliders) {
      if (!WIDEN.has(c.style) || c.crumble || !c.obj) continue;
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
    const band = this.addMesh(bandG, gold);
    band.position.y = 0.72;
    const lid = new THREE.Group();
    lid.position.set(0, 0.8, -0.45);
    const lidM = this.addMesh(blockGeo(1.3, 0.34, 0.9, 0.12, 1), wood);
    lidM.position.set(0, 0.17, 0.45);
    const lidBand = this.addMesh(blockGeo(0.2, 0.38, 0.96, 0.06, 1), gold);
    lidBand.position.set(0, 0.17, 0.45);
    const lock = this.addMesh(blockGeo(0.26, 0.3, 0.12, 0.04, 1), gold);
    lock.position.set(0, 0.62, 0.47);
    lid.add(lidM, lidBand);
    g.add(body, band, lid, lock);
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
    const H = ARCH_H;
    for (const sx of [-span, span]) {
      const p = this.addMesh(blockGeo(0.9, H, 0.9, 0.3, 1), pillarM);
      p.position.set(x + sx, y + H / 2, z);
      this.group.add(p);
      const cap = this.addMesh(diskGeo(0.7, 0.5, 0.2), [edgeM, edgeM]);
      cap.position.set(x + sx, y + H + 0.2, z);
      this.group.add(cap);
      this.colliders.push({ shape: 'box', x: x + sx, y: y + H / 2, z, hx: 0.45, hy: H / 2, hz: 0.45, yaw: 0, dx: 0, dy: 0, dz: 0, dyaw: 0, active: true, surface: null, kill: false, power: 0 });
    }
    const bgeo = this.track(new THREE.BoxGeometry(span * 2 - 0.9, 1.5, 0.35));
    const fadeEdge = this.track(edgeM.clone());
    for (const m of [fadeEdge, bannerM]) m.transparent = true;
    const banner = new THREE.Mesh(bgeo, [fadeEdge, fadeEdge, fadeEdge, fadeEdge, bannerM, bannerM]);
    banner.castShadow = true;
    banner.position.set(x, y + H - 0.7, z);
    this.group.add(banner);
    const arch = { x, y: y + H - 0.7, z, half: span, mats: [fadeEdge, bannerM], a: 1 };
    this.arches = this.arches || [];
    this.arches.push(arch);
  }

  buildCoins() {
    const list = this.course.coins;
    const g = this.track(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 28));
    g.rotateX(Math.PI / 2);
    const face = this.track(this.std({ map: TX.coinFace(), emissiveMap: TX.coinFace(), emissive: 0xffc21a, emissiveIntensity: 1.6, metalness: 0.55, roughness: 0.28 }));
    const rim = this.track(this.std({ color: 0xffb300, emissive: 0xff9500, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.25 }));
    const mesh = new THREE.InstancedMesh(g, [rim, face, face], list.length);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.coinMesh = mesh;
    const ghost = (m) => {
      const c = this.track(m.clone());
      c.transparent = true;
      c.opacity = 0.25;
      c.depthWrite = false;
      c.emissiveIntensity *= 0.3;
      return c;
    };
    const faceG = ghost(face);
    this.coinGhost = new THREE.InstancedMesh(g, [ghost(rim), faceG, faceG], list.length);
    this.coinGhost.frustumCulled = false;
    this.coinGhost.renderOrder = 4;
    this.coins = list.map((c, i) => ({ x: c.x, y: c.y, z: c.z, stage: c.stage, taken: false, t: 0, phase: i * 0.7 }));
    this.group.add(mesh, this.coinGhost);
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
      let s = 1;
      let lift = 0;
      if (c.taken) {
        c.t += dt;
        const k = Math.min(1, c.t / 0.3);
        s = k < 0.3 ? 1 + k * 1.5 : Math.max(0, 1.45 * (1 - (k - 0.3) / 0.7));
        lift = k * 1.2;
      }
      q.setFromAxisAngle(UP, t * 3 + c.phase + (c.taken ? c.t * 30 : 0));
      p.set(c.x, c.y + Math.sin(t * 2.2 + c.phase) * 0.15 + lift, c.z);
      const ghost = s > 0 && this.hidesPlayer(p.x, p.y, p.z);
      sc.setScalar(ghost ? 0 : s);
      m.compose(p, q, sc);
      this.coinMesh.setMatrixAt(i, m);
      sc.setScalar(ghost ? s : 0);
      m.compose(p, q, sc);
      this.coinGhost.setMatrixAt(i, m);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.coinGhost.instanceMatrix.needsUpdate = true;
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
    cp.padTop.emissive.set(this.def.id === 3 ? 0x35e0ff : 0x3ddc5a);
    cp.padTop.emissiveIntensity = 0.9;
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
      cp.padTop.emissive.set(0x9fb4d8);
      cp.padTop.emissiveIntensity = 0.5;
      cp.beamT = 0;
    }
  }

  step(dt) {
    this.time += dt;
    for (const c of this.dynamic) {
      c.ph += dt * c.slow;
      const t = c.ph;
      const ox = c.x;
      const oy = c.y;
      const oz = c.z;
      const oyaw = c.yaw;
      if (c.move) {
        const s = c.move.hold ? this.holdWave(c, t) : Math.sin(t * c.move.speed + (c.move.phase || 0));
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
  }

  holdWave(c, t) {
    const m = c.move;
    const leg = Math.PI / m.speed;
    const u = t % (2 * (leg + m.hold));
    c.heading = u < m.hold + leg ? -1 : 1;
    if (u < m.hold) {
      c.moving = 0;
      return 1;
    }
    if (u < m.hold + leg) {
      c.moving = 1;
      return Math.cos((Math.PI * (u - m.hold)) / leg);
    }
    if (u < 2 * m.hold + leg) {
      c.moving = 0;
      return -1;
    }
    c.moving = 1;
    return -Math.cos((Math.PI * (u - 2 * m.hold - leg)) / leg);
  }

  touchCrumble(c) {
    if (c.crumble && c.crumble.state === 'idle') {
      c.crumble.state = 'shake';
      c.crumble.t = 0;
      if (this.events) this.events('crack', c);
    }
  }

  stepCrumble(c, dt) {
    const k = c.crumble;
    k.t += dt;
    const o = c.obj;
    if (k.state === 'shake') {
      const a = 0.05 + (k.t / k.delay) * 0.08;
      o.position.set(k.base.x + (Math.random() - 0.5) * a, k.base.y + (Math.random() - 0.5) * a * 0.5, k.base.z + (Math.random() - 0.5) * a);
      if (k.t > k.delay) {
        k.state = 'fall';
        k.t = 0;
        k.v = 0;
        c.active = false;
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
        k.state = 'idle';
        c.active = true;
      }
    }
  }

  resetCrumbles() {
    for (const c of this.crumbles) {
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
    for (const b of this.bars) b.obj.rotation.y = b.angle;
    for (const cv of this.convTex) {
      const v = (cv.speed / 1.6) * dt;
      if (cv.dir === 'z') cv.t.offset.y += v;
      else if (cv.dir === 'x+') cv.t.offset.x -= v;
      else cv.t.offset.x += v;
    }
    for (const m of this.shaderMats) if (m.uniforms && m.uniforms.time) m.uniforms.time.value = t;
    for (const f of this.ferryFx) {
      f.group.rotation.y = f.c.heading > 0 ? Math.PI : 0;
      for (let i = 0; i < 3; i++) {
        const wave = Math.sin(t * 7 - i * 2.1);
        f.mats[i].opacity = f.c.moving ? 0.5 + 0.5 * Math.max(0, wave) : 0.35 + 0.15 * Math.sin(t * 3);
      }
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
    for (const cp of this.cps) {
      if (cp.flag) {
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
          u.strength.value = k < 1 ? 1.4 * Math.sin(k * Math.PI) + k * 0.1 : 0.1;
          u.color.value.copy(this.beamOn);
        } else if (cp.index === this.nextCp) {
          u.strength.value = 0.6 + 0.25 * Math.sin(t * 3);
          u.color.value.copy(cp.finish ? this.beamFinish : this.beamNext);
        } else u.strength.value = 0;
      }
    }
    for (const f of this.animated) f(t, dt);
    if (this.arches && this.camera) {
      const c = this.camera.position;
      for (const a of this.arches) {
        const near = !!this.view && Math.abs(c.z - a.z) < 8 && Math.abs(c.x - a.x) < a.half + 3 && c.y < a.y + 2.2;
        a.a += ((near ? 0.12 : 1) - a.a) * (1 - Math.exp(-12 * dt));
        for (const m of a.mats) {
          m.opacity = a.a;
          m.depthWrite = a.a > 0.95;
        }
      }
    }
    this.updateCoins(dt);
    if (this.decor && this.decor.update) this.decor.update(t, dt);
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
      if (!c.active) continue;
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
