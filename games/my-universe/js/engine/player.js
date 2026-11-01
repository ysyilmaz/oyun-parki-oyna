import * as THREE from 'three';
import { PHYS } from './levels.js';
import * as TX from './textures.js';

const COYOTE = 0.14;
const BUFFER = 0.14;
const ONCE = new Set(['Jump', 'Death', 'ThumbsUp', 'Wave', 'Yes', 'No', 'Punch']);

function smoothNormals(g) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const acc = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)}_${Math.round(pos.getY(i) * 1e4)}_${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const v = acc.get(k) || [0, 0, 0];
    v[0] += nor.getX(i);
    v[1] += nor.getY(i);
    v[2] += nor.getZ(i);
    acc.set(k, v);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i));
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    out[i * 3] = v[0] / l;
    out[i * 3 + 1] = v[1] / l;
    out[i * 3 + 2] = v[2] / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

export class Player {
  constructor(scene, gltf) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    scene.add(this.root);
    const model = gltf.scene;
    this.model = model;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const h = box.max.y - box.min.y || 1;
    this.modelScale = 1.8 / h;
    model.scale.setScalar(this.modelScale);
    model.position.y = -box.min.y * this.modelScale;
    this.inner.add(model);
    this.mats = {};
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        const src = Array.isArray(o.material) ? o.material : [o.material];
        const out = src.map((m) => {
          if (!this.mats[m.name]) {
            const c = m.clone();
            c.roughness = m.name === 'Black' ? 0.35 : 0.42;
            c.metalness = m.name === 'Grey' ? 0.35 : 0.08;
            if (m.name === 'Grey') c.color.set(0xd6dde8);
            c.envMapIntensity = 1.1;
            this.addRim(c);
            this.mats[m.name] = c;
          }
          return this.mats[m.name];
        });
        o.material = Array.isArray(o.material) ? out : out[0];
      }
    });
    this.addOutline(model);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(clip.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[clip.name] = a;
    }
    this.cur = null;
    this.emote = null;
    this.mixer.addEventListener('finished', (e) => {
      if (this.emote && e.action === this.actions[this.emote]) this.emote = null;
    });
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.face = Math.PI;
    this.faceTarget = Math.PI;
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airTime = 0;
    this.launched = false;
    this.groundY = 0;
    this.padFlight = false;
    this.dead = false;
    this.frozen = false;
    this.sy = 1;
    this.sv = 0;
    this.stepT = 0;
    this.events = [];
    this.animOverride = null;
    this.color = null;
    this.rainbow = false;
    const blobM = new THREE.MeshBasicMaterial({ map: TX.blob(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0x000000 });
    blobM.color.set(0x10142a);
    const blobG = new THREE.PlaneGeometry(1.5, 1.5);
    blobG.rotateX(-Math.PI / 2);
    this.blob = new THREE.Mesh(blobG, blobM);
    this.blob.renderOrder = 2;
    scene.add(this.blob);
    this.setAnim('Idle', 0);
  }

  addOutline(model) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x141c3a, side: THREE.BackSide });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        '#include <project_vertex>',
        `#ifdef USE_SKINNING
  vec3 oN = objectNormal;
#else
  vec3 oN = normal;
#endif
  vec4 wpo = modelMatrix * vec4(transformed, 1.0);
  wpo.xyz += normalize((modelMatrix * vec4(oN, 0.0)).xyz) * 0.03;
  vec4 mvPosition = viewMatrix * wpo;
  gl_Position = projectionMatrix * mvPosition;`,
      );
    };
    mat.customProgramCacheKey = () => 'outline';
    const hulls = [];
    model.traverse((o) => {
      if (o.isMesh && !o.userData.hull) hulls.push(o);
    });
    for (const o of hulls) {
      const h = o.clone();
      h.geometry = smoothNormals(o.geometry.clone());
      h.material = mat;
      h.castShadow = false;
      h.receiveShadow = false;
      h.frustumCulled = false;
      h.userData.hull = true;
      h.renderOrder = -1;
      o.parent.add(h);
    }
  }

  addRim(m) {
    m.userData.rim = { value: new THREE.Color(0xbfe4ff) };
    m.userData.rimStrength = { value: 0.9 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.rimColor = m.userData.rim;
      sh.uniforms.rimStrength = m.userData.rimStrength;
      sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);\n totalEmissiveRadiance += rimColor * rimF * rimStrength;',
      );
    };
  }

  setRim(color, strength) {
    for (const m of Object.values(this.mats)) {
      m.userData.rim.value.set(color);
      m.userData.rimStrength.value = strength;
    }
  }

  setSkin(skin) {
    const m = this.mats.Main;
    if (!m) return;
    this.rainbow = !!skin.rainbow;
    m.color.set(skin.color || 0xffffff);
    m.metalness = skin.metal ? 0.85 : 0.08;
    m.roughness = skin.metal ? 0.22 : 0.42;
    m.emissive.set(skin.glow || 0x000000);
    m.emissiveIntensity = skin.glow ? 0.6 : 0;
  }

  setAnim(name, fade = 0.18) {
    if (this.cur === name) return;
    const next = this.actions[name];
    if (!next) return;
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    if (this.cur && this.actions[this.cur]) this.actions[this.cur].fadeOut(fade);
    this.cur = name;
  }

  playEmote(name) {
    if (!this.grounded || this.dead || this.frozen) return;
    this.emote = name;
    if (this.cur === name) this.cur = null;
    this.setAnim(name, 0.2);
  }

  spawn(x, y, z, face = Math.PI) {
    this.pos.set(x, y, z);
    this.groundY = y;
    this.vel.set(0, 0, 0);
    this.face = face;
    this.faceTarget = face;
    this.grounded = true;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airTime = 0;
    this.dead = false;
    this.launched = false;
    this.padFlight = false;
    this.emote = null;
    this.sy = 1;
    this.sv = 0;
    this.root.visible = true;
    this.cur = null;
    this.setAnim('Idle', 0.1);
    this.syncVisual();
  }

  push(type, data) {
    this.events.push({ type, data });
  }

  step(dt, input, world, camYaw) {
    if (this.dead || this.frozen) return;
    const p = this.pos;
    const v = this.vel;
    const R = PHYS.radius;
    const H = PHYS.height;
    const gc = this.ground;
    if (gc && gc.active) {
      let rx = p.x - (gc.x - gc.dx);
      let rz = p.z - (gc.z - gc.dz);
      if (gc.dyaw) {
        const cs = Math.cos(gc.dyaw);
        const sn = Math.sin(gc.dyaw);
        const nx = rx * cs + rz * sn;
        const nz = -rx * sn + rz * cs;
        rx = nx;
        rz = nz;
        this.face += gc.dyaw;
        this.faceTarget += gc.dyaw;
      }
      p.x = gc.x + rx;
      p.z = gc.z + rz;
      p.y += gc.dy;
      if (gc.conv) {
        p.x += gc.conv.vx * dt;
        p.z += gc.conv.vz * dt;
      }
    }
    const mv = input.move();
    const sy = Math.sin(camYaw);
    const cy = Math.cos(camYaw);
    const wx = -sy * mv.y + cy * mv.x;
    const wz = -cy * mv.y - sy * mv.x;
    const hasInput = Math.abs(mv.x) + Math.abs(mv.y) > 0.05;
    const ice = this.grounded && gc && gc.surface === 'ice';
    let rate;
    if (this.grounded) rate = ice ? (hasInput ? 2.2 : 0.7) : hasInput ? 14 : 32;
    else rate = hasInput ? 11.2 : this.padFlight ? 0 : 0.8;
    const k = 1 - Math.exp(-rate * dt);
    v.x += (wx * PHYS.run - v.x) * k;
    v.z += (wz * PHYS.run - v.z) * k;
    if (hasInput && this.emote) {
      this.emote = null;
    }
    if (input.takeJump()) {
      this.jumpBuf = BUFFER;
      if (this.emote) this.emote = null;
    }
    this.jumpBuf -= dt;
    if (this.grounded) this.coyote = COYOTE;
    else this.coyote -= dt;
    let jumped = false;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      v.y = PHYS.jump;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.ground = null;
      this.launched = false;
      jumped = true;
      this.sy = 1.22;
      this.sv = 0;
      this.push('jump');
    }
    let gm = 1;
    if (v.y < 0) gm = PHYS.fallMul;
    else if (!input.jumpHeld && !this.launched) gm = 2.4;
    v.y -= PHYS.gravity * gm * dt;
    if (v.y < -32) v.y = -32;
    if (v.y <= 0) this.launched = false;
    const prevFeet = p.y;
    const prevHead = p.y + H;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    const wasGrounded = this.grounded;
    this.grounded = false;
    let newGround = null;
    let landSpeed = 0;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of world.colliders) {
        if (!c.active) continue;
        const top = c.y + c.hy;
        const bot = c.y - c.hy;
        if (p.y >= top || p.y + H <= bot) continue;
        const hit = this.circleHit(c, p.x, p.z, R);
        if (!hit) continue;
        const stepAllow = wasGrounded ? 0.5 : v.y <= 2 ? 0.3 : 0.04;
        if (prevFeet >= top - c.dy - stepAllow - 0.02) {
          if (c.kill) {
            this.push('kill', c);
            return;
          }
          p.y = top;
          if (v.y < 0) landSpeed = Math.max(landSpeed, -v.y);
          if (v.y < 0) v.y = 0;
          this.grounded = true;
          if (!newGround || top > newGround.y + newGround.hy) newGround = c;
        } else if (prevHead <= bot - c.dy + 0.1 && v.y > 0) {
          if (c.kill) {
            this.push('kill', c);
            return;
          }
          p.y = bot - H;
          v.y = 0;
        } else {
          if (c.kill) {
            this.push('kill', c);
            return;
          }
          p.x += hit.nx * hit.d;
          p.z += hit.nz * hit.d;
          const vn = v.x * hit.nx + v.z * hit.nz;
          if (vn < 0) {
            v.x -= hit.nx * vn;
            v.z -= hit.nz * vn;
          }
        }
      }
    }
    if (!this.grounded && wasGrounded && !jumped && v.y <= 0) {
      let best = null;
      for (const c of world.colliders) {
        if (!c.active || c.kill) continue;
        const top = c.y + c.hy;
        if (top > p.y + 0.01 || top < p.y - 0.4) continue;
        if (!this.circleHit(c, p.x, p.z, R * 0.8)) continue;
        if (!best || top > best.y + best.hy) best = c;
      }
      if (best) {
        p.y = best.y + best.hy;
        v.y = 0;
        this.grounded = true;
        newGround = best;
      }
    }
    this.ground = this.grounded ? newGround : null;
    if (this.grounded) {
      const g = this.ground;
      this.groundY = p.y;
      this.padFlight = false;
      if (!wasGrounded) {
        if (g.surface !== 'tramp' && g.surface !== 'pad' && this.airTime > 0.18) {
          this.sy = 0.76;
          this.sv = 0;
          this.push('land', Math.min(1, landSpeed / 20));
        }
      }
      if (g.surface === 'pad') {
        v.y = g.power;
        if (g.target) {
          const up = g.power / PHYS.gravity;
          const drop = Math.max(0.1, (g.power * g.power) / (2 * PHYS.gravity) - (g.target.y - p.y));
          const tf = up + Math.sqrt((2 * drop) / (PHYS.gravity * PHYS.fallMul));
          v.x = (g.target.x - p.x) / tf;
          v.z = (g.target.z - p.z) / tf;
          this.padFlight = true;
        }
        this.launched = true;
        this.grounded = false;
        this.ground = null;
        this.sy = 1.3;
        this.push('pad', g);
      } else if (g.surface === 'tramp' && !wasGrounded) {
        v.y = Math.max(g.power, landSpeed * 0.75) + (input.jumpHeld ? 2.5 : 0);
        this.launched = true;
        this.grounded = false;
        this.ground = null;
        this.sy = 0.7;
        g.squash = 1;
        this.push('tramp', g);
      } else if (g.crumble) world.touchCrumble(g);
      this.airTime = 0;
    } else this.airTime += dt;
    const sp = Math.hypot(v.x, v.z);
    if (sp > 0.6 && (hasInput || !this.grounded)) this.faceTarget = Math.atan2(v.x, v.z);
    if (this.grounded && sp > 3) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = sp > 6 ? 0.27 : 0.36;
        this.push('step');
      }
    }
  }

  circleHit(c, x, z, r) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (c.shape === 'cyl') {
      const d2 = dx * dx + dz * dz;
      const rr = c.r + r;
      if (d2 >= rr * rr) return null;
      const d = Math.sqrt(d2) || 1e-4;
      return { nx: dx / d, nz: dz / d, d: rr - d };
    }
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    const qx = Math.max(-c.hx, Math.min(c.hx, lx));
    const qz = Math.max(-c.hz, Math.min(c.hz, lz));
    let ex = lx - qx;
    let ez = lz - qz;
    const d2 = ex * ex + ez * ez;
    let nlx;
    let nlz;
    let depth;
    if (d2 > 1e-8) {
      if (d2 >= r * r) return null;
      const d = Math.sqrt(d2);
      nlx = ex / d;
      nlz = ez / d;
      depth = r - d;
    } else {
      const px = c.hx - Math.abs(lx);
      const pz = c.hz - Math.abs(lz);
      if (px < pz) {
        nlx = Math.sign(lx) || 1;
        nlz = 0;
        depth = px + r;
      } else {
        nlx = 0;
        nlz = Math.sign(lz) || 1;
        depth = pz + r;
      }
    }
    return { nx: nlx * cs + nlz * sn, nz: -nlx * sn + nlz * cs, d: depth };
  }

  update(dt, world, t) {
    this.sv += (1 - this.sy) * 260 * dt;
    this.sv *= Math.exp(-14 * dt);
    this.sy += this.sv * dt;
    const s = Math.max(0.5, Math.min(1.5, this.sy));
    const xz = 1 / Math.sqrt(s);
    this.inner.scale.set(xz, s, xz);
    let d = this.faceTarget - this.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.face += d * (1 - Math.exp(-14 * dt));
    if (!this.animOverride) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (this.dead) this.setAnim('Death', 0.1);
      else if (!this.grounded && this.airTime > 0.06) {
        if (this.cur !== 'Jump') {
          this.setAnim('Jump', 0.08);
          const a = this.actions.Jump;
          if (a) {
            a.time = 0.18;
            a.timeScale = 1.25;
          }
        }
      } else if (this.emote) this.setAnim(this.emote, 0.2);
      else if (sp < 0.5) this.setAnim('Idle', 0.2);
      else if (sp < 5) {
        this.setAnim('Walking', 0.2);
        this.actions.Walking.timeScale = Math.max(0.6, sp / 3.2);
      } else {
        this.setAnim('Running', 0.15);
        this.actions.Running.timeScale = Math.max(0.8, sp / 7.2);
      }
    } else this.setAnim(this.animOverride, 0.25);
    this.mixer.update(dt);
    if (this.rainbow && this.mats.Main) {
      this.mats.Main.color.setHSL((t * 0.25) % 1, 0.9, 0.55);
      this.mats.Main.emissive.setHSL((t * 0.25) % 1, 0.9, 0.3);
      this.mats.Main.emissiveIntensity = 0.5;
    }
    this.syncVisual();
    if (world) {
      const gy = world.groundBelow(this.pos.x, this.pos.z, this.pos.y + 0.05, 0.05);
      if (gy > -Infinity && this.root.visible) {
        const h = this.pos.y - gy;
        this.blob.visible = true;
        this.blob.position.set(this.pos.x, gy + 0.03, this.pos.z);
        const sc = Math.max(0.45, 1 - h * 0.05);
        this.blob.scale.setScalar(sc);
        this.blob.material.opacity = Math.max(0.35, 0.95 - h * 0.035);
      } else this.blob.visible = false;
    }
  }

  syncVisual() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.face;
  }
}
