import * as THREE from 'three';
import { M, part, merge, rbox, vcMat, vcGlow, vcMetal, instanced, shadeY } from './geo.js';
import { H, ROOM, FRONT_DOOR, ELEV, SHOP } from './layout.js';
import { plazaTex, brickTex, grassTex, neonText, logoTex, windowTex, glowTex, floorNumberTex, ringTex, beamTex } from './textures.js';
import { rng } from './util.js';

const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const CYL = (a, b, h, s = 16) => new THREE.CylinderGeometry(a, b, h, s);

export function makeSky(scene) {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color('#2f7cff') }, mid: { value: new THREE.Color('#8fd0ff') }, hor: { value: new THREE.Color('#ffe2c4') }, sunDir: { value: new THREE.Vector3(0.5, 0.35, -0.6).normalize() } },
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vW;
      void main(){ float h = vW.y; vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
      float s = max(dot(normalize(vW), sunDir), 0.0); c += vec3(1.0,0.85,0.6) * pow(s, 60.0) * 1.2 + vec3(1.0,0.8,0.6) * pow(s, 6.0) * 0.18;
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  const cloudMat = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, color: new THREE.Color(1.05, 1.05, 1.1), fog: false });
  const r = rng(11);
  const clouds = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = 300 + r() * 220;
    const cg = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.85, fog: false }));
      const sc = 40 + r() * 50;
      s.scale.set(sc * 1.6, sc, 1);
      s.position.set((k - 2) * 28 + r() * 10, r() * 12, r() * 10);
      cg.add(s);
    }
    cg.position.set(Math.cos(a) * d, 90 + r() * 90, Math.sin(a) * d);
    clouds.add(cg);
  }
  scene.add(clouds);
  return { sky, clouds };
}

