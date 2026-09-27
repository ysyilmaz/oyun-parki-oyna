export const RARITIES = [
  { id: 0, name: 'Sıradan', color: '#b8c0cc', glow: '#dfe6f0', dark: '#5d6675' },
  { id: 1, name: 'Nadir', color: '#2f8cff', glow: '#6fb6ff', dark: '#1447a8' },
  { id: 2, name: 'Epik', color: '#a24dff', glow: '#c98bff', dark: '#5a1ca8' },
  { id: 3, name: 'Efsane', color: '#ffb81f', glow: '#ffd75e', dark: '#a86400' },
  { id: 4, name: 'Gizli', color: '#ff4fa8', glow: '#ffffff', dark: '#6a2bd1', rainbow: true },
];

export const CREATORS = [
  { id: 'osman', name: 'Oyuncu Osman', r: 0, k: 0, niche: 'game', look: { skin: '#f2c29b', hair: 'spiky', hairC: '#2b1d14', top: 'hoodie', topC: '#3a4bff', acc: '#64f0ff', pants: '#23263a', shoes: '#ffffff', head: 'headset', prop: 'controller' } },
  { id: 'kaan', name: 'Kedici Kaan', r: 0, k: 1, niche: 'cat', look: { skin: '#e9b48d', hair: 'mop', hairC: '#e8a33a', top: 'hoodie', topC: '#ff8a3d', acc: '#fff1d6', pants: '#3a3350', shoes: '#ff5a5a', head: 'catears', prop: 'yarn' } },
  { id: 'sule', name: 'Şef Şule', r: 0, k: 2, niche: 'cook', look: { skin: '#f5cfb0', hair: 'bob', hairC: '#6b3a1f', top: 'chef', topC: '#ffffff', acc: '#ff4a4a', pants: '#2c2c3a', shoes: '#2c2c3a', head: 'chefhat', prop: 'pan' } },
  { id: 'kerem', name: 'Kaykaycı Kerem', r: 0, k: 3, niche: 'skate', look: { skin: '#c98e63', hair: 'short', hairC: '#1a1a1a', top: 'tee', topC: '#1fd67a', acc: '#101820', pants: '#3b5bdb', shoes: '#ff3b3b', head: 'capback', headC: '#ff3b3b', prop: 'skate' } },
  { id: 'ruya', name: 'Ressam Rüya', r: 0, k: 4, niche: 'art', look: { skin: '#f7d2b8', hair: 'long', hairC: '#b3261e', top: 'overall', topC: '#ffd23a', acc: '#4aa3ff', pants: '#4aa3ff', shoes: '#ffffff', head: 'beret', headC: '#ff4f9a', prop: 'palette' } },
  { id: 'firat', name: 'Futbolcu Fırat', r: 1, k: 5, niche: 'ball', look: { skin: '#d7a17a', hair: 'short', hairC: '#3a2216', top: 'jersey', topC: '#ff2e2e', acc: '#ffffff', pants: '#ffffff', shoes: '#1fe07a', head: 'band', headC: '#ffffff', prop: 'football' } },
  { id: 'gonca', name: 'Gitarcı Gonca', r: 1, k: 6, niche: 'music', look: { skin: '#f0c4a0', hair: 'pony', hairC: '#1d1030', top: 'jacket', topC: '#1c1c28', acc: '#ff3c7d', pants: '#25253a', shoes: '#ff3c7d', head: 'shades', prop: 'guitar' } },
  { id: 'baris', name: 'Bilimci Barış', r: 1, k: 7, niche: 'science', look: { skin: '#f3c9a5', hair: 'curly', hairC: '#6b4a2b', top: 'labcoat', topC: '#f4f7ff', acc: '#38e0c0', pants: '#2a3a5a', shoes: '#38e0c0', head: 'goggles', prop: 'flask' } },
  { id: 'deniz', name: 'Dansçı Deniz', r: 1, k: 8, niche: 'dance', look: { skin: '#8d5a3b', hair: 'afro', hairC: '#1b120c', top: 'tee', topC: '#ff49c8', acc: '#fff05a', pants: '#2b2b44', shoes: '#fff05a', head: 'sweatband', headC: '#fff05a', prop: 'mic' } },
  { id: 'umut', name: 'Uzaycı Umut', r: 1, k: 9, niche: 'space', look: { skin: '#f2c29b', hair: 'short', hairC: '#3b2a1c', top: 'suit', topC: '#eef2ff', acc: '#ff7a1f', pants: '#eef2ff', shoes: '#9aa6c7', head: 'helmet', prop: 'rocket' } },
  { id: 'doruk', name: 'DJ Doruk', r: 2, k: 10, niche: 'dj', look: { skin: '#e2a883', hair: 'spiky', hairC: '#7cf0ff', top: 'hoodie', topC: '#141428', acc: '#b44dff', pants: '#141428', shoes: '#b44dff', head: 'bigphones', prop: 'vinyl' } },
  { id: 'selin', name: 'Sihirbaz Selin', r: 2, k: 11, niche: 'magic', look: { skin: '#f7d6c0', hair: 'long', hairC: '#e9e6ff', top: 'robe', topC: '#4b2bd1', acc: '#ffd23a', pants: '#2a1a7a', shoes: '#ffd23a', head: 'wizard', headC: '#4b2bd1', prop: 'wand' } },
  { id: 'nehir', name: 'Ninja Nehir', r: 2, k: 12, niche: 'ninja', look: { skin: '#f0c7a4', hair: 'pony', hairC: '#111118', top: 'gi', topC: '#20232f', acc: '#ff2d55', pants: '#20232f', shoes: '#111118', head: 'ninjaband', headC: '#ff2d55', prop: 'shuriken' } },
  { id: 'sena', name: 'Süper Sena', r: 2, k: 13, niche: 'hero', look: { skin: '#f3cba9', hair: 'long', hairC: '#ffcf3a', top: 'hero', topC: '#2f6bff', acc: '#ff2e4d', pants: '#2f6bff', shoes: '#ff2e4d', head: 'mask', headC: '#ff2e4d', prop: 'cape' } },
  { id: 'efe', name: 'Ejderha Efe', r: 3, k: 14, niche: 'dragon', look: { skin: '#f2c29b', hair: 'short', hairC: '#1d3b1a', top: 'dragon', topC: '#1faa4a', acc: '#ffb81f', pants: '#146b30', shoes: '#ffb81f', head: 'dragonhood', headC: '#1faa4a', prop: 'egg' } },
  { id: 'kaya', name: 'Kozmik Kaya', r: 3, k: 15, niche: 'cosmic', look: { skin: '#9fd8ff', hair: 'mop', hairC: '#ff6ad5', top: 'suit', topC: '#1a1446', acc: '#63f5ff', pants: '#1a1446', shoes: '#63f5ff', head: 'antenna', headC: '#63f5ff', prop: 'planet' } },
  { id: 'riza', name: 'Robo Rıza', r: 3, k: 16, niche: 'robot', look: { skin: '#ffc21a', hair: 'none', hairC: '#e08a00', top: 'robo', topC: '#ffc21a', acc: '#35e0ff', pants: '#8a93a8', shoes: '#3a3f52', head: 'robohead', headC: '#ff3b5c', prop: 'none' } },
  { id: 'goktug', name: 'Gökkuşağı Göktuğ', r: 4, k: 17, niche: 'rainbow', look: { skin: '#f2c29b', hair: 'spiky', hairC: 'rainbow', top: 'hoodie', topC: '#ffffff', acc: 'rainbow', pants: '#1c1c2e', shoes: '#ffffff', head: 'headset', prop: 'star' } },
  { id: 'nil', name: 'Neon Nil', r: 4, k: 18, niche: 'neon', look: { skin: '#f7d2b8', hair: 'bob', hairC: '#39ff9f', top: 'jacket', topC: '#0d0d1a', acc: '#39ff9f', pants: '#0d0d1a', shoes: '#ff3cf0', head: 'visor', headC: '#ff3cf0', prop: 'bolt' } },
  { id: 'ayse', name: 'Altın Ayşe', r: 4, k: 19, niche: 'gold', look: { skin: '#e9b48d', hair: 'long', hairC: '#1b0f08', top: 'robe', topC: '#ffcf3a', acc: '#ffffff', pants: '#c98a00', shoes: '#ffffff', head: 'crown', headC: '#ffd23a', prop: 'trophy' } },
].map((c) => ({ ...c, price: Math.round(25 * Math.pow(2.3, c.k)), inc: Math.pow(2, c.k) }));

