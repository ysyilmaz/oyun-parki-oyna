import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World, heightAt, zoneAt, gateX, PLAZA } from './world.js';
import { FX, Drops, Overlay } from './fx.js';
import { Player, CameraRig } from './player.js';
import { Squad } from './pets.js';
import { Breakables } from './breakables.js';
import { Hatch } from './hatch.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { loadState, saveState, clearState, defaultState } from './save.js';
import { petThumb, setPetThumbRenderer, createPetObject } from './petModels.js';
import { injectIconStyles, icon, ICONS, applyIcons } from './icons.js';
import { EGGS, GOLD_EGG, ZONES, ZONE_W, ZONE_HP, ZONE_REWARD, BREAKABLES, UPGRADES, SPECIES, RARITIES, PITY_EGGS, PITY_LEG, GOLDEN_CHANCE, MERGE_COUNT, VARIANTS, REBIRTH_BASE, findPetDef, petPower, petLevel, fmt } from './data.js';
import { M, part, merge, normalizeMaterials, dropEnvOnMatte, setMatteEnv } from './geo.js';
import { getEggGeometry, makeEggMaterial } from './eggs.js';

injectIconStyles();
applyIcons();

const params = new URLSearchParams(location.search);
const debug = (params.get('debug') || '').split(',').filter(Boolean);
const debugOn = debug.length > 0;
const dbg = (k) => debug.find((d) => d === k || d.startsWith(k + ':'));
const dbgVal = (k) => {
  const d = dbg(k);
  return d && d.includes(':') ? d.split(':')[1] : null;
};

const events = [{ t: Math.round(performance.now()), g: 0, type: 'boot', data: { phase: 'module' } }];
let eventGameT = 0;
function logEvent(type, data) {
  events.push({ t: Math.round(performance.now()), g: Math.round(eventGameT * 1000), type, data });
  if (events.length > 3000) events.splice(0, events.length - 3000);
}

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !dbg('noshadow');
renderer.debug.checkShaderErrors = !!dbg('shadercheck');
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc4ecff, 80, 260);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 1400);

logEvent('boot', { phase: 'ctx' });
let envTex = null;
scene.environmentIntensity = 0.22;

const sunDir = new THREE.Vector3(0.45, 0.8, 0.4).normalize();
const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x6b8a4a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -34;
sc.right = 34;
sc.top = 34;
sc.bottom = -34;
sc.near = 1;
sc.far = 160;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);
const lights = { sun, hemi };

const state = debugOn && !dbg('save') ? defaultState() : loadState();
const audio = new Audio();
audio.musicOn = state.settings.music;
audio.sfxOn = state.settings.sfx;

logEvent('boot', { phase: 'renderer' });
const world = new World(scene, sunDir);
const fx = new FX(scene, camera);
const overlay = new Overlay(document.getElementById('overlay'), camera);
const player = new Player(scene, fx, audio);
player.pos.set(-10, 0, 15.5);
const rig = new CameraRig(camera);
const squad = new Squad(scene, fx);

let pendingCoins = 0;
let pendingT = 0;
let hitstop = 0;
let dirty = false;
const tmpV = new THREE.Vector3();

const drops = new Drops(scene, (kind, value, x, y, z, silent) => {
  dirty = true;
  if (kind === 'gem') {
    state.gems += value;
    logEvent('coin', { kind: 'gem', value, cat: 'reward' });
    if (!silent) {
      audio.gem();
      flyFromWorld('gem', x, y, z);
      overlay.add('gem', player.pos.x, player.pos.y + 3, player.pos.z, value, 'gem', '+');
    }
  } else {
    state.coins += value;
    state.stats.coinsTotal += value;
    incomeLog.push({ t: playTime, v: value });
    lastIncomeT = playTime;
    pendingCoins += value;
    logEvent('coin', { kind: 'coin', value: Math.round(value), cat: 'reward' });
    if (!silent) {
      audio.coin();
      flyFromWorld('coin', x, y, z);
    }
  }
});

function flyFromWorld(kind, x, y, z) {
  const p = overlay.project(x, y, z);
  if (p.vis) ui.fly(kind, p.x, p.y);
}

const G = {
  state,
  audio,
  paused: false,
  maxSlots: () => 3 + state.up.slots,
  coinMult: () => (1 + state.up.coinMult * 0.3) * (1 + (state.rebirths || 0)),
  powerOf: (p) => petPower(findPetDef(p.sp).entry, p.v, p.xp || 0),
  onPanel(open) {
    input.enabled = !open;
    if (open) input.keys.clear();
    logEvent('input', { kind: open ? 'panelOpen' : 'panelClose', panel: ui.panel });
  },
};

const breakables = new Breakables(scene, world, fx, drops, overlay, audio, {
  coinMult: G.coinMult,
  lockedNeed: (b) => (canBreak(b) ? 0 : needPower(b)),
  onBreak(b, value) {
    state.stats.broken++;
    dirty = true;
    hitstop = b.type === 'diamond' || b.type === 'chest' ? 0.09 : 0.05;
    if (state.settings.shake) rig.shake(b.type === 'diamond' ? 0.45 : 0.2, 0.12);
    if (manualTarget === b) manualTarget = null;
    logEvent('break', { type: b.type, zone: b.zone, coins: value, cat: 'reward' });
  },
});

logEvent('boot', { phase: 'preui' });
const ui = new UI(G);
const hatch = new Hatch(renderer, envTex, audio, ui);
G.hatch = hatch;
const input = new Input(canvas, document.getElementById('joy'));
input.onAction = () => input.enabled && mode === 'play' && !hatch.active && (ui.tryPromptAction() || actionPile());
let lastBuy = 0;
function buyReady() {
  const now = performance.now();
  if (now - lastBuy < 400) return false;
  lastBuy = now;
  return true;
}

const msaa = window.innerWidth * window.innerHeight * Math.min(2, window.devicePixelRatio || 1) ** 2 > 1500000 ? 2 : 4;
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: dbg('nomsaa') ? 0 : msaa });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const hatchBgPass = new RenderPass(hatch.bgScene, hatch.camera);
hatchBgPass.clear = false;
hatchBgPass.enabled = false;
composer.addPass(hatchBgPass);
const hatchPass = new RenderPass(hatch.scene, hatch.camera);
hatchPass.clear = false;
hatchPass.clearDepth = true;
hatchPass.enabled = false;
composer.addPass(hatchPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new FXAAPass();
fxaa.enabled = false;
composer.addPass(fxaa);

let quality = state.settings.quality;
let autoStep = 0;
const perf = { median: 0, samples: [], windowT: 0, steps: [], loadGaps: [], cpuUpdate: 0, cpuRender: 0 };
function applyQuality() {
  const high = quality === 'high';
  const lowest = !high || autoStep >= 2;
  const pr = Math.min(window.devicePixelRatio || 1, !high ? 1 : autoStep >= 1 ? 1.25 : 2, lowest ? Math.sqrt((autoStep >= 3 ? 850000 : 1100000) / (window.innerWidth * window.innerHeight)) : 2);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  bloom.enabled = high && autoStep < 2 && !dbg('nobloom');
  const samples = high && autoStep < 3 && !dbg('nomsaa') ? msaa : 0;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) {
    if (t.samples !== samples) {
      t.samples = samples;
      t.dispose();
    }
  }
  fxaa.enabled = samples === 0;
  const ms = high && autoStep === 0 ? 2048 : 1024;
  sun.shadow.mapSize.set(ms, ms);
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  resize();
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 70 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  fx.setScale(h * renderer.getPixelRatio(), camera.fov);
  hatch.resize(w, h);
}
window.addEventListener('resize', resize);

const arrowMesh = (() => {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(40, 8);
  ctx.lineTo(88, 8);
  ctx.lineTo(88, 78);
  ctx.lineTo(118, 78);
  ctx.lineTo(64, 150);
  ctx.lineTo(10, 78);
  ctx.lineTo(40, 78);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#1d1b3a';
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, '#fff27a');
  g.addColorStop(1, '#ff9d00');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(48, 16, 10, 56);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.56, 0.56, 0.56), depthTest: false, depthWrite: false, fog: false }));
  m.center.set(0.5, 0);
  m.scale.set(1.9, 2.4, 1);
  m.renderOrder = 30;
  m.visible = false;
  scene.add(m);
  return m;
})();

const targetRing = (() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.4), transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  m.renderOrder = 3;
  scene.add(m);
  return m;
})();

let manualTarget = null;
let currentTarget = null;
let mode = 'loading';
let time = 0;
let lastZone = -1;
let saveT = 0;
let slowT = 0;
let guideT = 0;
let moveTime = 0;
let playTime = 0;
const raycaster = new THREE.Raycaster();

const failTimes = [];
let helpUntil = 0;
function failedBuy() {
  failTimes.push(playTime);
  while (failTimes.length && failTimes[0] < playTime - 60) failTimes.shift();
  logEvent('buyFail', { n: failTimes.length });
  if (failTimes.length >= 3) {
    helpUntil = time + 8;
    failTimes.length = 0;
  }
}

function maxZone() {
  return state.zones - 1;
}

function syncSquad() {
  const eq = state.equipped.map((uid) => state.pets.find((p) => p.uid === uid)).filter(Boolean);
  state.equipped = eq.map((p) => p.uid);
  squad.sync(eq, player.pos, G.powerOf);
  ui.setPower(squad.totalPower());
}

function save(reason) {
  dirty = false;
  if (debugOn && !dbg('save')) return;
  const ok = saveState(state);
  logEvent('save', { ok, reason: reason || 'auto' });
}

function addPet(sp, v) {
  const p = { uid: state.nextUid++, sp, v, xp: 0 };
  state.pets.push(p);
  const isNew = !state.seen[sp];
  state.seen[sp] = 1;
  return { p, isNew };
}

