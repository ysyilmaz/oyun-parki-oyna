const KEY = 'turboYaris.v1';
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const ID = /^[a-z0-9_-]{1,32}$/;

const defaults = () => ({
  coins: 0,
  colors: ['red', 'blue', 'yellow'],
  tracks: ['beach'],
  best: {},
  bestRace: {},
  medals: {},
  color: 'red',
  track: 'beach',
  difficulty: 'easy',
  shake: true,
  muted: false,
  wins: 0,
  races: 0
});

const isId = v => typeof v === 'string' && ID.test(v);
const count = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 1e9) : null);
const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);

function idList(v, base) {
  if (!Array.isArray(v)) return base;
  const out = base.slice();
  for (const id of v) if (isId(id) && !out.includes(id)) out.push(id);
  return out;
}

function times(v) {
  const out = {};
  if (!isPlain(v)) return out;
  for (const [k, t] of Object.entries(v)) if (isId(k) && typeof t === 'number' && Number.isFinite(t) && t > 0) out[k] = t;
  return out;
}

function medals(v) {
  const out = {};
  if (!isPlain(v)) return out;
  for (const [track, m] of Object.entries(v)) {
    if (!isId(track) || !isPlain(m)) continue;
    const row = {};
    for (const d of DIFFICULTIES) if (Number.isInteger(m[d]) && m[d] >= 1 && m[d] <= 3) row[d] = m[d];
    if (Object.keys(row).length) out[track] = row;
  }
  return out;
}

export function sanitize(data) {
  const s = defaults();
  if (!isPlain(data)) return s;
  for (const k of ['coins', 'wins', 'races']) { const n = count(data[k]); if (n !== null) s[k] = n; }
  s.colors = idList(data.colors, s.colors);
  s.tracks = idList(data.tracks, s.tracks);
  s.best = times(data.best);
  s.bestRace = times(data.bestRace);
  s.medals = medals(data.medals);
  if (isId(data.color)) s.color = data.color;
  if (isId(data.track)) s.track = data.track;
  if (DIFFICULTIES.includes(data.difficulty)) s.difficulty = data.difficulty;
  for (const k of ['shake', 'muted']) if (typeof data[k] === 'boolean') s[k] = data[k];
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : defaults();
  } catch (e) {
    return defaults();
  }
}

export const save = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {
    return false;
  }
  return true;
}
