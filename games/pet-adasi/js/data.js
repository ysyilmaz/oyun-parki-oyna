export const ZONE_W = 70;
export const Z_MIN = -24;
export const Z_MAX = 27;

export const RARITIES = [
  { id: 'common', name: 'Sıradan', color: '#b8c2cc', glow: null },
  { id: 'uncommon', name: 'Özel', color: '#4fd964', glow: 0x4fd964 },
  { id: 'rare', name: 'Nadir', color: '#3aa0ff', glow: 0x2f8cff },
  { id: 'epic', name: 'Epik', color: '#b45cff', glow: 0xa64dff },
  { id: 'legendary', name: 'Efsanevi', color: '#ffb31a', glow: 0xffb000 },
  { id: 'mythic', name: 'Mitik', color: '#ff4fd8', glow: 0xff4fd8 },
];

export const VARIANTS = [
  { id: 0, name: '', mult: 1 },
  { id: 1, name: 'Altın', mult: 2.5 },
  { id: 2, name: 'Gökkuşağı', mult: 6 },
];

export const ZONES = [
  {
    name: 'Çayır', gate: 0, music: 0,
    ground: ['#4cb63a', '#79d24a'], hill: '#4fa843', path: '#dcb577', edge: '#b9e07a',
    fog: 0xbfe6ff,
  },
  {
    name: 'Orman', gate: 900, music: 1,
    ground: ['#2f8a36', '#4aa83e'], hill: '#2c7033', path: '#a9794d', edge: '#6fb34a',
    fog: 0xb5e0d0,
  },
  {
    name: 'Çöl', gate: 4500, music: 2,
    ground: ['#eac47a', '#f6da98'], hill: '#e0ad62', path: '#c8904f', edge: '#f3d79a',
    fog: 0xffe2b8,
  },
  {
    name: 'Karlı Dağ', gate: 28000, music: 3,
    ground: ['#e6f0fa', '#ffffff'], hill: '#d4e3f2', path: '#a9c4e0', edge: '#f4f9ff',
    fog: 0xdfeeff,
  },
  {
    name: 'Şeker Diyarı', gate: 180000, music: 4,
    ground: ['#ff9fcf', '#ffc3e2'], hill: '#9fe8cf', path: '#fff1a8', edge: '#ffd6ec',
    fog: 0xffd9f0,
  },
  {
    name: 'Kristal Mağara', gate: 1200000, music: 5,
    ground: ['#3d2f6e', '#54428f'], hill: '#2b2152', path: '#6fd8ff', edge: '#4a3a82',
    fog: 0x9a8fd8,
  },
];

