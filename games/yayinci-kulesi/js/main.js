import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CREATORS, CREATOR_BY_ID, RARITIES, THEMES, DESKS_PER_FLOOR, VIRAL_MULT, VIRAL_TIME, VIRAL_MIN, VIRAL_MAX, OFFLINE_CAP, OFFLINE_RATE, START_MONEY, REBIRTH_START_MONEY, RESTOCK_TIME, makeStock, UNDO_TIME, SELL_HOLD, MAX_REBIRTHS, floorsFor, multiplier, rebirthCost, totalMult, sellPrice, newTierAt, tierUnlocked, fmt, fmtMult, pagesComplete } from './data.js';
import { H, ROOM, ELEV, SHOP, SPAWN, WORLD, STATIONS, ST_BOX, PAD_OFF, FRONT_DOOR, stationLocal, insideRoom, insideCabin, inTower, wallBoxes, OUTDOOR_BOXES } from './layout.js';
import { makeSky, makeGround, Shop, TowerExtras, Elevator } from './world.js';
import { Floor } from './floors.js';
import { Creator } from './chars.js';
import { Player, CameraRig } from './player.js';
import { Particles, CoinFlyers, Overlay } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { ICONS } from './icons.js';
import { Thumbs } from './thumbs.js';
import { loadState, saveState, defaultState } from './save.js';
import { ringTex, beamTex, glowTex } from './textures.js';
import { clamp, damp, easeInOut, easeOutBack, lerp } from './util.js';
import { vcGlow } from './geo.js';

const params = new URLSearchParams(location.search);
const debug = (params.get('debug') || '').split(',').filter(Boolean);
const dbgOn = debug.length > 0;
const dbg = (k) => debug.find((d) => d === k || d.startsWith(k + ':'));
const dbgVal = (k) => {
  const d = dbg(k);
  return d && d.includes(':') ? d.split(':').slice(1).join(':') : null;
};

const events = [];
function log(type, data) {
  events.push({ t: Math.round(performance.now()), type, data: data || {} });
  if (events.length > 2000) events.splice(0, events.length - 2000);
}
log('boot', { phase: 'module' });

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.info.autoReset = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#ffe2c4');
scene.fog = new THREE.Fog('#dcecff', 140, 520);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 2000);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
let glLost = false;
const glBtn = document.getElementById('glLost');
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  glLost = true;
  glBtn.classList.remove('hidden');
  log('gl', { phase: 'lost' });
});
canvas.addEventListener('webglcontextrestored', () => {
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  glLost = false;
  glBtn.classList.add('hidden');
  lastNow = performance.now();
  log('gl', { phase: 'restored' });
});
glBtn.addEventListener('click', () => {
  if (mode === 'play') doSave();
  location.reload();
});

const hemi = new THREE.HemisphereLight('#bcd8ff', '#6a5a4a', 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd9a8', 2.6);
const SUN_OFF = new THREE.Vector3(18, 34, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -26;
sc.right = 26;
sc.top = 26;
sc.bottom = -26;
sc.near = 1;
sc.far = 120;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#7fa8ff', 0.8);
fill.position.set(-30, 20, -20);
scene.add(fill);

makeSky(scene);
makeGround(scene);
const shop = new Shop(scene);
const tower = new THREE.Group();
scene.add(tower);
const extras = new TowerExtras(scene);
const elevator = new Elevator(scene);
const particles = new Particles(scene);
const flyers = new CoinFlyers(scene);
const overlay = new Overlay(document.getElementById('labels'), camera);
const audio = new Audio();
const rig = new CameraRig(camera);
const player = new Player(scene, audio);

const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.42, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);

let quality = dbgVal('quality') === 'low' ? 'low' : 'high';
function applyQuality() {
  const pr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  bloom.enabled = quality === 'high';
  fxaa.enabled = quality !== 'high';
  const samples = quality === 'high' ? 4 : 0;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) {
    if (t.samples !== samples) {
      t.samples = samples;
      t.dispose();
    }
  }
  const ms = quality === 'high' ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== ms) {
    sun.shadow.mapSize.set(ms, ms);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  resize();
}
function resize() {
  const w = innerWidth;
  const h = innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 66 : 58;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  fxaa.material.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
  particles.setScale(h * renderer.getPixelRatio(), camera.fov);
  overlay.resize();
}
addEventListener('resize', resize);

const loaded = loadState();
let state = loaded.state;
const saveAllowed = !dbgOn || !!dbg('save');
if (dbgOn && !dbg('save')) state = defaultState();
state.money = state.money ?? START_MONEY;

const G = {
  paused: false,
  modal: false,
  onModal(open) {
    G.modal = open;
    if (open) input.clear();
    log('input', { kind: open ? 'modalOpen' : 'modalClose' });
  },
};
const ui = new UI(G);
const input = new Input(canvas, document.getElementById('joy'), log);
let thumbs = null;
const thumb = (def) => (thumbs ? thumbs.get(def) : '');

const floors = [];
const deskRT = [];
const walkers = [];
const waitRT = [];
let curFloor = 0;
let mode = 'loading';
let time = 0;
let shopArmed = true;
let restockLeft = RESTOCK_TIME;
let coinFlyT = 0;
let viralT = 25 + Math.random() * 20;
let forceTier = -1;
let forceAt = 0;
let displayMoney = state.money;
let lastBuyAt = -1e9;
let saveT = 0;
let elev = null;
let sold = null;
let sellCtx = { desk: -1, since: 0 };
let promptShownAt = 0;
let promptKey = '';
let holdT = 0;
let holdValid = false;
let lastInputT = 0;
let cine = null;
let perSecond = 0;
let pendingIncome = 0;
let viralOn = false;
let studioGuideUntil = -1;
const STUDIO_GUIDE_TIME = 8;
const frameTimes = [];
let qualityChecked = false;
let playT = 0;
const tmpV = new THREE.Vector3();
const ray = new THREE.Raycaster();

function mult() {
  return totalMult(state.rebirths, state.owned);
}

function floorCount() {
  return floorsFor(state.rebirths);
}

function ensureFloors() {
  const n = floorCount();
  while (floors.length < n) {
    const f = new Floor(floors.length, tower);
    floors.push(f);
  }
  while (state.desks.length < n * DESKS_PER_FLOOR) state.desks.push(null);
  while (deskRT.length < n * DESKS_PER_FLOOR) deskRT.push({ creator: null, viral: 0, arriving: false, sub: 0 });
  extras.setFloors(n);
  elevator.setFloors(n);
  for (const f of floors) {
    f.bulk.visible = false;
    f.pads.visible = false;
    f.padGlow.visible = false;
    f.coins.visible = false;
  }
}

function rarityColor(r) {
  return r.rainbow ? '#ff4fa8' : r.color;
}

function placeCreator(i, def, fxOn) {
  const f = Math.floor(i / DESKS_PER_FLOOR);
  const s = i % DESKS_PER_FLOOR;
  const fl = floors[f];
  const rt = deskRT[i];
  if (rt.creator) rt.creator.dispose();
  const c = new Creator(def);
  c.root.position.set(0, 0, -0.15);
  c.root.scale.setScalar(1.3);
  c.setMode('film');
  fl.slotGroups[s].add(c.root);
  rt.creator = c;
  rt.arriving = false;
  fl.setRim(s, rarityColor(RARITIES[def.r]));
  const d = state.desks[i];
  fl.atlas.set(s, def.id, d ? d.subs : 0, 0);
  fl.atlas.draw(s, time);
  fl.atlas.tex.needsUpdate = true;
  if (fxOn) {
    const p = stationLocal(STATIONS[s], 0, 0);
    const y = f * H;
    particles.burst(p.x, y + 1.2, p.z, { count: 40, colors: [rarityColor(RARITIES[def.r]), '#ffffff'], speed: 6, life: 0.9 });
    particles.ring(p.x, y + 0.3, p.z, rarityColor(RARITIES[def.r]), 28, 5);
    c.cheer(1.0);
    audio.pop();
  }
}

function clearDesk(i) {
  const f = Math.floor(i / DESKS_PER_FLOOR);
  const s = i % DESKS_PER_FLOOR;
  const rt = deskRT[i];
  if (rt.creator) rt.creator.dispose();
  rt.creator = null;
  rt.viral = 0;
  rt.arriving = false;
  floors[f].setRim(s, '#5b6478');
  floors[f].atlas.set(s, null, 0, 0);
  floors[f].atlas.draw(s, time);
  floors[f].atlas.tex.needsUpdate = true;
}

function rebuildDesks() {
  for (let i = 0; i < state.desks.length; i++) {
    const d = state.desks[i];
    if (d && CREATOR_BY_ID[d.id]) placeCreator(i, CREATOR_BY_ID[d.id], false);
    else {
      state.desks[i] = null;
      clearDesk(i);
    }
  }
}

function firstFreeDesk() {
  for (let i = 0; i < state.desks.length; i++) if (!state.desks[i]) return i;
  return -1;
}

function swapOutThumb(def) {
  if (firstFreeDesk() >= 0) return null;
  const w = weakestDesk();
  if (w < 0 || def.inc <= CREATOR_BY_ID[state.desks[w].id].inc) return null;
  return thumb(CREATOR_BY_ID[state.desks[w].id]) || null;
}

function blockedBuy(def) {
  if (firstFreeDesk() >= 0) return false;
  const w = weakestDesk();
  return w < 0 || def.inc <= CREATOR_BY_ID[state.desks[w].id].inc;
}

function weakestDesk() {
  let w = -1;
  for (let i = 0; i < state.desks.length; i++) {
    const d = state.desks[i];
    if (!d || deskRT[i].arriving) continue;
    if (w < 0 || CREATOR_BY_ID[d.id].inc < CREATOR_BY_ID[state.desks[w].id].inc) w = i;
  }
  return w;
}

function deskWorld(i, local = 0) {
  const f = Math.floor(i / DESKS_PER_FLOOR);
  const st = STATIONS[i % DESKS_PER_FLOOR];
  const p = stationLocal(st, 0, local);
  return new THREE.Vector3(p.x, f * H, p.z);
}

function padWorld(i) {
  return deskWorld(i, PAD_OFF);
}

