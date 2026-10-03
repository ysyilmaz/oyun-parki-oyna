import * as THREE from 'three';

const cache = new Map();
let maxAniso = 4;

export function setMaxAnisotropy(v) {
  maxAniso = Math.min(8, v || 4);
}

function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rng(seed) {
  return mulberry(seed);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tileNoise(size, period, seed) {
  const r = mulberry(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (a, b) => g[(((b % period) + period) % period) * period + (((a % period) + period) % period)];
  return (x, y) => {
    const fx = (x / size) * period;
    const fy = (y / size) * period;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(size, seed, octaves = 4, base = 4) {
  const ns = [];
  for (let o = 0; o < octaves; o++) ns.push(tileNoise(size, base << o, seed + o * 17));
  return (x, y) => {
    let v = 0;
    let a = 0.5;
    let t = 0;
    for (const n of ns) {
      v += n(x, y) * a;
      t += a;
      a *= 0.5;
    }
    return v / t;
  };
}

function paint(size, fn) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const col = fn(x, y);
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = col[3] === undefined ? 255 : col[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

const clamp = (v) => Math.max(0, Math.min(255, v));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

export function studTop() {
  return memo('studTop', () => {
    const S = 256;
    const n = fbm(S, 11, 4, 8);
    const c = paint(S, (x, y) => {
      const v = 228 + (n(x, y) - 0.5) * 26;
      return [v, v, v];
    });
    const ctx = c.getContext('2d');
    const cells = 4;
    const cs = S / cells;
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const cx = i * cs + cs / 2;
        const cy = j * cs + cs / 2;
        const r = cs * 0.3;
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(cx + 3, cy + 5, r * 1.02, r * 1.02, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.7, '#f1f1f1');
        g.addColorStop(1, '#d4d4d4');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    return tex(c);
  });
}

export function studSide() {
  return memo('studSide', () => {
    const S = 256;
    const n = fbm(S, 23, 4, 8);
    const c = paint(S, (x, y) => {
      const v = 222 + (n(x, y) - 0.5) * 22 - (y % 64 < 3 ? 26 : 0) + (y % 64 > 3 && y % 64 < 6 ? 12 : 0);
      return [v, v, v];
    });
    return tex(c);
  });
}

export function grass() {
  return memo('grass', () => {
    const S = 256;
    const n = fbm(S, 5, 4, 4);
    const n2 = fbm(S, 9, 3, 16);
    const a = hex(0x4fae32);
    const b = hex(0x8ee04e);
    const c = paint(S, (x, y) => {
      const t = n(x, y) * 0.8 + n2(x, y) * 0.35;
      const col = mix3(a, b, Math.min(1, Math.max(0, t * 1.3 - 0.2)));
      return col;
    });
    const ctx = c.getContext('2d');
    const r = mulberry(77);
    for (let i = 0; i < 1800; i++) {
      const x = r() * S;
      const y = r() * S;
      const l = 3 + r() * 6;
      const light = r() > 0.5;
      ctx.strokeStyle = light ? `rgba(190,255,120,${0.35 + r() * 0.3})` : `rgba(40,110,30,${0.3 + r() * 0.3})`;
      ctx.lineWidth = 1.2 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 3, y - l);
      ctx.stroke();
    }
    const cols = ['#ffffff', '#ffe34d', '#ff8fc8', '#ffffff'];
    for (let i = 0; i < 26; i++) {
      const x = r() * S;
      const y = r() * S;
      ctx.fillStyle = cols[i % cols.length];
      for (let k = 0; k < 5; k++) {
        const a2 = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a2) * 2.2, y + Math.sin(a2) * 2.2, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c);
  });
}

export function rock(kind = 'dirt') {
  return memo('rock' + kind, () => {
    const S = 256;
    const n = fbm(S, kind === 'dirt' ? 31 : 41, 5, 4);
    const n2 = fbm(S, 53, 3, 8);
    const pal = {
      dirt: [hex(0x7a5236), hex(0xb07a4c), hex(0x5e3d27)],
      basalt: [hex(0x2e2733), hex(0x4d4252), hex(0x1c171f)],
      ice: [hex(0x9fd8ff), hex(0xe4f6ff), hex(0x6ab8ef)],
      slate: [hex(0x8a909c), hex(0xb4b8c0), hex(0x5c626e)],
      root: [hex(0x3a2a1e), hex(0x6a4c34), hex(0x22180f)],
    }[kind];
    const c = paint(S, (x, y) => {
      const w = n(x, y);
      const band = Math.sin((y / S) * Math.PI * 2 * 5 + w * 9) * 0.5 + 0.5;
      let col = mix3(pal[0], pal[1], band * 0.7 + n2(x, y) * 0.3);
      if (w < 0.36) col = mix3(col, pal[2], 0.6);
      return col;
    });
    const ctx = c.getContext('2d');
    const r = mulberry(kind.length * 97);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      let x = r() * S;
      let y = r() * S;
      ctx.strokeStyle = kind === 'ice' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return tex(c);
  });
}

export function stoneTop() {
  return memo('stoneTop', () => {
    const S = 256;
    const n = fbm(S, 61, 4, 8);
    const c = paint(S, (x, y) => {
      const gx = x % 128;
      const gy = y % 128;
      const edge = Math.min(gx, gy, 127 - gx, 127 - gy);
      let v = 128 + (n(x, y) - 0.5) * 40;
      if (edge < 3) v -= 55;
      else if (edge < 7) v += 16;
      return [v * 0.95, v * 0.88, v * 1.02];
    });
    return tex(c);
  });
}

export function brick() {
  return memo('brick', () => {
    const S = 256;
    const n = fbm(S, 71, 4, 8);
    const r = mulberry(3);
    const shades = [];
    for (let i = 0; i < 64; i++) shades.push(0.8 + r() * 0.35);
    const c = paint(S, (x, y) => {
      const row = Math.floor(y / 32);
      const off = row % 2 ? 32 : 0;
      const bx = Math.floor((x + off) / 64) % 4;
      const lx = (x + off) % 64;
      const ly = y % 32;
      const s = shades[(row * 4 + bx) % 64];
      const base = 118 * s + (n(x, y) - 0.5) * 40;
      if (lx < 3 || ly < 3) return [48, 40, 52];
      const hi = ly < 6 || lx < 6 ? 14 : 0;
      return [clamp(base * 0.98 + hi), clamp(base * 0.86 + hi), clamp(base * 0.95 + hi)];
    });
    return tex(c);
  });
}

export function metal() {
  return memo('metal', () => {
    const S = 256;
    const n = fbm(S, 81, 4, 16);
    const c = paint(S, (x, y) => {
      const gx = x % 128;
      const gy = y % 128;
      const edge = Math.min(gx, gy, 127 - gx, 127 - gy);
      let v = 200 + (n(x, y) - 0.5) * 30;
      if (edge < 2) v = 120;
      else if (edge < 5) v += 25;
      return [v, v, v];
    });
    const ctx = c.getContext('2d');
    for (const [x, y] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
      for (const [ox, oy] of [[0, 0], [128, 0], [0, 128], [128, 128]]) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(x + ox + 1, y + oy + 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4f4f4';
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tex(c);
  });
}

export function brushed() {
  return memo('brushed', () => {
    const S = 256;
    const r = mulberry(91);
    const rows = new Float32Array(S);
    for (let y = 0; y < S; y++) rows[y] = r();
    const n = fbm(S, 93, 3, 8);
    const c = paint(S, (x, y) => {
      const v = 196 + (rows[y] - 0.5) * 46 + (rows[(y + 1) % S] - 0.5) * 20 + (n(x, y) - 0.5) * 24;
      return [v, v, v];
    });
    return tex(c);
  });
}

export function flame() {
  return memo('flame', () => {
    const W = 64;
    const H = 128;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.translate(W / 2, H * 0.72);
    ctx.scale(1, 2.1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,236,190,0.9)');
    g.addColorStop(0.65, 'rgba(255,160,70,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    return tex(c, { repeat: false });
  });
}

export function hazard() {
  return memo('hazard', () => {
    const S = 128;
    const c = paint(S, (x, y) => {
      const s = Math.floor((x + y) / 32) % 2;
      return s ? [255, 206, 30] : [36, 32, 40];
    });
    return tex(c);
  });
}

export function candy(a = '#ffffff', b = '#ff4d5e') {
  return memo('candy' + a + b, () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = b;
    for (let i = -2; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64 + 32, 0);
      ctx.lineTo(i * 64 + 32 + S, S);
      ctx.lineTo(i * 64 + S, S);
      ctx.fill();
    }
    return tex(c);
  });
}

export function conveyor(dir = 'z') {
  return memo('conveyor' + dir, () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#26282e';
    ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate({ z: Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 }[dir] || 0);
    ctx.translate(-S / 2, -S / 2);
    ctx.fillStyle = '#34373f';
    for (let y = 0; y < S; y += 16) ctx.fillRect(0, y, S, 3);
    ctx.fillStyle = '#ffffff';
    for (const oy of [0, 64]) {
      ctx.beginPath();
      ctx.moveTo(24, oy + 50);
      ctx.lineTo(64, oy + 14);
      ctx.lineTo(104, oy + 50);
      ctx.lineTo(88, oy + 50);
      ctx.lineTo(64, oy + 30);
      ctx.lineTo(40, oy + 50);
      ctx.closePath();
      ctx.fill();
    }
    return tex(c);
  });
}

export function crackedTop() {
  return memo('crackedTop', () => {
    const S = 256;
    const n = fbm(S, 141, 4, 8);
    const c = paint(S, (x, y) => {
      const v = 226 + (n(x, y) - 0.5) * 34;
      return [v, v, v];
    });
    const ctx = c.getContext('2d');
    const r = mulberry(151);
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = r() * S;
      let y = r() * S;
      ctx.strokeStyle = 'rgba(60,35,10,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, S - 6, S - 6);
    return tex(c);
  });
}

export function ice() {
  return memo('ice', () => {
    const S = 256;
    const n = fbm(S, 91, 5, 4);
    const c = paint(S, (x, y) => {
      const v = n(x, y);
      return mix3(hex(0xbfe6ff), hex(0xf4fbff), Math.min(1, v * 1.4 - 0.1));
    });
    const ctx = c.getContext('2d');
    const r = mulberry(19);
    for (let i = 0; i < 18; i++) {
      let x = r() * S;
      let y = r() * S;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 60;
        y += (r() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(r() * S, r() * S, 2, 2);
    }
    return tex(c);
  });
}

export function snow() {
  return memo('snow', () => {
    const S = 256;
    const n = fbm(S, 101, 4, 8);
    const c = paint(S, (x, y) => {
      const v = 232 + (n(x, y) - 0.5) * 30;
      return [v, v + 4, 255];
    });
    return tex(c);
  });
}

export function wood() {
  return memo('wood', () => {
    const S = 256;
    const n = fbm(S, 111, 4, 4);
    const r = mulberry(5);
    const tones = [];
    for (let i = 0; i < 8; i++) tones.push(0.85 + r() * 0.3);
    const c = paint(S, (x, y) => {
      const plank = Math.floor(x / 32);
      const lx = x % 32;
      const t = tones[plank % 8];
      const grain = Math.sin(y * 0.09 + n(x, y) * 14 + plank * 3) * 0.5 + 0.5;
      let col = mix3(hex(0xa8703f), hex(0xd49a5c), grain * 0.6 + 0.2);
      col = col.map((v) => v * t);
      if (lx < 2) col = [70, 42, 22];
      else if (lx > 29) col = col.map((v) => v * 0.8);
      return col;
    });
    const ctx = c.getContext('2d');
    for (let p = 0; p < 8; p++) {
      for (const yy of [40, 168]) {
        ctx.fillStyle = '#5a3a1e';
        ctx.beginPath();
        ctx.arc(p * 32 + 16, (yy + p * 23) % 256, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tex(c);
  });
}

export function moss() {
  return memo('moss', () => {
    const S = 256;
    const n = fbm(S, 171, 4, 4);
    const n2 = fbm(S, 177, 3, 16);
    const a = hex(0x2f5e3c);
    const b = hex(0x6a9a5a);
    const c = paint(S, (x, y) => {
      const t = Math.min(1, Math.max(0, n(x, y) * 1.2 + n2(x, y) * 0.4 - 0.35));
      return mix3(a, b, t);
    });
    const ctx = c.getContext('2d');
    const r = mulberry(181);
    for (let i = 0; i < 700; i++) {
      const x = r() * S;
      const y = r() * S;
      const l = 2 + r() * 4;
      ctx.strokeStyle = r() > 0.5 ? `rgba(130,190,120,${0.25 + r() * 0.25})` : `rgba(20,50,30,${0.2 + r() * 0.25})`;
      ctx.lineWidth = 1 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 2, y - l);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(220,235,190,${0.25 + r() * 0.2})`;
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, 1.2 + r() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c);
  });
}

export function bark() {
  return memo('bark', () => {
    const S = 256;
    const n = fbm(S, 191, 4, 4);
    const c = paint(S, (x, y) => {
      const w = n(x, y);
      const f = Math.abs(Math.sin((x / S) * Math.PI * 12 + w * 7));
      let col = mix3(hex(0x2e2016), hex(0x6e5038), Math.pow(f, 0.6) * 0.8 + w * 0.3);
      if (f < 0.12) col = mix3(col, hex(0x140c08), 0.7);
      return col;
    });
    const ctx = c.getContext('2d');
    const r = mulberry(197);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(110,170,110,${0.18 + r() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(r() * S, r() * S, 3 + r() * 9, 2 + r() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c);
  });
}

export function mossWood() {
  return memo('mossWood', () => {
    const S = 256;
    const n = fbm(S, 211, 4, 4);
    const m = fbm(S, 223, 4, 4);
    const c = paint(S, (x, y) => {
      const dx = (x % 128) - 64;
      const dy = (y % 128) - 64;
      const d = Math.sqrt(dx * dx + dy * dy) + n(x, y) * 26;
      const ring = 0.5 + 0.5 * Math.sin(d * 0.55);
      let col = mix3(hex(0xa8835c), hex(0xe2c8a0), ring * 0.55 + 0.25);
      const moss = m(x, y);
      if (moss > 0.56) col = mix3(col, hex(0xd8ead0), Math.min(1, (moss - 0.56) * 6) * 0.7);
      return col;
    });
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(60,40,20,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
    return tex(c);
  });
}

export function leaf() {
  return memo('leaf', () => {
    const S = 256;
    const n = fbm(S, 233, 4, 8);
    const c = paint(S, (x, y) => {
      const t = n(x, y);
      return mix3(hex(0x2f7a3e), hex(0x6cc06a), t);
    });
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(210,255,190,0.55)';
    ctx.lineWidth = 5;
    for (const o of [0, 128]) {
      ctx.beginPath();
      ctx.moveTo(o + 64, 0);
      ctx.lineTo(o + 64, S);
      ctx.stroke();
    }
    ctx.lineWidth = 2.2;
    for (const o of [0, 128]) {
      for (let y = -20; y < S + 20; y += 26) {
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(o + 64, y);
          ctx.quadraticCurveTo(o + 64 + sx * 30, y - 6, o + 64 + sx * 60, y - 26);
          ctx.stroke();
        }
      }
    }
    return tex(c);
  });
}

export function puff() {
  return memo('puff', () => {
    const S = 256;
    const n = fbm(S, 241, 4, 8);
    const c = paint(S, (x, y) => {
      const v = n(x, y);
      return mix3(hex(0xcfc0a0), hex(0xf6eedc), v * 1.2 - 0.1);
    });
    const ctx = c.getContext('2d');
    const r = mulberry(251);
    for (let i = 0; i < 160; i++) {
      const x = r() * S;
      const y = r() * S;
      const rr = 1.5 + r() * 3.5;
      ctx.fillStyle = `rgba(150,120,80,${0.25 + r() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,245,0.6)';
      ctx.beginPath();
      ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c);
  });
}

export function strand() {
  return memo('strand', () => {
    const W = 64;
    const H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const r = mulberry(263);
    for (let i = 0; i < 9; i++) {
      const x0 = 6 + r() * (W - 12);
      const len = H * (0.45 + r() * 0.55);
      ctx.strokeStyle = r() > 0.5 ? 'rgba(90,150,90,1)' : 'rgba(60,110,70,1)';
      ctx.lineWidth = 2 + r() * 2;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y < len; y += 16) ctx.lineTo(x0 + Math.sin(y * 0.05 + i) * 4, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,190,110,1)';
      for (let y = 12; y < len; y += 18 + r() * 14) {
        ctx.beginPath();
        ctx.ellipse(x0 + Math.sin(y * 0.05 + i) * 4 + (r() - 0.5) * 6, y, 3.5, 6, r(), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tex(c, { repeat: false });
  });
}

export function neonPanel() {
  return memo('neonPanel', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, S - 12, S - 12);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(S / 2, 6);
    ctx.lineTo(S / 2, S - 6);
    ctx.moveTo(6, S / 2);
    ctx.lineTo(S - 6, S / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const [x, y] of [[20, 20], [S - 20, 20], [20, S - 20], [S - 20, S - 20]]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return tex(c);
  });
}

export function darkPanel() {
  return memo('darkPanel', () => {
    const S = 256;
    const n = fbm(S, 131, 4, 8);
    const c = paint(S, (x, y) => {
      const gx = x % 128;
      const gy = y % 128;
      const edge = Math.min(gx, gy, 127 - gx, 127 - gy);
      let v = 70 + (n(x, y) - 0.5) * 24;
      if (edge < 3) v = 40;
      else if (edge < 6) v += 30;
      return [v * 0.9, v * 0.92, v * 1.15];
    });
    return tex(c);
  });
}

export function crackGlow() {
  return memo('crackGlow', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    const r = mulberry(211);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 10; i++) {
      let x = r() * S;
      let y = r() * S;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.5) * 70;
        pts.push([x, y]);
      }
      for (const [w, a] of [[9, 0.25], [4, 0.6], [1.8, 1]]) {
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
    }
    return tex(c);
  });
}

export function checker() {
  return memo('checker', () => {
    const S = 128;
    const c = paint(S, (x, y) => ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? [30, 30, 36] : [250, 250, 250]));
    return tex(c);
  });
}

export function coinFace() {
  return memo('coinFace', () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(50, 44, 6, 64, 64, 64);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(0.6, '#ffc21a');
    g.addColorStop(1, '#e08a00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#b86a00';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    const star = (r1, r2) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? r2 : r1;
        ctx.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
      }
      ctx.closePath();
    };
    star(38, 16);
    ctx.fillStyle = '#c47200';
    ctx.fill();
    ctx.save();
    ctx.translate(-2, -3);
    star(36, 15);
    ctx.fillStyle = '#fff1a8';
    ctx.fill();
    ctx.restore();
    const t = tex(c, { repeat: false });
    return t;
  });
}

export function sprite(kind) {
  return memo('sprite' + kind, () => {
    const S = 64;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    if (kind === 'glow') {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    } else if (kind === 'star') {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 20);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 ? 7 : 31;
        ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'note') {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(25, 44, 9, 6.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(31, 14, 4, 31);
      ctx.beginPath();
      ctx.moveTo(35, 14);
      ctx.quadraticCurveTo(48, 20, 44, 32);
      ctx.quadraticCurveTo(44, 24, 35, 24);
      ctx.fill();
    } else if (kind === 'drop') {
      const g = ctx.createRadialGradient(32, 38, 0, 32, 38, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(32, 12);
      ctx.bezierCurveTo(40, 26, 46, 32, 46, 40);
      ctx.arc(32, 40, 14, 0, Math.PI);
      ctx.bezierCurveTo(18, 32, 24, 26, 32, 12);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    return tex(c, { repeat: false });
  });
}

export function blob() {
  return memo('blob', () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return tex(c, { repeat: false, srgb: false });
  });
}

export function ring() {
  return memo('ring', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    for (const [r, w, a] of [[118, 10, 1], [96, 5, 0.7], [70, 4, 0.5]]) {
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return tex(c, { repeat: false });
  });
}

export function padArrows() {
  return memo('padArrows', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(128, 128, 112, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const oy of [-34, 22]) {
      ctx.beginPath();
      ctx.moveTo(128, 88 + oy);
      ctx.lineTo(178, 138 + oy);
      ctx.lineTo(152, 138 + oy);
      ctx.lineTo(128, 114 + oy);
      ctx.lineTo(104, 138 + oy);
      ctx.lineTo(78, 138 + oy);
      ctx.closePath();
      ctx.fill();
    }
    return tex(c, { repeat: false });
  });
}

export function trampTop() {
  return memo('trampTop', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff4d8a';
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.arc(128, 128, 140, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd22e';
    ctx.beginPath();
    ctx.arc(128, 128, 30, 0, Math.PI * 2);
    ctx.fill();
    return tex(c, { repeat: false });
  });
}

export function flag(num, active, on = ['#8dff7a', '#1faf45']) {
  const S = 256;
  const c = canvas(S, 160);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  if (active) {
    g.addColorStop(0, on[0]);
    g.addColorStop(1, on[1]);
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c9d3e6');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, 160);
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, S - 10, 150);
  ctx.font = '900 104px "Segoe UI Black", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 16;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1f2a44';
  ctx.strokeText(String(num), S / 2, 86);
  ctx.fillStyle = active ? '#ffffff' : '#ffc21a';
  ctx.fillText(String(num), S / 2, 86);
  return tex(c, { repeat: false });
}

export function banner(text, bg1, bg2) {
  const c = canvas(1024, 192);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = (i + j) % 2 ? bg1 : bg2;
      ctx.fillRect(i * 32, j * 32, 32, 32);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.0)';
  ctx.font = '900 132px "Segoe UI Black", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#1f2a44';
  ctx.strokeText(text, 512, 104);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 512, 104);
  return tex(c, { repeat: false });
}

export function planet(seed, colors) {
  return memo('planet' + seed, () => {
    const W = 512;
    const H = 256;
    const n = fbm(W, seed, 4, 4);
    const pal = colors.map(hex);
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const w = n(x, y * 2);
        const t = (y / H) * 6 + w * 2.5;
        const k = Math.floor(t) % pal.length;
        const f = t - Math.floor(t);
        const col = mix3(pal[k], pal[(k + 1) % pal.length], f * f);
        const i = (y * W + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return tex(c);
  });
}

export function disposeTexture(t) {
  for (const [k, v] of cache) {
    if (v === t) cache.delete(k);
  }
  t.dispose();
}
