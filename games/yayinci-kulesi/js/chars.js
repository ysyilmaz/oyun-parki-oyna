import * as THREE from 'three';
import { M, part, merge, rbox as rbox0, vcMat, vcGloss, vcGlow, outlineMat, outlineMatThin, rainbowFn, shadeY } from './geo.js';

const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, r < 0.05 ? 7 : r < 0.1 ? 10 : r < 0.2 ? Math.min(w, 12) : Math.min(w, 16), r < 0.05 ? 5 : r < 0.1 ? 7 : r < 0.2 ? Math.min(h, 8) : Math.min(h, 11));
const CAP = (r, l, s = 2, rs = 8) => new THREE.CapsuleGeometry(r, l, Math.min(s, 2), Math.min(rs, 8));
const CYL = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, Math.min(s, Math.max(a, b) < 0.06 ? 6 : 14));
const CONE = (r, h, s = 16) => new THREE.ConeGeometry(r, h, s);
const TOR = (r, t, rs = 5, ts = 16, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, Math.min(rs, 5), Math.min(ts, 18), arc);

const rbox = (w, h, d, r, seg) => rbox0(w, h, d, r, 1);
const HEAD_R = 0.46;
const HEAD_Y = 0.44;
const HEAD_SX = 1.06;
const HEAD_SY = 0.96;

const colorCache = new Map();
function col(c, fallbackRainbow) {
  if (c === 'rainbow') return fallbackRainbow || '#ff4fa8';
  return c;
}

function tint(hex, k) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
  return '#' + c.getHexString();
}

function colored(geo, c, m) {
  if (c === 'rainbow') return part(geo, null, m, rainbowFn(1.2));
  return part(geo, c, m);
}

function hairParts(style, hc) {
  const p = [];
  const capGeo = new THREE.SphereGeometry(HEAD_R + 0.035, 18, 8, 0, Math.PI * 2, 0, 1.45);
  const capM = M(0, HEAD_Y + 0.02, -0.03, -0.32, 0, 0, HEAD_SX, HEAD_SY, 1.02);
  const shade = hc === 'rainbow' ? null : hc;
  const add = (g, m) => p.push(colored(g, shade || 'rainbow', m));
  if (style !== 'afro' && style !== 'bald') add(capGeo, capM);
  if (style === 'spiky') {
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + i * 0.4;
      add(CONE(0.12, 0.34, 10), M(Math.sin(a) * 0.3, HEAD_Y + 0.42 - Math.abs(a) * 0.06, Math.cos(a) * 0.05 - 0.12, -0.5 + Math.abs(a) * 0.1, 0, -a * 0.7));
    }
    add(CONE(0.1, 0.26, 10), M(-0.12, HEAD_Y + 0.33, 0.33, 1.0, 0, 0.3));
    add(CONE(0.1, 0.26, 10), M(0.1, HEAD_Y + 0.35, 0.32, 1.1, 0, -0.25));
  } else if (style === 'mop') {
    for (let i = 0; i < 5; i++) add(S(0.14, 14, 10), M(-0.28 + i * 0.14, HEAD_Y + 0.26 - Math.abs(i - 2) * 0.03, 0.33, 0, 0, 0, 1, 0.8, 0.7));
    add(S(0.2, 14, 10), M(0.36, HEAD_Y + 0.1, 0.05, 0, 0, 0, 0.6, 1.2, 1));
    add(S(0.2, 14, 10), M(-0.36, HEAD_Y + 0.1, 0.05, 0, 0, 0, 0.6, 1.2, 1));
  } else if (style === 'bob') {
    add(S(0.3, 16, 12), M(-0.34, HEAD_Y - 0.05, -0.02, 0, 0, 0, 0.55, 1.15, 1.1));
    add(S(0.3, 16, 12), M(0.34, HEAD_Y - 0.05, -0.02, 0, 0, 0, 0.55, 1.15, 1.1));
    add(S(0.42, 20, 14), M(0, HEAD_Y - 0.02, -0.12, 0, 0, 0, 1.08, 1.05, 0.9));
    add(CAP(0.07, 0.5, 4, 10), M(0, HEAD_Y + 0.3, 0.33, 0, 0, Math.PI / 2 - 0.25, 1, 1, 0.8));
  } else if (style === 'short') {
    add(S(0.12, 12, 8), M(0.1, HEAD_Y + 0.33, 0.3, 0.6, 0, -0.4, 1.3, 0.7, 0.8));
    add(S(0.1, 12, 8), M(-0.1, HEAD_Y + 0.35, 0.28, 0.6, 0, 0.3, 1.2, 0.7, 0.8));
  } else if (style === 'long') {
    add(S(0.44, 20, 14), M(0, HEAD_Y - 0.1, -0.14, 0, 0, 0, 1.08, 1.2, 0.85));
    add(CAP(0.2, 0.5, 6, 12), M(0, HEAD_Y - 0.45, -0.24, 0.12, 0, 0, 1.6, 1, 0.7));
    add(S(0.2, 14, 10), M(-0.36, HEAD_Y - 0.2, 0.06, 0, 0, 0, 0.5, 1.3, 0.9));
    add(S(0.2, 14, 10), M(0.36, HEAD_Y - 0.2, 0.06, 0, 0, 0, 0.5, 1.3, 0.9));
    add(S(0.16, 12, 10), M(-0.14, HEAD_Y + 0.3, 0.3, 0, 0, 0.5, 1.4, 0.6, 0.7));
  } else if (style === 'pony') {
    add(S(0.15, 14, 10), M(0, HEAD_Y + 0.28, -0.4));
    add(CAP(0.13, 0.35, 6, 12), M(0, HEAD_Y + 0.02, -0.55, 0.5, 0, 0));
    add(S(0.11, 12, 8), M(0, HEAD_Y - 0.22, -0.62));
    add(S(0.14, 12, 8), M(0.12, HEAD_Y + 0.32, 0.29, 0.5, 0, -0.5, 1.3, 0.7, 0.8));
  } else if (style === 'curly') {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = i % 2 ? 0.26 : 0.16;
      add(S(0.12, 10, 8), M(Math.cos(a) * rr, HEAD_Y + 0.4 + (i % 3) * 0.03, Math.sin(a) * rr - 0.05));
    }
    for (let i = 0; i < 5; i++) add(S(0.1, 10, 8), M(-0.24 + i * 0.12, HEAD_Y + 0.27, 0.31));
  } else if (style === 'afro') {
    add(S(0.64, 22, 16), M(0, HEAD_Y + 0.22, -0.12, 0, 0, 0, 1.0, 0.86, 0.9));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      add(S(0.2, 10, 8), M(Math.cos(a) * 0.52, HEAD_Y + 0.26 + Math.sin(a * 2) * 0.1, Math.sin(a) * 0.45 - 0.12));
    }
  }
  return p;
}