const hitGeo = new THREE.BoxGeometry(1.8, 3.2, 1.8);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const hitBoxes = [];
for (const pd of shop.pedestals) {
  const h = new THREE.Mesh(hitGeo, hitMat);
  h.position.set(0, 2, 0);
  pd.g.add(h);
  hitBoxes.push(h);
}

function stockOf(id) {
  return (state.stock && state.stock[id]) || 0;
}

function restock(first) {
  state.stock = makeStock(Math.random, state.rebirths, state.money);
  const dbgTier = dbgVal('belt') || dbgVal('shop');
  if (dbgTier) {
    const tier = { common: 0, rare: 1, epic: 2, legend: 3, secret: 4 }[dbgTier] ?? 2;
    for (const c of CREATORS) if (c.r === tier) state.stock[c.id] = Math.max(stockOf(c.id), 2);
  }
  restockLeft = RESTOCK_TIME;
  updateShowcase();
  if (!first) {
    audio.ding();
    if (ui.modalKind === 'shop') refreshShop(true);
    else if (mode === 'play') ui.toast('Yeni stok!', null, 'cart', 2600);
    log('restock', {});
  }
}

function updateShowcase() {
  const list = CREATORS.filter((c) => stockOf(c.id) > 0).sort((a, b) => b.price - a.price);
  const order = [list[1], list[0], list[2], list[3]];
  shop.pedestals.forEach((pd, k) => {
    const def = order[k] || null;
    if ((def && def.id) === pd.id) return;
    if (pd.creator) pd.creator.dispose();
    pd.creator = null;
    pd.id = def ? def.id : null;
    if (def) {
      const c = new Creator(def);
      c.setMode('idle');
      c.root.position.set(0, 0.56, 0);
      c.root.rotation.y = -0.2;
      pd.g.add(c.root);
      pd.creator = c;
    }
  });
}

function shopCards() {
  return CREATORS.filter((c) => tierUnlocked(c.r, state.rebirths) || c.r === maxTierShown()).map((c) => ({ def: c, locked: !tierUnlocked(c.r, state.rebirths), stock: stockOf(c.id), inc: c.inc * mult(), img: thumb(c) }));
}

function maxTierShown() {
  for (let t = 0; t < 5; t++) if (!tierUnlocked(t, state.rebirths)) return t;
  return 4;
}

function openShop() {
  if (ui.modalKind || mode !== 'play' || cine) return;
  ui.openShop(shopCards(), state.money, restockLeft, (def) => buyDef(def, 'click'), () => closeShopPlace());
  log('shop', { open: true });
}

function refreshShop(flash) {
  ui.refreshShop(shopCards(), state.money, restockLeft, flash);
}

function closeShopPlace() {
  player.teleport(SHOP.rx - 1.2, 0, SHOP.rz + SHOP.ring + 2.2, 0);
  shopArmed = false;
  rig.snap(player.pos);
  log('shop', { open: false });
}

const SHOP_OPEN_R = SHOP.ring * 1.3 + 0.3;
const SHOP_NEAR_R = 4;
function shopDist() {
  return Math.hypot(player.pos.x - SHOP.rx, player.pos.z - SHOP.rz);
}

function updateShopRing(dt) {
  restockLeft -= dt;
  if (restockLeft <= 0) restock(false);
  shop.setClock(restockLeft);
  shop.update(dt);
  for (const pd of shop.pedestals) if (pd.creator && curFloor === 0) pd.creator.update(dt, time);
  if (mode !== 'play' || cine || curFloor !== 0) return;
  const d = shopDist();
  if (d > SHOP_OPEN_R + 0.8) shopArmed = true;
  if (d < SHOP_OPEN_R && shopArmed && !G.modal) {
    shopArmed = false;
    openShop();
  }
}

function canAfford(def) {
  return state.money >= def.price;
}

function buyDef(def, via) {
  if (!def || mode !== 'play') return false;
  const now = performance.now();
  if (now - lastBuyAt < 400) return false;
  if (stockOf(def.id) <= 0 || !tierUnlocked(def.r, state.rebirths)) {
    audio.error();
    return false;
  }
  if (!canAfford(def)) {
    audio.error();
    ui.wiggleMoney();
    log('buyFail', { id: def.id, price: def.price, money: Math.floor(state.money) });
    return false;
  }
  let idx = firstFreeDesk();
  let swap = -1;
  if (idx < 0) {
    swap = weakestDesk();
    if (swap < 0 || def.inc <= CREATOR_BY_ID[state.desks[swap].id].inc) {
      audio.error();
      ui.fullFlash(ICONS.full);
      log('buyBlocked', { id: def.id, reason: 'full' });
      return false;
    }
  }
  lastBuyAt = now;
  studioGuideUntil = time + STUDIO_GUIDE_TIME;
  if (swap >= 0) {
    const weak = CREATOR_BY_ID[state.desks[swap].id];
    const wq = state.waiting;
    state.waiting = [];
    sellDesk(swap);
    state.waiting = wq;
    ui.fullFlash(`<img class="fp-old" src="${thumb(weak)}" alt=""><span class="fp-ar">➜</span><img src="${thumb(def)}" alt="">${ICONS.coin}<span>+${fmt(sellPrice(weak))}</span>`, true, 2500);
    idx = swap;
    if (sold) {
      sold.swapIn = def.id;
      sold.swapPrice = def.price;
    }
  }
  state.money -= def.price;
  state.stock[def.id]--;
  const firstTime = !state.owned[def.id];
  state.owned[def.id] = 1;
  state.stats.bought++;
  state.tut.buys++;
  const pos = new THREE.Vector3(SHOP.rx, 0, SHOP.rz);
  const r = RARITIES[def.r];
  const col = rarityColor(r);
  particles.burst(pos.x, 1.2, pos.z, { count: 30 + def.r * 25, colors: [col, '#ffffff', r.glow], speed: 7 + def.r, life: 1.1 });
  particles.ring(pos.x, 0.2, pos.z, col, 30, 6);
  if (def.r >= 2) particles.confetti(pos.x, 1.5, pos.z, 40 + def.r * 20);
  audio.buy(def.r);
  const dest = { type: 'desk', i: idx };
  state.desks[idx] = { id: def.id, subs: Math.round(100 + Math.random() * 400) };
  deskRT[idx].arriving = true;
  startWalker(def, pos, dest);
  ui.reveal(def, thumb(def), def.inc * mult(), state.rebirths > 0 ? '×' + fmtMult(totalMult(state.rebirths, state.owned)) : '');
  if (firstTime) ui.el.bookBadge.classList.remove('hidden'), (ui.el.bookBadge.textContent = '!');
  log('buy', { id: def.id, rarity: def.r, price: def.price, via, desk: idx, swap, cat: 'reward' });
  updateShowcase();
  if (ui.modalKind === 'shop') refreshShop(false);
  dirtySave();
  return true;
}

function startWalker(def, from, dest) {
  const c = new Creator(def);
  c.setMode('walk');
  c.root.position.copy(from);
  scene.add(c.root);
  c.cheer(0.5);
  let target;
  if (dest.type === 'desk') target = deskWorld(dest.i, 0.6);
  else target = waitSpot(state.waiting.length - 1);
  const pts = [from.clone().setY(0).add(new THREE.Vector3(-0.8, 0, 1.4))];
  const direct = dest.type === 'wait';
  if (direct) pts.push(target);
  else pts.push(new THREE.Vector3(4, 0, ROOM.z1 + 2.5), new THREE.Vector3(0, 0, ROOM.z1 - 2));
  walkers.push({ def, c, pts, seg: 0, t: 0, dest, jumpT: 0.35, limit: direct ? 6 : 1.4, from: from.clone() });
  while (walkers.length > MAX_WALKERS) arriveWalker(walkers[0], true);
}

function waitSpot(k) {
  const a = k * 1.3;
  const r = k === 0 ? 0 : 1.2;
  return new THREE.Vector3(shop.waitMat.position.x + Math.cos(a) * r, 0, shop.waitMat.position.z + Math.sin(a) * r);
}

function arriveWalker(w, teleported) {
  const i = walkers.indexOf(w);
  if (i >= 0) walkers.splice(i, 1);
  const p = w.c.root.position;
  if (teleported) {
    const col = rarityColor(RARITIES[w.def.r]);
    particles.burst(p.x, p.y + 1, p.z, { count: 30, colors: [col, '#ffffff'], speed: 3, up: 6, upBias: 1, life: 0.8, grav: 4 });
    audio.whoosh(true);
  }
  w.c.dispose();
  if (w.dest.type === 'desk') {
    const di = w.dest.i;
    if (state.desks[di] && state.desks[di].id === w.def.id) {
      placeCreator(di, w.def, true);
      log('place', { id: w.def.id, desk: di, floor: Math.floor(di / DESKS_PER_FLOOR) });
    }
  } else {
    addWaitCreator(w.def);
    log('place', { id: w.def.id, waiting: true });
  }
}

function addWaitCreator(def) {
  const c = new Creator(def);
  c.setMode('idle');
  const k = waitRT.length;
  const s = waitSpot(k);
  c.root.position.copy(s);
  c.root.rotation.y = -Math.PI / 2 + 0.4;
  scene.add(c.root);
  waitRT.push({ def, c });
}

function removeWaitCreator(id) {
  const k = waitRT.findIndex((w) => w.def.id === id);
  if (k < 0) return null;
  const w = waitRT.splice(k, 1)[0];
  const pos = w.c.root.position.clone();
  w.c.dispose();
  waitRT.forEach((ww, j) => ww.c.root.position.copy(waitSpot(j)));
  return pos;
}

