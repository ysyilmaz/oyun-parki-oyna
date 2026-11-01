import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Player } from './engine/player.js';
import { CameraRig } from './engine/camera.js';
import { Input } from './engine/input.js';
import { Sound } from './engine/audio.js';
import { PointPool, Confetti } from './engine/particles.js';
import { setMaxAnisotropy } from './engine/textures.js';
import { setPetThumbRenderer } from './engine/pets/petModels.js';
import { Progress, CATALOG } from './progress.js';
import { GAMES, gameById } from './registry.js';
import { Hub, HUB_DEF, SPAWN } from './hub.js';
import { Costume } from './costume.js';
import { PetFollower } from './pet.js';
import { UI } from './ui.js';

const FIXED = 1 / 120;
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
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.6;
setPetThumbRenderer(renderer, envTex);

const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -30;
sc.right = 30;
sc.top = 30;
sc.bottom = -30;
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
const progress = new Progress();

const G = {
  state: 'loading',
  progress,
  audio,
  ui: null,
  hub: null,
  player: null,
  costume: null,
  pet: null,
  game: null,
  gameDef: null,
  stageIdx: 0,
  result: null,
  prevState: null,
  time: 0,
  fps: 0,
  tier: 0,
  warm: 0,
  events: [],
  near: null,
  portalArmed: true,
  fallT: 0,
  walkT: 0,
  jumps: 0,
  hintOn: false,
  preview: {},
  lookIdle: 0,
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
  if (G.player) G.player.setRim(def.id === 2 ? 0x8fd8ff : 0xbfe4ff, 0.9);
}

function emitDust(x, y, z, n, spread, color, size = 0.9, up = 1.2) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const s = spread * (0.6 + Math.random() * 0.6);
    dust.emit(x + Math.cos(a) * 0.3, y + 0.1, z + Math.sin(a) * 0.3, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, { life: 0.5 + Math.random() * 0.3, size, size1: size * 2.2, color, drag: 4, gravity: -0.5 });
  }
}

const fx = {
  glow,
  stars,
  dust,
  confetti,
  emitDust,
  coinBurst(x, y, z) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 0.5;
      stars.emit(x, y, z, Math.cos(a) * 3, e * 3, Math.sin(a) * 3, { life: 0.5, size: 0.55, size1: 0.05, color: i % 3 ? 0xffd22e : 0xffffff, drag: 3 });
    }
    glow.emit(x, y, z, 0, 0.5, 0, { life: 0.35, size: 2.4, size1: 0.2, color: 0xffc21a });
  },
  ringBurst(x, y, z, color) {
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      stars.emit(x + Math.cos(a) * 1.6, y + 0.2, z + Math.sin(a) * 1.6, Math.cos(a) * 1.5, 4 + Math.random() * 3, Math.sin(a) * 1.5, { life: 1, size: 0.6, size1: 0.1, color: k % 2 ? color : 0xffffff, drag: 1.2 });
    }
  },
  deathBurst(x, y, z, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      glow.emit(x, y, z, Math.cos(a) * 5, Math.random() * 5, Math.sin(a) * 5, { life: 0.6, size: 0.6, size1: 0.05, color, drag: 3 });
    }
  },
  lavaSplash(x, y, z) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      glow.emit(x, y + 0.1, z, Math.cos(a) * 3, 5 + Math.random() * 6, Math.sin(a) * 3, { life: 0.8, size: 0.7, size1: 0.1, color: i % 2 ? 0xff6a1a : 0xffd84a, drag: 1.5, gravity: 12 });
    }
    emitDust(x, y, z, 10, 3, 0x3a2a2a, 1.4, 2.5);
  },
  ember(x, y, z) {
    glow.emit(x, y + 0.2, z, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 2, (Math.random() - 0.5) * 0.6, { life: 1.4, size: 0.35, size1: 0.02, color: 0xff8a2a, drag: 0.5 });
  },
};

