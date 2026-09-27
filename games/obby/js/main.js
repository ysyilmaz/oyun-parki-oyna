import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WORLDS } from './themes.js';
import { buildCourse, PHYS } from './levels.js';
import { World } from './world.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { PointPool, Confetti } from './particles.js';
import { UI } from './ui.js';
import { loadSave, writeSave, SKINS, TRAILS } from './save.js';
import { setMaxAnisotropy } from './textures.js';

const FIXED = 1 / 120;
const FINISH_CONFETTI = [0xffc21a, 0xffd84a, 0x22d8ff, 0xff2fc8, 0xffffff];
const params = parseDebug();
const hasDebug = Object.keys(params).length > 0;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = window.devicePixelRatio || 1;
let pixelRatio = Math.min(DPR, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.debug.checkShaderErrors = false;
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
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

const rt = new THREE.WebGLRenderTarget(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio, { type: THREE.HalfFloatType, samples: 0 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pixelRatio);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.5, 0.5, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

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
};

function logEvent(type, data) {
  G.events.push({ t: Math.round(performance.now()), type, ...(data || {}) });
  if (G.events.length > 600) G.events.splice(0, G.events.length - 600);
}

for (const n of ['jump', 'land', 'coin', 'checkpoint', 'pad', 'boing', 'crack', 'death', 'splash', 'respawn', 'click', 'buy', 'nope', 'win', 'whoosh']) {
  const f = audio[n].bind(audio);
  audio[n] = (...a) => {
    logEvent('sound', { name: n });
    return f(...a);
  };
}

function parseDebug() {
  const out = {};
  const q = decodeURIComponent(location.search.slice(1));
  if (!/(^|&)debug=/.test(q)) return out;
  const raw = q.replace(/^.*?debug=/, '');
  for (const tok of raw.split(/[&,]/)) {
    const [k, v] = tok.split(':');
    if (k) out[k] = v === undefined ? true : isNaN(+v) ? v : +v;
  }
  return out;
}

G.isUnlocked = (id) => id === 1 || !!G.save.finished[id - 1] || !!params.unlock;

G.persist = () => {
  writeSave(G.save);
};

function persistSoon() {
  clearTimeout(G.saveTimer);
  G.saveTimer = setTimeout(G.persist, 700);
}

function storeProgress() {
  if (!G.world || !['play', 'dead', 'paused'].includes(G.state)) return;
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
  return G.worldId === 2 ? 0x8fd8ff : 0xbfe4ff;
}

function applyTheme(def) {
  scene.fog = new THREE.Fog(def.fog.color, def.fog.near, def.fog.far);
  hemi.color.set(def.hemi.sky);
  hemi.groundColor.set(def.hemi.ground);
  hemi.intensity = def.hemi.intensity;
  sun.color.set(def.light.color);
  sun.intensity = def.light.intensity;
  sunDir.set(...def.sky.sunDir).normalize();
  if (def.id === 2) sunDir.set(-0.45, 0.62, -0.3).normalize();
  renderer.toneMappingExposure = def.exposure;
  bloom.strength = def.bloom.strength;
  bloom.radius = def.bloom.radius;
  bloom.threshold = def.bloom.threshold;
  scene.environmentIntensity = def.ambient;
  document.body.style.background = def.menuBg;
  audio.startMusic(def.music);
  if (G.player) G.player.setRim(rimColor(), 0.9);
}

function loadWorld(id) {
  if (G.world && G.worldId === id) return;
  if (G.world) G.world.dispose();
  const def = WORLDS[id - 1];
  G.def = def;
  G.worldId = id;
  G.course = buildCourse(id);
  G.world = new World(scene, def, G.course);
  G.world.camera = camera;
  G.cpCols = G.course.cps.map((c) => G.world.colliders.find((k) => k.shape === 'box' && Math.abs(k.x - c.x) < 0.01 && Math.abs(k.z - c.z) < 0.01 && Math.abs(k.y + k.hy - c.y) < 0.01) || null);
  G.world.events = (type) => {
    if (type === 'crack') audio.crack();
  };
  applyTheme(def);
  lightShadows();
  G.ui.buildTower(G.course.cps.length - 1);
}

G.selectWorld = (id) => {
  G.menuWorld = id;
  G.save.selected = id;
  G.persist();
  loadWorld(id);
  placeShowcase();
  G.ui.buildWorldCards();
};

function placeShowcase() {
  const p = G.player;
  p.spawn(0, 0, 1.2, 0);
  p.animOverride = 'Dance';
  p.frozen = true;
}

function showScreen(name) {
  for (const s of ['menu', 'pause', 'results', 'shop', 'loading']) G.ui.show(s, s === name);
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
  confetti.clear();
  G.ui.skip(false);
  if (!G.isUnlocked(G.menuWorld)) G.menuWorld = 1;
  loadWorld(G.menuWorld);
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
  G.bigRun = [];
  G.deaths = 0;
  G.runTime = 0;
  G.fails = 0;
  G.invuln = 0;
}

G.play = (id, cpIndex = null, fresh = false) => {
  if (!G.isUnlocked(id)) id = 1;
  G.menuWorld = id;
  loadWorld(id);
  resetRun();
  const pr = G.save.progress;
  if (cpIndex === null) {
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
  if (fresh || (pr && pr.w !== id)) G.save.progress = null;
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
  p.spawn(c.x, c.y, c.z + (cpIndex === 0 ? 2 : 0), Math.PI);
  rig.pitch = 0.36;
  rig.dist = rig.distTarget;
  rig.snap(p.pos, 0);
  input.reset();
  G.state = 'play';
  showScreen('none');
  G.ui.skip(false);
  G.ui.banner(cpIndex === 0 ? G.def.name : 'Bölüm ' + (cpIndex + 1));
  G.hintOn = id === 1 && !G.save.learned && !input.touchMode;
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
  else if (a === 'restart') G.play(G.worldId, 0, true);
  else if (a === 'menu') G.toMenu();
  else if (a === 'next') G.play(Math.min(3, G.worldId + 1));
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
  if (G.state !== 'play') return;
  const next = G.cp + 1;
  if (next >= G.course.cps.length - 1) return;
  audio.click();
  logEvent('skip', { checkpoint: next });
  reachCheckpoint(next, true);
  const c = G.course.cps[next];
  G.player.spawn(c.x, c.y, c.z, Math.PI);
  rig.snap(G.player.pos, rig.yaw);
  G.ui.skip(false);
};

function updateHud() {
  G.ui.hud({
    coins: G.coinsRun,
    coinsMax: G.course.coins.length,
    time: G.runTime,
    par: G.def.par,
    stage: Math.min(G.cp + 1, G.course.cps.length - 1),
    stageMax: G.course.cps.length - 1,
    big: G.bigRun.length,
    bigMax: G.course.bigStars.length,
  });
}

function emitDust(x, y, z, n, spread, color, size = 0.9, up = 1.2) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const s = spread * (0.6 + Math.random() * 0.6);
    dust.emit(x + Math.cos(a) * 0.3, y + 0.1, z + Math.sin(a) * 0.3, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, { life: 0.5 + Math.random() * 0.3, size, size1: size * 2.2, color, drag: 4, gravity: -0.5 });
  }
}

