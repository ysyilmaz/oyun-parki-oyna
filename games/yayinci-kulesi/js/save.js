import { CREATOR_BY_ID, MAX_REBIRTHS, DESKS_PER_FLOOR, RESTOCK_TIME, floorsFor } from './data.js';

const KEY = 'yayinciKulesi.v1';

export function defaultState() {
  return {
    v: 1,
    money: 50,
    rebirths: 0,
    desks: Array(8).fill(null),
    waiting: [],
    owned: {},
    stock: null,
    restockLeft: 0,
    pendingOffline: 0,
    settings: { music: true, sfx: true },
    tut: { buys: 0, collects: 0, sells: 0, rides: 0 },
    stats: { earned: 0, bought: 0, virals: 0 },
    lastSeen: Date.now(),
  };
}

const num = (v, d, lo = -Infinity, hi = Infinity) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function sanitizeSave(raw) {
  const s = defaultState();
  if (!obj(raw)) return s;
  s.money = num(raw.money, s.money, 0, 1e15);
  s.rebirths = Math.floor(num(raw.rebirths, 0, 0, MAX_REBIRTHS));
  const seats = floorsFor(s.rebirths) * DESKS_PER_FLOOR;
  s.desks = Array(seats).fill(null);
  if (Array.isArray(raw.desks)) {
    for (let i = 0; i < Math.min(seats, raw.desks.length); i++) {
      const x = raw.desks[i];
      if (obj(x) && typeof x.id === 'string' && CREATOR_BY_ID[x.id]) s.desks[i] = { id: x.id, subs: num(x.subs, 100, 0, 1e12) };
    }
  }
  s.waiting = Array.isArray(raw.waiting) ? raw.waiting.filter((id) => typeof id === 'string' && CREATOR_BY_ID[id]).slice(0, 12) : [];
  if (obj(raw.owned)) for (const k of Object.keys(raw.owned)) if (CREATOR_BY_ID[k] && raw.owned[k]) s.owned[k] = 1;
  for (const x of s.desks) if (x) s.owned[x.id] = 1;
  if (obj(raw.stock)) {
    s.stock = {};
    for (const k of Object.keys(CREATOR_BY_ID)) s.stock[k] = Math.floor(num(raw.stock[k], 0, 0, 999));
  }
  s.restockLeft = num(raw.restockLeft, 0, 0, RESTOCK_TIME);
  s.pendingOffline = num(raw.pendingOffline, 0, 0, 1e15);
  s.newFloor = Math.floor(num(raw.newFloor, 0, 0, floorsFor(s.rebirths) - 1));
  const st = obj(raw.settings) ? raw.settings : {};
  s.settings = { music: bool(st.music, true), sfx: bool(st.sfx, true) };
  const t = obj(raw.tut) ? raw.tut : {};
  s.tut = { buys: num(t.buys, 0, 0), collects: num(t.collects, 0, 0), sells: num(t.sells, 0, 0), rides: num(t.rides, 0, 0) };
  const sa = obj(raw.stats) ? raw.stats : {};
  s.stats = { earned: num(sa.earned, 0, 0), bought: num(sa.bought, 0, 0), virals: num(sa.virals, 0, 0) };
  s.lastSeen = num(raw.lastSeen, Date.now(), 0, Date.now());
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { state: defaultState(), fresh: true };
    return { state: sanitizeSave(JSON.parse(raw)), fresh: false };
  } catch (e) {
    return { state: defaultState(), fresh: true };
  }
}

export function saveState(s) {
  try {
    s.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch (e) {
    return false;
  }
}