function playerEvents(dustColor) {
  const p = G.player;
  let kill = false;
  for (const e of p.events) {
    const x = p.pos.x;
    const y = p.pos.y;
    const z = p.pos.z;
    if (e.type === 'jump') {
      audio.jump();
      emitDust(x, y, z, 8, 2.2, dustColor, 0.6);
      G.jumps++;
    } else if (e.type === 'land') {
      audio.land(0.5 + e.data);
      emitDust(x, y, z, 12, 3 + e.data * 3, dustColor, 0.7);
    } else if (e.type === 'step') {
      emitDust(x, y, z, 2, 0.8, dustColor, 0.4, 0.6);
    } else if (e.type === 'pad') {
      audio.pad();
      rig.kick(16);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        glow.emit(x + Math.cos(a) * 0.9, y + 0.2, z + Math.sin(a) * 0.9, Math.cos(a) * 1.2, 6 + Math.random() * 6, Math.sin(a) * 1.2, { life: 0.8, size: 0.5, size1: 0.1, color: 0xffd22e, drag: 2 });
      }
    } else if (e.type === 'tramp') {
      audio.boing();
      rig.kick(7);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        stars.emit(x, y + 0.2, z, Math.cos(a) * 4, 2 + Math.random() * 3, Math.sin(a) * 4, { life: 0.6, size: 0.55, size1: 0.1, color: 0xff8ad8, drag: 3 });
      }
    } else if (e.type === 'kill') kill = true;
  }
  p.events.length = 0;
  return kill;
}

function fade(on) {
  document.getElementById('fade').classList.toggle('on', on);
}

const ctx = { scene, camera, rig, input, audio, progress, fx, applyTheme, playerEvents, fade, log: logEvent, get lookIdle() { return G.lookIdle; }, get ui() { return G.ui; }, get player() { return G.player; }, finish: (r) => finishGame(r) };

function currentWorld() {
  return G.game ? G.game.world : G.hub.world;
}

function showScreen(name) {
  for (const s of ['pause', 'results', 'shop', 'loading', 'stages', 'unlock']) G.ui.show(s, s === name);
  const inWorld = ['hub', 'game', 'paused', 'stages', 'unlock'].includes(G.state);
  G.ui.show('hud', inWorld);
  G.ui.show('gameHud', !!G.game && G.state !== 'results');
  G.ui.show('touch', input.touchMode && (G.state === 'hub' || G.state === 'game'));
}

G.applyLook = () => {
  const p = G.player;
  p.setSkin(progress.equipped('color'));
  G.costume.setHat(progress.equipped('hat').id);
  G.costume.setCape(progress.equipped('cape'));
  G.pet.set(progress.equipped('pet').id, p);
};

G.previewItem = (tab, id) => {
  const p = G.player;
  if (id === null) {
    G.applyLook();
    return;
  }
  const item = CATALOG[tab] && CATALOG[tab].find((x) => x.id === id);
  if (tab === 'color') p.setSkin(item);
  else if (tab === 'hat') G.costume.setHat(id);
  else if (tab === 'cape') G.costume.setCape(item);
  else if (tab === 'pet') G.pet.set(id, p);
  if (tab !== 'portal') {
    p.animOverride = 'Yes';
    setTimeout(() => {
      if (G.state === 'shop') p.animOverride = 'Idle';
    }, 1200);
  }
};

G.celebrateBuy = () => {
  const p = G.player.pos;
  confetti.burst(p.x, p.y + 1.5, p.z, 90, 8);
  G.player.animOverride = 'ThumbsUp';
  logEvent('buy', { item: G.ui.shopSel });
  setTimeout(() => {
    if (G.state === 'shop') G.player.animOverride = 'Idle';
  }, 1500);
};

function spawnInHub(x, y, z, face) {
  const p = G.player;
  p.animOverride = null;
  p.frozen = false;
  p.spawn(x, y, z, face);
  rig.pitch = 0.36;
  rig.frozenY = null;
  rig.snap(p.pos, face - Math.PI);
  G.pet.snap(p);
  input.reset();
}

G.toHub = (fromPortal = null) => {
  if (G.game) {
    G.game.exit();
    G.game = null;
  }
  G.hub.world.group.visible = true;
  applyTheme(HUB_DEF);
  G.hub.refresh();
  const top = progress.mostPlayed(7) || progress.mostPlayed(30) || progress.mostPlayed(3650);
  G.hub.setMostPlayed(top ? gameById(top.id) : null);
  if (fromPortal) {
    const a = Math.atan2(-fromPortal.x, -fromPortal.z);
    spawnInHub(fromPortal.x + Math.sin(a) * 9, 0, fromPortal.z + Math.cos(a) * 9, a);
  } else spawnInHub(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN.face);
  G.portalArmed = false;
  G.state = 'hub';
  G.ui.clearDanger();
  G.ui.hidePrompt();
  G.ui.progress(progress);
  showScreen('none');
  G.hintOn = !progress.s.learned && !input.touchMode;
  G.ui.hint(G.hintOn);
  logEvent('hub');
};