function headAcc(kind, lk, glow, special) {
  const p = [];
  const hc = col(lk.headC || lk.acc, '#ff4fa8');
  const acc = col(lk.acc, '#ffd23a');
  const top = HEAD_Y + HEAD_R * HEAD_SY;
  if (kind === 'headset' || kind === 'bigphones') {
    const big = kind === 'bigphones';
    p.push(part(TOR(0.5, big ? 0.05 : 0.04, 8, 32, Math.PI), '#20212e', M(0, HEAD_Y + 0.02, 0, 0, 0, 0, 1.02, 1.02, 1)));
    for (const s of [-1, 1]) {
      p.push(part(CYL(big ? 0.2 : 0.16, big ? 0.2 : 0.16, 0.14, 20), '#20212e', M(s * 0.5, HEAD_Y, 0, 0, 0, Math.PI / 2)));
      p.push(colored(CYL(big ? 0.15 : 0.12, big ? 0.15 : 0.12, 0.02, 20), lk.acc, M(s * 0.58, HEAD_Y, 0, 0, 0, Math.PI / 2)));
      if (big) glow.push(colored(TOR(0.17, 0.018, 6, 24), lk.acc, M(s * 0.58, HEAD_Y, 0, 0, Math.PI / 2, 0)));
    }
    if (!big) {
      p.push(part(CAP(0.02, 0.36, 3, 6), '#20212e', M(-0.46, HEAD_Y - 0.22, 0.2, 0.9, 0, 0.15)));
      glow.push(colored(S(0.05, 10, 8), lk.acc, M(-0.4, HEAD_Y - 0.33, 0.38)));
    }
  } else if (kind === 'robohead') {
    p.push(part(rbox(0.72, 0.44, 0.12, 0.08), '#1a1d2a', M(0, HEAD_Y - 0.03, 0.43, 0, 0, 0)));
    for (const s of [-1, 1]) {
      glow.push(colored(rbox(0.16, 0.1, 0.03, 0.04), lk.acc, M(s * 0.15, HEAD_Y + 0.01, 0.5)));
      p.push(part(CYL(0.13, 0.13, 0.12, 16), '#8a93a8', M(s * 0.5, HEAD_Y, 0, 0, 0, Math.PI / 2)));
      p.push(part(CYL(0.06, 0.06, 0.04, 12), '#3a3f52', M(s * 0.57, HEAD_Y, 0, 0, 0, Math.PI / 2)));
    }
    glow.push(colored(rbox(0.2, 0.035, 0.02, 0.012), lk.acc, M(0, HEAD_Y - 0.14, 0.495)));
    p.push(part(CYL(0.02, 0.02, 0.32, 6), '#8a93a8', M(0, top + 0.14, 0)));
    glow.push(part(S(0.08, 12, 8), hc, M(0, top + 0.32, 0)));
    for (let i = 0; i < 3; i++) p.push(part(S(0.035, 8, 6), '#c98a00', M(-0.2 + i * 0.2, top - 0.06, 0.2 - Math.abs(i - 1) * 0.04)));
  } else if (kind === 'herocap') {
    p.push(colored(new THREE.SphereGeometry(HEAD_R + 0.05, 20, 9, 0, Math.PI * 2, 0, 1.3), hc, M(0, HEAD_Y + 0.03, 0, 0.08, 0, 0, HEAD_SX, HEAD_SY * 0.95, 1.02)));
    p.push(colored(CYL(0.3, 0.3, 0.045, 24), hc, M(0, HEAD_Y + 0.2, 0.5, -0.22, 0, 0, 1.05, 1, 0.95)));
    p.push(part(CYL(0.302, 0.302, 0.02, 24), '#ffffff', M(0, HEAD_Y + 0.225, 0.5, -0.22, 0, 0, 1.05, 1, 0.95)));
    p.push(part(S(0.05, 8, 6), '#ffffff', M(0, top + 0.05, 0)));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.055 : 0.13;
      star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.push(part(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), '#ffffff', M(0, HEAD_Y + 0.33, 0.4, -0.5, 0, 0)));
    p.push(part(TOR(0.56, 0.045, 8, 32, Math.PI), '#20212e', M(0, HEAD_Y + 0.02, 0, 0, 0, 0, 1.02, 1.04, 1)));
    for (const s of [-1, 1]) {
      p.push(part(CYL(0.17, 0.17, 0.14, 20), '#20212e', M(s * 0.54, HEAD_Y, 0, 0, 0, Math.PI / 2)));
      p.push(colored(CYL(0.13, 0.13, 0.02, 20), lk.acc, M(s * 0.62, HEAD_Y, 0, 0, 0, Math.PI / 2)));
    }
    p.push(part(CAP(0.022, 0.36, 3, 6), '#20212e', M(0.5, HEAD_Y - 0.22, 0.2, 0.9, 0, -0.15)));
    glow.push(colored(S(0.055, 10, 8), lk.acc, M(0.43, HEAD_Y - 0.33, 0.38)));
  } else if (kind === 'catears') {
    for (const s of [-1, 1]) {
      p.push(colored(CONE(0.16, 0.3, 4), lk.hairC, M(s * 0.28, top - 0.02, 0, 0, Math.PI / 4, s * -0.35)));
      p.push(part(CONE(0.09, 0.18, 4), '#ffb3c8', M(s * 0.27, top - 0.03, 0.06, 0, Math.PI / 4, s * -0.35)));
    }
  } else if (kind === 'chefhat') {
    p.push(part(CYL(0.36, 0.34, 0.24, 24), '#ffffff', M(0, top + 0.02, -0.02)));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.push(part(S(0.2, 14, 10), '#ffffff', M(Math.cos(a) * 0.2, top + 0.24, Math.sin(a) * 0.2 - 0.02)));
    }
    p.push(part(S(0.24, 16, 12), '#ffffff', M(0, top + 0.3, -0.02)));
    p.push(part(CYL(0.37, 0.37, 0.05, 24), '#e8e8f0', M(0, top - 0.08, -0.02)));
  } else if (kind === 'capback') {
    p.push(colored(new THREE.SphereGeometry(HEAD_R + 0.05, 18, 8, 0, Math.PI * 2, 0, 1.25), hc, M(0, HEAD_Y + 0.03, 0, -0.1, 0, 0, HEAD_SX, HEAD_SY * 0.95, 1.02)));
    p.push(colored(CYL(0.26, 0.28, 0.04, 20, 1), hc, M(0, HEAD_Y + 0.22, -0.46, 0.35, 0, 0, 1.1, 1, 0.9)));
    p.push(part(S(0.05, 8, 6), '#ffffff', M(0, top + 0.03, 0)));
  } else if (kind === 'beret') {
    p.push(colored(S(0.42, 22, 12), hc, M(0.08, top - 0.02, -0.02, 0, 0, -0.25, 1.15, 0.32, 1.1)));
    p.push(colored(CYL(0.03, 0.04, 0.1), hc, M(0.1, top + 0.12, 0)));
  } else if (kind === 'band' || kind === 'sweatband' || kind === 'ninjaband') {
    p.push(colored(TOR(HEAD_R * 1.04, 0.05, 8, 36), hc, M(0, HEAD_Y + 0.2, 0, Math.PI / 2 + 0.25, 0, 0, HEAD_SX, 1, 1)));
    if (kind === 'ninjaband') {
      p.push(colored(rbox(0.08, 0.3, 0.03, 0.01), hc, M(0.05, HEAD_Y + 0.02, -0.52, 0.3, 0, 0.35)));
      p.push(colored(rbox(0.08, 0.26, 0.03, 0.01), hc, M(-0.06, HEAD_Y + 0.04, -0.52, 0.2, 0, -0.3)));
      p.push(part(rbox(0.16, 0.1, 0.03, 0.01), '#cfd6e6', M(0, HEAD_Y + 0.28, 0.43, -0.25, 0, 0)));
    }
  } else if (kind === 'shades') {
    for (const s of [-1, 1]) p.push(part(rbox(0.24, 0.14, 0.05, 0.05), '#111118', M(s * 0.15, HEAD_Y + 0.02, 0.44, 0, s * 0.18, 0)));
    p.push(part(rbox(0.12, 0.03, 0.03, 0.01), '#111118', M(0, HEAD_Y + 0.05, 0.46)));
    for (const s of [-1, 1]) p.push(part(rbox(0.05, 0.03, 0.01, 0.005), '#ffffff', M(s * 0.15 - 0.06, HEAD_Y + 0.06, 0.475)));
  } else if (kind === 'goggles') {
    p.push(part(TOR(HEAD_R * 1.04, 0.04, 8, 36), '#2a2a36', M(0, HEAD_Y + 0.26, 0, Math.PI / 2 + 0.4, 0, 0, HEAD_SX, 1, 1)));
    for (const s of [-1, 1]) {
      p.push(part(CYL(0.12, 0.12, 0.1, 18), '#3a3a48', M(s * 0.15, HEAD_Y + 0.33, 0.33, Math.PI / 2 - 0.4, 0, 0)));
      glow.push(colored(CYL(0.09, 0.09, 0.02, 18), lk.acc, M(s * 0.15, HEAD_Y + 0.355, 0.375, Math.PI / 2 - 0.4, 0, 0)));
    }
  } else if (kind === 'helmet') {
    p.push(part(TOR(0.42, 0.08, 10, 30), '#dfe5f5', M(0, HEAD_Y - 0.36, 0, Math.PI / 2, 0, 0)));
    p.push(colored(rbox(0.2, 0.08, 0.06, 0.02), lk.acc, M(0.28, HEAD_Y - 0.36, 0.3, 0, 0.6, 0)));
    glow.push(part(S(0.035, 8, 6), '#ff5a5a', M(0, HEAD_Y + 0.66, 0)));
    p.push(part(CYL(0.012, 0.012, 0.16, 6), '#9aa6c7', M(0, HEAD_Y + 0.57, 0)));
    special.push('glassHelmet');
  } else if (kind === 'wizard') {
    p.push(colored(CYL(0.62, 0.62, 0.05, 28), hc, M(0, top - 0.08, -0.02)));
    const cone = CONE(0.4, 0.95, 24);
    p.push(colored(cone, hc, M(0.05, top + 0.38, -0.08, -0.2, 0, -0.15)));
    p.push(colored(TOR(0.39, 0.04, 8, 28), lk.acc, M(0, top - 0.02, -0.02, Math.PI / 2, 0, 0)));
    glow.push(part(new THREE.OctahedronGeometry(0.08), '#ffe066', M(0.02, top + 0.35, 0.24, 0, 0.5, 0)));
    glow.push(part(new THREE.OctahedronGeometry(0.05), '#ffe066', M(0.25, top + 0.15, 0.18)));
  } else if (kind === 'mask') {
    p.push(colored(TOR(HEAD_R * 1.03, 0.06, 8, 36), hc, M(0, HEAD_Y + 0.03, 0, Math.PI / 2, 0, 0, HEAD_SX, 1, 1)));
    for (const s of [-1, 1]) p.push(colored(rbox(0.26, 0.18, 0.06, 0.06), hc, M(s * 0.16, HEAD_Y + 0.02, 0.4, 0, s * 0.3, 0)));
  } else if (kind === 'tricorn') {
    p.push(colored(CYL(0.4, 0.44, 0.24, 24), hc, M(0, top + 0.04, -0.02)));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      p.push(colored(rbox(0.6, 0.22, 0.06, 0.03), hc, M(Math.cos(a) * 0.36, top + 0.02, Math.sin(a) * 0.36, 0.5, -a + Math.PI / 2, 0)));
      p.push(part(rbox(0.6, 0.03, 0.07, 0.01), '#ffd23a', M(Math.cos(a) * 0.37, top + 0.12, Math.sin(a) * 0.37, 0.5, -a + Math.PI / 2, 0)));
    }
    p.push(part(S(0.08, 10, 8), '#ffffff', M(0, top + 0.08, 0.44, 0, 0, 0, 1, 0.8, 0.4)));
  } else if (kind === 'dragonhood') {
    p.push(colored(new THREE.SphereGeometry(HEAD_R + 0.08, 18, 10, 0, Math.PI * 2, 0, 1.75), hc, M(0, HEAD_Y + 0.02, -0.08, -0.55, 0, 0, HEAD_SX, HEAD_SY, 1.05)));
    for (const s of [-1, 1]) p.push(part(CONE(0.08, 0.36, 10), '#ffd23a', M(s * 0.26, top + 0.08, -0.1, -0.4, 0, s * -0.4)));
    for (let i = 0; i < 4; i++) p.push(colored(CONE(0.07, 0.18, 4), lk.acc, M(0, top - i * 0.18, -0.34 - i * 0.1, -0.8 - i * 0.3, 0, 0)));
    for (const s of [-1, 1]) p.push(part(S(0.05, 8, 6), '#ffffff', M(s * 0.14, top + 0.02, 0.4)));
  } else if (kind === 'antenna') {
    for (const s of [-1, 1]) {
      p.push(part(CYL(0.018, 0.018, 0.4, 6), '#c9d3ff', M(s * 0.18, top + 0.12, 0, 0, 0, s * -0.35)));
      glow.push(colored(S(0.08, 12, 8), lk.headC || lk.acc, M(s * 0.26, top + 0.32, 0)));
    }
  } else if (kind === 'visor') {
    p.push(part(TOR(HEAD_R * 1.04, 0.05, 8, 36), '#1b1b2a', M(0, HEAD_Y + 0.3, 0, Math.PI / 2 + 0.3, 0, 0, HEAD_SX, 1, 1)));
    glow.push(colored(rbox(0.62, 0.1, 0.06, 0.04), lk.headC, M(0, HEAD_Y + 0.33, 0.36, -0.45, 0, 0)));
  } else if (kind === 'crown') {
    p.push(part(CYL(0.3, 0.28, 0.14, 24, 1, true), '#ffcc2e', M(0, top + 0.04, 0)));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.push(part(CONE(0.07, 0.18, 6), '#ffcc2e', M(Math.cos(a) * 0.28, top + 0.18, Math.sin(a) * 0.28)));
    }
    glow.push(part(new THREE.OctahedronGeometry(0.06), '#ff3b6b', M(0, top + 0.05, 0.3)));
  }
  return p;
}

