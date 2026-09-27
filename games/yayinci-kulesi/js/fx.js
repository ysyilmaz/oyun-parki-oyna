import * as THREE from 'three';
import { ICONS } from './icons.js';

function atlas() {
  const cv = document.createElement('canvas');
  cv.width = 192;
  cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.save();
  g.translate(96, 32);
  const g2 = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  g2.addColorStop(0, 'rgba(255,255,255,1)');
  g2.addColorStop(1, 'rgba(255,255,255,0.2)');
  g.fillStyle = g2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 6 : 31;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.restore();
  g.fillStyle = '#fff';
  g.fillRect(128 + 14, 20, 36, 24);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

export class Particles {
  constructor(scene, max = 1600) {
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
    this.uniforms = { uTex: { value: atlas() }, uScale: { value: 400 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute vec4 col; attribute float shape; uniform float uScale;
        varying vec4 vCol; varying float vShape;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; vCol = col; vShape = shape; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vCol; varying float vShape;
        void main(){ vec2 uv = vec2((gl_PointCoord.x + vShape) / 3.0, 1.0 - gl_PointCoord.y); vec4 t = texture2D(uTex, uv);
        gl_FragColor = vec4(vCol.rgb * t.rgb * 1.6, t.a * vCol.a); if (gl_FragColor.a < 0.01) discard; }`,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    this.cursor = 0;
    this.tmp = new THREE.Color();
  }

  setScale(h, fov) {
    this.uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360));
  }

  spawn(x, y, z, vx, vy, vz, life, size, color, shape = 0, grav = -6, drag = 1.5) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const p = this.p[i];
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.max = life;
    p.size = size;
    p.grav = grav;
    p.drag = drag;
    this.tmp.set(color);
    p.r = this.tmp.r;
    p.g = this.tmp.g;
    p.b = this.tmp.b;
    p.shape = shape;
  }

  burst(x, y, z, o = {}) {
    const n = o.count || 20;
    const cols = o.colors || [o.color || '#ffd23a'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (o.upBias ?? 0.6) + Math.random() * 0.4;
      const sp = (o.speed || 5) * (0.5 + Math.random() * 0.6);
      this.spawn(x, y, z, Math.cos(a) * sp * (1 - e * 0.5), sp * e + (o.up || 0), Math.sin(a) * sp * (1 - e * 0.5), (o.life || 0.9) * (0.7 + Math.random() * 0.5), (o.size || 0.5) * (0.6 + Math.random() * 0.8), cols[i % cols.length], o.shape ?? (i % 3 === 0 ? 1 : 0), o.grav ?? -7, o.drag ?? 1.5);
    }
  }

  ring(x, y, z, color, n = 30, sp = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn(x, y, z, Math.cos(a) * sp, 0.4, Math.sin(a) * sp, 0.6, 0.55, color, 1, 0, 3);
    }
  }

  confetti(x, y, z, n = 60) {
    const cs = ['#ff2d3d', '#ffd23a', '#35d6ff', '#35ff7a', '#b44dff', '#ff5fb8', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.spawn(x, y, z, Math.cos(a) * sp, 6 + Math.random() * 8, Math.sin(a) * sp, 1.6 + Math.random(), 0.35, cs[i % cs.length], 2, -9, 1.2);
    }
  }

  update(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) {
        this.size[i] = 0;
        continue;
      }
      p.life -= dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy = p.vy * k + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = Math.max(0, p.life / p.max);
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 4] = p.r;
      this.col[i * 4 + 1] = p.g;
      this.col[i * 4 + 2] = p.b;
      this.col[i * 4 + 3] = Math.min(1, t * 2.5);
      this.size[i] = p.size * (0.4 + 0.6 * Math.min(1, t * 3));
      this.shape[i] = p.shape;
      n++;
    }
    this.active = n;
    for (const k of ['position', 'col', 'size', 'shape']) this.geo.attributes[k].needsUpdate = true;
  }
}

export class CoinFlyers {
  constructor(scene) {
    const g = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18);
    g.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#ffc21a', metalness: 0.7, roughness: 0.25, emissive: '#6a3a00', emissiveIntensity: 0.6 }), 80);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.c = [];
    for (let i = 0; i < 80; i++) this.c.push({ t: -1 });
    this.cursor = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 80; i++) this.mesh.setMatrixAt(i, this.hide);
  }

  launch(from, target, n, onArrive) {
    for (let k = 0; k < n; k++) {
      const c = this.c[this.cursor];
      this.cursor = (this.cursor + 1) % 80;
      c.t = -k * 0.03;
      c.dur = 0.45 + Math.random() * 0.15;
      c.fx = from.x + (Math.random() - 0.5) * 0.8;
      c.fy = from.y + 0.2;
      c.fz = from.z + (Math.random() - 0.5) * 0.8;
      c.hx = (Math.random() - 0.5) * 3;
      c.hz = (Math.random() - 0.5) * 3;
      c.h = 1.6 + Math.random() * 1.4;
      c.target = target;
      c.spin = Math.random() * 6;
      c.cb = k === n - 1 ? onArrive : null;
    }
  }

  update(dt) {
    for (let i = 0; i < 80; i++) {
      const c = this.c[i];
      if (c.t === -1 || c.t === undefined) continue;
      c.t += dt;
      if (c.t < 0) {
        this.mesh.setMatrixAt(i, this.hide);
        continue;
      }
      const k = Math.min(1, c.t / c.dur);
      const tx = c.target.x;
      const ty = c.target.y + 1.2;
      const tz = c.target.z;
      const e = k * k;
      const x = c.fx + c.hx * Math.sin(k * Math.PI) * 0.5 + (tx - c.fx) * e;
      const z = c.fz + c.hz * Math.sin(k * Math.PI) * 0.5 + (tz - c.fz) * e;
      const y = c.fy + Math.sin(k * Math.PI) * c.h + (ty - c.fy) * e;
      this.e.set(0, c.spin + c.t * 14, 0);
      this.q.setFromEuler(this.e);
      const sc = k > 0.85 ? (1 - k) / 0.15 : 1;
      this.s.setScalar(Math.max(0.001, sc));
      this.v.set(x, y, z);
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      if (k >= 1) {
        c.t = -1;
        this.mesh.setMatrixAt(i, this.hide);
        if (c.cb) c.cb();
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Overlay {
  constructor(root, camera) {
    this.root = root;
    this.camera = camera;
    this.v = new THREE.Vector3();
    this.labels = new Map();
    this.pops = [];
    this.flyPool = [];
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  project(x, y, z) {
    this.v.set(x, y, z).project(this.camera);
    return { x: (this.v.x * 0.5 + 0.5) * this.w, y: (-this.v.y * 0.5 + 0.5) * this.h, vis: this.v.z < 1 && this.v.z > -1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2 };
  }

  label(key, cls, html) {
    let l = this.labels.get(key);
    if (!l) {
      const el = document.createElement('div');
      el.className = 'wl ' + cls;
      this.root.appendChild(el);
      l = { el, html: null, used: true, cls };
      this.labels.set(key, l);
    }
    if (l.html !== html) {
      l.el.innerHTML = html;
      l.html = html;
    }
    l.used = true;
    return l;
  }

  place(l, x, y, z) {
    const p = this.project(x, y, z);
    if (!p.vis) {
      l.el.style.display = 'none';
      return;
    }
    l.el.style.display = '';
    l.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
  }

  beginFrame() {
    for (const l of this.labels.values()) l.used = false;
  }

  endFrame() {
    for (const [k, l] of this.labels) {
      if (!l.used) {
        l.el.remove();
        this.labels.delete(k);
      }
    }
  }

  pop(x, y, z, text, cls = '') {
    const p = this.project(x, y, z);
    if (!p.vis) return;
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.innerHTML = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  fly(sx, sy, target, n, onEach, onDone) {
    const r = target.getBoundingClientRect();
    const tx = r.left + 30;
    const ty = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const el = this.flyPool.pop() || (() => {
        const e = document.createElement('div');
        e.className = 'flycoin';
        e.innerHTML = ICONS.coin;
        return e;
      })();
      document.body.appendChild(el);
      const delay = i * 45;
      const ox = (Math.random() - 0.5) * 90;
      const oy = (Math.random() - 0.5) * 60 - 30;
      el.style.transform = `translate(${sx}px, ${sy}px) scale(0.6)`;
      el.style.opacity = '0';
      const start = performance.now() + delay;
      const dur = 520 + Math.random() * 120;
      const step = (now) => {
        const k = Math.min(1, Math.max(0, (now - start) / dur));
        if (now < start) {
          requestAnimationFrame(step);
          return;
        }
        const e = k < 0.3 ? k / 0.3 : 1;
        const m = k * k * (3 - 2 * k);
        const x = sx + ox * Math.sin(k * Math.PI) + (tx - sx) * m;
        const y = sy + oy * Math.sin(k * Math.PI) + (ty - sy) * m;
        el.style.opacity = String(Math.min(1, e * 1.5));
        el.style.transform = `translate(${x}px, ${y}px) scale(${0.7 + Math.sin(k * Math.PI) * 0.5})`;
        if (k < 1) requestAnimationFrame(step);
        else {
          el.remove();
          this.flyPool.push(el);
          if (onEach) onEach(i);
          if (i === n - 1 && onDone) onDone();
        }
      };
      requestAnimationFrame(step);
    }
  }
}
