import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export function asphaltTexture(theme) {
  const [c, g] = canvas(512, 1024);
  const r = rng(11);
  const base = { beach: '#44474e', neon: '#202128', candy: '#5f4d6b' }[theme];
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 26000; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.12 + r() * 0.18})` : `rgba(255,255,255,${0.05 + r() * 0.1})`;
    const s = 1 + r() * 2.2;
    g.fillRect(r() * 512, r() * 1024, s, s);
  }
  for (const u of [0.3, 0.7]) {
    const grd = g.createLinearGradient((u - 0.09) * 512, 0, (u + 0.09) * 512, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect((u - 0.09) * 512, 0, 0.18 * 512, 1024);
  }
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(10,10,12,${0.25 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 1.5;
    g.beginPath();
    let x = r() * 512, y = r() * 1024;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 40; g.lineTo(x, y); }
    g.stroke();
  }
  const lineCol = theme === 'candy' ? '#f4e6f0' : '#dcdcd6';
  g.fillStyle = lineCol;
  g.fillRect(0.035 * 512, 0, 0.022 * 512, 1024);
  g.fillRect((1 - 0.057) * 512, 0, 0.022 * 512, 1024);
  g.fillStyle = theme === 'beach' ? '#d8d5ca' : theme === 'neon' ? '#d8d2b8' : '#eeeeee';
  for (const u of [1 / 3, 2 / 3]) {
    g.globalAlpha = 0.85;
    g.fillRect(u * 512 - 5, 0, 10, 512);
  }
  g.globalAlpha = 1;
  return tex(c, { repeat: true });
}

export function wetRoughnessTexture() {
  const [c, g] = canvas(256, 512);
  const r = rng(77);
  g.fillStyle = 'rgb(150,150,150)';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 512, rad = 15 + r() * 45;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(20,20,20,0.95)');
    grd.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, rad * 0.7, rad * 1.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat: true, srgb: false });
}

export function checkerTexture(cols, rows, a = '#111', b = '#fff') {
  const s = 32;
  const [c, g] = canvas(cols * s, rows * s);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * s, y * s, s, s);
  }
  const t = tex(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function curbTexture(a, b) {
  const [c, g] = canvas(64, 128);
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  g.fillRect(0, 64, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, 64, 6);
  g.fillRect(0, 64, 64, 6);
  return tex(c, { repeat: true });
}

export function chevronTexture() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) {
    const y = i * 128;
    g.beginPath();
    g.moveTo(40, y + 110);
    g.lineTo(128, y + 30);
    g.lineTo(216, y + 110);
    g.lineTo(216, y + 70);
    g.lineTo(128, y - 10);
    g.lineTo(40, y + 70);
    g.closePath();
    const grd = g.createLinearGradient(0, y + 110, 0, y);
    grd.addColorStop(0, '#ff6a00');
    grd.addColorStop(1, '#ffe24a');
    g.fillStyle = grd;
    g.shadowColor = '#ffae00';
    g.shadowBlur = 14;
    g.fill();
  }
  const t = tex(c, { repeat: true });
  return t;
}

export function questionTexture() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.font = '900 190px "Arial Black", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.strokeStyle = 'rgba(40,0,80,0.85)';
  g.strokeText('?', 128, 140);
  g.fillStyle = '#ffffff';
  g.fillText('?', 128, 140);
  return tex(c);
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

export function blobShadowTexture() {
  const [c, g] = canvas(128, 256);
  const grd = g.createRadialGradient(64, 128, 10, 64, 128, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.7)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.scale(1, 2);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.restore();
  return tex(c);
}

export function windowTexture(seed, palette) {
  const [c, g] = canvas(256, 512);
  const r = rng(seed);
  g.fillStyle = '#0d0e16';
  g.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 16;
  const cw = 256 / cols, rh = 512 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const lit = r() < 0.42;
    let col = '#171a26';
    if (lit) col = palette[Math.floor(r() * palette.length)];
    g.fillStyle = col;
    g.fillRect(x * cw + 5, y * rh + 6, cw - 10, rh - 12);
    if (lit) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x * cw + 5, y * rh + 6, cw - 10, 4);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < cols; x++) g.fillRect(x * cw, 0, 2, 512);
  return tex(c, { repeat: true });
}

export function noiseTexture(seed = 3, size = 256, contrast = 60) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 190 + (r() - 0.5) * contrast;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + r() * 0.06})`;
    g.beginPath();
    g.arc(r() * size, r() * size, 3 + r() * 14, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, { repeat: true });
}

export function bannerTexture(text, bg, fg, stroke = '#000') {
  const [c, g] = canvas(1024, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 128);
  const s = 16;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
    g.fillRect(x * s, y * s, s, s);
    g.fillRect(1024 - 128 + x * s, y * s, s, s);
  }
  g.font = 'italic 900 84px "Arial Black", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = stroke;
  g.strokeText(text, 512, 68);
  g.fillStyle = fg;
  g.fillText(text, 512, 68);
  return tex(c);
}

export function arrowSignTexture(bg, fg) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 70;
    g.beginPath();
    g.moveTo(x, 20);
    g.lineTo(x + 50, 64);
    g.lineTo(x, 108);
    g.lineTo(x + 22, 108);
    g.lineTo(x + 72, 64);
    g.lineTo(x + 22, 20);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 120);
  return tex(c);
}

export function swirlTexture(a, b) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = a;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = b;
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.beginPath();
  for (let t = 0; t < 26; t += 0.05) {
    const rr = t * 4.6;
    g.lineTo(128 + Math.cos(t) * rr, 128 + Math.sin(t) * rr);
  }
  g.stroke();
  return tex(c);
}

export function screenTexture(text, sub, c1, c2) {
  const [c, g] = canvas(512, 256);
  const grd = g.createLinearGradient(0, 0, 512, 256);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  g.font = 'italic 900 78px "Arial Black", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.strokeText(text, 256, 110);
  g.fillStyle = '#fff';
  g.fillText(text, 256, 110);
  g.font = '900 36px "Arial Black", "Segoe UI", sans-serif';
  g.fillText(sub, 256, 190);
  return tex(c);
}

export function podiumNumberTexture(n, col) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = col;
  g.fillRect(0, 0, 256, 256);
  g.font = '900 170px "Arial Black", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.strokeText(String(n), 128, 140);
  g.fillStyle = '#fff';
  g.fillText(String(n), 128, 140);
  return tex(c);
}

export function numberTexture(text) {
  const [c, g] = canvas(128, 96);
  g.font = 'italic 900 84px "Arial Black", "Segoe UI Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#ffd21f';
  g.strokeText(text, 64, 52);
  g.fillStyle = '#111';
  g.fillText(text, 64, 52);
  return tex(c);
}

export function studioFloorTexture() {
  const [c, g] = canvas(512, 512);
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#3a3f55');
  grd.addColorStop(0.6, '#1c1f2e');
  grd.addColorStop(1, '#0c0d16');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(120,160,255,0.12)';
  g.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(512, i * 32); g.stroke();
  }
  return tex(c);
}

export function sparkTexture() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false });
}

export function smokeTexture() {
  const [c, g] = canvas(128, 128);
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 20 + r() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  return tex(c, { srgb: false });
}

export function cloudTexture(seed) {
  const [c, g] = canvas(256, 128);
  const r = rng(seed);
  for (let i = 0; i < 22; i++) {
    const x = 40 + r() * 176, y = 58 + (r() - 0.3) * 40, rad = 18 + r() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.6, 'rgba(250,250,255,0.6)');
    grd.addColorStop(1, 'rgba(240,244,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  }
  return tex(c);
}
