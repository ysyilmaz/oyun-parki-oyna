import { WORLDS } from './themes.js';
import { SKINS, TRAILS } from './save.js';

const $ = (id) => document.getElementById(id);
const STALE = 1200;
const SECRET_ICON = '<svg class="ico sec-ico"><use href="#i-portal"/></svg>';

const ART = {
  1: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w1s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f95ff"/><stop offset="1" stop-color="#c6ecff"/></linearGradient></defs><rect width="180" height="150" fill="url(#w1s)"/><circle cx="146" cy="30" r="16" fill="#fff6c4"/><ellipse cx="40" cy="36" rx="26" ry="10" fill="#fff"/><ellipse cx="56" cy="30" rx="16" ry="10" fill="#fff"/><path d="M18 88h58l-8 26-21 16-21-16z" fill="#8a5a36"/><rect x="14" y="80" width="66" height="12" rx="6" fill="#56c23a"/><path d="M100 70h64l-9 30-23 18-23-18z" fill="#8a5a36"/><rect x="96" y="62" width="72" height="12" rx="6" fill="#56c23a"/><circle cx="140" cy="46" r="13" fill="#3a9e3a"/><rect x="137" y="52" width="6" height="12" fill="#7a4a2a"/><rect x="60" y="102" width="30" height="10" rx="4" fill="#ffc21a"/></svg>`,
  2: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w2s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1238"/><stop offset="1" stop-color="#ff7a3a"/></linearGradient></defs><rect width="180" height="150" fill="url(#w2s)"/><path d="M0 116q30-10 60 0t60 0 60 0v34H0z" fill="#ff5a1a"/><path d="M0 124q30-8 60 0t60 0 60 0v26H0z" fill="#ffc23a"/><rect x="28" y="40" width="26" height="80" fill="#6b5f73"/><path d="M24 42l17-24 17 24z" fill="#c8283a"/><rect x="36" y="58" width="10" height="14" rx="5" fill="#ffb040"/><rect x="120" y="54" width="24" height="66" fill="#6b5f73"/><path d="M116 56l16-22 16 22z" fill="#c8283a"/><rect x="127" y="70" width="10" height="13" rx="5" fill="#ffb040"/><rect x="66" y="92" width="44" height="8" rx="4" fill="#ff4a1a"/></svg>`,
  3: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w3s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05061c"/><stop offset="1" stop-color="#3a2a8a"/></linearGradient></defs><rect width="180" height="150" fill="url(#w3s)"/><circle cx="136" cy="40" r="22" fill="#ff9a5a"/><ellipse cx="136" cy="40" rx="36" ry="7" fill="none" stroke="#ffd28a" stroke-width="3"/><circle cx="20" cy="20" r="1.6" fill="#fff"/><circle cx="60" cy="14" r="1.2" fill="#fff"/><circle cx="90" cy="34" r="1.8" fill="#fff"/><circle cx="36" cy="54" r="1.2" fill="#fff"/><path d="M20 96h60l-10 30-20 12-20-12z" fill="#6a8aff"/><rect x="16" y="88" width="68" height="10" rx="5" fill="#eaf6ff"/><path d="M40 88l6-22 6 22z" fill="#35e0ff"/><path d="M54 88l4-14 4 14z" fill="#ff4fd8"/><rect x="100" y="98" width="56" height="10" rx="5" fill="#1b1f3a" stroke="#35e0ff" stroke-width="3"/></svg>`,
  4: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w4s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a2430"/><stop offset="0.75" stop-color="#4a9a8c"/><stop offset="1" stop-color="#2e5a2a"/></linearGradient></defs><rect width="180" height="150" fill="url(#w4s)"/><circle cx="142" cy="28" r="10" fill="#d8fff0" opacity="0.9"/><rect x="14" y="0" width="22" height="150" fill="#3a2a1e"/><rect x="150" y="0" width="18" height="150" fill="#2e2016"/><path d="M36 54q16-6 24 4h-24z" fill="#eadfc6"/><path d="M36 94q12-5 20 3h-20z" fill="#eadfc6"/><path d="M60 10v58M98 10v58" stroke="#4a6a3a" stroke-width="3"/><rect x="54" y="66" width="50" height="9" rx="3" fill="#b88a5a"/><circle cx="60" cy="66" r="3" fill="#7affd8"/><circle cx="98" cy="66" r="3" fill="#7affd8"/><path d="M104 122q22-26 44 0z" fill="#8f6cf0"/><path d="M110 122h32" stroke="#38c8dc" stroke-width="3"/><rect x="122" y="122" width="8" height="28" fill="#eadfc6"/><rect x="20" y="118" width="70" height="12" rx="6" fill="#4a8a5a"/><circle cx="124" cy="40" r="1.6" fill="#ffe8a8"/><circle cx="84" cy="30" r="1.4" fill="#ffe8a8"/><circle cx="46" cy="110" r="1.4" fill="#ffe8a8"/></svg>`,
  5: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w5s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26344e"/><stop offset="0.55" stop-color="#4a566c"/><stop offset="0.7" stop-color="#8fa6b4"/><stop offset="1" stop-color="#3a4660"/></linearGradient></defs><rect width="180" height="150" fill="url(#w5s)"/><path d="M0 58q22-14 44-6 18-16 40-4 20-12 40 0 24-10 56 2v14H0z" fill="#3a4660" opacity="0.85"/><path d="M0 120q30-10 60-2 30-10 60 0 30-8 60 2v30H0z" fill="#525e74"/><path d="M0 128q40-8 90 0 40 6 90-2v24H0z" fill="#2e3a52"/><rect x="132" y="40" width="4" height="52" fill="#9aa4b4"/><g transform="translate(134 40)"><path d="M0 0l2-24 3 1z" fill="#b8bcc4"/><path d="M0 0l22 10-1 3z" fill="#b8bcc4"/><path d="M0 0l-21 12-1-3z" fill="#b8bcc4"/><circle r="3" fill="#8a94a4"/></g><path d="M24 92h70l-8 22-27 10-27-10z" fill="#b8b0a0"/><rect x="20" y="84" width="78" height="11" rx="5" fill="#e9e3d2"/><rect x="30" y="80" width="18" height="6" rx="2" fill="#4f72b0"/><rect x="58" y="80" width="18" height="6" rx="2" fill="#7a5a34"/><path d="M12 66h40M30 74h52M60 60h34" stroke="#bfe6f4" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/><circle cx="40" cy="70" r="7" fill="none" stroke="#2fa8d8" stroke-width="3"/></svg>`,
  6: `<svg viewBox="0 0 180 150" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="w6s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26357e"/><stop offset="0.6" stop-color="#ffd6a6"/><stop offset="1" stop-color="#3a2014"/></linearGradient></defs><rect width="180" height="150" fill="url(#w6s)"/><g transform="translate(140 46)" fill="#b5873c"><circle r="26"/><g fill="#b5873c">${Array.from({ length: 12 }, (_, i) => `<rect x="-5" y="-33" width="10" height="10" transform="rotate(${i * 30})"/>`).join('')}</g><circle r="17" fill="#7a5228"/><circle r="6" fill="#ffd6a6"/></g><g transform="translate(104 24)" fill="#7a5228"><circle r="13"/>${Array.from({ length: 8 }, (_, i) => `<rect x="-3.5" y="-18" width="7" height="7" transform="rotate(${i * 45 + 22})"/>`).join('')}<circle r="5" fill="#b5873c"/></g><rect x="18" y="20" width="30" height="96" fill="#f1e9d6"/><path d="M14 22l19-16 19 16z" fill="#2a52c8"/><circle cx="33" cy="44" r="11" fill="#fff6e4" stroke="#1e2a6a" stroke-width="2.5"/><path d="M33 44v-8M33 44l5 3" stroke="#1e2a6a" stroke-width="2.2" stroke-linecap="round"/><rect x="18" y="70" width="30" height="4" fill="#b5873c"/><path d="M58 104h66l-6 16-27 10-27-10z" fill="#5a3220"/><rect x="56" y="96" width="70" height="10" rx="3" fill="#e9dfcc"/><rect x="130" y="108" width="36" height="8" rx="3" fill="#24409a"/><rect x="133" y="110" width="30" height="4" rx="2" fill="none" stroke="#fff1d6" stroke-width="1.5"/><circle cx="76" cy="96" r="5" fill="#35e0ff"/></svg>`,
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
    box.classList.toggle('many', WORLDS.length > 3);
    box.classList.toggle('five', WORLDS.length > 4);
    box.classList.toggle('six', WORLDS.length > 5);
    const s = this.g.save;
    WORLDS.forEach((w) => {
      const locked = !this.g.isUnlocked(w.id);
      const stars = s.stars[w.id] || 0;
      const col = document.createElement('div');
      col.className = 'world-col';
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
      col.appendChild(b);
      col.appendChild(this.bonusChip(w.id, locked));
      box.appendChild(col);
    });
    this.buildStarRoad();
  }

  selectCard(id) {
    $('worldCards')
      .querySelectorAll('.world-card')
      .forEach((b, i) => b.classList.toggle('selected', WORLDS[i].id === id));
  }

  bonusChip(id, worldLocked) {
    const s = this.g.save;
    const open = !worldLocked && this.g.bonusOpen(id);
    const done = !!s.bonus[id];
    const b = document.createElement('button');
    b.className = 'bonus-chip' + (open ? ' open' : '') + (done ? ' done' : '');
    b.setAttribute('aria-label', 'Bonus');
    b.innerHTML = open
      ? `<svg class="ico"><use href="#i-gift"/></svg><svg class="ico"><use href="#i-coin"/></svg><b>+${done ? 20 : 50}</b>${done ? '<svg class="ico ok"><use href="#i-check"/></svg>' : ''}`
      : `<svg class="ico"><use href="#i-lock"/></svg><svg class="ico star-ico"><use href="#i-star"/></svg><b>${Math.min(s.stars[id] || 0, 2)}/2</b>`;
    b.addEventListener('click', () => {
      this.g.audio.unlock();
      if (!open) {
        this.g.audio.nope();
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        return;
      }
      this.g.audio.click();
      this.g.play(id, 0, true, true);
    });
    return b;
  }

  buildStarRoad() {
    const box = $('starRoad');
    if (!box) return;
    const have = this.starTotal();
    const goals = SKINS.filter((k) => k.stars).sort((a, b) => a.stars - b.stars);
    const n = goals.length;
    const owned = this.g.save.owned.color;
    let fill = 0;
    goals.forEach((k, i) => {
      const from = i ? goals[i - 1].stars : 0;
      if (have >= k.stars) fill = (i + 1) / n;
      else if (have > from) fill = Math.max(fill, (i + (have - from) / (k.stars - from)) / n);
    });
    const nodes = goals
      .map((k, i) => {
        const thumb = this.g.thumbs && this.g.thumbs[k.id];
        const bg = thumb ? `background:url(${thumb}) center/cover,${k.css}` : `background:${k.css}`;
        const cls = owned.includes(k.id) ? ' own' : have >= k.stars ? ' ready' : '';
        return `<div class="road-node${cls}" style="left:${((i + 1) / n) * 100}%"><div class="road-face" style="${bg}"></div><span><svg class="ico"><use href="#i-star"/></svg>${k.stars}</span></div>`;
      })
      .join('');
    box.innerHTML = `<div class="road-count"><svg class="ico"><use href="#i-star"/></svg><b>${have}</b></div><div class="road-track"><i style="width:${fill * 100}%"></i>${nodes}</div>`;
  }

  hud(st) {
    const stage = this.stageFly ? this.stageFly - 1 : st.stage;
    const key = `${st.coins}|${st.coinsMax}|${st.secret}|${st.big}|${st.bigMax}|${stage}|${st.stageMax}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    $('hudCoins').textContent = Math.max(0, st.coins);
    $('hudCoinsMax').innerHTML = '/' + st.coinsMax + (st.secret ? '<span class="sec">' + SECRET_ICON + '+' + st.secret + '</span>' : '');
    if (st.secret > (this.lastSec || 0) && this.lastSec !== undefined) this.pop($('hudCoinsMax').querySelector('.sec'));
    this.lastSec = st.secret;
    $('starPill').classList.toggle('hidden', !st.bigMax);
    $('hudStars').textContent = st.big;
    $('hudStarsMax').textContent = '/' + st.bigMax;
    $('stageNum').textContent = Math.max(1, stage);
    $('stageMax').textContent = st.stageMax;
  }

  buildTower(n) {
    const tr = $('towerTrack');
    tr.innerHTML = '';
    this.towerDots = [];
    this.towerCp = null;
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
    const top = Math.round((1 - Math.max(0, Math.min(1, frac))) * 400) / 4;
    if (top === this.towerTop && cp === this.towerCp) return;
    this.towerTop = top;
    this.towerCp = cp;
    $('towerHead').style.top = top + '%';
    if (this.towerDots) this.towerDots.forEach((d, i) => d.classList.toggle('done', i <= cp));
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

  enqueue(kind, run, ms, drop, praise = false) {
    this.q = this.q || [];
    const same = kind === 'toast' || kind === 'stage' ? this.q.find((it) => it.kind === kind) : null;
    const at = performance.now();
    if (same) Object.assign(same, { run, at, praise });
    else this.q.push({ kind, run, ms, drop, praise, at });
    if (!this.qBusy) this.nextQueued();
  }

  nextQueued() {
    clearTimeout(this.qTimer);
    const now = performance.now();
    let it = this.q.shift();
    while (it && it.kind === 'toast' && (now - it.at > STALE || (it.praise && this.hazard))) it = this.q.shift();
    this.qBusy = !!it;
    this.qCur = null;
    if (!it) return;
    this.praiseOn = it.praise;
    this.qCur = it;
    it.run();
    this.qTimer = setTimeout(() => {
      this.praiseOn = false;
      this.nextQueued();
    }, it.ms);
  }

  hazardView(on) {
    if (on === this.hazard) return;
    this.hazard = on;
    if (on && this.praiseOn) this.dropToast(true);
  }

  dropToast(next) {
    if (!this.qCur || this.qCur.kind !== 'toast') return;
    const t = $('toast');
    t.classList.remove('show');
    t.classList.add('away');
    this.praiseOn = false;
    clearTimeout(this.qTimer);
    this.qCur = null;
    this.qBusy = false;
    if (next) this.nextQueued();
  }

  clearQueue() {
    clearTimeout(this.qTimer);
    const pending = this.q || [];
    this.q = [];
    this.qBusy = false;
    this.qCur = null;
    this.praiseOn = false;
    this.hazard = false;
    for (const it of pending) if (it.drop) it.drop();
    if (this.numFade) {
      this.numFade.cancel();
      this.numFade = null;
    }
    if (this.stageFly) {
      this.stageFly = 0;
      this.hudKey = null;
    }
  }

  flyTo(f, goal, scale, ms, land = false) {
    const r = goal.getBoundingClientRect();
    const fw = f.offsetWidth;
    const fh = f.offsetHeight;
    const k = scale || r.height / fh;
    const sx = window.innerWidth / 2 - fw / 2;
    const sy = window.innerHeight * 0.36 - fh / 2;
    const tx = r.left + r.width / 2 - fw / 2;
    const ty = r.top + r.height / 2 - fh / 2;
    return f.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.5)`, opacity: 1 },
        { transform: `translate(${sx}px, ${sy - 10}px) scale(0.9)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${tx}px, ${ty}px) scale(${k})`, opacity: 1, offset: 0.85 },
        { transform: `translate(${tx}px, ${ty}px) scale(${k})`, opacity: land ? 1 : 0 },
      ],
      { duration: ms, easing: 'cubic-bezier(.45,0,.35,1)' },
    );
  }

  flyCoins(text, done, to) {
    const run = () => {
      const f = $('flyCoin');
      const goal = (to && document.querySelector(to)) || document.querySelector('#hud .coin-pill');
      f.textContent = text;
      this.flyTo(f, goal, 0.6, 800).onfinish = () => {
        if (!to) this.coinPop();
        if (done) done();
      };
    };
    this.enqueue('coins', run, 800, done);
  }

  labelRect() {
    const el = $('stageLabel');
    if (!el || $('hud').classList.contains('hidden')) return null;
    const now = performance.now();
    if (!this.labelAt || now - this.labelAt > 250) {
      this.labelAt = now;
      this.labelBox = el.getBoundingClientRect();
    }
    return this.labelBox;
  }

  starPop() {
    this.pop($('starPill'));
  }

  toast(text, icon, praise = false) {
    this.enqueue('toast', () => {
      const t = $('toast');
      t.textContent = text;
      if (icon) t.insertAdjacentHTML('beforeend', `<svg class="ico toast-ico"><use href="#${icon}"/></svg>`);
      t.classList.remove('show', 'away');
      void t.offsetWidth;
      t.classList.add('show');
    }, 1500, null, praise);
  }

  banner(text, low = false) {
    this.clearQueue();
    this.enqueue('banner', () => {
      const b = $('banner');
      $('bannerText').textContent = text;
      b.classList.toggle('low', low);
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
    }, 1400);
  }

  flyStage(n) {
    this.dropToast(false);
    this.stageFly = n;
    this.hudKey = null;
    this.enqueue('stage', () => {
      const f = $('flyNum');
      const num = $('stageNum');
      f.textContent = n;
      if (this.numFade) this.numFade.cancel();
      this.numFade = num.animate(
        [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-45%) scale(0.7)' },
        ],
        { duration: 130, delay: 150, easing: 'ease-in', fill: 'forwards' },
      );
      this.flyTo(f, num, 0, 700, true).onfinish = () => {
        if (this.numFade) {
          this.numFade.cancel();
          this.numFade = null;
        }
        if (this.stageFly === n) {
          this.stageFly = 0;
          this.hudKey = null;
          num.textContent = n;
        }
        this.pop($('stageNum'));
        this.pop($('stageLabel'));
      };
    }, 700);
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

  skip(on, secret = false) {
    $('skipBtn').classList.toggle('hidden', !on);
    $('skipBtn').querySelector('use').setAttribute('href', secret ? '#i-portal' : '#i-skip');
  }

  results(r) {
    $('resTime').textContent = fmt(r.time);
    $('resCoins').textContent = `${r.coins}/${r.coinsMax}`;
    $('resSecretRow').classList.toggle('hidden', !r.secret);
    $('resSecret').textContent = r.secret || 0;
    $('resDeaths').textContent = r.deaths;
    $('resRecord').classList.toggle('hidden', !r.record);
    $('resBest').textContent = r.best && !r.record ? 'En iyi: ' + fmt(r.best) : '';
    $('nextWorldBtn').classList.toggle('hidden', !r.next);
    const gift = r.gifts && r.gifts.length ? 'Yeni kostüm: ' + r.gifts.join(', ') : '';
    $('resGiftT').textContent = gift;
    $('resGift').classList.toggle('hidden', !gift);
    $('resStars').classList.toggle('hidden', !!r.bonus);
    $('resReward').classList.toggle('hidden', !r.bonus);
    if (r.bonus) {
      $('resRewardN').textContent = '+' + r.reward;
      return;
    }
    $('goalBonusN').textContent = `${r.big}/${r.bigMax}`;
    $('goalParT').textContent = fmt(r.par);
    const cols = [...document.querySelectorAll('#resStars .star-col')];
    cols.forEach((c) => c.classList.remove('shown', 'on', 'miss'));
    cols.forEach((c, i) => {
      c.querySelector('.mark use').setAttribute('href', r.got[i] ? '#i-check' : '#i-miss');
      setTimeout(() => {
        c.classList.add('shown', r.got[i] ? 'on' : 'miss');
        if (r.got[i]) this.g.audio.tone(660 * Math.pow(1.26, i), 0.25, { type: 'triangle', vol: 0.15 });
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
      const hidden = !own && !!it.secret;
      const locked = hidden || (!own && it.stars && have < it.stars);
      const tag = equipped === it.id ? '<span class="tag eq">Seçili</span>' : own ? '<span class="tag">Senin</span>' : hidden ? '<span class="price need">Gizli yol</span>' : locked ? `<span class="price need"><svg class="ico"><use href="#i-star"/></svg>${have}/${it.stars}</span>` : `<span class="price"><svg class="ico"><use href="#i-coin"/></svg>${it.price}</span>`;
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
    else if (it.secret) {
      btn.innerHTML = '<span>Gizli yolda</span>';
      btn.classList.add('cant');
    } else if (it.stars && this.starTotal() < it.stars) {
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
      if (it.secret || s.coins < it.price || (it.stars && this.starTotal() < it.stars)) {
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
