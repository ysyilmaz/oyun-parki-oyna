const $ = id => document.getElementById(id);

export const ICONS = {
  turbo: '<svg viewBox="0 0 64 64"><defs><linearGradient id="gT" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff4a00"/><stop offset="1" stop-color="#ffe14a"/></linearGradient></defs><path d="M32 4c6 10 16 16 16 30a16 16 0 0 1-32 0c0-8 4-12 7-16 1 6 3 8 6 9-1-9 1-16 3-23z" fill="url(#gT)" stroke="#7a1d00" stroke-width="3" stroke-linejoin="round"/><path d="M32 30c3 5 7 8 7 14a7 7 0 0 1-14 0c0-4 3-8 7-14z" fill="#fff6c8"/></svg>',
  shield: '<svg viewBox="0 0 64 64"><defs><linearGradient id="gS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7ae8ff"/><stop offset="1" stop-color="#2a5bff"/></linearGradient></defs><path d="M32 4l24 9v16c0 16-11 26-24 31C19 55 8 45 8 29V13z" fill="url(#gS)" stroke="#0b1f6b" stroke-width="3" stroke-linejoin="round"/><path d="M22 31l7 7 14-15" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  goo: '<svg viewBox="0 0 64 64"><path d="M10 44c-4-10 4-16 10-14 0-10 10-16 18-10 8-6 20 2 16 12 6 2 6 12-2 14-4 6-14 6-18 2-6 4-18 4-24-4z" fill="#3be83b" stroke="#0b5a0b" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="36" r="4" fill="#fff"/><circle cx="40" cy="36" r="4" fill="#fff"/><circle cx="27" cy="37" r="2" fill="#0b3a0b"/><circle cx="41" cy="37" r="2" fill="#0b3a0b"/><circle cx="46" cy="24" r="3" fill="#bfffbf"/></svg>',
  magnet: '<svg viewBox="0 0 64 64"><path d="M12 30a20 20 0 0 0 40 0V10H40v20a8 8 0 0 1-16 0V10H12z" fill="#ff2330" stroke="#6a0008" stroke-width="3" stroke-linejoin="round"/><rect x="12" y="8" width="12" height="9" fill="#e8eef8" stroke="#6a0008" stroke-width="3"/><rect x="40" y="8" width="12" height="9" fill="#e8eef8" stroke="#6a0008" stroke-width="3"/><path d="M4 50l6-4M60 50l-6-4M32 60v-6" stroke="#ffd23b" stroke-width="4" stroke-linecap="round"/></svg>'
};

export class Hud {
  constructor() {
    this.el = $('hud');
    this.posNum = $('posNum');
    this.posTotal = $('posTotal');
    this.lapNum = $('lapNum');
    this.lapTotal = $('lapTotal');
    this.lapTime = $('lapTime');
    this.itemSlot = $('itemSlot');
    this.itemIcon = $('itemIcon');
    this.centerEl = $('center');
    this.popupEl = $('popup');
    this.wrongEl = $('wrongWay');
    this.magEl = $('magnetWarn');
    this.magEl.innerHTML = ICONS.magnet + '<svg class="arr" viewBox="0 0 44 26"><path d="M4 4l18 18L40 4" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    this.mini = $('minimap');
    this.speedo = $('speedo');
    this.mctx = this.mini.getContext('2d');
    this.sctx = this.speedo.getContext('2d');
    this.last = {};
    this.rouletteKeys = Object.keys(ICONS);
    this.popTimer = null;
    this.hintEl = $('hint');
    this.hintTimer = null;
    this.gasLockEl = $('gasLock');
  }