export const SPECIES = {
  kedi: { name: 'Kedi', base: 'cat', c: ['#ffb46b', '#fff1dc', '#ff8fa3'] },
  kopek: { name: 'Köpek', base: 'dog', c: ['#c98a55', '#f7e3c7', '#6b4226'] },
  tavsan: { name: 'Tavşan', base: 'bunny', c: ['#f4f4f8', '#ffffff', '#ff9ec0'] },
  tilki: { name: 'Tilki', base: 'fox', c: ['#ff7a2e', '#fff4e6', '#3a2a22'] },
  unicorn: { name: 'Tekboynuz', base: 'unicorn', c: ['#ffffff', '#fff6fb', '#ffd23f'], mane: ['#ff6fb5', '#ffb3e0', '#9d7bff', '#6fd3ff'] },

  ayi: { name: 'Ayı', base: 'bear', c: ['#9a6a45', '#e3c29b', '#5c3b25'] },
  kurbaga: { name: 'Kurbağa', base: 'frog', c: ['#6ad14b', '#d8f59a', '#ff7aa2'] },
  panda: { name: 'Panda', base: 'panda', c: ['#ffffff', '#ffffff', '#262833'] },
  papagan: { name: 'Papağan', base: 'bird', c: ['#ff4a3a', '#ffd23a', '#fff6e8'], wing: '#2f8cff', wingTip: '#ffd23a' },
  ormanEjder: { name: 'Orman Ejderhası', base: 'dragon', c: ['#3ccf6e', '#d4f7a8', '#ffd84a'], wing: '#2a9d57' },

  colTilki: { name: 'Çöl Tilkisi', base: 'fennec', c: ['#f0c58a', '#fff6e8', '#ffb1a1'] },
  kumKedi: { name: 'Kum Kedisi', base: 'cat', c: ['#e3b27a', '#fff3df', '#ff9fb0'], extra: 'scarf', ex: '#2fb6c9', ears: 1.7 },
  flamingo: { name: 'Flamingo', base: 'flamingo', c: ['#ff8fc0', '#ffc6de', '#2a2a35'], wing: '#ff74ae', wingTip: '#2a2a35' },
  firavun: { name: 'Firavun Kedisi', base: 'cat', c: ['#3a3450', '#5a5275', '#ffcf3f'], extra: 'crown', ex: '#ffcf3f' },
  gunesEjder: { name: 'Güneş Ejderhası', base: 'dragon', c: ['#ff8a1f', '#ffe08a', '#fff15c'], wing: '#ff4e1f' },

  penguen: { name: 'Penguen', base: 'penguin', c: ['#2c3550', '#ffffff', '#ffa31a'] },
  kutupAyi: { name: 'Kutup Ayısı', base: 'bear', c: ['#f4f8ff', '#ffffff', '#9fb4cc'], extra: 'scarf', ex: '#e8443a' },
  karTavsan: { name: 'Kar Tavşanı', base: 'bunny', c: ['#e8f3ff', '#ffffff', '#9fd0ff'], extra: 'scarf', ex: '#3a8bff' },
  leylek: { name: 'Leylek', base: 'stork', c: ['#ffffff', '#eef2fa', '#ff8a1f'], wing: '#f4f6fb', wingTip: '#23232e' },
  buzUnicorn: { name: 'Buz Tekboynuzu', base: 'unicorn', c: ['#dff4ff', '#ffffff', '#8fe3ff'], mane: ['#6fd3ff', '#b3ecff', '#ffffff', '#8fb4ff'] },

  sekerTavsan: { name: 'Şeker Tavşanı', base: 'bunny', c: ['#ffb3d6', '#fff0f7', '#ff5fa2'], extra: 'bow', ex: '#ff3d8b' },
  pamukAyi: { name: 'Pamuk Ayı', base: 'bear', c: ['#ffc7e3', '#fff0f8', '#ff7ab8'], extra: 'bow', ex: '#8f6bff' },
  sekerKedi: { name: 'Şeker Kedisi', base: 'cat', c: ['#b9f0e0', '#ffffff', '#ff8fc8'], extra: 'crown', ex: '#ff6fb5' },
  gokUnicorn: { name: 'Gökkuşağı Tekboynuz', base: 'unicorn', c: ['#fff4fb', '#ffffff', '#ffe066'], mane: ['#ff4f4f', '#ffb14f', '#fff14f', '#5fe36a', '#4fb6ff', '#a45cff'] },
  sekerEjder: { name: 'Şeker Ejderhası', base: 'dragon', c: ['#ff7ac0', '#ffe3f2', '#7ee6ff'], wing: '#b67bff' },

  kristalKedi: { name: 'Kristal Kedi', base: 'cat', c: ['#8fe9ff', '#d9fbff', '#ff9fe8'], crystal: true },
  kristalTilki: { name: 'Kristal Tilki', base: 'fox', c: ['#c58bff', '#f1e0ff', '#6a3fb0'], crystal: true },
  kristalPanda: { name: 'Kristal Panda', base: 'panda', c: ['#e8f7ff', '#ffffff', '#5b4fd6'], crystal: true },
  ruzgarAti: { name: 'Rüzgar Atı', base: 'pony', c: ['#e8f6ff', '#ffffff', '#bfe8ff'], mane: ['#5fd3ff', '#b3ecff', '#ffffff', '#8fb4ff'], noHorn: true, wing: '#cfeeff', wingTip: '#ffffff' },
  kristalEjder: { name: 'Kristal Ejderha', base: 'dragon', c: ['#7af0ff', '#e6fdff', '#ff8af0'], wing: '#b58bff', crystal: true },
  galaksiEjder: { name: 'Galaksi Ejderhası', base: 'dragon', c: ['#2b1d6e', '#8f7bff', '#ff5fe0'], wing: '#ff4fd8', crystal: true },
};

const ODDS5 = [55, 28, 12, 4.5, 0.5];