function updateWalkers(dt) {
  for (const w of [...walkers]) {
    w.t += dt;
    const c = w.c;
    if (w.jumpT > 0) {
      w.jumpT -= dt;
      const k = 1 - w.jumpT / 0.35;
      const target = w.pts[0];
      c.root.position.x = lerp(w.from.x, target.x, k);
      c.root.position.z = lerp(w.from.z, target.z, k);
      c.root.position.y = lerp(w.from.y, 0, k) + Math.sin(k * Math.PI) * 1.2;
      c.root.rotation.y = -Math.PI / 2;
      c.update(dt, time);
      continue;
    }
    c.root.position.y = 0;
    const tgt = w.pts[Math.min(w.seg + 1, w.pts.length - 1)];
    const dx = tgt.x - c.root.position.x;
    const dz = tgt.z - c.root.position.z;
    const d = Math.hypot(dx, dz);
    const sp = 6.5;
    if (d < 0.2) {
      if (w.seg + 1 >= w.pts.length - 1) {
        arriveWalker(w, false);
        continue;
      }
      w.seg++;
    } else {
      c.root.position.x += (dx / d) * Math.min(d, sp * dt);
      c.root.position.z += (dz / d) * Math.min(d, sp * dt);
      c.root.rotation.y = Math.atan2(dx, dz);
    }
    c.walkSpeed = 1.3;
    c.update(dt, time);
    if (w.t > w.limit) arriveWalker(w, true);
  }
}

function desksVisibleFloor(i) {
  const f = Math.floor(i / DESKS_PER_FLOOR);
  return floors[f] && floors[f].interior.visible && floors[f].group.visible;
}

let floorT = 0;
function moneyFloor(dt) {
  floorT -= dt;
  if (floorT > 0) return;
  floorT = 1;
  if (state.waiting.length || walkers.length || state.desks.some(Boolean)) return;
  const cheap = CREATORS.filter((c) => tierUnlocked(c.r, state.rebirths)).reduce((a, c) => Math.min(a, c.price), Infinity);
  if (!Number.isFinite(cheap) || state.money >= cheap) return;
  const add = cheap - state.money;
  state.money = cheap;
  for (let k = 0; k < 8; k++) setTimeout(() => overlay.fly(innerWidth * (0.35 + Math.random() * 0.3), innerHeight * 0.2, ui.el.money, 1, (i) => audio.coinTick(i), () => ui.punch()), k * 70);
  log('moneyFloor', { add: Math.round(add), to: cheap });
  dirtySave();
}

function tickIncome(dt) {
  const m = mult();
  let ps = 0;
  let vir = false;
  for (let i = 0; i < state.desks.length; i++) {
    const d = state.desks[i];
    const rt = deskRT[i];
    if (!d || rt.arriving) continue;
    const def = CREATOR_BY_ID[d.id];
    const viral = rt.viral > 0;
    if (viral) vir = true;
    ps += def.inc * m * (viral ? VIRAL_MULT : 1);
    d.subs += def.inc * (viral ? 9 : 1.5) * dt * (0.8 + Math.random() * 0.4);
    if (viral) {
      rt.viral -= dt;
      if (rt.viral <= 0) {
        rt.viral = 0;
        const f = Math.floor(i / DESKS_PER_FLOOR);
        floors[f].atlas.slots[i % 8].viral = 0;
      }
    }
  }
  perSecond = ps;
  viralOn = vir;
  let pend = 0;
  for (let i = 0; i < state.desks.length; i++) if (state.desks[i] && deskRT[i].arriving) pend += CREATOR_BY_ID[state.desks[i].id].inc * m;
  if (pend < pendingIncome - 1e-9) ui.ratePulse();
  pendingIncome = pend;
  state.money += ps * dt;
  state.stats.earned += ps * dt;
  incomeLogAcc += ps * dt;
  incomeLogT += dt;
  if (incomeLogT >= 5) {
    if (incomeLogAcc >= 1) log('income', { amount: Math.floor(incomeLogAcc), perSecond: Math.round(ps) });
    incomeLogAcc = 0;
    incomeLogT = 0;
  }
  coinFlyT -= dt;
  if (coinFlyT <= 0 && ps > 0) {
    coinFlyT = 1.1;
    flyIncomeCoin();
  }
}
let incomeLogAcc = 0;
let incomeLogT = 0;

function flyIncomeCoin() {
  const cands = [];
  const fl = isInside() ? curFloor : 0;
  for (let s = 0; s < DESKS_PER_FLOOR; s++) {
    const i = fl * DESKS_PER_FLOOR + s;
    if (state.desks[i] && !deskRT[i].arriving) cands.push(i);
  }
  if (!cands.length) return;
  const i = cands[Math.floor(Math.random() * cands.length)];
  const p = deskWorld(i, 0);
  const sp = overlay.project(p.x, p.y + 2.2, p.z);
  const amt = CREATOR_BY_ID[state.desks[i].id].inc * mult() * 1.1 * (deskRT[i].viral > 0 ? VIRAL_MULT : 1);
  if (sp.vis && sp.x > 0 && sp.x < innerWidth && sp.y > 0 && sp.y < innerHeight) {
    overlay.fly(sp.x, sp.y, ui.el.money, 1, (k) => audio.coinTick(k), () => ui.punch());
    overlay.pop(p.x, p.y + 2.7, p.z, '+' + fmt(amt), 'inc');
  } else {
    const r = ui.el.money.getBoundingClientRect();
    overlay.fly(r.right + 40, r.bottom + 40, ui.el.money, 1, null, () => ui.punch());
  }
}

function sellDesk(i) {
  const d = state.desks[i];
  if (!d || deskRT[i].arriving) return;
  const def = CREATOR_BY_ID[d.id];
  const price = sellPrice(def);
  state.money += price;
  state.tut.sells++;
  const p = deskWorld(i, 0);
  particles.burst(p.x, p.y + 1.2, p.z, { count: 40, colors: ['#ffd23a', '#ffffff', rarityColor(RARITIES[def.r])], speed: 5, life: 0.9 });
  overlay.pop(p.x, p.y + 2.6, p.z, `<span style="display:inline-block;width:34px;height:34px;vertical-align:-6px">${ICONS.coin}</span>+${fmt(price)}`, 'sell');
  audio.sell();
  const subs = d.subs;
  state.desks[i] = null;
  clearDesk(i);
  sold = { i, id: def.id, subs, price, t: UNDO_TIME, filled: null };
  log('sell', { desk: i, id: def.id, price });
  if (state.waiting.length) {
    const wid = state.waiting.shift();
    const wdef = CREATOR_BY_ID[wid];
    const from = removeWaitCreator(wid) || shop.waitMat.position.clone();
    state.desks[i] = { id: wid, subs: Math.round(100 + Math.random() * 400) };
    deskRT[i].arriving = true;
    sold.filled = wid;
    startWalker(wdef, from.setY(0), { type: 'desk', i });
    walkers[walkers.length - 1].jumpT = 0.01;
    walkers[walkers.length - 1].limit = 0.5;
  }
  dirtySave();
}

function undoSell() {
  if (!sold || sold.t <= 0) return;
  const cost = sold.price - (sold.swapIn ? sold.swapPrice : 0);
  if (state.money < cost) {
    audio.error();
    return;
  }
  const s = sold;
  sold = null;
  state.money -= cost;
  if (s.swapIn) {
    const w = walkers.find((x) => x.dest.type === 'desk' && x.dest.i === s.i);
    if (w) {
      walkers.splice(walkers.indexOf(w), 1);
      w.c.dispose();
    }
    state.stock[s.swapIn] = (state.stock[s.swapIn] || 0) + 1;
    state.stats.bought--;
    if (ui.modalKind === 'shop') refreshShop(false);
  }
  if (s.filled) {
    const w = walkers.find((x) => x.dest.type === 'desk' && x.dest.i === s.i);
    if (w) {
      walkers.splice(walkers.indexOf(w), 1);
      w.c.dispose();
    }
    state.waiting.unshift(s.filled);
    addWaitCreator(CREATOR_BY_ID[s.filled]);
  }
  state.desks[s.i] = { id: s.id, subs: s.subs };
  placeCreator(s.i, CREATOR_BY_ID[s.id], true);
  audio.undo();
  log('undo', { desk: s.i, id: s.id });
  dirtySave();
}

function triggerViral(forceDesk) {
  const occ = [];
  for (let i = 0; i < state.desks.length; i++) if (state.desks[i] && !deskRT[i].arriving && deskRT[i].viral <= 0) occ.push(i);
  if (!occ.length) return false;
  const i = forceDesk !== undefined && occ.includes(forceDesk) ? forceDesk : occ[Math.floor(Math.random() * occ.length)];
  const rt = deskRT[i];
  rt.viral = VIRAL_TIME;
  const f = Math.floor(i / DESKS_PER_FLOOR);
  floors[f].atlas.slots[i % 8].viral = 1;
  const def = CREATOR_BY_ID[state.desks[i].id];
  state.stats.virals++;
  if (rt.creator) rt.creator.cheer(2.5);
  const p = deskWorld(i, 0);
  particles.burst(p.x, p.y + 2, p.z, { count: 90, colors: ['#ff6a1f', '#ffd23a', '#ff2d3d', '#ffffff'], speed: 9, life: 1.3 });
  particles.confetti(p.x, p.y + 2.5, p.z, 70);
  ui.viralBanner();
  if (f !== curFloor || !isInside()) ui.toast(`${def.name} <span style="color:#ffb13b">×3</span>`, thumb(def), null, 3200);
  audio.viral();
  rig.shake(0.25, 0.2);
  log('viral', { desk: i, id: def.id, floor: f, cat: 'reward' });
  return true;
}

function isInside() {
  return curFloor > 0 || inTower(player.pos.x, player.pos.z) || !!elev;
}

function defaultElevTarget() {
  const n = floorCount();
  if (guideFloor >= 0 && guideFloor < n && guideFloor !== curFloor) return guideFloor;
  return curFloor === 0 ? n - 1 : 0;
}

function ride(to) {
  const n = floorCount();
  if (elev || n < 2 || to === curFloor || to < 0 || to >= n) return;
  if (!insideCabin(player.pos.x, player.pos.z, -0.2)) return;
  elev = { from: curFloor, to, t: 0, dur: 1.5 };
  audio.whoosh(to > curFloor);
  audio.click();
  state.tut.rides++;
  log('elevator', { from: curFloor + 1, to: to + 1, phase: 'start' });
}