export const CREATOR_BY_ID = Object.fromEntries(CREATORS.map((c) => [c.id, c]));

export const THEMES = [
  { id: 'gaming', name: 'Oyun', floor: '#1b1733', floor2: '#241d45', wall: '#231c4a', wall2: '#2e2466', led: '#34f0ff', led2: '#ff3cf0', accent: '#7a5cff', music: 0 },
  { id: 'cooking', name: 'Mutfak', floor: '#f3ece2', floor2: '#e2d6c6', wall: '#ffe3c2', wall2: '#ffcf96', led: '#ffb13b', led2: '#ff5a3c', accent: '#ff6b3c', music: 1 },
  { id: 'sports', name: 'Spor', floor: '#2f9a47', floor2: '#2a8a40', wall: '#dff1ff', wall2: '#a9d6ff', led: '#ffffff', led2: '#2f7dff', accent: '#2f7dff', music: 2 },
  { id: 'music', name: 'Müzik', floor: '#2a1420', floor2: '#381a2a', wall: '#4a1426', wall2: '#6a1c34', led: '#ffcc33', led2: '#ff2e63', accent: '#ffcc33', music: 3 },
  { id: 'space', name: 'Uzay', floor: '#10152e', floor2: '#18204a', wall: '#0c1030', wall2: '#141a48', led: '#7df9ff', led2: '#a97dff', accent: '#7df9ff', music: 4 },
  { id: 'candy', name: 'Şeker', floor: '#ffe3f1', floor2: '#ffd0e8', wall: '#c9f3ff', wall2: '#9fe8ff', led: '#ff5fb8', led2: '#35d6ff', accent: '#ff5fb8', music: 5 },
];

