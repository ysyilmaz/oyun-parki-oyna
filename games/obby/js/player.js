import * as THREE from 'three';
import { PHYS, FULL_HELP } from './levels.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';

const COYOTE = 0.14;
const BUFFER = 0.14;
const CLIMB = 0.16;
const SETTLE = 0.6;

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

const LIMBS = ['armL', 'armR', 'legL', 'legR'];
const ONCE = { Wave: 1.6, ThumbsUp: 1.3, Yes: 1.1 };

function blankPose() {
  return { bob: 0, tilt: 0, twist: 0, roll: 0, hx: 0, hy: 0, hz: 0, armL: [0, 0.12], armR: [0, -0.12], legL: [0, 0], legR: [0, 0] };
}

function lerpPose(a, b, k, out) {
  for (const key of ['bob', 'tilt', 'twist', 'roll', 'hx', 'hy', 'hz']) out[key] = a[key] + (b[key] - a[key]) * k;
  for (const key of LIMBS) {
    out[key][0] = a[key][0] + (b[key][0] - a[key][0]) * k;
    out[key][1] = a[key][1] + (b[key][1] - a[key][1]) * k;
  }
  return out;
}

const POSES = {
  Idle(t, o) {
    const b = Math.sin(t * 2.4);
    o.bob = b * 0.012;
    o.hx = Math.sin(t * 1.1) * 0.04;
    o.hz = Math.sin(t * 0.7) * 0.05;
    o.armL = [Math.sin(t * 2.4) * 0.05, 0.14 + b * 0.03];
    o.armR = [-Math.sin(t * 2.4) * 0.05, -0.14 - b * 0.03];
  },
  Walking(t, o) {
    const s = Math.sin(t * 9);
    o.bob = Math.abs(Math.cos(t * 9)) * 0.05;
    o.tilt = 0.06;
    o.twist = s * 0.08;
    o.legL = [s * 0.65, 0];
    o.legR = [-s * 0.65, 0];
    o.armL = [-s * 0.6, 0.16];
    o.armR = [s * 0.6, -0.16];
  },
  Running(t, o) {
    const s = Math.sin(t * 12);
    o.bob = Math.abs(Math.cos(t * 12)) * 0.09;
    o.tilt = 0.2;
    o.twist = s * 0.12;
    o.hx = -0.12;
    o.legL = [s * 0.95, 0];
    o.legR = [-s * 0.95, 0];
    o.armL = [-s * 1.05, 0.28];
    o.armR = [s * 1.05, -0.28];
  },
  Jump(t, o) {
    const k = Math.min(1, t * 6);
    o.tilt = -0.05 * k;
    o.hx = -0.1 * k;
    o.armL = [-0.3 * k, 0.12 + 2.1 * k];
    o.armR = [-0.3 * k, -0.12 - 2.1 * k];
    o.legL = [-0.7 * k, 0];
    o.legR = [0.35 * k, 0];
  },
  Climb(t, o) {
    const k = Math.min(1, t * 8);
    o.tilt = 0.35 * k;
    o.hx = -0.15 * k;
    o.armL = [-2.6 * k, 0.2];
    o.armR = [-2.6 * k, -0.2];
    o.legL = [-1.1 * k, 0];
    o.legR = [-0.3 * k, 0];
  },
  Death(t, o) {
    const k = Math.min(1, t * 5);
    o.tilt = -0.5 * k;
    o.hx = -0.3 * k;
    o.armL = [-0.4, 0.12 + 1.6 * k];
    o.armR = [-0.4, -0.12 - 1.6 * k];
    o.legL = [-0.5 * k, 0.2 * k];
    o.legR = [-0.2 * k, -0.2 * k];
  },
  Dance(t, o) {
    const a = Math.sin(t * 8);
    const c = Math.sin(t * 4);
    o.bob = Math.abs(a) * 0.08;
    o.twist = c * 0.4;
    o.roll = c * 0.08;
    o.hz = -c * 0.18;
    o.armL = [-0.3, 0.9 + a * 0.9];
    o.armR = [-0.3, -0.9 + a * 0.9];
    o.legL = [Math.max(0, a) * -0.5, 0.1];
    o.legR = [Math.max(0, -a) * -0.5, -0.1];
  },
  Wave(t, o) {
    POSES.Idle(t, o);
    const k = Math.min(1, t * 5) * Math.min(1, (1.6 - t) * 5);
    o.armR = [-0.2 * k, -0.14 - (2.5 + Math.sin(t * 13) * 0.35) * k];
    o.roll = 0.06 * k;
    o.hz = 0.12 * k;
  },
  ThumbsUp(t, o) {
    POSES.Idle(t, o);
    const k = Math.min(1, t * 6) * Math.min(1, (1.3 - t) * 5);
    o.armR = [-1.45 * k, -0.14 - 0.25 * k];
    o.tilt = -0.08 * k;
    o.hx = -0.12 * k;
    o.bob += Math.abs(Math.sin(t * 6)) * 0.03 * k;
  },
  Yes(t, o) {
    POSES.Idle(t, o);
    const k = Math.max(0, Math.min(1, (1.1 - t) * 5));
    o.hx = Math.sin(t * 11) * 0.28 * k;
    o.bob = Math.abs(Math.sin(t * 11)) * 0.03 * k;
  },
};