function updateElevator(dt) {
  if (!elev) {
    elevator.y = curFloor * H;
    const inCab = insideCabin(player.pos.x, player.pos.z, 0.1);
    elevator.update(dt, floorCount() > 1 || !inCab);
    return;
  }
  elev.t += dt;
  const k = elev.t / elev.dur;
  const move = clamp((elev.t - 0.25) / (elev.dur - 0.45), 0, 1);
  elevator.y = lerp(elev.from * H, elev.to * H, easeInOut(move));
  elevator.update(dt, k > 0.9);
  player.floorY = elevator.y;
  player.pos.y = elevator.y;
  if (elev.t >= elev.dur) {
    curFloor = elev.to;
    if (state.newFloor === curFloor) state.newFloor = 0;
    player.floorY = curFloor * H;
    audio.ding();
    audio.setStyle(THEMES[curFloor % THEMES.length].music);
    log('elevator', { from: elev.from + 1, to: elev.to + 1, phase: 'arrive' });
    elev = null;
    dirtySave();
  }
}

function collide(nx, nz, r) {
  const boxes = wallBoxes(curFloor);
  if (curFloor === 0) boxes.push(...OUTDOOR_BOXES);
  if (floorCount() < 2) boxes.push([ROOM.x0 - 0.3, ROOM.x0 + 0.2, ELEV.door0, ELEV.door1]);
  for (let it = 0; it < 2; it++) {
    for (const b of boxes) {
      const cx = clamp(nx, b[0], b[1]);
      const cz = clamp(nz, b[2], b[3]);
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * r;
          nz = cz + (dz / d) * r;
        } else {
          const ox = Math.min(nx - b[0], b[1] - nx);
          const oz = Math.min(nz - b[2], b[3] - nz);
          if (ox < oz) nx = nx - b[0] < b[1] - nx ? b[0] - r : b[1] + r;
          else nz = nz - b[2] < b[3] - nz ? b[2] - r : b[3] + r;
        }
      }
    }
    for (const st of STATIONS) {
      const s = Math.sin(st.yaw);
      const c = Math.cos(st.yaw);
      const rx = nx - st.x;
      const rz = nz - st.z;
      let lx = rx * c - rz * s;
      let lz = rx * s + rz * c;
      if (curFloor === 0 && !insideRoom(nx, nz)) continue;
      const cx = clamp(lx, ST_BOX.x0, ST_BOX.x1);
      const cz = clamp(lz, ST_BOX.z0, ST_BOX.z1);
      const dx = lx - cx;
      const dz = lz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          lx = cx + (dx / d) * r;
          lz = cz + (dz / d) * r;
        } else lz = ST_BOX.z1 + r;
        nx = st.x + lx * c + lz * s;
        nz = st.z - lx * s + lz * c;
      }
    }
  }
  if (curFloor === 0) {
    nx = clamp(nx, WORLD.x0, WORLD.x1);
    nz = clamp(nz, WORLD.z0, WORLD.z1);
  } else if (!insideRoom(nx, nz, -0.5) && !insideCabin(nx, nz, -0.6)) {
    nx = clamp(nx, ROOM.x0 + 0.6, ROOM.x1 - 0.6);
    nz = clamp(nz, ROOM.z0 + 0.6, ROOM.z1 - 0.6);
  }
  return { x: nx, z: nz };
}

function computePrompt() {
  if (mode !== 'play' || G.modal || cine) return null;
  const px = player.pos.x;
  const pz = player.pos.z;
  const n = floorCount();
  if (elev) return null;
  if (insideCabin(px, pz, 0.1) && n > 1) {
    const d = defaultElevTarget();
    return { key: 'elev' + d, kind: 'elev', icon: 'elevator', html: `${d + 1}`, target: d };
  }
  const fbase = curFloor * DESKS_PER_FLOOR;
  let on = -1;
  for (let s = 0; s < DESKS_PER_FLOOR; s++) {
    const p = padWorld(fbase + s);
    if (Math.hypot(p.x - px, p.z - pz) < 1.6 && Math.abs(player.floorY - p.y) < 0.5) on = fbase + s;
  }
  if (on !== sellCtx.desk) sellCtx = { desk: on, since: 0 };
  if (on >= 0 && state.desks[on] && !deskRT[on].arriving && sellCtx.since >= 0.5) {
    const def = CREATOR_BY_ID[state.desks[on].id];
    return { key: 'sell' + on + def.id, kind: 'sell', icon: 'sell', html: `<span class="coin-inline">${ICONS.coin}</span><span class="ok">+${fmt(sellPrice(def))}</span>`, desk: on };
  }
  if (curFloor === 0 && shopDist() < SHOP_NEAR_R) return { key: 'shop', kind: 'shop', icon: 'cart', html: '' };
  return null;
}

let curPrompt = null;
function doAction(src) {
  lastInputT = time;
  if (G.modal) {
    if (ui.modalKind === 'rebirth') ui.rebirthConfirm();
    if (ui.modalKind === 'shop') ui.shopBuySelected();
    return;
  }
  if (mode === 'title') return;
  if (cine) {
    skipCine();
    return;
  }
  const p = curPrompt;
  if (!p) return;
  if (p.kind === 'elev') ride(p.target);
  else if (p.kind === 'shop') openShop();
  else if (p.kind === 'sell') {
    holdValid = performance.now() - 20 > promptShownAt;
    holdT = 0;
  }
}

input.on('action', (src) => doAction(src));
input.spaceAction = () => mode === 'play' && !ui.modalKind && !!curPrompt && curPrompt.kind !== 'sell';
input.on('actionUp', () => {
  holdValid = false;
});
input.on('key', (e) => {
  lastInputT = time;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (ui.modalKind) {
      if (ui.modalKind === 'offline') ui.closeModal('esc');
      else ui.closeModal('esc');
    } else if (mode === 'play' && !cine) openPause();
    return;
  }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (ui.modalKind === 'offline') ui.closeModal('take');
    else if (ui.modalKind === 'pause') ui.closeModal('resume');
    else if (mode === 'title') startGame();
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (e.code === 'Backspace') {
    undoSell();
    return;
  }
  const m = /^Digit(\d)$|^Numpad(\d)$/.exec(e.code);
  if (m && mode === 'play' && !G.modal) {
    const d = Number(m[1] ?? m[2]);
    const to = d === 0 ? 9 : d - 1;
    if (insideCabin(player.pos.x, player.pos.z, 0.1)) ride(to);
  }
});

const promptEl = ui.el.prompt;
let promptDown = null;
promptEl.addEventListener('pointerdown', (e) => {
  promptDown = { x: e.clientX, y: e.clientY };
  if (curPrompt && curPrompt.kind === 'sell') {
    holdValid = true;
    holdT = 0;
    ptrHold = true;
  }
});
let ptrHold = false;
const endPtrHold = () => {
  if (ptrHold) holdValid = false;
  ptrHold = false;
};
promptEl.addEventListener('pointerup', (e) => {
  const ok = promptDown && Math.hypot(e.clientX - promptDown.x, e.clientY - promptDown.y) <= 10;
  promptDown = null;
  if (curPrompt && curPrompt.kind !== 'sell' && ok) doAction('click');
  endPtrHold();
});
promptEl.addEventListener('pointerleave', () => {
  promptDown = null;
  endPtrHold();
});
const actBtn = ui.el.act;
actBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  promptDown = { x: e.clientX, y: e.clientY };
  if (curPrompt && curPrompt.kind === 'sell') {
    holdValid = true;
    holdT = 0;
    ptrHold = true;
  }
});
actBtn.addEventListener('pointerup', (e) => {
  const ok = promptDown && Math.hypot(e.clientX - promptDown.x, e.clientY - promptDown.y) <= 10;
  promptDown = null;
  if (curPrompt && curPrompt.kind !== 'sell' && ok) doAction('touch');
  endPtrHold();
});
actBtn.addEventListener('pointerleave', () => {
  promptDown = null;
  endPtrHold();
});
ui.el.jump.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.jump = true;
});
ui.el.undo.addEventListener('click', () => undoSell());
document.getElementById('btnMute').addEventListener('click', () => toggleMute());
document.getElementById('btnPause').addEventListener('click', () => openPause());
document.getElementById('btnBook').addEventListener('click', () => openBook());
ui.el.rebirth.addEventListener('click', () => openRebirth());
ui.el.goal.addEventListener('click', () => {
  if (state.money >= rebirthCost(state.rebirths)) openRebirth();
});
window.addEventListener('pointerdown', () => {
  audio.start();
}, { capture: true });
window.addEventListener('keydown', () => audio.start(), { capture: true });
window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

