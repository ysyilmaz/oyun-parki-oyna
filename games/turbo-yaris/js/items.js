import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { questionTexture } from './textures.js';

export const ITEM_NAMES = { turbo: 'TURBO', shield: 'KALKAN', goo: 'BALÇIK', magnet: 'MIKNATIS' };
const ITEM_KEYS = ['turbo', 'shield', 'goo', 'magnet'];
export const MAGNET_SPEED = 46;

const BOX_VERT = `
varying vec3 vN;
varying vec2 vUv;
varying vec3 vWP;
varying float vId;
void main() {
  vUv = uv;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(m) * normal);
  vId = float(gl_InstanceID);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BOX_FRAG = `
uniform float time;
uniform sampler2D qmap;
varying vec3 vN;
varying vec2 vUv;
varying vec3 vWP;
varying float vId;
vec3 hsv(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
void main() {
  float h = fract(time * 0.22 + (vUv.x + vUv.y) * 0.22 + vId * 0.17 + vWP.y * 0.1);
  vec3 base = hsv(vec3(h, 0.8, 1.0));
  vec3 v = normalize(cameraPosition - vWP);
  float fr = pow(1.0 - abs(dot(normalize(vN), v)), 2.0);
  vec4 q = texture2D(qmap, vUv);
  vec3 col = base * 0.85 + fr * 0.9;
  float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5));
  col += smoothstep(0.4, 0.5, e) * 1.1;
  col = mix(col, vec3(1.6), q.a);
  gl_FragColor = vec4(col, 0.82 + q.a * 0.18);
}`;

export class Items {
  constructor(race) {
    this.race = race;
    this.track = race.track;
    this.scene = race.scene;
    const spots = this.track.itemSpots;
    const geo = new RoundedBoxGeometry(1.7, 1.7, 1.7, 3, 0.25);
    this.boxMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, qmap: { value: questionTexture() } },
      vertexShader: BOX_VERT,
      fragmentShader: BOX_FRAG,
      transparent: true
    });
    this.boxes = new THREE.InstancedMesh(geo, this.boxMat, spots.length);
    this.boxes.frustumCulled = false;
    this.boxState = spots.map(sp => {
      const pt = this.track.pointAt(sp.s, sp.lat);
      return { x: pt.x, y: pt.y + 1.35, z: pt.z, s: sp.s, lat: sp.lat, t: 0, scale: 1 };
    });
    this.scene.add(this.boxes);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.sv = new THREE.Vector3();
    this.hazards = [];
    this.shots = [];
    const gooGeo = new THREE.CircleGeometry(1.9, 20);
    const gp = gooGeo.attributes.position;
    for (let i = 1; i < gp.count; i++) {
      const a = Math.atan2(gp.getY(i), gp.getX(i));
      const r = 1 + Math.sin(a * 5) * 0.12 + Math.sin(a * 3 + 1) * 0.1;
      gp.setXY(i, gp.getX(i) * r, gp.getY(i) * r);
    }
    gooGeo.rotateX(-Math.PI / 2);
    this.gooGeo = gooGeo;
    this.gooMat = new THREE.MeshPhysicalMaterial({ color: 0x3be83b, emissive: 0x0a5a0a, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -3 });
    this.bubbleGeo = new THREE.SphereGeometry(0.35, 12, 8);
    const mg = new THREE.TorusGeometry(0.55, 0.22, 10, 20, Math.PI);
    const tipGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.4, 12);
    this.magGeo = { mg, tipGeo };
    this.magMat = new THREE.MeshStandardMaterial({ color: 0xff2330, emissive: 0x550000, roughness: 0.3, metalness: 0.3 });
    this.tipMat = new THREE.MeshStandardMaterial({ color: 0xe8eef8, metalness: 1, roughness: 0.2 });
  }

  update(dt, time) {
    this.boxMat.uniforms.time.value = time;
    const bs = this.boxState;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.t > 0) { b.t -= dt; b.scale = b.t > 0 ? 0 : 0.01; } else b.scale = Math.min(1, b.scale + dt * 3);
      const k = b.scale < 1 ? 1 + Math.sin(b.scale * Math.PI) * 0.3 : 1;
      this.e.set(0.5 + Math.sin(time + i) * 0.2, time * 1.4 + i, 0.3);
      this.q.setFromEuler(this.e);
      this.v.set(b.x, b.y + Math.sin(time * 2 + i) * 0.25, b.z);
      const s = b.scale * k;
      this.sv.set(s, s, s);
      this.m.compose(this.v, this.q, this.sv);
      this.boxes.setMatrixAt(i, this.m);
    }
    this.boxes.instanceMatrix.needsUpdate = true;
    const karts = this.race.karts;
    for (const kt of karts) {
      for (const b of bs) {
        if (b.t > 0 || b.scale < 0.6) continue;
        const dx = kt.x - b.x, dz = kt.z - b.z;
        if (dx * dx + dz * dz < 6.8 && Math.abs(kt.y + 0.8 - b.y) < 3) {
          b.t = 2.5;
          this.race.onBoxBreak(b, kt);
          if (!kt.item && kt.rouletteT <= 0) this.give(kt);
        }
      }
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      h.arm -= dt;
      h.mesh.scale.setScalar(Math.min(1, h.mesh.scale.x + dt * 5));
      h.bubbles.forEach((bb, n) => { bb.position.y = 0.1 + Math.abs(Math.sin(time * 3 + n * 2)) * 0.25; });
      let hitK = null;
      for (const kt of karts) {
        if (kt === h.owner && h.arm > 0) continue;
        if (!kt.grounded && kt.y > h.y + 0.6) continue;
        const dx = kt.x - h.x, dz = kt.z - h.z;
        if (dx * dx + dz * dz < 4.2) { hitK = kt; break; }
      }
      if (hitK) { hitK.hit('goo'); this.race.onGooHit(h, hitK); }
      if (hitK || h.life <= 0) { this.scene.remove(h.mesh); this.hazards.splice(i, 1); }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const tg = s.target;
      let done = s.life <= 0;
      if (!done) {
        if (tg && !tg.finished) {
          const dx = tg.x - s.x, dz = tg.z - s.z, dy = tg.y + 0.8 - s.y;
          const dist = Math.hypot(dx, dz);
          if (dist < 26) {
            const sp = MAGNET_SPEED * dt;
            s.x += dx / dist * Math.min(sp, dist);
            s.z += dz / dist * Math.min(sp, dist);
            s.y += dy * Math.min(1, dt * 6);
            if (dist < 2.4) { tg.hit('magnet'); this.race.onMagnetHit(s, tg); done = true; }
          } else this.advanceOnTrack(s, dt, tg.p.lat);
        } else this.advanceOnTrack(s, dt, s.lat);
        s.mesh.position.set(s.x, s.y, s.z);
        s.mesh.rotation.y = time * 8;
        this.race.onMagnetTrail(s);
      }
      if (done) { this.scene.remove(s.mesh); this.shots.splice(i, 1); }
    }
  }

  advanceOnTrack(s, dt, lat) {
    s.s = this.track.wrapS(s.s + MAGNET_SPEED * dt);
    s.lat += (lat - s.lat) * Math.min(1, dt * 2);
    const pt = this.track.pointAt(s.s, s.lat, this.tmp || (this.tmp = {}));
    s.x = pt.x; s.z = pt.z; s.y = pt.y + 1.2;
  }

  give(kt) {
    const pos = this.race.positionOf(kt);
    const n = this.race.karts.length;
    let w;
    if (pos === 1) w = [15, 35, 45, 5];
    else if (pos <= Math.ceil(n / 2)) w = [30, 20, 25, 25];
    else w = [42, 13, 10, 35];
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let k = 0;
    while (r > w[k]) { r -= w[k]; k++; }
    const item = ITEM_KEYS[k];
    if (kt.isPlayer) {
      kt.rouletteT = 1.1;
      kt.pendingItem = item;
    } else kt.item = item;
  }

  use(kt) {
    const item = kt.item;
    if (!item) return;
    kt.item = null;
    if (item === 'turbo') {
      kt.boostT = Math.max(kt.boostT, 1.7);
      this.race.onBoost(kt, 'item');
    } else if (item === 'shield') {
      kt.shieldT = 9;
      this.race.onShield(kt);
    } else if (item === 'goo') {
      const fx = Math.sin(kt.heading), fz = Math.cos(kt.heading);
      const x = kt.x - fx * 4.2, z = kt.z - fz * 4.2;
      const p = this.track.project(x, z, kt.p.i, {});
      const y = this.track.groundY(p) + 0.08;
      const mesh = new THREE.Group();
      const puddle = new THREE.Mesh(this.gooGeo, this.gooMat);
      mesh.add(puddle);
      const bubbles = [0, 1, 2].map(n => {
        const b = new THREE.Mesh(this.bubbleGeo, this.gooMat);
        b.position.set(Math.cos(n * 2.1) * 0.8, 0.2, Math.sin(n * 2.1) * 0.8);
        b.scale.setScalar(0.6 + n * 0.25);
        mesh.add(b);
        return b;
      });
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.1);
      this.scene.add(mesh);
      this.hazards.push({ x, y, z, s: p.s, lat: p.lat, mesh, bubbles, owner: kt, life: 25, arm: 0.8 });
      this.race.onGooDrop(kt);
    } else if (item === 'magnet') {
      const target = this.race.kartAhead(kt);
      const mesh = new THREE.Group();
      const arc = new THREE.Mesh(this.magGeo.mg, this.magMat);
      arc.rotation.z = Math.PI;
      mesh.add(arc);
      for (const sx of [-0.55, 0.55]) {
        const tip = new THREE.Mesh(this.magGeo.tipGeo, this.tipMat);
        tip.position.set(sx, 0.15, 0);
        mesh.add(tip);
      }
      mesh.scale.setScalar(1.3);
      const fx = Math.sin(kt.heading), fz = Math.cos(kt.heading);
      const s = { x: kt.x + fx * 3, y: kt.y + 1.2, z: kt.z + fz * 3, s: kt.p.s + 3, lat: kt.p.lat, target, owner: kt, life: target ? 8 : 3, mesh };
      mesh.position.set(s.x, s.y, s.z);
      this.scene.add(mesh);
      this.shots.push(s);
      this.race.onMagnetFire(kt, target);
    }
  }

  dispose() {
    this.scene.remove(this.boxes);
    this.hazards.forEach(h => this.scene.remove(h.mesh));
    this.shots.forEach(s => this.scene.remove(s.mesh));
    [this.boxes.geometry, this.gooGeo, this.bubbleGeo, this.magGeo.mg, this.magGeo.tipGeo].forEach(g => g.dispose());
    this.boxMat.uniforms.qmap.value.dispose();
    [this.boxMat, this.gooMat, this.magMat, this.tipMat].forEach(m => m.dispose());
    this.boxes.dispose();
  }
}
