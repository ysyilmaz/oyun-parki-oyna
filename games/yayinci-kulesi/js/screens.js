import * as THREE from 'three';
import { CREATOR_BY_ID, RARITIES, fmt } from './data.js';

export const TW = 384;
export const TH = 216;
const COLS = 2;
const ROWS = 4;

const NICHE_COL = {
  game: ['#2b1b6b', '#0e8cff'], cat: ['#ff9a3d', '#ffd36b'], cook: ['#ff6b3c', '#ffd0a1'], skate: ['#18a860', '#b6ff5a'], art: ['#ff4f9a', '#ffd23a'],
  ball: ['#0f7a3a', '#40c060'], music: ['#3a0f2a', '#ff3c7d'], science: ['#0a3a4a', '#38e0c0'], dance: ['#5a1a7a', '#ff49c8'], space: ['#070b2a', '#3a2a8a'],
  dj: ['#10102a', '#b44dff'], magic: ['#1a0f4a', '#6a3aff'], ninja: ['#101418', '#3a4a3a'], hero: ['#1a3aff', '#7ab8ff'], pirate: ['#0a3a6a', '#3aa8d8'],
  dragon: ['#3a0a0a', '#ff6a1f'], robot: ['#20242e', '#ffcf3a'], rainbow: ['#ff4fa8', '#35d6ff'], cosmic: ['#0a0620', '#5a1aa8'], neon: ['#0a0014', '#ff3cf0'], gold: ['#6a4a00', '#ffcf3a'],
};