G.action = (a) => {
  if (a === 'mute') {
    progress.s.muted = !progress.s.muted;
    audio.setMuted(progress.s.muted);
    G.ui.setMuteIcon(progress.s.muted);
    progress.persist();
    return;
  }
  audio.click();
  if (a === 'pause') togglePause(true);
  else if (a === 'resume') togglePause(false);
  else if (a === 'restart') restartGame();
  else if (a === 'hub') G.toHub(G.gameDef ? G.lastPortal : null);
  else if (a === 'next') G.startStage(G.gameDef, G.stageIdx + 1);
  else if (a === 'closeStages' || a === 'closeUnlock') {
    G.state = 'hub';
    G.player.frozen = false;
    showScreen('none');
  } else if (a === 'closeShop') closeShop();
};

function togglePause(on) {
  if (on && (G.state === 'game' || G.state === 'hub')) {
    G.prevState = G.state;
    G.state = 'paused';
    document.getElementById('pauseRestart').classList.toggle('hidden', !G.game);
    showScreen('pause');
    G.ui.show('hud', true);
    logEvent('pause');
  } else if (!on && G.state === 'paused') {
    G.state = G.prevState || 'hub';
    input.reset();
    audio.unlock();
    showScreen('none');
    logEvent('resume');
  }
}

function restartGame() {
  if (!G.game) return;
  G.game.restart();
  G.state = 'game';
  confetti.clear();
  showScreen('none');
  G.ui.banner('Baştan!');
  logEvent('restart');
}

function openShop() {
  G.state = 'shop';
  G.ui.shopSel = null;
  G.ui.shopTab = 'color';
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'color'));
  G.ui.renderShop();
  G.ui.progress(progress);
  const p = G.player;
  p.frozen = true;
  p.vel.set(0, 0, 0);
  p.animOverride = 'Wave';
  setTimeout(() => {
    if (G.state === 'shop') p.animOverride = 'Idle';
  }, 1600);
  G.ui.hidePrompt();
  showScreen('shop');
  logEvent('shop');
}

function closeShop() {
  G.applyLook();
  G.player.frozen = false;
  G.player.animOverride = null;
  G.state = 'hub';
  rig.snap(G.player.pos, rig.yaw);
  showScreen('none');
}

G.buyPortal = () => {
  const g = G.unlockGame;
  if (!g || !g.unlock.coins) return;
  if (!progress.spend(g.unlock.coins)) {
    audio.nope();
    return;
  }
  progress.unlockPortal(g.id);
  audio.buy();
  G.hub.refresh();
  G.ui.progress(progress, true);
  G.ui.toast('Portal açıldı!');
  const pt = G.hub.portals.find((x) => x.game === g);
  confetti.burst(pt.x, 3, pt.z, 120, 9);
  logEvent('unlockPortal', { game: g.id });
  G.action('closeUnlock');
};

function interact() {
  if (G.state !== 'hub' || !G.near) return;
  const n = G.near;
  if (n.type === 'shop') {
    openShop();
    return;
  }
  const g = n.portal.game;
  if (!n.portal.open) {
    G.unlockGame = g;
    G.state = 'unlock';
    G.player.frozen = true;
    G.ui.unlock(g);
    showScreen('unlock');
    return;
  }
  if (!g.load) {
    G.ui.toast('Yakında!');
    audio.nope();
    return;
  }
  openStages(g);
}

async function openStages(g) {
  G.state = 'stages';
  G.gameDef = g;
  G.player.frozen = true;
  G.player.vel.set(0, 0, 0);
  G.ui.hidePrompt();
  const mod = await g.load();
  G.gameMod = mod;
  if (G.state !== 'stages') return;
  G.ui.stages(g, mod.STAGES);
  showScreen('stages');
}

G.startStage = async (g, idx) => {
  const mod = G.gameMod && G.gameMod.ID === g.id ? G.gameMod : await g.load();
  G.gameMod = mod;
  if (idx >= mod.STAGES.length) idx = 0;
  if (G.game) {
    G.game.exit();
    G.game = null;
  }
  G.gameDef = g;
  G.stageIdx = idx;
  G.lastPortal = G.hub.portals.find((x) => x.game === g);
  G.hub.world.group.visible = false;
  G.ui.hidePrompt();
  G.ui.hint(false);
  confetti.clear();
  progress.recordPlay(g.id);
  G.game = mod.create(ctx, idx);
  G.game.enter();
  G.pet.snap(G.player);
  G.state = 'game';
  showScreen('none');
  G.ui.progress(progress);
  logEvent('play', { game: g.id, stage: idx + 1 });
};

