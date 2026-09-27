const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const STYLES = [
  { root: 57, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], bpm: 118, lead: 'square', arp: [0, 7, 12, 7, 3, 7, 12, 15] },
  { root: 60, prog: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], bpm: 112, lead: 'triangle', arp: [0, 4, 7, 12, 7, 4, 7, 12] },
  { root: 62, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], bpm: 124, lead: 'sawtooth', arp: [0, 12, 7, 12, 4, 12, 7, 12] },
  { root: 55, prog: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [7, 10, 14]], bpm: 120, lead: 'square', arp: [0, 3, 7, 10, 12, 10, 7, 3] },
  { root: 59, prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bpm: 108, lead: 'sine', arp: [0, 7, 11, 14, 11, 7, 4, 7] },
  { root: 64, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bpm: 126, lead: 'triangle', arp: [12, 7, 4, 7, 12, 16, 12, 7] },
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.style = 0;
    this.streak = 0;
    this.streakT = 0;
    this.duck = 1;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.5 : 0;
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = this.musicOn ? 0.15 : 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    this.music.connect(lp);
    lp.connect(this.master);
    this.delay = c.createDelay();
    this.delay.delayTime.value = 0.375;
    const fb = c.createGain();
    fb.gain.value = 0.25;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.music);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 80);
  }

  ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.15 : 0, this.ctx.currentTime, 0.1);
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  setStyle(i) {
    this.style = i % STYLES.length;
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const st = STYLES[this.style];
    const sixteenth = 60 / st.bpm / 4;
    while (this.next < c.currentTime + 0.3) {
      const t = this.next;
      const s = this.step % 64;
      const bar = Math.floor(s / 16) % 4;
      const ch = st.prog[bar];
      const beat = s % 16;
      if (beat % 4 === 0) this.kick(t);
      if (beat === 4 || beat === 12) this.snare(t);
      if (beat % 2 === 1) this.hat(t, beat % 4 === 3 ? 0.05 : 0.03);
      if (beat % 4 === 0 || beat === 6 || beat === 14) this.tone(midi(st.root - 24 + ch[0] + (beat === 6 ? 12 : 0)), t, sixteenth * 1.8, 'triangle', 0.22, this.music);
      if (beat % 2 === 0) {
        const n = st.root + ch[0] + st.arp[(beat / 2) % 8];
        const g = this.tone(midi(n), t, sixteenth * 1.6, st.lead, st.lead === 'sawtooth' || st.lead === 'square' ? 0.035 : 0.07, this.music);
        if (g && beat % 8 === 0) g.connect(this.delay);
      }
      if (beat === 0) for (const iv of ch) this.pad(midi(st.root - 12 + iv), t, sixteenth * 15, 0.035);
      this.next += sixteenth;
      this.step++;
    }
  }

  pad(f, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.15);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g);
    g.connect(this.music);
    o.start(t);
    o.stop(t + 0.2);
  }

  snare(t) {
    this.noise(t, 0.12, 0.25, 1800, this.music);
    this.tone(200, t, 0.08, 'triangle', 0.12, this.music);
  }

  hat(t, v) {
    this.noise(t, 0.03, v * 2, 8000, this.music);
  }

  tone(freq, t, dur, type, vol, dest, slideTo) {
    const c = this.ctx;
    if (!c) return null;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
    return g;
  }

  noise(t, dur, vol, freq, dest) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  now() {
    return this.ctx.currentTime;
  }

  click() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(1200, t, 0.05, 'sine', 0.2, null, 1700);
  }

  error() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(260, t, 0.09, 'square', 0.07);
    this.tone(200, t + 0.1, 0.12, 'square', 0.07);
  }

  buy(rarity) {
    if (!this.ok()) return;
    const t = this.now();
    this.noise(t, 0.08, 0.3, 3000);
    const base = [523, 587, 659, 740, 784][rarity];
    const seq = rarity >= 3 ? [0, 4, 7, 12, 16, 19] : rarity >= 1 ? [0, 4, 7, 12] : [0, 7, 12];
    seq.forEach((iv, i) => {
      const f = base * Math.pow(2, iv / 12);
      this.tone(f, t + 0.05 + i * 0.07, 0.35, 'triangle', 0.18);
      if (rarity >= 2) this.tone(f * 2, t + 0.05 + i * 0.07, 0.25, 'sine', 0.07);
    });
    if (rarity >= 3) this.noise(t + 0.4, 0.9, 0.12, 7000);
  }

  collect(amountFrac) {
    if (!this.ok()) return;
    const t = this.now();
    if (t - this.streakT > 1.2) this.streak = 0;
    this.streakT = t;
    const semi = Math.min(this.streak, 16) + Math.round(Math.min(1, amountFrac) * 5);
    this.streak++;
    const f = 988 * Math.pow(2, semi / 12);
    this.tone(f, t, 0.08, 'square', 0.05);
    this.tone(f * 1.5, t + 0.045, 0.16, 'sine', 0.18);
  }

  coinTick(i) {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(1760 * Math.pow(2, (i % 8) / 12), t, 0.05, 'sine', 0.06);
  }

  viral() {
    if (!this.ok()) return;
    const t = this.now();
    this.noise(t, 0.5, 0.3, 1200);
    [0, 5, 9, 12, 17, 21, 24].forEach((iv, i) => this.tone(659 * Math.pow(2, iv / 12), t + i * 0.055, 0.3, 'square', 0.06));
    this.tone(330, t, 0.6, 'sawtooth', 0.05, null, 1320);
  }

  sell() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(880, t, 0.1, 'triangle', 0.18, null, 660);
    this.tone(1320, t + 0.08, 0.14, 'sine', 0.14);
  }

  undo() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(500, t, 0.15, 'triangle', 0.2, null, 900);
  }

  hold(p) {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(400 + p * 500, t, 0.05, 'sine', 0.06);
  }

  ding() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(1318, t, 0.6, 'sine', 0.2);
    this.tone(1046, t + 0.18, 0.8, 'sine', 0.2);
  }

  whoosh(up = true) {
    if (!this.ok()) return;
    const t = this.now();
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(up ? 300 : 1800, t);
    f.frequency.exponentialRampToValueAtTime(up ? 1800 : 300, t + 0.55);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    s.start(t);
    s.stop(t + 0.62);
  }

  rebirth() {
    if (!this.ok()) return;
    const t = this.now();
    this.noise(t, 1.2, 0.3, 500);
    const mel = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    mel.forEach((iv, i) => {
      this.tone(523 * Math.pow(2, iv / 12), t + 0.3 + i * 0.12, 0.45, 'square', 0.06);
      this.tone(523 * Math.pow(2, iv / 12), t + 0.3 + i * 0.12, 0.5, 'triangle', 0.14);
    });
    [0, 4, 7, 12].forEach((iv) => this.tone(261 * Math.pow(2, iv / 12), t + 1.4, 1.6, 'sawtooth', 0.05));
  }

  thud() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(90, t, 0.35, 'sine', 0.45, null, 40);
    this.noise(t, 0.25, 0.35, 300);
  }

  pop() {
    if (!this.ok()) return;
    const t = this.now();
    this.tone(600, t, 0.12, 'sine', 0.2, null, 1200);
  }

  footstep() {
    if (!this.ok()) return;
    this.noise(this.now(), 0.04, 0.04, 500 + Math.random() * 200);
  }

  jump() {
    if (!this.ok()) return;
    this.tone(330, this.now(), 0.14, 'sine', 0.14, null, 620);
  }
}
