const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const SONGS = {
  menu: { bpm: 108, chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]], kick: [0, 8], snare: [4, 12], lead: [0, -1, 1, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 2, -1], bassWave: 'triangle', leadWave: 'triangle', swing: 0 },
  beach: { bpm: 132, chords: [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]], kick: [0, 4, 8, 12], snare: [4, 12], lead: [0, 2, 1, 2, 3, -1, 2, 1, 0, -1, 1, 2, 3, 2, 1, -1], bassWave: 'sawtooth', leadWave: 'square', swing: 0 },
  neon: { bpm: 124, chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], kick: [0, 4, 8, 12], snare: [4, 12], lead: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 2], bassWave: 'sawtooth', leadWave: 'sawtooth', swing: 0, sixteenthBass: true },
  candy: { bpm: 140, chords: [[41, 45, 48], [48, 52, 55], [50, 53, 57], [46, 50, 53]], kick: [0, 6, 8, 14], snare: [4, 12], lead: [3, -1, 2, -1, 1, 2, 3, -1, 0, -1, 1, -1, 2, 1, 0, -1], bassWave: 'square', leadWave: 'triangle', swing: 0 },
  win: { bpm: 140, chords: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]], kick: [0, 8], snare: [4, 12], lead: [0, 1, 2, 3, 2, 1, 2, 3, 3, -1, 2, -1, 3, -1, -1, -1], bassWave: 'triangle', leadWave: 'square', swing: 0 }
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.engine = null;
    this.drift = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.26;
    this.musicGain.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pendingSong) this.playMusic(this.pendingSong);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  tone(freq, dur, { type = 'square', vol = 0.2, when = 0, slide = 0, dest = null, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseHit(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', when = 0, sweep = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  startEngine() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.Q.value = 3;
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    const o2 = c.createOscillator();
    o2.type = 'square';
    const o3 = c.createOscillator();
    o3.type = 'triangle';
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    o1.connect(f);
    o2.connect(g2).connect(f);
    o3.connect(f);
    f.connect(g).connect(this.sfx);
    [o1, o2, o3].forEach(o => o.start());
    const ns = c.createBufferSource();
    ns.buffer = this.noise;
    ns.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    const ng = c.createGain();
    ng.gain.value = 0;
    ns.connect(nf).connect(ng).connect(this.sfx);
    ns.start();
    const ds = c.createBufferSource();
    ds.buffer = this.noise;
    ds.loop = true;
    const df = c.createBiquadFilter();
    df.type = 'bandpass';
    df.frequency.value = 1700;
    df.Q.value = 8;
    const dg = c.createGain();
    dg.gain.value = 0;
    ds.connect(df).connect(dg).connect(this.sfx);
    ds.start();
    this.engine = { g, f, o1, o2, o3, ns, ng, nf, ds, df, dg };
  }

  setEngine(ratio, throttle, boost, drifting, driftLevel, windRatio) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    const gear = Math.min(3, Math.floor(ratio * 4));
    const inGear = ratio * 4 - gear;
    const base = 70 + gear * 18 + inGear * 90 + (boost ? 30 : 0);
    e.o1.frequency.setTargetAtTime(base, t, 0.05);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    e.o3.frequency.setTargetAtTime(base * 2.01, t, 0.05);
    e.f.frequency.setTargetAtTime(500 + ratio * 1800 + throttle * 500, t, 0.08);
    e.g.gain.setTargetAtTime(0.05 + throttle * 0.05 + ratio * 0.04, t, 0.08);
    e.ng.gain.setTargetAtTime(windRatio * 0.12, t, 0.2);
    e.nf.frequency.setTargetAtTime(300 + windRatio * 900, t, 0.2);
    e.dg.gain.setTargetAtTime(drifting ? 0.07 : 0, t, 0.04);
    e.df.frequency.setTargetAtTime(1500 + driftLevel * 350, t, 0.1);
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.1);
    e.ng.gain.setTargetAtTime(0, t, 0.1);
    e.dg.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      [e.o1, e.o2, e.o3, e.ns, e.ds].forEach(o => { try { o.stop(); } catch (err) { return; } });
    }, 400);
    this.engine = null;
  }

  countBeep(n) {
    if (n > 0) this.tone(520, 0.25, { type: 'square', vol: 0.22 });
    else { this.tone(1040, 0.6, { type: 'square', vol: 0.25 }); this.tone(1560, 0.6, { type: 'triangle', vol: 0.15 }); }
  }

  click() { this.tone(660, 0.08, { type: 'triangle', vol: 0.2 }); this.tone(990, 0.08, { type: 'triangle', vol: 0.12, when: 0.04 }); }
  pickup() { [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), 0.12, { type: 'triangle', vol: 0.18, when: i * 0.05 })); }
  roulette() { this.tone(900 + Math.random() * 400, 0.04, { type: 'square', vol: 0.06 }); }
  itemReady() { this.tone(mtof(84), 0.15, { type: 'triangle', vol: 0.2 }); this.tone(mtof(88), 0.2, { type: 'triangle', vol: 0.2, when: 0.08 }); }
  boost() { this.noiseHit(0.7, { vol: 0.5, freq: 400, sweep: 6, q: 2 }); this.tone(200, 0.5, { type: 'sawtooth', vol: 0.1, slide: 3 }); }
  miniTurbo(level) { this.noiseHit(0.4 + level * 0.1, { vol: 0.35, freq: 600, sweep: 4 }); this.tone(mtof(64 + level * 4), 0.25, { type: 'square', vol: 0.12, slide: 2 }); }
  driftLevel(level) { this.tone(mtof(76 + level * 4), 0.12, { type: 'triangle', vol: 0.18 }); }
  bump(power) { this.noiseHit(0.18, { vol: Math.min(0.6, 0.15 + power * 0.03), freq: 300, q: 0.7, type: 'lowpass' }); this.tone(90, 0.15, { type: 'sine', vol: 0.3, slide: 0.5 }); }
  spin() { this.tone(900, 0.8, { type: 'triangle', vol: 0.18, slide: 0.25 }); this.noiseHit(0.5, { vol: 0.2, freq: 2000 }); }
  shield() { this.tone(mtof(67), 0.4, { type: 'sine', vol: 0.2, slide: 2 }); this.tone(mtof(79), 0.4, { type: 'sine', vol: 0.12, slide: 2, when: 0.05 }); }
  goo() { this.tone(300, 0.3, { type: 'sine', vol: 0.25, slide: 0.4 }); this.noiseHit(0.25, { vol: 0.2, freq: 500, type: 'lowpass' }); }
  magnet() { this.tone(300, 0.6, { type: 'sawtooth', vol: 0.12, slide: 4 }); }
  magnetWarn(closeness) { this.tone(700 + closeness * 700, 0.09, { type: 'square', vol: 0.13, slide: 1.3 }); }
  land() { this.tone(80, 0.2, { type: 'sine', vol: 0.35, slide: 0.6 }); this.noiseHit(0.2, { vol: 0.15, freq: 250, type: 'lowpass' }); }
  jump() { this.tone(300, 0.3, { type: 'triangle', vol: 0.15, slide: 2.5 }); }
  lap() { [0, 4, 7].forEach((s, i) => this.tone(mtof(76 + s), 0.18, { type: 'square', vol: 0.14, when: i * 0.09 })); }
  finalLap() { [0, 4, 7, 12, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), 0.16, { type: 'square', vol: 0.15, when: i * 0.08 })); }
  coin(i) { this.tone(mtof(83 + (i % 12)), 0.08, { type: 'square', vol: 0.1 }); this.tone(mtof(90 + (i % 12)), 0.12, { type: 'square', vol: 0.1, when: 0.05 }); }
  denied() { this.tone(200, 0.15, { type: 'square', vol: 0.15 }); this.tone(150, 0.2, { type: 'square', vol: 0.15, when: 0.12 }); }
  record() { [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(72 + s), 0.2, { type: 'triangle', vol: 0.18, when: 0.5 + i * 0.07 })); }

  fanfare(good) {
    const notes = good ? [60, 64, 67, 72, 67, 72, 76, 79] : [60, 62, 64, 67, 64, 67];
    notes.forEach((n, i) => {
      this.tone(mtof(n + 12), i === notes.length - 1 ? 0.8 : 0.18, { type: 'square', vol: 0.16, when: i * 0.13 });
      this.tone(mtof(n), i === notes.length - 1 ? 0.8 : 0.18, { type: 'triangle', vol: 0.14, when: i * 0.13 });
    });
  }

  playMusic(name) {
    this.pendingSong = name;
    if (!this.ctx) return;
    if (this.song === SONGS[name]) return;
    this.song = SONGS[name];
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.song = null;
    this.pendingSong = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    const c = this.ctx;
    const s = this.song;
    if (!c || !s) return;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, s, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  playStep(step, t, s, sd) {
    const c = this.ctx;
    const bar = Math.floor(step / 16) % 8;
    const i = step % 16;
    const chord = s.chords[bar % 4];
    const dest = this.musicGain;
    const when = t - c.currentTime;
    if (s.kick.includes(i)) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (s.snare.includes(i)) this.noiseHit(0.14, { vol: 0.35, freq: 1900, q: 0.8, when, dest });
    if (i % 2 === 0) this.noiseHit(0.035, { vol: i % 4 === 2 ? 0.16 : 0.08, freq: 8000, type: 'highpass', when, dest });
    const bassEvery = s.sixteenthBass ? 1 : 2;
    if (i % bassEvery === 0) {
      const oct = (i / bassEvery) % 2 === 1 ? 12 : 0;
      this.tone(mtof(chord[0] - 12 + oct), sd * bassEvery * 0.9, { type: s.bassWave, vol: 0.16, when, dest });
    }
    if (i % 4 === 2) chord.forEach(n => this.tone(mtof(n + 12), sd * 1.2, { type: 'triangle', vol: 0.045, when, dest }));
    if (bar >= 4 || s === SONGS.menu) {
      const li = s.lead[i];
      if (li >= 0) {
        const n = li === 3 ? chord[0] + 12 : chord[li];
        this.tone(mtof(n + 24), sd * 1.6, { type: s.leadWave, vol: 0.05, when, dest });
      }
    }
  }
}

export const sound = new Sound();