export function makeGround(scene) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 0.95 }));
  grass.material.map.repeat.set(140, 140);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(116, 84), new THREE.MeshStandardMaterial({ map: plazaTex(), roughness: 0.85 }));
  plaza.material.map.repeat.set(29, 21);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(8, 0, 2);
  plaza.receiveShadow = true;
  scene.add(plaza);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.85 }));
  walk.material.map.wrapS = walk.material.map.wrapT = THREE.RepeatWrapping;
  walk.material.map.repeat.set(7, 5);
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(30, 0.006, 1);
  walk.receiveShadow = true;
  scene.add(walk);
  const curb = merge([
    part(new THREE.BoxGeometry(117, 0.2, 0.6), '#f4f1ea', M(8, 0.1, 44)),
    part(new THREE.BoxGeometry(117, 0.2, 0.6), '#f4f1ea', M(8, 0.1, -40)),
    part(new THREE.BoxGeometry(0.6, 0.2, 84), '#f4f1ea', M(-50, 0.1, 2)),
    part(new THREE.BoxGeometry(0.6, 0.2, 84), '#f4f1ea', M(66, 0.1, 2)),
  ]);
  scene.add(new THREE.Mesh(curb, vcMat));
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 12), new THREE.MeshStandardMaterial({ color: '#4a4f5e', roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.005, 51);
  road.receiveShadow = true;
  scene.add(road);
  const dashes = [];
  for (let x = -190; x < 190; x += 8) dashes.push(part(new THREE.PlaneGeometry(4, 0.3), '#ffffff', M(x, 0.01, 51, -Math.PI / 2, 0, 0)));
  scene.add(new THREE.Mesh(merge(dashes), new THREE.MeshBasicMaterial({ vertexColors: true })));
  const r = rng(5);
  const trees = [];
  const treeCols = [];
  const spots = [];
  for (let x = -46; x <= 62; x += 7) {
    spots.push([x, -37 + r() * 1.5]);
    spots.push([x + 3, 41 + r() * 1.5]);
  }
  for (let z = -30; z <= 36; z += 7) {
    spots.push([-47 + r(), z]);
    spots.push([63 + r(), z + 3]);
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 75 + r() * 60;
    spots.push([Math.cos(a) * d + 8, Math.sin(a) * d]);
  }
  for (const [x, z] of spots) {
    if (x > 26 && x < 38 && z > -40 && z < 40) continue;
    const s = 0.8 + r() * 0.6;
    trees.push(M(x, 0, z, 0, r() * 6, 0, s));
    treeCols.push(['#4fbf4a', '#3fae5a', '#6ccf3a', '#2f9f4f'][Math.floor(r() * 4)]);
  }
  const tp = [part(CYL(0.25, 0.35, 2.4, 8), '#7a4a2a', M(0, 1.2, 0))];
  const fol = [[0, 3.4, 0, 1.7], [0.9, 2.9, 0.3, 1.2], [-0.8, 3.0, -0.4, 1.25], [0.1, 4.4, 0.1, 1.15]];
  for (const [x, y, z, rr] of fol) tp.push(part(new THREE.IcosahedronGeometry(rr, 1), '#ffffff', M(x, y, z), (o, px, py) => o.setRGB(1, 1, 1).multiplyScalar(0.72 + Math.min(0.28, (py - 2) * 0.12))));
  const treeGeo = merge(tp);
  const trunkFix = treeGeo.attributes.color;
  for (let i = 0; i < trunkFix.count; i++) if (treeGeo.attributes.position.getY(i) < 2.2 && Math.abs(treeGeo.attributes.position.getX(i)) < 0.4) trunkFix.setXYZ(i, 0.9, 0.7, 0.55);
  const treeMesh = instanced(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), trees, treeCols);
  scene.add(treeMesh);
  const lamps = [];
  for (let z = -30; z <= 34; z += 16) lamps.push(M(38.6, 0, z, 0, Math.PI, 0));
  for (let x = -40; x <= 60; x += 14) lamps.push(M(x, 0, 38));
  const lampGeo = merge([part(CYL(0.1, 0.14, 5, 10), '#2a2e3d', M(0, 2.5, 0)), part(rbox(0.9, 0.18, 0.4, 0.06), '#2a2e3d', M(0.3, 5.0, 0))]);
  scene.add(instanced(lampGeo, vcMat, lamps, null));
  scene.add(instanced(merge([part(rbox(0.7, 0.06, 0.3, 0.03), '#fff', M(0.3, 4.88, 0))]), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.6) }), lamps, null, false));
  const city = [];
  const cityCol = [];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + r() * 0.05;
    const d = 260 + r() * 120;
    const w = 14 + r() * 20;
    const h = 18 + r() * 55;
    city.push(M(Math.cos(a) * d, h / 2, Math.sin(a) * d, 0, -a, 0, w, h, 12 + r() * 10));
    cityCol.push(['#f3ede2', '#e6eef8', '#f8e6d4', '#e9e2f5', '#dff0ea'][Math.floor(r() * 5)]);
  }
  const cityMat = new THREE.MeshStandardMaterial({ map: windowTex(), roughness: 0.7 });
  const cm = instanced(new THREE.BoxGeometry(1, 1, 1), cityMat, city, cityCol, false);
  cm.receiveShadow = false;
  scene.add(cm);
  const hills = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const d = 380 + r() * 60;
    hills.push(M(Math.cos(a) * d, -5, Math.sin(a) * d, 0, r() * 3, 0, 60 + r() * 60, 30 + r() * 40, 60 + r() * 50));
  }
  const hm = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#7fb8a0', roughness: 1, flatShading: true }), hills, null, false);
  scene.add(hm);
}

