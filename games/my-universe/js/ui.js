import { CATALOG, xpNeed } from './progress.js';
import { GAMES } from './registry.js';
import { petThumb } from './engine/pets/petModels.js';

const $ = (id) => document.getElementById(id);

export function fmt(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.shopTab = 'color';
    this.shopSel = null;
    this.promptText = null;
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
    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        this.g.audio.click();
        this.shopTab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
        this.shopSel = null;
        this.g.previewItem(this.shopTab, null);
        this.renderShop();
      }),
    );
    $('shopBuy').addEventListener('click', () => this.shopAction());
    $('unlockBuy').addEventListener('click', () => this.g.buyPortal());
    $('pause').addEventListener('click', (e) => {
      if (e.target === $('pause')) this.g.action('resume');
    });
  }

  show(id, on = true) {
    const el = $(id);
    if (!el) return;
    if (id === 'hud' || id === 'touch' || id === 'gameHud') el.classList.toggle('hidden', !on);
    else el.classList.toggle('show', on);
  }

  setLoad(p) {
    $('loadFill').style.width = Math.round(p * 100) + '%';
  }

  setMuteIcon(muted) {
    document.querySelectorAll('[data-action="mute"] use').forEach((u) => u.setAttribute('href', muted ? '#i-mute' : '#i-sound'));
  }

  pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  progress(p, popCoins) {
    $('hudLevel').textContent = p.level;
    $('xpFill').style.width = Math.round(p.xpFrac() * 100) + '%';
    $('xpText').textContent = `${p.s.xp}/${xpNeed(p.level)}`;
    $('hudCoins').textContent = p.coins;
    $('shopCoins').textContent = p.coins;
    if (popCoins) this.pop(document.querySelector('.coin-pill'));
  }

  coinPop() {
    $('hudCoins').textContent = this.g.progress.coins;
    this.pop(document.querySelector('.coin-pill'));
  }

  gameHud(h, name) {
    $('gameName').textContent = h.label;
    $('stageNum').textContent = h.stageNo;
    $('stageFill').style.width = ((h.stage - 1) / Math.max(1, h.stageMax)) * 100 + '%';
    $('hudTime').textContent = fmt(h.time);
    $('lavaWarn').classList.toggle('hidden', h.danger < 0.5);
    const hud = $('hud');
    hud.classList.toggle('danger', h.danger > 0.35);
    hud.style.setProperty('--danger', (Math.max(0, h.danger - 0.35) * 1.2).toFixed(2));
  }

  clearDanger() {
    $('hud').classList.remove('danger');
    $('lavaWarn').classList.add('hidden');
  }

  prompt(text, key, locked) {
    const sig = text + '|' + key + '|' + locked;
    if (sig === this.promptText) return;
    this.promptText = sig;
    const el = $('prompt');
    el.classList.toggle('locked', !!locked);
    $('promptKey').textContent = key || 'E';
    $('promptText').textContent = text;
    el.classList.remove('hidden');
  }

  hidePrompt() {
    if (this.promptText === null) return;
    this.promptText = null;
    $('prompt').classList.add('hidden');
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

  levelUp(level) {
    const el = $('levelup');
    $('luLevel').textContent = level;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  hint(on) {
    const h = $('hint');
    if (!h.innerHTML) h.innerHTML = HINT_HTML;
    h.style.opacity = on ? 1 : 0;
  }

  results(r) {
    $('resTitle').textContent = `Bölüm ${r.stage} bitti!`;
    $('resXp').textContent = '+' + r.xp;
    $('resCoins').textContent = `+${r.reward + r.coins}`;
    $('resTime').textContent = fmt(r.time);
    $('resDeaths').textContent = r.deaths;
    $('resRecord').classList.toggle('hidden', !r.record);
    $('nextStageBtn').classList.toggle('hidden', !r.hasNext);
  }

  stages(game, stages) {
    const p = this.g.progress;
    $('stagesTitle').textContent = game.name;
    const box = $('stageCards');
    box.innerHTML = '';
    const gs = p.game(game.id);
    stages.forEach((st, i) => {
      const open = p.stageOpen(game.id, st.n);
      const done = !!gs.done[st.n];
      const b = document.createElement('button');
      b.className = 'stage-card' + (open ? '' : ' locked') + (done ? ' done' : '');
      const best = gs.best[st.n];
      b.innerHTML = `<div class="sc-num">${st.n}</div><div class="sc-name">${st.name}</div><div class="sc-reward"><svg class="ico"><use href="#i-xp"/></svg>${st.xp}<svg class="ico"><use href="#i-coin"/></svg>${st.coins}</div>${best ? `<div class="sc-best">En iyi ${fmt(best)}</div>` : ''}<div class="sc-done"><svg><use href="#i-star"/></svg></div><div class="sc-lock"><svg><use href="#i-lock"/></svg></div>`;
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
        this.g.startStage(game, i);
      });
      box.appendChild(b);
    });
    this.show('stages', true);
  }

  unlock(game) {
    const p = this.g.progress;
    $('unlockTitle').textContent = game.name;
    const buy = $('unlockBuy');
    if (game.unlock.level) {
      $('unlockText').textContent = `Bu portal ${game.unlock.level}. seviyede açılır. Sen şimdi ${p.level}. seviyedesin. Lav Parkuru'nda XP kazan!`;
      buy.classList.add('hidden');
    } else {
      $('unlockText').textContent = `Bu portalı altınla açabilirsin.`;
      $('unlockPrice').textContent = game.unlock.coins;
      buy.classList.remove('hidden');
      buy.classList.toggle('cant', p.coins < game.unlock.coins);
    }
    this.show('unlock', true);
  }

  shopList() {
    if (this.shopTab === 'portal') return GAMES.filter((g) => g.unlock && g.unlock.coins).map((g) => ({ id: g.id, name: g.name, price: g.unlock.coins, css: g.css, portal: g }));
    return CATALOG[this.shopTab];
  }

  renderShop() {
    const grid = $('shopGrid');
    grid.innerHTML = '';
    const p = this.g.progress;
    const tab = this.shopTab;
    const list = this.shopList();
    const equipped = tab === 'portal' ? null : p.s.eq[tab];
    if (!this.shopSel) this.shopSel = equipped || list[0].id;
    list.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'item' + (this.shopSel === it.id ? ' sel' : '') + (tab === 'portal' ? ' portal' : '');
      b.style.animationDelay = i * 0.03 + 's';
      const own = tab === 'portal' ? p.portalOpen(it.portal) : p.owns(tab, it.id);
      const tag = equipped === it.id ? '<span class="tag eq">Seçili</span>' : own ? `<span class="tag">${tab === 'portal' ? 'Açık' : 'Senin'}</span>` : `<span class="price"><svg class="ico"><use href="#i-coin"/></svg>${it.price}</span>`;
      let art;
      if (tab === 'pet') art = it.id === 'none' ? '<div class="swatch" style="background:repeating-linear-gradient(45deg,#e6ecf6 0 8px,#cfd8e8 8px 16px)"></div>' : `<img class="pet-thumb" alt="" src="${petThumb(it.id, 0)}">`;
      else if (it.svg) art = `<div class="swatch svg">${it.svg}</div>`;
      else art = `<div class="swatch" style="background:${it.css}"></div>`;
      b.innerHTML = `${art}<div class="name">${it.name}</div>${tag}`;
      b.addEventListener('click', () => {
        this.g.audio.click();
        this.shopSel = it.id;
        this.g.previewItem(tab, it.id);
        this.renderShop();
      });
      grid.appendChild(b);
    });
    this.updateBuy();
  }

  updateBuy() {
    const p = this.g.progress;
    const tab = this.shopTab;
    const list = this.shopList();
    const it = list.find((x) => x.id === this.shopSel) || list[0];
    const btn = $('shopBuy');
    btn.classList.remove('cant');
    btn.disabled = false;
    if (tab === 'portal') {
      if (p.portalOpen(it.portal)) {
        btn.innerHTML = '<span>Açık</span>';
        btn.disabled = true;
      } else {
        if (p.coins < it.price) {
          btn.innerHTML = `<svg class="ico"><use href="#i-coin"/></svg><span>${it.price - p.coins} altın daha lazım</span>`;
          btn.classList.add('cant');
        } else btn.innerHTML = `<span>Portalı aç</span><svg class="ico"><use href="#i-coin"/></svg><span>${it.price}</span>`;
      }
      return;
    }
    const own = p.owns(tab, it.id);
    if (p.s.eq[tab] === it.id) {
      btn.innerHTML = '<span>Seçili</span>';
      btn.disabled = true;
    } else if (own) btn.innerHTML = '<span>Seç</span>';
    else if (p.coins < it.price) {
      btn.innerHTML = `<svg class="ico"><use href="#i-coin"/></svg><span>${it.price - p.coins} altın daha lazım</span>`;
      btn.classList.add('cant');
    } else btn.innerHTML = `<span>Al</span><svg class="ico"><use href="#i-coin"/></svg><span>${it.price}</span>`;
  }

  shopAction() {
    const p = this.g.progress;
    const tab = this.shopTab;
    const it = this.shopList().find((x) => x.id === this.shopSel);
    if (!it) return;
    if (tab === 'portal') {
      if (p.portalOpen(it.portal)) return;
      if (!p.spend(it.price)) {
        this.nope();
        return;
      }
      p.unlockPortal(it.id);
      this.g.audio.buy();
      this.g.celebrateBuy();
      this.g.hub.refresh();
    } else {
      if (!p.owns(tab, it.id)) {
        if (!p.spend(it.price)) {
          this.nope();
          return;
        }
        p.own(tab, it.id);
        this.g.audio.buy();
        this.g.celebrateBuy();
      } else this.g.audio.click();
      p.equip(tab, it.id);
      this.g.applyLook();
    }
    this.progress(p, true);
    this.renderShop();
  }

  nope() {
    this.g.audio.nope();
    this.toast('Altın yetmiyor!');
    const w = document.querySelector('#shop .wallet');
    w.classList.remove('pop');
    void w.offsetWidth;
    w.classList.add('pop');
  }
}

const HINT_HTML = `<div class="key arrows"><div class="kb-row"><kbd>↑</kbd></div><div class="kb-row"><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div>
<div class="key wasd"><div class="kb-row"><kbd>W</kbd></div><div class="kb-row"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div></div>
<div class="key space"><kbd class="wide">␣</kbd><svg class="ico"><use href="#i-up"/></svg></div>`;