window.addEventListener('keydown', (e) => {
  if (ui.modalKind !== 'shop') return;
  const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
  if (mv && !(e.key === 'e' || e.key === 'E')) {
    e.preventDefault();
    if (!e.repeat) ui.shopMove(mv[0], mv[1]);
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
}, { capture: true });

function toggleMute() {
  const on = !(state.settings.music || state.settings.sfx);
  state.settings.music = on;
  state.settings.sfx = on;
  audio.setMusic(on);
  audio.setSfx(on);
  document.querySelector('#btnMute span').innerHTML = ICONS[on ? 'sound' : 'mute'];
  dirtySave();
  return on;
}

function openPause() {
  if (ui.modalKind) return;
  G.paused = true;
  audio.suspend(true);
  ui.openPause(state.settings.music, () => {
    state.settings.music = !state.settings.music;
    audio.setMusic(state.settings.music);
    return state.settings.music;
  });
  ui.onClose = () => {
    G.paused = false;
    audio.suspend(false);
  };
  log('input', { kind: 'pause' });
}

function openBook() {
  if (ui.modalKind || mode !== 'play') return;
  ui.el.bookBadge.classList.add('hidden');
  ui.openBook(state.owned, thumb);
}

function openRebirth() {
  if (ui.modalKind || mode !== 'play' || cine) return;
  const R = state.rebirths;
  const cost = rebirthCost(R);
  if (R >= MAX_REBIRTHS) return;
  if (state.money < cost) {
    audio.error();
    ui.toast(`<span style="display:inline-block;width:34px;height:34px;vertical-align:-8px">${ICONS.coin}</span> ${fmt(state.money)} / ${fmt(cost)}`, null, 'rebirth');
    return;
  }
  const heads = [];
  for (const d of state.desks) if (d) heads.push(thumb(CREATOR_BY_ID[d.id]));
  for (const id of state.waiting) heads.push(thumb(CREATOR_BY_ID[id]));
  const n = floorsFor(R + 1);
  ui.openRebirth({ cost, money: state.money, creators: heads.length, lostHeads: heads, oldMult: totalMult(R, state.owned), newMult: totalMult(R + 1, state.owned), floors: n, theme: THEMES[(n - 1) % THEMES.length], newTier: newTierAt(R + 1) }, () => doRebirth());
  log('input', { kind: 'rebirthScreen' });
}

function doRebirth() {
  const R = state.rebirths;
  const cost = rebirthCost(R);
  if (state.money < cost) return;
  for (let i = 0; i < state.desks.length; i++) {
    const rt = deskRT[i];
    if (rt.creator) {
      const p = deskWorld(i, 0);
      cineOrbs.push({ x: p.x, y: p.y + 1.2, z: p.z, col: rarityColor(RARITIES[CREATOR_BY_ID[state.desks[i].id].r]) });
    }
  }
  for (const w of [...walkers]) arriveWalker(w, false);
  for (let i = 0; i < state.desks.length; i++) if (state.desks[i]) {
    state.desks[i] = null;
    clearDesk(i);
  }
  for (const w of [...waitRT]) removeWaitCreator(w.def.id);
  state.waiting = [];
  state.rebirths = R + 1;
  state.money = REBIRTH_START_MONEY;
  displayMoney = state.money;
  sold = null;
  const nt = newTierAt(state.rebirths);
  if (nt >= 0) {
    forceTier = nt;
    forceAt = time + 8 + Math.random() * 20;
  }
  const oldN = floors.length;
  ensureFloors();
  state.newFloor = floorCount() - 1;
  restock(true);
  log('rebirth', { rebirths: state.rebirths, floors: floorCount(), mult: multiplier(state.rebirths), cost, cat: 'reward' });
  startCine(oldN);
  dirtySave(true);
}

const cineOrbs = [];
function startCine(newIndex) {
  const n = floorCount();
  const f = floors[n - 1];
  cine = { t: 0, dur: 6.2, floor: f, index: n - 1, shook: false, lit: 0, skippable: 0.8 };
  f.group.scale.y = 0.01;
  extras.roof.position.y = (n - 1) * H;
  ui.flash();
  audio.rebirth();
  mode = 'cine';
  document.getElementById('hud').classList.add('cine');
  for (const o of cineOrbs) particles.burst(o.x, o.y, o.z, { count: 24, colors: [o.col, '#ffffff'], speed: 3, up: 10, upBias: 1, grav: 6, life: 1.4, size: 0.7 });
  cineOrbs.length = 0;
  player.loop('Dance');
}

function skipCine() {
  if (!cine || cine.t < cine.skippable) return;
  cine.t = cine.dur;
}

function updateCine(dt) {
  const c = cine;
  c.t += dt;
  const n = floorCount();
  const topY = n * H;
  const f = c.floor;
  const k = clamp((c.t - 0.8) / 1.6, 0, 1);
  f.group.scale.y = Math.max(0.01, easeOutBack(k));
  extras.roof.position.y = (n - 1) * H + H * easeOutBack(k);
  for (const fl of floors) fl.setVisible(true, true, false);
  const sh = c.t > 0.8 && c.t < 1.5 ? Math.sin(c.t * 55) * 0.3 * (1.5 - c.t) / 0.7 : 0;
  tower.position.x = sh;
  extras.group.position.x = sh;
  elevator.group.position.x = sh;
  if (c.t > 0.8 && !c.shook) {
    c.shook = true;
    rig.shake(0.5, 0.5);
    audio.thud();
  }
  if (c.t > 0.8 && c.t < 2.4 && Math.random() < 0.6) particles.burst((Math.random() - 0.5) * 34, (n - 1) * H + 0.2, 10 + Math.random(), { count: 3, colors: ['#ffffff', '#e8dcc8'], speed: 2, life: 1.2, grav: -1, size: 1.2, shape: 0 });
  if (c.t > 2.3 && !c.mult) {
    c.mult = true;
    ui.bigMult(`×${fmtMult(totalMult(state.rebirths, state.owned))}<small>${n}. kat</small>`);
    particles.confetti(0, topY + 4, 12, 140);
    audio.buy(3);
  }
  let camPos;
  let look;
  if (c.t < 3.6) {
    const a = 0.25 + c.t * 0.04;
    camPos = new THREE.Vector3(Math.sin(a) * 70, topY * 0.55 + 12, Math.cos(a) * 70);
    look = new THREE.Vector3(0, topY * 0.55, 0);
  } else {
    const y = (n - 1) * H;
    f.setVisible(true, true, true);
    for (let i = n; i < floors.length; i++) floors[i].setVisible(false, false, false);
    extras.roof.visible = false;
    camPos = new THREE.Vector3(6, y + 13, 20);
    look = new THREE.Vector3(0, y + 1, -2);
    const lit = Math.min(8, Math.floor((c.t - 3.7) / 0.14));
    while (c.lit < lit) {
      f.setRim(c.lit, THEMES[c.index % THEMES.length].led);
      const p = stationLocal(STATIONS[c.lit], 0, 0);
      particles.ring(p.x, y + 0.3, p.z, THEMES[c.index % THEMES.length].led, 20, 4);
      audio.coinTick(c.lit);
      c.lit++;
    }
  }
  camera.position.lerp(camPos, c.t < 0.1 || (c.t > 3.6 && c.t < 3.7) ? 1 : 1 - Math.exp(-dt * 3));
  camera.lookAt(look);
  if (c.t >= c.dur) {
    for (let s = 0; s < 8; s++) f.setRim(s, '#5b6478');
    f.group.scale.y = 1;
    extras.roof.position.y = n * H;
    extras.roof.visible = true;
    cine = null;
    mode = 'play';
    document.getElementById('hud').classList.remove('cine');
    curFloor = 0;
    player.release();
    player.teleport(SPAWN.x, 0, SPAWN.z, SPAWN.yaw);
    rig.goalYaw = rig.baseYaw;
    rig.snap(player.pos);
    ui.toast(`<span style="display:inline-block;width:34px;height:34px;vertical-align:-8px">${ICONS.floor}</span> ${n}`, null, 'rebirth', 2600);
  }
}

let lastGoal = '';
const MAX_WALKERS = 6;
let lastChev = 0;
const GUIDE_FAR = 12;
function usefulDef(c) {
  if (!tierUnlocked(c.r, state.rebirths) || stockOf(c.id) <= 0) return false;
  if (firstFreeDesk() >= 0) return true;
  const w = weakestDesk();
  return w >= 0 && c.inc > CREATOR_BY_ID[state.desks[w].id].inc;
}

function goalStep() {
  const R = state.rebirths;
  if (R < MAX_REBIRTHS && state.money >= rebirthCost(R) && state.tut.buys > 0) return { kind: 'rebirth' };
  const useful = CREATORS.filter(usefulDef);
  const aff = useful.filter((c) => canAfford(c)).sort((a, b) => b.inc - a.inc);
  if (aff.length) return { kind: 'buy', def: aff[0], swap: firstFreeDesk() < 0 };
  const next = useful.filter((c) => !canAfford(c)).sort((a, b) => a.price - b.price)[0];
  if (next) return { kind: 'save', def: next };
  if (R >= MAX_REBIRTHS) return { kind: 'book' };
  return { kind: 'wait' };
}

function guideTarget() {
  if (mode !== 'play' || cine) return null;
  const t = state.tut;
  const idle = time - lastInputT > 10;
  const nf = state.newFloor;
  const nfKind = goalStep().kind;
  if (nf > 0 && nf < floorCount() && curFloor !== nf && nfKind !== 'buy' && nfKind !== 'rebirth') return { pos: new THREE.Vector3(0, nf * H, 3.5), floor: nf, kind: 'floor' };
  if (ui.modalKind === 'shop' && studioGuideUntil > time) studioGuideUntil = time + STUDIO_GUIDE_TIME;
  if (studioGuideUntil > time && !isInside()) return { pos: new THREE.Vector3(0, 0, ROOM.z1 + 2.5), floor: 0, kind: 'studio' };
  if (isInside()) studioGuideUntil = -1;
  const gs = goalStep();
  if (state.waiting.length && weakestDesk() >= 0) {
    const w = weakestDesk();
    return { pos: deskWorld(w, PAD_OFF), floor: Math.floor(w / 8), kind: 'sell' };
  }
  const shopPos = new THREE.Vector3(SHOP.rx, 0, SHOP.rz);
  const anyBuy = gs.kind === 'buy';
  const far = curFloor !== 0 || Math.hypot(player.pos.x - shopPos.x, player.pos.z - shopPos.z) > GUIDE_FAR;
  if (t.buys === 0) return { pos: shopPos, floor: 0, kind: 'shop' };
  if (anyBuy && (isInside() || far)) return { pos: shopPos, floor: 0, kind: 'shop' };
  if (state.money >= rebirthCost(state.rebirths) && state.rebirths < MAX_REBIRTHS) return { hud: 'rebirth' };
  if ((idle || t.buys < 3) && anyBuy) return { pos: shopPos, floor: 0, kind: 'shop' };
  return null;
}

const chevMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23a').multiplyScalar(2), transparent: true, depthWrite: false });
const chevGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.2);
  s.lineTo(0, 0.3);
  s.lineTo(0.5, -0.2);
  s.lineTo(0.5, -0.5);
  s.lineTo(0, 0);
  s.lineTo(-0.5, -0.5);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
})();
const chevrons = new THREE.InstancedMesh(chevGeo, chevMat, 40);
chevrons.frustumCulled = false;
chevrons.renderOrder = 4;
scene.add(chevrons);
const arrow3d = (() => {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd23a').multiplyScalar(1.6) });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 4), m);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.55;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.0, 0.42), m);
  bar.position.y = 1.55;
  const o = new THREE.MeshBasicMaterial({ color: '#1b1336', side: THREE.BackSide });
  const co = new THREE.Mesh(cone.geometry, o);
  co.scale.setScalar(1.12);
  co.position.copy(cone.position);
  co.rotation.copy(cone.rotation);
  const bo = new THREE.Mesh(bar.geometry, o);
  bo.scale.set(1.25, 1.08, 1.25);
  bo.position.copy(bar.position);
  g.add(cone, bar, co, bo);
  g.visible = false;
  scene.add(g);
  return g;
})();