function faceParts(lk, eyesOut) {
  const p = [];
  const skin = lk.skin;
  const cheek = '#ff8fa3';
  const hy = HEAD_Y - 0.02;
  for (const s of [-1, 1]) {
    const ex = s * 0.165;
    const ez = 0.42;
    const ry = s * 0.36;
    eyesOut.push(part(S(0.088, 18, 14), '#1d1530', M(ex, hy, ez, 0, ry, 0, 0.82, 1.15, 0.45)));
    eyesOut.push(part(S(0.058, 14, 10), lk.eye || '#5b3a24', M(ex * 1.02, hy - 0.025, ez + 0.022, 0, ry, 0, 0.8, 0.95, 0.4)));
    eyesOut.push(part(S(0.028, 10, 8), '#ffffff', M(ex - 0.028, hy + 0.045, ez + 0.042)));
    eyesOut.push(part(S(0.014, 8, 6), '#ffffff', M(ex + 0.025, hy - 0.04, ez + 0.042)));
    p.push(part(CAP(0.018, 0.1, 3, 6), tint(col(lk.hairC || '#3a2a20', '#3a2a20'), 0.7), M(ex, hy + 0.15, ez - 0.03, 0, ry, Math.PI / 2 + s * 0.15)));
    p.push(part(S(0.06, 10, 8), cheek, M(s * 0.27, hy - 0.11, 0.35, 0, s * 0.62, 0, 1.1, 0.6, 0.3)));
    p.push(part(S(0.075, 10, 8), skin, M(s * 0.46, hy - 0.02, 0.0, 0, 0, 0, 0.5, 0.9, 0.7)));
  }
  p.push(part(TOR(0.055, 0.017, 6, 14, Math.PI), '#7a1f2e', M(0, hy - 0.14, 0.43, 0, 0, Math.PI, 1, 0.9, 1)));
  p.push(part(S(0.022, 8, 6), tint(skin, 0.9), M(0, hy - 0.06, 0.465)));
  return p;
}

