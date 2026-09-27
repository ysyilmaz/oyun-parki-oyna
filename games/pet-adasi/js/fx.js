import * as THREE from 'three';
import { fmt } from './data.js';

function atlasTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.save();
  ctx.translate(96, 32);
  const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g2.addColorStop(0, 'rgba(255,255,255,1)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 7 : 31;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const t = new THREE.CanvasTexture(cv);
  return t;
}

class ParticleSystem {
  constructor(scene, max, additive, tex) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('col', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uTex: { value: tex }, uScale: { value: 400 }, uGain: { value: additive ? 1 : 0.5 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute float size; attribute vec4 col; attribute float shape;
        uniform float uScale;
        varying vec4 vCol; varying float vShape;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
          vCol = col; vShape = shape;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform float uGain;
        varying vec4 vCol; varying float vShape;
        void main() {
          vec2 uv = vec2((gl_PointCoord.x + vShape) * 0.5, 1.0 - gl_PointCoord.y);
          vec4 t = texture2D(uTex, uv);
          gl_FragColor = vec4(vCol.rgb * t.rgb * uGain, t.a * vCol.a);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    this.cursor = 0;
    this.count = 0;
  }

  spawn(o) {
    let p = null;
    for (let k = 0; k < this.max; k++) {
      const i = (this.cursor + k) % this.max;
      if (this.p[i].life <= 0) {
        p = this.p[i];
        this.cursor = (i + 1) % this.max;
        break;
      }
    }
    if (!p) {
      p = this.p[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
    }
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.vz = o.vz || 0;
    p.life = p.max = o.life || 1;
    p.s0 = o.s0 ?? 0.4;
    p.s1 = o.s1 ?? 0;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0;
    p.r = o.r ?? 1;
    p.gg = o.gg ?? 1;
    p.b = o.b ?? 1;
    p.a = o.a ?? 1;
    p.shape = o.shape ?? 0;
    p.fadeIn = o.fadeIn ?? 0;
  }

  update(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = 1 - p.life / p.max;
      this.pos[n * 3] = p.x;
      this.pos[n * 3 + 1] = p.y;
      this.pos[n * 3 + 2] = p.z;
      const fade = Math.min(1, p.life / (p.max * 0.35)) * (p.fadeIn ? Math.min(1, t / p.fadeIn) : 1);
      this.col[n * 4] = p.r;
      this.col[n * 4 + 1] = p.gg;
      this.col[n * 4 + 2] = p.b;
      this.col[n * 4 + 3] = p.a * fade;
      this.size[n] = p.s0 + (p.s1 - p.s0) * t;
      this.shape[n] = p.shape;
      n++;
    }
    this.count = n;
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'col', 'size', 'shape']) this.geo.attributes[k].needsUpdate = true;
  }
}

const _c = new THREE.Color();

export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const tex = atlasTexture();
    this.glow = new ParticleSystem(scene, 2500, true, tex);
    this.solid = new ParticleSystem(scene, 1200, false, tex);
  }

  setScale(h, fov) {
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
    this.glow.uniforms.uScale.value = s;
    this.solid.uniforms.uScale.value = s;
  }

  burst(x, y, z, color, n = 16, opt = {}) {
    _c.set(color);
    const k = opt.intensity ?? 2.5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = opt.up ?? 4;
      const sp = (opt.speed ?? 5) * (0.4 + Math.random() * 0.8);
      (opt.solid ? this.solid : this.glow).spawn({
        x, y, z,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: up * (0.4 + Math.random()),
        g: opt.g ?? 9,
        drag: opt.drag ?? 1.5,
        life: (opt.life ?? 0.8) * (0.6 + Math.random() * 0.6),
        s0: opt.size ?? 0.5,
        s1: opt.size1 ?? 0,
        r: _c.r * k, gg: _c.g * k, b: _c.b * k,
        shape: opt.shape ?? (Math.random() < 0.5 ? 1 : 0),
      });
    }
  }

  confetti(x, y, z, n = 60, size = 0.45) {
    const cols = ['#ff4f6d', '#ffd23a', '#4fd6ff', '#7cff6b', '#c07bff', '#ff9d2e'];
    for (let i = 0; i < n; i++) {
      _c.set(cols[i % cols.length]);
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.solid.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 6 + Math.random() * 8,
        g: 9, drag: 1.2, life: 1.6 + Math.random(), s0: size, s1: size * 0.7,
        r: _c.r, gg: _c.g, b: _c.b, shape: 0,
      });
    }
  }

  sparkle(x, y, z, color, size = 0.5, life = 0.7, intensity = 3) {
    _c.set(color);
    this.glow.spawn({
      x, y, z,
      vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.5,
      life, s0: size, s1: 0, r: _c.r * intensity, gg: _c.g * intensity, b: _c.b * intensity, shape: 1, fadeIn: 0.2,
    });
  }

  dust(x, y, z, n = 4, color = '#e8dcc0') {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.solid.spawn({
        x: x + Math.cos(a) * 0.2, y: y + 0.1, z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * 1.2, vy: 0.8 + Math.random() * 0.5, vz: Math.sin(a) * 1.2,
        drag: 3, life: 0.5 + Math.random() * 0.3, s0: 0.4, s1: 0.9, r: _c.r, gg: _c.g, b: _c.b, a: 0.55, shape: 0,
      });
    }
  }

  update(dt) {
    this.glow.update(dt);
    this.solid.update(dt);
  }
}

