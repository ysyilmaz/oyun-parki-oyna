const SCALES = [
  { root: 60, notes: [0, 2, 4, 7, 9], tempo: 0.28, wave: 'triangle' },
  { root: 57, notes: [0, 3, 5, 7, 10], tempo: 0.32, wave: 'triangle' },
  { root: 62, notes: [0, 1, 4, 5, 7, 8], tempo: 0.3, wave: 'sine' },
  { root: 64, notes: [0, 2, 4, 7, 11], tempo: 0.34, wave: 'sine' },
  { root: 65, notes: [0, 2, 4, 5, 7, 9], tempo: 0.24, wave: 'square' },
  { root: 55, notes: [0, 2, 3, 7, 10], tempo: 0.36, wave: 'sine' },
];

const CHORDS = [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]];

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.zone = 0;
    this.streak = 0;
    this.streakTime = 0;
    this.lastHit = 0;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = this.musicOn ? 0.16 : 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.music.connect(lp);
    lp.connect(this.master);
    this.delay = c.createDelay();
    this.delay.delayTime.value = 0.33;
    const fb = c.createGain();
    fb.gain.value = 0.28;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.music);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.step = 0;
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.2);
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  setZone(z) {
    this.zone = z;
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const sc = SCALES[this.zone] || SCALES[0];
    while (this.nextTime < c.currentTime + 0.4) {
      const t = this.nextTime;
      const s = this.step;
      const bar = Math.floor(s / 8) % 4;
      const chord = CHORDS[bar];
      if (s % 8 === 0) {
        for (const iv of chord) this.pad(midi(sc.root - 12 + iv), t, sc.tempo * 8, 0.05);
        this.tone(midi(sc.root - 24 + chord[0]), t, sc.tempo * 3, 'sine', 0.12, this.music);
      }
      if (s % 8 === 4) this.tone(midi(sc.root - 24 + chord[0] + 7), t, sc.tempo * 2, 'sine', 0.08, this.music);
      const pattern = [0, 2, 1, 3, 2, 4, 3, 1];
      if (s % 2 === 0 || Math.random() < 0.35) {
        const idx = (pattern[s % 8] + bar) % sc.notes.length;
        const oct = s % 16 > 11 ? 12 : 0;
        const n = sc.root + sc.notes[idx] + oct;
        const g = this.tone(midi(n), t, sc.tempo * 1.6, sc.wave, sc.wave === 'square' ? 0.025 : 0.07, this.music);
        if (g && s % 4 === 0) g.connect(this.delay);
      }
      if (s % 4 === 2) this.noise(t, 0.03, 0.02, 6000, this.music);
      this.nextTime += sc.tempo;
      this.step++;
    }
  }

  pad(freq, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o2.type = 'triangle';
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g);
    g.connect(this.music);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
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
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  click() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.tone(880, t, 0.08, 'sine', 0.25, null, 1320);
  }

  hit(big) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    if (t - this.lastHit < 0.05) return;
    this.lastHit = t;
    this.noise(t, 0.09, big ? 0.5 : 0.3, 900 + Math.random() * 400);
    this.tone(big ? 160 : 220, t, 0.1, 'sine', 0.35, null, 90);
  }

  coin() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    if (t - this.streakTime > 1) this.streak = 0;
    this.streakTime = t;
    const semi = Math.min(this.streak, 18);
    this.streak++;
    const f = 988 * Math.pow(2, semi / 12);
    this.tone(f, t, 0.1, 'square', 0.06);
    this.tone(f * 1.5, t + 0.05, 0.14, 'sine', 0.16);
  }

  gem() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [1568, 2093, 2637].forEach((f, i) => this.tone(f, t + i * 0.05, 0.2, 'sine', 0.14));
  }

  breakSfx() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.3, 0.5, 500);
    this.tone(523, t, 0.12, 'triangle', 0.2);
    this.tone(784, t + 0.08, 0.2, 'triangle', 0.2);
  }

  crack(level) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.12, 0.5, 2500 + level * 600);
    this.tone(300 + level * 120, t, 0.12, 'triangle', 0.25, null, 200 + level * 100);
  }

  wobble(level) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.tone(400 + level * 90, t, 0.18, 'sine', 0.18, null, 520 + level * 110);
  }

  pop() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.25, 0.6, 1800);
    this.tone(600, t, 0.35, 'sine', 0.3, null, 1400);
  }

  reveal(rarity) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    const base = [523, 587, 659, 698, 784, 880][rarity];
    const seq = rarity >= 4 ? [0, 4, 7, 12, 16, 19, 24] : rarity >= 2 ? [0, 4, 7, 12] : [0, 7, 12];
    seq.forEach((iv, i) => {
      const f = base * Math.pow(2, iv / 12);
      this.tone(f, t + i * 0.09, 0.5, 'triangle', 0.18);
      if (rarity >= 3) this.tone(f * 2, t + i * 0.09, 0.4, 'sine', 0.08);
    });
    if (rarity >= 4) {
      [0, 4, 7, 12].forEach((iv) => this.tone(base * 2 * Math.pow(2, iv / 12), t + 0.7, 1.4, 'sawtooth', 0.04));
      this.noise(t + 0.7, 1.2, 0.15, 7000);
    }
  }

  unlock() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.6, 0.4, 700);
    [0, 4, 7, 12, 16].forEach((iv, i) => this.tone(523 * Math.pow(2, iv / 12), t + 0.1 + i * 0.08, 0.5, 'triangle', 0.2));
  }

  buy() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.tone(660, t, 0.1, 'square', 0.08);
    this.tone(990, t + 0.08, 0.2, 'square', 0.08);
  }

  error() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.tone(220, t, 0.18, 'square', 0.08, null, 160);
  }

  jump() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.tone(330, t, 0.16, 'sine', 0.18, null, 660);
  }

  land() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.08, 0.18, 300);
  }

  footstep() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.05, 0.05, 400 + Math.random() * 200);
  }
}
