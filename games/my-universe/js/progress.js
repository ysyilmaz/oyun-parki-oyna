const KEY = 'my-universe-v1';
const DAY = 86400000;

export const CATALOG = {
  color: [
    { id: 'orange', name: 'Turuncu', price: 0, color: 0xff8a2a, css: '#ff8a2a' },
    { id: 'red', name: 'Kırmızı', price: 25, color: 0xff3348, css: '#ff3348' },
    { id: 'blue', name: 'Mavi', price: 25, color: 0x2f8cff, css: '#2f8cff' },
    { id: 'green', name: 'Yeşil', price: 30, color: 0x35d45a, css: '#35d45a' },
    { id: 'purple', name: 'Mor', price: 40, color: 0x9a55ff, css: '#9a55ff' },
    { id: 'pink', name: 'Pembe', price: 40, color: 0xff6ec7, css: '#ff6ec7' },
    { id: 'black', name: 'Gece', price: 60, color: 0x2a2f3a, css: '#2a2f3a', glow: 0x2244ff },
    { id: 'gold', name: 'Altın', price: 120, color: 0xffc21a, css: 'radial-gradient(circle at 35% 30%,#fff6b0,#ffc21a 55%,#c07800)', metal: true },
    { id: 'rainbow', name: 'Gökkuşağı', price: 200, rainbow: true, css: 'conic-gradient(#ff4d5e,#ffc21a,#3ddc5a,#36a2ff,#b86bff,#ff4d5e)' },
  ],
  hat: [
    { id: 'none', name: 'Yok', price: 0, css: 'repeating-linear-gradient(45deg,#e6ecf6 0 8px,#cfd8e8 8px 16px)' },
    { id: 'cap', svg: '<svg viewBox="0 0 48 48"><path d="M10 28a14 14 0 0128 0z" fill="#2f8cff" stroke="#1f2a44" stroke-width="3"/><path d="M8 28h34l6 6H10z" fill="#1b5fc0" stroke="#1f2a44" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="14" r="2.5" fill="#ffc21a"/></svg>', name: 'Kep', price: 35, css: 'linear-gradient(180deg,#2f8cff 55%,#1b5fc0 56%)' },
    { id: 'crown', svg: '<svg viewBox="0 0 48 48"><path d="M8 36V16l9 8 7-14 7 14 9-8v20z" fill="#ffc21a" stroke="#1f2a44" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="30" r="2.5" fill="#ff3348"/><circle cx="24" cy="30" r="2.5" fill="#36a2ff"/><circle cx="32" cy="30" r="2.5" fill="#3ddc5a"/></svg>', name: 'Taç', price: 90, css: 'linear-gradient(180deg,#fff2a8,#ffc21a 60%,#c07800)' },
    { id: 'wizard', svg: '<svg viewBox="0 0 48 48"><path d="M24 4l12 28H12z" fill="#5a2fd8" stroke="#1f2a44" stroke-width="3" stroke-linejoin="round"/><ellipse cx="24" cy="34" rx="18" ry="5" fill="#5a2fd8" stroke="#1f2a44" stroke-width="3"/><path d="M14 28h20" stroke="#ffc21a" stroke-width="4"/><circle cx="26" cy="16" r="2" fill="#fff3a0"/></svg>', name: 'Büyücü', price: 70, css: 'linear-gradient(180deg,#5a2fd8,#2d1a6b)' },
    { id: 'headset', svg: '<svg viewBox="0 0 48 48"><path d="M10 30V24a14 14 0 0128 0v6" fill="none" stroke="#ff4fd8" stroke-width="5" stroke-linecap="round"/><rect x="6" y="26" width="9" height="13" rx="4" fill="#8a2fb0" stroke="#1f2a44" stroke-width="3"/><rect x="33" y="26" width="9" height="13" rx="4" fill="#8a2fb0" stroke="#1f2a44" stroke-width="3"/></svg>', name: 'Kulaklık', price: 55, css: 'linear-gradient(180deg,#ff4fd8,#8a2fb0)' },
    { id: 'helmet', svg: '<svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="16" fill="#bfe4ff" stroke="#1f2a44" stroke-width="3" opacity="0.9"/><path d="M14 20q10-8 20 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 10V5" stroke="#8a93a8" stroke-width="3"/><circle cx="24" cy="4" r="2.5" fill="#ff3348"/><rect x="8" y="38" width="32" height="5" rx="2.5" fill="#d6dde8" stroke="#1f2a44" stroke-width="2"/></svg>', name: 'Uzay Kaskı', price: 110, css: 'radial-gradient(circle at 40% 35%,#ffffff,#bfe4ff 60%,#5aa8e8)' },
  ],
  cape: [
    { id: 'none', name: 'Yok', price: 0, css: 'repeating-linear-gradient(45deg,#e6ecf6 0 8px,#cfd8e8 8px 16px)' },
    { id: 'red', name: 'Kırmızı Pelerin', price: 50, color: 0xe8243a, css: '#e8243a' },
    { id: 'blue', name: 'Mavi Pelerin', price: 50, color: 0x2a6fe8, css: '#2a6fe8' },
    { id: 'star', name: 'Yıldızlı Pelerin', price: 90, color: 0x2a1a5a, stars: true, css: 'radial-gradient(circle at 30% 30%,#fff 0 6%,transparent 7%),radial-gradient(circle at 70% 60%,#fff 0 5%,transparent 6%),#2a1a5a' },
    { id: 'gold', name: 'Altın Pelerin', price: 150, color: 0xffc21a, metal: true, css: 'linear-gradient(135deg,#fff2a8,#ffc21a 50%,#c07800)' },
  ],
  pet: [
    { id: 'none', name: 'Yok', price: 0 },
    { id: 'kedi', name: 'Kedi', price: 60 },
    { id: 'kopek', name: 'Köpek', price: 60 },
    { id: 'tavsan', name: 'Tavşan', price: 80 },
    { id: 'tilki', name: 'Tilki', price: 120 },
    { id: 'kurbaga', name: 'Kurbağa', price: 100 },
    { id: 'panda', name: 'Panda', price: 160 },
    { id: 'unicorn', name: 'Tekboynuz', price: 260 },
    { id: 'ormanEjder', name: 'Ejderha', price: 320 },
  ],
};