function torsoParts(lk, glow) {
  const p = [];
  const tc = col(lk.topC, '#ffffff');
  const acc = lk.acc;
  const pants = lk.pants;
  const torso = CYL(0.27, 0.31, 0.46, 24);
  const T = (g, m) => p.push(lk.topC === 'rainbow' ? part(g, null, m, rainbowFn(1.4)) : part(g, tc, m, shadeY(0.45, 0.95, tc, 0.8)));
  T(torso, M(0, 0.69, 0));
  T(S(0.27, 22, 12), M(0, 0.91, 0, 0, 0, 0, 1, 0.42, 1));
  p.push(part(S(0.315, 22, 12), pants, M(0, 0.47, 0, 0, 0, 0, 1, 0.42, 0.95)));
  p.push(part(CYL(0.105, 0.11, 0.1, 12), lk.skin, M(0, 0.98, 0)));
  const t = lk.top;
  if (t === 'hoodie') {
    p.push(colored(TOR(0.2, 0.08, 8, 20, Math.PI * 1.3), tc === '#ffffff' ? '#e9ecf5' : tint(tc, 0.85), M(0, 0.95, -0.1, Math.PI / 2 + 0.3, 0, Math.PI * 1.35)));
    p.push(colored(rbox(0.32, 0.14, 0.06, 0.04), acc, M(0, 0.6, 0.285, -0.1, 0, 0)));
    for (const s of [-1, 1]) p.push(part(CYL(0.012, 0.012, 0.18, 6), '#ffffff', M(s * 0.07, 0.84, 0.27, -0.15, 0, 0)));
  } else if (t === 'robo') {
    p.push(part(rbox(0.34, 0.26, 0.06, 0.04), '#1a1d2a', M(0, 0.7, 0.27)));
    glow.push(part(S(0.035, 8, 6), '#35ff7a', M(-0.09, 0.74, 0.31)));
    glow.push(part(S(0.035, 8, 6), '#ff4a4a', M(0, 0.74, 0.31)));
    glow.push(colored(S(0.035, 8, 6), acc, M(0.09, 0.74, 0.31)));
    glow.push(colored(rbox(0.22, 0.03, 0.02, 0.01), acc, M(0, 0.64, 0.305)));
    p.push(part(TOR(0.3, 0.035, 6, 28), '#8a93a8', M(0, 0.52, 0, Math.PI / 2, 0, 0)));
    for (const s of [-1, 1]) p.push(part(S(0.1, 12, 8), '#8a93a8', M(s * 0.3, 0.9, 0, 0, 0, 0, 1, 0.7, 1)));
  } else if (t === 'player') {
    p.push(colored(TOR(0.2, 0.08, 8, 20, Math.PI * 1.3), tint(tc, 0.8), M(0, 0.95, -0.1, Math.PI / 2 + 0.3, 0, Math.PI * 1.35)));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.07 : 0.16;
      star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.push(part(new THREE.ExtrudeGeometry(star, { depth: 0.04, bevelEnabled: false }), '#ffffff', M(0, 0.7, 0.27)));
    p.push(colored(TOR(0.3, 0.035, 6, 28), acc, M(0, 0.52, 0, Math.PI / 2, 0, 0)));
  } else if (t === 'tee') {
    p.push(colored(S(0.11, 16, 10), acc, M(0, 0.74, 0.27, 0, 0, 0, 1, 1, 0.3)));
    p.push(colored(TOR(0.11, 0.02, 6, 20), tint(tc, 0.8), M(0, 0.93, 0.04, Math.PI / 2 + 0.2, 0, 0)));
  } else if (t === 'jersey') {
    p.push(colored(rbox(0.5, 0.07, 0.62, 0.03), acc, M(0, 0.78, 0)));
    p.push(colored(rbox(0.12, 0.2, 0.04, 0.02), acc, M(0, 0.62, 0.29)));
  } else if (t === 'chef') {
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) p.push(part(S(0.028, 8, 6), '#c9ccd8', M(s * 0.09, 0.84 - i * 0.11, 0.285)));
    p.push(colored(CONE(0.12, 0.16, 12), acc, M(0, 0.9, 0.2, Math.PI, 0, 0)));
  } else if (t === 'overall') {
    p.push(colored(rbox(0.36, 0.3, 0.06, 0.04), acc, M(0, 0.62, 0.27)));
    for (const s of [-1, 1]) p.push(colored(rbox(0.06, 0.36, 0.05, 0.02), acc, M(s * 0.13, 0.8, 0.26, -0.1, 0, 0)));
    p.push(part(S(0.05, 8, 6), '#ff4f9a', M(-0.12, 0.66, 0.31)));
    p.push(part(S(0.04, 8, 6), '#35d6ff', M(0.1, 0.56, 0.31)));
  } else if (t === 'labcoat') {
    p.push(part(CYL(0.33, 0.4, 0.34, 24, 1, true), '#f4f7ff', M(0, 0.46, 0)));
    p.push(colored(rbox(0.1, 0.12, 0.03, 0.02), acc, M(-0.14, 0.72, 0.27)));
    p.push(part(CYL(0.012, 0.012, 0.12, 6), '#2f6bff', M(-0.12, 0.8, 0.28)));
  } else if (t === 'suit') {
    p.push(colored(rbox(0.26, 0.18, 0.08, 0.04), acc, M(0, 0.7, 0.28)));
    glow.push(part(S(0.03, 8, 6), '#35ff7a', M(-0.06, 0.72, 0.325)));
    glow.push(part(S(0.03, 8, 6), '#ff5a5a', M(0.06, 0.72, 0.325)));
    p.push(part(TOR(0.24, 0.05, 8, 24), '#c9d3ff', M(0, 0.93, 0, Math.PI / 2, 0, 0)));
  } else if (t === 'robe') {
    p.push(colored(CYL(0.3, 0.46, 0.5, 24, 1, true), lk.topC, M(0, 0.3, 0)));
    p.push(colored(TOR(0.46, 0.035, 6, 30), acc, M(0, 0.06, 0, Math.PI / 2, 0, 0)));
    glow.push(part(new THREE.OctahedronGeometry(0.05), '#fff3a0', M(0.1, 0.72, 0.29)));
    glow.push(part(new THREE.OctahedronGeometry(0.04), '#fff3a0', M(-0.14, 0.4, 0.4)));
  } else if (t === 'gi') {
    p.push(colored(rbox(0.08, 0.34, 0.03, 0.02), acc, M(0.06, 0.76, 0.28, 0, 0, 0.5)));
    p.push(colored(rbox(0.08, 0.34, 0.03, 0.02), acc, M(-0.06, 0.76, 0.28, 0, 0, -0.5)));
    p.push(colored(TOR(0.3, 0.035, 6, 28), acc, M(0, 0.52, 0, Math.PI / 2, 0, 0)));
  } else if (t === 'hero') {
    p.push(colored(TOR(0.3, 0.04, 6, 28), '#ffd23a', M(0, 0.5, 0, Math.PI / 2, 0, 0)));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.05 : 0.12;
      star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    glow.push(part(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), '#ffd23a', M(0, 0.74, 0.28)));
  } else if (t === 'pirate') {
    p.push(part(CYL(0.3, 0.33, 0.36, 24, 1, true), '#2a1d18', M(0, 0.72, -0.01)));
    p.push(colored(TOR(0.31, 0.05, 6, 28), acc, M(0, 0.52, 0, Math.PI / 2, 0.1, 0)));
    p.push(part(S(0.035, 8, 6), '#ffd23a', M(0.04, 0.8, 0.29)));
    p.push(part(S(0.035, 8, 6), '#ffd23a', M(0.04, 0.68, 0.3)));
  } else if (t === 'dragon') {
    p.push(colored(S(0.22, 16, 10), acc, M(0, 0.68, 0.14, 0, 0, 0, 0.9, 1.1, 0.7)));
    for (let i = 0; i < 4; i++) p.push(colored(CONE(0.06, 0.16, 4), acc, M(0, 0.9 - i * 0.14, -0.3, -1.2, 0, 0)));
    p.push(colored(CONE(0.12, 0.5, 10), lk.topC, M(0, 0.4, -0.36, -1.9, 0, 0)));
  } else if (t === 'jacket') {
    p.push(colored(rbox(0.18, 0.4, 0.04, 0.02), acc, M(0, 0.7, 0.285)));
    p.push(part(rbox(0.02, 0.4, 0.05, 0.01), '#c0c4d0', M(0.1, 0.7, 0.29)));
    glow.push(colored(rbox(0.02, 0.4, 0.02, 0.01), acc, M(-0.26, 0.7, 0.12, 0, 0.3, 0)));
  }
  return p;
}

