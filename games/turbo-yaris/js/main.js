import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadAssets } from './assets.js';
import { Garage, Podium } from './scenes.js';
import { Race, DIFFS } from './race.js';
import { TRACKS } from './tracks.js';
import { Track } from './track.js';
import { PAINTS, paintById, cssColor } from './paints.js';
import { save, persist } from './save.js';
import { sound } from './audio.js';
import { input, bindTouch } from './input.js';
import { Hud, fmt2 } from './hud.js';
import { SpeedLines } from './effects.js';
import { THEMES } from './themes.js';

const $ = id => document.getElementById(id);
const COINS_BY_POS = [100, 70, 50, 35, 25, 15];
const PAUSE_ARM_MS = 300;
const RENDER_SCALE = [1, 1, 1, 0.85, 0.7];
const GPU_HIGH_MS = 13.5;
const GPU_LOW_MS = 8.5;
const MISS_HIGH = 0.25;
const QUALITY_WINDOW = 2;
const SETTLE_AFTER_GO = 2.5;
const LOCK_SVG = '<svg viewBox="0 0 40 40"><rect x="8" y="17" width="24" height="18" rx="4" fill="#ffd21f" stroke="#111" stroke-width="3"/><path d="M13 17v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#111" stroke-width="4"/></svg>';
const MEDAL_COLORS = ['', '#ffc233', '#d8dee8', '#e0864a'];
const DIFF_KEYS = ['easy', 'normal', 'hard'];
const DIFF_LABEL = { easy: 'KOLAY', normal: 'NORMAL', hard: 'ZOR' };
const HOLD_MS = 1000;
const MASH_WINDOW_MS = 700;
const MASH_KEYS = 4;
const COIN_COUNT_MS = 800;
const medalSvg = (place, cls = '') => `<svg class="medal ${cls}" viewBox="0 0 40 44"><path d="M11 1h7l4 12h-7zM22 1h7l-4 12h-7z" fill="#e8102a" stroke="#111" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="28" r="13" fill="${place ? MEDAL_COLORS[place] : 'rgba(255,255,255,0.08)'}" stroke="${place ? '#111' : 'rgba(255,255,255,0.55)'}" stroke-width="3" ${place ? '' : 'stroke-dasharray="4 3"'}/>${place ? `<text x="20" y="34" text-anchor="middle" font-size="16" font-weight="900" fill="#111">${place}</text>` : ''}</svg>`;
const SOUND_ON = '<svg viewBox="0 0 40 40"><path d="M6 15h7l9-7v24l-9-7H6z" fill="currentColor"/><path d="M27 13a9 9 0 0 1 0 14M31 9a14 14 0 0 1 0 22" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 40 40"><path d="M6 15h7l9-7v24l-9-7H6z" fill="currentColor"/><path d="M27 14l10 12M37 14L27 26" stroke="#ff4a5a" stroke-width="4" stroke-linecap="round"/></svg>';

function parseDebug() {
  const d = {};
  const raw = new URLSearchParams(location.search).get('debug');
  if (!raw) return d;
  raw.split(',').forEach(part => {
    const [k, v] = part.split(':');
    d[k.trim()] = v === undefined ? true : v;
  });
  return d;
}

const debug = parseDebug();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

