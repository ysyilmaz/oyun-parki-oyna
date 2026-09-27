import { SPECIES, ZONES, UPGRADES, VARIANTS } from './data.js';

const KEY = 'petAdasi.v1';

export function defaultState() {
  return {
    coins: 0,
    gems: 0,
    pets: [{ uid: 1, sp: 'kedi', v: 0 }],
    equipped: [1],
    nextUid: 2,
    zones: 1,
    up: { slots: 0, petSpeed: 0, coinMult: 0, walk: 0, magnet: 0 },
    seen: { kedi: 1 },
    pity: {},
    pityE: 0,
    pityL: 0,
    hatched: 0,
    rebirths: 0,
    settings: { music: true, sfx: true, quality: 'high', shake: true },
    tutorial: 0,
    stats: { broken: 0, coinsTotal: 0 },
  };
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x, min, max, def) => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const int = (x, min, max, def) => Math.floor(num(x, min, max, def));
const bool = (x, def) => (typeof x === 'boolean' ? x : def);

export function sanitizeState(s) {
  const base = defaultState();
  if (!isObj(s)) return base;
  const out = { ...base };
  out.coins = num(s.coins, 0, 1e15, 0);
  out.gems = int(s.gems, 0, 1e12, 0);
  out.zones = int(s.zones, 1, ZONES.length, 1);
  out.hatched = int(s.hatched, 0, 1e9, 0);
  out.rebirths = int(s.rebirths, 0, 60, 0);
  out.pityE = int(s.pityE, 0, 1e6, 0);
  out.pityL = int(s.pityL, 0, 1e6, 0);
  out.tutorial = int(s.tutorial, 0, 1e6, 0);
  const up = isObj(s.up) ? s.up : {};
  out.up = {};
  for (const u of UPGRADES) out.up[u.id] = int(up[u.id], 0, u.max, 0);
  const seenUid = new Set();
  const pets = [];
  for (const p of Array.isArray(s.pets) ? s.pets : []) {
    if (!isObj(p) || typeof p.sp !== 'string' || !Object.hasOwn(SPECIES, p.sp)) continue;
    const uid = int(p.uid, 1, Number.MAX_SAFE_INTEGER, 0);
    if (!uid || seenUid.has(uid)) continue;
    seenUid.add(uid);
    pets.push({ uid, sp: p.sp, v: int(p.v, 0, VARIANTS.length - 1, 0), xp: num(p.xp, 0, 1e12, 0) });
  }
  out.pets = pets.length ? pets : base.pets;
  const uids = new Set(out.pets.map((p) => p.uid));
  const slots = 3 + out.up.slots;
  const eq = [];
  for (const u of Array.isArray(s.equipped) ? s.equipped : []) {
    const n = int(u, 1, Number.MAX_SAFE_INTEGER, 0);
    if (uids.has(n) && !eq.includes(n) && eq.length < slots) eq.push(n);
  }
  out.equipped = eq.length ? eq : [out.pets[0].uid];
  out.nextUid = Math.max(int(s.nextUid, 1, Number.MAX_SAFE_INTEGER, 1), ...out.pets.map((p) => p.uid + 1));
  out.seen = {};
  if (isObj(s.seen)) for (const k of Object.keys(s.seen)) if (Object.hasOwn(SPECIES, k)) out.seen[k] = 1;
  for (const p of out.pets) out.seen[p.sp] = 1;
  const st = isObj(s.settings) ? s.settings : {};
  out.settings = {
    music: bool(st.music, base.settings.music),
    sfx: bool(st.sfx, base.settings.sfx),
    quality: st.quality === 'low' ? 'low' : 'high',
    shake: bool(st.shake, base.settings.shake),
  };
  if (st.hintDone === true) out.settings.hintDone = true;
  const stats = isObj(s.stats) ? s.stats : {};
  out.stats = { broken: int(stats.broken, 0, 1e12, 0), coinsTotal: num(stats.coinsTotal, 0, 1e18, 0) };
  if (stats.sentPets != null) out.stats.sentPets = int(stats.sentPets, 0, 1e12, 0);
  out.pity = isObj(s.pity) ? s.pity : {};
  return out;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return sanitizeState(JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

export function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    return false;
  }
  return true;
}