G.eggPool = (kind) => {
  if (kind === 'gold') {
    const egg = EGGS[maxZone()];
    const pets = egg.pets.slice(0, 5).map((p, i) => ({ sp: p[0], rarity: p[1], power: p[2], pct: GOLD_EGG.odds[i] }));
    return { name: GOLD_EGG.name, price: GOLD_EGG.gems, gold: true, pets, colors: GOLD_EGG.colors, egg };
  }
  const egg = EGGS[kind];
  return { name: egg.name, price: egg.price, gold: false, pets: egg.pets.map((p, i) => ({ sp: p[0], rarity: p[1], power: p[2], pct: egg.odds[i] })), colors: egg.colors, egg };
};

function roll(pool, forceMin) {
  let list = pool.pets;
  if (forceMin != null) list = list.filter((p) => p.rarity >= forceMin);
  const total = list.reduce((s, p) => s + p.pct, 0);
  let x = Math.random() * total;
  for (const p of list) {
    x -= p.pct;
    if (x <= 0) return p;
  }
  return list[list.length - 1];
}

function earlyRoll(pool) {
  const owned = new Set(state.pets.map((x) => x.sp));
  const fresh = pool.pets.filter((p) => !owned.has(p.sp) && p.rarity <= 3);
  let list = fresh.length ? fresh : pool.pets;
  const special = state.pets.some((x) => findPetDef(x.sp).entry[1] >= 1);
  if (state.hatched === 2 && !special && list.some((p) => p.rarity >= 1)) list = list.filter((p) => p.rarity >= 1);
  return roll({ pets: list });
}

G.openEgg = (kind, forced) => {
  if (hatch.active || G.paused) return;
  const pool = G.eggPool(kind);
  if (forced == null) {
    if (!buyReady()) return;
    if (pool.gold ? state.gems < pool.price : state.coins < pool.price) {
      audio.error();
      failedBuy();
      ui.toast(`${icon(pool.gold ? 'gem' : 'coin')}${fmt(pool.price - (pool.gold ? state.gems : state.coins))} ${icon(pool.gold ? 'gem' : 'coin')}`);
      return;
    }
    if (state.pets.length >= 250) {
      audio.error();
      ui.toast(`${icon('paw')}${icon('trash')}`);
      ui.open('pets');
      return;
    }
    if (pool.gold) state.gems -= pool.price;
    else state.coins -= pool.price;
  }
  logEvent('eggBuy', { kind, price: pool.price, gems: pool.gold });
  const pityE = state.pityE || 0;
  const pityL = state.pityL || 0;
  let pick;
  let pityHit = null;
  if (forced != null) pick = pool.pets.find((p) => p.rarity === forced) || roll(pool, forced);
  else if (!pool.gold && pityL >= PITY_LEG - 1) {
    pick = roll(pool, 4);
    pityHit = 'legendary';
  } else if (!pool.gold && pityE >= PITY_EGGS - 1) {
    pick = roll(pool, 3);
    pityHit = 'epic';
  } else if (!pool.gold && state.hatched < 3) pick = earlyRoll(pool);
  else pick = roll(pool);
  if (pityHit) logEvent('pity', { kind: pityHit });
  let v = pool.gold ? 1 : Math.random() < GOLDEN_CHANCE ? 1 : 0;
  if (forced != null && !pool.gold) v = 0;
  if (!pool.gold) {
    state.pityE = pick.rarity >= 3 ? 0 : pityE + 1;
    state.pityL = pick.rarity >= 4 ? 0 : pityL + 1;
  }
  const { p, isNew } = addPet(pick.sp, v);
  state.hatched++;
  const autoEquip = state.equipped.length < G.maxSlots();
  if (autoEquip) state.equipped.push(p.uid);
  const res = { sp: pick.sp, v, rarity: pick.rarity, power: G.powerOf(p), isNew, uid: p.uid };
  save('egg');
  ui.hidePrompt();
  input.enabled = false;
  input.keys.clear();
  hatchPass.enabled = true;
  hatchBgPass.enabled = true;
  audio.buy();
  hatch.start(res, pool.colors, pool.gold || v === 1, (r) => {
    input.enabled = !ui.panel;
    logEvent('hatch', { sp: r.sp, rarity: r.rarity, variant: r.v, isNew: r.isNew, cat: 'reward' });
    let replaced = false;
    if (!autoEquip) {
      const weakest = state.equipped.map((u) => state.pets.find((x) => x.uid === u)).filter(Boolean).sort((a, b) => G.powerOf(a) - G.powerOf(b))[0];
      if (weakest && G.powerOf(weakest) < r.power) {
        state.equipped[state.equipped.indexOf(weakest.uid)] = r.uid;
        replaced = true;
      }
    }
    syncSquad();
    const eff = Math.max(r.rarity, r.v ? 4 : 0);
    if (eff >= 4) {
      player.emote('Dance', 3.2);
      fx.confetti(player.pos.x, player.pos.y + 2, player.pos.z, 80);
    } else if (eff >= 3) player.emote('ThumbsUp', 1.6);
    else player.emote('Yes', 1.2);
    if (!autoEquip && !replaced) {
      ui.toast(`<img src="${petThumb(r.sp, r.v)}" alt="">${icon('paw')}`);
      ui.badge = (ui.badge || 0) + 1;
      ui.setPetBadge(ui.badge);
    }
    save('hatch');
  }, forced != null ? 1 : state.hatched);
};

G.buyGate = (i) => {
  const Z = ZONES[i];
  if (state.zones !== i || !buyReady()) return;
  if (state.coins < Z.gate) {
    audio.error();
    failedBuy();
    ui.toast(`${icon('coin')}${fmt(Z.gate - state.coins)}`);
    return;
  }
  state.coins -= Z.gate;
  unlockZone(i, false);
  save('gate');
};

function unlockZone(i, instant) {
  state.zones = Math.max(state.zones, i + 1);
  world.unlockGate(i, instant);
  if (!instant) {
    logEvent('zoneUnlock', { zone: i, cat: 'unlock' });
    const gx = gateX(i);
    fx.confetti(gx, 5, 0, 140);
    fx.burst(gx, 4, 0, ZONES[i].path, 60, { speed: 10, up: 6, life: 1.2, size: 0.7 });
    audio.unlock();
    if (state.settings.shake) rig.shake(0.5, 0.25);
    ui.hidePrompt();
    ui.banner(ZONES[i].name, '');
    gateGuide = { gx, x: gx + 7, until: time + 30 };
  }
}

G.buyUpgrade = (id) => {
  const u = UPGRADES.find((x) => x.id === id);
  const lvl = state.up[id];
  if (lvl >= u.max || !buyReady()) return;
  const cost = u.costs[lvl];
  if (state.coins < cost) {
    audio.error();
    return;
  }
  state.coins -= cost;
  state.up[id]++;
  audio.buy();
  logEvent('upgrade', { id, level: state.up[id], cat: 'unlock' });
  ui.toast(`${icon(u.icon)}${u.name} ${icon('level')}${state.up[id]}`);
  fx.burst(player.pos.x, player.pos.y + 1.5, player.pos.z, '#8dff6a', 30, { speed: 5, up: 5 });
  if (id === 'slots') G.equipBest(true);
  save('upgrade');
};

G.rebirth = () => {
  const cost = REBIRTH_BASE * Math.pow(2, state.rebirths || 0);
  if (state.zones < ZONES.length || state.coins < cost) {
    audio.error();
    return false;
  }
  state.coins = 0;
  state.rebirths = (state.rebirths || 0) + 1;
  state.zones = 1;
  world.relockAll();
  player.pos.set(-10, 0, 15.5);
  rig.target.copy(player.pos);
  manualTarget = null;
  logEvent('rebirth', { count: state.rebirths, cat: 'unlock' });
  audio.reveal(5);
  fx.confetti(player.pos.x, player.pos.y + 2, player.pos.z, 160);
  ui.banner(`x${state.rebirths + 1}`, '');
  save('rebirth');
  return true;
};

G.toggleEquip = (uid) => {
  const i = state.equipped.indexOf(uid);
  if (i >= 0) state.equipped.splice(i, 1);
  else if (state.equipped.length < G.maxSlots()) state.equipped.push(uid);
  else {
    audio.error();
    ui.toast(`${icon('paw')}${state.equipped.length}/${G.maxSlots()}`);
  }
  logEvent('equip', { uid, on: i < 0 });
  syncSquad();
  save('equip');
};

G.equipBest = (silent) => {
  const best = state.pets.slice().sort((a, b) => G.powerOf(b) - G.powerOf(a)).slice(0, G.maxSlots());
  const before = state.equipped.slice().sort().join(',');
  state.equipped = best.map((p) => p.uid);
  const same = before === state.equipped.slice().sort().join(',');
  syncSquad();
  if (!silent) {
    if (same) {
      audio.click();
      ui.toast(`${icon('check')}${icon('star')}`);
      ui.flashEquipped();
    } else audio.buy();
  }
  logEvent('equip', { best: true });
  ui.badge = 0;
  ui.setPetBadge(0);
  save('equip');
};

G.deletePets = (uids) => {
  if (state.pets.length - uids.length < 1) uids = uids.slice(0, state.pets.length - 1);
  G.lastDelete = { pets: state.pets.filter((p) => uids.includes(p.uid)).map((p) => ({ ...p })), equipped: state.equipped.slice(), t: performance.now() };
  state.pets = state.pets.filter((p) => !uids.includes(p.uid));
  state.equipped = state.equipped.filter((u) => !uids.includes(u));
  if (!state.equipped.length) G.equipBest(true);
  syncSquad();
  save('delete');
};