export function xpNeed(level) {
  return 80 + 40 * (level - 1);
}

function defaults() {
  return {
    v: 1,
    xp: 0,
    level: 1,
    coins: 0,
    owned: { color: ['orange'], hat: ['none'], cape: ['none'], pet: ['none'] },
    eq: { color: 'orange', hat: 'none', cape: 'none', pet: 'none' },
    portals: {},
    games: {},
    plays: [],
    muted: false,
    learned: false,
  };
}

export class Progress {
  constructor() {
    this.s = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = defaults();
        const p = JSON.parse(raw);
        this.s = { ...d, ...p, owned: { ...d.owned, ...(p.owned || {}) }, eq: { ...d.eq, ...(p.eq || {}) }, portals: p.portals || {}, games: p.games || {}, plays: p.plays || [] };
      }
    } catch (e) {
      this.s = defaults();
    }
    this.timer = null;
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch (e) {
      return false;
    }
    return true;
  }

  persistSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.persist(), 600);
  }

  get level() {
    return this.s.level;
  }

  get coins() {
    return this.s.coins;
  }

  xpFrac() {
    return this.s.xp / xpNeed(this.s.level);
  }

  addXp(n) {
    this.s.xp += n;
    let gained = 0;
    while (this.s.xp >= xpNeed(this.s.level)) {
      this.s.xp -= xpNeed(this.s.level);
      this.s.level++;
      gained++;
    }
    this.persistSoon();
    return gained;
  }

  addCoins(n) {
    this.s.coins += n;
    this.persistSoon();
  }

  spend(n) {
    if (this.s.coins < n) return false;
    this.s.coins -= n;
    this.persist();
    return true;
  }

  owns(cat, id) {
    return this.s.owned[cat].includes(id);
  }

  own(cat, id) {
    if (!this.owns(cat, id)) this.s.owned[cat].push(id);
    this.persist();
  }

  equip(cat, id) {
    this.s.eq[cat] = id;
    this.persist();
  }

  equipped(cat) {
    const list = CATALOG[cat];
    return list.find((x) => x.id === this.s.eq[cat]) || list[0];
  }

  portalOpen(game) {
    if (!game.unlock) return true;
    if (this.s.portals[game.id]) return true;
    if (game.unlock.level && this.s.level >= game.unlock.level) return true;
    return false;
  }

  unlockPortal(id) {
    this.s.portals[id] = true;
    this.persist();
  }

  game(id) {
    if (!this.s.games[id]) this.s.games[id] = { done: {}, best: {}, plays: 0 };
    return this.s.games[id];
  }

  recordPlay(id) {
    const g = this.game(id);
    g.plays++;
    this.s.plays.push({ g: id, t: Date.now() });
    if (this.s.plays.length > 3000) this.s.plays.splice(0, this.s.plays.length - 3000);
    this.persist();
  }

  stageDone(id, stage, time) {
    const g = this.game(id);
    const first = !g.done[stage];
    g.done[stage] = true;
    const record = !g.best[stage] || time < g.best[stage];
    if (record) g.best[stage] = time;
    this.persist();
    return { first, record: record && !first };
  }

  stageOpen(id, stage) {
    return stage === 1 || !!this.game(id).done[stage - 1];
  }

  mostPlayed(days) {
    const since = Date.now() - days * DAY;
    const count = {};
    for (const p of this.s.plays) if (p.t >= since) count[p.g] = (count[p.g] || 0) + 1;
    let best = null;
    for (const [g, n] of Object.entries(count)) if (!best || n > best.count) best = { id: g, count: n };
    return best;
  }
}
