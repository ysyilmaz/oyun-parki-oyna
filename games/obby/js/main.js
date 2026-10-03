import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, FXAAEffect, BloomEffect, LUT3DEffect, LookupTexture, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WORLDS, worldDef } from './themes.js';
import { buildCourse, PHYS } from './levels.js';
import { World } from './world.js';
import { Player, loadRobot } from './player.js';
import { loadKit } from './kit.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { PointPool, Confetti } from './particles.js';
import { UI } from './ui.js';
import { loadSave, writeSave, SKINS, TRAILS } from './save.js';
import { setMaxAnisotropy } from './textures.js';

const FIXED = 1 / 120;
const BLOOM_GAIN = 1.2;
const BLOOM_THRESHOLD = 0.85;
const GRADES = {
  1: { sat: 1.1, shadow: [-0.01, 0.0, 0.03], high: [0.025, 0.012, -0.02], contrast: 0.12 },
  2: { sat: 1.06, shadow: [0.035, 0.0, -0.02], high: [0.02, 0.0, -0.03], contrast: 0.14 },
  3: { sat: 1.08, shadow: [0.0, -0.01, 0.045], high: [0.03, 0.0, 0.035], contrast: 0.1 },
  4: { sat: 1.06, shadow: [-0.01, 0.012, 0.03], high: [0.022, 0.014, -0.016], contrast: 0.1 },
  5: { sat: 1.04, shadow: [-0.006, 0.0, 0.03], high: [0.012, 0.01, 0.0], contrast: 0.12 },
  6: { sat: 1.06, shadow: [0.006, -0.006, 0.032], high: [0.03, 0.012, -0.025], contrast: 0.1 },
};
const CHEST = 15;
const BONUS_STARS = 2;
const FINISH_CONFETTI = [0xffc21a, 0xffd84a, 0x22d8ff, 0xff2fc8, 0xffffff];
const params = parseDebug();
const hasDebug = /(^|&)debug=/.test(location.search.slice(1));

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.info.autoReset = false;
const DPR = window.devicePixelRatio || 1;
let pixelRatio = Math.min(DPR, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.debug.checkShaderErrors = false;
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.onBeforeRender = () => {
  G.mainStart = renderer.info.render.calls;
};
scene.onAfterRender = () => {
  G.mainEnd = renderer.info.render.calls;
};
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -28;
sc.right = 28;
sc.top = 28;
sc.bottom = -28;
sc.near = 1;
sc.far = 180;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0.4, 0.7, 0.3).normalize();

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
composer.addPass(new RenderPass(scene, camera));
const bloom = new BloomEffect({ mipmapBlur: true, levels: 5, intensity: 0.5, luminanceThreshold: 0.9, luminanceSmoothing: 0.3, radius: 0.5 });
const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
const LUTS = {};
const grade = new LUT3DEffect(gradeLut(1));
const aa = new FXAAEffect();
let post = null;
let aaPass = null;

function gradeLut(id) {
  if (LUTS[id]) return LUTS[id];
  const lut = LookupTexture.createNeutral(32);
  const d = lut.image.data;
  const g = GRADES[id] || GRADES[1];
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let gr = d[i + 1];
    let b = d[i + 2];
    const l = r * 0.2126 + gr * 0.7152 + b * 0.0722;
    r = l + (r - l) * g.sat;
    gr = l + (gr - l) * g.sat;
    b = l + (b - l) * g.sat;
    const sh = (1 - l) * (1 - l);
    const hi = l * l;
    r += g.shadow[0] * sh + g.high[0] * hi;
    gr += g.shadow[1] * sh + g.high[1] * hi;
    b += g.shadow[2] * sh + g.high[2] * hi;
    const c = (x) => {
      const y = Math.min(1, Math.max(0, x));
      return y + g.contrast * y * (1 - y) * (y - 0.5) * 2;
    };
    d[i] = c(r);
    d[i + 1] = c(gr);
    d[i + 2] = c(b);
  }
  lut.needsUpdate = true;
  LUTS[id] = lut;
  return lut;
}

function buildPost() {
  if (post) {
    composer.removePass(post);
    post.dispose();
  }
  if (aaPass) composer.removePass(aaPass);
  else aaPass = new EffectPass(camera, aa);
  post = G.tier >= 2 ? new EffectPass(camera, toneMap, grade) : new EffectPass(camera, bloom, toneMap, grade);
  composer.addPass(post);
  composer.addPass(aaPass);
}

const glow = new PointPool(scene, 700, { additive: true, sprite: 'glow' });
const stars = new PointPool(scene, 500, { additive: true, sprite: 'star' });
const dust = new PointPool(scene, 320, { additive: false, sprite: 'puff' });
const confetti = new Confetti(scene, 500);

const input = new Input(canvas);
const audio = new Sound();
const rig = new CameraRig(camera);

const G = {
  state: 'loading',
  save: loadSave(),
  menuWorld: 1,
  world: null,
  worldId: 0,
  bonus: false,
  worldBonus: false,
  course: null,
  def: null,
  player: null,
  cp: 0,
  coinsRun: 0,
  bigRun: [],
  deaths: 0,
  runTime: 0,
  deathT: 0,
  deathReason: null,
  invuln: 0,
  fails: 0,
  finishT: 0,
  prevState: null,
  time: 0,
  fps: 60,
  trailT: 0,
  saveTimer: null,
  audio,
  ui: null,
  preview: null,
  hintShown: false,
  events: [],
  tier: 0,
  lookIdle: 0,
  warm: 0,
  pushT: 0,
  deathHold: 0.66,
  hudHold: 0,
  runId: 0,
};

function logEvent(type, data) {
  G.events.push({ t: Math.round(performance.now()), type, ...(data || {}) });
  if (G.events.length > 600) G.events.splice(0, G.events.length - 600);
}

for (const n of ['jump', 'land', 'coin', 'checkpoint', 'pad', 'boing', 'crack', 'creak', 'death', 'splash', 'respawn', 'click', 'buy', 'nope', 'win', 'whoosh']) {
  const f = audio[n].bind(audio);
  audio[n] = (...a) => {
    logEvent('sound', { name: n });
    return f(...a);
  };
}

function parseDebug() {
  const out = {};
  const q = decodeURIComponent(location.search.slice(1));
  const w = +new URLSearchParams(location.search).get('world');
  if (w) out.world = w;
  if (!/(^|&)debug=/.test(q)) return out;
  const raw = q.replace(/^.*?debug=/, '');
  for (const tok of raw.split(/[&,]/)) {
    const [k, v] = tok.split(/[:=]/);
    if (k) out[k] = v === undefined ? true : isNaN(+v) ? v : +v;
  }
  return out;
}

const worldIndex = (id) => WORLDS.findIndex((w) => w.id === id);
const nextWorldId = (id) => (WORLDS[worldIndex(id) + 1] || {}).id || null;

G.isUnlocked = (id) => {
  const i = worldIndex(id);
  return i === 0 || (i > 0 && !!G.save.finished[WORLDS[i - 1].id]) || (i > 0 && !!params.unlock);
};

G.persist = () => {
  writeSave(G.save);
};

function persistSoon() {
  clearTimeout(G.saveTimer);
  G.saveTimer = setTimeout(G.persist, 700);
}

function storeProgress() {
  if (!G.world || G.bonus || !['play', 'dead', 'paused'].includes(G.state)) return;
  G.save.progress = {
    w: G.worldId,
    cp: G.cp,
    taken: G.world.coins.map((c, i) => (c.taken ? i : -1)).filter((i) => i >= 0),
    big: G.bigRun.slice(),
    coins: G.coinsRun,
    deaths: G.deaths,
    time: Math.round(G.runTime),
  };
}

function rimColor() {
  return G.def ? G.def.rim : WORLDS[0].rim;
}

function rimStrength() {
  return G.def ? G.def.rimK : WORLDS[0].rimK;
}