export const EGGS = [
  { zone: 0, name: 'Çayır Yumurtası', price: 50, colors: ['#8fe06a', '#fff6c9'], pets: [['kedi', 0, 2], ['kopek', 1, 3], ['tavsan', 2, 5], ['tilki', 3, 9], ['unicorn', 4, 28]] },
  { zone: 1, name: 'Orman Yumurtası', price: 380, colors: ['#3fae5a', '#b5e38a'], pets: [['ayi', 0, 9], ['kurbaga', 1, 12], ['panda', 2, 19], ['papagan', 3, 34], ['ormanEjder', 4, 90]] },
  { zone: 2, name: 'Çöl Yumurtası', price: 2600, colors: ['#f2c46e', '#ff9d4a'], pets: [['colTilki', 0, 32], ['kumKedi', 1, 40], ['flamingo', 2, 68], ['firavun', 3, 125], ['gunesEjder', 4, 300]] },
  { zone: 3, name: 'Kar Yumurtası', price: 17000, colors: ['#e6f4ff', '#7cc4ff'], pets: [['penguen', 0, 115], ['kutupAyi', 1, 140], ['karTavsan', 2, 240], ['leylek', 3, 440], ['buzUnicorn', 4, 1000]] },
  { zone: 4, name: 'Şeker Yumurtası', price: 110000, colors: ['#ff8cc8', '#9ff0d8'], pets: [['sekerTavsan', 0, 420], ['pamukAyi', 1, 500], ['sekerKedi', 2, 860], ['gokUnicorn', 3, 1600], ['sekerEjder', 4, 3800]] },
  { zone: 5, name: 'Kristal Yumurta', price: 700000, colors: ['#7d5cff', '#6fe8ff'], pets: [['kristalKedi', 0, 1600], ['kristalTilki', 1, 1900], ['kristalPanda', 2, 3400], ['ruzgarAti', 3, 6400], ['kristalEjder', 4, 16000], ['galaksiEjder', 5, 60000]], odds: [55, 28, 12, 4.4, 0.5, 0.1] },
];

for (const egg of EGGS) {
  if (!egg.odds) egg.odds = ODDS5;
}

export const GOLD_EGG = { name: 'Altın Yumurta', gems: 25, odds: [30, 30, 22, 13, 5], colors: ['#ffd84a', '#ff9d1a'] };

export const PITY_EGGS = 20;
export const PITY_LEG = 60;
export const GOLDEN_CHANCE = 0.02;
export const MERGE_COUNT = 5;

export const BREAKABLES = {
  coins: { name: 'Para Yığını', hp: 9, coins: 6, gems: 0, r: 1.3, weight: 5 },
  gift: { name: 'Hediye', hp: 34, coins: 20, hp0: 18, coins0: 20, gems: 0, r: 1.25, weight: 3 },
  chest: { name: 'Hazine Sandığı', hp: 90, coins: 55, hp0: 34, coins0: 35, gems: 0, r: 1.5, weight: 2 },
  crystal: { name: 'Kristal', hp: 45, coins: 12, hp0: 22, coins0: 12, gems: 1, r: 1.3, weight: 1.4 },
  diamond: { name: 'Dev Elmas', hp: 600, coins: 320, hp0: 300, coins0: 160, gems: 6, r: 2.1, weight: 0 },
};

export const ZONE_HP = [1, 8, 62, 470, 3600, 28000];
export const ZONE_REWARD = [2, 6.5, 44, 290, 2000, 14500];

export const UPGRADES = [
  { id: 'slots', name: 'Pet Yuvası', icon: 'paw', max: 5, costs: [150, 550, 5000, 60000, 600000], desc: (l) => `${3 + l} pet → ${4 + l} pet` },
  { id: 'petSpeed', name: 'Pet Hızı', icon: 'bolt', max: 5, costs: [300, 2500, 20000, 160000, 1200000], desc: (l) => `+%${l * 20} → +%${(l + 1) * 20}` },
  { id: 'coinMult', name: 'Para Çarpanı', icon: 'coin', max: 5, costs: [400, 3500, 30000, 240000, 1800000], desc: (l) => `x${(1 + l * 0.3).toFixed(1)} → x${(1 + (l + 1) * 0.3).toFixed(1)}` },
  { id: 'walk', name: 'Koşu Hızı', icon: 'boot', max: 4, costs: [200, 2000, 18000, 150000], desc: (l) => `+%${l * 15} → +%${(l + 1) * 15}` },
  { id: 'magnet', name: 'Pet Menzili', icon: 'magnet', max: 4, costs: [250, 2200, 22000, 180000], desc: (l) => `${10 + l * 3} m → ${13 + l * 3} m` },
];

export const REBIRTH_BASE = 10000000;
export const MAX_LEVEL = 25;

export function petLevel(xp = 0) {
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp / 6)));
}

export function levelXp(level) {
  return level * level * 6;
}

export function petPower(entry, variant, xp = 0) {
  return Math.round(entry[2] * VARIANTS[variant].mult * (1 + petLevel(xp) * 0.04));
}

export function findPetDef(speciesId) {
  for (const egg of EGGS) {
    for (const p of egg.pets) if (p[0] === speciesId) return { egg, entry: p };
  }
  return null;
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n >= 1e9) return Math.floor(n / 1e6).toLocaleString('tr-TR') + 'M';
  const [v, u] = n >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const x = n / v;
  if (x >= 100) return Math.floor(x) + u;
  return (Math.floor(x * 10) / 10).toString().replace('.', ',') + u;
}