export const DESKS_PER_FLOOR = 8;
export const MAX_FLOORS = 12;
export const DESK_CAP_SECONDS = 300;
export const VIRAL_MULT = 3;
export const VIRAL_TIME = 30;
export const VIRAL_MIN = 60;
export const VIRAL_MAX = 120;
export const OFFLINE_CAP = 7200;
export const OFFLINE_RATE = 0.5;
export const START_MONEY = 50;
export const REBIRTH_START_MONEY = 150;
export const RESTOCK_TIME = 120;
const STOCK_RANGE = [[3, 5], [2, 3], [1, 2], [0, 1], [0, 1]];

export function makeStock(rand, rebirths, money) {
  const st = {};
  for (const c of CREATORS) {
    if (!tierUnlocked(c.r, rebirths)) {
      st[c.id] = 0;
      continue;
    }
    const [a, b] = STOCK_RANGE[c.r];
    let n = a + Math.floor(rand() * (b - a + 1));
    if (c.r === 4) n = rand() < (rebirths >= 6 ? 0.45 : 0.2) ? 1 : 0;
    if (c.r === 3 && rebirths >= 4) n = Math.max(n, 1);
    st[c.id] = n;
  }
  const budget = Math.max(money, CREATORS[0].price);
  let cheap = CREATORS[0];
  for (const c of CREATORS) if (tierUnlocked(c.r, rebirths) && c.price <= budget && c.price > cheap.price) cheap = c;
  st[cheap.id] = Math.max(st[cheap.id], 1);
  st[CREATORS[0].id] = Math.max(st[CREATORS[0].id], 2);
  return st;
}
export const BULK_PLATE_REBIRTH = 3;
export const PAGE_BONUS = 0.1;
export const UNDO_TIME = 10;
export const SELL_HOLD = 1.0;

const REBIRTH_COSTS = [10000, 220000, 2200000, 16000000, 80000000, 200000000, 320000000, 420000000, 520000000, 640000000, 800000000];

export const MAX_REBIRTHS = REBIRTH_COSTS.length;

export function floorsFor(rebirths) {
  return Math.min(MAX_FLOORS, 1 + rebirths);
}

export function multiplier(rebirths) {
  return 1 + rebirths * 0.5;
}

export function rebirthCost(rebirths) {
  return rebirths < REBIRTH_COSTS.length ? REBIRTH_COSTS[rebirths] : Infinity;
}

const UNLOCK_AT = [0, 0, 1, 2, 4];

export function tierUnlocked(tier, rebirths) {
  return rebirths >= UNLOCK_AT[tier];
}

export function unlockRebirth(tier) {
  return UNLOCK_AT[tier];
}

export function pagesComplete(owned) {
  let n = 0;
  for (const r of RARITIES) if (CREATORS.filter((c) => c.r === r.id).every((c) => owned[c.id])) n++;
  return n;
}

export function totalMult(rebirths, owned) {
  return multiplier(rebirths) * (1 + PAGE_BONUS * pagesComplete(owned || {}));
}

export function incomeOf(def, mult) {
  return def.inc * mult;
}

export function sellPrice(def) {
  return Math.floor(def.price / 2);
}

const TIER_WEIGHTS = [
  [100, 25, 0, 0, 0],
  [100, 35, 12, 0, 0],
  [100, 40, 18, 4, 0],
  [100, 40, 22, 7, 0],
  [100, 40, 25, 10, 1.5],
  [100, 40, 25, 12, 2.5],
  [100, 40, 25, 12, 3.5],
];

export function newTierAt(rebirths) {
  for (let t = 2; t < 5; t++) if (UNLOCK_AT[t] === rebirths) return t;
  return -1;
}

export function pickSpawn(rand, rebirths, forceTier = -1) {
  const w = TIER_WEIGHTS[Math.min(TIER_WEIGHTS.length - 1, rebirths)];
  let tier = 0;
  if (forceTier >= 0) tier = forceTier;
  else {
    let total = 0;
    for (let i = 0; i < 5; i++) total += w[i];
    let x = rand() * total;
    for (let i = 0; i < 5; i++) {
      x -= w[i];
      if (x <= 0 && w[i] > 0) {
        tier = i;
        break;
      }
    }
  }
  const pool = CREATORS.filter((c) => c.r === tier);
  let sum = 0;
  const wts = pool.map((c, i) => (sum += Math.pow(0.5, i), Math.pow(0.5, i)));
  let x = rand() * sum;
  for (let i = 0; i < pool.length; i++) {
    x -= wts[i];
    if (x <= 0) return pool[i];
  }
  return pool[0];
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n >= 1e12) return Math.floor(n / 1e9).toLocaleString('tr-TR') + 'Mr';
  const [v, u] = n >= 1e9 ? [1e9, 'Mr'] : n >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const x = n / v;
  if (x >= 100) return Math.floor(x) + u;
  return (Math.floor(x * 10) / 10).toString().replace('.', ',') + u;
}

export function fmtMult(v) {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

export function fmtFull(n) {
  return Math.floor(n).toLocaleString('tr-TR');
}