function applyTheme(def) {
  scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
  hemi.color.set(def.hemi.sky);
  hemi.groundColor.set(def.hemi.ground);
  hemi.intensity = def.hemi.intensity;
  sun.color.set(def.light.color);
  sun.intensity = def.light.intensity;
  sunDir.set(...def.lightDir).normalize();
  renderer.toneMappingExposure = def.exposure;
  bloom.intensity = def.bloom.strength * (def.bloom.gain ?? BLOOM_GAIN);
  bloom.mipmapBlurPass.radius = 0.55 + def.bloom.radius * 0.5;
  bloom.luminanceMaterial.threshold = def.bloom.threshold * BLOOM_THRESHOLD;
  grade.lut = gradeLut(def.id);
  scene.environmentIntensity = def.ambient;
  document.body.style.background = def.menuBg;
  audio.startMusic(def.music);
  if (G.player) G.player.setRim(rimColor(), rimStrength());
}

const AO_BLANK = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
AO_BLANK.needsUpdate = true;

async function loadAOList() {
  G.ao = {};
  G.aoList = {};
  try {
    const res = await fetch('assets/ao.json');
    if (res.ok) G.aoList = await res.json();
  } catch (e) {
    G.aoList = {};
  }
}

function aoFor(id) {
  const a = G.aoList && G.aoList[id];
  if (!a) return null;
  if (!G.ao[id]) G.ao[id] = { tex: { value: AO_BLANK }, rect: { value: new THREE.Vector4(...a.rect) }, strength: { value: a.strength }, file: a.file, loading: null };
  return G.ao[id];
}

function fetchAO(id) {
  const ao = aoFor(id);
  if (!ao || ao.loading) return;
  ao.loading = new THREE.TextureLoader().loadAsync('assets/' + ao.file).then(
    (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      ao.tex.value = tex;
    },
    () => {
      ao.loading = null;
    },
  );
}

function loadWorld(id, bonus = false) {
  if (G.world && G.worldId === id && G.worldBonus === bonus) return;
  if (G.world) G.world.dispose();
  const def = worldDef(id);
  G.def = def;
  G.worldId = id;
  G.worldBonus = bonus;
  G.course = buildCourse(id, bonus);
  G.world = new World(scene, def, G.course, bonus ? null : aoFor(id));
  G.world.camera = camera;
  G.world.audio = audio;
  G.world.runClock = () => G.runTime;
  G.world.decor.sky.onBeforeRender = () => {
    if (G.shadowCalls === null) G.shadowCalls = renderer.info.render.calls - G.mainStart;
  };
  G.cpCols = G.course.cps.map((c) => G.world.colliders.find((k) => k.shape === 'box' && Math.abs(k.x - c.x) < 0.01 && Math.abs(k.z - c.z) < 0.01 && Math.abs(k.y + k.hy - c.y) < 0.01) || null);
  G.world.events = (type, c) => {
    if (type === 'drop') {
      if (G.player.ground === c || G.world.time - c.crumble.on < (G.player.ground ? 0.3 : 0.9)) G.cause = { t: G.runTime, at: new THREE.Vector3(c.x, c.y + c.hy, c.z) };
      return;
    }
    if (type !== 'crack') return;
    audio.crack();
    if (def.crackPuff) emitDust(c.x, c.y + c.hy, c.z, 8, 1.8, def.crackPuff, 0.45, 1.0);
  };
  applyTheme(def);
  lightShadows();
  G.ui.buildTower(G.course.cps.length - 1);
  G.compiled = precompile();
}

function precompile() {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(composer.inputBuffer);
  const done = renderer.compileAsync(scene, camera).catch(() => {});
  renderer.setRenderTarget(prev);
  return done;
}

G.selectWorld = (id) => {
  G.menuWorld = id;
  G.save.selected = id;
  G.persist();
  loadWorld(id);
  placeShowcase();
  G.ui.selectCard(id);
};

function placeShowcase() {
  const p = G.player;
  p.spawn(0, 0, 1.2, 0);
  p.animOverride = 'Dance';
  p.frozen = true;
}

function showScreen(name) {
  for (const s of ['menu', 'pause', 'results', 'shop', 'loading']) G.ui.show(s, s === name);
  if (name !== 'none' && name !== 'pause') G.ui.clearQueue();
  const inGame = ['play', 'dead', 'finish', 'paused', 'results'].includes(G.state);
  G.ui.show('hud', inGame && name !== 'results');
  G.ui.show('touch', inGame && input.touchMode && (G.state === 'play' || G.state === 'dead'));
}

G.toMenu = () => {
  if (['play', 'dead', 'paused'].includes(G.state)) {
    storeProgress();
    G.persist();
  }
  G.state = 'menu';
  G.bonus = false;
  confetti.clear();
  G.ui.skip(false);
  if (!G.isUnlocked(G.menuWorld)) G.menuWorld = WORLDS[0].id;
  loadWorld(G.menuWorld);
  grantGifts();
  resetRun();
  placeShowcase();
  G.ui.buildWorldCards();
  G.ui.wallet(G.save.coins);
  showScreen('menu');
};

function resetRun() {
  const w = G.world;
  w.resetCoins();
  w.resetCheckpoints();
  w.resetCrumbles();
  w.resetBigStars([]);
  w.setAssist(null);
  audio.setLayer(0);
  w.nextCp = 1;
  G.cp = 0;
  G.coinsRun = 0;
  G.hudHold = 0;
  G.secretBonus = 0;
  G.secHold = 0;
  G.trailPreview = null;
  G.runId = (G.runId || 0) + 1;
  G.secret = null;
  G.midSpawn = null;
  G.cause = null;
  G.portal = null;
  document.getElementById('fade').classList.remove('on', 'portal');
  G.bigRun = [];
  G.deaths = 0;
  G.runTime = 0;
  G.fails = 0;
  G.invuln = 0;
}

G.bonusOpen = (id) => (G.save.stars[id] || 0) >= BONUS_STARS || !!params.unlock;

G.play = (id, cpIndex = null, fresh = false, bonus = false) => {
  if (!G.isUnlocked(id)) id = WORLDS[0].id;
  if (bonus && !G.bonusOpen(id)) bonus = false;
  G.menuWorld = id;
  G.bonus = bonus;
  loadWorld(id, bonus);
  if (!bonus) fetchAO(id);
  resetRun();
  const pr = G.save.progress;
  if (bonus) {
    cpIndex = 0;
    fresh = false;
  } else if (cpIndex === null) {
    cpIndex = 0;
    if (!fresh && pr && pr.w === id && pr.cp > 0) {
      cpIndex = pr.cp;
      pr.taken.forEach((i) => {
        if (G.world.coins[i]) {
          G.world.coins[i].taken = true;
          G.world.coins[i].t = 1;
        }
      });
      G.bigRun = (pr.big || []).slice();
      G.world.resetBigStars(G.bigRun);
      G.coinsRun = pr.coins || 0;
      G.deaths = pr.deaths || 0;
      G.runTime = pr.time || 0;
    }
  }
  if (!bonus && (fresh || (pr && pr.w !== id))) G.save.progress = null;
  cpIndex = Math.max(0, Math.min(cpIndex, G.course.cps.length - 2));
  for (let i = 1; i <= cpIndex; i++) G.world.activateCheckpoint(G.world.cpAt(i), true);
  const opened = G.world.chests.filter((ch) => ch.index <= cpIndex);
  for (const ch of opened) G.world.openChest(ch.index, true);
  if (opened.length) audio.setLayer(1);
  G.cp = cpIndex;
  G.world.nextCp = cpIndex + 1;
  const c = G.course.cps[cpIndex];
  const p = G.player;
  p.animOverride = null;
  p.frozen = false;
  p.spawn(c.x, c.y, c.z + (cpIndex === 0 ? 3.4 : 0), Math.PI);
  G.world.dockFor(p);
  rig.pitch = 0.36;
  rig.dist = rig.distTarget;
  rig.snap(p.pos, 0);
  input.reset();
  G.state = 'play';
  showScreen('none');
  G.ui.skip(false);
  G.ui.banner(bonus ? 'Bonus' : cpIndex === 0 ? G.def.name : 'Bölüm ' + (cpIndex + 1), cpIndex === 0 && !bonus);
  G.hintOn = G.def.hint && !bonus && !G.save.learned && !input.touchMode;
  if (G.hintOn) G.ui.hint(false);
  else G.ui.hideHint();
  G.walkT = 0;
  G.jumps = 0;
  audio.whoosh();
  logEvent('start', { world: id, checkpoint: cpIndex });
  updateHud();
};

