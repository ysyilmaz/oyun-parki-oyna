import * as THREE from 'three';
import { canvasTex } from './geo.js';
import { playIcon } from './screens.js';

const FONT = '"Segoe UI Black", "Arial Rounded MT Bold", "Arial Black", sans-serif';
const cache = new Map();
function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function floorTex(theme) {
  return once('floor' + theme.id, () =>
    canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = theme.floor;
      g.fillRect(0, 0, w, h);
      const id = theme.id;
      if (id === 'gaming' || id === 'space') {
        g.fillStyle = theme.floor2;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
        g.strokeStyle = id === 'gaming' ? 'rgba(122,92,255,0.55)' : 'rgba(125,249,255,0.35)';
        g.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo(i * 64, 0);
          g.lineTo(i * 64, h);
          g.moveTo(0, i * 64);
          g.lineTo(w, i * 64);
          g.stroke();
        }
        if (id === 'space') {
          g.fillStyle = 'rgba(200,220,255,0.35)';
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56]]) {
            g.beginPath();
            g.arc(x * 64 + a, y * 64 + b, 3, 0, 7);
            g.fill();
          }
        }
      } else if (id === 'cooking' || id === 'candy') {
        g.fillStyle = theme.floor2;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64);
        g.strokeStyle = 'rgba(0,0,0,0.08)';
        g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo(i * 64, 0);
          g.lineTo(i * 64, h);
          g.moveTo(0, i * 64);
          g.lineTo(w, i * 64);
          g.stroke();
        }
      } else if (id === 'sports') {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? theme.floor : theme.floor2;
          g.fillRect(0, i * 64, w, 64);
        }
        g.globalAlpha = 0.12;
        for (let i = 0; i < 4000; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#0a4a1a' : '#8ae07a';
          g.fillRect(Math.random() * w, Math.random() * h, 2, 5);
        }
        g.globalAlpha = 1;
      } else if (id === 'music') {
        for (let i = 0; i < 16; i++) {
          g.fillStyle = i % 2 ? '#3a1a22' : '#46202a';
          g.fillRect(0, i * 32, w, 31);
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(((i * 173) % 400) + 40, i * 32, 3, 31);
        }
      }
    }, { repeat: [1, 1] })
  );
}

export function plazaTex() {
  return once('plaza', () =>
    canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#4c5260';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const off = y % 2 ? 32 : 0;
          const v = 128 + Math.floor(Math.random() * 26);
          const gr = g.createLinearGradient(0, y * 64, 0, y * 64 + 64);
          gr.addColorStop(0, `rgb(${v + 10},${v + 16},${v + 28})`);
          gr.addColorStop(1, `rgb(${v - 14},${v - 10},${v})`);
          g.fillStyle = gr;
          g.fillRect(((x * 64 + off) % w) + 3, y * 64 + 3, 58, 58);
          if (off) g.fillRect(3 - 32, y * 64 + 3, 58, 58);
        }
      g.globalAlpha = 0.1;
      for (let i = 0; i < 5000; i++) {
        g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, { repeat: [20, 20] })
  );
}

export function brickTex() {
  return once('brick', () =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6e3a2a';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 4; x++) {
          const off = y % 2 ? 32 : 0;
          const v = Math.random() * 20;
          g.fillStyle = `rgb(${190 + v},${100 + v * 0.6},${70 + v * 0.4})`;
          g.fillRect(((x * 64 + off) % w) + 2, y * 32 + 2, 60, 28);
          if (off && x === 3) g.fillRect(-30, y * 32 + 2, 60, 28);
        }
    })
  );
}

export function grassTex() {
  return once('grass', () =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5fbf4a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const l = 40 + Math.random() * 25;
        g.fillStyle = `hsl(${95 + Math.random() * 20},55%,${l}%)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 4);
      }
    }, { repeat: [60, 60] })
  );
}

export function beltTex() {
  return once('belt', () => {
    const t = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#d4202c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = '#a8121c';
        g.fillRect(0, i * 32, w, 8);
        g.fillStyle = '#ff4a54';
        g.fillRect(0, i * 32 + 8, w, 2);
      }
      g.fillStyle = '#ffd23a';
      g.fillRect(0, 0, 6, h);
      g.fillRect(w - 6, 0, 6, h);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

export function glowTex() {
  return once('glow', () =>
    canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    })
  );
}

export function beamTex() {
  return once('beam', () =>
    canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const gx = g.createLinearGradient(0, 0, w, 0);
      gx.addColorStop(0, 'rgba(0,0,0,1)');
      gx.addColorStop(0.5, 'rgba(0,0,0,0)');
      gx.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = gx;
      g.fillRect(0, 0, w, h);
    })
  );
}

export function ringTex() {
  return once('ring', () =>
    canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.55, 'rgba(255,255,255,1)');
      gr.addColorStop(0.75, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    })
  );
}

export function neonText(text, color, w = 1024, h = 256, size = 150) {
  return once('neon' + text + color + w, () =>
    canvasTex(w, h, (g) => {
      g.clearRect(0, 0, w, h);
      g.font = `900 ${size}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.shadowColor = color;
      g.shadowBlur = 28;
      g.strokeStyle = color;
      g.lineWidth = 14;
      g.strokeText(text, w / 2, h / 2);
      g.shadowBlur = 8;
      g.fillStyle = '#ffffff';
      g.fillText(text, w / 2, h / 2);
    })
  );
}