  hint(html, ms = 4000) {
    const h = this.hintEl;
    h.innerHTML = html;
    h.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => h.classList.remove('show'), ms);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    this.hintEl.classList.remove('show');
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  set(key, el, value, fn) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    fn ? fn(value) : (el.textContent = value);
  }

  setPos(p, total) {
    this.set('pos', this.posNum, p, v => {
      this.posNum.textContent = v;
      this.posNum.parentElement.dataset.p = v;
      this.posNum.parentElement.classList.remove('bump');
      void this.posNum.parentElement.offsetWidth;
      this.posNum.parentElement.classList.add('bump');
    });
    this.set('total', this.posTotal, '/' + total);
  }

  setLap(l, total) {
    this.set('lap', this.lapNum, Math.min(l, total));
    this.set('lapTotal', this.lapTotal, total);
  }

  setTime(t) { this.set('time', this.lapTime, fmt(t)); }

  setItem(item, rolling, t) {
    if (rolling) {
      const k = this.rouletteKeys[Math.floor(t * 14) % 4];
      this.set('item', this.itemIcon, 'r' + k, () => { this.itemIcon.innerHTML = ICONS[k]; });
      this.itemSlot.classList.add('rolling');
      return;
    }
    this.itemSlot.classList.remove('rolling');
    this.set('item', this.itemIcon, item || '', v => {
      this.itemIcon.innerHTML = v ? ICONS[v] : '<svg viewBox="0 0 64 64"><rect x="10" y="10" width="44" height="44" rx="10" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="4" stroke-dasharray="8 6"/><text x="32" y="44" text-anchor="middle" font-size="32" font-weight="900" fill="rgba(255,255,255,0.3)">?</text></svg>';
      this.itemSlot.classList.toggle('has', !!v);
      if (v) { this.itemSlot.classList.remove('pop'); void this.itemSlot.offsetWidth; this.itemSlot.classList.add('pop'); }
    });
  }

  center(text, cls = '') {
    const c = this.centerEl;
    c.className = 'center-msg';
    void c.offsetWidth;
    c.textContent = text;
    if (text) c.classList.add('show', ...cls.split(' ').filter(Boolean));
  }

  popup(text, cls = '', ms = 1400) {
    const p = this.popupEl;
    p.className = 'popup';
    void p.offsetWidth;
    p.innerHTML = text;
    p.classList.add('show', ...cls.split(' ').filter(Boolean));
    clearTimeout(this.popTimer);
    this.popTimer = setTimeout(() => p.classList.remove('show'), ms);
  }

  gasLock(v) { this.set('gasLock', this.gasLockEl, v, x => this.gasLockEl.classList.toggle('hidden', !x)); }

  counting(v) { this.set('counting', this.el, v, x => this.el.classList.toggle('counting', x)); }

  wrong(v) { this.set('wrong', this.wrongEl, v, x => this.wrongEl.classList.toggle('hidden', !x)); }

  magnet(level) {
    this.set('magnet', this.magEl, level, x => { this.magEl.classList.toggle('hidden', !x); this.magEl.classList.toggle('near', x === 2); });
  }

  buildMinimap(track, theme) {
    const S = this.mini.width;
    const pad = 22;
    const b = track.bounds;
    const w = b.maxX - b.minX, h = b.maxZ - b.minZ;
    const sc = (S - pad * 2) / Math.max(w, h);
    this.mapT = (x, z) => [S / 2 + (x - b.cx) * sc * -1, S / 2 + (z - b.cz) * sc * -1];
    const off = document.createElement('canvas');
    off.width = off.height = S;
    const g = off.getContext('2d');
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= track.N; i += 2) {
        const k = track.w(i);
        const [x, y] = this.mapT(track.px[k], track.pz[k]);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    };
    g.lineJoin = 'round';
    path();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 15;
    g.stroke();
    path();
    g.strokeStyle = theme === 'neon' ? '#8ff3ff' : theme === 'candy' ? '#ffe3f3' : '#ffffff';
    g.lineWidth = 8;
    g.stroke();
    const [sx, sy] = this.mapT(track.px[0], track.pz[0]);
    const [sx2, sy2] = this.mapT(track.px[0] + track.rx[0] * 12, track.pz[0] + track.rz[0] * 12);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(sx - (sx2 - sx), sy - (sy2 - sy)); g.lineTo(sx2, sy2); g.stroke();
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(sx - (sx2 - sx), sy - (sy2 - sy)); g.lineTo(sx2, sy2); g.stroke();
    this.mapBase = off;
  }

  drawMinimap(karts, player, colors) {
    const g = this.mctx;
    const S = this.mini.width;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.mapBase, 0, 0);
    karts.forEach((k, n) => {
      if (k === player) return;
      const [x, y] = this.mapT(k.x, k.z);
      g.fillStyle = colors[n];
      g.strokeStyle = '#111';
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    const [x, y] = this.mapT(player.x, player.z);
    const a = player.heading;
    g.save();
    g.translate(x, y);
    g.rotate(-a + Math.PI);
    g.fillStyle = '#ffd400';
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 12); g.lineTo(8, -8); g.lineTo(0, -4); g.lineTo(-8, -8); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  drawSpeedo(ratio, kmh, boost, driftLevel, driftCharge) {
    const g = this.sctx;
    const S = this.speedo.width;
    const cx = S / 2, cy = S / 2 + 6, R = S * 0.42;
    g.clearRect(0, 0, S, S);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.beginPath();
    g.arc(cx, cy, R + 10, 0, Math.PI * 2);
    const bg = g.createRadialGradient(cx, cy - 20, 10, cx, cy, R + 12);
    bg.addColorStop(0, 'rgba(40,44,70,0.92)');
    bg.addColorStop(1, 'rgba(10,12,24,0.92)');
    g.fillStyle = bg;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = boost ? '#ffb31a' : 'rgba(255,255,255,0.85)';
    g.stroke();
    g.lineCap = 'round';
    g.lineWidth = 14;
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath(); g.arc(cx, cy, R - 8, a0, a1); g.stroke();
    const r = Math.min(1, ratio / 1.34);
    const grad = g.createLinearGradient(cx - R, 0, cx + R, 0);
    grad.addColorStop(0, '#3bff8a');
    grad.addColorStop(0.55, '#ffe23b');
    grad.addColorStop(1, '#ff3b3b');
    g.strokeStyle = grad;
    g.beginPath(); g.arc(cx, cy, R - 8, a0, a0 + (a1 - a0) * r); g.stroke();
    g.lineCap = 'butt';
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * i / 10;
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = i % 5 === 0 ? 4 : 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
      g.lineTo(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
      g.stroke();
    }
    const na = a0 + (a1 - a0) * r;
    g.strokeStyle = '#ff2b4a';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(na) * (R - 26), cy + Math.sin(na) * (R - 26)); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
    g.font = 'italic 900 50px "Arial Black", "Segoe UI Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = '#000';
    g.strokeText(String(kmh), cx, cy + 48);
    g.fillStyle = boost ? '#ffd23b' : '#fff';
    g.fillText(String(kmh), cx, cy + 48);
    g.font = '900 16px "Arial Black", "Segoe UI Black", sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText('km/sa', cx, cy + 80);
    if (driftCharge > 0) {
      const cols = ['#ffffff', '#3ba8ff', '#ff9b1a', '#c63bff'];
      g.lineWidth = 8;
      g.lineCap = 'round';
      g.strokeStyle = cols[driftLevel];
      g.beginPath();
      g.arc(cx, cy, R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, driftCharge / 2.5));
      g.stroke();
    }
  }
}

export function fmt(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function fmt2(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