function propParts(kind, lk, glow) {
  const p = [];
  const acc = col(lk.acc, '#ffd23a');
  if (kind === 'controller') {
    p.push(part(rbox(0.34, 0.1, 0.18, 0.05), '#23232f', M(0, 0, 0)));
    for (const s of [-1, 1]) p.push(part(S(0.08, 12, 8), '#23232f', M(s * 0.15, -0.02, 0.05)));
    glow.push(colored(S(0.025, 8, 6), '#35ff7a', M(0.1, 0.05, 0.01)));
    glow.push(colored(S(0.025, 8, 6), '#ff4a4a', M(0.13, 0.05, -0.03)));
    glow.push(colored(rbox(0.1, 0.012, 0.03, 0.005), acc, M(0, 0.055, 0.06)));
  } else if (kind === 'yarn') {
    p.push(part(S(0.13, 14, 10), '#ff5fa2', M(0, 0, 0)));
    p.push(part(TOR(0.13, 0.012, 6, 20), '#ffd0e4', M(0, 0, 0, 0.6, 0.4, 0)));
    p.push(part(TOR(0.13, 0.012, 6, 20), '#ffd0e4', M(0, 0, 0, -0.4, 1.2, 0.3)));
  } else if (kind === 'pan') {
    p.push(part(CYL(0.2, 0.17, 0.06, 20), '#2a2a33', M(0, 0, 0.18)));
    p.push(part(CYL(0.025, 0.025, 0.3, 8), '#3a2418', M(0, 0, 0.0, Math.PI / 2, 0, 0)));
    p.push(part(CYL(0.12, 0.12, 0.02, 16), '#ffffff', M(0, 0.04, 0.18)));
    p.push(part(S(0.055, 10, 8), '#ffc21a', M(0, 0.05, 0.18, 0, 0, 0, 1, 0.5, 1)));
  } else if (kind === 'skate') {
    p.push(colored(rbox(0.24, 0.04, 0.8, 0.02), lk.acc === '#101820' ? '#ff3b3b' : acc, M(0, 0, 0, 0, 0, 0)));
    p.push(part(rbox(0.22, 0.01, 0.76, 0.005), '#15151a', M(0, 0.025, 0)));
    for (const z of [-0.26, 0.26]) for (const s of [-1, 1]) p.push(part(CYL(0.045, 0.045, 0.04, 12), '#fff05a', M(s * 0.1, -0.05, z, 0, 0, Math.PI / 2)));
  } else if (kind === 'palette') {
    p.push(part(CYL(0.2, 0.2, 0.03, 20), '#d9a066', M(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 0.8)));
    const cs = ['#ff3b3b', '#ffd23a', '#35d6ff', '#35ff7a', '#b44dff'];
    cs.forEach((c, i) => glow.push(part(S(0.035, 8, 6), c, M(Math.cos(i * 1.1) * 0.12, Math.sin(i * 1.1) * 0.1, 0.02))));
  } else if (kind === 'football') {
    const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position;
    const dv = [];
    for (let i = 0; i < dirs.count; i++) dv.push(new THREE.Vector3().fromBufferAttribute(dirs, i).normalize());
    p.push(part(new THREE.IcosahedronGeometry(0.16, 1), '#ffffff', M(0, 0, 0), (o, x, y, z) => {
      const v = new THREE.Vector3(x, y, z).normalize();
      o.set(dv.some((d) => d.dot(v) > 0.9) ? '#15151c' : '#ffffff');
    }));
  } else if (kind === 'guitar') {
    p.push(colored(S(0.2, 16, 12), acc, M(0, -0.08, 0, 0, 0, 0, 1, 1.2, 0.35)));
    p.push(colored(S(0.15, 16, 12), acc, M(0, 0.18, 0, 0, 0, 0, 1, 1, 0.35)));
    p.push(part(CYL(0.05, 0.05, 0.02, 12), '#111', M(0, 0.02, 0.07, Math.PI / 2, 0, 0)));
    p.push(part(rbox(0.07, 0.6, 0.04, 0.01), '#3a2418', M(0, 0.55, 0)));
    p.push(part(rbox(0.1, 0.14, 0.05, 0.02), '#111', M(0, 0.9, 0)));
  } else if (kind === 'flask') {
    p.push(part(S(0.13, 16, 12), '#dff7ff', M(0, 0, 0)));
    glow.push(colored(S(0.11, 16, 12), lk.acc, M(0, -0.02, 0, 0, 0, 0, 1, 0.8, 1)));
    p.push(part(CYL(0.045, 0.05, 0.16, 12), '#dff7ff', M(0, 0.17, 0)));
  } else if (kind === 'mic') {
    p.push(part(CYL(0.03, 0.022, 0.24, 10), '#20212e', M(0, 0, 0)));
    p.push(part(S(0.065, 14, 10), '#c0c4d0', M(0, 0.15, 0)));
  } else if (kind === 'rocket') {
    p.push(part(CAP(0.07, 0.2, 4, 12), '#ffffff', M(0, 0.05, 0)));
    p.push(part(CONE(0.07, 0.12, 12), '#ff4a4a', M(0, 0.25, 0)));
    for (let i = 0; i < 3; i++) p.push(part(rbox(0.02, 0.1, 0.08, 0.005), '#ff4a4a', M(Math.cos(i * 2.1) * 0.07, -0.06, Math.sin(i * 2.1) * 0.07, 0, -i * 2.1, 0)));
    glow.push(part(CONE(0.05, 0.12, 10), '#ffb13b', M(0, -0.14, 0, Math.PI, 0, 0)));
  } else if (kind === 'vinyl') {
    p.push(part(CYL(0.2, 0.2, 0.02, 28), '#101014', M(0, 0, 0, Math.PI / 2, 0, 0)));
    glow.push(colored(CYL(0.07, 0.07, 0.025, 20), lk.acc, M(0, 0, 0, Math.PI / 2, 0, 0)));
  } else if (kind === 'wand') {
    p.push(part(CYL(0.018, 0.022, 0.42, 8), '#2a1a12', M(0, 0.12, 0)));
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.045 : 0.1;
      star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    glow.push(part(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), '#ffe066', M(0, 0.38, -0.015)));
  } else if (kind === 'shuriken') {
    for (let i = 0; i < 4; i++) p.push(part(CONE(0.05, 0.22, 4), '#c9d3e6', M(Math.cos(i * Math.PI / 2) * 0.1, Math.sin(i * Math.PI / 2) * 0.1, 0, 0, 0, i * Math.PI / 2 - Math.PI / 2, 1, 1, 0.3)));
    p.push(part(CYL(0.04, 0.04, 0.04, 12), '#20232f', M(0, 0, 0, Math.PI / 2, 0, 0)));
  } else if (kind === 'map') {
    p.push(part(CYL(0.05, 0.05, 0.36, 12), '#f3dfae', M(0, 0, 0, 0, 0, Math.PI / 2)));
    p.push(part(TOR(0.052, 0.012, 6, 14), '#b3261e', M(0, 0, 0, 0, Math.PI / 2, 0)));
  } else if (kind === 'egg') {
    p.push(part(S(0.15, 16, 12), '#fff4d6', M(0, 0, 0, 0, 0, 0, 0.9, 1.2, 0.9)));
    for (let i = 0; i < 5; i++) p.push(part(S(0.04, 8, 6), '#1faa4a', M(Math.cos(i * 1.3) * 0.12, Math.sin(i * 2.1) * 0.1, Math.sin(i * 1.3) * 0.12)));
  } else if (kind === 'star') {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.08 : 0.18;
      star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    glow.push(part(new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }), null, M(0, 0.05, 0), rainbowFn(2.4)));
  } else if (kind === 'planet') {
    p.push(part(S(0.14, 18, 12), '#ff6ad5', M(0, 0, 0), (o, x, y) => o.setHSL(0.85 + y * 0.6, 0.8, 0.6)));
    glow.push(colored(TOR(0.22, 0.02, 6, 30), lk.acc, M(0, 0, 0, 1.2, 0.3, 0)));
  } else if (kind === 'bolt') {
    const s = new THREE.Shape();
    [[0.02, 0.2], [-0.1, -0.02], [-0.01, -0.02], [-0.05, -0.2], [0.1, 0.04], [0.01, 0.04], [0.06, 0.2]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    glow.push(part(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), lk.acc, M(0, 0, -0.02)));
  } else if (kind === 'trophy') {
    p.push(part(CYL(0.12, 0.05, 0.16, 16), '#ffcc2e', M(0, 0.08, 0)));
    p.push(part(CYL(0.02, 0.02, 0.08, 8), '#ffcc2e', M(0, -0.03, 0)));
    p.push(part(rbox(0.14, 0.04, 0.1, 0.01), '#ffcc2e', M(0, -0.08, 0)));
    for (const s of [-1, 1]) p.push(part(TOR(0.05, 0.012, 6, 12), '#ffcc2e', M(s * 0.13, 0.1, 0, 0, 0, 0)));
  }
  return p;
}