G.action = (a) => {
  if (a === 'mute') {
    G.save.muted = !G.save.muted;
    audio.setMuted(G.save.muted);
    G.ui.setMuteIcon(G.save.muted);
    G.persist();
    return;
  }
  audio.click();
  if (a === 'pause') togglePause(true);
  else if (a === 'resume') togglePause(false);
  else if (a === 'restart') G.play(G.worldId, 0, true, G.bonus);
  else if (a === 'menu') G.toMenu();
  else if (a === 'next') G.play(nextWorldId(G.worldId) || G.worldId);
  else if (a === 'closeShop') closeShop();
};

function togglePause(on) {
  if (on && (G.state === 'play' || G.state === 'dead')) {
    G.prevState = G.state;
    G.state = 'paused';
    storeProgress();
    G.persist();
    showScreen('pause');
    G.ui.show('hud', true);
    logEvent('pause');
  } else if (!on && G.state === 'paused') {
    G.state = G.prevState || 'play';
    input.reset();
    audio.unlock();
    showScreen('none');
    logEvent('resume');
  }
}

G.openShop = () => {
  G.state = 'shop';
  G.ui.shopSel = null;
  G.ui.shopTab = 'color';
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'color'));
  G.ui.renderShop();
  G.ui.wallet(G.save.coins);
  G.player.animOverride = 'Wave';
  setTimeout(() => {
    if (G.state === 'shop') G.player.animOverride = 'Idle';
  }, 1600);
  showScreen('shop');
};

function closeShop() {
  G.preview = null;
  applySkin();
  G.toMenu();
}

G.previewItem = (tab, id) => {
  if (tab === 'color') {
    const s = SKINS.find((x) => x.id === id);
    G.player.setSkin(s);
    G.player.animOverride = 'Yes';
    setTimeout(() => {
      if (G.state === 'shop') G.player.animOverride = 'Idle';
    }, 1200);
  } else G.preview = id;
};

G.celebrateBuy = () => {
  const p = G.player.pos;
  confetti.burst(p.x, p.y + 1.5, p.z, 90, 8);
  G.player.animOverride = 'ThumbsUp';
  logEvent('unlock', { item: G.ui.shopSel });
  setTimeout(() => {
    if (G.state === 'shop') G.player.animOverride = 'Idle';
  }, 1500);
};

function applySkin() {
  const s = SKINS.find((x) => x.id === G.save.color) || SKINS[0];
  G.player.setSkin(s);
  G.ui.headColor(s.metal || s.rainbow ? s.css : '#' + s.color.toString(16).padStart(6, '0'));
}

G.skipStage = () => {
  if (G.state !== 'play' || G.portal) return;
  audio.click();
  G.ui.skip(false);
  if (G.secret) {
    const out = G.world.portals.find((pt) => pt.out);
    logEvent('skip', { secret: true });
    enterPortal({ to: out.to, back: true });
    return;
  }
  const next = G.cp + 1;
  if (next >= G.course.cps.length - (G.bonus ? 1 : 0)) return;
  logEvent('skip', { checkpoint: next });
  const c = G.course.cps[next];
  G.player.spawn(c.x, c.y, c.z, Math.PI);
  G.world.dockFor(G.player);
  rig.snap(G.player.pos, rig.yaw);
  reachCheckpoint(next, true);
};

function coinsMax() {
  return G.course.coins.filter((c) => !c.secret).length + G.course.bigStars.length * 10 + G.course.cps.filter((c) => c.chest).length * CHEST;
}

function secretCoins() {
  return G.world.coins.reduce((n, c) => n + (c.secret && c.taken ? 1 : 0), 0);
}

function updateHud() {
  const sec = secretCoins();
  G.ui.hud({
    coins: G.coinsRun - G.hudHold - sec,
    coinsMax: coinsMax(),
    secret: sec + (G.secretBonus || 0) - (G.secHold || 0),
    time: G.runTime,
    par: G.def.par,
    stage: Math.min(G.cp + 1, G.course.cps.length - 1),
    stageMax: G.course.cps.length - 1,
    big: G.bigRun.length,
    bigMax: G.course.bigStars.length,
  });
}

function emitDust(x, y, z, n, spread, color, size = 0.9, up = 1.2) {
  const k = (G.def && G.def.dustScale) || 1;
  if (k < 1 && color === G.def.dust) {
    n = Math.max(1, Math.round(n * k));
    size *= k;
    spread *= k;
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const s = spread * (0.6 + Math.random() * 0.6);
    dust.emit(x + Math.cos(a) * 0.3, y + 0.1, z + Math.sin(a) * 0.3, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, { life: 0.5 + Math.random() * 0.3, size, size1: size * 2.2, color, drag: 4, gravity: -0.5 });
  }
}

function dustColor() {
  return G.def.dust;
}

function handlePlayerEvents() {
  const p = G.player;
  for (const e of p.events) {
    const x = p.pos.x;
    const y = p.pos.y;
    const z = p.pos.z;
    if (e.type === 'jump') {
      audio.jump();
      emitDust(x, y, z, 8, 2.2, dustColor(), 0.6);
      G.jumps = (G.jumps || 0) + 1;
      logEvent('jump');
    } else if (e.type === 'land') {
      audio.land(0.5 + e.data);
      emitDust(x, y, z, 12, 3 + e.data * 3, dustColor(), 0.7);
      G.world.landed(x, y, z);
      logEvent('land', { power: Math.round(e.data * 100) / 100 });
    } else if (e.type === 'step') {
      emitDust(x, y, z, 2, 0.8, dustColor(), 0.4, 0.6);
    } else if (e.type === 'pad') {
      audio.pad();
      rig.kick(16);
      logEvent('pad');
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        glow.emit(x + Math.cos(a) * 0.9, y + 0.2, z + Math.sin(a) * 0.9, Math.cos(a) * 1.2, 6 + Math.random() * 6, Math.sin(a) * 1.2, { life: 0.8, size: 0.5, size1: 0.1, color: 0xffd22e, drag: 2 });
      }
    } else if (e.type === 'tramp') {
      audio.boing();
      rig.kick(7);
      logEvent('bounce');
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        stars.emit(x, y + 0.2, z, Math.cos(a) * 4, 2 + Math.random() * 3, Math.sin(a) * 4, { life: 0.6, size: 0.55, size1: 0.1, color: 0xff8ad8, drag: 3 });
      }
    } else if (e.type === 'ledge') {
      emitDust(x, y, z, 6, 1.6, dustColor(), 0.5, 0.8);
      logEvent('ledge');
    } else if (e.type === 'wall') {
      G.cause = { t: G.runTime, at: new THREE.Vector3(e.data.x, e.data.y, e.data.z) };
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        stars.emit(e.data.x, e.data.y - 0.3, e.data.z, Math.cos(a) * 2.5, 1.5 + Math.random() * 2, Math.sin(a) * 2.5, { life: 0.9, size: 0.5, size1: 0.08, color: 0xfff2a0, drag: 3 });
      }
    } else if (e.type === 'wind') {
      G.cause = { t: G.runTime, at: new THREE.Vector3(e.data.x, e.data.y + 0.6, e.data.z) };
    } else if (e.type === 'lift' || e.type === 'liftOff') {
      if (e.type === 'lift') audio.whoosh();
      else {
        audio.pad();
        const tg = e.data.target;
        G.cause = { t: G.runTime, at: new THREE.Vector3(tg.x, tg.y + 0.6, tg.z) };
      }
      logEvent(e.type);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        glow.emit(x + Math.cos(a) * 0.8, y + 0.2, z + Math.sin(a) * 0.8, Math.cos(a) * 1.5, 3 + Math.random() * 3, Math.sin(a) * 1.5, { life: 0.7, size: 0.45, size1: 0.05, color: 0xbfefff, drag: 2 });
      }
    }
    else if (e.type === 'kill') die('hazard');
  }
  p.events.length = 0;
}