function dustColor() {
  return G.worldId === 2 ? 0x8a7a80 : G.worldId === 3 ? 0xcfe8ff : 0xf4f0e6;
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
    } else if (e.type === 'ledge') logEvent('ledge');
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
    rig.frozenY = p.groundY + 1.4;
    rig.watch = p.pos;
    G.splashed = false;
    p.animOverride = 'Death';
    G.ui.fell();
  } else {
    audio.death();
    p.dead = true;
    const col = G.worldId === 2 ? 0xff7a1a : G.worldId === 3 ? 0xff4fd8 : 0xff4d5e;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      glow.emit(p.pos.x, p.pos.y + 0.9, p.pos.z, Math.cos(a) * 5, Math.random() * 5, Math.sin(a) * 5, { life: 0.6, size: 0.6, size1: 0.05, color: col, drag: 3 });
    }
  }
  updateHud();
}

function respawn() {
  const c = G.course.cps[G.cp];
  const p = G.player;
  p.animOverride = null;
  p.spawn(c.x, c.y, c.z, Math.PI);
  rig.frozenY = null;
  rig.snap(p.pos, rig.yaw);
  G.invuln = 1;
  G.state = 'play';
  input.jumpQueued = false;
  audio.respawn();
  logEvent('respawn', { checkpoint: G.cp });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    stars.emit(c.x + Math.cos(a) * 1.1, c.y + 0.2, c.z + Math.sin(a) * 1.1, Math.cos(a) * 0.4, 3 + Math.random() * 2, Math.sin(a) * 0.4, { life: 0.9, size: 0.5, size1: 0.1, color: 0x9ff4ff, drag: 1.5 });
  }
  if (G.fails >= 3 && G.world.assistStage !== G.cp) {
    G.world.setAssist(G.cp);
    logEvent('assist', { stage: G.cp + 1, fails: G.fails });
  }
  G.ui.skip(G.fails >= 5 && G.cp + 1 < G.course.cps.length - 1);
}