const PROP_HOLD = {
  controller: 'both', yarn: 'right', pan: 'right', skate: 'right', palette: 'left', football: 'right', guitar: 'body', flask: 'right', mic: 'right', rocket: 'right', vinyl: 'right', wand: 'right', shuriken: 'right', map: 'right', egg: 'right', star: 'right', planet: 'right', bolt: 'right', trophy: 'right', cape: 'cape', none: 'none',
};

const FILM_STYLE = {
  game: 'mash', dj: 'mash', robot: 'mash', cat: 'talk', cook: 'flip', skate: 'talk', art: 'paint', ball: 'juggle', music: 'strum', science: 'talk', dance: 'dance', space: 'cast', magic: 'cast', ninja: 'chop', hero: 'cast', pirate: 'talk', dragon: 'talk', rainbow: 'dance', cosmic: 'cast', neon: 'dance', gold: 'cast',
};

let shadowTex = null;
function blobTex() {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}

export function blobShadow(size = 1.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

const geoCache = new Map();
const glassMat = new THREE.MeshPhysicalMaterial({ color: '#bfe9ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });

const REST = [
  [0, 0, 0, -1],
  [0, 0, 0, 0],
  [0, 0.95, 0, 1],
  [0, HEAD_Y - 0.02, 0, 2],
  [-0.35, 0.87, 0, 1],
  [0.35, 0.87, 0, 1],
  [-0.13, 0.46, 0, 0],
  [0.13, 0.46, 0, 0],
];
const B = { root: 0, body: 1, head: 2, eyes: 3, armL: 4, armR: 5, legL: 6, legR: 7 };

function restWorld(b) {
  const v = new THREE.Vector3();
  while (b >= 0) {
    v.x += REST[b][0];
    v.y += REST[b][1];
    v.z += REST[b][2];
    b = REST[b][3];
  }
  return v;
}

function skin(geos, bone, frame, local) {
  const off = restWorld(frame);
  const out = [];
  for (const g of geos) {
    if (local) g.applyMatrix4(local);
    g.translate(off.x, off.y, off.z);
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    out.push(g);
  }
  return out;
}

function holdFrame(def) {
  const hold = PROP_HOLD[def.look.prop] || 'right';
  if (hold === 'both') return { bone: B.body, frame: B.body, m: M(0, 0.66, 0.42, 0.5, 0, 0) };
  if (hold === 'body') return { bone: B.body, frame: B.body, m: M(0.02, 0.58, 0.36, 0.1, 0, 0.9) };
  if (hold === 'left') return { bone: B.armL, frame: B.armL, m: M(0, -0.42, 0.1, -0.2, 0, 0) };
  if (def.look.prop === 'skate') return { bone: B.armR, frame: B.armR, m: M(0.05, -0.42, 0, 1.3, 0, 0) };
  if (def.look.prop === 'pan') return { bone: B.armR, frame: B.armR, m: M(0, -0.42, 0.12) };
  return { bone: B.armR, frame: B.armR, m: M(0, -0.44, 0.08) };
}

function buildGeos(def) {
  if (geoCache.has(def.id)) return geoCache.get(def.id);
  const lk = def.look;
  const glowT = [];
  const glowH = [];
  const glowP = [];
  const special = [];
  const eyes = [];
  const head = [part(new THREE.SphereGeometry(HEAD_R, 20, 14), lk.skin, M(0, HEAD_Y, 0, 0, 0, 0, HEAD_SX, HEAD_SY, 1))];
  head.push(...faceParts(lk, eyes));
  head.push(...hairParts(lk.hair, lk.hairC));
  head.push(...headAcc(lk.head, lk, glowH, special));
  const torso = torsoParts(lk, glowT);
  const arm = () => {
    const g = [];
    const sleeve = lk.topC === 'rainbow' ? null : col(lk.topC, '#ffffff');
    const sl = lk.top === 'robe' || lk.top === 'labcoat' ? CYL(0.1, 0.14, 0.3, 12) : CAP(0.09, 0.18);
    g.push(sleeve ? part(sl, sleeve, M(0, -0.15, 0)) : part(sl, null, M(0, -0.15, 0), rainbowFn(2)));
    g.push(part(S(0.095, 12, 8), lk.top === 'hero' || lk.top === 'suit' ? col(lk.acc, '#ffffff') : lk.skin, M(0, -0.36, 0.01)));
    return g;
  };
  const leg = () => [part(CAP(0.105, 0.22), lk.pants, M(0, -0.2, 0)), part(rbox(0.2, 0.13, 0.3, 0.06, 2), lk.shoes, M(0, -0.395, 0.045)), part(rbox(0.21, 0.035, 0.31, 0.015, 1), '#f4f4f8', M(0, -0.45, 0.045))];
  const props = propParts(lk.prop, lk, glowP);
  const hf = holdFrame(def);
  const main = [
    ...skin(torso, B.body, B.body),
    ...skin(head, B.head, B.head),
    ...skin(eyes, B.eyes, B.head),
    ...skin(arm(), B.armL, B.armL),
    ...skin(arm(), B.armR, B.armR),
    ...skin(leg(), B.legL, B.legL),
    ...skin(leg(), B.legR, B.legR),
    ...skin(props, hf.bone, hf.frame, hf.m),
  ];
  const glow = [...skin(glowT, B.body, B.body), ...skin(glowH, B.head, B.head), ...skin(glowP, hf.bone, hf.frame, hf.m)];
  let capeGeo = null;
  if (lk.prop === 'cape') {
    const cg = new THREE.PlaneGeometry(0.7, 0.9, 6, 8);
    const pos = cg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      pos.setZ(i, -Math.pow((0.45 - y) / 0.9, 1.5) * 0.25 - Math.abs(x) * 0.12);
      pos.setX(i, x * (1 + (0.45 - y) * 0.5));
    }
    cg.computeVertexNormals();
    capeGeo = part(cg, lk.acc, M(0, -0.42, 0));
  }
  const res = { main: merge(main), glow: glow.length ? merge(glow) : null, cape: capeGeo, special };
  geoCache.set(def.id, res);
  return res;
}

export class Creator {
  constructor(def) {
    this.def = def;
    this.root = new THREE.Group();
    this.phase = Math.random() * 10;
    this.mode = 'idle';
    this.blinkT = 1 + Math.random() * 3;
    this.cheerT = 0;
    this.walkSpeed = 1;
    this.shadow = blobShadow(1.3);
    this.root.add(this.shadow);
    this.buildChibi();
  }

  buildChibi() {
    const def = this.def;
    const g = buildGeos(def);
    const bones = REST.map((r) => {
      const b = new THREE.Bone();
      b.position.set(r[0], r[1], r[2]);
      return b;
    });
    REST.forEach((r, i) => {
      if (r[3] >= 0) bones[r[3]].add(bones[i]);
    });
    bones[0].updateMatrixWorld(true);
    const skel = new THREE.Skeleton(bones);
    this.skel = skel;
    this.geo = g;
    const main = new THREE.SkinnedMesh(g.main, vcMat);
    this.mainMat = vcMat;
    main.castShadow = true;
    main.add(bones[0]);
    main.bind(skel);
    const out = new THREE.SkinnedMesh(g.main, outlineMat);
    out.bind(skel);
    this.root.add(main, out);
    this.outline = out;
    if (g.glow) {
      const gm = new THREE.SkinnedMesh(g.glow, vcGlow);
      gm.bind(skel);
      this.root.add(gm);
    }
    this.body = bones[B.body];
    this.head = bones[B.head];
    this.eyes = bones[B.eyes];
    this.armL = bones[B.armL];
    this.armR = bones[B.armR];
    this.legL = bones[B.legL];
    this.legR = bones[B.legR];
    if (g.special.includes('glassHelmet')) {
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 14), glassMat);
      gl.position.y = HEAD_Y + 0.02;
      gl.renderOrder = 3;
      this.head.add(gl);
    }
    if (g.cape) {
      const cm = new THREE.Mesh(g.cape, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5 }));
      cm.castShadow = true;
      this.cape = new THREE.Group();
      this.cape.position.set(0, 0.93, -0.28);
      this.cape.add(cm);
      this.body.add(this.cape);
    }
    this.hold = PROP_HOLD[def.look.prop] || 'right';
    this.style = FILM_STYLE[def.niche] || 'talk';
  }

  addGhost(mat) {
    const gm = new THREE.SkinnedMesh(this.geo.main, mat);
    gm.bind(this.skel);
    gm.renderOrder = 8;
    gm.frustumCulled = false;
    gm.visible = false;
    this.root.add(gm);
    return gm;
  }

  setOutline(on) {
    if (this.outline) this.outline.visible = on;
  }

  setMode(m) {
    this.mode = m;
  }

  cheer(t = 1.2) {
    this.cheerT = t;
  }

  update(dt, time) {
    const t = time + this.phase;
    if (this.cheerT > 0) this.cheerT -= dt;
    this.blinkT -= dt;
    let ey = 1;
    if (this.blinkT < 0.12) ey = Math.max(0.1, Math.abs(this.blinkT - 0.06) / 0.06);
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3.5;
    this.eyes.scale.y = ey;
    const aL = this.armL.rotation;
    const aR = this.armR.rotation;
    const h = this.head.rotation;
    let bob = 0;
    let lx = 0;
    let rx = 0;
    aL.set(0, 0, -0.18);
    aR.set(0, 0, 0.18);
    h.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    if (this.cheerT > 0) {
      const k = Math.sin(t * 14);
      bob = Math.abs(Math.sin(t * 7)) * 0.35;
      aL.set(-2.8 + k * 0.2, 0, -0.4);
      aR.set(-2.8 - k * 0.2, 0, 0.4);
      h.x = -0.2;
    } else if (this.mode === 'walk') {
      const w = t * 9 * this.walkSpeed;
      lx = Math.sin(w) * 0.7;
      rx = -lx;
      aL.x = -lx * 0.8;
      aR.x = lx * 0.8;
      bob = Math.abs(Math.cos(w)) * 0.06;
      h.z = Math.sin(w) * 0.04;
      if (this.hold === 'both') aL.x = aR.x = -0.9;
    } else if (this.mode === 'run') {
      const w = t * 13 * this.walkSpeed;
      const k = Math.sin(w);
      lx = k * 0.95;
      rx = -lx;
      aL.set(-lx * 1.1, 0, -0.35);
      aR.set(lx * 1.1, 0, 0.35);
      bob = Math.abs(Math.cos(w)) * 0.13;
      this.body.rotation.x = 0.2;
      this.body.rotation.y = k * 0.12;
      h.x = -0.14;
      h.y = -k * 0.08;
    } else if (this.mode === 'air') {
      aL.set(-2.5, 0, -0.55);
      aR.set(-2.5, 0, 0.55);
      lx = 0.6;
      rx = -0.35;
      h.x = -0.2;
      this.body.rotation.x = -0.12;
    } else if (this.mode === 'film') {
      const st = this.style;
      bob = Math.sin(t * 4) * 0.02;
      h.x = Math.sin(t * 2.3) * 0.08;
      h.y = Math.sin(t * 0.9) * 0.25;
      if (st === 'mash') {
        aL.set(-1.05 + Math.sin(t * 22) * 0.06, 0.3, -0.1);
        aR.set(-1.05 + Math.cos(t * 19) * 0.06, -0.3, 0.1);
        h.x = 0.15 + Math.abs(Math.sin(t * 5)) * 0.1;
        bob = Math.abs(Math.sin(t * 5)) * 0.04;
      } else if (st === 'flip') {
        const k = Math.max(0, Math.sin(t * 3));
        aR.set(-0.9 - k * 0.9, 0, 0.2);
        aL.set(-0.3, 0, -0.3);
      } else if (st === 'strum') {
        aR.set(-0.7 + Math.sin(t * 16) * 0.25, 0.2, 0.5);
        aL.set(-1.2, -0.5, -0.8);
        bob = Math.abs(Math.sin(t * 4)) * 0.05;
      } else if (st === 'dance') {
        const k = Math.sin(t * 5);
        aL.set(-1.6 - k * 1.1, 0, -0.5);
        aR.set(-1.6 + k * 1.1, 0, 0.5);
        this.body.rotation.y = k * 0.35;
        bob = Math.abs(Math.sin(t * 5)) * 0.14;
        lx = k * 0.25;
        rx = -lx;
      } else if (st === 'cast') {
        const k = Math.sin(t * 2.4);
        aR.set(-2.4 + k * 0.4, 0, 0.3);
        aL.set(-0.4, 0, -0.5 - k * 0.2);
        bob = (k + 1) * 0.04;
      } else if (st === 'paint') {
        aL.set(-0.9, 0.4, -0.2);
        aR.set(-1.2 + Math.sin(t * 5) * 0.4, Math.cos(t * 5) * 0.3, 0.3);
      } else if (st === 'juggle') {
        const k = Math.abs(Math.sin(t * 5));
        aR.set(-0.6 - k * 1.2, 0, 0.2);
        bob = k * 0.1;
      } else if (st === 'chop') {
        const k = Math.sin(t * 6);
        aR.set(-1.4 + k * 0.8, 0, 0.3);
        aL.set(-1.0 - k * 0.5, 0, -0.3);
        this.body.rotation.y = k * 0.2;
      } else {
        const k = Math.sin(t * 3.2);
        aR.set(-0.8 + k * 0.45, 0, 0.25 + Math.max(0, k) * 0.3);
        aL.set(-0.2, 0, -0.35);
        h.z = k * 0.08;
      }
    } else {
      bob = Math.sin(t * 2.2) * 0.015;
      aL.z = -0.18 - Math.sin(t * 2.2) * 0.04;
      aR.z = 0.18 + Math.sin(t * 2.2) * 0.04;
      h.y = Math.sin(t * 0.7) * 0.3;
    }
    this.body.position.y = bob;
    this.legL.rotation.x = lx;
    this.legR.rotation.x = rx;
    this.legL.position.y = 0.46 + (this.cheerT > 0 ? bob : 0);
    this.legR.position.y = 0.46 + (this.cheerT > 0 ? bob : 0);
    if (this.cape) this.cape.rotation.x = 0.15 + Math.sin(t * 3) * 0.08 + (this.mode === 'walk' ? 0.35 : 0);
  }

  dispose() {
    this.root.removeFromParent();
  }
}