function finishGame(r) {
  const info = progress.stageDone(r.game, r.stage, r.time);
  const gained = progress.addXp(r.xp);
  progress.addCoins(r.reward);
  r.record = info.record;
  G.result = r;
  G.state = 'results';
  G.player.animOverride = 'ThumbsUp';
  G.ui.results(r);
  G.ui.progress(progress, true);
  showScreen('results');
  rig.orbitT = Math.atan2(camera.position.x - G.player.pos.x, camera.position.z - G.player.pos.z);
  logEvent('reward', { xp: r.xp, coins: r.reward + r.coins, level: progress.level });
  if (gained > 0) {
    setTimeout(() => {
      G.ui.levelUp(progress.level);
      audio.win();
      const p = G.player.pos;
      confetti.burst(p.x, p.y + 3, p.z, 160, 11, 1, [0xffd22e, 0xffffff, 0xffa000]);
      G.hub.refresh();
      logEvent('levelup', { level: progress.level });
    }, 900);
  }
}

function hubFixed(dt) {
  const p = G.player;
  const w = G.hub.world;
  w.step(dt);
  if (G.state !== 'hub') return;
  p.step(dt, input, w, rig.yaw);
  playerEvents(0xf4f0e6);
  if (p.pos.y < -12) {
    fade(true);
    spawnInHub(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN.face);
    audio.splash();
    setTimeout(() => fade(false), 120);
    logEvent('fall');
    return;
  }
  const near = G.hub.nearest(p.pos);
  G.near = near;
  if (!near) {
    G.ui.hidePrompt();
    G.portalArmed = true;
    return;
  }
  if (near.type === 'shop') G.ui.prompt('Mağazaya gir', 'E', false);
  else {
    const g = near.portal.game;
    if (!near.portal.open) G.ui.prompt(g.name + ' kilitli · neden?', 'E', true);
    else if (!g.load) G.ui.prompt(g.name + ' · Yakında', 'E', true);
    else {
      G.ui.prompt(g.name + ' · Gir', 'E', false);
      if (near.dist < 1.1 && G.portalArmed && p.grounded) {
        G.portalArmed = false;
        audio.whoosh();
        openStages(g);
      }
    }
  }
}

function updateHint(dt) {
  if (!G.hintOn) return;
  const p = G.player;
  if (Math.hypot(p.vel.x, p.vel.z) > 1) G.walkT += dt;
  if (G.walkT > 3 && G.jumps >= 2) {
    G.hintOn = false;
    G.ui.hint(false);
    progress.s.learned = true;
    progress.persist();
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
  if (!G.player || !G.hub) return;
  G.time += dt;
  const p = G.player;
  const st = G.state;
  if (st !== 'paused') {
    acc += dt;
    let n = 0;
    while (acc >= FIXED && n < 14) {
      if (G.game) G.game.fixed(FIXED);
      else if (st === 'hub') hubFixed(FIXED);
      acc -= FIXED;
      n++;
    }
    if (n >= 14) acc = 0;
  }
  if (st === 'hub') updateHint(dt);
  const look = input.takeLook();
  G.lookIdle = Math.abs(look.x) + Math.abs(look.y) > 0.5 ? 0 : G.lookIdle + dt;
  const world = currentWorld();
  if (st === 'hub' || st === 'game') {
    rig.applyLook(look, input.touchMode);
    rig.follow(dt, p, world);
  } else if (st === 'results') {
    rig.orbitT = Math.PI + Math.sin(G.time * 0.35) * 0.75;
    rig.orbit(dt, p.pos, 7.5, 2.6, 0, 0);
    p.faceTarget = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
  } else if (st === 'shop') {
    const wide = window.innerWidth > 820;
    rig.orbit(dt, p.pos, 5.2, 1.7, 0.18, wide ? -2.1 : 0);
    p.face = p.faceTarget = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
  } else if (st === 'stages' || st === 'unlock') {
    rig.follow(dt, p, world);
  }
  if (st !== 'paused') {
    if (G.game) G.game.update(dt);
    else {
      G.hub.world.animate(dt);
      G.hub.update(dt);
    }
    p.update(dt, world, G.time);
    G.costume.update(dt, G.time);
    G.pet.update(dt, p, world, G.time);
    world.setView(st === 'hub' || st === 'game' ? camera.position : null, p.pos);
    if (!G.game) G.hub.setView(st === 'hub' ? camera.position : null, p.pos);
    glow.update(dt);
    stars.update(dt);
    dust.update(dt);
    confetti.update(dt);
  }
  const focus = st === 'hub' || st === 'game' ? rig.target : p.pos;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 70);
  if (G.game && st === 'game') G.ui.gameHud(G.game.hud(), G.gameDef.name);
  if (G.tier <= 1) composer.render();
  else renderer.render(scene, camera);
  adaptQuality(rawDt);
}