function routeTo(target) {
  const pts = [player.pos.clone().setY(player.floorY)];
  const pIn = inTower(player.pos.x, player.pos.z) || curFloor > 0;
  const doorOut = new THREE.Vector3(0, 0, ROOM.z1 + 2.2);
  const doorIn = new THREE.Vector3(0, 0, ROOM.z1 - 2.0);
  const cab = new THREE.Vector3(ELEV.cx, curFloor * H, ELEV.cz);
  if (target.floor !== curFloor && insideCabin(player.pos.x, player.pos.z, -0.3)) {
    pts.push(cab);
    return pts;
  }
  if (target.floor !== curFloor) {
    if (curFloor === 0 && !pIn) pts.push(doorOut.clone(), doorIn.clone());
    const exit = new THREE.Vector3(ROOM.x0 + 1.5, curFloor * H, ELEV.cz);
    pts.push(exit, cab);
    return pts;
  }
  const tIn = target.floor > 0 || inTower(target.pos.x, target.pos.z);
  if (curFloor === 0 && pIn && !tIn) {
    if (player.pos.z < doorIn.z || Math.abs(player.pos.x) > FRONT_DOOR.x1) pts.push(doorIn.clone());
    pts.push(doorOut.clone());
  }
  if (curFloor === 0 && !pIn && tIn) pts.push(doorOut.clone(), doorIn.clone());
  pts.push(target.pos.clone());
  return pts;
}

let chevPhase = 0;
let guideFloor = -1;
let lastGuide = null;
function updateGuide(dt) {
  const g = guideTarget();
  guideFloor = g && g.floor !== undefined ? g.floor : -1;
  lastGuide = g ? g.kind || g.hud : null;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  let used = 0;
  arrow3d.visible = false;
  let hudArrow = null;
  if (g && g.hud === 'rebirth') {
    const r = ui.el.rebirth.getBoundingClientRect();
    hudArrow = [r.left - 50, r.top + r.height / 2, 90, '×' + fmtMult(totalMult(state.rebirths + 1, state.owned))];
  } else if (g) {
    const pts = routeTo(g);
    chevPhase = (chevPhase + dt * 2.2) % 1.6;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let skip = 1.2;
    for (let s = 0; s < pts.length - 1 && used < 40; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      q.setFromAxisAngle(up, yaw + Math.PI);
      for (let d = (s === 0 ? skip : 0) + chevPhase; d < len - (s === pts.length - 2 ? 1.2 : 0) && used < 40; d += 1.6) {
        const k = d / len;
        const pos = new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + 0.06, a.z + (b.z - a.z) * k);
        const sc = 0.9;
        m.compose(pos, new THREE.Quaternion().setFromAxisAngle(up, yaw), new THREE.Vector3(sc, 1, sc));
        chevrons.setMatrixAt(used++, m);
      }
    }
    const last = pts[pts.length - 1];
    const tgtPos = g.floor === curFloor ? g.pos : last;
    arrow3d.visible = true;
    arrow3d.position.set(tgtPos.x, tgtPos.y + (g.kind === 'shop' ? 4.4 : 1.6) + Math.abs(Math.sin(time * 4)) * 0.5, tgtPos.z);
    arrow3d.rotation.y = time * 2;
    arrow3d.children[0].material.color.set(g.kind === 'sell' ? '#ff4f5a' : '#ffd23a').multiplyScalar(1.6);
  }
  lastChev = used;
  for (let i = used; i < 40; i++) chevrons.setMatrixAt(i, hide);
  chevrons.instanceMatrix.needsUpdate = true;
  chevMat.opacity = 0.55 + Math.sin(time * 6) * 0.25;
  if (hudArrow && !G.modal) ui.arrowAt(hudArrow[0], hudArrow[1], hudArrow[2], hudArrow[3]);
  else ui.arrowAt(null);
}

function updateLabels() {
  overlay.beginFrame();
  if (mode === 'play' && !cine) {
    const px = player.pos.x;
    const pz = player.pos.z;
    if (curFloor === 0) {
      for (const w of waitRT) {
        const l = overlay.label('w' + w.def.id + waitRT.indexOf(w), 'wl-wait', ICONS.full);
        const p = w.c.root.position;
        overlay.place(l, p.x, p.y + 2.5, p.z);
      }
    }
    if (isInside()) {
      const fb = curFloor * DESKS_PER_FLOOR;
      const suggest = state.waiting.length ? weakestDesk() : -1;
      for (let s = 0; s < DESKS_PER_FLOOR; s++) {
        const i = fb + s;
        const d = state.desks[i];
        if (!d || deskRT[i].arriving) continue;
        const def = CREATOR_BY_ID[d.id];
        const pd = deskWorld(i, 0);
        const farOut = !isInside() && Math.hypot(pd.x - px, pd.z - pz) > 30;
        const viral = deskRT[i].viral > 0;
        const inc = def.inc * mult() * (viral ? VIRAL_MULT : 1);
        const html = `${i === suggest ? `<span class="sellhint">${ICONS.sell}</span>` : ''}<span class="dl ${viral ? 'viral' : ''}"><span class="inc">${viral ? '×3 ' : ''}+${fmt(inc)}/sn</span></span>`;
        if (!farOut) {
          const l = overlay.label('d' + i, 'wl-desk', html);
          overlay.place(l, pd.x, pd.y + 3.05, pd.z);
        }
      }
    }
  }
  overlay.endFrame();
}

function updateDeskVisuals(dt) {
  const m = mult();
  for (let f = 0; f < floors.length; f++) {
    const fl = floors[f];
    if (!fl.group.visible || !fl.interior.visible) continue;
    for (let s = 0; s < 8; s++) {
      const i = f * 8 + s;
      const d = state.desks[i];
      const rt = deskRT[i];
      if (rt.creator) rt.creator.update(dt, time);
      if (d) {
        fl.atlas.slots[s].subs = d.subs;
        if (rt.viral > 0 && Math.random() < 0.5) {
          const p = deskWorld(i, 0);
          particles.spawn(p.x + (Math.random() - 0.5) * 1.6, p.y + 0.4, p.z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 0.8, 0.9, Math.random() < 0.5 ? '#ff6a1f' : '#ffd23a', 0, 1.5, 1);
        }
      }
    }
    if (fl.index === curFloor || !isInside()) fl.atlas.update(time, fl.index === curFloor ? 8 : 4);
  }
  const suggest = state.waiting.length ? weakestDesk() : -1;
  if (suggest >= 0) {
    const f = Math.floor(suggest / 8);
    floors[f].setRim(suggest % 8, Math.sin(time * 8) > 0 ? '#ff4f5a' : '#ffffff');
    lastSuggest = suggest;
  } else if (lastSuggest >= 0) {
    const d = state.desks[lastSuggest];
    floors[Math.floor(lastSuggest / 8)].setRim(lastSuggest % 8, d ? rarityColor(RARITIES[CREATOR_BY_ID[d.id].r]) : '#5b6478');
    lastSuggest = -1;
  }
  for (const w of waitRT) w.c.update(dt, time);
}
let lastSuggest = -1;
const tmpC = new THREE.Color();

function updateVisibility() {
  const n = floors.length;
  let showUpTo = n - 1;
  let inside = isInside();
  let focusFloor = curFloor;
  if (elev) {
    focusFloor = Math.round(elevator.y / H);
    showUpTo = Math.max(focusFloor, Math.ceil(elevator.y / H - 0.001));
  } else if (inside) showUpTo = curFloor;
  for (let f = 0; f < n; f++) {
    const fl = floors[f];
    if (cine) continue;
    if (!inside) fl.setVisible(true, true, false);
    else fl.setVisible(f <= showUpTo, f === focusFloor || (elev && f === showUpTo), f === showUpTo || f === focusFloor);
  }
  if (!cine) extras.roof.visible = !inside;
  extras.canopy.visible = !inside;
  elevator.cabin.visible = true;
  elevator.cabinRoof.visible = !elev && !nearCabin();
}

let camYawGoal = rig.baseYaw;
function nearCabin() {
  return insideCabin(player.pos.x, player.pos.z, -1.6) && player.pos.x < ROOM.x0 - 0.3;
}

function updateCamera(dt, drag) {
  const inside = isInside();
  const inCab = nearCabin() || !!elev;
  rig.goalPitch = inCab ? 0.42 : inside ? 0.58 : 0.62;
  rig.goalDist = inCab ? 13 : inside ? 14.5 : 18;
  rig.goalYaw = inCab ? -1.2 : rig.baseYaw;
  rig.boxes = inCab ? [] : camBoxes();
  rig.minY = (elev ? elevator.y : curFloor * H) + 2;
  rig.update(dt, drag, player.pos);
  updateOcclusion(dt);
}

function camBoxes() {
  const top = floorCount() * H;
  const t = 0.3;
  const ex0 = ELEV.cx - ELEV.hx - 0.3;
  const ez0 = ELEV.cz - ELEV.hz - 0.3;
  const ez1 = ELEV.cz + ELEV.hz + 0.3;
  if (isInside()) {
    const y0 = (elev ? Math.floor(elevator.y / H) : curFloor) * H;
    const y1 = y0 + H;
    return [
      [ROOM.x0 - t, ROOM.x1 + t, y0, y1, ROOM.z0 - t - 0.2, ROOM.z0 + t],
      [ROOM.x0 - t, ROOM.x0 + t, y0, y1, ROOM.z0, ELEV.door0],
      [ROOM.x0 - t, ROOM.x0 + t, y0, y1, ELEV.door1, ROOM.z1],
      [ex0 - 0.2, ex0 + 0.1, y0, y1, ez0, ez1],
      [ex0, ROOM.x0, y0, y1, ez0 - 0.2, ez0 + 0.1],
      [ex0, ROOM.x0, y0, y1, ez1 - 0.1, ez1 + 0.2],
    ];
  }
  return [
    [ROOM.x0 - t, ROOM.x1 + t, 0, top + 2.2, ROOM.z0 - t, ROOM.z1 + t],
    [ex0, ROOM.x0, 0, top, ez0, ez1],
    [SHOP.x - SHOP.w / 2 - 0.3, SHOP.x + SHOP.w / 2 + 0.3, 0, 11, SHOP.z - SHOP.d / 2 - 0.3, SHOP.z + SHOP.d / 2 + 0.3],
    [SHOP.x - SHOP.w / 2 - 0.5, SHOP.x + SHOP.w / 2 + 0.5, 3.6, 11, SHOP.z + SHOP.d / 2, SHOP.z + SHOP.d / 2 + 2.4],
  ];
}