G.merge = (sp, v) => {
  const same = state.pets.filter((p) => p.sp === sp && p.v === v);
  if (same.length < MERGE_COUNT || v >= 2) return null;
  same.sort((a, b) => (state.equipped.includes(a.uid) ? 1 : 0) - (state.equipped.includes(b.uid) ? 1 : 0));
  const used = same.slice(0, MERGE_COUNT);
  const usedIds = used.map((p) => p.uid);
  const xp = Math.max(...used.map((p) => p.xp || 0));
  const eqBefore = state.equipped.slice();
  const wasEq = usedIds.some((u) => state.equipped.includes(u));
  state.pets = state.pets.filter((p) => !usedIds.includes(p.uid));
  state.equipped = state.equipped.filter((u) => !usedIds.includes(u));
  G.lastMerge = { pets: used.map((x) => ({ ...x })), equipped: eqBefore, t: performance.now() };
  const { p } = addPet(sp, v + 1);
  p.xp = xp;
  G.lastMerge.uid = p.uid;
  if (wasEq || state.equipped.length < G.maxSlots()) state.equipped.push(p.uid);
  syncSquad();
  audio.reveal(v === 0 ? 4 : 5);
  fx.confetti(player.pos.x, player.pos.y + 2, player.pos.z, 60);
  ui.toast(`<img src="${petThumb(sp, v + 1)}" alt="">${VARIANTS[v + 1].name} ${SPECIES[sp].name}!`);
  logEvent('merge', { sp, to: v + 1, cat: 'reward' });
  save('merge');
  return p;
};

G.undoMerge = () => {
  const m = G.lastMerge;
  if (!m || performance.now() - m.t > 10500) return null;
  G.lastMerge = null;
  state.pets = state.pets.filter((p) => p.uid !== m.uid);
  for (const p of m.pets) state.pets.push(p);
  state.equipped = m.equipped.filter((u) => state.pets.find((p) => p.uid === u));
  syncSquad();
  audio.click();
  logEvent('mergeUndo', {});
  save('undo');
  return m.pets[0].uid;
};

G.undoDelete = () => {
  const m = G.lastDelete;
  if (!m || performance.now() - m.t > 10500) return null;
  G.lastDelete = null;
  for (const p of m.pets) if (!state.pets.find((x) => x.uid === p.uid)) state.pets.push(p);
  state.equipped = m.equipped.filter((u) => state.pets.find((p) => p.uid === u));
  syncSquad();
  audio.click();
  logEvent('deleteUndo', { n: m.pets.length });
  save('undo');
  return m.pets.length ? m.pets[0].uid : null;
};

G.setSetting = (k, v) => {
  state.settings[k] = v;
  if (k === 'music') audio.setMusic(v);
  if (k === 'sfx') audio.setSfx(v);
  if (k === 'quality') {
    quality = v;
    autoStep = 0;
    applyQuality();
  }
  updateMuteIcon();
  save('settings');
};

G.reset = () => {
  clearState();
  location.reload();
};

function updateMuteIcon() {
  const el = document.querySelector('#btnMute span');
  const muted = !state.settings.music && !state.settings.sfx;
  el.innerHTML = ICONS[muted ? 'mute' : 'sound'];
}

document.getElementById('btnMute').addEventListener('click', () => {
  const muted = !state.settings.music && !state.settings.sfx;
  G.setSetting('music', muted);
  G.setSetting('sfx', muted);
});

function setPaused(p) {
  if (mode !== 'play' || G.paused === p) return;
  if (p && hatch.active) return;
  G.paused = p;
  document.getElementById('pause').classList.toggle('hidden', !p);
  if (p) {
    input.keys.clear();
    ui.close();
    if (audio.ctx) audio.ctx.suspend();
    save('pause');
  } else if (audio.ctx) audio.ctx.resume();
  logEvent('input', { kind: p ? 'pause' : 'resume' });
}
G.setPaused = setPaused;
document.getElementById('btnPause').addEventListener('click', () => setPaused(true));
document.getElementById('goal').addEventListener('click', () => {
  const g = G.goal;
  if (!g || mode !== 'play') return;
  if (g.type === 'up' || g.type === 'rebirth') ui.open('shop');
  else if (g.type === 'book') ui.open('index');
  else if (g.type === 'merge') ui.open('pets', g.uid);
});
document.getElementById('resumeBtn').addEventListener('click', () => setPaused(false));
window.addEventListener('keydown', (e) => {
  if (hatch.active && !e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.key === 'e' || e.key === 'E')) {
    e.preventDefault();
    hatch.skip();
    return;
  }
  if (e.code === 'Tab') e.preventDefault();
  if (mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) {
    setPaused(!G.paused);
    return;
  }
  if (mode === 'play' && !e.repeat) logEvent('input', { kind: 'key', code: e.code });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save('hidden');
    setPaused(true);
  }
});
window.addEventListener('blur', () => setPaused(true));
window.addEventListener('pagehide', () => save('pagehide'));

function applyDebug() {
  if (dbg('rich')) {
    state.coins += 1e9;
    state.gems += 5000;
  }
  const z = dbgVal('zone');
  if (z) {
    const n = Math.max(1, Math.min(6, Number(z)));
    for (let i = 1; i < n; i++) unlockZone(i, true);
    player.pos.set((n - 1) * ZONE_W - 6, 0, 8);
    player.facing = Math.PI;
  }
  if (dbg('pets')) {
    const zoneN = Math.max(1, state.zones);
    for (let e = 0; e < zoneN; e++) {
      for (const p of EGGS[e].pets) addPet(p[0], 0).p.xp = Math.floor(Math.random() * 400);
    }
    addPet('kedi', 1);
    addPet('unicorn', 2);
    addPet('tilki', 1);
    for (let k = 0; k < 4; k++) addPet('kopek', 0);
    G.equipBest(true);
  }
}

function checkPrompts() {
  if (hatch.active || mode !== 'play') {
    ui.hidePrompt();
    return;
  }
  const px = player.pos.x;
  const pz = player.pos.z;
  for (const s of world.stands) {
    if (s.kind !== 'gold' && s.kind > maxZone()) continue;
    if (Math.hypot(s.x - px, s.z - pz) < 5.2) {
      ui.eggPrompt(s);
      return;
    }
  }
  const next = world.gates.find((g) => g.i === state.zones);
  if (next && Math.abs(px - next.x) < 7 && Math.abs(pz) < 9) {
    ui.gatePrompt(next);
    return;
  }
  ui.hidePrompt();
}

const incomeLog = [];
let gateGuide = null;
let lastGoalKey = '';

function incomeRate() {
  const now = playTime;
  while (incomeLog.length && incomeLog[0].t < now - 90) incomeLog.shift();
  const sum = incomeLog.reduce((a, e) => a + e.v, 0);
  const span = Math.max(20, Math.min(90, now));
  return Math.max(0.5, sum / span);
}

function eggUseful(egg) {
  if (state.pets.length < G.maxSlots() || state.equipped.length < G.maxSlots()) return true;
  const exp = egg.pets.reduce((a, p, i) => a + (p[2] * egg.odds[i]) / 100, 0);
  const eq = state.equipped.map((u) => state.pets.find((x) => x.uid === u)).filter(Boolean);
  const weakest = eq.length ? Math.min(...eq.map((p) => G.powerOf(p))) : 0;
  return exp > weakest * 1.05;
}

function goalCandidates() {
  const z = maxZone();
  const egg = EGGS[z];
  const stand = world.stands.find((x) => x.kind === z);
  const list = [];
  if (eggUseful(egg)) list.push({ type: 'egg', key: 'egg' + z, cost: egg.price, ic: ICONS.egg, text: egg.name, pos: { x: stand.x, z: stand.z + 3.5, y: heightAt(stand.x, stand.z) + 6.6 } });
  for (const id of ['slots', 'coinMult', 'petSpeed']) {
    const u = UPGRADES.find((x) => x.id === id);
    const lvl = state.up[id];
    if (lvl < u.max) list.push({ type: 'up', key: 'up' + id, id, cost: u.costs[lvl], ic: ICONS[u.icon], text: u.name, pos: null });
  }
  return list;
}

function mergeGoal() {
  const groups = new Map();
  for (const p of state.pets) {
    if (p.v >= 2) continue;
    const k = p.sp + ':' + p.v;
    groups.set(k, (groups.get(k) || 0) + 1);
  }
  const eq = state.equipped.map((u) => state.pets.find((x) => x.uid === u)).filter(Boolean);
  const weakest = eq.length < G.maxSlots() ? 0 : Math.min(...eq.map((p) => G.powerOf(p)));
  for (const [k, n] of groups) {
    if (n < MERGE_COUNT) continue;
    const [sp, v] = k.split(':');
    const def = findPetDef(sp);
    if (petPower(def.entry, Number(v) + 1) <= weakest) continue;
    const uid = state.pets.find((p) => p.sp === sp && p.v === Number(v)).uid;
    return { type: 'merge', key: 'merge' + k, uid, ic: ICONS.merge, text: (Number(v) === 0 ? 'Altın ' : 'Gökkuşağı ') + SPECIES[sp].name, cur: MERGE_COUNT, max: MERGE_COUNT, pos: null };
  }
  return null;
}

function goldGoal() {
  if (state.hatched === 0 || state.gems < GOLD_EGG.gems) return null;
  const s = world.stands.find((x) => x.kind === 'gold');
  return { type: 'egg', key: 'eggGold', ic: ICONS.egg, text: GOLD_EGG.name, cur: state.gems, max: GOLD_EGG.gems, pos: { x: s.x, z: s.z + 3.5, y: heightAt(s.x, s.z) + 6.6 } };
}

const grind = { b: null, t: 0, on: false };
function updateGrind(dt, target) {
  if (mode !== 'play' || !target || !target.alive) {
    grind.b = null;
    grind.on = false;
    return;
  }
  if (grind.b !== target) {
    grind.b = target;
    grind.t = 0;
    grind.on = false;
  }
  if (hatch.active || ui.panel) return;
  grind.t += dt;
  if (!grind.on && grind.t >= 3 && playTime - lastIncomeT >= 3 && target.hp * 0.8 > squad.totalPower() * 5) {
    grind.on = true;
    logEvent('hint', { kind: 'grindGoal', target: target.type });
  }
}

function grindGoal() {
  const b = grind.b;
  if (!grind.on || !b || !b.alive || !canBreak(b)) return null;
  const big = b.type === 'diamond';
  return { type: 'break', key: 'break', ic: ICONS[big || b.type === 'crystal' ? 'gem' : 'coin'], text: b.def.name, cur: b.maxHp - b.hp, max: b.maxHp, num: `+<span class="ic-coin"></span>${fmt(Math.round(b.coins * G.coinMult()))}`, pos: { x: b.x, y: b.y + (big ? 6.4 : 4) * b.scale, z: b.z } };
}