function splash(pos) {
  const col = G.worldId === 2 ? 0xff7a1a : G.worldId === 3 ? 0x9fe8ff : 0x7fd4ff;
  emitDust(pos.x, pos.y + 0.6, pos.z, 22, 4.2, 0xffffff, 1.3, 3);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 3;
    glow.emit(pos.x, pos.y + 0.8, pos.z, Math.cos(a) * r, 5 + Math.random() * 5, Math.sin(a) * r, { life: 0.7, size: 0.55, size1: 0.1, color: i % 3 ? col : 0xffffff, drag: 1.5, gravity: 14 });
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
  const col = G.worldId === 3 ? 0x35e0ff : 0x3ddc5a;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    stars.emit(c.x + Math.cos(a) * 1.9, c.y + 0.2, c.z + Math.sin(a) * 1.9, Math.cos(a) * 1.5, 4 + Math.random() * 4, Math.sin(a) * 1.5, { life: 1, size: 0.6, size1: 0.1, color: k % 2 ? col : 0xffffff, drag: 1.2 });
  }
  G.ui.flyStage(i + 1);
  const words = ['Süper!', 'Harika!', 'Bravo!', 'Aferin!', 'Müthiş!'];
  if (c.chest) openChest(i);
  else G.ui.toast(words[i % words.length]);
  storeProgress();
  G.persist();
  updateHud();
}

function openChest(i) {
  const ch = G.world.openChest(i, false);
  G.save.coins += 15;
  audio.setLayer(1);
  audio.buy();
  G.ui.toast('Hazine +15');
  G.ui.coinPop();
  logEvent('reward', { kind: 'chest', value: 15, checkpoint: i });
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2;
    stars.emit(ch.x, ch.y + 1, ch.z, Math.cos(a) * 2.5, 5 + Math.random() * 5, Math.sin(a) * 2.5, { life: 1, size: 0.7, size1: 0.1, color: k % 3 ? 0xffd22e : 0xffffff, drag: 1.5, gravity: 6 });
  }
  glow.emit(ch.x, ch.y + 1, ch.z, 0, 1, 0, { life: 0.6, size: 5, size1: 0.5, color: 0xffc21a });
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
  const total = G.course.coins.length;
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
  const unlocked = !s.finished[id] && id < 3;
  s.finished[id] = true;
  s.progress = null;
  G.persist();
  logEvent('finish', { world: id, time: Math.round(G.runTime * 10) / 10, stars: st, deaths: G.deaths });
  if (unlocked) logEvent('unlock', { world: id + 1 });
  G.result = { time: G.runTime, coins: G.coinsRun, coinsMax: total, deaths: G.deaths, stars: st, got, par, record: record && !!prevBest, best: s.best[id], next: id < 3, big: G.bigRun.length, bigMax };
  rig.orbitT = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
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
  G.pushT -= FIXED;
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
    glow.emit(c.x, c.y, c.z, 0, 0.5, 0, { life: 0.35, size: 2.4, size1: 0.2, color: 0xffc21a });
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
    if (onTop || (p.grounded && Math.abs(dx) < r && Math.abs(dz) < r && Math.abs(pos.y - c.y) < 0.3)) reachCheckpoint(next);
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
  const id = G.state === 'shop' ? G.preview || G.save.trail : G.save.trail;
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