const occRay = new THREE.Raycaster();
const occDir = new THREE.Vector3();
const occPt = new THREE.Vector3();
let occT = 0;
function updateOcclusion(dt) {
  occT -= dt;
  if (occT > 0) return;
  occT = 0.1;
  const roots = isInside() ? [floors[curFloor].group, elevator.group] : [shop.group, extras.group, elevator.group, ...floors.map((f) => f.group)];
  const cands = [];
  for (const r of roots) {
    r.traverseVisible((o) => {
      if (o.isMesh && !o.isSkinnedMesh && o.material && !o.material.transparent) cands.push(o);
    });
  }
  let hidden = 0;
  for (const hy of [1.2, 2.3]) {
    occPt.copy(player.pos);
    occPt.y += hy;
    occDir.subVectors(occPt, camera.position);
    const len = occDir.length();
    occRay.set(camera.position, occDir.divideScalar(len));
    occRay.near = 0.1;
    occRay.far = len - 0.4;
    if (occRay.intersectObjects(cands, false).length) hidden++;
  }
  occHidden = hidden >= 2;
  player.setOccluded(occHidden);
}
let occHidden = false;

function updateSun() {
  const t = player.pos;
  sun.position.set(t.x + SUN_OFF.x, t.y + SUN_OFF.y, t.z + SUN_OFF.z);
  sun.target.position.set(t.x, t.y, t.z);
}

function updateHUD(dt) {
  const diff = state.money - displayMoney;
  displayMoney = Math.abs(diff) < 1 ? state.money : displayMoney + diff * Math.min(1, dt * 7);
  ui.money(displayMoney, perSecond, mult(), pendingIncome, viralOn);
  const R = state.rebirths;
  const cost = rebirthCost(R);
  const maxed = R >= MAX_REBIRTHS;
  const g = goalStep();
  lastGoal = g.kind;
  const rbMult = maxed ? '★' : '×' + fmtMult(totalMult(R + 1, state.owned));
  const rbSub = !maxed && g.kind !== 'rebirth' && state.tut.buys > 0 ? `<span class="gs-ic">${ICONS.rebirth}</span>${fmt(state.money)} / ${fmt(cost)}` : '';
  const rs = Math.max(1, Math.ceil(restockLeft));
  const clock = `${Math.floor(rs / 60)}:${String(rs % 60).padStart(2, '0')}`;
  const outside = !isInside() && ui.modalKind !== 'shop';
  const nf = state.newFloor;
  const full = firstFreeDesk() < 0;
  const fullIc = full ? `<span class="gs-ic">${ICONS.full}</span>` : '';
  if (nf > 0 && nf < floorCount() && curFloor !== nf && g.kind !== 'rebirth' && g.kind !== 'buy') ui.goal('elevator', 1, `${nf + 1}`, false, true, '', true);
  else if (g.kind === 'rebirth') ui.goal('rebirth', 1, rbMult, true, false, fullIc, false);
  else if (full && !maxed && g.kind === 'wait') ui.goal('rebirth', Math.min(1, state.money / cost), `${fmt(state.money)} / ${fmt(cost)}`, false, false, fullIc, false);
  else if (g.kind === 'buy') ui.goal('cart', 1, `${g.def.name} +${fmt(g.def.inc * mult())}/sn`, false, true, g.swap ? `${fullIc}<span class="gs-ic">${ICONS.sell}</span>` : rbSub, outside, thumb(g.def));
  else if (g.kind === 'save') ui.goal('cart', Math.min(1, state.money / g.def.price), `${fmt(state.money)} / ${fmt(g.def.price)}`, false, true, `${rbSub}${rbSub ? ' · ' : ''}<span class="gs-ic">${ICONS.moon}</span>Yeni stok ${clock}`, false, thumb(g.def));
  else if (g.kind === 'wait') ui.goal('cart', 0, `Yeni stok ${clock}`, false, true, rbSub, false);
  else {
    const have = CREATORS.filter((c) => state.owned[c.id]).length;
    ui.goal('book', have / CREATORS.length, `${have} / ${CREATORS.length}`, false, true);
  }
  ui.rebirthBtn(maxed ? 1 : Math.min(1, state.money / cost), !maxed && state.money >= cost, rbMult, state.tut.buys > 0);
  const moneyFloors = [];
  const viralFloors = [];
  for (let f = 0; f < floors.length; f++) {
    let any = false;
    let vir = false;
    for (let s = 0; s < 8; s++) {
      const d = state.desks[f * 8 + s];
      if (d && !deskRT[f * 8 + s].arriving) any = true;
      if (deskRT[f * 8 + s] && deskRT[f * 8 + s].viral > 0) vir = true;
    }
    if (any) moneyFloors.push(f);
    if (vir) viralFloors.push(f);
  }
  ui.towerMap(floors.length, curFloor, moneyFloors, viralFloors);
  const inCab = insideCabin(player.pos.x, player.pos.z, 0.1) && floorCount() > 1 && mode === 'play' && !cine;
  ui.elevPanel(inCab && !G.modal, floorCount(), elev ? -1 : curFloor, defaultElevTarget(), (f) => ride(f));
  if (sold) {
    sold.t -= dt;
    if (sold.t <= 0) sold = null;
  }
  ui.undo(!!sold && !cine, sold ? sold.t / UNDO_TIME : 0);
  ui.shopFull = full;
  ui.blocked = blockedBuy;
  ui.swapOut = swapOutThumb;
  if (ui.modalKind === 'shop' && ui.updateShop(state.money, restockLeft, false)) audio.buy(0);
  const p = computePrompt();
  curPrompt = p;
  const key = p ? p.key : '';
  if (key !== promptKey) {
    promptKey = key;
    promptShownAt = performance.now();
    holdValid = false;
    holdT = 0;
  }
  ui.prompt(p);
  if (p && p.anchor) {
    const cp = p.anchor.creator.root.position;
    const sp = overlay.project(cp.x, cp.y + 1.3, cp.z);
    ui.placePrompt(sp.vis ? sp.x : null, sp.y);
  } else ui.placePrompt(null);
  if (p && p.kind === 'sell' && holdValid && (input.actionHeld || ptrHold)) {
    holdT += realDt;
    ui.hold(holdT / SELL_HOLD);
    if (Math.floor(holdT * 8) !== Math.floor((holdT - realDt) * 8)) audio.hold(holdT / SELL_HOLD);
    if (holdT >= SELL_HOLD) {
      holdValid = false;
      holdT = 0;
      ui.hold(0);
      sellDesk(p.desk);
    }
  } else {
    holdT = Math.max(0, holdT - realDt * (SELL_HOLD / 0.2));
    ui.hold(holdT / SELL_HOLD);
  }
  if (sellCtx.desk >= 0) sellCtx.since += dt;
  ui.el.keys.classList.toggle('dim', time > 60 && time - lastInputT < 10);
}

function handleTaps(taps) {
  for (const t of taps) {
    lastInputT = time;
    if (cine) {
      skipCine();
      continue;
    }
    if (mode !== 'play' || G.modal || cine) continue;
    const ndc = new THREE.Vector2((t.x / innerWidth) * 2 - 1, -(t.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hitBoxes, false);
    const cart = curFloor === 0 && shopDist() < SHOP_NEAR_R && ray.intersectObject(shop.icon, false).length > 0;
    if ((hits.length || cart) && curFloor === 0) {
      log('input', { kind: 'tap', target: 'shop' });
      openShop();
    }
  }
}

let dirty = false;
function dirtySave(now) {
  dirty = true;
  if (now) doSave();
}
function doSave() {
  if (!saveAllowed) return;
  state.restockLeft = restockLeft;
  if (mode === 'loading') return;
  const ok = saveState(state);
  dirty = false;
  log('save', { ok });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    doSave();
    if (mode === 'play' && !ui.modalKind && !cine) openPause();
    audio.suspend(true);
  }
});
addEventListener('pagehide', () => doSave());

function accrueOffline() {
  let secs = 0;
  const forced = dbgVal('offline');
  if (forced) secs = Number(forced);
  else if (!loaded.fresh && !dbgOn) secs = Math.max(0, (Date.now() - (state.lastSeen || Date.now())) / 1000);
  if (secs >= 60) {
    const m = mult();
    let base = 0;
    for (const d of state.desks) if (d) base += CREATOR_BY_ID[d.id].inc * m;
    const capped = Math.min(secs, OFFLINE_CAP);
    const amount = Math.floor(base * capped * OFFLINE_RATE);
    if (amount >= 1) {
      state.pendingOffline = (state.pendingOffline || 0) + amount;
      log('offline', { seconds: Math.round(secs), counted: Math.round(capped), amount });
      dirtySave(true);
    }
  }
}

function offlineCheck() {
  const pending = Math.floor(state.pendingOffline || 0);
  if (pending < 1) return;
  ui.openOffline(pending, () => {
    const amt = Math.floor(state.pendingOffline || 0);
    state.pendingOffline = 0;
    state.money += amt;
    state.stats.earned += amt;
    overlay.fly(innerWidth / 2, innerHeight / 2, ui.el.money, 12, (k) => audio.coinTick(k), () => ui.punch());
    audio.collect(1);
    log('collect', { offline: true, amount: amt, cat: 'reward' });
    dirtySave(true);
  });
}