function adaptQuality(rawDt) {
  if (params.hq || G.tier >= 3) return;
  if (G.state !== 'game' && G.state !== 'hub') {
    frameTimes.length = 0;
    return;
  }
  G.warm += rawDt;
  if (G.warm < 1.5) return;
  if (rawDt > 0.25) return;
  frameTimes.push(rawDt * 1000);
  if (frameTimes.length < 45 || frameTimes.reduce((a, b) => a + b, 0) < 3000) return;
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
  if (t >= 3) {
    pixelRatio = Math.min(DPR, 1);
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    });
  }
  resize();
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
window.addEventListener('pagehide', () => progress.persist());

function r2(v) {
  return Math.round(v * 100) / 100;
}
function v3(v) {
  return { x: r2(v.x), y: r2(v.y), z: r2(v.z) };
}

Object.defineProperty(window, '__game', {
  get() {
    const p = G.player;
    const h = G.game ? G.game.hud() : null;
    return Object.freeze({
      state: G.state,
      scene: G.game ? G.gameDef.id : 'hub',
      stage: h ? h.stage : null,
      stages: h ? h.stageMax : null,
      lavaDanger: h ? r2(h.danger) : null,
      time: h ? r2(h.time) : null,
      player: p ? { pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, state: p.dead ? 'dead' : !p.grounded ? 'air' : Math.hypot(p.vel.x, p.vel.z) > 0.5 ? 'run' : 'idle', visible: p.root.visible } : null,
      camera: { pos: v3(camera.position), target: v3(rig.target), fov: r2(camera.fov), yaw: r2(rig.yaw) },
      near: G.near ? (G.near.type === 'shop' ? 'shop' : G.near.portal.game.id) : null,
      level: progress.level,
      xp: progress.s.xp,
      coins: progress.coins,
      equipped: { ...progress.s.eq },
      portals: GAMES.map((g) => ({ id: g.id, open: progress.portalOpen(g), playable: !!g.load })),
      plays: progress.s.plays.length,
      fps: G.fps,
      tier: G.tier,
      events: G.events.slice(),
    });
  },
});

if (hasDebug) {
  window.__dev = {
    G,
    renderer,
    scene,
    rig,
    progress,
    teleport(x, y, z) {
      G.player.spawn(x, y, z, Math.PI);
      rig.snap(G.player.pos, rig.yaw);
    },
    setTier,
  };
}

async function boot() {
  G.ui = new UI(G);
  G.ui.setMuteIcon(progress.s.muted);
  audio.setMuted(progress.s.muted);
  input.on('gesture', () => audio.unlock());
  input.on('pause', () => {
    if (G.state === 'paused') togglePause(false);
    else if (G.state === 'shop') closeShop();
    else if (G.state === 'stages' || G.state === 'unlock') G.action('closeStages');
    else togglePause(true);
  });
  input.on('mute', () => G.action('mute'));
  input.on('interact', () => interact());
  input.on('emote', (n) => {
    if (G.state === 'hub' || G.state === 'game') G.player.playEmote(n);
  });
  input.on('touchmode', () => showScreen('none'));
  input.on('key', (code) => logEvent('input', { key: code }));
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) input.setTouchMode(true);
  if (params.mobile) input.setTouchMode(true);
  resize();
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) =>
    loader.load(
      'assets/RobotExpressive.glb',
      res,
      (e) => {
        if (e.total) G.ui.setLoad((e.loaded / e.total) * 0.7);
      },
      rej,
    ),
  );
  G.ui.setLoad(0.8);
  if (params.tier) setTier(params.tier);
  if (params.coins) progress.s.coins = params.coins;
  if (params.level) progress.s.level = params.level;
  if (params.reset) {
    localStorage.removeItem('my-universe-v1');
    location.search = '';
    return;
  }
  G.player = new Player(scene, gltf);
  G.costume = new Costume(G.player);
  G.pet = new PetFollower(scene);
  G.hub = new Hub(scene, progress);
  G.applyLook();
  G.ui.setLoad(1);
  G.toHub();
  logEvent('ready');
  requestAnimationFrame(frame);
  if (params.shop) openShop();
  else if (params.game) {
    const g = gameById(params.game) || GAMES[0];
    await G.startStage(g, (params.stage || 1) - 1);
  } else if (params.portal) {
    const pt = G.hub.portals[params.portal - 1];
    if (pt) spawnInHub(pt.x * 0.85, 0, pt.z * 0.85, Math.atan2(pt.x, pt.z));
  }
}

boot().catch((e) => {
  console.error(e);
  document.querySelector('.load-text').textContent = 'Bir sorun oldu. Sayfayı yenile.';
});
