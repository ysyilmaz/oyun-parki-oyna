import * as THREE from 'three';

let eggGeo = null;

export function getEggGeometry() {
  if (eggGeo) return eggGeo;
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI;
    const y = -Math.cos(a);
    let r = Math.sin(a);
    r *= y > 0 ? 1 - y * 0.18 : 1;
    pts.push(new THREE.Vector2(Math.max(r * 0.78, 0.0001), y * 1.0 + 1));
  }
  eggGeo = new THREE.LatheGeometry(pts, 40);
  return eggGeo;
}

export function drawEggPattern(ctx, w, h, colors, seed = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, colors[1]);
  g.addColorStop(0.55, colors[0]);
  g.addColorStop(1, shade(colors[0], -0.25));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors[1];
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  const zy = h * 0.52;
  ctx.moveTo(0, zy);
  const teeth = 8;
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * w;
    ctx.lineTo(x, zy + (i % 2 ? 18 : -18));
  }
  ctx.lineTo(w, zy + 30);
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * w;
    ctx.lineTo(x, zy + 30 + (i % 2 ? 18 : -18));
  }
  ctx.closePath();
  ctx.fill();
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 22; i++) {
    const x = rnd() * w;
    const y = rnd() * h * 0.45 + 10;
    const r = 8 + rnd() * 16;
    ctx.fillStyle = i % 2 ? colors[1] : shade(colors[0], 0.25);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + (x > w / 2 ? -w : w), y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

export function makeEggMaterial(colors, seed, golden) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  drawEggPattern(ctx, 256, 256, colors, seed);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: golden ? 0.2 : 0.35,
    metalness: golden ? 0.85 : 0.05,
  });
  mat.userData.canvas = cv;
  return mat;
}

export function drawCracks(ctx, w, h, level, seed = 3) {
  let s = seed * 7919;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const span = level >= 3 ? 1 : level / 3;
  const x0 = (0.85 - span / 2) * w;
  const x1 = x0 + span * w;
  const y0 = h * 0.42;
  const pts = [[x0, y0]];
  let side = 1;
  for (let x = x0 + 4 + rnd() * 6; x < x1 - 2; x += 5 + rnd() * 9) {
    if (rnd() < 0.8) side = -side;
    pts.push([x, y0 + Math.sin((x / w) * Math.PI * 3) * 3 + side * (2 + rnd() * 6)]);
  }
  pts.push(level >= 3 ? [x0 + w, y0] : [x1, y0 + (rnd() - 0.5) * 6]);
  const branches = [];
  for (let k = 0; k < level - 1; k++) {
    const [bx, by] = pts[Math.floor(pts.length * (0.38 + k * 0.22))];
    const dir = k % 2 ? 1 : -1;
    const lean = rnd() < 0.5 ? -1 : 1;
    branches.push([[bx, by], [bx + lean * (3 + rnd() * 3), by + dir * (6 + rnd() * 4)], [bx + lean * (6 + rnd() * 4), by + dir * (13 + rnd() * 5)]]);
  }
  const stroke = (line) => {
    for (const shift of [-w, 0, w]) {
      ctx.beginPath();
      line.forEach(([x, y], i) => (i ? ctx.lineTo(x + shift, y) : ctx.moveTo(x + shift, y)));
      ctx.stroke();
    }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.translate(0, 2.5);
  stroke(pts);
  branches.forEach(stroke);
  ctx.translate(0, -2.5);
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 4;
  stroke(pts);
  ctx.lineWidth = 3;
  branches.forEach(stroke);
  ctx.restore();
}