export function logoTex() {
  return once('logo', () =>
    canvasTex(1024, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.save();
      g.shadowColor = '#35d6ff';
      g.shadowBlur = 30;
      playIcon(g, 180, 256, 150, '#ffffff');
      g.restore();
      g.font = `900 150px ${FONT}`;
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = 22;
      g.strokeStyle = '#1b1336';
      g.strokeText('YAYINCI', 350, 180);
      g.strokeText('KULESİ', 350, 340);
      const gr = g.createLinearGradient(0, 100, 0, 420);
      gr.addColorStop(0, '#fff27a');
      gr.addColorStop(1, '#ff9a1f');
      g.fillStyle = gr;
      g.fillText('YAYINCI', 350, 180);
      g.fillStyle = '#ffffff';
      g.fillText('KULESİ', 350, 340);
    })
  );
}

const POSTER_ART = {
  gaming: (g, w, h, i) => {
    g.fillStyle = ['#7a5cff', '#ff3cf0', '#34f0ff'][i % 3];
    g.beginPath();
    g.roundRect(w * 0.2, h * 0.38, w * 0.6, h * 0.24, 30);
    g.fill();
    g.fillStyle = '#1b1733';
    g.beginPath();
    g.arc(w * 0.34, h * 0.5, 14, 0, 7);
    g.arc(w * 0.66, h * 0.5, 14, 0, 7);
    g.fill();
  },
  cooking: (g, w, h, i) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.3, 0, 7);
    g.fill();
    g.fillStyle = ['#ff6b3c', '#35c96b', '#ffc21a'][i % 3];
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.14, 0, 7);
    g.fill();
  },
  sports: (g, w, h, i) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.28, 0, 7);
    g.fill();
    g.fillStyle = '#16213a';
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.1, 0, 7);
    g.fill();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(w / 2 + Math.cos(a) * w * 0.2, h * 0.5 + Math.sin(a) * w * 0.2, w * 0.05, 0, 7);
      g.fill();
    }
  },
  music: (g, w, h, i) => {
    g.fillStyle = ['#ffcc33', '#ff2e63', '#ffffff'][i % 3];
    g.beginPath();
    g.ellipse(w * 0.38, h * 0.62, 40, 30, -0.4, 0, 7);
    g.fill();
    g.fillRect(w * 0.38 + 30, h * 0.25, 12, h * 0.38);
    g.fillRect(w * 0.38 + 30, h * 0.25, 70, 16);
  },
  space: (g, w, h, i) => {
    g.fillStyle = ['#ff9a3d', '#a97dff', '#7df9ff'][i % 3];
    g.beginPath();
    g.arc(w / 2, h * 0.5, w * 0.22, 0, 7);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(w / 2, h * 0.5, w * 0.38, w * 0.1, -0.3, 0, 7);
    g.stroke();
  },
  candy: (g, w, h, i) => {
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = ['#ff5fb8', '#35d6ff', '#ffd23a'][(k + i) % 3];
      g.lineWidth = 14;
      g.beginPath();
      g.arc(w / 2, h * 0.52, 20 + k * 16, 0, Math.PI * 1.5);
      g.stroke();
    }
  },
};

export function posterTex(theme, i) {
  return once('poster' + theme.id + i, () =>
    canvasTex(256, 360, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, theme.accent);
      gr.addColorStop(1, theme.wall);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 50, 0, 7);
        g.fill();
      }
      (POSTER_ART[theme.id] || POSTER_ART.gaming)(g, w, h, i);
      playIcon(g, w / 2, h * 0.86, 26);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
    })
  );
}

export function windowTex() {
  return once('win', () =>
    canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 14; y++)
        for (let x = 0; x < 4; x++) {
          const l = 58 + Math.random() * 18;
          g.fillStyle = `hsl(${205 + Math.random() * 12},55%,${l}%)`;
          g.fillRect(9 + x * 29, 10 + y * 17.6, 22, 11);
        }
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, 0, 6, h);
    }, { repeat: [1, 1] })
  );
}

export function floorNumberTex(n, color) {
  return once('fnum' + n + color, () =>
    canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#10131f';
      g.beginPath();
      g.roundRect(8, 8, w - 16, h - 16, 40);
      g.fill();
      g.strokeStyle = color;
      g.lineWidth = 12;
      g.stroke();
      g.font = `900 170px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText(String(n), w / 2, h / 2 + 10);
    })
  );
}

export function coinFaceTex() {
  return once('coinface', () =>
    canvasTex(128, 128, (g) => {
      g.fillStyle = '#ffc21a';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#e08a00';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(64, 64, 44, 0, 7);
      g.stroke();
      g.fillStyle = '#fff3a8';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 12 : 28;
        g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      g.fill();
    })
  );
}
