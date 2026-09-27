import { WORLDS } from './themes.js';
import { SKINS, TRAILS } from './save.js';

const $ = (id) => document.getElementById(id);

const ART = {
  1: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w1s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f95ff"/><stop offset="1" stop-color="#c6ecff"/></linearGradient></defs><rect width="180" height="150" fill="url(#w1s)"/><circle cx="146" cy="30" r="16" fill="#fff6c4"/><ellipse cx="40" cy="36" rx="26" ry="10" fill="#fff"/><ellipse cx="56" cy="30" rx="16" ry="10" fill="#fff"/><path d="M18 88h58l-8 26-21 16-21-16z" fill="#8a5a36"/><rect x="14" y="80" width="66" height="12" rx="6" fill="#56c23a"/><path d="M100 70h64l-9 30-23 18-23-18z" fill="#8a5a36"/><rect x="96" y="62" width="72" height="12" rx="6" fill="#56c23a"/><circle cx="140" cy="46" r="13" fill="#3a9e3a"/><rect x="137" y="52" width="6" height="12" fill="#7a4a2a"/><rect x="60" y="102" width="30" height="10" rx="4" fill="#ffc21a"/></svg>`,
  2: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w2s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1238"/><stop offset="1" stop-color="#ff7a3a"/></linearGradient></defs><rect width="180" height="150" fill="url(#w2s)"/><path d="M0 116q30-10 60 0t60 0 60 0v34H0z" fill="#ff5a1a"/><path d="M0 124q30-8 60 0t60 0 60 0v26H0z" fill="#ffc23a"/><rect x="28" y="40" width="26" height="80" fill="#6b5f73"/><path d="M24 42l17-24 17 24z" fill="#c8283a"/><rect x="36" y="58" width="10" height="14" rx="5" fill="#ffb040"/><rect x="120" y="54" width="24" height="66" fill="#6b5f73"/><path d="M116 56l16-22 16 22z" fill="#c8283a"/><rect x="127" y="70" width="10" height="13" rx="5" fill="#ffb040"/><rect x="66" y="92" width="44" height="8" rx="4" fill="#ff4a1a"/></svg>`,
  3: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w3s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05061c"/><stop offset="1" stop-color="#3a2a8a"/></linearGradient></defs><rect width="180" height="150" fill="url(#w3s)"/><circle cx="136" cy="40" r="22" fill="#ff9a5a"/><ellipse cx="136" cy="40" rx="36" ry="7" fill="none" stroke="#ffd28a" stroke-width="3"/><circle cx="20" cy="20" r="1.6" fill="#fff"/><circle cx="60" cy="14" r="1.2" fill="#fff"/><circle cx="90" cy="34" r="1.8" fill="#fff"/><circle cx="36" cy="54" r="1.2" fill="#fff"/><path d="M20 96h60l-10 30-20 12-20-12z" fill="#6a8aff"/><rect x="16" y="88" width="68" height="10" rx="5" fill="#eaf6ff"/><path d="M40 88l6-22 6 22z" fill="#35e0ff"/><path d="M54 88l4-14 4 14z" fill="#ff4fd8"/><rect x="100" y="98" width="56" height="10" rx="5" fill="#1b1f3a" stroke="#35e0ff" stroke-width="3"/></svg>`,
};