const ACC = {
  cap(grp, mat, part) {
    const g = grp('head');
    const blue = mat(0x2f5fe8);
    const dome = part(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, 0.62, 0, g);
    dome.scale.set(1, 0.55, 0.95);
    part(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), mat(0xffffff), 0, 0.62, 0.3, g).scale.set(1.1, 1, 1.2);
    part(new THREE.SphereGeometry(0.05, 10, 8), mat(0xffffff), 0, 0.87, 0, g);
  },
  phones(grp, mat, part) {
    const g = grp('head');
    const band = part(new THREE.TorusGeometry(0.46, 0.045, 8, 28, Math.PI), mat(0x1b2340), 0, 0.4, 0, g);
    band.rotation.y = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const cup = part(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 22), mat(0x35e0ff, { emissive: 0x0a6a8a, emissiveIntensity: 0.4 }), sx * 0.45, 0.36, 0, g);
      cup.rotation.z = Math.PI / 2;
    }
  },
  propeller(grp, mat, part) {
    const g = grp('head');
    const dome = part(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffc21a), 0, 0.64, 0, g);
    dome.scale.set(1, 0.45, 1);
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), mat(0xffc21a), 0, 0.88, 0, g);
    const spin = new THREE.Group();
    spin.name = 'spin';
    spin.position.y = 0.97;
    g.add(spin);
    for (const [c, a] of [[0xff3d4f, 0], [0x2f8cff, Math.PI]]) {
      const b = part(new THREE.BoxGeometry(0.34, 0.025, 0.1), mat(c), Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17, spin);
      b.rotation.x = 0.25;
    }
  },
  ears(grp, mat, part) {
    const g = grp('head');
    for (const sx of [-1, 1]) {
      const e = part(new THREE.ConeGeometry(0.15, 0.3, 4), mat(0x9a55ff), sx * 0.24, 0.8, 0, g);
      e.rotation.set(0, Math.PI / 4, sx * -0.25);
      const inner = part(new THREE.ConeGeometry(0.08, 0.17, 4), mat(0xff9fd8), sx * 0.24, 0.79, 0.07, g);
      inner.rotation.set(0.1, Math.PI / 4, sx * -0.25);
    }
  },
  bow(grp, mat, part) {
    const g = grp('head');
    const pink = mat(0xff4fb0);
    for (const sx of [-1, 1]) {
      const w = part(new THREE.ConeGeometry(0.14, 0.26, 16), pink, sx * 0.14, 0.76, 0.1, g);
      w.rotation.z = sx * Math.PI / 2;
    }
    part(new THREE.SphereGeometry(0.075, 12, 10), pink, 0, 0.76, 0.1, g);
  },
  band(grp, mat, part) {
    const g = grp('head');
    const red = mat(0xe8283c);
    part(rbox(0.84, 0.1, 0.76, 0.05), red, 0, 0.58, 0, g);
    for (const [ry, dy] of [[0.5, 0.02], [-0.4, -0.08]]) {
      const tail = part(rbox(0.07, 0.3, 0.05, 0.02), red, 0, 0.5 + dy, -0.42, g);
      tail.rotation.set(0.5, 0, ry);
    }
  },
  astro(grp, mat, part) {
    const g = grp('head');
    const glass = part(new THREE.SphereGeometry(0.66, 28, 18), mat(0xbfe8ff, { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }), 0, 0.36, 0.02, g);
    glass.castShadow = false;
    glass.userData.noHull = true;
    const collar = part(new THREE.TorusGeometry(0.46, 0.09, 10, 28), mat(0xffffff), 0, -0.04, 0, g);
    collar.rotation.x = Math.PI / 2;
    const b = grp('body');
    part(rbox(0.5, 0.5, 0.24, 0.08), mat(0xffffff), 0, 0.3, -0.34, b);
    part(new THREE.SphereGeometry(0.06, 10, 8), mat(0xff3d4f, { emissive: 0xff2030, emissiveIntensity: 0.8 }), 0.14, 0.44, -0.47, b).userData.noHull = true;
  },
  crown(grp, mat, part) {
    const g = grp('head');
    const gold = mat(0xffc21a, { metalness: 0.8, roughness: 0.25, emissive: 0x6a4000, emissiveIntensity: 0.3 });
    part(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 24, 1, true), gold, 0, 0.74, 0, g).material.side = THREE.DoubleSide;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      part(new THREE.ConeGeometry(0.07, 0.18, 4), gold, Math.sin(a) * 0.3, 0.88, Math.cos(a) * 0.3, g);
    }
    part(new THREE.SphereGeometry(0.06, 10, 8), mat(0xff3d4f, { emissive: 0xff0020, emissiveIntensity: 0.5 }), 0, 0.74, 0.31, g);
  },
  explorer(grp, mat, part) {
    const g = grp('head');
    const khaki = mat(0xd8c89a, { roughness: 0.7 });
    const brim = part(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 28), khaki, 0, 0.62, 0, g);
    brim.scale.set(1, 1, 0.92);
    const dome = part(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), khaki, 0, 0.62, 0, g);
    dome.scale.set(1, 0.62, 0.95);
    part(new THREE.CylinderGeometry(0.405, 0.405, 0.08, 28, 1, true), mat(0x5a4a2a), 0, 0.67, 0, g).material.side = THREE.DoubleSide;
  },
  pilot(grp, mat, part) {
    const g = grp('head');
    const leather = mat(0x7a4a2a, { roughness: 0.6 });
    const cap = part(new THREE.SphereGeometry(0.47, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), leather, 0, 0.5, -0.02, g);
    cap.scale.set(1, 0.7, 1);
    const lens = mat(0x9fe8ff, { metalness: 0.4, roughness: 0.1, emissive: 0x1a4a6a, emissiveIntensity: 0.4 });
    for (const sx of [-1, 1]) {
      const rim = part(new THREE.TorusGeometry(0.11, 0.035, 8, 18), mat(0xb8c0cc, { metalness: 0.7, roughness: 0.3 }), sx * 0.15, 0.66, 0.36, g);
      rim.rotation.x = -0.35;
      const gl = part(new THREE.CircleGeometry(0.1, 18), lens, sx * 0.15, 0.66, 0.37, g);
      gl.rotation.x = -0.35;
    }
    const b = grp('body');
    const scarf = mat(0xf2f4f8, { roughness: 0.8 });
    const ring = part(new THREE.TorusGeometry(0.3, 0.08, 8, 22), scarf, 0, 0.62, 0, b);
    ring.rotation.x = Math.PI / 2;
    const tail = part(rbox(0.16, 0.42, 0.05, 0.02), scarf, 0.12, 0.46, -0.3, b);
    tail.rotation.set(0.4, 0, -0.3);
  },
  windup(grp, mat, part) {
    const b = grp('body');
    const brass = mat(0xc8a050, { metalness: 0.75, roughness: 0.3 });
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), brass, 0, 0.36, -0.42, b).rotation.x = Math.PI / 2;
    const spin = new THREE.Group();
    spin.name = 'spin';
    spin.position.set(0, 0.36, -0.58);
    spin.rotation.x = Math.PI / 2;
    b.add(spin);
    for (const sx of [-1, 1]) {
      const loop = part(new THREE.TorusGeometry(0.11, 0.035, 8, 18), brass, sx * 0.13, 0, 0, spin);
      loop.rotation.x = Math.PI / 2;
    }
  },
  jet(grp, mat, part) {
    const g = grp('body');
    const grey = mat(0xd6dde8, { metalness: 0.6, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      part(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 16), grey, sx * 0.14, 0.3, -0.32, g);
      part(new THREE.ConeGeometry(0.11, 0.14, 16), mat(0xff3d4f), sx * 0.14, 0.58, -0.32, g);
      const fl = part(new THREE.ConeGeometry(0.08, 0.26, 12), mat(0xffb000, { emissive: 0xff7a00, emissiveIntensity: 1.6 }), sx * 0.14, -0.04, -0.32, g);
      fl.rotation.x = Math.PI;
      fl.userData.noHull = true;
    }
  },
};

