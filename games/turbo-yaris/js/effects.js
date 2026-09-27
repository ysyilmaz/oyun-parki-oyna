import * as THREE from 'three';

const P_VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 70.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = aAlpha * smoothstep(2.0, 8.0, -mv.z);
  vColor = aColor;
}`;

const P_FRAG = `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
}`;

export class Particles {
  constructor(max, texture, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, uScale: { value: 500 } },
      vertexShader: P_VERT,
      fragmentShader: P_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    this.geo = g;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 1, grav = 0, drag = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.grav[i] = grav; this.drag[i] = drag;
    this.size[i] = s0;
    this.alpha[i] = a;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = true;
    a.aColor.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }

  setScale(height, fov) {
    this.material.uniforms.uScale.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }
}

export class SkidMarks {
  constructor(max = 1400, color = 0x101010, opacity = 0.42) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 4 * 3);
    const idx = [];
    for (let i = 0; i < max; i++) { const a = i * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.prev = new Map();
    this.dirty = false;
  }

  mark(key, x, y, z, px, pz, w, active) {
    if (!active) { this.prev.delete(key); return; }
    const p = this.prev.get(key);
    if (p) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < 0.25) return;
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const o = i * 12;
      const a = this.pos;
      a[o] = p.x - p.px * w; a[o + 1] = p.y; a[o + 2] = p.z - p.pz * w;
      a[o + 3] = p.x + p.px * w; a[o + 4] = p.y; a[o + 5] = p.z + p.pz * w;
      a[o + 6] = x - px * w; a[o + 7] = y; a[o + 8] = z - pz * w;
      a[o + 9] = x + px * w; a[o + 10] = y; a[o + 11] = z + pz * w;
      this.dirty = true;
    }
    this.prev.set(key, { x, y, z, px, pz });
  }

  update() {
    if (this.dirty) { this.geo.attributes.position.needsUpdate = true; this.dirty = false; }
  }

  clear() {
    this.pos.fill(0);
    this.prev.clear();
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class Confetti {
  constructor(count = 420) {
    this.count = count;
    const g = new THREE.PlaneGeometry(0.22, 0.36);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), count);
    this.mesh.frustumCulled = false;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.r = new Float32Array(count * 3);
    this.rv = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const cols = [0xff3b5c, 0xffd23b, 0x3bd1ff, 0x5bff8a, 0xff7ad9, 0xffffff, 0xff9b2b, 0x9b6bff];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.setHex(cols[i % cols.length]).multiplyScalar(1.1);
      this.mesh.setColorAt(i, c);
    }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3(1, 1, 1);
    this.t = new THREE.Vector3();
    this.hideAll();
  }

  hideAll() {
    this.life.fill(0);
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(x, y, z, spread = 6, n = this.count, up = 9) {
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * this.count);
      this.p[i * 3] = x + (Math.random() - 0.5) * spread;
      this.p[i * 3 + 1] = y + Math.random() * 2;
      this.p[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      this.v[i * 3] = (Math.random() - 0.5) * 8;
      this.v[i * 3 + 1] = up * (0.5 + Math.random());
      this.v[i * 3 + 2] = (Math.random() - 0.5) * 8;
      for (let a = 0; a < 3; a++) { this.r[i * 3 + a] = Math.random() * 6; this.rv[i * 3 + a] = (Math.random() - 0.5) * 12; }
      this.life[i] = 4 + Math.random() * 3;
    }
  }

  rain(x, y, z, spread, n) {
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * this.count);
      if (this.life[i] > 0) continue;
      this.p[i * 3] = x + (Math.random() - 0.5) * spread;
      this.p[i * 3 + 1] = y + Math.random() * 3;
      this.p[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
      this.v[i * 3] = (Math.random() - 0.5) * 1.5;
      this.v[i * 3 + 1] = -1;
      this.v[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      for (let a = 0; a < 3; a++) { this.r[i * 3 + a] = Math.random() * 6; this.rv[i * 3 + a] = (Math.random() - 0.5) * 10; }
      this.life[i] = 6;
    }
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      this.v[o + 1] -= 9 * dt;
      this.v[o] *= 0.98; this.v[o + 2] *= 0.98;
      if (this.v[o + 1] < -2.2) this.v[o + 1] = -2.2;
      this.p[o] += (this.v[o] + Math.sin(this.r[o] * 2) * 0.8) * dt;
      this.p[o + 1] += this.v[o + 1] * dt;
      this.p[o + 2] += this.v[o + 2] * dt;
      for (let a = 0; a < 3; a++) this.r[o + a] += this.rv[o + a] * dt;
      this.e.set(this.r[o], this.r[o + 1], this.r[o + 2]);
      this.q.setFromEuler(this.e);
      this.t.set(this.p[o], this.p[o + 1], this.p[o + 2]);
      const sc = this.life[i] > 0 ? 1 : 0;
      this.s.set(sc, sc, sc);
      this.m.compose(this.t, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class SpeedLines {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.lines = [];
    for (let i = 0; i < 70; i++) this.lines.push(this.spawn({}));
    this.level = 0;
  }

  spawn(l) {
    l.a = Math.random() * Math.PI * 2;
    l.r = 0.25 + Math.random() * 0.5;
    l.v = 1.2 + Math.random() * 1.6;
    l.len = 0.06 + Math.random() * 0.12;
    return l;
  }

  resize(w, h) {
    this.c.width = Math.round(w / 2);
    this.c.height = Math.round(h / 2);
  }

  draw(dt, level, tint) {
    this.level += (level - this.level) * Math.min(1, dt * 6);
    const g = this.g, w = this.c.width, h = this.c.height;
    g.clearRect(0, 0, w, h);
    if (this.level < 0.03) return;
    const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) * 0.6;
    g.lineCap = 'round';
    for (const l of this.lines) {
      l.r += l.v * dt * (0.6 + this.level);
      if (l.r > 1.1) this.spawn(l);
      const r0 = l.r * R, r1 = (l.r + l.len) * R;
      if (l.r < 0.35) continue;
      const a = Math.min(1, (l.r - 0.35) * 3) * this.level * 0.55;
      g.strokeStyle = tint.replace('A', a.toFixed(3));
      g.lineWidth = 1.5 + l.len * 14;
      g.beginPath();
      g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0 * 0.75);
      g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1 * 0.75);
      g.stroke();
    }
  }
}