export class Shop {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const { x, z } = SHOP;
    const fz = z + SHOP.d / 2;
    const body = merge([
      part(rbox(SHOP.w, 5.2, SHOP.d, 0.3), '#3b2a7a', M(x, 2.6, z), shadeY(0, 5.2, '#3b2a7a', 0.7)),
      part(rbox(SHOP.w + 0.6, 0.5, SHOP.d + 0.6, 0.15), '#ffd23a', M(x, 5.35, z)),
      part(rbox(SHOP.w + 0.3, 0.35, SHOP.d + 0.3, 0.1), '#1b1336', M(x, 0.18, z)),
      part(rbox(1.0, 4.6, 0.6, 0.15), '#ff2d8a', M(x - SHOP.w / 2 + 0.4, 2.3, fz + 0.1)),
      part(rbox(1.0, 4.6, 0.6, 0.15), '#ff2d8a', M(x + SHOP.w / 2 - 0.4, 2.3, fz + 0.1)),
      part(rbox(SHOP.w - 1.6, 0.5, 0.5, 0.1), '#ff2d8a', M(x, 4.35, fz + 0.1)),
    ]);
    const bm = new THREE.Mesh(body, vcMat);
    bm.castShadow = true;
    bm.receiveShadow = true;
    this.group.add(bm);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.w - 2.2, 3.4), new THREE.MeshBasicMaterial({ map: shopWindowTex(), color: new THREE.Color(1.25, 1.25, 1.25) }));
    win.position.set(x, 2.25, fz + 0.02);
    this.group.add(win);
    const aw = [];
    for (let i = 0; i < 12; i++) aw.push(part(new THREE.BoxGeometry((SHOP.w + 0.4) / 12, 0.1, 2.2), i % 2 ? '#ffffff' : '#ff2d8a', M(x - SHOP.w / 2 - 0.2 + ((i + 0.5) * (SHOP.w + 0.4)) / 12, 4.2, fz + 1.1, 0.28, 0, 0)));
    const awm = new THREE.Mesh(merge(aw), vcMat);
    awm.castShadow = true;
    this.group.add(awm);
    const signBack = new THREE.Mesh(merge([part(rbox(9.4, 2.4, 0.6, 0.25), '#1b1336', M(x, 6.9, fz - 0.4))]), vcMat);
    signBack.castShadow = true;
    this.group.add(signBack);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: neonText('DÜKKÂN', '#ff3cf0', 1024, 256, 160), transparent: true, depthWrite: false, color: new THREE.Color(1.8, 1.8, 1.8) }));
    sign.position.set(x, 6.9, fz - 0.08);
    this.group.add(sign);
    this.clockCanvas = document.createElement('canvas');
    this.clockCanvas.width = 512;
    this.clockCanvas.height = 128;
    this.clockTex = new THREE.CanvasTexture(this.clockCanvas);
    this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: this.clockTex, transparent: true, color: new THREE.Color(1.3, 1.3, 1.3) }));
    clock.position.set(x, 8.75, fz - 0.4);
    const clockBack = new THREE.Mesh(merge([part(rbox(4.6, 1.3, 0.4, 0.2), '#ffd23a', M(x, 8.75, fz - 0.62))]), vcMat);
    this.group.add(clockBack, clock);
    this.clockText = '';
    this.setClock(120);
    const ringMat = new THREE.MeshBasicMaterial({ map: ringTex(), color: new THREE.Color('#ffd23a').multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.ring * 2.6, SHOP.ring * 2.6), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(SHOP.rx, 0.05, SHOP.rz);
    this.group.add(this.ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(SHOP.ring, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb21f'), transparent: true, opacity: 0.35, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(SHOP.rx, 0.04, SHOP.rz);
    this.disc = disc;
    this.group.add(disc);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(SHOP.ring * 0.95, SHOP.ring, 4, 32, 1, true), new THREE.MeshBasicMaterial({ map: beamTex(), color: new THREE.Color('#ffd23a').multiplyScalar(1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(SHOP.rx, 2, SHOP.rz);
    this.beam = beam;
    this.group.add(beam);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: cartTex(), transparent: true, depthWrite: false }));
    icon.scale.set(1.6, 1.6, 1);
    icon.position.set(SHOP.rx, 3.2, SHOP.rz);
    this.icon = icon;
    this.group.add(icon);
    this.pedestals = SHOP.pedestals.map(([px, pz]) => {
      const g = new THREE.Group();
      const ped = new THREE.Mesh(merge([part(CYL(0.9, 1.0, 0.5, 28), '#1b1336', M(0, 0.25, 0)), part(CYL(0.92, 0.92, 0.08, 28), '#ffd23a', M(0, 0.52, 0))]), vcMat);
      ped.castShadow = true;
      ped.receiveShadow = true;
      g.add(ped);
      g.position.set(px, 0, pz);
      this.group.add(g);
      return { g, creator: null, id: null };
    });
    const mat = new THREE.Mesh(merge([part(CYL(2.2, 2.3, 0.08, 40), '#2f8cff', M(0, 0.04, 0)), part(new THREE.RingGeometry(1.7, 1.95, 40), '#ffffff', M(0, 0.085, 0, -Math.PI / 2, 0, 0))]), vcMat);
    mat.position.set(SHOP.waitX, 0, SHOP.waitZ);
    mat.receiveShadow = true;
    this.waitMat = mat;
    this.group.add(mat);
    this.time = 0;
  }

  setClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (txt === this.clockText) return;
    this.clockText = txt;
    const g = this.clockCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = '#1b1336';
    g.beginPath();
    g.roundRect(8, 8, 496, 112, 40);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(78, 64, 36, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(78, 64);
    g.lineTo(78, 38);
    g.moveTo(78, 64);
    g.lineTo(98, 72);
    g.stroke();
    g.font = '900 76px "Segoe UI Black", "Arial Rounded MT Bold", sans-serif';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd23a';
    g.fillText(txt, 140, 68);
    this.clockTex.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    const k = 0.75 + Math.sin(this.time * 4) * 0.25;
    this.ring.material.opacity = k;
    this.ring.scale.setScalar(1 + Math.sin(this.time * 4) * 0.04);
    this.beam.material.opacity = 0.35 + Math.sin(this.time * 3) * 0.15;
    this.icon.position.y = 3.2 + Math.sin(this.time * 3) * 0.2;
  }
}

function cartTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b1336';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#35d67a';
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(26, 40);
  g.lineTo(38, 40);
  g.lineTo(48, 80);
  g.lineTo(92, 80);
  g.lineTo(100, 52);
  g.lineTo(42, 52);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(52, 94, 7, 0, 7);
  g.arc(88, 94, 7, 0, 7);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shopWindowTex() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 192;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 192);
  gr.addColorStop(0, '#ffe7a8');
  gr.addColorStop(1, '#ff9ad2');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 192);
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 86;
    g.fillStyle = 'rgba(27,19,54,0.25)';
    g.beginPath();
    g.ellipse(x, 176, 30, 8, 0, 0, 7);
    g.fill();
    g.fillStyle = ['#2f8cff', '#a24dff', '#ffb81f', '#35d67a', '#ff4fa8', '#35d6ff'][i];
    g.beginPath();
    g.arc(x, 90, 22, 0, 7);
    g.fill();
    g.beginPath();
    g.roundRect(x - 20, 112, 40, 58, 14);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(120, 0);
  g.lineTo(40, 192);
  g.lineTo(0, 192);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TowerExtras {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.roof = new THREE.Group();
    const w = ROOM.x1 - ROOM.x0;
    const d = ROOM.z1 - ROOM.z0;
    const roofG = merge([
      part(new THREE.BoxGeometry(w + 1.2, 0.8, d + 1.2), '#f2f4f8', M(0, 0.4, 0)),
      part(new THREE.BoxGeometry(w + 1.2, 0.12, d + 1.2), '#4b5064', M(0, 0.86, 0)),
      part(new THREE.BoxGeometry(w + 1.5, 0.45, 0.35), '#c81f2e', M(0, 1.0, (d + 1.5) / 2)),
      part(new THREE.BoxGeometry(w + 1.5, 0.45, 0.35), '#c81f2e', M(0, 1.0, -(d + 1.5) / 2)),
      part(new THREE.BoxGeometry(0.35, 0.45, d + 1.5), '#c81f2e', M((w + 1.5) / 2, 1.0, 0)),
      part(new THREE.BoxGeometry(0.35, 0.45, d + 1.5), '#c81f2e', M(-(w + 1.5) / 2, 1.0, 0)),
      part(new THREE.BoxGeometry(w + 1.6, 0.08, 0.45), '#ffffff', M(0, 1.26, (d + 1.5) / 2)),
      ...[[-13, 6], [-4, 6.5], [4, -6.5], [14, 0]].flatMap(([x, z]) => [
        part(rbox(2.2, 1.1, 1.6, 0.12), '#c9ced9', M(x, 1.47, z)),
        part(CYL(0.55, 0.55, 0.06, 16), '#2a2e3d', M(x - 0.4, 2.05, z)),
        part(rbox(0.6, 0.5, 1.2, 0.08), '#9aa3b8', M(x + 0.7, 2.15, z)),
      ]),
      ...[-6, -2, 2, 6].map((x) => part(new THREE.BoxGeometry(0.08, 0.02, d - 1), '#3d4254', M(x, 0.93, 0))),
      part(rbox(4, 2.2, 4, 0.2), '#dfe3ec', M(-10, 1.9, -5)),
      part(rbox(3, 1.4, 3, 0.2), '#dfe3ec', M(11, 1.5, -6)),
      part(CYL(0.12, 0.2, 9, 8), '#c9ced9', M(12, 5, 5)),
      part(rbox(0.5, 8.5, 0.5, 0.1), '#2a2e3d', M(-7, 5, 1)),
      part(rbox(0.5, 8.5, 0.5, 0.1), '#2a2e3d', M(7, 5, 1)),
      part(rbox(17, 7.4, 0.6, 0.3), '#1b1336', M(0, 7.2, 1)),
    ]);
    const rm = new THREE.Mesh(roofG, vcMat);
    rm.castShadow = true;
    this.roof.add(rm);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 7.8), new THREE.MeshBasicMaterial({ map: logoTex(), transparent: true, depthWrite: false, color: new THREE.Color(1.35, 1.35, 1.35) }));
    logo.position.set(0, 7.2, 1.32);
    this.roof.add(logo);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.5) }));
    tip.position.set(12, 9.6, 5);
    this.roof.add(tip);
    this.tip = tip;
    this.group.add(this.roof);
    const canopy = merge([
      part(rbox(12, 0.4, 3.4, 0.15), '#ff2d3d', M(0, 4.2, 11.6)),
      part(rbox(12.2, 0.12, 3.6, 0.05), '#ffd23a', M(0, 4.45, 11.6)),
      part(CYL(0.12, 0.12, 4.1, 10), '#e9edf5', M(-5.6, 2.05, 13.0)),
      part(CYL(0.12, 0.12, 4.1, 10), '#e9edf5', M(5.6, 2.05, 13.0)),
    ]);
    const cm = new THREE.Mesh(canopy, vcMat);
    cm.castShadow = true;
    this.canopy = cm;
    this.group.add(cm);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 9), new THREE.MeshStandardMaterial({ color: '#d4202c', roughness: 0.9 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.012, 14);
    carpet.receiveShadow = true;
    this.group.add(carpet);
  }

  setFloors(n) {
    this.roof.position.y = n * H;
  }
}

