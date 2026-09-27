import * as THREE from 'three';
import * as TX from './textures.js';

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vA;
varying vec3 vC;
uniform float scale;
void main(){
  vA = alpha;
  vC = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = `
uniform sampler2D map;
varying float vA;
varying vec3 vC;
void main(){
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC * t.rgb, t.a * vA);
  if (gl_FragColor.a < 0.01) discard;
}
`;

export class PointPool {
  constructor(scene, count, { additive = true, sprite = 'glow' } = {}) {
    this.n = count;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.s0 = new Float32Array(count);
    this.s1 = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: TX.sprite(sprite) }, scale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.cursor = 0;
  }

  setScale(h) {
    this.mat.uniforms.scale.value = h * 0.9;
  }

  emit(x, y, z, vx, vy, vz, { life = 1, size = 0.5, size1 = 0, color = 0xffffff, gravity = 0, drag = 0 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.max[i] = life;
    this.s0[i] = size;
    this.s1[i] = size1;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    const c = typeof color === 'number' ? _c.setHex(color) : color;
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = 1 - this.life[i] / this.max[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      this.alpha[i] = k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.tint.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
  }
}

const _c = new THREE.Color();

export class Confetti {
  constructor(scene, count = 400) {
    this.n = count;
    const g = new THREE.PlaneGeometry(0.22, 0.13);
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.15 });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.p = [];
    for (let i = 0; i < count; i++) {
      this.p.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, life: 0 });
      this.mesh.setColorAt(i, _c.setHex(0xffffff));
    }
    scene.add(this.mesh);
    this.cursor = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.colors = [0xff4d5e, 0xffc21a, 0x3ddc5a, 0x36a2ff, 0xb86bff, 0xff8ad8, 0xffffff];
    this.active = 0;
  }

  burst(x, y, z, n = 80, power = 9, up = 1, colors = this.colors) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const p = this.p[i];
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.35 + Math.random() * 0.65);
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * s * 0.6;
      p.vz = Math.sin(a) * s * 0.6;
      p.vy = s * up * (0.8 + Math.random() * 0.6);
      p.rx = Math.random() * 6;
      p.ry = Math.random() * 6;
      p.rz = Math.random() * 6;
      p.wx = (Math.random() - 0.5) * 16;
      p.wy = (Math.random() - 0.5) * 16;
      p.wz = (Math.random() - 0.5) * 16;
      p.life = 2.6 + Math.random() * 1.2;
      this.mesh.setColorAt(i, _c.setHex(colors[(Math.random() * colors.length) | 0]));
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.active = 4;
  }

  update(dt) {
    if (this.active <= 0) return;
    this.active -= dt;
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (p.life <= 0) {
        this.s.setScalar(0);
        this.m.compose(this.v.set(0, -9999, 0), this.q, this.s);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      p.life -= dt;
      p.vy -= 12 * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vz *= 1 - 1.6 * dt;
      if (p.vy < -3) p.vy = -3 + (p.vy + 3) * 0.9;
      p.x += p.vx * dt + Math.sin(p.life * 5 + i) * dt * 0.8;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.wx * dt;
      p.ry += p.wy * dt;
      p.rz += p.wz * dt;
      this.e.set(p.rx, p.ry, p.rz);
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.min(1, p.life * 2));
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const p of this.p) p.life = 0;
    this.active = 0.1;
  }
}