function die(reason) {
  if (G.state !== 'play') return;
  G.state = 'dead';
  G.deathReason = reason;
  G.deathT = 0;
  G.deaths++;
  G.fails++;
  const p = G.player;
  logEvent('fail', { reason, checkpoint: G.cp, pos: v3(p.pos) });
  if (reason === 'fall') {
    audio.splash();
    const hit = G.cause && G.runTime - G.cause.t < 2 ? G.cause : null;
    G.deathHold = hit ? 1.8 : p.walked ? 1.5 : 0.66;
    rig.frozenY = p.groundY + 1.4;
    rig.watch = hit ? hit.at : p.pos;
    G.splashed = false;
    p.animOverride = 'Death';
    p.setRim(0xffffff, 1.6);
    G.ui.fell();
  } else {
    audio.death();
    p.dead = true;
    p.setRim(0xff3b1a, 2.2);
    p.sy = 0.62;
    p.sv = 0;
    const col = G.def.hurt;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      glow.emit(p.pos.x, p.pos.y + 0.9, p.pos.z, Math.cos(a) * 5, Math.random() * 5, Math.sin(a) * 5, { life: 0.6, size: 0.6, size1: 0.05, color: col, drag: 3 });
    }
  }
  updateHud();
}

function respawn() {
  const mid = !G.secret && G.midSpawn && G.midSpawn.stage === G.cp ? G.midSpawn : null;
  const c = G.secret || mid || G.course.cps[G.cp];
  const p = G.player;
  G.cause = null;
  p.animOverride = null;
  p.spawn(c.x, c.y, c.z, Math.PI);
  rig.frozenY = null;
  rig.snap(p.pos, rig.yaw);
  G.invuln = 1;
  G.state = 'play';
  G.world.dockFor(p);
  if (G.world.rhythm) G.world.rhythm.respawned();
  input.jumpQueued = false;
  audio.respawn();
  logEvent('respawn', { checkpoint: G.cp });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    stars.emit(c.x + Math.cos(a) * 1.1, c.y + 0.2, c.z + Math.sin(a) * 1.1, Math.cos(a) * 0.4, 3 + Math.random() * 2, Math.sin(a) * 0.4, { life: 0.9, size: 0.5, size1: 0.1, color: 0x9ff4ff, drag: 1.5 });
  }
  const diskStage = !G.bonus && G.world.colliders.some((c) => c.stage === G.cp && ((c.shape === 'cyl' && !c.kill) || c.wait));
  if (G.fails >= (diskStage ? G.def.diskFails : 3) && G.world.assistStage !== G.cp) {
    G.world.setAssist(G.cp);
    logEvent('assist', { stage: G.cp + 1, fails: G.fails });
  }
  G.ui.skip(G.fails >= 5 && G.cp + 1 < G.course.cps.length - (G.bonus ? 1 : 0), !!G.secret);
}

function splash(pos) {
  const col = G.def.splash;
  emitDust(pos.x, pos.y - 1.6, pos.z, 16, 4.2, 0xffffff, 1, 0.8);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 3;
    glow.emit(pos.x + Math.cos(a) * 0.8, pos.y - 1.4, pos.z + Math.sin(a) * 0.8, Math.cos(a) * r, 2 + Math.random() * 3, Math.sin(a) * r, { life: 0.7, size: 0.55, size1: 0.1, color: i % 3 ? col : 0xffffff, drag: 1.5, gravity: 14 });
  }
}

function poof(pos) {
  emitDust(pos.x, pos.y + 0.5, pos.z, 18, 3.5, 0xffffff, 1.1, 2);
}

function reachCheckpoint(i, silent) {
  const w = G.world;
  const cp = w.cpAt(i);
  const c = G.course.cps[i];
  G.cp = i;
  G.fails = 0;
  G.secret = null;
  w.nextCp = i + 1;
  G.ui.skip(false);
  if (w.assistStage !== null) w.setAssist(null);
  if (c.finish) {
    finishRun();
    return;
  }
  w.activateCheckpoint(cp, false);
  audio.checkpoint();
  logEvent('checkpoint', { index: i, stage: i + 1 });
  confetti.burst(c.x, c.y + 1, c.z, silent ? 40 : 90, 9);
  const col = G.def.cpColor;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    stars.emit(c.x + Math.cos(a) * 1.9, c.y + 0.2, c.z + Math.sin(a) * 1.9, Math.cos(a) * 1.5, 4 + Math.random() * 4, Math.sin(a) * 1.5, { life: 1, size: 0.45, size1: 0.1, color: col, drag: 1.2 });
  }
  G.ui.flyStage(i + 1);
  const words = ['Süper!', 'Harika!', 'Bravo!', 'Aferin!', 'Müthiş!'];
  if (c.chest) openChest(i);
  else G.ui.toast(words[i % words.length], null, true);
  storeProgress();
  G.persist();
  updateHud();
}

function openChest(i) {
  const ch = G.world.openChest(i, false);
  G.save.coins += CHEST;
  G.coinsRun += CHEST;
  audio.setLayer(1);
  audio.buy();
  G.ui.toast('Hazine!');
  G.hudHold += CHEST;
  const run = G.runId;
  G.ui.flyCoins('+' + CHEST, () => {
    if (G.runId === run) G.hudHold = Math.max(0, G.hudHold - CHEST);
  });
  logEvent('reward', { kind: 'chest', value: CHEST, checkpoint: i });
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2;
    stars.emit(ch.x, ch.y + 1, ch.z, Math.cos(a) * 2.5, 5 + Math.random() * 5, Math.sin(a) * 2.5, { life: 1, size: 0.55, size1: 0.1, color: k % 3 ? 0xffd22e : 0xffb000, drag: 1.5, gravity: 6 });
  }
  glow.emit(ch.x, ch.y + 1, ch.z, 0, 1, 0, { life: 0.5, size: 2.6, size1: 0.4, color: 0xffa000 });
}

