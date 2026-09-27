import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCar, createDriver, assets } from './assets.js';
import { applyPaint, tickRainbow } from './paints.js';
import { studioFloorTexture, podiumNumberTexture, radialTexture } from './textures.js';
import { Confetti } from './effects.js';

const STUDIO_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STUDIO_FRAG = `
uniform vec3 top;
uniform vec3 bottom;
uniform vec3 glow;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 c = mix(bottom, top, smoothstep(0.03, 0.85, h));
  float g = pow(max(0.0, 1.0 - abs(h - 0.34) * 3.0), 3.0);
  c += glow * g * 0.16;
  gl_FragColor = vec4(c, 1.0);
}`;

function backdrop(top, bottom, glow) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) }, glow: { value: new THREE.Color(glow) } },
    vertexShader: STUDIO_VERT,
    fragmentShader: STUDIO_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  }));
  return m;
}

const GARAGE_FOG = 0x0a0e26;

function tyreStack(n, stripe) {
  const g = new THREE.Group();
  const tyre = new THREE.TorusGeometry(0.5, 0.24, 10, 28);
  tyre.rotateX(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.85 });
  const band = new THREE.MeshStandardMaterial({ color: stripe, roughness: 0.5 });
  const ring = new THREE.CylinderGeometry(0.62, 0.62, 0.1, 28, 1, true);
  for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(tyre, rubber);
    t.position.y = 0.24 + i * 0.46;
    t.rotation.y = i * 0.7;
    const b = new THREE.Mesh(ring, band);
    b.position.y = t.position.y;
    g.add(t, b);
  }
  return g;
}

function toolbox() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xd8232a, roughness: 0.35, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.2, metalness: 1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.3, 0.7, 2, 0.06), red);
  body.position.y = 0.75;
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const y = 0.35 + i * 0.28;
    const gap = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.025, 0.02), dark);
    gap.position.set(0, y + 0.13, 0.355);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.04), chrome);
    handle.position.set(0, y, 0.37);
    g.add(gap, handle);
  }
  for (const x of [-0.6, 0.6]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.08, 0.2);
    g.add(w);
  }
  return g;
}

function buildStage() {
  const g = new THREE.Group();
  const glowA = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,150,40,0.55)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  glowA.rotation.x = -Math.PI / 2;
  glowA.position.set(-5.5, 0.02, -6.5);
  const glowB = glowA.clone();
  glowB.material = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(60,200,255,0.55)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 });
  glowB.position.set(5.5, 0.02, -7.5);
  const a = tyreStack(3, 0xffd21f);
  a.position.set(-6.4, 0, -3.6);
  const b = tyreStack(4, 0xff3b4a);
  b.position.set(6.2, 0, -8.2);
  const b2 = tyreStack(2, 0x3bb8ff);
  b2.position.set(7.4, 0, -6.9);
  const box = toolbox();
  box.position.set(-2.6, 0, -8);
  box.rotation.y = 0.45;
  g.add(glowA, glowB, a, b, b2, box);
  return g;
}

function softbox(w, h, intensity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), toneMapped: false, side: THREE.DoubleSide }));
  return m;
}

export class Garage {
  constructor(renderer) {
    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.35;
    scene.fog = new THREE.Fog(GARAGE_FOG, 13, 38);
    scene.add(backdrop(0x1c2a70, GARAGE_FOG, 0x3a6bff));
    const floorTex = studioFloorTexture();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(58, 64), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x34407a, roughness: 0.35, metalness: 0.35, envMapIntensity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const table = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0x1a1c28, roughness: 0.25, metalness: 0.8 }));
    disc.position.y = 0.15;
    disc.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.06, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 3.0), toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    const ring2 = ring.clone();
    ring2.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.5, 2.2), toneMapped: false });
    ring2.scale.setScalar(1.06);
    ring2.position.y = 0.04;
    table.add(disc, ring, ring2);
    scene.add(table);
    this.table = table;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(120,170,255,0.6)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    scene.add(pool);
    this.stage = buildStage();
    scene.add(this.stage);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.radius = 4;
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rimA = new THREE.SpotLight(0x44c8ff, 30, 30, 0.6, 0.6);
    rimA.position.set(-8, 5, -6);
    const rimB = new THREE.SpotLight(0xff4fd8, 30, 30, 0.6, 0.6);
    rimB.position.set(8, 5, -6);
    scene.add(rimA, rimB, new THREE.HemisphereLight(0x8aa0ff, 0x101020, 0.35));
    const sb1 = softbox(8, 1.4, 0.9);
    sb1.position.set(0, 9, 0);
    sb1.rotation.x = Math.PI / 2;
    scene.add(sb1);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.car = null;
    this.robot = createDriver(0x2f9bff, 'Wave', 1.75);
    this.robot.holder.position.set(3.2, 0, -3.4);
    this.robot.holder.rotation.y = 0.2;
    scene.add(this.robot.holder);
    this.t = 0;
    this.orbit = 0;
  }

  setPaint(paint, cheer) {
    if (assets.headMat) { assets.headMat.emissiveIntensity = 0.1; assets.headMat.color.setHex(0x9a968c); }
    if (assets.tailMat) assets.tailMat.emissiveIntensity = 0.6;
    if (assets.trimMat && assets.trimMat.userData.rim) assets.trimMat.userData.rim.value.setRGB(0.22, 0.24, 0.3);
    if (!this.car) {
      this.car = createCar(paint);
      this.car.group.position.y = 0.3;
      this.table.add(this.car.group);
    } else applyPaint(this.car.bodyMat, paint);
    if (cheer) {
      this.robot.play('ThumbsUp');
      clearTimeout(this.cheerT);
      this.cheerT = setTimeout(() => this.robot.play('Idle'), 1600);
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    const wide = w / h > 1.2;
    if (wide) this.camera.setViewOffset(w, h, -w * 0.13, h * 0.02, w, h);
    else this.camera.clearViewOffset();
    this.camera.fov = wide ? 36 : 50;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    this.table.rotation.y += dt * 0.35;
    this.robot.update(dt);
    const a = Math.sin(this.t * 0.2) * 0.18;
    this.camera.position.set(Math.sin(0.55 + a) * 11, 3.6, Math.cos(0.55 + a) * 11);
    this.camera.lookAt(0.6, 0.1, 0);
    if (this.car) {
      tickRainbow(this.car.bodyMat, this.t);
      this.car.wheels.forEach(w => { w.rotation.x += dt * 0.5; });
    }
  }
}

function labelSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,12,30,0.8)';
  const r = 30;
  g.beginPath();
  g.roundRect(8, 12, 240, 72, r);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = color;
  g.stroke();
  g.font = '900 44px "Arial Black", "Segoe UI Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.2, 0.82, 1);
  s.renderOrder = 20;
  return s;
}

export class Podium {
  constructor(renderer, results, playerPaint, envTexture) {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.8;
    scene.add(backdrop(0x3a1a78, 0x0a0620, 0xff6ad5));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(58, 64), new THREE.MeshStandardMaterial({ map: studioFloorTexture(), color: 0x3a3f58, roughness: 0.3, metalness: 0.5, envMapIntensity: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const key = new THREE.DirectionalLight(0xfff2e0, 1.9);
    key.position.set(3, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10; key.shadow.camera.right = 10; key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
    key.shadow.radius = 4;
    scene.add(key, new THREE.HemisphereLight(0xb0a0ff, 0x201030, 0.45));
    scene.fog = new THREE.Fog(0x0a0620, 20, 50);
    const spotCols = [0xff4fd8, 0x44c8ff, 0xffd23b];
    this.beams = [];
    spotCols.forEach((c, i) => {
      const sp = new THREE.SpotLight(c, 35, 40, 0.35, 0.5);
      sp.position.set((i - 1) * 6, 12, 4);
      sp.target.position.set((i - 1) * 2, 0, 0);
      scene.add(sp, sp.target);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.09), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set((i - 1) * 4, 6, 1);
      beam.rotation.z = (i - 1) * -0.25;
      scene.add(beam);
      this.beams.push(beam);
    });
    const heights = [2.4, 1.7, 1.15];
    const xs = [0, -2.6, 2.6];
    const cols = ['#e8a912', '#9aa6b8', '#c0703a'];
    const matCols = [0xffc233, 0xd8dee8, 0xd9844a];
    this.robots = [];
    const clips = ['Dance', 'Wave', 'ThumbsUp'];
    results.slice(0, 3).forEach((r, i) => {
      const h = heights[i];
      const body = new THREE.Mesh(new RoundedBoxGeometry(2.4, h, 2.2, 3, 0.15), [
        new THREE.MeshStandardMaterial({ color: matCols[i], roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: matCols[i], roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: matCols[i], roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: matCols[i], roughness: 0.3, metalness: 0.6 }),
        new THREE.MeshStandardMaterial({ map: podiumNumberTexture(i + 1, cols[i]), roughness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: matCols[i], roughness: 0.3, metalness: 0.6 })
      ]);
      body.position.set(xs[i], h / 2, 0);
      body.castShadow = body.receiveShadow = true;
      scene.add(body);
      const rb = createDriver(r.robotColor, clips[i], 2.1);
      rb.holder.position.set(xs[i], h, 0);
      scene.add(rb.holder);
      this.robots.push(rb);
      const lab = labelSprite(r.isPlayer ? 'SEN' : r.name, r.isPlayer ? '#ffd23b' : '#ffffff');
      lab.position.set(xs[i], h + 3.1, 0);
      scene.add(lab);
    });
    this.car = createCar(playerPaint);
    this.car.group.position.set(6.4, 0, 1.4);
    this.car.group.rotation.y = -1.1;
    scene.add(this.car.group);
    this.confetti = new Confetti(500);
    scene.add(this.confetti.mesh);
    this.confetti.burst(0, 4, 0, 6, 300, 10);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.t = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    const wide = w / h > 1.2;
    if (wide) this.camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.fov = wide ? 42 : 58;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    this.robots.forEach(r => r.update(dt));
    const a = Math.sin(this.t * 0.25) * 0.3;
    this.camera.position.set(Math.sin(a) * 13, 4.6, Math.cos(a) * 13);
    this.camera.lookAt(-0.8, 2.2, 0);
    this.confetti.rain(0, 12, 0, 16, 4);
    this.confetti.update(dt);
    this.beams.forEach((b, i) => { b.rotation.z = (i - 1) * -0.25 + Math.sin(this.t * 0.8 + i * 2) * 0.25; });
    tickRainbow(this.car.bodyMat, this.t);
  }

  dispose() {
    this.confetti.mesh.geometry.dispose();
  }
}