function autoCamera(dt, look) {
  const moved = Math.abs(look.x) + Math.abs(look.y) > 0.5;
  G.lookIdle = moved ? 0 : G.lookIdle + dt;
  if (G.lookIdle < 1.8) return;
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
      G.world.step(FIXED);
      if (G.state === 'play') {
        p.step(FIXED, input, G.world, rig.yaw);
        handlePlayerEvents();
        if (G.state === 'play') checkRules();
      }
      acc -= FIXED;
      n++;
    }
    if (n >= 14) acc = 0;
  }
  if (G.state === 'play') {
    G.runTime += dt;
    updateHint(dt);
    if (G.invuln > 0) {
      G.invuln -= dt;
      p.setRim(0xffffff, 0.7 + Math.sin(G.invuln * 12) * 0.4);
      if (G.invuln <= 0) p.setRim(rimColor(), 0.9);
    }
  }
  if (G.state === 'dead') {
    G.deathT += dt;
    const hazard = G.deathReason !== 'fall';
    if (!hazard && p.root.visible) {
      p.vel.y = Math.max(G.splashed ? -32 : -9, p.vel.y - PHYS.gravity * PHYS.fallMul * dt);
      p.pos.addScaledVector(p.vel, dt);
      p.vel.x *= Math.exp(-3 * dt);
      p.vel.z *= Math.exp(-3 * dt);
      if (G.deathT > 0.36 && !G.splashed) {
        G.splashed = true;
        splash(p.pos);
      }
      if (G.deathT > 0.44) p.root.visible = false;
    }
    const t1 = hazard ? 0.2 : 0.66;
    if (G.deathT > t1 && !G.fading) {
      G.fading = true;
      document.getElementById('fade').classList.add('on');
      if (hazard) {
        poof(p.pos);
        p.root.visible = false;
      }
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
  const look = input.takeLook();
  if (G.state === 'play' || G.state === 'dead') {
    rig.applyLook(look, input.touchMode);
    autoCamera(dt, look);
    rig.follow(dt, p, G.world);
  } else if (G.state === 'finish' || G.state === 'results') {
    rig.orbitT = Math.PI + Math.sin(G.finishT * 0.35) * 0.75;
    rig.orbit(dt, p.pos, 7.5, 2.6, 0, 0);
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
    G.ui.dimCenter((G.world.arches || []).some((a) => Math.hypot(a.x - p.pos.x, a.z - p.pos.z) < 12));
  }
  if (G.renderedLast) G.renderCost = rawDt;
  const slowUi = G.state !== 'play' && G.state !== 'dead' && G.renderCost > 0.4;
  G.renderedLast = !slowUi || now - (G.lastRenderAt || 0) > 2000;
  if (G.renderedLast) {
    composer.render();
    G.lastRenderAt = now;
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
    for (const r of [composer.renderTarget1, composer.renderTarget2]) {
      r.samples = 0;
      r.dispose();
    }
    if (sun.shadow.mapSize.x !== 1024) {
      sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.map) {
        sun.shadow.map.dispose();
        sun.shadow.map = null;
      }
    }
  }
  bloom.enabled = t < 2;
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
  composer.setPixelRatio(pixelRatio);
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
    scene,
    rig,
    teleport(x, y, z) {
      G.player.spawn(x, y, z, Math.PI);
      rig.snap(G.player.pos, rig.yaw);
    },
    gotoCp(i, dz = 2.5) {
      const c = G.course.cps[i];
      this.teleport(c.x, c.y + 0.3, c.z + dz);
    },
    setTier,
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
  G.player = new Player(scene);
  G.thumbs = makeThumbs();
  applySkin();
  G.menuWorld = G.isUnlocked(G.save.selected) ? G.save.selected : 1;
  if (params.world) G.menuWorld = Math.max(1, Math.min(3, params.world));
  if (params.coins) G.save.coins = params.coins;
  loadWorld(G.menuWorld);
  G.toMenu();
  logEvent('ready');
  requestAnimationFrame(frame);
  if (params.shop) {
    G.openShop();
    if (params.tab) document.querySelector(`.tab[data-tab="${params.tab}"]`).click();
  } else if (params.world && !params.menu) {
    G.play(G.menuWorld, params.cp || 0, true);
    if (params.finish) {
      const cps = G.course.cps;
      G.cp = cps.length - 2;
      const c = cps[cps.length - 1];
      G.player.spawn(c.x, c.y + 0.2, c.z + 1, Math.PI);
      G.coinsRun = Math.round(G.course.coins.length * 0.7);
      G.runTime = 142;
    }
  }
}

boot().catch((e) => {
  console.error(e);
  document.querySelector('.load-text').textContent = 'Bir sorun oldu. Sayfayı yenile.';
});
