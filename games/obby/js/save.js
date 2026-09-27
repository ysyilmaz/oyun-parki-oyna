const KEY = 'gokyuzu-parkuru-v1';

export const SKINS = [
  { id: 'orange', name: 'Turuncu', price: 0, color: 0xff8a2a, css: '#ff8a2a' },
  { id: 'red', name: 'Kasket', price: 15, color: 0xff3348, acc: 'cap', css: '#ff3348' },
  { id: 'blue', name: 'Kulaklık', price: 25, color: 0x2f8cff, acc: 'phones', css: '#2f8cff' },
  { id: 'green', name: 'Pervane', price: 30, color: 0x35d45a, acc: 'propeller', css: '#35d45a' },
  { id: 'purple', name: 'Kedi', price: 40, color: 0x9a55ff, acc: 'ears', css: '#9a55ff' },
  { id: 'pink', name: 'Fiyonk', price: 40, color: 0xff6ec7, acc: 'bow', css: '#ff6ec7' },
  { id: 'black', name: 'Ninja', price: 60, color: 0x2a2f3a, css: '#2a2f3a', glow: 0x2244ff, acc: 'band' },
  { id: 'gold', name: 'Kral', price: 120, stars: 6, color: 0xffc21a, acc: 'crown', css: 'radial-gradient(circle at 35% 30%,#fff6b0,#ffc21a 55%,#c07800)', metal: true },
  { id: 'rainbow', name: 'Roket', price: 200, stars: 9, rainbow: true, acc: 'jet', css: 'conic-gradient(#ff4d5e,#ffc21a,#3ddc5a,#36a2ff,#b86bff,#ff4d5e)' },
];

export const TRAILS = [
  { id: 'none', name: 'Yok', price: 0, css: 'repeating-linear-gradient(45deg,#e6ecf6 0 8px,#cfd8e8 8px 16px)' },
  { id: 'stars', name: 'Yıldız', price: 50, colors: [0xfff3a0, 0xffffff, 0xffd22e], css: 'radial-gradient(circle,#fff 0 18%,#ffd22e 20% 45%,#ff9f1a 47%)' },
  { id: 'fire', name: 'Ateş', price: 80, colors: [0xff4a1a, 0xffa01a, 0xffe04a], rise: true, css: 'radial-gradient(circle at 50% 70%,#fff27a 0 20%,#ff9f1a 22% 50%,#ff3b1a 52%)' },
  { id: 'ice', name: 'Kar', price: 80, colors: [0xbff0ff, 0xffffff, 0x6ad0ff], css: 'radial-gradient(circle,#fff 0 25%,#9ae4ff 27% 55%,#2f8cff 57%)' },
  { id: 'neon', name: 'Neon', price: 150, colors: [0x35e0ff, 0xff4fd8, 0xffffff], css: 'radial-gradient(circle at 35% 35%,#fff 0 14%,#35e0ff 16% 48%,#ff4fd8 50%)' },
];

function defaults() {
  return {
    coins: 0,
    finished: {},
    best: {},
    stars: {},
    owned: { color: ['orange'], trail: ['none'] },
    color: 'orange',
    trail: 'none',
    muted: false,
    selected: 1,
  };
}

const num = (v, def = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : def);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const ints = (v) => (Array.isArray(v) ? v.filter((i) => Number.isInteger(i) && i >= 0) : []);

function numMap(v, pick) {
  const out = {};
  for (const [k, x] of Object.entries(obj(v))) if (/^[123]$/.test(k) && pick(x)) out[k] = x;
  return out;
}

function ownedIds(v, list, base) {
  const ids = Array.isArray(v) ? v.map((t) => (t === 'rainbow' && list === TRAILS ? 'neon' : t)) : [];
  return [...new Set([base, ...ids.filter((t) => list.some((x) => x.id === t))])];
}

function progress(v) {
  if (!v || typeof v !== 'object') return null;
  const w = v.w;
  if (![1, 2, 3].includes(w) || !Number.isInteger(v.cp) || v.cp < 0) return null;
  return { w, cp: v.cp, taken: ints(v.taken), big: ints(v.big), coins: Math.floor(num(v.coins)), deaths: Math.floor(num(v.deaths)), time: num(v.time) };
}

export function loadSave() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = obj(JSON.parse(raw));
    const own = obj(s.owned);
    const owned = { color: ownedIds(own.color, SKINS, 'orange'), trail: ownedIds(own.trail, TRAILS, 'none') };
    const trail = s.trail === 'rainbow' ? 'neon' : s.trail;
    return {
      ...d,
      coins: Math.floor(num(s.coins)),
      finished: numMap(s.finished, (x) => x === true),
      best: numMap(s.best, (x) => num(x, -1) > 0),
      stars: numMap(s.stars, (x) => Number.isInteger(x) && x >= 0 && x <= 3),
      owned,
      color: owned.color.includes(s.color) ? s.color : d.color,
      trail: owned.trail.includes(trail) ? trail : d.trail,
      muted: s.muted === true,
      selected: [1, 2, 3].includes(s.selected) ? s.selected : 1,
      learned: s.learned === true,
      progress: progress(s.progress),
    };
  } catch (e) {
    return d;
  }
}

export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    return false;
  }
  return true;
}