class App {
  constructor() {
    const canvas = $('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.debug.checkShaderErrors = !!debug.shadercheck;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.85);
    this.composer.addPass(this.renderPass);
    const hp = this.bloom.materialHighPassFilter;
    hp.fragmentShader = hp.fragmentShader.replace('gl_FragColor = mix( outputColor, texel, alpha );', 'gl_FragColor = min( mix( outputColor, texel, alpha ), vec4( 3.0 ) );');
    hp.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.hud = new Hud();
    this.speedLines = new SpeedLines($('fx'));
    this.mode = 'loading';
    this.last = performance.now();
    this.qualityStep = 0;
    this.qualityBad = {};
    this.gpuTimer = new GpuTimer(renderer.getContext());
    this.events = [];
    this.ft = [];
    window.addEventListener('resize', () => this.resize());
    this.resize();
    if (isTouch) document.body.classList.add('touch-mode');
    bindTouch($('touch'));
    document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
    const unlock = () => { sound.init(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.mode === 'race') this.pause(); sound.suspend(); } else sound.resume();
    });
    window.addEventListener('blur', () => { if (this.mode === 'race') this.pause(); });
    this.keyTimes = [];
    window.addEventListener('keyup', () => { if (this.hold && this.hold.key !== 'pointer') this.cancelHold(); });
    window.addEventListener('keydown', e => {
      if (!e.repeat) { this.keyTimes.push(performance.now()); if (this.keyTimes.length > 6) this.keyTimes.shift(); }
      if (this.hold && e.code !== this.hold.key) this.cancelHold();
      const mode = this.mode;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.mode === 'race') this.pause();
        else if (this.mode === 'paused') this.resume();
      }
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'Enter' && this.mode === 'menu') this.startRace();
      if (mode === 'results' || mode === 'paused') this.screenKey(e, mode);
    });
  }

  screenKey(e, mode) {
    if (e.repeat) return;
    if (mode === 'paused' && this.pauseFresh()) { if (e.code !== 'Escape') e.preventDefault(); return; }
    const btns = [...$(mode === 'results' ? 'results' : 'pause').querySelectorAll('.play-btn, .menu-btn')];
    const i = btns.indexOf(document.activeElement);
    const focused = btns[i];
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && focused && focused.classList.contains('hold-btn')) {
      e.preventDefault();
      this.startHold(focused, e.code);
      return;
    }
    if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      const d = e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : 1;
      btns[i < 0 ? 0 : (i + d + btns.length) % btns.length].focus({ preventScroll: true });
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      if (mode === 'results' && performance.now() - this.resultsAt < 1200) return;
      (btns[i] || btns[0]).click();
    } else if (e.code === 'Escape' && mode === 'results') $('toGarageBtn').click();
  }

  get aspect() { return this.width / this.height; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.speedLines.resize(w, h);
    if (this.garage) this.garage.resize(w, h);
    if (this.podium) this.podium.resize(w, h);
    if (this.race) { this.race.camera.aspect = w / h; this.race.camera.updateProjectionMatrix(); }
  }

  async init() {
    await loadAssets(p => { $('loadFill').style.width = Math.round(p * 100) + '%'; });
    this.log('boot', { phase: 'assets' });
    this.garage = new Garage(this.renderer);
    this.log('boot', { phase: 'garage' });
    this.garage.resize(this.width, this.height);
    if (!save.colors.includes(save.color) || !PAINTS.some(p => p.id === save.color)) save.color = 'red';
    if (debug.color && PAINTS.some(p => p.id === debug.color)) save.color = debug.color;
    this.garage.setPaint(paintById(save.color), false);
    if (debug.track) {
      const def = TRACKS[Math.max(0, Math.min(TRACKS.length - 1, Number(debug.track) - 1))];
      if (def) { this.sessionUnlock = def.id; save.track = def.id; }
    }
    if (!this.isTrackUnlocked(save.track) || !TRACKS.some(t => t.id === save.track)) save.track = 'beach';
    if (!DIFFS[save.difficulty]) save.difficulty = 'easy';
    if (debug.diff && DIFFS[debug.diff]) save.difficulty = debug.diff;
    this.buildMenu();
    $('loading').querySelector('.load-txt').textContent = 'Garaj hazırlanıyor…';
    const post = new THREE.Scene();
    const b = this.bloom;
    [b.materialHighPassFilter, ...b.separableBlurMaterials, b.compositeMaterial, b.blendMaterial].forEach(m => post.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m)));
    await Promise.all([
      this.compileFor(this.garage.scene, this.garage.camera),
      this.compileFor(post, this.garage.camera)
    ]);
    this.log('boot', { phase: 'compiled' });
    this.garage.update(0.016);
    this.render(this.garage.scene, this.garage.camera, 0.82, [0.26, 0.4, 1.05]);
    await new Promise(r => requestAnimationFrame(r));
    this.readyAt = Math.round(performance.now());
    $('loading').classList.add('hidden');
    requestAnimationFrame(t => this.loop(t));
    if (debug.finish) this.debugFinish();
    else if (debug.autostart) this.startRace();
    else this.showMenu();
  }

  compileFor(scene, camera) {
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.composer.readBuffer);
    const done = r.compileAsync(scene, camera);
    r.setRenderTarget(prev);
    return done;
  }

  isTrackUnlocked(id) { return save.tracks.includes(id) || this.sessionUnlock === id; }

  buildMenu() {
    const cards = $('trackCards');
    cards.innerHTML = '';
    TRACKS.forEach(def => {
      const b = document.createElement('button');
      b.className = 'track-card';
      b.dataset.id = def.id;
      const c = document.createElement('canvas');
      c.width = 200; c.height = 244;
      drawTrackPreview(c, def);
      b.appendChild(c);
      const name = document.createElement('div');
      name.className = 'tn';
      name.textContent = def.name;
      b.appendChild(name);
      b.addEventListener('click', () => this.pickTrack(def));
      cards.appendChild(b);
    });
    const sw = $('swatches');
    sw.innerHTML = '';
    PAINTS.forEach(p => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.id = p.id;
      b.style.background = cssColor(p);
      b.title = p.name;
      b.setAttribute('aria-label', p.name);
      b.addEventListener('click', () => this.pickPaint(p, b));
      sw.appendChild(b);
    });
    document.querySelectorAll('#diffSeg button').forEach(b => b.addEventListener('click', () => {
      save.difficulty = b.dataset.d;
      persist();
      sound.init();
      sound.click();
      this.log('input', { key: 'difficulty', value: b.dataset.d });
      this.refreshMenu();
    }));
    $('shakeBtn').addEventListener('click', () => { save.shake = !save.shake; persist(); sound.click(); this.refreshMenu(); if (this.race) this.race.opts.shake = save.shake; });
    $('muteBtn').addEventListener('click', () => this.toggleMute());
    $('playBtn').addEventListener('click', () => this.startRace());
    $('pauseBtn').addEventListener('click', () => this.pause());
    $('respawnBtn').addEventListener('click', () => { if (this.race && this.race.state === 'racing') this.race.player.respawn(); });
    $('resumeBtn').addEventListener('click', () => this.resume());
    this.holdActions = { restartBtn: () => { this.endRace(); this.startRace(); }, garageBtn: () => { this.endRace(); this.showMenu(); }, exitLink: () => { location.href = $('exitLink').href; } };
    for (const id of Object.keys(this.holdActions)) {
      const b = $(id);
      b.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); this.startHold(b, 'pointer'); } });
      for (const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, () => { if (this.hold && this.hold.btn === b) this.cancelHold(); });
      b.addEventListener('click', e => e.preventDefault());
    }
    $('againBtn').addEventListener('click', () => this.startRace());
    $('toGarageBtn').addEventListener('click', () => this.showMenu());
    sound.setMuted(save.muted);
    this.refreshMenu();
  }

  mashing() {
    const now = performance.now();
    return this.keyTimes.filter(t => now - t < MASH_WINDOW_MS).length >= MASH_KEYS;
  }

  startHold(btn, key) {
    if (this.mode !== 'paused' || this.pauseFresh()) return;
    this.cancelHold();
    if (key !== 'pointer' && this.mashing()) { btn.classList.remove('nudge'); void btn.offsetWidth; btn.classList.add('nudge'); return; }
    const action = this.holdActions[btn.id];
    btn.classList.remove('nudge');
    void btn.offsetWidth;
    btn.classList.add('holding');
    sound.click();
    this.log('input', { key: 'hold', value: btn.id });
    this.hold = { btn, key, timer: setTimeout(() => { this.hold = null; btn.classList.remove('holding'); this.log('input', { key: 'holdDone', value: btn.id }); action(); }, HOLD_MS) };
  }

  cancelHold() {
    const h = this.hold;
    if (!h) return;
    this.hold = null;
    clearTimeout(h.timer);
    h.btn.classList.remove('holding');
    void h.btn.offsetWidth;
    h.btn.classList.add('nudge');
  }

  medalCount() {
    let n = 0;
    for (const t of TRACKS) for (const d of DIFF_KEYS) if (save.medals[t.id] && save.medals[t.id][d]) n++;
    return n;
  }

  nextGoal(coins = save.coins) {
    const lockedTracks = TRACKS.filter(t => !this.isTrackUnlocked(t.id));
    if (save.wins === 0 && lockedTracks.length) {
      const t = lockedTracks.slice().sort((a, b) => a.price - b.price)[0];
      return { kind: 'win', text: `Kazan: ${t.name} açılır`, track: t };
    }
    const items = lockedTracks.map(t => ({ name: t.name, price: t.price, track: t }))
      .concat(PAINTS.filter(p => !save.colors.includes(p.id)).map(p => ({ name: p.name, price: p.price, paint: p })))
      .sort((a, b) => a.price - b.price);
    if (items.length) {
      const it = items[0];
      const ready = coins >= it.price;
      return Object.assign({ kind: 'buy', text: ready ? `${it.name}: alabilirsin!` : `${it.name}: ${coins} / ${it.price}`, ready }, it);
    }
    for (const d of DIFF_KEYS) for (const t of TRACKS) if ((save.medals[t.id] || {})[d] !== 1) return { kind: 'medal', text: `Altın madalya: ${t.name} · ${DIFF_LABEL[d]}`, track: t };
    return null;
  }

  renderGoal(el, goal, fromCoins) {
    if (!goal) { el.classList.add('hidden'); return; }
    el.className = 'goal-chip ' + goal.kind + (goal.ready ? ' ready' : '');
    let icon;
    if (goal.paint) icon = `<i class="gsw" style="background:${cssColor(goal.paint)}"></i>`;
    else if (goal.kind === 'medal') icon = medalSvg(1);
    else icon = '<canvas width="50" height="61"></canvas>';
    const bar = goal.kind === 'buy' ? '<span class="gbar"><i></i></span>' : '';
    el.innerHTML = `<span class="gi">${icon}</span><span class="gt"><b>${goal.text}</b>${bar}</span>`;
    const c = el.querySelector('canvas');
    if (c) drawTrackPreview(c, goal.track, true);
    const fill = el.querySelector('.gbar i');
    if (!fill) return;
    const to = Math.min(1, save.coins / goal.price);
    if (fromCoins === undefined) { fill.style.width = (to * 100) + '%'; return; }
    fill.style.transition = 'none';
    fill.style.width = (Math.min(1, fromCoins / goal.price) * 100) + '%';
    void fill.offsetWidth;
    fill.style.transition = `width ${COIN_COUNT_MS}ms ease-out 250ms`;
    fill.style.width = (to * 100) + '%';
  }

  refreshMenu() {
    $('coinCount').textContent = save.coins;
    $('coinCount2').textContent = save.coins;
    $('medalCount').textContent = this.medalCount();
    this.renderGoal($('goalChip'), this.nextGoal());
    document.querySelectorAll('.track-card').forEach(b => {
      const def = TRACKS.find(t => t.id === b.dataset.id);
      const unlocked = this.isTrackUnlocked(def.id);
      b.classList.toggle('sel', save.track === def.id);
      b.classList.toggle('locked', !unlocked);
      b.classList.toggle('afford', !unlocked && save.coins >= def.price && save.wins > 0);
      b.querySelectorAll('.lock,.best,.medals').forEach(e => e.remove());
      if (!unlocked) {
        const l = document.createElement('div');
        l.className = 'lock';
        l.innerHTML = `${LOCK_SVG}<div class="price"><i class="coin"></i>${def.price}</div>`;
        b.appendChild(l);
      } else {
        const m = document.createElement('div');
        m.className = 'medals';
        const got = save.medals[def.id] || {};
        m.innerHTML = DIFF_KEYS.map(d => `<span class="md${d === save.difficulty ? ' cur' : ''}">${medalSvg(got[d] || 0)}</span>`).join('');
        b.appendChild(m);
      }
    });
    document.querySelectorAll('.swatch').forEach(b => {
      const p = PAINTS.find(x => x.id === b.dataset.id);
      const owned = save.colors.includes(p.id);
      b.classList.toggle('sel', save.color === p.id);
      b.classList.toggle('locked', !owned);
      b.classList.toggle('afford', !owned && save.coins >= p.price);
      b.innerHTML = owned ? '' : `<span class="lk">${LOCK_SVG}</span><span class="sp"><i class="coin"></i>${p.price}</span>`;
    });
    document.querySelectorAll('#diffSeg button').forEach(b => { const on = b.dataset.d === save.difficulty; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('shakeBtn').querySelector('span').textContent = save.shake ? 'SARSINTI: AÇIK' : 'SARSINTI: KAPALI';
    $('muteBtn').innerHTML = save.muted ? SOUND_OFF : SOUND_ON;
  }

  log(type, data) {
    this.events.push({ t: performance.now(), type, data: data || null });
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
  }

  toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 1600);
  }

  punchCoins() {
    document.querySelectorAll('.coins').forEach(c => { c.classList.remove('punch'); void c.offsetWidth; c.classList.add('punch'); });
  }

  pickTrack(def) {
    sound.init();
    if (this.isTrackUnlocked(def.id)) {
      save.track = def.id;
      sound.click();
    } else if (save.coins >= def.price) {
      save.coins -= def.price;
      save.tracks.push(def.id);
      save.track = def.id;
      this.log('unlock', { track: def.id });
      sound.record();
      this.punchCoins();
      this.toast(`${def.name} açıldı!`);
      this.garage.robot.play('Jump');
      setTimeout(() => this.garage.robot.play('Idle'), 1200);
    } else {
      sound.denied();
      this.toast(`${def.price - save.coins} altın daha lazım!`);
      const el = document.querySelector(`.track-card[data-id="${def.id}"]`);
      el.classList.remove('shake'); void el.offsetWidth; el.style.animation = 'shake 0.35s';
      setTimeout(() => { el.style.animation = ''; }, 400);
    }
    persist();
    this.refreshMenu();
  }

  pickPaint(p, el) {
    sound.init();
    if (save.colors.includes(p.id)) {
      save.color = p.id;
      sound.click();
      this.garage.setPaint(p, true);
    } else if (save.coins >= p.price) {
      save.coins -= p.price;
      save.colors.push(p.id);
      save.color = p.id;
      this.log('unlock', { color: p.id });
      sound.record();
      this.punchCoins();
      this.toast(`Yeni renk: ${p.name}!`);
      this.garage.setPaint(p, true);
    } else {
      sound.denied();
      this.toast(`${p.price - save.coins} altın daha lazım!`);
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    }
    persist();
    this.refreshMenu();
  }

  toggleMute() {
    save.muted = !save.muted;
    sound.setMuted(save.muted);
    persist();
    this.refreshMenu();
  }

  showMenu() {
    cancelAnimationFrame(this.coinRaf);
    this.mode = 'menu';
    this.setRenderScale(1);
    this.hud.show(false);
    $('touch').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('results').classList.add('hidden');
    $('menu').classList.remove('hidden');
    if (this.podium) { this.podium.dispose(); this.podium = null; }
    sound.stopEngine();
    sound.playMusic('menu');
    this.garage.setPaint(paintById(save.color), false);
    this.refreshMenu();
  }

  startRace() {
    sound.init();
    if (this.race) this.endRace();
    const def = TRACKS.find(t => t.id === save.track) || TRACKS[0];
    $('menu').classList.add('hidden');
    $('results').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('loading').classList.remove('hidden');
    $('loading').querySelector('.load-txt').textContent = `${def.name} hazırlanıyor…`;
    $('loadFill').style.width = '100%';
    this.mode = 'building';
    setTimeout(async () => {
      const race = new Race(this, def, { paintId: save.color, difficulty: save.difficulty, shake: save.shake, skipCountdown: !!debug.skipcountdown, debug, events: this.events });
      race.build();
      this.race = race;
      this.applyQuality();
      race.camera.aspect = this.aspect;
      race.camera.updateProjectionMatrix();
      race.warm(true);
      await this.compileFor(race.scene, race.camera);
      race.warm(false);
      this.render(race.scene, race.camera, 1, THEMES[def.theme].bloom);
      if (this.podium) { this.podium.dispose(); this.podium = null; }
      $('loading').classList.add('hidden');
      this.hud.show(true);
      $('touch').classList.toggle('hidden', !isTouch);
      input.clearPressed();
      this.mode = 'race';
      sound.playMusic(THEMES[def.theme].music);
      sound.startEngine();
      this.qa = null;
    }, 40);
  }

  endRace() {
    if (!this.race) return;
    this.race.dispose();
    this.race = null;
    sound.stopEngine();
    this.speedLines.draw(0.016, 0, 'rgba(255,255,255,A)');
  }

  pause() {
    if (this.mode !== 'race') return;
    this.mode = 'paused';
    document.querySelectorAll('.hold-btn').forEach(b => b.classList.remove('nudge', 'holding'));
    this.pausedAt = performance.now();
    this.log('pause');
    $('pause').classList.remove('hidden');
    $('resumeBtn').focus({ preventScroll: true });
    sound.stopEngine();
    if (sound.musicGain) sound.musicGain.gain.setTargetAtTime(0.08, sound.ctx.currentTime, 0.1);
  }

  pauseFresh() { return performance.now() - (this.pausedAt || 0) < PAUSE_ARM_MS; }

  resume() {
    if (this.mode !== 'paused') return;
    this.cancelHold();
    this.mode = 'race';
    $('pause').classList.add('hidden');
    input.clearPressed();
    this.last = performance.now();
    sound.startEngine();
    if (sound.musicGain) sound.musicGain.gain.setTargetAtTime(0.26, sound.ctx.currentTime, 0.1);
  }

  finishRace(results, race) {
    const me = results.find(r => r.isPlayer);
    const pos = me.pos;
    const coins = Math.round((COINS_BY_POS[pos - 1] || 10) * (DIFFS[race.difficulty] || DIFFS.easy).coins);
    const trackId = race.def.id;
    let medal = null;
    if (pos <= 3) {
      const row = save.medals[trackId] || (save.medals[trackId] = {});
      medal = { place: pos, diff: race.difficulty, fresh: !row[race.difficulty] || pos < row[race.difficulty] };
      if (medal.fresh) row[race.difficulty] = pos;
    }
    save.coins += coins;
    save.races++;
    if (pos === 1) save.wins++;
    const record = !!(me.time && save.bestRace[trackId] && me.time < save.bestRace[trackId]);
    if (me.bestLap && (!save.best[trackId] || me.bestLap < save.best[trackId])) save.best[trackId] = me.bestLap;
    if (me.time && (!save.bestRace[trackId] || me.time < save.bestRace[trackId])) save.bestRace[trackId] = me.time;
    let unlockText = '';
    const next = pos === 1 && save.wins === 1 ? TRACKS.filter(t => !save.tracks.includes(t.id)).sort((a, b) => a.price - b.price)[0] : null;
    if (next) {
      save.tracks.push(next.id);
      unlockText = `Yeni pist açıldı: ${next.name}!`;
    }
    persist();
    this.log('reward', { kind: 'coins', coins, position: pos });
    if (medal && medal.fresh) this.log('reward', { kind: 'medal', place: pos, difficulty: medal.diff, track: trackId });
    if (next) this.log('unlock', { track: next.id });
    this.endRace();
    this.showResults(results, coins, record, unlockText, medal);
  }

  showResults(results, coins, record, unlockText, medal) {
    const me = results.find(r => r.isPlayer);
    this.podium = new Podium(this.renderer, results, me.paint, this.garage.envRT.texture);
    this.podium.resize(this.width, this.height);
    this.mode = 'results';
    this.setRenderScale(1);
    this.hud.show(false);
    $('touch').classList.add('hidden');
    $('results').classList.remove('hidden');
    this.resultsAt = performance.now();
    $('againBtn').focus({ preventScroll: true });
    const t = $('resTitle');
    t.textContent = `${me.pos}.`;
    t.className = 'res-title ' + (me.pos === 1 ? '' : me.pos === 2 ? 'p2' : me.pos === 3 ? 'p3' : 'px');
    $('resSub').textContent = ['ŞAMPİYON!', 'SÜPER!', 'HARİKA!', 'İYİ YARIŞ!', 'İYİ YARIŞ!', 'DEVAM ET!'][me.pos - 1];
    const list = $('resList');
    list.innerHTML = '';
    results.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'res-row' + (r.isPlayer ? ' me' : '');
      row.style.animationDelay = (0.2 + i * 0.08) + 's';
      row.innerHTML = `<span class="rp">${r.pos}.</span><span class="rc" style="background:${cssColor(r.paint)}"></span><span class="rn">${r.isPlayer ? 'SEN' : r.name}</span><span class="rt">${r.time ? fmt2(r.time) : '—'}</span>`;
      list.appendChild(row);
    });
    const um = $('unlockMsg');
    um.classList.toggle('hidden', !unlockText);
    um.textContent = unlockText;
    $('recordStamp').classList.toggle('hidden', !record);
    $('recordTime').textContent = me.time ? fmt2(me.time) : '';
    if (record) setTimeout(() => sound.record(), 1100);
    const mb = $('resMedal');
    mb.classList.toggle('hidden', !medal);
    if (medal) {
      mb.className = 'res-medal' + (medal.fresh ? ' fresh' : '');
      mb.innerHTML = medalSvg(medal.place) + `<span class="bolts">${'<i></i>'.repeat(DIFF_KEYS.indexOf(medal.diff) + 1)}</span>`;
    }
    $('resCoins').textContent = coins;
    const startCoins = Math.max(0, save.coins - coins);
    this.renderGoal($('resGoal'), this.nextGoal(), startCoins);
    this.countCoins(startCoins, save.coins);
    sound.playMusic('win');
  }

  countCoins(from, to) {
    const el = $('coinCount2');
    cancelAnimationFrame(this.coinRaf);
    el.textContent = from;
    const t0 = performance.now() + 250;
    let ticks = 0;
    const f = now => {
      const k = Math.max(0, Math.min(1, (now - t0) / COIN_COUNT_MS));
      const v = Math.round(from + (to - from) * (1 - (1 - k) * (1 - k)));
      if (String(v) !== el.textContent) el.textContent = v;
      const tick = Math.floor(k * 8);
      if (tick > ticks) { ticks = tick; sound.coin(tick * 2); this.punchCoins(); }
      if (k < 1) this.coinRaf = requestAnimationFrame(f);
    };
    this.coinRaf = requestAnimationFrame(f);
  }

  debugFinish() {
    const def = TRACKS.find(t => t.id === save.track) || TRACKS[0];
    const paint = paintById(save.color);
    const names = ['Roket', 'Şimşek', 'Kaplan', 'Bulut', 'Yıldız'];
    const others = PAINTS.filter(p => p.id !== paint.id && !p.special);
    const cols = others.map(p => p.color);
    const results = [];
    for (let i = 0; i < 6; i++) {
      if (i === 0) results.push({ name: 'SEN', isPlayer: true, paint, robotColor: paint.special ? 0xffd23b : paint.color, time: 128.4, pos: 1, bestLap: 41.2 });
      else results.push({ name: names[i - 1], isPlayer: false, paint: others[i - 1], robotColor: cols[i - 1], time: 128.4 + i * 2.7, pos: i + 1, bestLap: 43 });
    }
    this.lastDebugTrack = def.id;
    this.showResults(results, 100, true, '', { place: 1, diff: save.difficulty, fresh: true });
  }

  render(scene, camera, exposure, bloom) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.renderer.toneMappingExposure = exposure;
    this.bloom.strength = bloom[0];
    this.bloom.radius = bloom[1];
    this.bloom.threshold = bloom[2];
    this.bloom.enabled = (this.mode !== 'race' || this.qualityStep < 2) && bloom[0] > 0;
    const timed = this.mode === 'race';
    this.renderer.shadowMap.autoUpdate = !timed && this.mode !== 'paused';
    if (timed) this.gpuTimer.begin();
    this.composer.render();
    if (timed) this.gpuTimer.end();
  }

  setRenderScale(k) {
    const pr = this.pixelRatio * k;
    if (Math.abs(this.renderer.getPixelRatio() - pr) < 1e-3) return;
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  applyQuality() {
    const s = this.qualityStep;
    this.setRenderScale(RENDER_SCALE[s]);
    const race = this.race;
    if (!race) return;
    const size = s >= 1 ? 1024 : 2048;
    const sh = race.world.sun.shadow;
    if (sh.mapSize.x !== size) {
      sh.mapSize.set(size, size);
      if (sh.map) { sh.map.dispose(); sh.map = null; }
      race.world.shadowReady = false;
    }
    race.setSceneryShadows(s < 1);
  }

  setQuality(step, why) {
    const now = performance.now();
    const prev = this.qualityStep;
    if (step > prev && this.qualityUpAt && now - this.qualityUpAt < 8000) this.qualityBad[prev] = now + 45000;
    if (step < prev) this.qualityUpAt = now;
    this.qualityStep = step;
    this.applyQuality();
    this.log('quality', Object.assign({ step, from: prev }, why));
  }

  adaptQuality(dt) {
    const timer = this.gpuTimer;
    timer.poll();
    const race = this.race;
    if (debug.hq || !race || race.state !== 'racing' || race.raceTime < SETTLE_AFTER_GO) { this.qa = null; timer.samples.length = 0; return; }
    const qa = this.qa || (this.qa = { t: 0, ft: [] });
    if (!qa.t) timer.samples.length = 0;
    qa.ft.push(dt);
    qa.t += dt;
    if (qa.t < QUALITY_WINDOW) return;
    const ft = qa.ft;
    this.qa = null;
    const miss = ft.filter(x => x > 0.021).length / ft.length;
    const g = timer.samples.length >= 10 ? median(timer.samples) : null;
    timer.samples.length = 0;
    const why = { gpuMs: g === null ? null : +g.toFixed(1), miss: +miss.toFixed(2), frameMs: +(median(ft) * 1000).toFixed(1) };
    this.lastQuality = why;
    const top = RENDER_SCALE.length - 1;
    if ((miss > MISS_HIGH || (g !== null && g > GPU_HIGH_MS)) && this.qualityStep < top) this.setQuality(this.qualityStep + 1, why);
    else if (g !== null && g < GPU_LOW_MS && miss < 0.05 && this.qualityStep > 0 && !((this.qualityBad[this.qualityStep - 1] || 0) > performance.now())) this.setQuality(this.qualityStep - 1, why);
  }

  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    this.ft.push(dt * 1000);
    if (this.ft.length > 180) this.ft.shift();
    dt = Math.min(dt, 0.25);
    if (this.mode === 'menu' || this.mode === 'building') {
      this.garage.update(dt);
      this.render(this.garage.scene, this.garage.camera, 0.82, [0.26, 0.4, 1.05]);
    } else if (this.mode === 'race' && this.race) {
      const speed = debug.speed ? Number(debug.speed) : 1;
      this.race.update(dt * speed);
      if (this.mode === 'race' && this.race) {
        const th = THEMES[this.race.theme];
        this.render(this.race.scene, this.race.camera, th.exposure, th.bloom);
        this.adaptQuality(dt);
        const gasBtn = document.querySelector('.t-gas');
        if (gasBtn) gasBtn.classList.toggle('on', !!this.race.gasLatched || input.touchAutoGas);
      }
    } else if (this.mode === 'paused' && this.race) {
      const th = THEMES[this.race.theme];
      this.render(this.race.scene, this.race.camera, th.exposure, th.bloom);
    } else if (this.mode === 'results' && this.podium) {
      this.podium.update(dt);
      this.render(this.podium.scene, this.podium.camera, 0.85, [0.26, 0.4, 1.15]);
    }
  }
}