function finishRun() {
  G.state = 'finish';
  G.finishT = 0;
  const p = G.player;
  p.frozen = true;
  p.vel.set(0, 0, 0);
  p.animOverride = 'Dance';
  audio.win();
  const c = G.course.cps[G.cp];
  confetti.burst(c.x, c.y + 2, c.z, 160, 11, 1, FINISH_CONFETTI);
  G.ui.toast('BİTİŞ!');
  const id = G.worldId;
  const s = G.save;
  const total = coinsMax();
  if (G.bonus) {
    const first = !s.bonus[id];
    s.bonus[id] = true;
    s.coins += first ? 50 : 20;
    const prevB = s.bonusBest[id];
    const recB = !prevB || G.runTime < prevB;
    if (recB) s.bonusBest[id] = G.runTime;
    G.persist();
    logEvent('reward', { kind: 'bonus', value: first ? 50 : 20 });
    logEvent('finish', { world: id, bonus: true, time: Math.round(G.runTime * 10) / 10, deaths: G.deaths });
    G.result = { bonus: true, time: G.runTime, coins: G.coinsRun, coinsMax: total, deaths: G.deaths, record: recB && !!prevB, best: s.bonusBest[id], next: false, reward: first ? 50 : 20 };
    rig.orbitT = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
    return;
  }
  const bigMax = G.course.bigStars.length;
  const par = G.def.par;
  const got = [true, G.bigRun.length >= bigMax, G.runTime <= par];
  const st = got.filter(Boolean).length;
  s.coins += 20;
  logEvent('reward', { kind: 'finish', value: 20 });
  const prevBest = s.best[id];
  const record = !prevBest || G.runTime < prevBest;
  if (record) s.best[id] = G.runTime;
  s.stars[id] = Math.max(s.stars[id] || 0, st);
  const next = nextWorldId(id);
  const unlocked = !s.finished[id] && !!next;
  s.finished[id] = true;
  s.progress = null;
  G.persist();
  logEvent('finish', { world: id, time: Math.round(G.runTime * 10) / 10, stars: st, deaths: G.deaths });
  if (unlocked) logEvent('unlock', { world: next });
  const gifts = grantGifts();
  const sec = secretCoins();
  G.result = { time: G.runTime, coins: Math.max(0, G.coinsRun - sec), coinsMax: total, secret: sec + (G.secretBonus || 0), deaths: G.deaths, stars: st, got, par, record: record && !!prevBest, best: s.best[id], next: !!next, big: G.bigRun.length, bigMax, gifts };
  rig.orbitT = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
}

function starTotal() {
  return Object.values(G.save.stars).reduce((a, b) => a + (b || 0), 0);
}

function grantGifts() {
  const have = starTotal();
  const owned = G.save.owned.color;
  const got = SKINS.filter((k) => k.gift && k.stars <= have && !owned.includes(k.id));
  for (const k of got) {
    owned.push(k.id);
    logEvent('unlock', { item: k.id, stars: k.stars });
  }
  if (got.length) G.persist();
  return got.map((k) => k.name);
}

function enterPortal(pt) {
  const p = G.player;
  G.portal = { pt, t: 0, moved: false };
  p.frozen = true;
  p.vel.set(0, 0, 0);
  document.getElementById('fade').classList.add('on', 'portal');
  audio.whoosh();
  if (!pt.back) logEvent('portal', { out: pt.out, checkpoint: G.cp });
}

function stepPortal(dt) {
  const g = G.portal;
  g.t += dt;
  const p = G.player;
  if (!g.moved && g.t >= 0.2) {
    g.moved = true;
    const to = g.pt.to;
    p.spawn(to.x, to.y, to.z, Math.PI);
    G.world.dockFor(p);
    p.frozen = true;
    rig.snap(p.pos, 0);
    if (g.pt.out) {
      G.secret = null;
      secretReward();
    } else if (g.pt.back) G.secret = null;
    else G.secret = { x: to.x, y: to.y, z: to.z };
  }
  if (g.t >= 0.45) {
    document.getElementById('fade').classList.remove('on', 'portal');
    p.frozen = false;
    G.portal = null;
    G.invuln = 0.6;
  }
}

function secretReward() {
  const sr = G.def.secret;
  const s = G.save;
  if (!sr || s.secrets[G.worldId]) {
    G.ui.toast('Gizli yol!');
    return;
  }
  s.secrets[G.worldId] = true;
  if (!s.owned.trail.includes(sr.trail)) s.owned.trail.push(sr.trail);
  s.coins += sr.coins;
  G.persist();
  audio.buy();
  const tr = TRAILS.find((t) => t.id === sr.trail);
  G.ui.toast((tr ? tr.name : '') + ' izi! +' + sr.coins, 'i-trail');
  G.secretBonus = (G.secretBonus || 0) + sr.coins;
  G.secHold = (G.secHold || 0) + sr.coins;
  G.trailPreview = { id: sr.trail, t: 4 };
  const run = G.runId;
  G.ui.flyCoins('+' + sr.coins, () => {
    if (G.runId === run) G.secHold = Math.max(0, G.secHold - sr.coins);
  }, '#hud .coin-pill small .sec');
  logEvent('reward', { kind: 'secret', trail: sr.trail, value: sr.coins });
  const p = G.player.pos;
  confetti.burst(p.x, p.y + 1.5, p.z, 120, 9);
}

function collect(c, cy, pos, r2max) {
  const dx = c.x - pos.x;
  const dy = c.y - cy;
  const dz = c.z - pos.z;
  return dx * dx + dy * dy * 0.6 + dz * dz < r2max;
}

function checkRules() {
  const p = G.player;
  const w = G.world;
  const pos = p.pos;
  const overVoid = pos.y < p.groundY - 2.4 && p.vel.y < 0 && w.groundBelow(pos.x, pos.z, pos.y, PHYS.radius) < pos.y - 8;
  if (overVoid || pos.y < p.groundY - 4 || pos.y < G.def.belowY + 0.3) {
    die('fall');
    return;
  }
  const gs = p.grounded && p.ground && p.ground.spec;
  if (gs && gs.spawn && gs.stage === G.cp && !G.secret) G.midSpawn = { x: gs.x, y: gs.y, z: gs.z, stage: gs.stage };
  G.pushT -= FIXED;
  if (!G.portal) {
    for (const pt of w.portals) {
      if (!w.inWindow(pt.view)) continue;
      const dx = pos.x - pt.x;
      const dz = pos.z - pt.z;
      const dy = pos.y - pt.y;
      if (dx * dx + dz * dz < 1.2 && dy > -0.6 && dy < 2.6) {
        enterPortal(pt);
        return;
      }
    }
  }
  for (const b of w.bars) {
    if (!b.push && G.invuln > 0) continue;
    if (pos.y > b.y + b.radius || pos.y + PHYS.height < b.y - b.radius) continue;
    for (let k = 0; k < b.arms; k++) {
      const a = b.angle + (k / b.arms) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = -Math.sin(a);
      const rx = pos.x - b.x;
      const rz = pos.z - b.z;
      const t = Math.max(0, Math.min(b.len, rx * dx + rz * dz));
      const ex = rx - dx * t;
      const ez = rz - dz * t;
      const rr = PHYS.radius + b.radius - 0.05;
      if (ex * ex + ez * ez < rr * rr) {
        if (!b.push) {
          die('hazard');
          return;
        }
        pushOff(b, a);
        break;
      }
    }
  }
  warnBars(pos);
  G.ui.hazardView(hazardInView());
  const cy = pos.y + 0.9;
  w.coins.forEach((c) => {
    if (c.taken || !collect(c, cy, pos, 1.35)) return;
    c.taken = true;
    c.t = 0;
    G.coinsRun++;
    G.save.coins++;
    storeProgress();
    persistSoon();
    audio.coin();
    G.ui.coinPop();
    logEvent('reward', { kind: 'coin', total: G.coinsRun });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 0.5;
      stars.emit(c.x, c.y, c.z, Math.cos(a) * 3, e * 3, Math.sin(a) * 3, { life: 0.5, size: 0.55, size1: 0.05, color: i % 3 ? 0xffd22e : 0xffffff, drag: 3 });
    }
    glow.emit(c.x, c.y, c.z, 0, 0.5, 0, { life: 0.3, size: 1.4, size1: 0.2, color: 0xffc21a });
    updateHud();
  });
  w.bigStars.forEach((b, i) => {
    if (b.taken || !collect(b, cy, pos, 2.2)) return;
    b.taken = true;
    b.t = 0;
    G.bigRun.push(i);
    G.coinsRun += 10;
    G.save.coins += 10;
    storeProgress();
    persistSoon();
    audio.checkpoint();
    audio.coin();
    G.ui.starPop();
    G.ui.toast('Gizli yıldız!');
    logEvent('reward', { kind: 'bigstar', index: i, value: 10 });
    confetti.burst(b.x, b.y, b.z, 70, 8);
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      stars.emit(b.x, b.y, b.z, Math.cos(a) * 5, (Math.random() - 0.3) * 4, Math.sin(a) * 5, { life: 0.8, size: 0.7, size1: 0.1, color: k % 2 ? 0xff5ad8 : 0xffffff, drag: 2 });
    }
    updateHud();
  });
  const next = G.cp + 1;
  if (next < G.course.cps.length) {
    const c = G.course.cps[next];
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const col = G.cpCols[next];
    const r = (col ? Math.max(col.hx, col.hz) : c.r) + PHYS.radius;
    const onTop = p.ground && p.ground === col;
    const inside = Math.abs(dx) < r && Math.abs(dz) < r;
    const over = !c.finish && !p.grounded && inside && pos.y > c.y - 0.3 && pos.y < c.y + 10;
    const beyond = !c.finish && p.grounded && p.ground && p.ground.stage >= next && !(p.ground.spec && p.ground.spec.side);
    if (onTop || over || beyond || (p.grounded && inside && Math.abs(pos.y - c.y) < 0.3)) reachCheckpoint(next);
  }
}