export class UI {
  constructor(game) {
    this.g = game;
    this.shopTab = 'color';
    this.shopSel = null;
    this.hintTimer = null;
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b) b.blur();
    });
    document.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.blur();
        this.g.audio.unlock();
        this.g.action(el.dataset.action);
      });
    });
    $('playBtn').addEventListener('click', () => {
      this.g.audio.unlock();
      this.g.audio.click();
      this.g.play(this.g.menuWorld);
    });
    $('shopBtn').addEventListener('click', () => {
      this.g.audio.unlock();
      this.g.audio.click();
      this.g.openShop();
    });
    $('skipBtn').addEventListener('click', () => this.g.skipStage());
    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        this.g.audio.click();
        this.shopTab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
        this.shopSel = null;
        this.renderShop();
      }),
    );
    $('shopBuy').addEventListener('click', () => this.shopAction());
    for (const m of ['pause', 'results']) {
      $(m).addEventListener('click', (e) => {
        if (e.target === $(m) && m === 'pause') this.g.action('resume');
      });
    }
  }

  show(id, on = true) {
    const el = $(id);
    if (!el) return;
    if (id === 'hud' || id === 'touch') el.classList.toggle('hidden', !on);
    else el.classList.toggle('show', on);
  }

  setLoad(p) {
    $('loadFill').style.width = Math.round(p * 100) + '%';
  }

  setMuteIcon(muted) {
    document.querySelectorAll('[data-action="mute"] use').forEach((u) => u.setAttribute('href', muted ? '#i-mute' : '#i-sound'));
  }

  wallet(n, pop) {
    for (const id of ['walletCoins', 'shopCoins']) {
      const el = $(id);
      el.textContent = n;
      if (pop) this.pop(el);
    }
  }

  pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  buildWorldCards() {
    const box = $('worldCards');
    box.innerHTML = '';
    const s = this.g.save;
    WORLDS.forEach((w) => {
      const locked = !this.g.isUnlocked(w.id);
      const stars = s.stars[w.id] || 0;
      const b = document.createElement('button');
      b.className = 'world-card' + (locked ? ' locked' : '') + (this.g.menuWorld === w.id ? ' selected' : '');
      b.innerHTML = `<div class="wc-art">${ART[w.id]}</div><div class="wc-num">${w.id}</div><div class="wc-stars">${[1, 2, 3]
        .map((k) => `<svg class="${k <= stars ? 'on' : ''}"><use href="#i-star"/></svg>`)
        .join('')}</div><div class="wc-name">${w.name}</div><div class="wc-lock"><svg><use href="#i-lock"/></svg></div>`;
      b.addEventListener('click', () => {
        this.g.audio.unlock();
        if (locked) {
          this.g.audio.nope();
          b.classList.remove('shake');
          void b.offsetWidth;
          b.classList.add('shake');
          return;
        }
        this.g.audio.click();
        this.g.selectWorld(w.id);
      });
      box.appendChild(b);
    });
  }

  hud(st) {
    $('hudCoins').textContent = st.coins;
    $('hudCoinsMax').textContent = '/' + st.coinsMax;
    $('starPill').classList.toggle('hidden', !st.bigMax);
    $('hudStars').textContent = st.big;
    $('hudStarsMax').textContent = '/' + st.bigMax;
    $('stageNum').textContent = st.stage;
    $('stageMax').textContent = st.stageMax;
  }

  buildTower(n) {
    const tr = $('towerTrack');
    tr.innerHTML = '';
    this.towerDots = [];
    for (let i = 0; i <= n; i++) {
      const d = document.createElement('div');
      d.className = 'tower-dot' + (i === n ? ' finish' : '');
      if (i === n) d.innerHTML = '<svg><use href="#i-flag"/></svg>';
      d.style.top = (1 - i / n) * 100 + '%';
      tr.appendChild(d);
      this.towerDots.push(d);
    }
  }

  tower(frac, cp) {
    $('towerHead').style.top = (1 - Math.max(0, Math.min(1, frac))) * 100 + '%';
    if (this.towerDots) this.towerDots.forEach((d, i) => d.classList.toggle('done', i <= cp));
  }

  dimCenter(on) {
    document.querySelector('.hud-center').classList.toggle('dim', on);
  }

  starNear(on) {
    $('starPill').classList.toggle('near', on);
  }

  headColor(css) {
    $('towerHead').style.setProperty('--head', css);
  }

  fell() {
    const f = $('fallMsg');
    f.classList.remove('show');
    void f.offsetWidth;
    f.classList.add('show');
  }

  coinPop() {
    this.pop(document.querySelector('.coin-pill'));
  }

  starPop() {
    this.pop($('starPill'));
  }

  toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  banner(text) {
    const b = $('banner');
    $('bannerText').textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  flyStage(n) {
    const f = $('flyNum');
    const target = $('stageNum').getBoundingClientRect();
    f.textContent = n;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = w / 2 - 30;
    const sy = h * 0.4;
    const tx = target.left + target.width / 2 - 30;
    const ty = target.top - 20;
    f.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.2)`, opacity: 1 },
        { transform: `translate(${sx}px, ${sy - 30}px) scale(1.5)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.5)`, opacity: 1, offset: 0.9 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' },
    ).onfinish = () => {
      this.pop($('stageNum'));
      this.pop($('stageLabel'));
    };
  }

  hint(touch) {
    const h = $('hint');
    if (!h.innerHTML) h.innerHTML = HINT_HTML;
    h.classList.toggle('hidden', !!touch);
    h.style.opacity = 1;
  }

  hideHint() {
    $('hint').style.opacity = 0;
  }

  skip(on) {
    $('skipBtn').classList.toggle('hidden', !on);
  }

  results(r) {
    $('resTime').textContent = fmt(r.time);
    $('resCoins').textContent = `${r.coins}/${r.coinsMax}`;
    $('resDeaths').textContent = r.deaths;
    $('resRecord').classList.toggle('hidden', !r.record);
    $('resBest').textContent = r.best ? 'En iyi: ' + fmt(r.best) : '';
    $('nextWorldBtn').classList.toggle('hidden', !r.next);
    $('goalBonusN').textContent = `${r.big}/${r.bigMax}`;
    $('goalParT').textContent = fmt(r.par);
    ['goalFinish', 'goalBonus', 'goalPar'].forEach((id, i) => $(id).classList.toggle('on', !!r.got[i]));
    const stars = [...document.querySelectorAll('#resStars .star')];
    stars.forEach((s) => s.classList.remove('shown', 'on'));
    stars.forEach((s, i) => {
      setTimeout(() => {
        s.classList.add('shown');
        if (i < r.stars) {
          s.classList.add('on');
          this.g.audio.tone(660 * Math.pow(1.26, i), 0.25, { type: 'triangle', vol: 0.15 });
        }
      }, 350 + i * 320);
    });
  }

  starTotal() {
    return Object.values(this.g.save.stars).reduce((a, b) => a + (b || 0), 0);
  }

  renderShop() {
    const grid = $('shopGrid');
    grid.innerHTML = '';
    const s = this.g.save;
    const list = this.shopTab === 'color' ? SKINS : TRAILS;
    const owned = s.owned[this.shopTab];
    const equipped = s[this.shopTab];
    const have = this.starTotal();
    if (!this.shopSel) this.shopSel = equipped;
    list.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'item' + (this.shopSel === it.id ? ' sel' : '');
      b.style.animationDelay = i * 0.03 + 's';
      const own = owned.includes(it.id);
      const locked = !own && it.stars && have < it.stars;
      const tag = equipped === it.id ? '<span class="tag eq">Seçili</span>' : own ? '<span class="tag">Senin</span>' : locked ? `<span class="price need"><svg class="ico"><use href="#i-star"/></svg>${have}/${it.stars}</span>` : `<span class="price"><svg class="ico"><use href="#i-coin"/></svg>${it.price}</span>`;
      if (locked) b.classList.add('locked');
      const thumb = this.shopTab === 'color' && this.g.thumbs && this.g.thumbs[it.id];
      const bg = thumb ? `background:url(${thumb}) center/cover,${it.css}` : `background:${it.css}`;
      b.innerHTML = `<div class="swatch${thumb ? ' thumb' : ''}" style="${bg}"></div><div class="name">${it.name}</div>${tag}`;
      b.addEventListener('click', () => {
        this.g.audio.click();
        this.shopSel = it.id;
        this.g.previewItem(this.shopTab, it.id);
        this.renderShop();
      });
      grid.appendChild(b);
    });
    this.updateBuy();
  }

  updateBuy() {
    const s = this.g.save;
    const list = this.shopTab === 'color' ? SKINS : TRAILS;
    const it = list.find((x) => x.id === this.shopSel) || list[0];
    const btn = $('shopBuy');
    const own = s.owned[this.shopTab].includes(it.id);
    btn.classList.remove('cant');
    btn.disabled = false;
    if (s[this.shopTab] === it.id) {
      btn.innerHTML = '<span>Seçili</span>';
      btn.disabled = true;
    } else if (own) btn.innerHTML = '<span>Seç</span>';
    else if (it.stars && this.starTotal() < it.stars) {
      btn.innerHTML = `<svg class="ico star-ico"><use href="#i-star"/></svg><span>${this.starTotal()}/${it.stars}</span>`;
      btn.classList.add('cant');
    } else {
      btn.innerHTML = `<span>Al</span><svg class="ico"><use href="#i-coin"/></svg><span>${it.price}</span>`;
      if (s.coins < it.price) {
        btn.innerHTML = `<span class="miss-row"><svg class="ico"><use href="#i-coin"/></svg><b>${s.coins}/${it.price}</b></span><small class="miss">${it.price - s.coins} altın daha topla</small>`;
        btn.classList.add('cant');
      }
    }
  }

  shopAction() {
    const s = this.g.save;
    const list = this.shopTab === 'color' ? SKINS : TRAILS;
    const it = list.find((x) => x.id === this.shopSel);
    if (!it) return;
    const own = s.owned[this.shopTab].includes(it.id);
    if (!own) {
      if (s.coins < it.price || (it.stars && this.starTotal() < it.stars)) {
        this.g.audio.nope();
        const w = document.querySelector('#shop .wallet');
        w.classList.remove('shake');
        void w.offsetWidth;
        w.classList.add('pop');
        return;
      }
      s.coins -= it.price;
      s.owned[this.shopTab].push(it.id);
      this.g.audio.buy();
      this.g.celebrateBuy();
    } else this.g.audio.click();
    s[this.shopTab] = it.id;
    this.g.persist();
    this.wallet(s.coins, true);
    this.renderShop();
  }
}

const HINT_HTML = `<div class="key arrows"><div class="kb-row"><kbd>↑</kbd></div><div class="kb-row"><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div>
<div class="key wasd"><div class="kb-row"><kbd>W</kbd></div><div class="kb-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div>
<div class="key space"><kbd class="wide">␣</kbd><svg class="ico"><use href="#i-up"/></svg></div>`;

export function fmt(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