function pileRate() {
  const z = maxZone();
  const d = BREAKABLES.coins;
  return ((squad.totalPower() / 0.8) * d.coins * ZONE_REWARD[z] * G.coinMult() * 0.5) / (d.hp * ZONE_HP[z]);
}

function goalNear(g) {
  if (!g || !(g.max > 0)) return false;
  return (g.max - g.cur) / Math.max(incomeRate(), pileRate()) <= 15;
}

let goalIsNear = false;
function nextGoal() {
  const g = baseGoal();
  goalIsNear = goalNear(g);
  if (goalIsNear) return g;
  return grindGoal() || g;
}

const BREAK_SECONDS = 8;
function needPower(b) {
  return Math.max(1, Math.ceil((b.hp * 0.8) / BREAK_SECONDS));
}
function canBreak(b) {
  return squad.totalPower() >= needPower(b);
}
function canPick(b) {
  return canBreak(b) && !(b.skipUntil > playTime);
}
const coinPile = (b) => b.type === 'coins' && canPick(b);

function baseGoal() {
  const c = state.coins;
  if (state.hatched === 0 && maxZone() === 0) {
    const s = world.stands.find((x) => x.kind === 0);
    return { type: 'egg', key: 'egg0', ic: ICONS.egg, text: EGGS[0].name, cur: c, max: EGGS[0].price, pos: { x: s.x, z: s.z + 3.5, y: heightAt(s.x, s.z) + 6.6 } };
  }
  const rate = incomeRate();
  const gate = state.zones < ZONES.length ? world.gates.find((x) => x.i === state.zones) : null;
  const gateGoal = gate ? { type: 'gate', key: 'gate' + gate.i, ic: ICONS.gate, text: ZONES[gate.i].name, cost: ZONES[gate.i].gate, pos: { x: gate.x - 2.5, z: 0, y: heightAt(gate.x, 0) + 1.2 } } : null;
  const done = (g) => ({ ...g, cur: c, max: g.cost });
  if (gateGoal && c >= gateGoal.cost) return done(gateGoal);
  const cands = goalCandidates();
  const affordable = cands.filter((k) => c >= k.cost);
  if (affordable.length) {
    const egg = affordable.find((k) => k.type === 'egg' && state.pets.length < G.maxSlots());
    return done(egg || affordable.sort((a, b) => a.cost - b.cost)[0]);
  }
  const special = mergeGoal() || goldGoal();
  if (special) return special;
  const near = cands.filter((k) => (k.cost - c) / rate <= 30 && (!gateGoal || k.cost < gateGoal.cost)).sort((a, b) => a.cost - b.cost)[0];
  if (near) return done(near);
  if (gateGoal && (gateGoal.cost - c) / rate <= 300) return done(gateGoal);
  if (cands.length) return done(cands.sort((a, b) => a.cost - b.cost)[0]);
  if (gateGoal) return done(gateGoal);
  const rbCost = REBIRTH_BASE * Math.pow(2, state.rebirths || 0);
  const rebirthGoal = { type: 'rebirth', key: 'rebirth', ic: ICONS.rebirth, text: 'Yeniden Doğ', cur: c, max: rbCost, pos: null };
  if (c >= rbCost) return rebirthGoal;
  const missing = EGGS.filter((e) => e.zone <= maxZone() && e.pets.some((p) => !state.seen[p[0]])).sort((a, b) => a.price - b.price)[0];
  if (missing) {
    const st = world.stands.find((x) => x.kind === missing.zone);
    const total = Object.keys(SPECIES).length;
    return { type: 'book', key: 'book' + missing.zone, ic: ICONS.book, text: missing.name, cur: c, max: missing.price, pos: { x: st.x, z: st.z + 3.5, y: heightAt(st.x, st.z) + 6.6 }, found: Object.keys(state.seen).length, total };
  }
  return rebirthGoal;
}

const goalPointer = document.getElementById('goalPointer');
const shopHint = document.getElementById('shopHint');
const khEIcon = document.querySelector('#khE .kh-ic');
let goalCoins = -1;
const _proj = new THREE.Vector3();


function toScreen(x, y, z) {
  _proj.set(x, y, z).project(camera);
  return { x: (_proj.x * 0.5 + 0.5) * window.innerWidth, y: (-_proj.y * 0.5 + 0.5) * window.innerHeight };
}

function showPointer(target, icon) {
  _proj.set(target.x, target.y + 1.2, target.z).project(camera);
  const onScreen = _proj.z < 1 && Math.abs(_proj.x) < 0.9 && Math.abs(_proj.y) < 0.85;
  arrowMesh.visible = onScreen && placeClearOfHud(arrowMesh, arrowMesh.position.y, Math.max(0, arrowMesh.position.y - target.y + 1));
  if (arrowMesh.visible) {
    goalPointer.classList.add('hidden');
    return;
  }
  const dx = target.x - player.pos.x;
  const dz = target.z - player.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  const a = toScreen(player.pos.x, player.pos.y + 1, player.pos.z);
  const b = toScreen(player.pos.x + (dx / d) * 4, player.pos.y + 1, player.pos.z + (dz / d) * 4);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const blockers = pointerBlockers();
  let r = POINTER_RADII[0];
  for (const rr of POINTER_RADII) {
    const x = a.x + c * rr;
    const y = a.y + s * rr;
    if (!blockers.some((k) => Math.abs(k.x - x) < k.w / 2 + 40 && Math.abs(k.y - y) < k.h / 2 + 40)) {
      r = rr;
      break;
    }
  }
  const px = a.x + c * r;
  const py = a.y + s * r;
  if (pointerIcon !== icon) {
    pointerIcon = icon;
    goalPointerIc.innerHTML = icon || '';
    goalPointerIc.classList.toggle('hidden', !icon);
  }
  goalPointer.classList.remove('hidden');
  goalPointer.style.transform = `translate(${px - 40}px, ${py - 40}px)`;
  goalPointerRot.style.transform = `rotate(${ang}rad)`;
  goalPointerIc.style.transform = `translate(${-c * 34}px, ${-s * 34}px)`;
}

const POINTER_RADII = [130, 100, 165, 200];
const goalPointerRot = goalPointer.querySelector('.gp-rot');
const goalPointerIc = goalPointer.querySelector('.gp-ic');
let pointerIcon = null;
function pointerBlockers() {
  const out = [];
  for (const p of overlay.placed || []) out.push({ x: p.x, y: p.y, w: p.w, h: p.h });
  for (const b of breakables.list) {
    if (!b.alive || b.zone > maxZone() || Math.abs(b.x - player.pos.x) > 30 || Math.abs(b.z - player.pos.z) > 30) continue;
    _proj.set(b.x, b.y + 1, b.z).project(camera);
    if (_proj.z > 1) continue;
    const w = 70 * b.r;
    out.push({ x: (_proj.x * 0.5 + 0.5) * window.innerWidth, y: (-_proj.y * 0.5 + 0.5) * window.innerHeight, w, h: w });
  }
  return out;
}

let guidePile = null;
let guideAim = null;
function pickGuidePile() {
  const px = player.pos.x;
  const pz = player.pos.z;
  if (guidePile && guidePile.alive && canPick(guidePile) && Math.hypot(guidePile.x - px, guidePile.z - pz) < 40) return guidePile;
  const skip = currentTarget && currentTarget.type === 'coins' ? currentTarget : null;
  guidePile = breakables.nearest(px, pz, 40, maxZone(), coinPile, skip) || breakables.nearest(px, pz, 40, maxZone(), canPick, skip);
  return guidePile;
}

function updateGuide(dt, goal) {
  let target = null;
  const affordable = goal.cur >= goal.max && goal.max > 0;
  if (goal.type === 'break') {
    guidePile = null;
    if (Math.hypot(goal.pos.x - player.pos.x, goal.pos.z - player.pos.z) > 8) target = { x: goal.pos.x, y: goal.pos.y, z: goal.pos.z, path: true, ic: goal.ic };
  } else if (!affordable || time < helpUntil) {
    const b = pickGuidePile();
    if (b && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) > 3.5) target = { x: b.x, y: b.y + 2.6 * b.scale, z: b.z, path: time < helpUntil, ic: ICONS.coin };
  } else guidePile = null;
  if (gateGuide) {
    if (player.pos.x > gateGuide.gx + 3 || time > gateGuide.until) gateGuide = null;
    else target = { x: gateGuide.x, y: heightAt(gateGuide.x, 0) + 1.2, z: 0, path: true, ic: ICONS.gate };
  }
  if (!target && goal.pos && goal.cur >= goal.max && goal.max > 0) {
    const d = Math.hypot(goal.pos.x - player.pos.x, goal.pos.z - player.pos.z);
    if (!ui.promptKey && d > 1.2) target = { x: goal.pos.x, y: goal.pos.y, z: goal.pos.z, path: true, ic: goal.ic };
  }
  const shopReady = goal.type === 'up' && goal.cur >= goal.max;
  document.getElementById('btnPets').classList.toggle('pulse', goal.type === 'merge' && !ui.panel);
  shopHint.classList.toggle('hidden', !shopReady || !!ui.panel);
  document.getElementById('btnShop').classList.toggle('pulse', shopReady);
  guideAim = target;
  if (!target) {
    arrowMesh.visible = false;
    goalPointer.classList.add('hidden');
    return;
  }
  arrowMesh.position.set(target.x, target.y + Math.abs(Math.sin(time * 4)) * 0.8, target.z);
  showPointer(target, target.ic);
  if (target.path) {
    guideT -= dt;
    if (guideT <= 0) {
      guideT = 0.07;
      const dx = target.x - player.pos.x;
      const dz = target.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      const k = ((time * 6) % 2) / 2;
      for (let s = 0; s < Math.min(16, d / 2); s++) {
        const t = ((s + k) * 2) / d;
        if (t > 1) break;
        const x = player.pos.x + dx * t;
        const z = player.pos.z + dz * t;
        if (Math.random() < 0.45) fx.sparkle(x, heightAt(x, z) + 0.35, z, '#ffd23a', 0.6, 0.6, 2.4);
      }
    }
  }
}