function coinGeometry() {
  const pts = [[0, -0.07], [0.26, -0.07], [0.3, -0.04], [0.3, 0.04], [0.26, 0.07], [0.18, 0.07], [0.17, 0.05], [0, 0.05]].map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateX(Math.PI / 2);
  return g;
}

export class Drops {
  constructor(scene, onCollect) {
    this.onCollect = onCollect;
    this.coinMesh = new THREE.InstancedMesh(
      coinGeometry(),
      new THREE.MeshStandardMaterial({ color: '#ffc21a', metalness: 0.9, roughness: 0.25, emissive: '#ff9d00', emissiveIntensity: 0.25 }),
      260
    );
    this.gemMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: '#7ee8ff', metalness: 0.2, roughness: 0.05, emissive: '#2aa8ff', emissiveIntensity: 2.4 }),
      80
    );
    for (const m of [this.coinMesh, this.gemMesh]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.count = 0;
      scene.add(m);
    }
    this.coins = [];
    this.gems = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
  }

  spawn(kind, x, y, z, value, count) {
    const list = kind === 'gem' ? this.gems : this.coins;
    const cap = kind === 'gem' ? 80 : 260;
    const per = value / count;
    for (let i = 0; i < count; i++) {
      if (list.length >= cap) {
        const old = list.shift();
        this.onCollect(old.kind, old.value, old.x, old.y, old.z, true);
      }
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      list.push({
        kind, value: per,
        x, y: y + 0.5, z,
        vx: Math.cos(a) * sp, vy: 5 + Math.random() * 4, vz: Math.sin(a) * sp,
        rot: Math.random() * 6, spin: 4 + Math.random() * 6,
        age: 0, state: 0, ground: 0,
      });
    }
  }

  update(dt, player, magnetR, groundAt) {
    const px = player.x;
    const py = player.y + 1.2;
    const pz = player.z;
    for (const [list, mesh] of [[this.coins, this.coinMesh], [this.gems, this.gemMesh]]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        c.age += dt;
        c.rot += c.spin * dt;
        const dx = px - c.x;
        const dy = py - c.y;
        const dz = pz - c.z;
        const d = Math.hypot(dx, dy, dz);
        if (c.state < 2 && c.age > 0.45 && (d < magnetR || c.age > 2.5)) c.state = 2;
        if (c.state === 2) {
          const sp = 10 + c.age * 8;
          c.vx = (dx / d) * sp;
          c.vy = (dy / d) * sp;
          c.vz = (dz / d) * sp;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.z += c.vz * dt;
          if (d < 0.7) {
            list.splice(i, 1);
            this.onCollect(c.kind, c.value, c.x, c.y, c.z, false);
            continue;
          }
        } else {
          c.vy -= 22 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.z += c.vz * dt;
          const g = groundAt(c.x, c.z) + 0.3;
          if (c.y < g) {
            c.y = g;
            c.vy = Math.abs(c.vy) * 0.35;
            c.vx *= 0.6;
            c.vz *= 0.6;
            if (c.vy < 0.8) {
              c.vy = 0;
              c.state = 1;
            }
          }
        }
      }
      mesh.count = list.length;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const bob = c.state === 1 ? Math.sin(c.age * 4 + i) * 0.08 : 0;
        this.e.set(c.kind === 'gem' ? 0 : 0.3, c.rot, 0);
        this.q.setFromEuler(this.e);
        this.v.set(c.x, c.y + bob, c.z);
        this.m.compose(this.v, this.q, this.s);
        mesh.setMatrixAt(i, this.m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export class Overlay {
  constructor(root, camera) {
    this.root = root;
    this.camera = camera;
    this.nums = [];
    this.v = new THREE.Vector3();
    for (let i = 0; i < 32; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      root.appendChild(el);
      this.nums.push({ el, life: 0 });
    }
    this.bars = [];
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'hpbar';
      el.innerHTML = '<div class="hp-fill"></div><div class="hp-text"></div>';
      el.style.display = 'none';
      root.appendChild(el);
      this.bars.push({ el, fill: el.firstChild, text: el.lastChild, used: false, lastPct: -1, lastText: '' });
    }
  }

  project(x, y, z) {
    this.v.set(x, y, z).project(this.camera);
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * h, vis: this.v.z < 1 && this.v.z > -1 };
  }

  number(x, y, z, text, cls = '') {
    return this.spawnNum(null, x, y, z, text, cls, 0, '');
  }

  add(key, x, y, z, value, cls = '', prefix = '') {
    const now = performance.now();
    const hit = this.nums.find((k) => k.life > 0 && k.key === key && now - k.born < 300);
    if (hit) {
      hit.value += value;
      hit.born = now;
      hit.life = hit.max;
      hit.el.textContent = prefix + fmt(hit.value);
      if (cls) hit.el.className = 'dmg ' + cls;
      return hit;
    }
    return this.spawnNum(key, x, y, z, prefix + fmt(value), cls, value, prefix);
  }

  spawnNum(key, x, y, z, text, cls, value, prefix) {
    const active = this.nums.filter((k) => k.life > 0).sort((a, b) => a.born - b.born);
    let n;
    if (active.length >= 3) {
      n = active[0];
    } else {
      n = this.nums.find((k) => k.life <= 0) || this.nums[0];
    }
    const stack = active.filter((k) => k !== n && Math.hypot(k.x - x, k.z - z) < 3).length;
    n.key = key;
    n.value = value;
    n.prefix = prefix;
    n.born = performance.now();
    n.life = n.max = 0.9;
    n.x = x;
    n.y = y + stack * 0.75;
    n.z = z;
    n.el.textContent = text;
    n.el.className = 'dmg ' + cls;
    n.el.style.display = 'block';
    return n;
  }

  update(dt, bars) {
    const placed = [];
    for (let i = 0; i < this.bars.length; i++) {
      const b = this.bars[i];
      const src = bars[i];
      if (!src) {
        if (b.used) {
          b.el.style.display = 'none';
          b.used = false;
        }
        continue;
      }
      const p = this.project(src.x, src.y, src.z);
      if (!p.vis) {
        b.el.style.display = 'none';
        b.used = false;
        continue;
      }
      for (let k = 0; k < 6; k++) {
        const o = placed.find((q) => Math.abs(q.x - p.x) < 136 && Math.abs(q.y - p.y) < 34);
        if (!o) break;
        p.y = o.y - 36;
      }
      placed.push({ x: p.x, y: p.y, w: 136, h: 34 });
      if (!b.used) {
        b.el.style.display = 'block';
        b.used = true;
      }
      b.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      const hidden = this.hudRects && this.hudRects.some((r) => p.x + 70 > r.left && p.x - 70 < r.right && p.y + 18 > r.top && p.y - 18 < r.bottom);
      b.el.style.opacity = hidden ? '0' : '';
      const pct = Math.max(0, Math.round(src.pct * 1000) / 10);
      if (pct !== b.lastPct) {
        b.fill.style.width = pct + '%';
        b.lastPct = pct;
      }
      if (src.text !== b.lastText) {
        b.text.innerHTML = src.text;
        b.lastText = src.text;
      }
      b.el.classList.toggle('is-target', !!src.target);
      b.el.classList.toggle('is-picked', !!src.picked);
      b.el.classList.toggle('is-hit', !!src.hit);
    }
    for (const n of this.nums) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.life <= 0) {
        n.el.style.display = 'none';
        continue;
      }
      const t = 1 - n.life / n.max;
      const p = this.project(n.x, n.y + t * 1.6, n.z);
      const w = 14 + n.el.textContent.length * 15;
      for (let k = 0; k < 8; k++) {
        const o = placed.find((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < (q.h + 30) / 2);
        if (!o) break;
        p.y = o.y - (o.h + 30) / 2 - 2;
      }
      placed.push({ x: p.x, y: p.y, w, h: 30 });
      const sc = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.6);
      n.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
      n.el.style.opacity = t > 0.65 ? ((1 - t) / 0.35).toFixed(2) : '1';
    }
  }
}
