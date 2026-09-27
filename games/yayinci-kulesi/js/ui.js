import { ICONS, applyIcons } from './icons.js';
import { RARITIES, CREATORS, THEMES, fmt, fmtFull, fmtMult, PAGE_BONUS } from './data.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(G) {
    this.G = G;
    applyIcons();
    this.el = {
      hud: $('hud'), money: $('moneyPill'), moneyText: $('moneyText'), rateText: $('rateText'), mult: $('multBadge'),
      goal: $('goal'), goalIc: $('goalIc'), goalFill: $('goalFill'), goalNum: $('goalNum'),
      rebirth: $('rebirthBtn'), rebirthRing: $('rebirthRing'), rebirthMult: $('rebirthMult'),
      prompt: $('prompt'), promptIc: $('promptIc'), promptText: $('promptText'), holdRing: $('holdRing'),
      elev: $('elevPanel'), undo: $('undoBtn'), undoFill: $('undoFill'), toasts: $('toasts'), reveal: $('reveal'), fullPop: $('fullPop'),
      viral: $('viralBanner'), tower: $('towerMap'), modal: $('modal'), card: $('modalCard'), flash: $('flash'), bigMult: $('bigMult'),
      act: $('actBtn'), actIc: $('actIc'), actRing: $('actRing'), jump: $('jumpBtn'), keys: $('keysHint'), arrow: $('guideArrow'), book: $('btnBook'), bookBadge: $('bookBadge'),
    };
    this.cache = {};
    this.modalKind = null;
    document.querySelectorAll('#hud button').forEach((b) => b.addEventListener('click', () => b.blur()));
    window.addEventListener('keydown', (e) => {
      if (this.rebirthKey(e)) e.stopImmediatePropagation();
    }, { capture: true });
    this.el.modal.addEventListener('pointerdown', (e) => {
      if (e.target === this.el.modal) this.backdrop = true;
    });
    this.el.modal.addEventListener('pointerup', (e) => {
      if (e.target === this.el.modal && this.backdrop) this.closeModal('backdrop');
      this.backdrop = false;
    });
  }

  set(key, val, fn) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    fn(val);
  }

  money(display, rate, mult, pending = 0, viral = false) {
    this.set('money', fmt(display), (v) => (this.el.moneyText.textContent = v));
    const key = '+' + fmt(rate + pending) + '/sn' + (pending > 0 ? 'p' : '') + (viral ? 'v' : '');
    this.set('rate', key, () => {
      this.el.rateText.classList.toggle('pending', pending > 0);
      this.el.rateText.classList.toggle('viral', viral);
      this.el.rateText.innerHTML = (viral ? `<span class="rt-fire">${ICONS.fire}</span>` : '') + (pending > 0 ? `<span class="rt-walk">${ICONS.boot}</span>` : '') + '+' + fmt(rate + pending) + '/sn';
    });
    this.set('mult', mult, (v) => {
      this.el.mult.classList.toggle('hidden', v <= 1.001);
      this.el.mult.textContent = '×' + fmtMult(v);
    });
  }

  ratePulse() {
    const r = this.el.rateText;
    r.classList.remove('pulse');
    void r.offsetWidth;
    r.classList.add('pulse');
  }

  punch() {
    const m = this.el.money;
    m.classList.remove('punch');
    void m.offsetWidth;
    m.classList.add('punch');
  }

  goal(icon, frac, text, ready, green, sub = '', go = false, img = '') {
    if (!this.el.goalSub) {
      this.el.goalSub = document.getElementById('goalSub');
      this.el.goalGo = document.getElementById('goalGo');
    }
    this.set('goalIc', img || icon, () => (this.el.goalIc.innerHTML = img ? `<img src="${img}" alt="">` : ICONS[icon]));
    this.set('goalSub', sub, (v) => {
      this.el.goalSub.innerHTML = v;
      this.el.goalSub.classList.toggle('hidden', !v);
    });
    this.set('goalGo', go, (v) => this.el.goalGo.classList.toggle('hidden', !v));
    this.set('goalW', Math.round(frac * 200), (v) => (this.el.goalFill.style.width = v / 2 + '%'));
    this.set('goalT', (ready ? 'r' : 't') + text, () => {
      if (ready) this.el.goalNum.innerHTML = `<span class="gn-rb"><span class="gn-ic">${ICONS.rebirth}</span>${text}</span>`;
      else this.el.goalNum.textContent = text;
    });
    this.set('goalR', ready, (v) => this.el.goal.classList.toggle('ready', v));
    this.set('goalG', green, (v) => this.el.goalFill.classList.toggle('green', v));
  }

  rebirthBtn(frac, ready, multText, visible) {
    this.set('rbV', visible, (v) => this.el.rebirth.classList.toggle('hidden', !v));
    this.set('rbF', Math.round(frac * 100), (v) => (this.el.rebirthRing.style.strokeDashoffset = String(276.5 * (1 - v / 100))));
    this.set('rbR', ready, (v) => this.el.rebirth.classList.toggle('ready', v));
    this.set('rbM', multText, (v) => (this.el.rebirthMult.textContent = v));
  }

  prompt(p) {
    const key = p ? p.key : '';
    this.set('prompt', key, () => {
      if (!p) {
        this.el.prompt.classList.add('hidden');
        this.el.act.classList.add('hidden');
        return;
      }
      this.el.prompt.classList.remove('hidden');
      this.el.prompt.classList.toggle('gray', !!p.gray);
      this.el.promptIc.innerHTML = ICONS[p.icon] || '';
      this.el.promptText.innerHTML = p.html;
      this.el.act.classList.toggle('hidden', !document.body.classList.contains('touch'));
      this.el.actIc.innerHTML = ICONS[p.icon] || '';
      this.el.prompt.style.animation = 'none';
      void this.el.prompt.offsetWidth;
      this.el.prompt.style.animation = '';
    });
  }

  placePrompt(x, y) {
    const p = this.el.prompt;
    if (x === null || x === undefined) {
      if (this.cache.pp !== 'dock') {
        this.cache.pp = 'dock';
        p.classList.add('dock');
        p.style.left = '';
        p.style.top = '';
      }
      return;
    }
    this.cache.pp = 'anchor';
    p.classList.remove('dock');
    const w = p.offsetWidth || 260;
    const h = p.offsetHeight || 80;
    const left = Math.max(12, Math.min(innerWidth - w - 12, x + 120));
    const top = Math.max(100, Math.min(innerHeight - h - 12, y - h / 2));
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  }

  wiggleMoney() {
    const m = this.el.money;
    m.classList.remove('wiggle');
    void m.offsetWidth;
    m.classList.add('wiggle');
    setTimeout(() => m.classList.remove('wiggle'), 450);
  }

  shakePrompt() {
    const p = this.el.prompt;
    p.classList.remove('shake');
    void p.offsetWidth;
    p.classList.add('shake');
    setTimeout(() => p.classList.remove('shake'), 320);
  }

  hold(p) {
    const off = String(276.5 * (1 - Math.max(0, Math.min(1, p))));
    this.el.holdRing.style.strokeDashoffset = off;
    this.el.actRing.style.strokeDashoffset = off;
  }

  elevPanel(show, n, cur, def, onPick) {
    const key = show ? `${n}|${cur}|${def}` : 'off';
    this.set('elev', key, () => {
      if (!show) {
        this.el.elev.classList.add('hidden');
        return;
      }
      this.el.elev.classList.remove('hidden');
      this.el.elev.innerHTML = '';
      for (let f = 0; f < n; f++) {
        const th = THEMES[f % THEMES.length];
        const b = document.createElement('button');
        b.className = 'elev-btn' + (f === cur ? ' here' : '') + (f === def ? ' def' : '');
        b.style.background = `linear-gradient(${th.led}, ${th.accent})`;
        b.innerHTML = `${f + 1}${f < 10 ? `<span class="ek">${(f + 1) % 10}</span>` : ''}`;
        b.setAttribute('aria-label', 'Kat ' + (f + 1));
        let down = null;
        b.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
        b.addEventListener('pointerup', (e) => {
          if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 10) onPick(f);
          down = null;
          b.blur();
        });
        b.addEventListener('pointerleave', () => (down = null));
        this.el.elev.appendChild(b);
      }
    });
  }

  undo(show, frac) {
    const foot = this.modalKind === 'shop' ? document.querySelector('.shop-foot') : null;
    const host = foot || document.body;
    if (this.el.undo.parentElement !== host) {
      if (foot) foot.insertBefore(this.el.undo, document.getElementById('shopExit'));
      else document.body.appendChild(this.el.undo);
    }
    this.set('undoV', show, (v) => this.el.undo.classList.toggle('hidden', !v));
    if (show) this.el.undoFill.style.width = Math.max(0, frac * 100) + '%';
  }

  toast(html, img, icon, dur = 2200) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = (img ? `<img src="${img}" alt="">` : icon ? `<span class="t-ic">${ICONS[icon]}</span>` : '') + `<span>${html}</span>`;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, dur);
  }

  fullFlash(html, swap, dur = 1300) {
    const el = this.el.fullPop;
    el.innerHTML = html;
    el.classList.toggle('swap', !!swap);
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.fullT);
    el.style.setProperty('--fd', dur + 'ms');
    this.fullT = setTimeout(() => el.classList.add('hidden'), dur);
  }

  reveal(def, img, inc, multTag) {
    const r = RARITIES[def.r];
    const el = this.el.reveal;
    const rc = r.rainbow ? '#ff4fa8' : r.color;
    el.style.setProperty('--rc', rc);
    el.style.borderColor = rc;
    el.style.background = r.rainbow ? 'linear-gradient(120deg,#ff3b3b,#ffd23a,#35ff7a,#35d6ff,#b44dff)' : '';
    el.innerHTML = `<img class="rv-img" src="${img}" alt=""><div class="rv-col"><span class="rv-rar" style="color:${r.rainbow ? '#fff' : r.glow}">${r.name}</span><span class="rv-name">${def.name}</span><span class="rv-inc">+${fmt(inc)}/sn${multTag ? ' <span style="color:#e7a6ff">' + multTag + '</span>' : ''}</span></div>`;
    el.classList.toggle('mini', this.modalKind === 'shop');
    el.classList.remove('hidden', 'out');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.revealT);
    this.revealT = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, this.modalKind === 'shop' ? 1500 : def.r >= 2 ? 2600 : 1800);
  }

  viralBanner() {
    const v = this.el.viral;
    v.classList.remove('hidden');
    v.style.animation = 'none';
    void v.offsetWidth;
    v.style.animation = '';
    clearTimeout(this.viralT);
    this.viralT = setTimeout(() => v.classList.add('hidden'), 2400);
  }

  towerMap(n, cur, moneyFloors, viralFloors) {
    const key = `${n}|${cur}|${moneyFloors.join(',')}|${viralFloors.join(',')}`;
    this.set('tower', key, () => {
      this.el.tower.innerHTML = '';
      const roofMark = document.createElement('div');
      roofMark.className = 'tm-roof';
      roofMark.innerHTML = ICONS.play;
      for (let f = 0; f < n; f++) {
        const th = THEMES[f % THEMES.length];
        const d = document.createElement('div');
        d.className = 'tm-floor' + (f === cur ? ' here' : '') + (moneyFloors.includes(f) ? ' cash' : '');
        d.style.background = `linear-gradient(${th.led}, ${th.accent})`;
        d.innerHTML = `${f + 1}${moneyFloors.includes(f) ? `<span class="tm-coin">${ICONS.coin}</span>` : ''}${viralFloors.includes(f) ? `<span class="tm-coin" style="right:auto;left:-18px">${ICONS.fire}</span>` : ''}${f === cur ? '<span class="tm-me"></span>' : ''}`;
        this.el.tower.appendChild(d);
      }
      this.el.tower.appendChild(roofMark);
    });
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  bigMult(html) {
    const b = this.el.bigMult;
    b.innerHTML = html;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this.bigT);
    this.bigT = setTimeout(() => b.classList.add('hidden'), 2400);
  }

  arrowAt(x, y, rot, tag = '') {
    const a = this.el.arrow;
    if (x === null) {
      a.classList.add('hidden');
      return;
    }
    if (!this.el.arrowTag) {
      this.el.arrowTag = document.createElement('span');
      this.el.arrowTag.className = 'ga-tag gn-rb hidden';
      a.appendChild(this.el.arrowTag);
    }
    this.set('arrowTag', tag, (v) => {
      this.el.arrowTag.innerHTML = v ? `<span class="gn-ic">${ICONS.rebirth}</span>` : '';
      this.el.arrowTag.classList.toggle('hidden', !v);
    });
    a.classList.remove('hidden');
    a.style.left = x - 35 + 'px';
    a.style.top = y - 35 + 'px';
    a.firstElementChild.style.transform = `rotate(${rot}deg)`;
  }

  openModal(kind, html, onClose) {
    this.closeModal('replace');
    this.modalKind = kind;
    this.onClose = onClose;
    this.el.card.innerHTML = html;
    this.el.modal.classList.remove('hidden');
    applyIcons(this.el.card);
    this.el.card.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => b.blur()));
    const x = this.el.card.querySelector('.x-btn');
    if (x) x.addEventListener('click', () => this.closeModal('x'));
    this.G.onModal(true);
  }

  closeModal(reason) {
    if (!this.modalKind) return;
    const k = this.modalKind;
    const cb = this.onClose;
    this.modalKind = null;
    this.onClose = null;
    this.shop = null;
    this.el.card.classList.remove('shop-card');
    this.el.modal.classList.add('hidden');
    this.el.card.innerHTML = '';
    this.G.onModal(false);
    if (cb) cb(reason, k);
  }

  openRebirth(d, onConfirm) {
    const heads = d.lostHeads.slice(0, 12).map((u) => `<img src="${u}" alt="">`).join('');
    const newR = d.newTier >= 0 ? RARITIES[d.newTier] : null;
    const html = `
      <button class="x-btn" aria-label="Kapat"><span data-icon="x"></span></button>
      <div class="rb-head"><span class="rh-ic" data-icon="rebirth"></span><span class="rh-t">Yeniden Doğ</span><span class="rb-cost"><span class="ci" data-icon="coin"></span>${fmtFull(d.cost)}</span></div>
      <div class="rb-cols">
        <div class="rb-lose">
          <div class="rl-row"><span class="ri" data-icon="coin"></span>${fmt(d.money)}</div>
          <div class="rl-row"><span class="ri" data-icon="person"></span>${d.creators}</div>
          <div class="rl-heads">${heads}</div>
        </div>
        <div class="rb-gain">
          <div class="rg"><div class="rg-big" style="color:#e7a6ff">×${fmtMult(d.newMult)}</div><span class="rg-lbl">${'×' + fmtMult(d.oldMult)} → ${'×' + fmtMult(d.newMult)}</span></div>
          <div class="rg"><div class="rg-floor" style="background:linear-gradient(${d.theme.led},${d.theme.accent});--fc:${d.theme.led}">${d.floors}</div><span class="rg-lbl">+8 <span style="display:inline-block;width:30px;height:30px;vertical-align:-6px">${ICONS.desk}</span></span></div>
          ${newR ? `<div class="rg"><div class="rg-chip" style="background:${newR.rainbow ? 'linear-gradient(90deg,#ff3b3b,#ffd23a,#35ff7a,#35d6ff,#b44dff)' : newR.color}">${newR.name}</div><span class="rg-lbl"><span style="display:inline-block;width:30px;height:30px;vertical-align:-6px">${ICONS.lock}</span> → <span style="display:inline-block;width:30px;height:30px;vertical-align:-6px">${ICONS.check}</span></span></div>` : ''}
          <div class="rg"><span class="rg-ic" data-icon="book"></span><span class="rg-lbl"><span style="display:inline-block;width:30px;height:30px;vertical-align:-6px">${ICONS.check}</span></span></div>
        </div>
      </div>
      <div class="rb-actions">
        <button class="big-btn gray" id="rbCancel"><span class="bi" data-icon="x"></span><span>Vazgeç</span></button>
        <button class="big-btn purple" id="rbGo" disabled><span class="rb-arm"></span><span class="bi" data-icon="rebirth"></span></button>
      </div>`;
    this.openModal('rebirth', html);
    const cancel = $('rbCancel');
    const go = $('rbGo');
    cancel.focus();
    cancel.addEventListener('click', () => this.closeModal('cancel'));
    this.rb = { enabled: false, go, cancel, onConfirm };
    setTimeout(() => {
      if (this.modalKind === 'rebirth' && this.rb) {
        go.disabled = false;
        this.rb.enabled = true;
        go.focus();
      }
    }, 1000);
    go.addEventListener('click', () => this.rebirthConfirm());
  }

  rebirthKey(e) {
    if (this.modalKind !== 'rebirth' || !this.rb) return false;
    const { go, cancel } = this.rb;
    if (e.code.startsWith('Arrow')) {
      e.preventDefault();
      if (this.rb.enabled) (document.activeElement === go ? cancel : go).focus();
      else cancel.focus();
      return true;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (!e.repeat && this.rb.enabled) this.rebirthConfirm();
      return true;
    }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (e.repeat || !this.rb.enabled) return true;
      if (document.activeElement === cancel) this.closeModal('cancel');
      else this.rebirthConfirm();
      return true;
    }
    return false;
  }

  rebirthConfirm() {
    if (this.modalKind !== 'rebirth' || !this.rb || !this.rb.enabled) return;
    const cb = this.rb.onConfirm;
    this.rb = null;
    this.closeModal('confirm');
    cb();
  }

  openShop(cards, money, restockLeft, onBuy, onExit) {
    const html = `<div class="shop-head"><span class="rh-ic" data-icon="cart"></span><span class="rh-t">Dükkân</span>
      <span class="shop-money"><span class="ci" data-icon="coin"></span><span id="shopMoney"></span></span>
      <span class="shop-clock"><span class="ci" data-icon="moon"></span>Yeni stok <b id="shopClock"></b></span></div>
      <div class="shop-wrap"><div class="shop-grid" id="shopGrid"></div><span class="shop-more hidden" id="shopMore">↓</span></div>
      <div class="shop-foot"><span class="shop-keys"><span class="key">←</span><span class="key">→</span><span class="key">E</span></span><button class="big-btn gold" id="shopExit"><span class="bi" data-icon="home"></span><span>Dükkândan çık</span></button></div>`;
    this.openModal('shop', html, () => onExit());
    this.el.card.classList.add('shop-card');
    this.shop = { onBuy, cards: [], sel: -1, aff: {} };
    const ex = document.getElementById('shopExit');
    ex.addEventListener('click', () => this.closeModal('exit'));
    ex.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') e.preventDefault();
    });
    this.refreshShop(cards, money, restockLeft, false);
    const best = this.bestCard(money);
    this.selectCard(best);
  }

  bestCard(money) {
    const c = this.shop.cards;
    let best = -1;
    c.forEach((x, i) => {
      if (x.locked || x.stock <= 0 || x.def.price > money) return;
      if (best < 0 || x.def.inc > c[best].def.inc) best = i;
    });
    if (best < 0) best = c.findIndex((x) => !x.locked && x.stock > 0);
    return Math.max(0, best);
  }

  refreshShop(cards, money, restockLeft, flash) {
    if (this.modalKind !== 'shop' || !this.shop) return;
    this.shop.cards = cards;
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    cards.forEach((c, i) => {
      const r = RARITIES[c.def.r];
      const rc = r.rainbow ? '#ff4fa8' : r.color;
      const d = document.createElement('div');
      d.className = 'scard' + (c.locked ? ' locked' : '') + (c.stock <= 0 ? ' out' : '');
      d.style.setProperty('--rc', rc);
      d.dataset.i = i;
      d.innerHTML = `<span class="sc-rar">${r.name}</span>
        <div class="sc-img">${c.locked ? `<span class="sc-lockbig">${ICONS.lock}</span>` : `<img src="${c.img}" alt="">`}</div>
        <span class="sc-name">${c.locked ? '?' : c.def.name}</span>
        <span class="sc-inc">+${fmt(c.inc)}/sn</span>
        <span class="sc-stock">${c.locked ? '' : c.stock > 0 ? '×' + c.stock : ''}</span>
        ${c.stock <= 0 && !c.locked ? '<div class="sc-buy sc-soldout"><span class="so-t">Tükendi</span><span class="so-c">Yeni stok <b class="so-clock"></b></span></div>' : `<span class="sc-swap"><img alt=""><span class="sw-ar">➜</span></span><div class="sc-buy" role="button"><span class="sc-fill"></span><span class="ci">${ICONS.coin}</span><span class="ci sc-fullic">${ICONS.full}</span><span class="sc-price">${fmt(c.def.price)}</span><span class="sc-lock">${ICONS.lock}</span></div>`}`;
      const btn = d.querySelector('.sc-buy:not(.sc-soldout)') || d.querySelector('.sc-buy');
      let down = null;
      btn.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
      btn.addEventListener('pointerup', (e) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 10) {
          this.selectCard(i);
          this.shop.onBuy(c.def);
        }
        down = null;
      });
      btn.addEventListener('pointerleave', () => (down = null));
      d.addEventListener('pointerenter', () => this.selectCard(i));
      grid.appendChild(d);
    });
    this.shop.aff = {};
    this.updateShop(money, restockLeft, true);
    if (this.shop.sel >= 0) this.selectCard(Math.min(this.shop.sel, cards.length - 1));
    if (flash) {
      grid.classList.remove('restocked');
      void grid.offsetWidth;
      grid.classList.add('restocked');
    }
  }

  updateShop(money, restockLeft, silent) {
    if (this.modalKind !== 'shop' || !this.shop) return false;
    const s = Math.max(1, Math.ceil(restockLeft));
    const clock = document.getElementById('shopClock');
    const ct = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (clock) clock.textContent = ct;
    document.querySelectorAll('#shopGrid .so-clock').forEach((el) => (el.textContent = ct));
    const grid = document.getElementById('shopGrid');
    const more = document.getElementById('shopMore');
    if (grid && more) more.classList.toggle('hidden', grid.scrollHeight - grid.scrollTop - grid.clientHeight < 8);
    const mEl = document.getElementById('shopMoney');
    if (mEl) mEl.textContent = fmt(money);
    let newly = false;
    document.querySelectorAll('#shopGrid .scard').forEach((el) => {
      const c = this.shop.cards[Number(el.dataset.i)];
      const blk = !c.locked && c.stock > 0 && !!this.blocked && this.blocked(c.def);
      const ok = !c.locked && c.stock > 0 && money >= c.def.price && !blk;
      el.classList.toggle('blk', blk);
      const out = !c.locked && c.stock > 0 && this.swapOut ? this.swapOut(c.def) : null;
      el.classList.toggle('swp', !!out);
      const si = el.querySelector('.sc-swap img');
      if (si && out && si.getAttribute('src') !== out) si.setAttribute('src', out);
      const fill = el.querySelector('.sc-fill');
      if (fill) fill.style.width = (ok ? 100 : Math.min(100, Math.floor((money / c.def.price) * 100))) + '%';
      const prev = this.shop.aff[c.def.id];
      if (ok !== prev) {
        el.classList.toggle('ok', ok);
        el.classList.toggle('no', !ok);
        if (ok && prev === false && !silent) {
          el.classList.remove('lit');
          void el.offsetWidth;
          el.classList.add('lit');
          newly = true;
        }
        this.shop.aff[c.def.id] = ok;
      }
      if (ok && prev === undefined) el.classList.add('ok');
    });
    return newly;
  }

  selectCard(i) {
    if (!this.shop) return;
    this.shop.sel = i;
    document.querySelectorAll('#shopGrid .scard').forEach((el) => el.classList.toggle('sel', Number(el.dataset.i) === i));
    const el = document.querySelector(`#shopGrid .scard[data-i="${i}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  shopMove(dx, dy) {
    if (!this.shop) return;
    const n = this.shop.cards.length;
    const cols = 5;
    let i = this.shop.sel + dx + dy * cols;
    i = Math.max(0, Math.min(n - 1, i));
    this.selectCard(i);
  }

  shopBuySelected() {
    if (!this.shop || this.shop.sel < 0) return;
    const c = this.shop.cards[this.shop.sel];
    if (c) this.shop.onBuy(c.def);
  }

  openBook(owned, thumb) {
    const rows = RARITIES.map((r) => {
      const list = CREATORS.filter((c) => c.r === r.id);
      const have = list.filter((c) => owned[c.id]).length;
      const done = have === list.length;
      const rc = r.rainbow ? '#ff4fa8' : r.color;
      const cards = list.map((c) => `<div class="book-card ${owned[c.id] ? '' : 'locked'}"><img src="${thumb(c)}" alt=""><span class="bc-n">${owned[c.id] ? c.name : '?'}</span></div>`).join('');
      return `<div class="book-row ${done ? 'done' : ''}" style="--rc:${rc}"><div class="book-label"><span class="bl-n">${r.name}</span><span class="bl-c">${have}/${list.length}</span><span class="bl-b ${done ? '' : 'off'}">+${Math.round(PAGE_BONUS * 100)}%</span></div><div class="book-cards">${cards}</div></div>`;
    }).join('');
    this.openModal('book', `<button class="x-btn" aria-label="Kapat"><span data-icon="x"></span></button><div class="rb-head"><span class="rh-ic" data-icon="book"></span><span class="rh-t">Koleksiyon</span></div><div class="book-rows">${rows}</div>`);
  }

  openOffline(amount, onTake) {
    this.openModal('offline', `<div class="off-card"><span class="oc-ic" data-icon="moon"></span><span class="oc-t">Sen yokken</span><span class="oc-amt"><span class="ci" data-icon="coin"></span>+${fmt(amount)}</span><button class="big-btn green" id="offTake"><span class="bi" data-icon="check"></span><span>Topla</span><span class="enter-key">Enter</span></button></div>`, (reason) => onTake(reason));
    const b = $('offTake');
    b.focus();
    b.addEventListener('click', () => this.closeModal('take'));
  }

  openPause(musicOn, onToggleMusic) {
    const html = `<div class="pause-card">
      <button class="resume" id="resumeBtn" aria-label="Devam"><span data-icon="resume"></span></button>
      <div class="ctl-grid">
        <div class="ctl"><div class="kgrid"><span class="key k-w">↑</span><span class="key k-a">←</span><span class="key k-s">↓</span><span class="key k-d">→</span></div><span>=</span><span class="ci" data-icon="boot"></span></div>
        <div class="ctl"><span class="key">E</span><span>=</span><span class="ci" data-icon="cart"></span><span class="ci" data-icon="elevator"></span></div>
        <div class="ctl"><span class="key">E</span><span class="ci" data-icon="hand"></span><span>=</span><span class="ci" data-icon="sell"></span></div>
        <div class="ctl"><span class="ci" data-icon="coin"></span><span>=</span><span class="ci" data-icon="boot"></span></div>
      </div>
      <div class="pause-row">
        <button class="big-btn gold" id="musicBtn"><span class="bi" data-icon="${musicOn ? 'sound' : 'mute'}"></span></button>
        <a class="big-btn gray" href="../../index.html" style="text-decoration:none;color:#fff"><span class="bi" data-icon="home"></span></a>
      </div></div>`;
    this.openModal('pause', html);
    const r = $('resumeBtn');
    r.focus();
    r.addEventListener('click', () => this.closeModal('resume'));
    $('musicBtn').addEventListener('click', (e) => {
      const on = onToggleMusic();
      e.currentTarget.innerHTML = `<span class="bi">${ICONS[on ? 'sound' : 'mute']}</span>`;
    });
  }
}