let lastTapHit = -1;
function pickOnScreen(sx, sy) {
  let best = null;
  let bd = 70;
  for (const b of breakables.list) {
    if (!b.alive || b.zone > maxZone() || !b.g.visible) continue;
    for (const hy of [1, 3.1]) {
      _proj.set(b.x, b.y + hy * b.scale, b.z).project(camera);
      if (_proj.z > 1) continue;
      const d = Math.hypot((_proj.x * 0.5 + 0.5) * window.innerWidth - sx, (-_proj.y * 0.5 + 0.5) * window.innerHeight - sy);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
  }
  return best;
}

function handAt(x, y) {
  return handB && handB.alive && Math.abs(x - handPos.x - 32) < 48 && Math.abs(y - handPos.y - 32) < 48 ? handB : null;
}

function deny(b) {
  if (time - (b.denyT ?? -10) < 0.6) return;
  b.denyT = time;
  audio.error();
  logEvent('input', { kind: 'tooStrong', target: b.type, need: needPower(b), power: squad.totalPower() });
}

function sendPets(b) {
  if (!canBreak(b)) {
    deny(b);
    return false;
  }
  b.skipUntil = 0;
  manualTarget = b;
  fx.burst(b.x, b.y + 0.3, b.z, '#ffd23a', 10, { speed: 4, up: 1, life: 0.4, size: 0.4 });
  audio.click();
  return true;
}

function handleTaps(taps) {
  for (const t of taps) {
    logEvent('input', { kind: 'tap', x: Math.round(t.x), y: Math.round(t.y) });
    let b = handAt(t.x, t.y);
    if (!b) {
      const ndc = new THREE.Vector2((t.x / window.innerWidth) * 2 - 1, -(t.y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const objs = breakables.list.filter((k) => k.alive && k.zone <= maxZone()).map((k) => k.g);
      const hits = raycaster.intersectObjects(objs, true);
      if (hits.length) {
        let o = hits[0].object;
        while (o.parent && !objs.includes(o)) o = o.parent;
        b = breakables.list.find((x) => x.g === o);
      }
    }
    if (!b) b = pickOnScreen(t.x, t.y);
    if (!b || !sendPets(b)) continue;
    if (playTime - lastTapHit > 0.15) {
      lastTapHit = playTime;
      breakables.damage(b, Math.max(2, Math.round(squad.totalPower() * 0.15)), false);
      logEvent('hit', { by: 'tap', target: b.type, hp: b.hp });
    }
    logEvent('input', { kind: 'sendPets', target: b.type });
    state.stats.sentPets = (state.stats.sentPets || 0) + 1;
  }
}

function autoTarget(reach) {
  const px = player.pos.x;
  const pz = player.pos.z;
  const z = maxZone();
  let t = null;
  if (state.hatched === 0) t = breakables.nearest(px, pz, reach, z, coinPile);
  if (!t) t = breakables.nearest(px, pz, reach, z, canPick);
  if (!t && stillT > 2) t = breakables.nearest(px, pz, 24, z, canPick);
  if (t) return t;
  let best = null;
  for (const b of breakables.list) {
    if (!b.alive || b.zone > z || b.type === 'diamond' || b.skipUntil > playTime || Math.hypot(b.x - px, b.z - pz) > 24) continue;
    if (!best || b.hp < best.hp) best = b;
  }
  return best;
}

const watch = { b: null, hp: 0, t: 0 };
function watchProgress(target) {
  if (!target || target !== watch.b || hatch.active || mode !== 'play') {
    watch.b = target;
    watch.hp = target ? target.hp : 0;
    watch.t = playTime;
    return target;
  }
  if (target.hp < watch.hp) {
    watch.hp = target.hp;
    watch.t = playTime;
    return target;
  }
  if (playTime - watch.t < 4) return target;
  target.skipUntil = playTime + 20;
  logEvent('stall', { target: target.type, hp: target.hp, manual: manualTarget === target });
  if (manualTarget === target) manualTarget = null;
  if (guidePile === target) guidePile = null;
  watch.b = null;
  return autoTarget(10 + state.up.magnet * 3);
}

let stillT = 0;
let clickHint = null;
let clickHintDone = false;
function walkIn(b, how) {
  if (manualTarget === b) return false;
  const busy = !!(currentTarget && currentTarget.alive && currentTarget !== b);
  if (!sendPets(b)) return false;
  logEvent('input', { kind: 'walkPile', how, target: b.type, busy });
  if (busy && !clickHintDone && (state.stats.sentPets || 0) < 1) {
    clickHintDone = true;
    clickHint = { b, until: time + 3.5 };
    logEvent('hint', { kind: 'clickPile' });
  }
  return true;
}

function actionPile() {
  const b = breakables.nearest(player.pos.x, player.pos.z, 3, maxZone(), canBreak) || breakables.nearest(player.pos.x, player.pos.z, 3, maxZone());
  if (!b) return false;
  walkIn(b, 'key');
  return true;
}

let lastIncomeT = 0;
let tapHintShown = 0;
const tapHand = document.getElementById('tapHand');
let handB = null;
const handPos = { x: 0, y: 0 };
function updateTapHint() {
  const free = mode === 'play' && !hatch.active && !ui.panel && !G.paused;
  if (clickHint && (!free || time > clickHint.until || !clickHint.b.alive || (state.stats.sentPets || 0) > 0)) clickHint = null;
  const idle = free && (state.stats.sentPets || 0) < 1 && playTime - lastIncomeT > 10 && !currentTarget;
  const b = clickHint ? clickHint.b : idle ? breakables.nearest(player.pos.x, player.pos.z, 45, maxZone(), canPick) : null;
  if (b) _proj.set(b.x, b.y + 1, b.z).project(camera);
  if (!b || _proj.z > 1 || Math.abs(_proj.x) > 0.95 || Math.abs(_proj.y) > 0.95) {
    tapHand.classList.add('hidden');
    handB = null;
    return;
  }
  if (!tapHintShown) logEvent('hint', { kind: 'tapHand' });
  tapHintShown = 1;
  handB = b;
  handPos.x = (_proj.x * 0.5 + 0.5) * window.innerWidth - 20;
  handPos.y = (-_proj.y * 0.5 + 0.5) * window.innerHeight - 10;
  tapHand.classList.remove('hidden');
  tapHand.style.transform = `translate(${handPos.x}px, ${handPos.y}px)`;
}

const HUD_SEL = ['#coinPill', '#gemPill', '#powerPill', '#goal', '.topright', '.side', '#prompt', '#keysHint'];
let hudRectCache = [];
function refreshHudRects() {
  hudRectCache = [];
  for (const sel of HUD_SEL) {
    const el = document.querySelector(sel);
    if (!el || el.closest('.hidden') || el.classList.contains('off')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 1) hudRectCache.push(r);
  }
  overlay.hudRects = hudRectCache;
}
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _pc = new THREE.Vector3();
const _pv = new THREE.Vector3();
function screenRect(pts) {
  let l = Infinity;
  let r = -Infinity;
  let t = Infinity;
  let b = -Infinity;
  for (const p of pts) {
    _pv.copy(p).project(camera);
    if (_pv.z > 1) return null;
    const x = (_pv.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_pv.y * 0.5 + 0.5) * window.innerHeight;
    l = Math.min(l, x);
    r = Math.max(r, x);
    t = Math.min(t, y);
    b = Math.max(b, y);
  }
  return { l, r, t, b };
}
function spriteRect(sprite) {
  sprite.getWorldPosition(_pc);
  const w = sprite.scale.x;
  const h = sprite.scale.y;
  const c = sprite.center;
  _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  _camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  return screenRect([
    _pc.clone().addScaledVector(_camRight, -c.x * w).addScaledVector(_camUp, -c.y * h),
    _pc.clone().addScaledVector(_camRight, (1 - c.x) * w).addScaledVector(_camUp, (1 - c.y) * h),
  ]);
}
function heroRect() {
  _camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  const p = player.pos;
  const rc = screenRect([p.clone().addScaledVector(_camRight, -1.1), p.clone().addScaledVector(_camRight, 1.1).setY(p.y + 2.8)]);
  if (rc) {
    rc.l -= 12;
    rc.r += 12;
    rc.t -= 12;
  }
  return rc;
}
const rectsMeet = (a, r, pad) => a.l < r.right + pad && a.r > r.left - pad && a.t < r.bottom + pad && a.b > r.top - pad;
function hudHits(rc, pad) {
  return hudRectCache.filter((r) => rectsMeet(rc, r, pad));
}
function placeClearOfHud(sprite, baseY, maxDrop) {
  sprite.position.y = baseY;
  const rc = spriteRect(sprite);
  if (!rc) return true;
  const hits = hudHits(rc, 8);
  if (!hits.length) return true;
  if (hits.some((r) => r.bottom > window.innerHeight * 0.3)) return false;
  const need = Math.max(...hits.map((r) => r.bottom + 8 - rc.t));
  sprite.position.y = baseY - 1;
  const rc1 = spriteRect(sprite);
  const perUnit = rc1 ? rc1.t - rc.t : 0;
  const drop = perUnit > 0.5 ? need / perUnit : Infinity;
  if (drop > maxDrop) {
    sprite.position.y = baseY;
    return false;
  }
  sprite.position.y = baseY - drop;
  const rc2 = spriteRect(sprite);
  return !!rc2 && !hudHits(rc2, 2).length;
}
function updateWorldLabels(dt) {
  const k = Math.min(1, dt * 10);
  for (const s of world.stands) {
    const ud = s.sign.userData;
    if (ud.baseY == null) ud.baseY = s.sign.position.y;
    const target = placeClearOfHud(s.sign, ud.baseY, 1.4) ? 1 : 0;
    s.sign.material.opacity = target ? s.sign.material.opacity + (1 - s.sign.material.opacity) * k : 0;
  }
  const hero = heroRect();
  for (const g of world.gates) {
    const rc = spriteRect(g.sign);
    const target = !rc ? 1 : hero && rectsMeet(rc, { left: hero.l, right: hero.r, top: hero.t, bottom: hero.b }, 0) || hudHits(rc, 0).length ? 0 : 1;
    g.hudFade = (g.hudFade ?? 1) + (target - (g.hudFade ?? 1)) * k;
  }
}

const _occ = [];
function heroOccluded() {
  const px = player.pos.x;
  const pz = player.pos.z;
  let ux = camera.position.x - px;
  let uz = camera.position.z - pz;
  const ul = Math.hypot(ux, uz) || 1;
  ux /= ul;
  uz /= ul;
  for (const c of world.grid.query(px, pz, 9, _occ)) {
    const vx = c.x - px;
    const vz = c.z - pz;
    const along = vx * ux + vz * uz;
    if (along < 0.4 || along > 9) continue;
    const r = c.data && c.data.breakable ? (c.data.breakable.alive ? c.r + 0.5 : -1) : Math.min(3, c.r * 2.8);
    if (Math.abs(vx * uz - vz * ux) < r) return true;
  }
  return false;
}

function petHit(pet, target) {
  const lvBefore = petLevel(pet.data.xp || 0);
  pet.data.xp = (pet.data.xp || 0) + 1;
  const lv = petLevel(pet.data.xp);
  if (lv > lvBefore) {
    pet.power = G.powerOf(pet.data);
    ui.setPower(squad.totalPower());
    fx.burst(pet.root.position.x, pet.root.position.y + 1, pet.root.position.z, '#4fe36a', 18, { speed: 3, up: 5, life: 0.9, size: 0.5 });
    overlay.number(pet.root.position.x, pet.root.position.y + 2.2, pet.root.position.z, '▲' + lv, 'level');
    audio.gem();
    logEvent('petLevel', { uid: pet.data.uid, level: lv, cat: 'reward' });
  }
  breakables.damage(target, pet.power, pet.glowRarity >= 4);
  logEvent('hit', { by: 'pet', dmg: pet.power, target: target.type, hp: target.hp });
  fx.burst(pet.root.position.x, pet.root.position.y + 0.8, pet.root.position.z, RARITIES[pet.glowRarity].color, 3, { speed: 2, up: 2, life: 0.3, size: 0.3 });
}

function update(dt) {
  time += dt;
  const active = mode === 'play' && !G.paused;
  const inp = input.enabled && active ? input.consume() : (input.consume(), { dx: 0, dy: 0, zoom: 0, taps: [], jump: false });
  if (mode !== 'play') {
    const a = time * 0.07 + 0.6;
    camera.position.set(PLAZA.x + Math.sin(a) * 30, 15 + Math.sin(time * 0.2) * 2, PLAZA.z + Math.cos(a) * 30);
    camera.lookAt(PLAZA.x, 2, PLAZA.z);
  }
  if (G.paused) {
    world.sky.position.copy(camera.position);
    return;
  }
  if (active) playTime += dt;
  eventGameT = playTime;
  let sim = dt;
  if (hitstop > 0) {
    hitstop -= dt;
    sim = dt * 0.1;
  }
  const inputProxy = {
    axis: () => (input.enabled && active && !hatch.active ? input.axis() : { x: 0, y: 0 }),
    consumeJump: inp.jump,
  };
  if (inp.jump) {
    audio.jump();
    logEvent('input', { kind: 'jump' });
  }
  const pres = player.update(sim, inputProxy, rig.yaw, world, 1 + state.up.walk * 0.15, breakables, maxZone());
  if (pres.moving) moveTime += dt;
  const punchDmg = Math.max(3, Math.round(squad.totalPower() * 0.25));
  handleTaps(inp.taps);
  if (active && !hatch.active) {
    const hb = pres.hitTarget;
    if (hb && hb.alive) {
      if (canBreak(hb)) {
        walkIn(hb, 'walk');
        if (player.punch()) {
          breakables.damage(hb, punchDmg, false);
          logEvent('hit', { by: 'player', dmg: punchDmg, target: hb.type, hp: hb.hp });
        }
      } else deny(hb);
    }
    if (inp.jump) {
      const b = breakables.nearest(player.pos.x, player.pos.z, 3, maxZone(), canBreak) || breakables.nearest(player.pos.x, player.pos.z, 3, maxZone());
      if (b) walkIn(b, 'space');
    }
  }
  stillT = pres.moving ? 0 : stillT + dt;
  if (manualTarget && (!manualTarget.alive || !canBreak(manualTarget) || Math.hypot(manualTarget.x - player.pos.x, manualTarget.z - player.pos.z) > 26)) manualTarget = null;
  let target = manualTarget;
  if (!target && mode === 'play' && guidePile && guidePile.alive && canPick(guidePile) && Math.hypot(guidePile.x - player.pos.x, guidePile.z - player.pos.z) < 4.5) target = guidePile;
  if (!target && mode === 'play') {
    const magnet = state.up.magnet * 3;
    const keep = stillT > 2 ? 26 : 14 + magnet;
    if (currentTarget && currentTarget.alive && canPick(currentTarget) && Math.hypot(currentTarget.x - player.pos.x, currentTarget.z - player.pos.z) < keep) target = currentTarget;
    else target = autoTarget(10 + magnet);
  }
  target = watchProgress(target);
  if (currentTarget !== target) {
    if (currentTarget) currentTarget.attackers = 0;
    currentTarget = target;
  }
  if (target) target.attackers = squad.pets.length;
  updateGrind(dt, target);
  targetRing.visible = !!(target && target.alive);
  if (targetRing.visible) {
    targetRing.position.set(target.x, target.y + 0.12, target.z);
    const s = target.r + 0.4 + Math.sin(time * 6) * 0.08;
    targetRing.scale.setScalar(s);
    if (manualTarget || (grind.on && grind.b === target)) {
      targetRing.material.color.setRGB(2.4, 1.6, 0.2);
      targetRing.scale.setScalar(s + 0.25);
    } else targetRing.material.color.setRGB(0.42, 0.42, 0.42);
  }
  const petSpeed = 1 + state.up.petSpeed * 0.2;
  squad.update(sim, time, player.pos, player.facing, target, petSpeed, (pet) => {
    if (target && target.alive) petHit(pet, target);
  });
  const focusX = mode === 'play' ? player.pos.x : PLAZA.x;
  world.setFocusZone(zoneAt(focusX));
  breakables.picked = manualTarget || (grind.on ? grind.b : null);
  const bars = breakables.update(sim, time, player.pos, maxZone(), focusX);
  overlay.update(dt, bars);
  drops.update(sim, player.pos, 8, heightAt);
  fx.update(sim);
  world.update(dt, time, mode === 'play' ? camera.position : null, player.pos);
  pendingT -= dt;
  if (pendingCoins > 0 && pendingT <= 0) {
    overlay.add('coin', player.pos.x, player.pos.y + 2.8, player.pos.z, pendingCoins, 'coin', '+');
    pendingCoins = 0;
    pendingT = 0.35;
  }
  if (mode === 'play') {
    rig.occluded = heroOccluded();
    if (player.ghost) player.ghost.visible = rig.occluded;
    rig.update(dt, inp, player.pos);
  }
  world.sky.position.copy(camera.position);
  camera.getWorldDirection(tmpV).setY(0);
  if (tmpV.lengthSq() > 1e-4) tmpV.normalize().multiplyScalar(10).add(player.pos);
  else tmpV.copy(player.pos);
  sun.target.position.copy(tmpV);
  sun.position.copy(tmpV).addScaledVector(sunDir, 70);
  world.applyAmbience(mode === 'play' ? player.pos.x : PLAZA.x, dt, lights, scene, renderer);
  const z = zoneAt(player.pos.x);
  if (z !== lastZone) {
    if (lastZone >= 0 && mode === 'play') ui.banner(ZONES[z].name);
    lastZone = z;
    audio.setZone(z);
  }
  ui.setCurrency(state.coins, state.gems);
  ui.updateFly(dt);
  slowT -= dt;
  const coinsNow = Math.floor(state.coins);
  if (slowT > 0 && coinsNow !== goalCoins) {
    goalCoins = coinsNow;
    const goal = nextGoal();
    ui.goal(goal.ic, goal.text, goal.cur, goal.max, goal.num);
    G.goal = goal;
  }
  if (slowT <= 0) {
    slowT = 0.2;
    goalCoins = coinsNow;
    checkPrompts();
    const goal = nextGoal();
    ui.goal(goal.ic, goal.text, goal.cur, goal.max, goal.num);
    G.goal = goal;
    if (goal.key !== lastGoalKey) {
      lastGoalKey = goal.key;
      logEvent('goal', { key: goal.key, cost: goal.max, rate: Math.round(incomeRate() * 10) / 10 });
    }
    world.updateGateProgress(state.zones, state.coins);
    refreshHudRects();
    const kh = document.getElementById('keysHint');
    if (mode === 'play' && (moveTime > 25 || playTime > 90) && !kh.classList.contains('off')) {
      kh.classList.add('off');
      state.settings.hintDone = true;
      dirty = true;
    }
    const near = !!ui.promptKey;
    kh.classList.toggle('has-e', near);
    document.getElementById('khE').classList.toggle('hidden', !near);
    const eIcon = ui.promptKey.startsWith('gate') ? 'gate' : 'egg';
    if (near && eIcon !== khEIcon.dataset.icon) {
      khEIcon.dataset.icon = eIcon;
      khEIcon.innerHTML = ICONS[eIcon];
    }
  }
  if (G.goal && mode === 'play' && !hatch.active) updateGuide(dt, G.goal);
  else {
    arrowMesh.visible = false;
    goalPointer.classList.add('hidden');
  }
  if (hatch.active) targetRing.visible = false;
  updateTapHint();
  if (mode === 'play') updateWorldLabels(dt);
  if (fountainT(dt)) {
    const fp = world.fountainPos;
    fx.solid.spawn({ x: fp.x + (Math.random() - 0.5) * 0.3, y: fp.y, z: fp.z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 2.4, vy: 4 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2.4, g: 9, life: 0.9, s0: 0.35, s1: 0.2, r: 0.75, gg: 0.92, b: 1, a: 0.8 });
  }
  hatchPass.enabled = hatch.update(dt);
  hatchBgPass.enabled = hatchPass.enabled;
  saveT += dt;
  if ((dirty && saveT > 3) || saveT > 15) {
    saveT = 0;
    save('auto');
  }
}

let fAcc = 0;
function fountainT(dt) {
  fAcc += dt;
  if (Math.hypot(player.pos.x - PLAZA.x, player.pos.z - PLAZA.z) > 60 && mode === 'play') return false;
  if (fAcc > 0.03) {
    fAcc = 0;
    return true;
  }
  return false;
}

const SIM_STEPS = Math.max(1, Math.min(4, Math.floor(Number(dbgVal('speed')) || 1)));
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fps = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  fpsAcc += raw;
  fpsN++;
  if (fpsAcc > 1) {
    fps = Math.round(fpsN / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
  }
  if (mode === 'play' && !G.paused && !hatch.active && raw < 0.5) {
    perf.samples.push(raw * 1000);
    perf.windowT += raw;
    if (perf.windowT >= 3) {
      const sorted = perf.samples.slice().sort((a, b) => a - b);
      perf.median = Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10;
      perf.p99 = Math.round(sorted[Math.floor(sorted.length * 0.99)] * 10) / 10;
      perf.samples.length = 0;
      perf.windowT = 0;
      const slow = sorted.filter((x) => x > 20).length / sorted.length;
      if ((perf.median > 25 || slow > 0.2) && quality === 'high' && autoStep < 3 && playTime > 5 && !dbg('hq')) {
        autoStep++;
        perf.steps.push({ t: Math.round(performance.now()), step: autoStep, median: perf.median, slow: Math.round(slow * 100) });
        logEvent('quality', { step: autoStep, median: perf.median, slow: Math.round(slow * 100) });
        applyQuality();
      }
    }
  }
  if (mode === 'loading') {
    if (raw > 0.25) perf.loadGaps.push({ ms: Math.round(raw * 1000), after: events.length ? (events[events.length - 1].data.phase || events[events.length - 1].type) + (events[events.length - 1].data.p ? events[events.length - 1].data.p.toFixed(2) : '') : '' });
    return;
  }
  const t0 = performance.now();
  for (let i = 0; i < SIM_STEPS; i++) update(dt);
  const t1 = performance.now();
  composer.render();
  const t2 = performance.now();
  perf.cpuUpdate += (t1 - t0 - perf.cpuUpdate) * 0.05;
  perf.cpuRender += (t2 - t1 - perf.cpuRender) * 0.05;
}

let wantStart = false;
function startGame() {
  if (mode === 'loading') {
    wantStart = true;
    audio.start();
    document.getElementById('playBtn').classList.add('waiting');
    return;
  }
  if (mode !== 'title') return;
  audio.start();
  audio.setMusic(state.settings.music);
  audio.setSfx(state.settings.sfx);
  mode = 'play';
  logEvent('input', { kind: 'play' });
  const st = document.getElementById('start');
  st.classList.add('fade');
  setTimeout(() => st.classList.add('hidden'), 500);
  document.getElementById('hud').classList.remove('hidden');
  rig.yaw = 0;
  rig.target.copy(player.pos);
  lastZone = zoneAt(player.pos.x);
  ui.banner(ZONES[lastZone].name, '');
  if (input.touchMode || 'ontouchstart' in window) document.getElementById('jumpBtn').classList.remove('hidden');
  updateMuteIcon();
  if (state.settings.hintDone) document.getElementById('keysHint').classList.add('off');
  const hv = dbgVal('hatch');
  if (hv) {
    const map = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
    const r = map[hv] ?? 4;
    const kind = r === 5 ? 5 : Math.min(maxZone(), 5);
    setTimeout(() => G.openEgg(kind, r), 300);
  }
  if (dbg('inv')) setTimeout(() => ui.open('pets'), 300);
  if (dbg('shop')) setTimeout(() => ui.open('shop'), 300);
  if (dbg('index')) setTimeout(() => ui.open('index'), 300);
}

document.getElementById('jumpBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.jump = true;
});

Object.defineProperty(window, '__debug', {
  get() {
    return {
      mode,
      paused: G.paused,
      coins: Math.floor(state.coins),
      gems: state.gems,
      pets: state.pets.length,
      equipped: state.equipped.length,
      power: squad.totalPower(),
      zones: state.zones,
      zone: zoneAt(player.pos.x) + 1,
      player: { x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2) },
      target: currentTarget ? { type: currentTarget.type, hp: currentTarget.hp, maxHp: currentTarget.maxHp } : null,
      broken: state.stats.broken,
      hatched: state.hatched,
      hatchActive: hatch.active,
      fps,
      drops: drops.coins.length,
      calls: renderer.info.render.calls,
      programs: renderer.info.programs ? renderer.info.programs.length : 0,
      programNames: dbg('progs') ? renderer.info.programs.map((p) => p.name + '|' + p.cacheKey.slice(0, 160)) : null,
      frameMedianMs: perf.median,
      frameP99Ms: perf.p99,
      qualityStep: autoStep,
      cpuUpdateMs: +perf.cpuUpdate.toFixed(2),
      cpuRenderMs: +perf.cpuRender.toFixed(2),
      loadGaps: perf.loadGaps,
    };
  },
});

const v3 = (v) => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) });
window.__game = Object.freeze({
  get state() {
    return mode === 'play' ? (G.paused ? 'paused' : hatch.active ? 'hatch' : ui.panel ? 'menu:' + ui.panel : 'play') : mode;
  },
  get player() {
    return { pos: v3(player.pos), vel: v3(player.vel), grounded: player.grounded, state: player.animName, facing: +player.facing.toFixed(3) };
  },
  get camera() {
    return { pos: v3(camera.position), target: v3(rig.target), fov: camera.fov };
  },
  get zone() {
    return zoneAt(player.pos.x) + 1;
  },
  get zonesUnlocked() {
    return state.zones;
  },
  get coins() {
    return Math.floor(state.coins);
  },
  get gems() {
    return state.gems;
  },
  get pets() {
    return state.pets.map((p) => ({ uid: p.uid, sp: p.sp, v: p.v, level: petLevel(p.xp), power: G.powerOf(p) }));
  },
  get equipped() {
    return state.equipped.slice();
  },
  get progress() {
    const g = nextGoal();
    return { goal: g.text, cur: Math.floor(g.cur), max: g.max, hatched: state.hatched, broken: state.stats.broken, rebirths: state.rebirths || 0, collection: Object.keys(state.seen).length };
  },
  get checkpoint() {
    return { zone: state.zones };
  },
  get target() {
    return currentTarget ? { type: currentTarget.type, hp: currentTarget.hp, maxHp: currentTarget.maxHp, pos: { x: currentTarget.x, z: currentTarget.z } } : null;
  },
  get prompt() {
    return ui.promptKey || null;
  },
  events,
});

