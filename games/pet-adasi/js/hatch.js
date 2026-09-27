import * as THREE from 'three';
import { getEggGeometry, makeEggMaterial, drawEggPattern, drawCracks } from './eggs.js';
import { createPetObject } from './petModels.js';
import { FX } from './fx.js';
import { RARITIES, SPECIES, VARIANTS, fmt } from './data.js';
import { easeOutBack, easeOutCubic } from './util.js';

const BG_NEUTRAL = new THREE.Color('#5a78c8');

export class Hatch {
  constructor(renderer, envTex, audio, ui) {
    this.audio = audio;
    this.ui = ui;
    this.scene = new THREE.Scene();
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.25;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 2.2, 9);
    this.camera.lookAt(0, 1.55, 0);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899cc, 0.7));
    const d = new THREE.DirectionalLight(0xffffff, 1.6);
    d.position.set(3, 5, 6);
    this.scene.add(d);
    this.bgUniforms = { uColor: { value: BG_NEUTRAL.clone() }, uAlpha: { value: 0 }, uTime: { value: 0 }, uRays: { value: 0 }, uAspect: { value: 1 } };
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.bgUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform float uRays; uniform float uAspect;
          varying vec2 vUv;
          void main(){
            vec2 p = (vUv - vec2(0.5, 0.52)) * vec2(uAspect, 1.0);
            float r = length(p);
            float a = atan(p.y, p.x);
            float rays = pow(max(0.0, sin(a * 9.0 + uTime * 0.8)), 6.0) + 0.6 * pow(max(0.0, sin(a * 5.0 - uTime * 0.5)), 10.0);
            rays *= smoothstep(1.1, 0.05, r) * uRays;
            vec3 bg = mix(uColor * 1.1, uColor * 0.12, smoothstep(0.0, 0.9, r));
            vec3 col = bg + uColor * rays * 1.3 + vec3(1.0) * rays * 0.15;
            col += vec3(1.0) * smoothstep(0.3, 0.0, r) * uRays * 0.2;
            gl_FragColor = vec4(col * 0.5, uAlpha);
          }`,
      })
    );
    bg.frustumCulled = false;
    bg.renderOrder = -100;
    this.bgScene = new THREE.Scene();
    this.bgScene.add(bg);
    this.fx = new FX(this.scene, this.camera);
    this.active = false;
    this.t = 0;
    this.shards = [];
    const shardGeo = new THREE.SphereGeometry(0.8, 6, 4, 0, 1.1, 0, 1.0);
    this.shardGeo = shardGeo;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.bgUniforms.uAspect.value = w / h;
    this.fx.setScale(h * Math.min(window.devicePixelRatio, 2), 35);
  }

  start(res, eggColors, golden, onDone, count) {
    this.res = res;
    this.onDone = onDone;
    this.active = true;
    this.t = 0;
    this.stage = 0;
    this.skippable = count > 3;
    this.closeAt = this.skippable ? 3.45 : 4.2;
    this.rarity = res.rarity;
    this.target = new THREE.Color(RARITIES[Math.max(res.rarity, res.v === 1 ? 4 : res.v === 2 ? 5 : 0)].color);
    this.bgUniforms.uColor.value.copy(BG_NEUTRAL);
    this.bgUniforms.uRays.value = 0.4;
    if (this.egg) this.scene.remove(this.egg);
    if (this.pet) this.scene.remove(this.pet.root);
    this.pet = null;
    for (const m of [this.eggMat, this.shardMat]) {
      if (!m) continue;
      m.map.dispose();
      m.dispose();
    }
    const mat = makeEggMaterial(eggColors, 5, golden);
    this.eggMat = mat;
    this.shardMat = makeEggMaterial(eggColors, 5, golden);
    this.eggColors = eggColors;
    this.egg = new THREE.Mesh(getEggGeometry(), mat);
    this.egg.scale.setScalar(1.25);
    this.scene.add(this.egg);
    for (const s of this.shards) this.scene.remove(s.m);
    this.shards = [];
    this.ui.hatchStart();
  }

  crack(level) {
    const cv = this.eggMat.userData.canvas;
    const ctx = cv.getContext('2d');
    drawEggPattern(ctx, 256, 256, this.eggColors, 5);
    drawCracks(ctx, 256, 256, level, 7);
    this.eggMat.map.needsUpdate = true;
    this.audio.crack(level);
  }

  burst() {
    this.egg.visible = false;
    const rarityCol = this.target.getStyle();
    this.fx.burst(0, 1.4, 0, rarityCol, 60, { speed: 8, up: 5, life: 1.3, size: 0.4, g: 4 });
    this.fx.burst(0, 1.4, 0, '#ffffff', 30, { speed: 6, up: 4, life: 0.9, size: 0.3, g: 4 });
    this.fx.confetti(0, 1.5, -1, this.rarity >= 3 ? 110 : 60, 0.2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.shardGeo, this.shardMat);
      const a = (i / 10) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.4, 1.2 + Math.random() * 0.8, Math.sin(a) * 0.4);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.scene.add(m);
      this.shards.push({ m, vx: Math.cos(a) * (3 + Math.random() * 3), vy: 4 + Math.random() * 4, vz: Math.sin(a) * 3 + 2, rs: Math.random() * 10 });
    }
    this.pet = createPetObject(this.res.sp, this.res.v);
    this.pet.root.scale.setScalar(0.001);
    this.pet.root.position.set(0, this.pet.flying ? 1.3 : 1.05, 0);
    this.scene.add(this.pet.root);
    this.audio.pop();
    setTimeout(() => this.audio.reveal(this.rarity), 120);
    this.ui.hatchFlash(this.rarity);
  }

  skip() {
    if (!this.active) return;
    if (this.t < 2.3 && this.skippable) {
      this.t = 2.3;
      this.crack(3);
      return;
    }
    if (this.t >= this.closeAt) this.finish();
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.ui.hatchEnd();
    if (this.pet) this.scene.remove(this.pet.root);
    for (const s of this.shards) this.scene.remove(s.m);
    this.shards = [];
    if (this.onDone) this.onDone(this.res);
  }

  update(dt) {
    if (!this.active && this.bgUniforms.uAlpha.value <= 0) return false;
    const u = this.bgUniforms;
    u.uTime.value += dt;
    if (!this.active) {
      u.uAlpha.value = Math.max(0, u.uAlpha.value - dt * 4);
      this.fadeOut = true;
      this.fx.update(dt);
      return u.uAlpha.value > 0;
    }
    const prev = this.t;
    this.t += dt;
    const t = this.t;
    u.uAlpha.value = Math.min(1, t * 3);
    const crossed = (x) => prev < x && t >= x;
    if (t < 2.3) {
      const drop = Math.min(1, t / 0.45);
      const y = (1 - easeOutBack(drop)) * 4;
      let wob = 0;
      const wobbles = [[0.6, 0.18, 1], [1.2, 0.3, 2], [1.75, 0.45, 3]];
      for (const [wt, amp, lvl] of wobbles) {
        if (crossed(wt)) this.audio.wobble(lvl);
        const k = t - wt;
        if (k > 0 && k < 0.45) wob = Math.sin(k * 30) * amp * (1 - k / 0.45);
      }
      if (t > 2.0) wob = Math.sin(t * 60) * 0.12;
      this.egg.position.set(0, y, 0);
      this.egg.rotation.set(0, t * 0.6, wob);
      const sq = 1 + (t > 2.0 ? Math.sin(t * 40) * 0.04 + (t - 2.0) * 0.4 : 0);
      this.egg.scale.set(1.25 * sq, 1.25 / Math.sqrt(sq), 1.25 * sq);
      if (crossed(1.0)) this.crack(1);
      if (crossed(1.6)) this.crack(2);
      if (crossed(2.05)) this.crack(3);
      if (t > 1.2) {
        const k = Math.min(1, (t - 1.2) / 1.0);
        const rare = this.rarity >= 2 || this.res.v > 0;
        if (rare) u.uColor.value.copy(BG_NEUTRAL).lerp(this.target, k);
        u.uRays.value = 0.4 + k * (this.rarity >= 4 ? 1.4 : rare ? 0.9 : 0.3);
      }
      if (Math.random() < dt * 12) this.fx.sparkle((Math.random() - 0.5) * 2.5, Math.random() * 3, (Math.random() - 0.5) * 1, this.rarity >= 2 ? this.target.getStyle() : '#ffffff', 0.35, 0.8, 2);
    } else {
      if (this.stage === 0) {
        this.stage = 1;
        u.uColor.value.copy(this.target);
        u.uRays.value = this.rarity >= 4 ? 2 : this.rarity >= 2 ? 1.4 : 0.9;
        this.burst();
      }
      const k = Math.min(1, (t - 2.3) / 0.55);
      if (this.pet) {
        const s = Math.max(0.001, easeOutBack(k)) * 1.45;
        this.pet.root.scale.setScalar(s);
        this.pet.root.rotation.y = Math.sin((t - 2.3) * 1.1) * 0.35;
        this.pet.root.position.y = (this.pet.flying ? 1.3 : 1.05) + Math.abs(Math.sin((t - 2.3) * 3)) * 0.15 * (1 - easeOutCubic(Math.min(1, (t - 2.3) / 3)));
        if (this.pet.mixer) this.pet.mixer.update(dt);
        for (const w of this.pet.wings) w.rotation.z = w.userData.side * (0.35 + Math.sin(t * 10) * 0.45);
      }
      if (crossed(2.55)) this.ui.hatchBanner(this.res, (this.closeAt - 2.55) * 1000);
      if (Math.random() < dt * (this.rarity >= 4 ? 30 : 10)) this.fx.sparkle((Math.random() - 0.5) * 4, Math.random() * 3.5, (Math.random() - 0.5) * 2, this.target.getStyle(), 0.45, 1, 2.5);
    }
    for (const s of this.shards) {
      s.vy -= 14 * dt;
      s.m.position.x += s.vx * dt;
      s.m.position.y += s.vy * dt;
      s.m.position.z += s.vz * dt;
      s.m.rotation.x += s.rs * dt;
    }
    this.fx.update(dt);
    return true;
  }
}

export function describe(res) {
  const sp = SPECIES[res.sp];
  return {
    name: (res.v ? VARIANTS[res.v].name + ' ' : '') + sp.name,
    rarity: RARITIES[res.rarity],
    power: fmt(res.power),
  };
}