const hzV = new THREE.Vector3();

function hazardInView() {
  const w = G.world;
  if (!w || !w.bars.length) return false;
  const cam = camera.position;
  for (const b of w.bars) {
    if (Math.hypot(b.x - cam.x, b.z - cam.z) > b.len + 16) continue;
    for (let k = 0; k <= b.arms; k++) {
      const a = b.angle + (k / Math.max(1, b.arms)) * Math.PI * 2;
      const r = k === b.arms ? 0 : b.len * 0.6;
      hzV.set(b.x + Math.cos(a) * r, b.y, b.z - Math.sin(a) * r).project(camera);
      if (hzV.z < 1 && Math.abs(hzV.x) < 0.45 && hzV.y > -0.5 && hzV.y < 0.75) return true;
    }
  }
  return false;
}

function warnBars(pos) {
  const TAU = Math.PI * 2;
  for (const b of G.world.bars) {
    if (!b.line) continue;
    const rx = pos.x - b.x;
    const rz = pos.z - b.z;
    if (b.stage !== G.cp || Math.hypot(rx, rz) > b.len + 1.5) {
      b.warned = false;
      continue;
    }
    const phi = Math.atan2(-rz, rx);
    let lead = Infinity;
    for (let k = 0; k < b.arms; k++) {
      const a = b.angle + (k / b.arms) * TAU;
      const d = ((((b.speed > 0 ? phi - a : a - phi) % TAU) + TAU) % TAU) / Math.abs(b.speed);
      lead = Math.min(lead, d);
    }
    if (lead < 0.7 && !b.warned) {
      b.warned = true;
      audio.creak();
    } else if (lead > 1.2) b.warned = false;
  }
}

function pushOff(b, a) {
  if (G.pushT > 0) return;
  const p = G.player;
  const sg = Math.sign(b.speed) || 1;
  const tx = -Math.sin(a) * sg;
  const tz = -Math.cos(a) * sg;
  let dir = null;
  for (const [cx, cz] of [[tx, tz], [-tx, -tz], [0, 1], [0, -1]]) {
    const gy = G.world.groundBelow(p.pos.x + cx * 1.8, p.pos.z + cz * 1.8, p.pos.y + 0.3, 0.2);
    if (gy > p.pos.y - 1.2) {
      dir = [cx, cz];
      break;
    }
  }
  G.pushT = 0.6;
  G.cause = { t: G.runTime, at: new THREE.Vector3(p.pos.x, p.pos.y + 0.6, p.pos.z) };
  b.flash = 1;
  p.hurt();
  for (let i = 0; i < 10; i++) {
    const a2 = Math.random() * Math.PI * 2;
    const ca = Math.cos(a2);
    const sa = Math.sin(a2);
    stars.emit(p.pos.x + ca * 0.8, p.pos.y + 0.9, p.pos.z + sa * 0.8, ca * 4, 1 + Math.random() * 2, sa * 4, { life: 0.6, size: 0.35, size1: 0.05, color: G.def.hurt, drag: 2.5 });
  }
  p.vel.x = dir ? dir[0] * 5 : 0;
  p.vel.z = dir ? dir[1] * 5 : 0;
  p.vel.y = Math.max(p.vel.y, 4);
  p.grounded = false;
  p.ground = null;
  audio.boing();
  rig.addShake(0.25);
  logEvent('push', { pos: v3(p.pos) });
}

function emitTrail(dt) {
  if (G.trailPreview) G.trailPreview.t -= dt;
  const pv = G.trailPreview && G.trailPreview.t > 0 ? G.trailPreview.id : null;
  const id = G.state === 'shop' ? G.preview || G.save.trail : pv || G.save.trail;
  const tr = TRAILS.find((t) => t.id === id);
  if (!tr || tr.id === 'none') return;
  const p = G.player;
  let x = p.pos.x;
  let y = p.pos.y + 0.7;
  let z = p.pos.z;
  const moving = Math.hypot(p.vel.x, p.vel.z) > 1 || !p.grounded;
  if (G.state === 'shop') {
    const a = G.time * 4;
    x += Math.cos(a) * 1.2;
    z += Math.sin(a) * 1.2;
    y = p.pos.y + 1 + Math.sin(G.time * 3) * 0.5;
  } else if (!moving || G.state !== 'play') return;
  G.trailT -= dt;
  while (G.trailT < 0) {
    G.trailT += 1 / 45;
    const pool = tr.id === 'stars' || tr.id === 'ice' ? stars : glow;
    const col = tr.colors[(Math.random() * tr.colors.length) | 0];
    pool.emit(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, tr.rise ? 1.5 + Math.random() : (Math.random() - 0.2) * 0.8, (Math.random() - 0.5) * 0.6, {
      life: tr.rise ? 0.55 : 0.8,
      size: 0.45,
      size1: 0.05,
      color: col,
      drag: 1,
      gravity: tr.id === 'ice' ? 0.8 : 0,
    });
  }
}

const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _fin = new THREE.Vector3();

function markArchesUnderLabel() {
  const r = G.ui.labelRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const a of G.world.arches || []) {
    a.label = false;
    if (!r || a.finish) continue;
    _pa.set(a.x - a.half, a.y + 0.75, a.z).project(camera);
    _pb.set(a.x + a.half, a.y - 0.75, a.z).project(camera);
    if (_pa.z > 1 || _pb.z > 1) continue;
    const x0 = ((Math.min(_pa.x, _pb.x) + 1) / 2) * w;
    const x1 = ((Math.max(_pa.x, _pb.x) + 1) / 2) * w;
    const y0 = ((1 - Math.max(_pa.y, _pb.y)) / 2) * h;
    const y1 = ((1 - Math.min(_pa.y, _pb.y)) / 2) * h;
    a.label = x0 < r.right && x1 > r.left && y0 < r.bottom + 10 && y1 > r.top - 10;
  }
}