window.__test = {
  hitNearest() {
    const b = breakables.nearest(player.pos.x, player.pos.z, 60, maxZone());
    if (!b) return null;
    const before = b.hp;
    breakables.damage(b, 5, false);
    return { type: b.type, before, after: b.hp };
  },
  breakNearest() {
    const b = breakables.nearest(player.pos.x, player.pos.z, 60, maxZone());
    if (!b) return null;
    breakables.damage(b, b.hp, true);
    return { type: b.type, coins: b.coins };
  },
  teleport(x, z) {
    player.pos.set(x, 0, z);
    rig.target.set(x, heightAt(x, z), z);
  },
  openEgg(k) {
    G.openEgg(k);
    return state.pets.length;
  },
  finishHatch() {
    hatch.t = 99;
    hatch.finish();
    return state.pets.length;
  },
  gapStart(ms) {
    const rec = { gaps: [], t0: performance.now(), last: 0 };
    window.__gapRec = rec;
    const f = (n) => {
      if (rec.last) rec.gaps.push(Math.round((n - rec.last) * 10) / 10);
      rec.last = n;
      if (n - rec.t0 < ms) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    return true;
  },
  gapResult() {
    const g = (window.__gapRec || { gaps: [] }).gaps.slice().sort((a, b) => a - b);
    return { n: g.length, max: g[g.length - 1], median: g[Math.floor(g.length / 2)], over100: g.filter((x) => x > 100).length };
  },
  goal() {
    const g = nextGoal();
    return { key: g.key, cur: Math.floor(g.cur), max: g.max, mult: G.coinMult(), arrow: arrowMesh.visible, pointer: !goalPointer.classList.contains('hidden'), rate: Math.round(incomeRate() * 10) / 10, shopHint: !shopHint.classList.contains('hidden'), pile: guidePile && guidePile.alive ? { type: guidePile.type, x: +guidePile.x.toFixed(2), z: +guidePile.z.toFixed(2) } : null };
  },
  guide() {
    const a = guideAim;
    const ptr = !goalPointer.classList.contains('hidden');
    const m = ptr ? /rotate\(([-\d.e]+)rad\)/.exec(goalPointerRot.style.transform) : null;
    const hand = tapHand.classList.contains('hidden') ? null : tapHand.getBoundingClientRect();
    return {
      arrow: arrowMesh.visible,
      at: a ? toScreen(a.x, a.y - 1, a.z) : null,
      aim: a ? { x: a.x, z: a.z } : null,
      hero: toScreen(player.pos.x, player.pos.y + 1, player.pos.z),
      playTime,
      ang: m ? Number(m[1]) : null,
      hand: hand ? { x: hand.left + hand.width / 2, y: hand.top + hand.height / 2, tipX: hand.left + 20, tipY: hand.top + 10 } : null,
    };
  },
  breakables() {
    return breakables.list.filter((b) => b.alive && b.zone <= maxZone()).map((b) => ({ type: b.type, x: +b.x.toFixed(2), z: +b.z.toFixed(2), hp: b.hp, maxHp: b.maxHp, coins: b.coins }));
  },
  screenOf(x, z) {
    const b = breakables.list.find((k) => k.alive && Math.abs(k.x - x) < 0.01 && Math.abs(k.z - z) < 0.01);
    return b ? toScreen(b.x, b.y + 1, b.z) : null;
  },
  overlaps() {
    const sels = ['#coinPill', '#gemPill', '#powerPill', '#goal', '#btnPets', '#btnShop', '#btnIndex', '#btnSettings', '#btnMute', '#btnPause', '#jumpBtn', '#keysHint', '#prompt'];
    const boxes = [];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || el.closest('.hidden')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      boxes.push({ sel, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }
    const hits = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) hits.push(a.sel + '|' + b.sel);
      }
    }
    const offscreen = boxes.filter((b) => b.x < 0 || b.y < 0 || b.x + b.w > window.innerWidth || b.y + b.h > window.innerHeight).map((b) => b.sel);
    return { n: boxes.length, hits, offscreen, boxes };
  },
  cam(yaw, pitch, dist) {
    rig.yaw = yaw;
    rig.pitch = pitch;
    rig.dist = dist;
    return true;
  },
  petBox(sp) {
    const o = createPetObject(sp, 0);
    o.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o.root);
    const out = [];
    o.root.traverse((m) => {
      if (m.isMesh) out.push([m.type, m.scale.x, m.geometry.boundingBox ? m.geometry.boundingBox.max.y : null, m.morphTargetInfluences ? m.morphTargetInfluences.length : 0]);
    });
    return { min: b.min, max: b.max, meshes: out };
  },
  labels() {
    const r = (o) => o && { l: Math.round(o.l), r: Math.round(o.r), t: Math.round(o.t), b: Math.round(o.b) };
    return {
      hero: r(heroRect()),
      arrow: arrowMesh.visible ? r(spriteRect(arrowMesh)) : null,
      gates: world.gates.map((g) => ({ i: g.i, op: +g.sign.material.opacity.toFixed(2), rect: r(spriteRect(g.sign)) })),
      stands: world.stands.map((s) => ({ kind: s.kind, op: +s.sign.material.opacity.toFixed(2), rect: r(spriteRect(s.sign)) })),
      hud: hudRectCache.map((h) => ({ l: Math.round(h.left), r: Math.round(h.right), t: Math.round(h.top), b: Math.round(h.bottom) })),
    };
  },
  gfx() {
    return { THREE, renderer, composer, bloom, sun, scene, camera, rt, world, squad, breakables, fx, overlay, player, setMatteEnv, setStep: (s) => { autoStep = s; applyQuality(); } };
  },
  give(c, g) {
    state.coins += c;
    state.gems += g || 0;
    return state.coins;
  },
  ui,
};

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

