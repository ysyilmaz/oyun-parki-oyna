export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.music = null;
    this.coinStreak = 0;
    this.lastCoin = 0;
    this.stepIdx = 0;
    this.nextTime = 0;
    this.musicDef = null;
    this.timer = null;
    this.layer = 0;
  }

  setLayer(n) {
    this.layer = n;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0.7;
    this.sfx.connect(this.master);
    this.mus = c.createGain();
    this.mus.gain.value = 0.2;
    this.mus.connect(this.master);
    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.delay = c.createDelay(1);
    this.delay.delayTime.value = 0.28;
    const fb = c.createGain();
    fb.gain.value = 0.28;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.mus);
    if (this.musicDef) this.startMusic(this.musicDef);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005, when = 0, dest = null, curve = 'exp' } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'lowpass', when = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  jump() {
    this.tone(320, 0.16, { type: 'square', vol: 0.09, slide: 2.2 });
    this.tone(480, 0.12, { type: 'sine', vol: 0.12, slide: 1.8 });
  }

  land(power = 1) {
    this.tone(140, 0.12, { type: 'sine', vol: 0.18 * power, slide: 0.5 });
    this.noise(0.08, { vol: 0.06 * power, freq: 800 });
  }

  step() {
    this.noise(0.04, { vol: 0.035, freq: 1600, type: 'bandpass', q: 2 });
  }

  coin() {
    const now = performance.now();
    this.coinStreak = now - this.lastCoin < 1000 ? Math.min(this.coinStreak + 1, 14) : 0;
    this.lastCoin = now;
    const k = Math.pow(2, this.coinStreak / 12);
    this.tone(988 * k, 0.08, { type: 'square', vol: 0.07 });
    this.tone(1319 * k, 0.28, { type: 'square', vol: 0.07, when: 0.07 });
    this.tone(2637 * k, 0.2, { type: 'sine', vol: 0.05, when: 0.07 });
  }

  checkpoint() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      this.tone(f, 0.3, { type: 'triangle', vol: 0.16, when: i * 0.07 });
      this.tone(f * 2, 0.2, { type: 'sine', vol: 0.05, when: i * 0.07 });
    });
    this.noise(0.5, { vol: 0.05, freq: 6000, type: 'highpass', when: 0.3 });
  }

  pad() {
    this.tone(180, 0.45, { type: 'sine', vol: 0.3, slide: 4.5 });
    this.tone(360, 0.35, { type: 'triangle', vol: 0.1, slide: 3 });
  }

  boing() {
    this.tone(220, 0.35, { type: 'sine', vol: 0.28, slide: 2.6 });
    this.tone(233, 0.3, { type: 'triangle', vol: 0.08, slide: 2.4, when: 0.02 });
  }

  crack() {
    this.noise(0.18, { vol: 0.15, freq: 2400, type: 'bandpass', q: 3 });
    this.tone(90, 0.2, { type: 'triangle', vol: 0.12, slide: 0.6 });
  }

  death() {
    this.tone(520, 0.35, { type: 'square', vol: 0.08, slide: 0.35 });
    this.tone(380, 0.4, { type: 'triangle', vol: 0.14, slide: 0.3, when: 0.05 });
    this.noise(0.35, { vol: 0.14, freq: 1400, slide: 0.3 });
  }

  splash() {
    this.noise(0.5, { vol: 0.18, freq: 900, slide: 0.4 });
  }

  respawn() {
    [392, 523, 784].forEach((f, i) => this.tone(f, 0.18, { type: 'sine', vol: 0.12, when: i * 0.05, slide: 1.2 }));
  }

  click() {
    this.tone(660, 0.07, { type: 'triangle', vol: 0.14 });
    this.tone(990, 0.06, { type: 'sine', vol: 0.06, when: 0.03 });
  }

  buy() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, { type: 'square', vol: 0.06, when: i * 0.06 }));
  }

  nope() {
    this.tone(200, 0.15, { type: 'square', vol: 0.08 });
    this.tone(160, 0.2, { type: 'square', vol: 0.08, when: 0.12 });
  }

  win() {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
    const times = [0, 0.13, 0.26, 0.42, 0.58, 0.74, 0.86, 1.02];
    notes.forEach((f, i) => {
      this.tone(f, i === 7 ? 0.9 : 0.2, { type: 'square', vol: 0.08, when: times[i] });
      this.tone(f / 2, i === 7 ? 0.9 : 0.2, { type: 'triangle', vol: 0.12, when: times[i] });
    });
    for (let i = 0; i < 6; i++) this.noise(0.3, { vol: 0.06, freq: 5000, type: 'highpass', when: 1 + i * 0.12 });
  }

  whoosh() {
    this.noise(0.3, { vol: 0.08, freq: 500, slide: 4, type: 'bandpass', q: 1.5 });
  }

  startMusic(def) {
    this.musicDef = def;
    if (!this.ctx) return;
    this.stopMusic();
    this.stepIdx = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    const c = this.ctx;
    const d = this.musicDef;
    if (!c || !d) return;
    const stepDur = 60 / d.tempo / 2;
    while (this.nextTime < c.currentTime + 0.25) {
      this.playStep(this.stepIdx, this.nextTime - c.currentTime, stepDur, d);
      this.stepIdx++;
      this.nextTime += stepDur;
    }
  }

  playStep(i, when, dur, d) {
    const bar = Math.floor(i / 16) % d.prog.length;
    const s = i % 16;
    const deg = d.prog[bar];
    const sc = d.scale;
    const note = (k) => {
      const oct = Math.floor(k / sc.length);
      const idx = ((k % sc.length) + sc.length) % sc.length;
      return d.root + sc[idx] + 12 * oct;
    };
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (s % 4 === 0) this.tone(hz(note(deg) - 24), dur * 3.2, { type: 'triangle', vol: 0.5, when, dest: this.mus });
    if (s % 8 === 4) this.tone(hz(note(deg + 4) - 24), dur * 1.5, { type: 'triangle', vol: 0.3, when, dest: this.mus });
    const arp = [0, 2, 4, 7, 4, 2, 4, 7];
    const pattern = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];
    if (pattern[s]) {
      const k = deg + arp[s % 8] + (Math.floor(i / 32) % 2 ? 0 : 0);
      this.tone(hz(note(k)), dur * 1.4, { type: d.wave === 'sawtooth' ? 'square' : d.wave, vol: d.wave === 'sine' ? 0.22 : 0.1, when, dest: this.mus });
      if (d.wave !== 'sawtooth') this.tone(hz(note(k)), dur * 1.2, { type: 'sine', vol: 0.05, when, dest: this.delay });
    }
    const melody = [7, -1, 9, 7, -1, 4, -1, 2, 4, -1, 7, -1, 9, 11, 9, -1];
    if ((this.layer || Math.floor(i / 64) % 2 === 1) && melody[s] >= 0) {
      this.tone(hz(note(deg + melody[s]) + 12), dur * 1.6, { type: 'sine', vol: 0.12, when, dest: this.mus });
      this.tone(hz(note(deg + melody[s]) + 12), dur * 1.6, { type: 'sine', vol: 0.05, when, dest: this.delay });
    }
    if (s % 4 === 2) this.hat(when);
    if (s % 8 === 0) this.kick(when);
    if (this.layer) {
      if (s % 2 === 1) this.hat(when, 0.05);
      if (s % 8 === 4) this.snare(when);
      if (s % 4 === 0) this.tone(hz(note(deg + 2) + 12), dur * 3, { type: 'triangle', vol: 0.07, when, dest: this.mus });
    }
  }

  snare(when) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(this.mus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.16);
  }

  hat(when, vol = 0.12) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.mus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.08);
  }

  kick(when) {
    this.tone(120, 0.18, { type: 'sine', vol: 0.55, slide: 0.35, when, dest: this.mus });
  }
}