export class Elevator {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cabin = new THREE.Group();
    this.group.add(this.cabin);
    const { cx, cz, hx, hz } = ELEV;
    const cab = merge([
      part(rbox(hx * 2, 0.25, hz * 2, 0.06), '#e9edf5', M(cx, -0.1, cz)),
      part(rbox(hx * 2, 0.2, hz * 2, 0.06), '#e9edf5', M(cx, 3.5, cz)),
      part(rbox(0.16, 3.6, 0.16, 0.05), '#e9edf5', M(cx - hx, 1.7, cz - hz)),
      part(rbox(0.16, 3.6, 0.16, 0.05), '#e9edf5', M(cx - hx, 1.7, cz + hz)),
      part(rbox(0.16, 3.6, 0.16, 0.05), '#e9edf5', M(cx + hx, 1.7, cz - hz)),
      part(rbox(0.16, 3.6, 0.16, 0.05), '#e9edf5', M(cx + hx, 1.7, cz + hz)),
      part(rbox(hx * 2, 0.08, 0.08, 0.02), '#e9edf5', M(cx, 1.1, cz - hz)),
      part(rbox(hx * 2, 0.08, 0.08, 0.02), '#e9edf5', M(cx, 1.1, cz + hz)),
      part(rbox(0.08, 0.08, hz * 2, 0.02), '#e9edf5', M(cx - hx, 1.1, cz)),
    ]);
    const cm = new THREE.Mesh(cab, vcMetal);
    cm.castShadow = true;
    cm.receiveShadow = true;
    this.cabin.add(cm);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2 - 0.2, hz * 2 - 0.2), new THREE.MeshStandardMaterial({ color: '#2a2e3d', roughness: 0.3, metalness: 0.4 }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set(cx, 0.03, cz);
    fl.receiveShadow = true;
    this.cabin.add(fl);
    const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.4, 0.05, hz * 2 - 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2.2) }));
    lightStrip.position.set(cx, 3.38, cz);
    this.cabin.add(lightStrip);
    const ringGlow = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#35d6ff').multiplyScalar(2), transparent: true, opacity: 0.9, depthWrite: false }));
    ringGlow.rotation.x = -Math.PI / 2;
    ringGlow.position.set(cx, 0.05, cz);
    this.cabin.add(ringGlow);
    this.ringGlow = ringGlow;
    const glass = new THREE.MeshStandardMaterial({ color: '#bfe9ff', roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.8 });
    const gw = merge([
      part(new THREE.BoxGeometry(0.04, 3.4, hz * 2), '#fff', M(cx - hx, 1.75, cz)),
      part(new THREE.BoxGeometry(hx * 2, 3.4, 0.04), '#fff', M(cx, 1.75, cz - hz)),
      part(new THREE.BoxGeometry(hx * 2, 3.4, 0.04), '#fff', M(cx, 1.75, cz + hz)),
    ]);
    const gm = new THREE.Mesh(gw, glass);
    gm.renderOrder = 3;
    this.cabin.add(gm);
    this.doors = [];
    for (const s of [-1, 1]) {
      const dm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.2, hz), glass);
      dm.position.set(cx + hx, 1.7, cz + s * hz * 0.5);
      dm.renderOrder = 3;
      this.cabin.add(dm);
      this.doors.push({ m: dm, s });
    }
    this.shaft = new THREE.Group();
    this.group.add(this.shaft);
    this.shaftGlass = glass;
    this.y = 0;
    this.open = 1;
    this.floors = 1;
    this.setFloors(1);
  }

  setFloors(n) {
    this.floors = n;
    const { cx, cz, hx, hz } = ELEV;
    for (const c of [...this.shaft.children]) {
      this.shaft.remove(c);
      if (c.geometry) c.geometry.dispose();
    }
    const h = n * H + 1.2;
    const rails = merge([
      part(rbox(0.3, h, 0.3, 0.08), '#e9edf5', M(cx - hx - 0.25, h / 2 - 0.6, cz - hz - 0.25)),
      part(rbox(0.3, h, 0.3, 0.08), '#e9edf5', M(cx - hx - 0.25, h / 2 - 0.6, cz + hz + 0.25)),
      part(rbox(0.3, h, 0.3, 0.08), '#e9edf5', M(ROOM.x0 - 0.3, h / 2 - 0.6, cz - hz - 0.25)),
      part(rbox(0.3, h, 0.3, 0.08), '#e9edf5', M(ROOM.x0 - 0.3, h / 2 - 0.6, cz + hz + 0.25)),
    ]);
    const rm = new THREE.Mesh(rails, vcMetal);
    rm.castShadow = true;
    this.shaft.add(rm);
    const bands = [];
    for (let f = 0; f <= n; f++) {
      bands.push(part(rbox(hx * 2 + 0.8, 0.22, 0.22, 0.05), '#e9edf5', M(cx, f * H - 0.2, cz - hz - 0.25)));
      bands.push(part(rbox(hx * 2 + 0.8, 0.22, 0.22, 0.05), '#e9edf5', M(cx, f * H - 0.2, cz + hz + 0.25)));
      bands.push(part(rbox(0.22, 0.22, hz * 2 + 0.8, 0.05), '#e9edf5', M(cx - hx - 0.25, f * H - 0.2, cz)));
    }
    this.shaft.add(new THREE.Mesh(merge(bands), vcMetal));
    const sg = merge([
      part(new THREE.BoxGeometry(0.04, h, hz * 2 + 0.4), '#fff', M(cx - hx - 0.3, h / 2 - 0.6, cz)),
      part(new THREE.BoxGeometry(hx * 2 + 0.6, h, 0.04), '#fff', M(cx, h / 2 - 0.6, cz - hz - 0.3)),
      part(new THREE.BoxGeometry(hx * 2 + 0.6, h, 0.04), '#fff', M(cx, h / 2 - 0.6, cz + hz + 0.3)),
    ]);
    const sgm = new THREE.Mesh(sg, this.shaftGlass);
    sgm.renderOrder = 3;
    this.shaft.add(sgm);
    const caps = new THREE.Mesh(merge([part(rbox(hx * 2 + 1.0, 0.6, hz * 2 + 1.0, 0.15), '#ff2d3d', M(cx, n * H + 0.9, cz))]), vcMat);
    this.shaft.add(caps);
  }

  update(dt, doorsOpen) {
    this.open += ((doorsOpen ? 1 : 0) - this.open) * Math.min(1, dt * 8);
    for (const d of this.doors) d.m.position.z = ELEV.cz + d.s * (ELEV.hz * 0.5 + this.open * ELEV.hz * 0.9);
    this.cabin.position.y = this.y;
    this.ringGlow.material.opacity = 0.5 + Math.sin(performance.now() * 0.004) * 0.3;
  }
}