function applyDebug() {
  if (dbg('rebirth')) state.rebirths = clamp(Number(dbgVal('rebirth')) || 0, 0, MAX_REBIRTHS);
  const fl = dbg('floor') ? clamp(Number(dbgVal('floor')) || 1, 1, 12) : 0;
  if (fl > floorsFor(state.rebirths)) state.rebirths = fl - 1;
  if (dbg('rich')) state.money = dbgVal('rich') ? Number(dbgVal('rich')) : Math.max(state.money, rebirthCost(state.rebirths) * 3, 50000);
  if (dbg('rebirth') || fl || dbg('rich')) {
    state.tut = { buys: 5, collects: 5, sells: 1, rides: 3 };
    state.stats.bought = 5;
  }
  ensureFloors();
  if (dbg('fill') || dbg('viral') || dbg('offline')) {
    const pool = CREATORS.filter((c) => tierUnlocked(c.r, state.rebirths));
    for (let i = 0; i < state.desks.length; i++) {
      const def = pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length * 0.6 + pool.length * 0.4))];
      state.desks[i] = { id: def.id, subs: Math.round(1000 + Math.random() * 90000) };
      state.owned[def.id] = 1;
    }
    state.tut = { buys: 5, collects: 5, sells: 1, rides: 3 };
    state.stats.bought = Math.max(5, state.stats.bought);
  }
  if (dbg('book')) for (const c of CREATORS) if (c.r <= 2 && Math.random() < 0.8) state.owned[c.id] = 1;
  return fl;
}

function startGame() {
  if (mode !== 'title') return;
  audio.start();
  audio.setMusic(state.settings.music);
  audio.setSfx(state.settings.sfx);
  document.getElementById('title').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  mode = 'play';
  lastInputT = time;
  log('input', { kind: 'play' });
  log('state', { state: 'play' });
  updateCamera(0, 0);
  rig.snap(player.pos);
  offlineCheck();
  let warm = 0;
  const warmNext = () => {
    if (warm >= CREATORS.length || !thumbs) return;
    thumb(CREATORS[warm++]);
    setTimeout(warmNext, 250);
  };
  setTimeout(warmNext, 300);
  if (dbg('viral')) setTimeout(() => triggerViral(0), 1500);
  if (dbg('rebirthui')) setTimeout(() => openRebirth(), 800);
  if (dbg('book')) setTimeout(() => openBook(), 800);
  if (dbg('cine')) setTimeout(() => {
    state.money = Math.max(state.money, rebirthCost(state.rebirths));
    doRebirth();
  }, 800);
  if (dbg('shop') && !dbgVal('shop')) setTimeout(() => openShop(), 900);
}

document.getElementById('playBtn').addEventListener('click', () => startGame());

function init() {
  const fl = applyDebug();
  accrueOffline();
  ensureFloors();
  rebuildDesks();
  for (const id of state.waiting) if (CREATOR_BY_ID[id]) addWaitCreator(CREATOR_BY_ID[id]);
  if (!state.stock || dbgOn) restock(true);
  else updateShowcase();
  restockLeft = state.restockLeft > 0 ? state.restockLeft : RESTOCK_TIME;
  curFloor = fl ? fl - 1 : 0;
  if (fl) player.teleport(0, curFloor * H, 3.5, Math.PI);
  else player.teleport(SPAWN.x, 0, SPAWN.z, SPAWN.yaw);
  elevator.y = curFloor * H;
  displayMoney = state.money;
  audio.setStyle(THEMES[curFloor % THEMES.length].music);
  document.getElementById('btnMute').querySelector('span').innerHTML = ICONS[state.settings.music || state.settings.sfx ? 'sound' : 'mute'];
  titleCamera(0);
  const show = () => {
    document.getElementById('loading').classList.add('hidden');
    mode = 'title';
    log('state', { state: 'title' });
    if (dbg('play')) startGame();
    else document.getElementById('title').classList.remove('hidden');
  };
  renderer.compileAsync(scene, camera).then(show, show);
}

function titleCamera(dt) {
  const a = 0.55 + Math.sin(time * 0.08) * 0.35;
  const n = floors.length;
  const cy = Math.max(8, n * H * 0.45);
  camera.position.set(12 + Math.sin(a) * 58, cy + 10, Math.cos(a) * 58 + 8);
  camera.lookAt(12, cy - 2, 2);
}

let lastNow = performance.now();
let realDt = 0;
let fpsAcc = 0;
function frame() {
  requestAnimationFrame(frame);
  const nowT = performance.now();
  let dt = Math.min((nowT - lastNow) / 1000, 0.1);
  realDt = Math.min((nowT - lastNow) / 1000, 0.25);
  lastNow = nowT;
  const ft = dt * 1000;
  if (mode === 'play') {
    frameTimes.push(ft);
    if (frameTimes.length > 180) frameTimes.shift();
    playT += ft / 1000;
    if (playT < 1) frameTimes.length = 0;
    if (!qualityChecked && playT > 2.5 && frameTimes.length >= 20) {
      const s = [...frameTimes].sort((a, b) => a - b);
      const med = s[Math.floor(s.length / 2)];
      if (med > 25 && quality === 'high' && dbgVal('quality') !== 'high') {
        quality = 'low';
        applyQuality();
        log('quality', { level: 'low', medianMs: Math.round(med) });
      }
      qualityChecked = quality === 'low' || playT > 12;
    }
  }
  if (glLost || G.paused || (mode === 'play' && ui.modalKind && ui.modalKind !== 'rebirth' && ui.modalKind !== 'book' && ui.modalKind !== 'offline' && ui.modalKind !== 'shop')) dt = 0;
  if (mode === 'loading') return;
  time += dt;
  const inp = input.consume();
  if (inp.taps.length) handleTaps(inp.taps);
  const locked = mode !== 'play' || !!G.modal || !!elev || !!cine;
  if (mode === 'play' && !G.modal) {
    const ax = input.axis();
    if (Math.hypot(ax.x, ax.y) > 0.1) lastInputT = time;
    player.update(dt, ax, rig.viewYaw ?? rig.yaw, collide, locked, inp.jump);
  } else player.update(dt, { x: 0, y: 0 }, rig.yaw, collide, true, false);
  if (dt > 0) {
    updateShopRing(dt);
    updateWalkers(dt);
    if (mode === 'play') {
      tickIncome(dt);
      moneyFloor(dt);
      viralT -= dt;
      if (viralT <= 0) {
        viralT = VIRAL_MIN + Math.random() * (VIRAL_MAX - VIRAL_MIN);
        triggerViral();
      }
    }
    updateElevator(dt);
    particles.update(dt);
    flyers.update(dt);
  }
  if (cine) updateCine(dt);
  else updateVisibility();
  updateDeskVisuals(dt);
  if (mode === 'title') titleCamera(dt);
  else if (!cine) updateCamera(dt, inp.drag);
  updateSun();
  if (mode === 'play') {
    updateHUD(dt);
    updateGuide(dt);
  }
  updateLabels();
  extras.tip.material.color.setRGB(3 * (0.6 + 0.4 * Math.sin(time * 3)), 0.4, 0.5);
  saveT += dt;
  if (saveT > 5 && mode === 'play') {
    saveT = 0;
    doSave();
  }
  renderer.info.reset();
  composer.render();
}

function snapshot() {
  const r = (v) => Math.round(v * 100) / 100;
  return Object.freeze({
    state: cine ? 'cine' : G.paused ? 'paused' : ui.modalKind ? 'modal:' + ui.modalKind : mode,
    player: { pos: { x: r(player.pos.x), y: r(player.pos.y), z: r(player.pos.z) }, state: elev ? 'elevator' : player.state, floor: curFloor + 1, inside: isInside(), occluded: occHidden },
    camera: { pos: { x: r(camera.position.x), y: r(camera.position.y), z: r(camera.position.z) }, target: { x: r(rig.target.x), y: r(rig.target.y), z: r(rig.target.z) }, fov: camera.fov },
    money: Math.floor(state.money),
    perSecond: r(perSecond),
    rebirths: state.rebirths,
    multiplier: mult(),
    floor: curFloor + 1,
    floors: floorCount(),
    desks: state.desks.map((d, i) => (d ? { creator: d.id, name: CREATOR_BY_ID[d.id].name, rarity: RARITIES[CREATOR_BY_ID[d.id].r].name, viral: deskRT[i] && deskRT[i].viral > 0, arriving: !!(deskRT[i] && deskRT[i].arriving) } : null)),
    waiting: [...state.waiting],
    shop: { open: ui.modalKind === 'shop', restockIn: Math.ceil(restockLeft), stock: Object.fromEntries(Object.entries(state.stock || {}).filter(([, v]) => v > 0)) },
    prompt: curPrompt ? curPrompt.kind : null,
    promptInfo: curPrompt ? { kind: curPrompt.kind, target: curPrompt.target ?? null } : null,
    time: r(time),
    owned: Object.keys(state.owned).length,
    pages: pagesComplete(state.owned),
    rebirthCost: rebirthCost(state.rebirths),
    quality,
    render: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures },
    tut: { ...state.tut },
    goal: lastGoal,
    guide: lastGuide,
    fastest: goalStep().kind,
    events: events.slice(),
  });
}
Object.defineProperty(window, '__game', { get: snapshot, configurable: false });
if (dbgOn) {
  window.__dbg = {
    buy(id) {
      lastBuyAt = 0;
      const def = CREATOR_BY_ID[id];
      if (def) state.stock[id] = Math.max(1, stockOf(id));
      return buyDef(def, 'dbg');
    },
    ids: () => CREATORS.map((c) => c.id),
    tp(x, z, yaw) {
      player.teleport(x, curFloor * H, z, yaw);
      rig.snap(player.pos);
    },
    yawOff(v) {
      rig.yawOff = v;
      rig.idleDrag = -100;
    },
    chev: () => lastChev,
    walkers: () => walkers.length,
    soldOut(n) {
      for (const c of CREATORS.slice(0, n)) state.stock[c.id] = 0;
    },
    thumb: (id) => thumb(CREATOR_BY_ID[id]),
    place(i, id) {
      state.desks[i] = { id, subs: 1000 };
      placeCreator(i, CREATOR_BY_ID[id], false);
    },
  };
}
window.__perf = () => {
  const out = [];
  scene.children.forEach((c, idx) => {
    let tris = 0;
    let meshes = 0;
    c.traverseVisible((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += t * (o.isInstancedMesh ? o.count : 1);
      meshes++;
    });
    out.push([idx, c.type, c.children.length, meshes, Math.round(tris)]);
  });
  return out.sort((a, b) => b[4] - a[4]).slice(0, 14);
};

player.attach();
thumbs = new Thumbs();
log('boot', { phase: 'assets' });
applyQuality();
init();
applyQuality();
frame();