function star(g, x, y, r, n = 5, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function playIcon(g, x, y, s, fg = '#ffffff', bg = null) {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  g.strokeStyle = bg || '#35d6ff';
  g.lineWidth = s * 0.16;
  for (const k of [0.78, 1.05]) {
    g.beginPath();
    g.arc(0, 0, s * k, -0.7, 0.7);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, s * k, Math.PI - 0.7, Math.PI + 0.7);
    g.stroke();
  }
  g.fillStyle = bg || '#ffd23a';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? s * 0.26 : s * 0.58;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.fillStyle = fg;
  g.beginPath();
  g.arc(0, -s * 0.02, s * 0.12, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const SCENES = {
  game(g, t) {
    const sx = (t * 80) % 48;
    g.fillStyle = '#3ad16b';
    for (let x = -sx; x < TW; x += 48) g.fillRect(x, 160, 46, 56);
    g.fillStyle = '#8a4b1f';
    for (let x = -sx; x < TW; x += 48) g.fillRect(x, 176, 46, 40);
    const jy = Math.abs(Math.sin(t * 3)) * 60;
    g.fillStyle = '#ff3b3b';
    g.fillRect(120, 124 - jy, 30, 36);
    g.fillStyle = '#ffffff';
    g.fillRect(138, 132 - jy, 8, 8);
    g.fillStyle = '#ffd23a';
    for (let i = 0; i < 4; i++) circle(g, ((i * 110 - t * 80) % 440 + 440) % 440, 90 + Math.sin(t * 4 + i) * 8, 10);
  },
  cat(g, t) {
    const b = Math.sin(t * 4) * 8;
    g.fillStyle = '#ffffff';
    circle(g, 192, 118 + b, 56);
    g.beginPath();
    g.moveTo(146, 90 + b);
    g.lineTo(150, 30 + b);
    g.lineTo(186, 70 + b);
    g.moveTo(238, 90 + b);
    g.lineTo(234, 30 + b);
    g.lineTo(198, 70 + b);
    g.fill();
    g.fillStyle = '#2a1a10';
    circle(g, 172, 112 + b, 8);
    circle(g, 212, 112 + b, 8);
    g.fillStyle = '#ff7aa8';
    circle(g, 192, 132 + b, 6);
    for (let i = 0; i < 3; i++) {
      const y = 200 - ((t * 50 + i * 60) % 190);
      g.fillStyle = `rgba(255,79,154,${Math.min(1, y / 100)})`;
      star(g, 70 + i * 120, y, 12, 5, 0.5);
    }
  },
  cook(g, t) {
    g.fillStyle = '#2a2a33';
    g.beginPath();
    g.ellipse(192, 160, 90, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(270, 152, 90, 14);
    const fy = Math.max(0, Math.sin(t * 3)) * 80;
    g.save();
    g.translate(192, 150 - fy);
    g.rotate(fy * 0.05);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, 0, 40, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffc21a';
    circle(g, 0, 0, 12);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 3; i++) circle(g, 150 + i * 40, 110 - ((t * 30 + i * 20) % 60), 10);
  },
  skate(g, t) {
    g.fillStyle = '#e8f7ff';
    g.beginPath();
    g.moveTo(0, 200);
    g.quadraticCurveTo(0, 90, 90, 90);
    g.lineTo(90, 216);
    g.lineTo(0, 216);
    g.fill();
    g.beginPath();
    g.moveTo(384, 200);
    g.quadraticCurveTo(384, 90, 294, 90);
    g.lineTo(294, 216);
    g.fill();
    g.fillRect(0, 196, TW, 20);
    const x = 192 + Math.sin(t * 2) * 130;
    const y = 180 - Math.abs(Math.cos(t * 2)) * 70;
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(t * 2) > 0.8 ? t * 10 : 0);
    g.fillStyle = '#ff3b3b';
    rrect(g, -30, -6, 60, 10, 5);
    g.fill();
    g.fillStyle = '#1a1a1a';
    circle(g, -18, 8, 6);
    circle(g, 18, 8, 6);
    g.restore();
  },
  art(g, t) {
    const cs = ['#ff3b3b', '#ffd23a', '#35d6ff', '#35ff7a', '#b44dff'];
    g.lineWidth = 16;
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = cs[i];
      g.beginPath();
      const k = Math.min(1, ((t * 0.5 + i * 0.2) % 2));
      g.arc(192, 200, 60 + i * 18, Math.PI, Math.PI + Math.PI * k);
      g.stroke();
    }
  },
  ball(g, t) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 6;
    g.strokeRect(250, 60, 110, 110);
    g.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(250 + i * 22, 60);
      g.lineTo(250 + i * 22, 170);
      g.stroke();
    }
    g.globalAlpha = 1;
    const k = (t * 0.6) % 1;
    const x = 40 + k * 270;
    const y = 180 - Math.sin(k * Math.PI) * 110;
    g.fillStyle = '#ffffff';
    circle(g, x, y, 18);
    g.fillStyle = '#111';
    circle(g, x + 4, y - 3, 6);
  },
  music(g, t) {
    for (let i = 0; i < 12; i++) {
      const h = 30 + Math.abs(Math.sin(t * 6 + i * 0.7)) * 120;
      g.fillStyle = `hsl(${330 + i * 6},90%,${55 + (i % 3) * 5}%)`;
      rrect(g, 20 + i * 30, 200 - h, 22, h, 6);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    const y = 70 + Math.sin(t * 3) * 10;
    circle(g, 90, y + 30, 12);
    g.fillRect(98, y - 20, 5, 50);
  },
  science(g, t) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.moveTo(170, 50);
    g.lineTo(214, 50);
    g.lineTo(214, 100);
    g.lineTo(260, 190);
    g.lineTo(124, 190);
    g.lineTo(170, 100);
    g.fill();
    g.fillStyle = '#38e0c0';
    g.beginPath();
    g.moveTo(150, 140);
    g.lineTo(234, 140);
    g.lineTo(256, 186);
    g.lineTo(128, 186);
    g.fill();
    g.fillStyle = 'rgba(200,255,240,0.9)';
    for (let i = 0; i < 6; i++) circle(g, 160 + i * 14, 180 - ((t * 60 + i * 30) % 140), 5 + (i % 3) * 2);
  },
  dance(g, t) {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsla(${(t * 80 + i * 45) % 360},90%,60%,0.35)`;
      g.beginPath();
      g.moveTo(192, 40);
      const a = t + (i / 8) * Math.PI * 2;
      g.lineTo(192 + Math.cos(a) * 300, 40 + Math.abs(Math.sin(a)) * 300);
      g.lineTo(192 + Math.cos(a + 0.2) * 300, 40 + Math.abs(Math.sin(a + 0.2)) * 300);
      g.fill();
    }
    g.fillStyle = '#dfe6f0';
    circle(g, 192, 40, 26);
  },
  space(g, t) {
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) circle(g, (i * 97 + t * 20 * (1 + (i % 3))) % TW, (i * 53) % TH, 1.5);
    g.fillStyle = '#ff9a3d';
    circle(g, 300, 150, 40);
    const x = (t * 90) % (TW + 100) - 50;
    g.save();
    g.translate(x, 90 + Math.sin(t * 2) * 20);
    g.rotate(Math.PI / 2);
    g.fillStyle = '#ffffff';
    rrect(g, -12, -30, 24, 50, 12);
    g.fill();
    g.fillStyle = '#ff4a4a';
    g.beginPath();
    g.moveTo(-12, -24);
    g.lineTo(0, -44);
    g.lineTo(12, -24);
    g.fill();
    g.fillStyle = '#ffb13b';
    g.beginPath();
    g.moveTo(-8, 22);
    g.lineTo(0, 40 + Math.random() * 10);
    g.lineTo(8, 22);
    g.fill();
    g.restore();
  },
  dj(g, t) {
    g.save();
    g.translate(140, 120);
    g.rotate(t * 4);
    g.fillStyle = '#101014';
    circle(g, 0, 0, 70);
    g.strokeStyle = '#2a2a33';
    g.lineWidth = 2;
    for (let r = 20; r < 70; r += 8) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#b44dff';
    circle(g, 0, 0, 22);
    g.fillStyle = '#fff';
    g.fillRect(-3, -60, 6, 20);
    g.restore();
    for (let i = 0; i < 6; i++) {
      const h = 20 + Math.abs(Math.sin(t * 8 + i)) * 90;
      g.fillStyle = '#35f0ff';
      rrect(g, 240 + i * 22, 190 - h, 16, h, 4);
      g.fill();
    }
  },
  magic(g, t) {
    for (let i = 0; i < 14; i++) {
      const a = t * 1.5 + i;
      const r = 20 + ((t * 40 + i * 13) % 90);
      g.fillStyle = `hsla(${50 + i * 20},100%,70%,${1 - r / 110})`;
      star(g, 192 + Math.cos(a) * r, 110 + Math.sin(a) * r, 9);
    }
    g.fillStyle = '#ffe066';
    star(g, 192, 110, 26 + Math.sin(t * 4) * 4);
  },
  ninja(g, t) {
    g.fillStyle = '#5a8a3a';
    for (let i = 0; i < 6; i++) g.fillRect(30 + i * 60, 0, 14, TH);
    g.save();
    g.translate(((t * 160) % (TW + 80)) - 40, 110);
    g.rotate(t * 14);
    g.fillStyle = '#dfe6f0';
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(-8, 0);
      g.lineTo(0, -34);
      g.lineTo(8, 0);
      g.fill();
    }
    g.restore();
  },
  hero(g, t) {
    g.fillStyle = 'rgba(10,20,60,0.6)';
    for (let i = 0; i < 8; i++) g.fillRect(i * 50, 120 + ((i * 37) % 60), 44, 100);
    const x = (t * 100) % (TW + 120) - 60;
    g.fillStyle = '#ff2e4d';
    g.beginPath();
    g.moveTo(x, 70);
    g.lineTo(x - 70, 60 + Math.sin(t * 10) * 8);
    g.lineTo(x - 70, 90);
    g.fill();
    g.fillStyle = '#2f6bff';
    circle(g, x, 76, 16);
    g.fillStyle = '#ffd23a';
    star(g, x, 76, 8);
  },
  pirate(g, t) {
    g.fillStyle = '#1a6aa8';
    for (let x = 0; x < TW; x += 40) {
      g.beginPath();
      g.arc(x + ((t * 30) % 40), 170 + Math.sin(t * 2 + x) * 4, 26, Math.PI, 0);
      g.fill();
    }
    const b = Math.sin(t * 2) * 6;
    g.fillStyle = '#6a3a1a';
    g.beginPath();
    g.moveTo(130, 140 + b);
    g.lineTo(260, 140 + b);
    g.lineTo(240, 170 + b);
    g.lineTo(150, 170 + b);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(195, 60 + b);
    g.lineTo(195, 136 + b);
    g.lineTo(250, 130 + b);
    g.fill();
  },
  dragon(g, t) {
    g.fillStyle = '#1faa4a';
    circle(g, 110, 120, 40);
    g.fillStyle = '#ffffff';
    circle(g, 120, 108, 8);
    for (let i = 0; i < 16; i++) {
      const k = (t * 2 + i / 16) % 1;
      g.fillStyle = `hsla(${20 + k * 30},100%,${60 - k * 20}%,${1 - k})`;
      circle(g, 150 + k * 220, 125 + Math.sin(i * 3) * k * 40, 8 + k * 26);
    }
  },
  robot(g, t) {
    const gear = (x, y, r, a) => {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = '#ffcf3a';
      for (let i = 0; i < 10; i++) {
        g.rotate(Math.PI / 5);
        g.fillRect(-7, -r - 10, 14, 16);
      }
      circle(g, 0, 0, r);
      g.fillStyle = '#20242e';
      circle(g, 0, 0, r * 0.35);
      g.restore();
    };
    gear(140, 110, 48, t);
    gear(236, 150, 32, -t * 1.5 + 0.3);
  },
  rainbow(g, t) {
    const cs = ['#ff3b3b', '#ff9a3d', '#ffd23a', '#35ff7a', '#35d6ff', '#7a5cff'];
    g.lineWidth = 14;
    cs.forEach((c, i) => {
      g.strokeStyle = c;
      g.beginPath();
      g.arc(192, 216, 150 - i * 14, Math.PI, 0);
      g.stroke();
    });
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) star(g, 40 + i * 62, 40 + Math.sin(t * 3 + i) * 12, 8);
  },
  cosmic(g, t) {
    for (let i = 0; i < 120; i++) {
      const a = i * 0.35 + t * 0.8;
      const r = i * 1.1;
      g.fillStyle = `hsla(${260 + i},90%,70%,${1 - i / 130})`;
      circle(g, 192 + Math.cos(a) * r, 108 + Math.sin(a) * r * 0.55, 2.5);
    }
  },
  neon(g, t) {
    g.fillStyle = '#ff3cf0';
    for (let i = 0; i < 6; i++) g.fillRect(96, 60 + i * 12, 192, 5);
    const gr = g.createLinearGradient(0, 40, 0, 120);
    gr.addColorStop(0, '#ffd23a');
    gr.addColorStop(1, '#ff3cf0');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(192, 120, 70, Math.PI, 0);
    g.fill();
    g.strokeStyle = '#39ff9f';
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = 130 + ((i * 12 + t * 30) % 90);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(TW, y);
      g.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(192 + i * 10, 130);
      g.lineTo(192 + i * 60, TH);
      g.stroke();
    }
  },
  gold(g, t) {
    for (let i = 0; i < 14; i++) {
      const y = ((t * 90 + i * 40) % 260) - 30;
      g.fillStyle = '#ffd23a';
      g.beginPath();
      g.ellipse((i * 71) % TW, y, 12, 12 * Math.abs(Math.cos(t * 3 + i)) + 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffcf3a';
    rrect(g, 162, 70, 60, 60, 20);
    g.fill();
    g.fillRect(186, 130, 12, 30);
    g.fillRect(166, 160, 52, 14);
  },
};

function person(g, x, y, s) {
  circle(g, x, y - s * 0.35, s * 0.3);
  g.beginPath();
  g.arc(x, y + s * 0.45, s * 0.52, Math.PI, 0);
  g.fill();
}

export class ScreenAtlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TW * COLS;
    this.canvas.height = TH * ROWS;
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.cursor = 0;
    this.lastT = -1;
    this.slots = [];
    for (let i = 0; i < 8; i++) this.slots.push({ id: null, subs: 0, viral: 0, empty: true, suggest: false });
    for (let i = 0; i < 8; i++) this.draw(i, 0);
    this.tex.needsUpdate = true;
  }

  uv(i) {
    const cx = i % COLS;
    const cy = Math.floor(i / COLS);
    return { u0: cx / COLS, u1: (cx + 1) / COLS, v0: 1 - (cy + 1) / ROWS, v1: 1 - cy / ROWS };
  }

  draw(i, t) {
    const g = this.g;
    const s = this.slots[i];
    const ox = (i % COLS) * TW;
    const oy = Math.floor(i / COLS) * TH;
    g.save();
    g.beginPath();
    g.rect(ox, oy, TW, TH);
    g.clip();
    g.translate(ox, oy);
    if (!s.id) {
      const gr = g.createLinearGradient(0, 0, 0, TH);
      gr.addColorStop(0, '#141a2e');
      gr.addColorStop(1, '#0a0d18');
      g.fillStyle = gr;
      g.fillRect(0, 0, TW, TH);
      g.globalAlpha = 0.5 + Math.sin(t * 3 + i) * 0.25;
      playIcon(g, TW / 2, TH / 2, 60, '#0a0d18', '#5b6b9a');
      g.globalAlpha = 1;
      g.restore();
      return;
    }
    const def = CREATOR_BY_ID[s.id];
    const [c0, c1] = NICHE_COL[def.niche] || ['#222', '#555'];
    const gr = g.createLinearGradient(0, 0, TW, TH);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fillRect(0, 0, TW, TH);
    (SCENES[def.niche] || SCENES.game)(g, t + i * 1.7);
    const rc = RARITIES[def.r];
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, TH - 42, TW, 42);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(0, TH - 46, TW, 4);
    g.fillStyle = '#ff3b3b';
    g.fillRect(0, TH - 46, ((t * 0.08 + i * 0.13) % 1) * TW, 4);
    g.fillStyle = rc.rainbow ? `hsl(${(t * 120) % 360},90%,60%)` : rc.color;
    circle(g, 26, TH - 21, 14);
    g.fillStyle = '#ffffff';
    person(g, TW - 150, TH - 21, 22);
    g.font = '900 26px "Segoe UI Black", "Arial Rounded MT Bold", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(fmt(s.subs), TW - 128, TH - 20);
    playIcon(g, 62, TH - 21, 16);
    if (s.viral > 0) {
      g.strokeStyle = `hsl(${20 + Math.sin(t * 10) * 15},100%,55%)`;
      g.lineWidth = 12;
      g.strokeRect(6, 6, TW - 12, TH - 12);
      g.fillStyle = '#ff6a1f';
      rrect(g, TW - 96, 12, 84, 44, 12);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '900 32px "Segoe UI Black", sans-serif';
      g.fillText('×3', TW - 78, 36);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      circle(g, TW - 30, 30, 18);
      g.fillStyle = '#ff3b5c';
      circle(g, TW - 30, 30, 9 * (0.6 + 0.4 * Math.abs(Math.sin(t * 4))));
    }
    g.restore();
  }

  set(i, id, subs, viral) {
    const s = this.slots[i];
    s.id = id;
    s.subs = subs;
    s.viral = viral;
  }

  update(t, n = 8) {
    if (t - this.lastT < 1 / 12) return;
    this.lastT = t;
    for (let k = 0; k < n; k++) {
      this.draw(this.cursor, t);
      this.cursor = (this.cursor + 1) % 8;
    }
    this.tex.needsUpdate = true;
  }

  redrawAll(t) {
    for (let i = 0; i < 8; i++) this.draw(i, t);
    this.tex.needsUpdate = true;
  }
}