function autoCamera(dt, look) {
  const moved = Math.abs(look.x) + Math.abs(look.y) > 0.5;
  G.lookIdle = moved ? 0 : G.lookIdle + dt;
  if (G.lookIdle < 1.8) return;
  const gc = G.player.ground;
  if (gc && gc.shape === 'cyl' && !gc.power) return;
  const pp = G.player.pos;
  const rh = G.world.rhythm;
  if (rh && rh.switches.some((sw) => !sw.pressed && Math.hypot(sw.s.x - pp.x, sw.s.z - pp.z) < 5 && Math.abs(sw.s.y - pp.y) < 2)) return;
  const cps = G.course.cps;
  const a = cps[G.cp];
  const b = cps[Math.min(G.cp + 1, cps.length - 1)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (Math.hypot(dx, dz) < 1) return;
  const want = Math.atan2(-dx, -dz);
  let d = want - rig.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  rig.yaw += d * (1 - Math.exp(-1.1 * dt));
}

function updateHint(dt) {
  if (!G.hintOn) return;
  const p = G.player;
  if (Math.hypot(p.vel.x, p.vel.z) > 1) G.walkT += dt;
  if (G.walkT > 3 && G.jumps >= 2) {
    G.hintOn = false;
    G.ui.hideHint();
    G.save.learned = true;
    G.persist();
    logEvent('learned');
  }
}

function fixedStep(inp) {
  G.world.waitFor(G.state === 'play' ? G.player : null, FIXED);
  G.world.step(FIXED);
  if (G.state === 'play') {
    G.player.step(FIXED, inp, G.world, rig.yaw);
    handlePlayerEvents();
    if (G.state === 'play') checkRules();
  }
}

function stateStep(dt) {
  const p = G.player;
  if (G.state === 'play') {
    G.runTime += dt;
    updateHint(dt);
    if (G.portal) stepPortal(dt);
    if (G.invuln > 0) {
      G.invuln -= dt;
      p.setRim(0xffffff, 0.7 + Math.sin(G.invuln * 12) * 0.4);
      if (G.invuln <= 0) p.setRim(rimColor(), rimStrength());
    }
    const lifting = !!(G.world.wind && G.world.wind.ride) || p.liftFlight;
    if (lifting !== !!G.liftRim && !(G.invuln > 0)) {
      G.liftRim = lifting;
      p.setRim(rimColor(), rimStrength() * (lifting ? 0.3 : 1));
    }
  }
  if (G.state === 'dead') {
    G.deathT += dt;
    const hazard = G.deathReason !== 'fall';
    if (!hazard && p.root.visible) {
      p.vel.y = Math.max(-9, p.vel.y - PHYS.gravity * PHYS.fallMul * dt);
      p.pos.addScaledVector(p.vel, dt);
      p.vel.x *= Math.exp(-3 * dt);
      p.vel.z *= Math.exp(-3 * dt);
      if (G.deathT > 0.36 && !G.splashed) {
        G.splashed = true;
        splash(p.pos);
      }
    }
    const t1 = hazard ? 0.38 : G.deathHold;
    if (G.deathT > t1 && !G.fading) {
      G.fading = true;
      document.getElementById('fade').classList.add('on');
      if (hazard) poof(p.pos);
      p.root.visible = false;
    }
    if (G.deathT > t1 + (hazard ? 0.12 : 0.2)) {
      G.fading = false;
      document.getElementById('fade').classList.remove('on');
      respawn();
    }
  }
  if (G.state === 'finish') {
    G.finishT += dt;
    if (G.finishT > 0.8 && G.finishT - dt <= 0.8) confetti.burst(p.pos.x - 2, p.pos.y + 3, p.pos.z, 100, 9, 1, FINISH_CONFETTI);
    if (G.finishT > 1.6 && G.finishT - dt <= 1.6) confetti.burst(p.pos.x + 2, p.pos.y + 3, p.pos.z, 100, 9, 1, FINISH_CONFETTI);
    if (G.finishT > 2.8 && G.finishT - dt <= 2.8) {
      G.state = 'results';
      p.animOverride = 'ThumbsUp';
      showScreen('results');
      G.ui.results(G.result);
    }
  }
}

let last = performance.now();
let acc = 0;
let fpsAcc = 0;
let fpsN = 0;
const frameTimes = [];

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 0.5) {
    G.fps = Math.round(fpsN / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
  }
  const rawDt = dt;
  dt = Math.min(dt, 0.1);
  if (!G.world || !G.player) return;
  G.time += dt;
  const p = G.player;
  if (G.state !== 'paused') {
    acc += dt;
    let n = 0;
    while (acc >= FIXED && n < 14) {
      fixedStep(input);
      acc -= FIXED;
      n++;
    }
    if (n >= 14) acc = 0;
  }
  stateStep(dt);
  const look = input.takeLook();
  G.world.setWindow(['menu', 'shop', 'loading'].includes(G.state) ? 0 : G.state === 'finish' ? 'all' : G.state === 'results' ? 'end' : G.cp);
  if (G.state === 'play' || G.state === 'dead') {
    const W = G.world;
    const finRide = G.cp === G.course.cps.length - 2 && (p.liftFlight || !!(W.wind && W.wind.ride) || !!(W.train && W.train.carts.some((c) => c.mode === 'go')));
    rig.extraDist = Math.max((G.course.meta[G.cp] || {}).camBack || 0, finRide ? 3 : 0);
    rig.applyLook(look, input.touchMode);
    autoCamera(dt, look);
    rig.follow(dt, p, G.world);
  } else if (G.state === 'finish' || G.state === 'results') {
    rig.orbitT = Math.PI + Math.sin(G.finishT * 0.35) * 0.75;
    rig.orbit(dt, _fin.set(p.pos.x, p.pos.y + 1.4, p.pos.z), 9, 2.6, 0, 0);
    p.faceTarget = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
  } else if (G.state === 'menu' || G.state === 'shop' || G.state === 'loading') {
    const wide = window.innerWidth > 820;
    if (G.state === 'shop') rig.orbit(dt, p.pos, 5.2, 1.7, 0.18, wide ? -2.1 : 0);
    else rig.orbit(dt, p.pos, 7, 2.3, 0.14, wide ? 2.6 : 0);
    p.face = p.faceTarget = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
  }
  if (G.state !== 'paused') {
    p.update(dt, G.world, G.time);
    G.world.setView(G.state === 'play' || G.state === 'dead' ? camera.position : null, p.pos);
    G.world.animate(dt);
    emitTrail(dt);
    glow.update(dt);
    stars.update(dt);
    dust.update(dt);
    confetti.update(dt);
  }
  const focus = G.state === 'play' || G.state === 'dead' ? rig.target : p.pos;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 70);
  if (G.state === 'play' || G.state === 'dead') {
    updateHud();
    const cps = G.course.cps;
    const a = cps[G.cp];
    const b = cps[Math.min(G.cp + 1, cps.length - 1)];
    const span = a.z - b.z || 1;
    const t = Math.max(0, Math.min(1, (a.z - p.pos.z) / span));
    G.ui.tower((G.cp + t) / (cps.length - 1), G.cp);
    G.ui.starNear(G.world.bigStars.some((b) => !b.taken && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < 22));
    markArchesUnderLabel();
  }
  if (G.renderedLast) G.renderCost = rawDt;
  const slowUi = G.state !== 'play' && G.state !== 'dead' && G.renderCost > 0.4;
  G.renderedLast = !slowUi || now - (G.lastRenderAt || 0) > 2000;
  if (G.renderedLast) {
    renderer.info.reset();
    G.shadowCalls = null;
    composer.render();
    G.lastRenderAt = now;
    const calls = renderer.info.render.calls;
    G.frameInfo = { calls, triangles: renderer.info.render.triangles, shadow: G.shadowCalls, main: G.mainEnd - G.mainStart - (G.shadowCalls || 0), post: calls - G.mainEnd };
  }
  adaptQuality(rawDt);
}

function adaptQuality(rawDt) {
  if (params.hq || G.tier >= 3) return;
  if (G.state !== 'play' && G.state !== 'menu') {
    frameTimes.length = 0;
    return;
  }
  G.warm += rawDt;
  if (G.warm < 1) return;
  if (rawDt > 0.25) return;
  frameTimes.push(rawDt * 1000);
  if (frameTimes.length < 30 || frameTimes.reduce((a, b) => a + b, 0) < 2000) return;
  const sorted = frameTimes.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  frameTimes.length = 0;
  G.medianFrame = Math.round(med * 10) / 10;
  if (med > 25) {
    setTier(G.tier + 1);
    G.warm = 0.5;
  }
}