const previewTracks = new Map();

function drawTrackPreview(c, def, mini) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const bgs = {
    beach: ['#57b8ff', '#bfe6ff', '#f2d99a'],
    neon: ['#12062a', '#3a1060', '#0b0716'],
    candy: ['#8cc8ff', '#ffd6f0', '#b8f0c8']
  }[def.theme];
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, bgs[0]);
  grd.addColorStop(0.55, bgs[1]);
  grd.addColorStop(1, bgs[2]);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  if (def.theme === 'beach') {
    g.fillStyle = '#1aa3c8';
    g.beginPath();
    g.moveTo(0, H * 0.75);
    g.quadraticCurveTo(W * 0.5, H * 0.68, W, H * 0.8);
    g.lineTo(W, H); g.lineTo(0, H); g.fill();
  }
  if (def.theme === 'neon') {
    for (let i = 0; i < 14; i++) {
      const bw = 10 + (i * 7) % 16, bh = 30 + (i * 37) % 90;
      g.fillStyle = '#1b0f38';
      g.fillRect(i * 15, H - bh, bw, bh);
      g.fillStyle = i % 2 ? '#ff4fd8' : '#4af0ff';
      for (let y = H - bh + 6; y < H - 4; y += 10) if ((y + i) % 3) g.fillRect(i * 15 + 3, y, 3, 3);
    }
  }
  if (!previewTracks.has(def.id)) previewTracks.set(def.id, new Track(def));
  const tr = previewTracks.get(def.id);
  const b = tr.bounds;
  const pad = mini ? 6 : 26;
  const sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2 - (mini ? 0 : 20)) / (b.maxZ - b.minZ));
  const map = (x, z) => [W / 2 - (x - b.cx) * sc, H / 2 - (mini ? 0 : 10) - (z - b.cz) * sc];
  const path = () => {
    g.beginPath();
    for (let i = 0; i <= tr.N; i += 3) {
      const k = tr.w(i);
      const [x, y] = map(tr.px[k], tr.pz[k]);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  g.lineJoin = 'round';
  const lw = mini ? 0.4 : 1;
  path(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 16 * lw; g.stroke();
  path(); g.strokeStyle = def.theme === 'neon' ? '#2a2c3a' : '#4a4d55'; g.lineWidth = 11 * lw; g.stroke();
  if (mini) return;
  path(); g.strokeStyle = def.theme === 'neon' ? '#4af0ff' : '#ffffff'; g.lineWidth = 2; g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]);
  const [sx, sy] = map(tr.px[0], tr.pz[0]);
  g.fillStyle = '#fff';
  g.strokeStyle = '#111';
  g.lineWidth = 3;
  g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.fill(); g.stroke();
}