function rbox(w, h, d, r) {
  return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    scene.add(this.root);
    this.hurtU = { value: 0 };
    this.hurtT = 0;
    this.mats = {
      Main: new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.42, metalness: 0.08 }),
      Grey: new THREE.MeshStandardMaterial({ color: 0xe4e9f2, roughness: 0.38, metalness: 0.3 }),
      Black: new THREE.MeshStandardMaterial({ color: 0x1b2340, roughness: 0.18, metalness: 0.35 }),
    };
    for (const m of Object.values(this.mats)) {
      m.envMapIntensity = 1.1;
      this.addRim(m);
    }
    this.eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8ff8ff).multiplyScalar(1.6) });
    this.tipM = new THREE.MeshStandardMaterial({ color: 0xffd22e, emissive: 0xffb000, emissiveIntensity: 1.2, roughness: 0.3 });
    this.model = this.buildChibi();
    this.inner.add(this.model);
    this.addOutline(this.model);
    this.pose = blankPose();
    this.prevPose = blankPose();
    this.animT = 0;
    this.fadeT = 1;
    this.fadeDur = 0;
    this.animRate = 1;
    this.blinkT = 2;
    this.cur = null;
    this.emote = null;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.climbOff = new THREE.Vector3();
    this.climbT = 0;
    this.face = Math.PI;
    this.faceTarget = Math.PI;
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airTime = 0;
    this.launched = false;
    this.groundY = 0;
    this.walked = false;
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

  part(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  buildChibi() {
    const { Main, Grey, Black } = this.mats;
    const model = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.5;
    model.add(hips);
    const body = new THREE.Group();
    hips.add(body);
    this.part(rbox(0.64, 0.52, 0.46, 0.17), Main, 0, 0.26, 0, body);
    this.part(rbox(0.36, 0.24, 0.08, 0.04), Grey, 0, 0.25, 0.21, body);
    this.part(new THREE.SphereGeometry(0.045, 12, 8), this.tipM, 0, 0.27, 0.255, body).userData.noHull = true;
    this.part(rbox(0.68, 0.1, 0.5, 0.05), Grey, 0, 0.03, 0, body);
    const head = new THREE.Group();
    head.position.y = 0.5;
    body.add(head);
    this.part(rbox(0.8, 0.68, 0.72, 0.24), Main, 0, 0.36, 0, head);
    this.part(rbox(0.62, 0.4, 0.1, 0.13), Black, 0, 0.35, 0.33, head);
    const eyeG = new THREE.SphereGeometry(1, 16, 12);
    const earG = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = this.part(eyeG, this.eyeM, sx * 0.13, 0.38, 0.385, head);
      e.scale.set(0.07, 0.095, 0.03);
      e.castShadow = false;
      e.userData.noHull = true;
      this.eyes.push(e);
      this.part(earG, Grey, sx * 0.43, 0.36, 0, head).rotation.z = Math.PI / 2;
    }
    const smile = this.part(new THREE.TorusGeometry(0.07, 0.016, 6, 16, Math.PI), this.eyeM, 0, 0.27, 0.385, head);
    smile.rotation.z = Math.PI;
    smile.castShadow = false;
    smile.userData.noHull = true;
    this.antenna = new THREE.Group();
    head.add(this.antenna);
    this.part(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 8), Grey, 0, 0.78, 0, this.antenna);
    this.part(new THREE.SphereGeometry(0.075, 14, 10), this.tipM, 0, 0.9, 0, this.antenna).userData.noHull = true;
    const limb = (x, y, isArm) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      if (isArm) {
        this.part(rbox(0.17, 0.34, 0.19, 0.07), Main, 0, -0.16, 0, pivot);
        this.part(new THREE.SphereGeometry(0.1, 16, 12), Grey, 0, -0.36, 0.01, pivot);
      } else {
        this.part(rbox(0.21, 0.36, 0.24, 0.08), Grey, 0, -0.17, 0, pivot);
        this.part(rbox(0.25, 0.15, 0.34, 0.07), Black, 0, -0.43, 0.04, pivot);
      }
      return pivot;
    };
    const armL = limb(0.4, 0.43, true);
    const armR = limb(-0.4, 0.43, true);
    body.add(armL, armR);
    const legL = limb(0.15, 0, false);
    const legR = limb(-0.15, 0, false);
    hips.add(legL, legR);
    this.rig = { hips, body, head, armL, armR, legL, legR };
    model.traverse((o) => {
      if (o.isMesh) {
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    return model;
  }

  addOutline(model) {
    const mat = this.outlineMat || new THREE.MeshBasicMaterial({ color: 0x141c3a, side: THREE.BackSide });
    this.outlineMat = mat;
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
      if (o.isMesh && !o.userData.hull && !o.userData.noHull) hulls.push(o);
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
      sh.uniforms.hurtK = this.hurtU;
      sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float hurtK;\n' + sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n float rimF = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);\n totalEmissiveRadiance += rimColor * rimF * rimStrength * (1.0 - hurtK) + vec3(0.32, 0.02, 0.0) * hurtK;\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.08, 0.06), hurtK * 0.6);',
      );
    };
  }

  hurt() {
    this.hurtT = 0.4;
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
    this.setAccessory(skin.acc || null);
  }

  setAccessory(id) {
    if (this.accId === id) return;
    this.accId = id;
    for (const g of this.acc || []) {
      g.parent.remove(g);
      g.traverse((o) => {
        if (o.isMesh && !o.userData.shared) o.geometry.dispose();
      });
    }
    this.acc = [];
    this.accSpin = [];
    this.antenna.visible = !['cap', 'propeller', 'crown'].includes(id);
    if (!id || !ACC[id]) return;
    const r = this.rig;
    const mk = (parent) => {
      const g = new THREE.Group();
      parent.add(g);
      this.acc.push(g);
      return g;
    };
    ACC[id]((parent) => mk(parent === 'body' ? r.body : r.head), this.accMat.bind(this), (geo, mat, x, y, z, parent) => this.part(geo, mat, x, y, z, parent));
    for (const g of this.acc) this.addOutline(g);
    this.accSpin = this.acc.map((g) => g.getObjectByName('spin')).filter(Boolean);
  }

  accMat(color, o = {}) {
    this.accMats = this.accMats || {};
    const key = color + JSON.stringify(o);
    if (!this.accMats[key]) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, ...o });
      this.addRim(m);
      this.accMats[key] = m;
      this.mats['acc' + Object.keys(this.accMats).length] = m;
    }
    return this.accMats[key];
  }

  setAnim(name, fade = 0.18) {
    if (this.cur === name) return;
    if (!POSES[name]) return;
    lerpPose(this.pose, this.pose, 0, this.prevPose);
    this.fadeDur = fade;
    this.fadeT = 0;
    this.animT = 0;
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
    this.liftFlight = false;
    this.settleT = 0;
    this.emote = null;
    this.sy = 1;
    this.sv = 0;
    this.climbT = 0;
    this.climbOff.set(0, 0, 0);
    this.root.visible = true;
    this.cur = null;
    this.setAnim('Idle', 0.1);
    this.syncVisual();
  }

  push(type, data) {
    this.events.push({ type, data });
  }

  startClimb(dx, dy, dz) {
    const k = this.climbT / CLIMB;
    this.climbOff.multiplyScalar(k * k).add({ x: dx, y: dy, z: dz });
    this.climbT = CLIMB;
  }

  step(dt, input, world, camYaw) {
    if (this.dead || this.frozen) return;
    const p = this.pos;
    const v = this.vel;
    const R = PHYS.radius;
    const H = PHYS.height;
    const help = world.help || FULL_HELP;
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
    let mv = input.move();
    if (this.settleT > 0) {
      this.settleT -= dt;
      mv = { x: 0, y: 0 };
    }
    const side = mv.x * (Math.abs(mv.y) > 0.1 ? (this.grounded ? 0.5 : (world.def && world.def.airSide) || 0.5) : 0.65);
    const sy = Math.sin(camYaw);
    const cy = Math.cos(camYaw);
    const wx = -sy * mv.y + cy * side;
    const wz = -cy * mv.y - sy * side;
    const hasInput = Math.abs(mv.x) + Math.abs(mv.y) > 0.05;
    const ice = this.grounded && gc && gc.surface === 'ice';
    let rate;
    let tx = wx * PHYS.run;
    let tz = wz * PHYS.run;
    if (this.grounded) rate = ice ? (hasInput ? 2.2 : 0.7) : hasInput ? 14 : 32;
    else if (this.padFlight) {
      rate = 11.2;
      const steer = this.liftFlight ? 0 : 1.5;
      tx = this.aim.x + wx * steer;
      tz = this.aim.z + wz * steer;
    } else rate = hasInput ? 11.2 : 0.8;
    const k = 1 - Math.exp(-rate * dt);
    v.x += (tx - v.x) * k;
    v.z += (tz - v.z) * k;
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
    const near = this.jumpBuf > 0 && this.grounded && this.ground && this.ground.surface !== 'pad' && world.padNear ? world.padNear(p.x, p.y, p.z) : null;
    if (near) {
      p.y = Math.max(p.y, near.y + near.hy);
      v.y = near.power;
      if (near.target) this.aimAt(near.target);
      this.launched = true;
      this.grounded = false;
      this.ground = null;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.sy = 1.3;
      jumped = true;
      this.push('pad', near);
    } else if (this.jumpBuf > 0 && this.coyote > 0) {
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
      if (gc && gc.swing && gc.active && dt > 0) {
        v.x += gc.dx / dt;
        v.z += gc.dz / dt;
      }
      if (gc && gc.surface !== 'tramp' && hasInput) this.aimFlush(world, wx, wz);
    }
    let gm = 1;
    if (v.y < 0) gm = PHYS.fallMul;
    else if (!input.jumpHeld && !this.launched) gm = 2.4;
    v.y -= PHYS.gravity * gm * dt;
    if (v.y < -32) v.y = -32;
    if (world.wind) world.wind.act(this, dt, hasInput, PHYS.gravity * gm * dt);
    if (v.y <= 0) this.launched = false;
    const prevFeet = p.y;
    const prevHead = p.y + H;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    if (gc && gc.guard && gc.active && !jumped) {
      const lo = gc.z - gc.hz + 0.15;
      const hi = gc.z + gc.hz - 0.15;
      if (gc.open !== -1 && p.z < lo) {
        p.z = lo;
        if (v.z < 0) v.z = 0;
      }
      if (gc.open !== 1 && p.z > hi) {
        p.z = hi;
        if (v.z > 0) v.z = 0;
      }
    }
    if (!gc && v.y <= 0) {
      for (const c of world.colliders) {
        if (!c.guard || !c.active) continue;
        const top = c.y + c.hy;
        if (prevFeet < top - 0.05 || p.y > top + 0.6 || Math.abs(p.x - c.x) > c.hx) continue;
        const lo = c.z - c.hz + 0.15;
        const hi = c.z + c.hz - 0.15;
        if (c.open !== -1 && p.z < lo && p.z > lo - 1.5) {
          p.z = lo;
          if (v.z < 0) v.z = 0;
        }
        if (c.open !== 1 && p.z > hi && p.z < hi + 1.5) {
          p.z = hi;
          if (v.z > 0) v.z = 0;
        }
      }
    }
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
          if (!wasGrounded && help.ledge > 0 && v.y <= 2 && c.style !== 'curb' && prevFeet >= top - c.dy - help.ledge && v.x * hit.nx + v.z * hit.nz < -0.5) {
            const inward = Math.max(0, R - hit.d + 0.2);
            const ox = p.x;
            const oy = p.y;
            const oz = p.z;
            p.x -= hit.nx * inward;
            p.z -= hit.nz * inward;
            p.y = top;
            this.startClimb(ox - p.x, oy - p.y, oz - p.z);
            if (v.y < 0) landSpeed = Math.max(landSpeed, -v.y);
            v.y = 0;
            this.grounded = true;
            this.push('ledge');
            if (!newGround || top > newGround.y + newGround.hy) newGround = c;
            continue;
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
    if (!this.grounded && !wasGrounded && v.y < 0 && hasInput && help.reach > 0) {
      const hs = Math.hypot(v.x, v.z);
      if (hs > 1) {
        const ux = v.x / hs;
        const uz = v.z / hs;
        for (const c of world.colliders) {
          if (!c.active || c.kill || c.style === 'curb') continue;
          const top = c.y + c.hy;
          if (top <= p.y || top > p.y + help.ledge) continue;
          const hit = this.circleHit(c, p.x + ux * help.reach, p.z + uz * help.reach, R);
          if (!hit || ux * hit.nx + uz * hit.nz > -0.5) continue;
          const inward = Math.max(0, R - hit.d + 0.2) + help.reach;
          const ox = p.x;
          const oy = p.y;
          const oz = p.z;
          p.x -= hit.nx * inward;
          p.z -= hit.nz * inward;
          p.y = top;
          this.startClimb(ox - p.x, oy - p.y, oz - p.z);
          landSpeed = Math.max(landSpeed, -v.y);
          v.y = 0;
          this.grounded = true;
          newGround = c;
          this.push('ledge');
          break;
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
      } else if (!hasInput && !ice && gc && gc.active && !gc.move && !gc.spin && !gc.conv) {
        p.x -= v.x * dt;
        p.z -= v.z * dt;
        p.y = prevFeet;
        v.set(0, 0, 0);
        this.grounded = true;
        newGround = gc;
      }
    }
    this.ground = this.grounded ? newGround : null;
    if (this.grounded) {
      const g = this.ground;
      this.groundY = p.y;
      this.padFlight = false;
      if (this.liftFlight) {
        this.liftFlight = false;
        this.settleT = SETTLE;
      }
      if (!wasGrounded) {
        if (g.surface !== 'tramp' && g.surface !== 'pad' && this.airTime > 0.18) {
          this.sy = 0.76;
          this.sv = 0;
          this.push('land', Math.min(1, landSpeed / 20));
        }
      }
      if (g.surface === 'pad') {
        v.y = g.power;
        if (g.target) this.aimAt(g.target);
        this.launched = true;
        this.grounded = false;
        this.ground = null;
        this.sy = 1.3;
        this.push('pad', g);
      } else if (g.surface === 'tramp' && (!wasGrounded || gc !== g)) {
        v.y = Math.max(g.power, landSpeed * 0.75) + (input.jumpHeld ? 2.5 : 0);
        if (g.target && (!g.targetCol || g.targetCol.active) && (!hasInput || wx * (g.target.x - p.x) + wz * (g.target.z - p.z) > 0)) this.aimAt(g.target);
        this.launched = true;
        this.grounded = false;
        this.ground = null;
        this.sy = 0.7;
        g.squash = 1;
        this.push('tramp', g);
      } else if (g.crumble) world.touchCrumble(g);
      this.airTime = 0;
      this.walked = true;
    } else {
      this.airTime += dt;
      if (v.y > 1) this.walked = false;
    }
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

  aimFlush(world, wx, wz) {
    const p = this.pos;
    for (const c of world.colliders) {
      if (c.surface !== 'tramp' || !c.active || c.shape !== 'cyl') continue;
      const top = c.y + c.hy;
      if (top > p.y + 0.1 || top < p.y - 0.4) continue;
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      if (Math.hypot(dx, dz) - c.r > 1.5 || wx * dx + wz * dz <= 0) continue;
      this.aimAt({ x: c.x, y: top, z: c.z });
      this.launched = true;
      return;
    }
  }

  aimAt(target) {
    const p = this.pos;
    const v = this.vel;
    const up = v.y / PHYS.gravity;
    const drop = Math.max(0.1, (v.y * v.y) / (2 * PHYS.gravity) - (target.y - p.y));
    const tf = up + Math.sqrt((2 * drop) / (PHYS.gravity * PHYS.fallMul));
    this.aim = { x: (target.x - p.x) / tf, z: (target.z - p.z) / tf, target };
    v.x = this.aim.x;
    v.z = this.aim.z;
    this.padFlight = true;
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
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);
    this.hurtU.value = this.hurtT > 0 ? Math.sin((this.hurtT / 0.4) * Math.PI) : 0;
    this.sv += (1 - this.sy) * 260 * dt;
    this.sv *= Math.exp(-14 * dt);
    this.sy += this.sv * dt;
    const s = Math.max(0.5, Math.min(1.5, this.sy));
    const xz = 1 / Math.sqrt(s);
    this.inner.scale.set(xz, s, xz);
    let d = this.faceTarget - this.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.face += d * (1 - Math.exp(-14 * dt));
    this.animRate = 1;
    if (this.climbT > 0) {
      this.climbT = Math.max(0, this.climbT - dt);
      if (this.climbT === 0) {
        this.climbOff.set(0, 0, 0);
        this.sy = 0.86;
        this.sv = 0;
      }
    }
    if (!this.animOverride) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (this.dead) this.setAnim('Death', 0.1);
      else if (this.climbT > 0) this.setAnim('Climb', 0.04);
      else if (!this.grounded && this.airTime > 0.06) this.setAnim('Jump', 0.08);
      else if (this.emote) this.setAnim(this.emote, 0.2);
      else if (sp < 0.5) this.setAnim('Idle', 0.2);
      else if (sp < 5) {
        this.setAnim('Walking', 0.2);
        this.animRate = Math.max(0.6, sp / 3.2);
      } else {
        this.setAnim('Running', 0.15);
        this.animRate = Math.max(0.8, sp / 7.2);
      }
    } else this.setAnim(this.animOverride, 0.25);
    this.animate(dt);
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

  animate(dt) {
    this.animT += dt * this.animRate;
    const dur = ONCE[this.cur];
    if (dur && this.animT >= dur) {
      if (this.emote === this.cur) this.emote = null;
      if (this.animOverride === this.cur) this.animOverride = 'Idle';
    }
    const tp = blankPose();
    POSES[this.cur](dur ? Math.min(this.animT, dur) : this.animT, tp);
    this.fadeT += dt;
    const k = this.fadeDur > 0 ? Math.min(1, this.fadeT / this.fadeDur) : 1;
    lerpPose(this.prevPose, tp, k * k * (3 - 2 * k), this.pose);
    const p = this.pose;
    const r = this.rig;
    r.hips.position.y = 0.5 + p.bob;
    r.body.rotation.set(p.tilt, p.twist, p.roll);
    r.head.rotation.set(p.hx, p.hy, p.hz);
    for (const key of LIMBS) r[key].rotation.set(p[key][0], 0, p[key][1]);
    if (this.accSpin) for (const sp of this.accSpin) sp.rotation.y += dt * (6 + Math.hypot(this.vel.x, this.vel.z) * 2);
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 && this.blinkT > 0;
    if (this.blinkT <= 0) this.blinkT = 2.2 + Math.random() * 2.5;
    for (const e of this.eyes) e.scale.y = blink ? 0.015 : 0.095;
  }

  syncVisual() {
    this.root.position.copy(this.pos);
    if (this.climbT > 0) {
      const k = this.climbT / CLIMB;
      this.root.position.addScaledVector(this.climbOff, k * k);
    }
    this.root.rotation.y = this.face;
  }
}