async function boot() {
  logEvent('boot', { phase: 'start' });
  const fill = document.getElementById('loadFill');
  let wp = 0;
  let p1 = 0;
  let p2 = 0;
  const upd = () => (fill.style.width = Math.min(100, (wp * 0.7 + p1 * 0.12 + p2 * 0.12) * 100).toFixed(0) + '%');
  const models = Promise.all([
    player.load().then(() => {
      p1 = 1;
      upd();
    }),
  ]);
  p2 = 1;
  resize();
  applyQuality();
  await tick();
  if (dbg('dumpenv')) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const src = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 64 });
    const w = src.width;
    const h = src.height;
    const frt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
    const qs = new THREE.Scene();
    qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: src.texture, toneMapped: false })));
    const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    oc.position.z = 0.5;
    renderer.setRenderTarget(frt);
    renderer.render(qs, oc);
    const f = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(frt, 0, 0, w, h, f);
    renderer.setRenderTarget(null);
    const u = new Uint16Array(f.length);
    for (let i = 0; i < f.length; i++) u[i] = THREE.DataUtils.toHalfFloat(f[i]);
    const bytes = new Uint8Array(u.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    window.__envDump = { w, h, b64: btoa(bin) };
  }
  try {
    const res = await fetch('env.bin');
    const buf = await res.arrayBuffer();
    const tex = new THREE.DataTexture(new Uint16Array(buf), 336, 256, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.CubeUVReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    envTex = tex;
  } catch (e) {
    logEvent('envFail', { msg: String(e) });
  }
  scene.environment = envTex;
  hatch.scene.environment = envTex;
  logEvent('boot', { phase: 'env' });
  await tick();
  await world.buildAsync(async (p) => {
    wp = p;
    upd();
    logEvent('boot', { phase: 'world', p });
    await tick();
  });
  await breakables.populateAll(async (z) => {
    wp = 0.58 + ((z + 1) / 6) * 0.3;
    upd();
    await tick();
  });
  logEvent('boot', { phase: 'breakables' });
  breakables.spawnAt('coins', -15, 20.5);
  breakables.spawnAt('coins', -4.5, 20.5);
  breakables.spawnAt('gift', -10, 23);
  await models;
  logEvent('boot', { phase: 'models' });
  applyDebug();
  player.pos.y = heightAt(player.pos.x, player.pos.z);
  syncSquad();
  for (const p of squad.pets) p.place(tmpV.set(player.pos.x + (Math.random() - 0.5) * 3, 0, player.pos.z + 2 + Math.random() * 2));
  world.applyAmbience(PLAZA.x, -1, lights, scene, renderer);
  wp = 0.95;
  upd();
  await tick();
  setPetThumbRenderer(renderer, envTex);
  logEvent('boot', { phase: 'thumbs' });
  drops.spawn('coin', player.pos.x, player.pos.y, player.pos.z, 0, 1);
  drops.spawn('gem', player.pos.x, player.pos.y, player.pos.z, 0, 1);
  drops.update(0.016, player.pos, 0, heightAt);
  fx.burst(player.pos.x, player.pos.y + 1, player.pos.z, '#ffffff', 2, {});
  fx.burst(player.pos.x, player.pos.y + 1, player.pos.z, '#ffffff', 2, { solid: true });
  fx.update(0.016);
  targetRing.visible = true;
  arrowMesh.visible = true;
  world.zoneMeshes.forEach((list) => list && list.forEach((m) => (m.visible = true)));
  world.focusZone = -1;
  const warmRT = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType });
  const parallel = !!renderer.getContext().getExtension('KHR_parallel_shader_compile');
  logEvent('boot', { phase: parallel ? 'parallel' : 'serial' });
  const warmPass = async (sc, cam) => {
    if (parallel) {
      for (const k of sc.children.slice()) {
        if (k.isLight) continue;
        const prevCull = [];
        k.traverse((o) => {
          if (o.frustumCulled) {
            prevCull.push(o);
            o.frustumCulled = false;
          }
        });
        renderer.setRenderTarget(warmRT);
        const job = renderer.compileAsync(k, cam, sc);
        renderer.setRenderTarget(null);
        await job;
        prevCull.forEach((o) => (o.frustumCulled = true));
      }
    }
    const kids = sc.children.slice();
    const vis = kids.map((k) => k.visible);
    const culled = [];
    sc.traverse((o) => {
      if (o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
    });
    kids.forEach((k) => {
      if (!k.isLight) k.visible = false;
    });
    renderer.setRenderTarget(warmRT);
    let t0 = performance.now();
    for (let i = 0; i < kids.length; i++) {
      if (!vis[i] || kids[i].isLight) continue;
      kids[i].visible = true;
      renderer.render(sc, cam);
      kids[i].visible = false;
      if (performance.now() - t0 > 200) {
        renderer.setRenderTarget(null);
        await tick();
        renderer.setRenderTarget(warmRT);
        t0 = performance.now();
      }
    }
    renderer.setRenderTarget(null);
    kids.forEach((k, i) => (k.visible = vis[i]));
    culled.forEach((o) => (o.frustumCulled = true));
  };
  normalizeMaterials(scene);
  normalizeMaterials(hatch.scene);
  dropEnvOnMatte(scene);
  const warmPets = [['kedi', 0], ['kedi', 1], ['kedi', 2], ['kristalKedi', 0], ['ormanEjder', 1], ['papagan', 0]];
  const warmGroupMain = new THREE.Group();
  const warmGroupHatch = new THREE.Group();
  const warmList = [];
  for (const [sp, v] of warmPets) {
    const a = createPetObject(sp, v).root;
    const h = createPetObject(sp, v).root;
    a.position.copy(player.pos);
    scene.add(a);
    hatch.scene.add(h);
    warmList.push([a, h]);
  }
  const warmEgg = new THREE.Mesh(getEggGeometry(), makeEggMaterial(EGGS[0].colors, 1, false));
  warmGroupHatch.add(warmEgg);
  warmGroupMain.position.copy(player.pos);
  scene.add(warmGroupMain);
  hatch.scene.add(warmGroupHatch);
  hatch.fx.burst(0, 1, 0, '#ffffff', 2, {});
  hatch.fx.burst(0, 1, 0, '#ffffff', 2, { solid: true });
  hatch.fx.update(0.016);
  await warmPass(scene, camera);
  await warmPass(hatch.scene, hatch.camera);
  scene.remove(warmGroupMain);
  hatch.scene.remove(warmGroupHatch);
  for (const [a, h] of warmList) {
    scene.remove(a);
    hatch.scene.remove(h);
  }
  await warmPass(hatch.bgScene, hatch.camera);
  warmRT.dispose();
  logEvent('boot', { phase: 'compiled' });
  camera.position.set(player.pos.x, player.pos.y + 14, player.pos.z + 16);
  camera.lookAt(player.pos);
  composer.render();
  drops.coins.length = 0;
  drops.gems.length = 0;
  drops.update(0.016, player.pos, 0, heightAt);
  targetRing.visible = false;
  arrowMesh.visible = false;
  await tick();
  logEvent('boot', { phase: 'warm' });
  await tick();
  wp = 1;
  upd();
  mode = 'title';
  logEvent('ready', { ms: Math.round(performance.now()) });
  document.getElementById('loadWrap').classList.add('hidden');
  if (wantStart) startGame();
}

document.getElementById('playBtn').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if ((mode === 'title' || mode === 'loading') && (e.code === 'Enter' || e.code === 'Space')) startGame();
});

requestAnimationFrame(loop);
await boot();
