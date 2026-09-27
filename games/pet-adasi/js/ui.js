import { ICONS, icon, applyIcons } from './icons.js';
import { RARITIES, SPECIES, EGGS, VARIANTS, UPGRADES, ZONES, MERGE_COUNT, PITY_EGGS, PITY_LEG, REBIRTH_BASE, MAX_LEVEL, fmt, findPetDef, petPower, petLevel, levelXp } from './data.js';

function xpPct(xp = 0) {
  const l = petLevel(xp);
  if (l >= MAX_LEVEL) return 100;
  return Math.round(((xp - levelXp(l)) / (levelXp(l + 1) - levelXp(l))) * 100);
}
import { petThumb } from './petModels.js';

const $ = (id) => document.getElementById(id);

function rarityOf(p) {
  return findPetDef(p.sp).entry[1];
}

function borderColor(p) {
  if (p.v === 2) return RARITIES[5].color;
  if (p.v === 1) return '#ffc21a';
  return RARITIES[rarityOf(p)].color;
}

export class UI {
  constructor(G) {
    this.G = G;
    this.panel = null;
    this.sel = null;
    this.delMode = false;
    this.delAsk = false;
    this.delSet = new Set();
    this.promptKey = '';
    this.flyPool = [];
    this.lastFly = 0;
    applyIcons();
    $('btnPets').onclick = () => this.open('pets');
    $('btnShop').onclick = () => this.open('shop');
    $('btnIndex').onclick = () => this.open('index');
    $('btnSettings').onclick = () => this.open('settings');
    $('modalClose').onclick = () => this.close();
    $('modal').addEventListener('pointerdown', (e) => {
      if (e.target.id === 'modal') this.close();
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a');
      if (btn) {
        G.audio.click();
        btn.blur();
      }
    });
    $('hbOk').onclick = (e) => {
      e.stopPropagation();
      G.hatch.finish();
    };
    $('hatchUI').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      G.hatch.skip();
    });
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('div');
      el.className = 'fly';
      el.style.display = 'none';
      $('flyLayer').appendChild(el);
      this.flyPool.push({ el, t: -1 });
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.panel) {
        this.close();
        e.stopImmediatePropagation();
        return;
      }
    });
    this.coinShown = 0;
    this.gemShown = 0;
  }

  tryPromptAction() {
    const now = performance.now();
    if (this.panel || !this.promptAction || this.G.paused || now - (this.lastAction || 0) < 400) return false;
    this.lastAction = now;
    this.promptAction();
    return true;
  }

  setCurrency(coins, gems) {
    const ct = $('coinText');
    const gt = $('gemText');
    if (Math.floor(coins) !== this.coinShown) {
      if (coins > this.coinShown) this.punch('coinPill');
      this.coinShown = Math.floor(coins);
      ct.textContent = fmt(coins);
    }
    if (Math.floor(gems) !== this.gemShown) {
      if (gems > this.gemShown) this.punch('gemPill');
      this.gemShown = Math.floor(gems);
      gt.textContent = fmt(gems);
    }
  }

  punch(id) {
    const el = $(id);
    el.classList.remove('punch');
    void el.offsetWidth;
    el.classList.add('punch');
  }

  setPower(p) {
    $('powerText').textContent = fmt(p);
  }

  setPetBadge(n) {
    const b = $('petBadge');
    b.classList.toggle('hidden', !n);
    b.textContent = '+' + (n > 9 ? '9' : n);
  }

  fly(kind, sx, sy) {
    const now = performance.now();
    if (now - this.lastFly < 45) return;
    this.lastFly = now;
    const f = this.flyPool.find((p) => p.t < 0);
    if (!f) return;
    const target = $(kind === 'gem' ? 'gemPill' : 'coinPill').getBoundingClientRect();
    f.t = 0;
    f.sx = sx;
    f.sy = sy;
    f.tx = target.left + 30;
    f.ty = target.top + target.height / 2;
    f.kind = kind;
    f.el.className = 'fly ' + (kind === 'gem' ? 'ic-gem' : 'ic-coin');
    f.el.style.display = 'block';
    f.cx = sx + (Math.random() - 0.5) * 160;
    f.cy = sy - 80 - Math.random() * 120;
  }

  updateFly(dt) {
    for (const f of this.flyPool) {
      if (f.t < 0) continue;
      f.t += dt / 0.55;
      if (f.t >= 1) {
        f.t = -1;
        f.el.style.display = 'none';
        this.punch(f.kind === 'gem' ? 'gemPill' : 'coinPill');
        continue;
      }
      const t = f.t * f.t;
      const x = (1 - t) * (1 - t) * f.sx + 2 * (1 - t) * t * f.cx + t * t * f.tx;
      const y = (1 - t) * (1 - t) * f.sy + 2 * (1 - t) * t * f.cy + t * t * f.ty;
      const s = 1 + Math.sin(f.t * Math.PI) * 0.4;
      f.el.style.transform = `translate(${x - 19}px, ${y - 19}px) scale(${s.toFixed(2)})`;
    }
  }

  toast(html) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 2800);
  }

  banner(name, sub) {
    const b = $('zoneBanner');
    b.innerHTML = `${name}${sub ? `<small>${sub}</small>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    b.onanimationend = () => b.classList.remove('show');
  }

  goal(iconHtml, text, cur, max, numHtml) {
    const key = iconHtml + text;
    if (this.goalKey !== key) {
      this.goalKey = key;
      $('goalIc').innerHTML = iconHtml;
      $('goalText').textContent = text;
    }
    const pct = max > 0 ? Math.min(1, cur / max) : 1;
    $('goalFill').style.width = (pct * 100).toFixed(1) + '%';
    $('goalFill').classList.toggle('done', pct >= 1);
    const num = numHtml || (max > 0 ? `${fmt(Math.min(cur, max))} / ${fmt(max)}` : '');
    if (num !== this.goalNumHtml) {
      this.goalNumHtml = num;
      $('goalNum').innerHTML = num;
    }
  }

  showPrompt(key, build) {
    const el = $('prompt');
    if (this.promptKey !== key) {
      this.promptKey = key;
      el.classList.remove('hidden');
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
      build(el);
      applyIcons(el);
    }
  }

  hidePrompt() {
    if (!this.promptKey) return;
    this.promptKey = '';
    this.promptAction = null;
    $('prompt').classList.add('hidden');
  }

  eggPrompt(stand) {
    const G = this.G;
    const pool = G.eggPool(stand.kind);
    const key = 'egg:' + stand.kind + ':' + Object.keys(G.state.seen).length + ':' + (G.state.pityE || 0) + ':' + (G.state.pityL || 0);
    this.showPrompt(key, (el) => {
      const odds = pool.pets
        .map((p) => {
          const seen = G.state.seen[p.sp];
          const r = RARITIES[p.rarity];
          const col = pool.gold ? '#ffc21a' : r.color;
          return `<div class="odd" style="border-color:${col}"><img src="${petThumb(p.sp, pool.gold ? 1 : 0)}" class="${seen ? '' : 'unknown'}" alt=""><div class="stars${p.rarity >= 5 ? ' s6' : ''}" style="color:${r.color}">${'★'.repeat(p.rarity + 1)}</div><div class="pct">%${String(p.pct).replace('.', ',')}</div></div>`;
        })
        .join('');
      const pity = G.state.pityE || 0;
      const pityL = G.state.pityL || 0;
      const pityHtml = pool.gold ? '' : `<div class="pity">${icon('star')}<div class="pity-bar"><div class="pity-fill" style="width:${(pity / PITY_EGGS) * 100}%"></div></div><span>Epik ${pity}/${PITY_EGGS}</span></div><div class="pity leg">${icon('star')}<div class="pity-bar"><div class="pity-fill" style="width:${(pityL / PITY_LEG) * 100}%"></div></div><span>Efsanevi ${pityL}/${PITY_LEG}</span></div>`;
      el.innerHTML = `<div class="pr-title">${pool.name}</div><div class="odds">${odds}</div>${pityHtml}<div class="pr-actions"><button class="big-btn gold" id="eggBuy">${pool.gold ? icon('gem') : icon('coin')}<span>${fmt(pool.price)}</span><span class="key-hint">E</span></button></div>`;
      this.promptAction = () => G.openEgg(stand.kind);
      el.querySelector('#eggBuy').onclick = this.promptAction;
    });
    const btn = $('eggBuy');
    if (btn) {
      const can = pool.gold ? G.state.gems >= pool.price : G.state.coins >= pool.price;
      if (btn.disabled === can) btn.disabled = !can;
    }
  }

  gatePrompt(gate) {
    const G = this.G;
    const Z = ZONES[gate.i];
    this.showPrompt('gate:' + gate.i, (el) => {
      el.innerHTML = `<div class="pr-title">${Z.name}</div><div class="pr-actions"><button class="big-btn gold" id="gateBuy">${icon('lock')}<span>Aç</span>${icon('coin')}<span>${fmt(Z.gate)}</span><span class="key-hint">E</span></button></div>`;
      this.promptAction = () => G.buyGate(gate.i);
      el.querySelector('#gateBuy').onclick = this.promptAction;
    });
    const btn = $('gateBuy');
    if (btn) {
      const can = G.state.coins >= Z.gate;
      if (btn.disabled === can) btn.disabled = !can;
    }
  }

  open(name, sel) {
    this.panel = name;
    this.sel = sel ?? null;
    this.delMode = false;
    this.delAsk = false;
    this.delSet.clear();
    this.mergeAsk = null;
    $('modal').classList.remove('hidden');
    const card = $('modal').querySelector('.modal-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    this.render();
    this.G.onPanel(true);
  }

  close() {
    if (!this.panel) return;
    this.panel = null;
    $('modal').classList.add('hidden');
    this.G.onPanel(false);
  }

  render() {
    $('modal').querySelector('.modal-card').classList.toggle('fixed-h', this.panel === 'pets');
    const head = $('modal').querySelector('.modal-head');
    head.className = 'modal-head';
    const body = $('modalBody');
    if (this.panel === 'pets') this.renderPets(body);
    if (this.panel === 'shop') {
      head.classList.add('green');
      this.renderShop(body);
    }
    if (this.panel === 'index') {
      head.classList.add('blue');
      this.renderIndex(body);
    }
    if (this.panel === 'settings') {
      head.classList.add('gray');
      this.renderSettings(body);
    }
    applyIcons(body);
  }

  renderPets(body) {
    const G = this.G;
    const S = G.state;
    $('modalTitle').innerHTML = `${icon('paw')}Petlerim`;
    const pets = S.pets.slice().sort((a, b) => {
      const ea = S.equipped.includes(a.uid) ? 1 : 0;
      const eb = S.equipped.includes(b.uid) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return G.powerOf(b) - G.powerOf(a);
    });
    if (!this.sel || !S.pets.find((p) => p.uid === this.sel)) this.sel = pets[0] ? pets[0].uid : null;
    const selPet = !this.delMode && S.pets.find((p) => p.uid === this.sel);
    const mergeKey = selPet && selPet.v < 2 && S.pets.filter((p) => p.sp === selPet.sp && p.v === selPet.v).length >= MERGE_COUNT ? selPet.sp + ':' + selPet.v : null;
    const cards = pets
      .map((p, i) => {
        const eq = S.equipped.includes(p.uid);
        const cls = ['card', eq ? 'equipped' : '', this.sel === p.uid && !this.delMode ? 'sel' : '', this.delSet.has(p.uid) ? 'del' : '', this.delMode && this.protectedPet(p) ? 'locked' : '', mergeKey === p.sp + ':' + p.v ? 'merge-mark' : ''].join(' ');
        const vt = p.v === 1 ? '<span class="vtag"></span>' : p.v === 2 ? '<span class="vtag rainbow"></span>' : '';
        const lv = petLevel(p.xp);
        const lvHtml = lv > 0 ? `<span class="lvl">▲${lv}</span>` : '';
        return `<div class="${cls}" data-uid="${p.uid}" style="border-color:${borderColor(p)};animation-delay:${Math.min(i, 20) * 12}ms">${vt}${lvHtml}<img src="${petThumb(p.sp, p.v)}" alt=""><div class="pw">${icon('bolt')}${fmt(G.powerOf(p))}</div></div>`;
      })
      .join('');
    const slots = G.maxSlots();
    let detail = '';
    const sp = S.pets.find((p) => p.uid === this.sel);
    if (this.delMode && this.delAsk) {
      const thumbs = [...this.delSet].map((u) => S.pets.find((p) => p.uid === u)).filter(Boolean).map((p) => `<img src="${petThumb(p.sp, p.v)}" alt="">`).join('');
      detail = `<div class="detail del-ask"><div class="del-thumbs">${thumbs}</div><div class="dn">${icon('trash')} ${this.delSet.size}</div><div class="actions"><button class="big-btn red" id="delYes">${icon('check')}Evet, Sil</button><button class="big-btn blue small" id="delNo">${icon('x')}Hayır</button></div></div>`;
    } else if (this.delMode) {
      detail = `<div class="detail"><div class="dn">Silinecek: ${this.delSet.size}</div><div class="merge-note">Silmek istediğin petlere dokun</div><div class="actions" style="margin-top:12px"><button class="big-btn red" id="delGo" ${this.delSet.size ? '' : 'disabled'}>${icon('trash')}Sil</button><button class="big-btn blue small" id="delCancel">Vazgeç</button></div></div>`;
    } else if (sp) {
      const def = findPetDef(sp.sp);
      const r = RARITIES[def.entry[1]];
      const eq = S.equipped.includes(sp.uid);
      const same = S.pets.filter((p) => p.sp === sp.sp && p.v === sp.v).length;
      const nextName = (sp.v === 0 ? 'Altın ' : 'Gökkuşağı ') + SPECIES[sp.sp].name;
      const curName = (sp.v ? VARIANTS[sp.v].name + ' ' : '') + SPECIES[sp.sp].name;
      const slotsRow = Array.from({ length: MERGE_COUNT }, (_, i) => `<img class="${i < same ? '' : 'off'}" src="${petThumb(sp.sp, sp.v)}" alt="">`).join('');
      const mergeBtn = sp.v < 2 ? `<div class="merge-slots">${slotsRow}<span class="ms-arrow">→</span><img class="ms-next" src="${petThumb(sp.sp, sp.v + 1)}" alt=""></div><button class="big-btn gold small" id="mergeBtn" ${same >= MERGE_COUNT ? '' : 'disabled'}>${icon('merge')}${sp.v === 0 ? 'Altın Yap' : 'Gökkuşağı Yap'} ${Math.min(same, MERGE_COUNT)}/${MERGE_COUNT}</button>` : '';
      const eqBtn = `<button class="big-btn${eq ? ' ghost' : ''}" id="eqBtn" ${!eq && S.equipped.length >= slots ? 'disabled' : ''}>${eq ? 'Çıkar' : 'Tak'}</button>`;
      if (this.mergeAsk === sp.uid) {
        detail = `<div class="detail merge-ask" style="border-color:#ffc21a"><div class="mc-row"><div class="mc-pet"><img src="${petThumb(sp.sp, sp.v)}" alt=""><span class="mc-n">5</span></div><span class="mc-arrow">→</span><div class="mc-pet"><img src="${petThumb(sp.sp, sp.v + 1)}" alt=""><span class="mc-n">1</span></div></div><div class="mc-text">5 ${curName} → 1 ${nextName}</div><div class="actions"><button class="big-btn" id="mergeYes">${icon('check')}Evet</button><button class="big-btn red" id="mergeNo">${icon('x')}Hayır</button></div></div>`;
      } else detail = `<div class="detail" style="border-color:${borderColor(sp)}"><img src="${petThumb(sp.sp, sp.v)}" alt=""><div class="dn">${sp.v ? VARIANTS[sp.v].name + ' ' : ''}${SPECIES[sp.sp].name}</div><div class="dr" style="background:${r.color}">${r.name}</div><div class="dp">${icon('bolt')}${fmt(G.powerOf(sp))}${icon('level')}${petLevel(sp.xp)}</div><div class="xpbar"><div class="xpfill" style="width:${xpPct(sp.xp)}%"></div></div><div class="actions">${eq ? mergeBtn + eqBtn : eqBtn + mergeBtn}</div></div>`;
    } else {
      detail = `<div class="detail"><div class="empty">Henüz pet yok</div></div>`;
    }
    body.innerHTML = `<div class="inv-toolbar"><div class="inv-count">Takılı <b>${S.equipped.length}/${slots}</b> · Toplam ${S.pets.length}</div><button class="big-btn gold small" id="bestBtn">${icon('star')}En İyileri Tak</button><button class="big-btn ${this.delMode ? 'blue' : 'red'} small" id="delBtn">${icon('trash')}Sil</button></div><div class="inv"><div class="grid">${cards || '<div class="empty">Yumurta aç!</div>'}</div>${detail}</div>`;
    body.querySelectorAll('.card').forEach((c) => {
      c.onclick = () => {
        const uid = Number(c.dataset.uid);
        if (this.delMode) {
          const pet = S.pets.find((p) => p.uid === uid);
          if (this.protectedPet(pet)) {
            G.audio.error();
            c.classList.remove('nope');
            void c.offsetWidth;
            c.classList.add('nope');
            const note = body.querySelector('.merge-note');
            if (note) {
              note.innerHTML = `${icon('lock')}${this.lockReason(pet)}`;
              note.classList.remove('lock-why');
              void note.offsetWidth;
              note.classList.add('lock-why');
            }
            return;
          }
          this.delAsk = false;
          if (this.delSet.has(uid)) this.delSet.delete(uid);
          else this.delSet.add(uid);
        } else if (this.sel === uid) {
          G.toggleEquip(uid);
        } else this.sel = uid;
        G.audio.click();
        this.render();
      };
    });
    $('bestBtn').onclick = () => {
      G.equipBest();
      this.render();
    };
    $('delBtn').onclick = () => {
      this.delMode = !this.delMode;
      this.delAsk = false;
      this.delSet.clear();
      this.render();
    };
    const eqBtn = $('eqBtn');
    if (eqBtn) eqBtn.onclick = () => {
      G.toggleEquip(this.sel);
      this.render();
    };
    const mb = $('mergeBtn');
    if (mb) mb.onclick = () => {
      this.mergeAsk = sp.uid;
      this.render();
    };
    const my = $('mergeYes');
    if (my) my.onclick = () => {
      this.mergeAsk = null;
      const res = G.merge(sp.sp, sp.v);
      if (res) {
        this.sel = res.uid;
        this.showUndo(() => G.undoMerge());
      }
      this.render();
    };
    const mn = $('mergeNo');
    if (mn) mn.onclick = () => {
      this.mergeAsk = null;
      this.render();
    };
    const dg = $('delGo');
    if (dg) dg.onclick = () => {
      this.delAsk = true;
      this.render();
    };
    const dy = $('delYes');
    if (dy) dy.onclick = () => {
      G.deletePets([...this.delSet]);
      this.delSet.clear();
      this.delMode = false;
      this.delAsk = false;
      this.showUndo(() => G.undoDelete());
      this.render();
    };
    const dn = $('delNo');
    if (dn) dn.onclick = () => {
      this.delAsk = false;
      this.render();
    };
    const dc = $('delCancel');
    if (dc) dc.onclick = () => {
      this.delMode = false;
      this.delAsk = false;
      this.delSet.clear();
      this.render();
    };
  }

  renderShop(body) {
    const G = this.G;
    $('modalTitle').innerHTML = `${icon('cart')}Mağaza`;
    const rb = G.state.rebirths;
    const rbCost = REBIRTH_BASE * Math.pow(2, rb);
    const rbReady = G.state.zones >= ZONES.length;
    const rebirthCard = !rbReady ? `<div class="rebirth-strip">${icon('lock')}<span class="rs-ic" data-icon="rebirth"></span><span class="rs-name">Yeniden Doğ</span><span class="rs-when">${ZONES[ZONES.length - 1].name} açılınca</span></div>` : `<div class="up-card rebirth-card"><div class="up-ic" data-icon="rebirth"></div><div class="up-body"><div class="up-name">Yeniden Doğ<span class="rb-mult">x${rb + 1} → x${rb + 2}</span></div><div class="up-desc">Petler kalır, para çarpanı artar</div><button class="big-btn purple small" id="rebirthBtn" ${G.state.coins >= rbCost ? '' : 'disabled'}>${icon('coin')}${fmt(rbCost)}</button></div></div>`;
    const upCards = UPGRADES.map((u) => {
      const lvl = G.state.up[u.id];
      const max = lvl >= u.max;
      const cost = max ? 0 : u.costs[lvl];
      const pips = Array.from({ length: u.max }, (_, i) => `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('');
      return `<div class="up-card ${G.goal && G.goal.id === u.id ? 'goal-card' : ''}"><div class="up-ic" data-icon="${u.icon}"></div><div class="up-body"><div class="up-name">${u.name}</div><div class="pips">${pips}</div><div class="up-desc">${max ? 'En yüksek seviye!' : u.desc(lvl)}</div>${max ? '<button class="big-btn small" disabled>Tamam</button>' : `<button class="big-btn gold small" data-up="${u.id}" ${G.state.coins >= cost ? '' : 'disabled'}>${icon('coin')}${fmt(cost)}</button>`}</div></div>`;
    }).join('');
    body.innerHTML = `<div class="shop">${rbReady ? rebirthCard + upCards : upCards + rebirthCard}</div>`;
    const rbb = document.getElementById('rebirthBtn');
    if (rbb) rbb.onclick = () => {
      if (G.rebirth()) this.close();
      else this.render();
    };
    body.querySelectorAll('[data-up]').forEach((b) => {
      b.onclick = () => {
        G.buyUpgrade(b.dataset.up);
        this.render();
      };
    });
  }

  renderIndex(body) {
    const G = this.G;
    const total = Object.keys(SPECIES).length;
    const found = Object.keys(G.state.seen).length;
    $('modalTitle').innerHTML = `${icon('book')}Koleksiyon ${found}/${total}`;
    body.innerHTML = EGGS.map((egg) => {
      const cnt = egg.pets.filter((p) => G.state.seen[p[0]]).length;
      const locked = egg.zone >= G.state.zones;
      return `<div class="index-row"><div class="index-head">${ZONES[egg.zone].name}${locked ? icon('lock') : ''}<span class="cnt">${cnt}/${egg.pets.length}</span></div><div class="index-grid">${egg.pets
        .map((p) => {
          const seen = G.state.seen[p[0]];
          const r = RARITIES[p[1]];
          return `<div class="icard ${seen ? '' : 'unknown'}" style="border-color:${r.color}"><img src="${petThumb(p[0], 0)}" alt=""><div class="in">${seen ? SPECIES[p[0]].name : '?'}</div></div>`;
        })
        .join('')}</div></div>`;
    }).join('');
  }

  renderSettings(body) {
    const G = this.G;
    const s = G.state.settings;
    $('modalTitle').innerHTML = `${icon('gear')}Ayarlar`;
    body.innerHTML = `<div class="settings">
      <div class="set-row"><div class="lbl"><span data-icon="music"></span>Müzik</div><button class="toggle ${s.music ? 'on' : ''}" id="tMusic" aria-label="Müzik"></button></div>
      <div class="set-row"><div class="lbl"><span data-icon="sound"></span>Ses</div><button class="toggle ${s.sfx ? 'on' : ''}" id="tSfx" aria-label="Ses"></button></div>
      <div class="set-row"><div class="lbl"><span data-icon="rotate"></span>Sarsıntı</div><button class="toggle ${s.shake ? 'on' : ''}" id="tShake" aria-label="Sarsıntı"></button></div>
      <div class="set-row"><div class="lbl"><span data-icon="star"></span>Süper Grafik</div><button class="toggle ${s.quality === 'high' ? 'on' : ''}" id="tQ" aria-label="Grafik"></button></div>
      <div class="set-links"><a class="big-btn blue small" href="../../index.html">← Oyunlar</a><button class="big-btn red small" id="resetBtn">${icon('trash')}Baştan Başla</button></div>
    </div>`;
    $('tMusic').onclick = () => {
      G.setSetting('music', !s.music);
      this.render();
    };
    $('tSfx').onclick = () => {
      G.setSetting('sfx', !s.sfx);
      this.render();
    };
    $('tShake').onclick = () => {
      G.setSetting('shake', !s.shake);
      this.render();
    };
    $('tQ').onclick = () => {
      G.setSetting('quality', s.quality === 'high' ? 'low' : 'high');
      this.render();
    };
    let armed = false;
    $('resetBtn').onclick = (e) => {
      if (!armed) {
        armed = true;
        e.currentTarget.innerHTML = `${icon('trash')}Emin misin?`;
        return;
      }
      G.reset();
    };
  }

  flashEquipped() {
    document.querySelectorAll('.card.equipped').forEach((c) => {
      c.classList.remove('flash');
      void c.offsetWidth;
      c.classList.add('flash');
    });
  }

  lockReason(p) {
    if (this.G.state.equipped.includes(p.uid)) return 'Takılı pet silinemez';
    if (p.v > 0) return `${VARIANTS[p.v].name} pet silinemez`;
    return `${RARITIES[rarityOf(p)].name} pet silinemez`;
  }

  protectedPet(p) {
    return !p || this.G.state.equipped.includes(p.uid) || p.v > 0 || findPetDef(p.sp).entry[1] >= 3;
  }

  showUndo(undo) {
    const el = $('undoBar');
    el.classList.remove('hidden');
    clearTimeout(this.undoTimer);
    const fill = el.querySelector('.undo-fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    void fill.offsetWidth;
    fill.style.transition = 'width 10s linear';
    fill.style.width = '0%';
    this.undoTimer = setTimeout(() => el.classList.add('hidden'), 10000);
    $('undoBtn').onclick = () => {
      const r = undo();
      el.classList.add('hidden');
      clearTimeout(this.undoTimer);
      if (r) this.sel = r;
      if (this.panel) this.render();
    };
  }

  hatchStart() {
    $('hatchUI').classList.remove('hidden');
    $('hatchBanner').classList.remove('show');
    $('hatchTip').textContent = '';
    $('hud').classList.add('hidden');
    $('overlay').style.visibility = 'hidden';
  }

  hatchFlash(rarity) {
    const f = $('hatchFlash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
    f.style.background = rarity >= 4 ? '#fff6c9' : '#ffffff';
  }

  hatchBanner(res, tipDelay) {
    const r = RARITIES[res.rarity];
    const vr = res.v === 2 ? 5 : res.v === 1 ? 4 : res.rarity;
    const rEl = $('hbRarity');
    rEl.textContent = (res.v ? VARIANTS[res.v].name.toUpperCase() + ' ' : '') + r.name.toUpperCase() + '!';
    rEl.style.color = RARITIES[vr].color;
    rEl.classList.toggle('mythic', res.rarity === 5 || res.v === 2);
    $('hbName').textContent = SPECIES[res.sp].name;
    $('hbPower').textContent = fmt(res.power);
    $('hbNew').style.display = res.isNew ? 'inline-block' : 'none';
    applyIcons($('hatchBanner'));
    $('hatchBanner').classList.add('show');
    setTimeout(() => {
      if (!$('hatchUI').classList.contains('hidden')) $('hatchTip').textContent = 'Devam için dokun';
    }, tipDelay);
  }

  hatchEnd() {
    $('hatchUI').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('overlay').style.visibility = '';
  }
}

export { rarityOf, ICONS, petPower };