function median(v) {
  const s = v.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.samples = [];
    this.active = null;
  }

  begin() {
    if (!this.ext || this.active || this.pending.length > 6) return;
    this.active = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active);
  }

  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  poll() {
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!disjoint) this.samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
      this.pending.shift();
    }
    if (this.samples.length > 600) this.samples.splice(0, 300);
  }
}

const app = new App();
window.__app = app;
Object.defineProperty(window, '__game', {
  get() {
    const r = app.race;
    const ev = app.events.slice(-200);
    if (!r) return { state: app.mode, player: null, camera: null, racers: [], events: ev, progress: 0 };
    const k = r.player;
    const cam = r.camera;
    const tgt = r.camLook;
    return {
      state: app.mode === 'paused' ? 'paused' : r.state,
      player: {
        pos: [+k.x.toFixed(2), +k.y.toFixed(2), +k.z.toFixed(2)],
        vel: [+k.vx.toFixed(2), +k.vy.toFixed(2), +k.vz.toFixed(2)],
        speed: +Math.abs(k.fwd).toFixed(2),
        heading: +k.heading.toFixed(3),
        grounded: k.grounded,
        lap: k.lap,
        position: r.positionOf(k),
        progress: +(k.dist / r.track.L).toFixed(4),
        offroad: k.offroad,
        wrongWay: k.wrongT > 1,
        state: k.finished ? 'finished' : k.spinT > 0 ? 'spin' : k.drift.active ? 'drift' : k.grounded ? 'driving' : 'air'
      },
      camera: { pos: [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)], target: [+tgt.x.toFixed(2), +tgt.y.toFixed(2), +tgt.z.toFixed(2)], fov: +cam.fov.toFixed(1) },
      racers: r.karts.map(x => ({ name: x.name, player: x.isPlayer, progress: +(x.dist / r.track.L).toFixed(4), lap: x.lap, finished: x.finished })),
      progress: +(k.dist / (r.track.L * 3)).toFixed(4),
      checkpoint: k.lap,
      difficulty: r.difficulty,
      events: ev
    };
  }
});
Object.defineProperty(window, '__debug', {
  get() {
    const ft = app.ft.slice().sort((x, y) => x - y);
    const frameMs = ft.length ? +ft[Math.floor(ft.length / 2)].toFixed(1) : 0;
    if (!app.race) return { mode: app.mode, coins: save.coins, track: save.track, color: save.color, readyAt: app.readyAt, frameMs };
    if (app.race) return Object.assign(app.race.debugInfo(), { frameMs, quality: app.qualityStep, qualityWhy: app.lastQuality || null });
    return { mode: app.mode, coins: save.coins, track: save.track, color: save.color };
  }
});
app.init().catch(e => {
  console.error(e);
  const t = document.querySelector('.load-txt');
  if (t) t.textContent = 'Bir sorun oldu. Sayfayı yenile.';
});
