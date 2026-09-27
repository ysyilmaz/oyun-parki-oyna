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
const LOCK_SVG = '<svg viewBox="0 0 40 40"><rect x="8" y="17" width="24" height="18" rx="4" fill="#ffd21f" stroke="#111" stroke-width="3"/><path d="M13 17v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#111" stroke-width="4"/></svg>';
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
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
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
    this.frameTimes = [];
    this.qualityStep = 0;
    this.qualityT = 0;
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
    window.addEventListener('keydown', e => {
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
    this.render(this.garage.scene, this.garage.camera, 0.95, [0.28, 0.4, 0.95]);
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
    $('restartBtn').addEventListener('click', () => { if (this.pauseFresh()) return; this.endRace(); this.startRace(); });
    $('garageBtn').addEventListener('click', () => { if (this.pauseFresh()) return; this.endRace(); this.showMenu(); });
    $('againBtn').addEventListener('click', () => this.startRace());
    $('toGarageBtn').addEventListener('click', () => this.showMenu());
    sound.setMuted(save.muted);
    this.refreshMenu();
  }

  refreshMenu() {
    $('coinCount').textContent = save.coins;
    $('coinCount2').textContent = save.coins;
    document.querySelectorAll('.track-card').forEach(b => {
      const def = TRACKS.find(t => t.id === b.dataset.id);
      const unlocked = this.isTrackUnlocked(def.id);
      b.classList.toggle('sel', save.track === def.id);
      b.classList.toggle('locked', !unlocked);
      b.querySelectorAll('.lock,.best').forEach(e => e.remove());
      if (!unlocked) {
        const l = document.createElement('div');
        l.className = 'lock';
        l.innerHTML = `${LOCK_SVG}<div class="price"><i class="coin"></i>${def.price}</div>`;
        b.appendChild(l);
      } else if (save.bestRace[def.id]) {
        const s = document.createElement('div');
        s.className = 'best';
        s.textContent = '🏆 ' + fmt2(save.bestRace[def.id]);
        b.appendChild(s);
      }
    });
    document.querySelectorAll('.swatch').forEach(b => {
      const p = PAINTS.find(x => x.id === b.dataset.id);
      const owned = save.colors.includes(p.id);
      b.classList.toggle('sel', save.color === p.id);
      b.classList.toggle('locked', !owned);
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
    this.mode = 'menu';
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
      if (this.qualityStep >= 1) race.world.sun.shadow.mapSize.set(1024, 1024);
      if (this.qualityStep >= 2) race.setSceneryShadows(false);
      this.race = race;
      race.camera.aspect = this.aspect;
      race.camera.updateProjectionMatrix();
      await this.compileFor(race.scene, race.camera);
      this.render(race.scene, race.camera, 1, THEMES[def.theme].bloom);
      if (this.podium) { this.podium.dispose(); this.podium = null; }
      $('loading').classList.add('hidden');
      this.hud.show(true);
      $('touch').classList.toggle('hidden', !isTouch);
      input.clearPressed();
      this.mode = 'race';
      sound.playMusic(THEMES[def.theme].music);
      sound.startEngine();
      this.frameTimes = [];
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
    const coins = Math.round((COINS_BY_POS[pos - 1] || 10) * (DIFFS[save.difficulty] || DIFFS.easy).coins);
    const trackId = race.def.id;
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
    if (next) this.log('unlock', { track: next.id });
    this.endRace();
    this.showResults(results, coins, record, unlockText);
  }

  showResults(results, coins, record, unlockText) {
    const me = results.find(r => r.isPlayer);
    this.podium = new Podium(this.renderer, results, me.paint, this.garage.envRT.texture);
    this.podium.resize(this.width, this.height);
    this.mode = 'results';
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
    const rc = $('resCoins');
    rc.textContent = '0';
    const startCoins = Math.max(0, save.coins - coins);
    let shown = 0;
    const step = Math.max(1, Math.round(coins / 20));
    clearInterval(this.coinTimer);
    setTimeout(() => {
      this.coinTimer = setInterval(() => {
        shown = Math.min(coins, shown + step);
        rc.textContent = shown;
        $('coinCount2').textContent = startCoins + shown;
        sound.coin(Math.floor(shown / step));
        this.punchCoins();
        if (shown >= coins) clearInterval(this.coinTimer);
      }, 70);
    }, 700);
    sound.playMusic('win');
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
    this.showResults(results, 100, true, '');
  }

  render(scene, camera, exposure, bloom) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.renderer.toneMappingExposure = exposure;
    this.bloom.strength = bloom[0];
    this.bloom.radius = bloom[1];
    this.bloom.threshold = bloom[2];
    this.bloom.enabled = this.qualityStep < 2 && bloom[0] > 0;
    this.composer.render();
  }

  adaptQuality(dt) {
    if (debug.hq) return;
    if (this.race && this.race.state === 'countdown') { this.frameTimes = []; this.qualityT = 0; return; }
    this.frameTimes.push(dt);
    this.qualityT += dt;
    if (this.qualityT < 3) return;
    this.qualityT = 0;
    const sorted = this.frameTimes.slice().sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)];
    this.frameTimes = [];
    if (median > 0.025 && this.qualityStep < 3) {
      this.qualityStep++;
      if (this.qualityStep === 1) {
        this.renderer.setPixelRatio(Math.min(1, this.renderer.getPixelRatio()));
        const sun = this.race && this.race.world.sun;
        if (sun) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
        this.resize();
      }
      if (this.qualityStep === 2 && this.race) this.race.setSceneryShadows(false);
      if (this.qualityStep === 3) {
        this.renderer.setPixelRatio(Math.min(0.75, this.renderer.getPixelRatio()));
        this.resize();
      }
      this.log('quality', { step: this.qualityStep, medianMs: Math.round(median * 1000) });
    }
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
      this.render(this.garage.scene, this.garage.camera, 0.95, [0.28, 0.4, 0.95]);
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
      this.render(this.podium.scene, this.podium.camera, 0.95, [0.28, 0.4, 1.1]);
    }
  }
}

function drawTrackPreview(c, def) {
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
  const tr = new Track(def);
  const b = tr.bounds;
  const pad = 26;
  const sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2 - 20) / (b.maxZ - b.minZ));
  const map = (x, z) => [W / 2 - (x - b.cx) * sc, H / 2 - 10 - (z - b.cz) * sc];
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
  path(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 16; g.stroke();
  path(); g.strokeStyle = def.theme === 'neon' ? '#2a2c3a' : '#4a4d55'; g.lineWidth = 11; g.stroke();
  path(); g.strokeStyle = def.theme === 'neon' ? '#4af0ff' : '#ffffff'; g.lineWidth = 2; g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]);
  const [sx, sy] = map(tr.px[0], tr.pz[0]);
  g.fillStyle = '#fff';
  g.strokeStyle = '#111';
  g.lineWidth = 3;
  g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.fill(); g.stroke();
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
    if (app.race) return Object.assign(app.race.debugInfo(), { frameMs, quality: app.qualityStep });
    return { mode: app.mode, coins: save.coins, track: save.track, color: save.color };
  }
});
app.init().catch(e => {
  console.error(e);
  const t = document.querySelector('.load-txt');
  if (t) t.textContent = 'Bir sorun oldu. Sayfayı yenile.';
});