function setTier(t) {
  G.tier = t;
  logEvent('quality', { tier: t, medianFrameMs: G.medianFrame });
  if (t >= 1) {
    pixelRatio = Math.min(DPR, 1.25);
    if (sun.shadow.mapSize.x !== 1024) {
      sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }
  buildPost();
  if (t >= 3) {
    pixelRatio = Math.min(DPR, 1);
    lightShadows();
  }
  resize();
}

function lightShadows() {
  if (G.tier < 3 || !G.world) return;
  G.world.group.traverse((o) => {
    o.castShadow = false;
  });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  rig.baseFov = w / h < 1 ? 72 : 62;
  camera.updateProjectionMatrix();
  const hh = h * pixelRatio;
  for (const pool of [glow, stars, dust]) pool.setScale(hh);
}
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    togglePause(true);
    if (audio.ctx) audio.ctx.suspend();
  } else if (audio.ctx) audio.unlock();
});
window.addEventListener('blur', () => togglePause(true));
window.addEventListener('pagehide', () => {
  storeProgress();
  G.persist();
});

function r2(v) {
  return Math.round(v * 100) / 100;
}
function v3(v) {
  return { x: r2(v.x), y: r2(v.y), z: r2(v.z) };
}

Object.defineProperty(window, '__game', {
  get() {
    const p = G.player;
    const cps = G.course ? G.course.cps : [];
    return Object.freeze({
      state: G.state,
      world: G.worldId,
      player: p ? { pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, state: p.dead ? 'dead' : !p.grounded ? 'air' : Math.hypot(p.vel.x, p.vel.z) > 0.5 ? 'run' : 'idle', visible: p.root.visible } : null,
      camera: { pos: v3(camera.position), target: v3(rig.target), fov: r2(camera.fov), yaw: r2(rig.yaw) },
      checkpoint: G.cp,
      stage: G.cp + 1,
      stages: cps.length - 1,
      progress: cps.length > 1 ? r2(G.cp / (cps.length - 1)) : 0,
      coins: G.coinsRun,
      coinsTotal: G.course ? G.course.coins.length : 0,
      wallet: G.save.coins,
      bigStars: G.bigRun.length,
      bigStarsTotal: G.course ? G.course.bigStars.length : 0,
      deaths: G.deaths,
      time: r2(G.runTime),
      fps: G.fps,
      tier: G.tier,
      medianFrameMs: G.medianFrame || null,
      events: G.events.slice(),
    });
  },
});

Object.defineProperty(window, '__obby', {
  get() {
    const w = G.world;
    const f = G.frameInfo || { calls: 0, triangles: 0, shadow: null };
    return Object.freeze({
      world: G.worldId,
      checkpoint: G.cp,
      stats: {
        calls: f.calls,
        triangles: f.triangles,
        shadowCalls: f.shadow,
        mainCalls: f.main,
        postCalls: f.post,
        window: w ? (typeof w.window === 'string' ? w.window : [w.window - 1, w.window + 4]) : null,
        stagesVisible: w ? w.stageGroups.filter((g) => g && g.visible).length : 0,
        stages: w ? w.stageGroups.length : 0,
        fps: G.fps,
        tier: G.tier,
      },
    });
  },
});

Object.defineProperty(window, '__debug', {
  get() {
    const p = G.player;
    if (!p) return { state: G.state };
    return {
      state: G.state,
      world: G.worldId,
      pos: v3(p.pos),
      vel: v3(p.vel),
      grounded: p.grounded,
      stage: G.cp + 1,
      stages: G.course ? G.course.cps.length - 1 : 0,
      cp: G.cp,
      coins: G.coinsRun,
      coinsTotal: G.course ? G.course.coins.length : 0,
      wallet: G.save.coins,
      deaths: G.deaths,
      time: r2(G.runTime),
      fps: G.fps,
      tier: G.tier,
      anim: p.cur,
    };
  },
});

if (hasDebug) {
  window.__dev = {
    G,
    renderer,
    bloom,
    composer,
    post: { aa, toneMap, grade, EffectPass, camera },
    scene,
    rig,
    teleport(x, y, z) {
      G.player.spawn(x, y, z, Math.PI);
      G.world.dockFor(G.player);
      rig.snap(G.player.pos, rig.yaw);
    },
    gotoCp(i, dz = 2.5) {
      const c = G.course.cps[i];
      this.teleport(c.x, c.y + 0.3, c.z + dz);
    },
    setTier,
    sim(sec, bot) {
      const still = { x: 0, y: 0 };
      const n = Math.round(sec / FIXED);
      let i = 0;
      for (; i < n; i++) {
        const inp = bot(G, rig);
        if (!inp) break;
        fixedStep(inp);
        stateStep(FIXED);
        if (G.state === 'play' || G.state === 'dead') autoCamera(FIXED, still);
        if (G.state === 'finish' || G.state === 'results') break;
      }
      return i * FIXED;
    },
  };
}

function makeThumbs() {
  const out = {};
  try {
    const cv = document.createElement('canvas');
    cv.width = 144;
    cv.height = 144;
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a96b8, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 4, 5);
    sc.add(key);
    const pl = new Player(sc);
    pl.blob.visible = false;
    pl.grounded = true;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(1.0, 1.85, 3.3);
    cam.lookAt(0, 1.2, 0);
    for (const s of SKINS) {
      pl.face = pl.faceTarget = s.acc === 'jet' ? 2.4 : 0.45;
      pl.setSkin(s);
      pl.update(0.5, null, 0.4);
      r.render(sc, cam);
      out[s.id] = cv.toDataURL('image/png');
    }
    r.dispose();
    r.forceContextLoss();
  } catch (e) {
    return out;
  }
  return out;
}

async function boot() {
  buildPost();
  G.ui = new UI(G);
  G.ui.setMuteIcon(G.save.muted);
  audio.setMuted(G.save.muted);
  input.on('gesture', () => audio.unlock());
  input.on('pause', () => {
    if (G.state === 'paused') togglePause(false);
    else togglePause(true);
  });
  input.on('mute', () => G.action('mute'));
  input.on('emote', (n) => {
    if (G.state === 'play') G.player.playEmote(n);
  });
  input.on('touchmode', () => {
    if (G.state === 'play') G.ui.show('touch', true);
  });
  input.on('key', (code) => logEvent('input', { key: code }));
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) input.setTouchMode(true);
  if (params.mobile) input.setTouchMode(true);
  resize();
  G.ui.setLoad(1);
  if (params.tier) setTier(params.tier);
  await Promise.all([loadRobot(), loadKit(), loadAOList()]);
  G.player = new Player(scene);
  G.thumbs = makeThumbs();
  applySkin();
  G.menuWorld = G.isUnlocked(G.save.selected) ? G.save.selected : WORLDS[0].id;
  if (params.world && worldDef(params.world) && G.isUnlocked(params.world)) G.menuWorld = params.world;
  if (params.coins) G.save.coins = params.coins;
  if (params.stars) G.save.stars = Object.fromEntries(WORLDS.map((w, i) => [w.id, Math.min(3, Math.max(0, params.stars - i * 3))]));
  loadWorld(G.menuWorld);
  await G.compiled;
  G.toMenu();
  logEvent('ready');
  requestAnimationFrame(frame);
  if (params.shop) {
    G.openShop();
    if (params.tab) document.querySelector(`.tab[data-tab="${params.tab}"]`).click();
  } else if (params.world && !params.menu && G.menuWorld === params.world) {
    G.play(G.menuWorld, Math.max(0, (params.cp || 0) - 1), true, !!params.bonus);
    if (params.finish) {
      const cps = G.course.cps;
      G.cp = cps.length - 2;
      const c = cps[cps.length - 1];
      G.player.spawn(c.x, c.y + 0.2, c.z + 1, Math.PI);
      G.world.dockFor(G.player);
      G.coinsRun = Math.round(G.course.coins.length * 0.7);
      G.runTime = 142;
    }
  }
}

boot().catch((e) => {
  console.error(e);
  document.querySelector('.load-text').textContent = 'Bir sorun oldu. Sayfayı yenile.';
});
