import * as THREE from 'three';

const _s = new THREE.Vector3();

function std(o) {
  return new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, ...o });
}

const HATS = {
  cap(g) {
    const m = std({ color: 0x2f8cff });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), m);
    dome.scale.y = 0.75;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24, 1, false, -Math.PI * 0.55, Math.PI * 1.1), std({ color: 0x1b5fc0 }));
    brim.position.set(0, 0.02, 0.22);
    brim.scale.set(1, 1, 1.3);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std({ color: 0xffc21a }));
    btn.position.y = 0.36;
    g.add(dome, brim, btn);
  },
  crown(g) {
    const gold = std({ color: 0xffc21a, metalness: 0.85, roughness: 0.25, emissive: 0x6a4000, emissiveIntensity: 0.25 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.4, 0.26, 24, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    band.position.y = 0.1;
    g.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), gold);
      spike.position.set(Math.cos(a) * 0.42, 0.36, Math.sin(a) * 0.42);
      g.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std({ color: [0xff3348, 0x36a2ff, 0x3ddc5a][i % 3], emissive: 0x330000, roughness: 0.15 }));
      gem.position.set(Math.cos(a + 0.5) * 0.43, 0.12, Math.sin(a + 0.5) * 0.43);
      g.add(gem);
    }
  },
  wizard(g) {
    const m = std({ color: 0x5a2fd8 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 24), m);
    cone.position.y = 0.55;
    cone.rotation.z = -0.12;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 28), m);
    brim.position.y = 0.02;
    const bandM = std({ color: 0xffc21a, metalness: 0.6 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.14, 24), bandM);
    band.position.y = 0.12;
    g.add(cone, brim, band);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), std({ color: 0xfff3a0, emissive: 0xffd22e, emissiveIntensity: 1.2 }));
      const a = i * 1.7;
      const h = 0.25 + i * 0.16;
      const r = 0.42 * (1 - h / 1.1) + 0.02;
      star.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      g.add(star);
    }
  },
  headset(g) {
    const m = std({ color: 0xff4fd8, roughness: 0.35 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 10, 32, Math.PI), m);
    arc.position.y = 0.06;
    const cupG = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 18);
    cupG.rotateZ(Math.PI / 2);
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(cupG, std({ color: 0x8a2fb0 }));
      cup.position.set(s * 0.48, -0.3, 0);
      g.add(cup);
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), std({ color: 0x35e0ff, emissive: 0x35e0ff, emissiveIntensity: 2 }));
      led.position.set(s * 0.55, -0.3, 0);
      led.rotation.y = (s * Math.PI) / 2;
      g.add(led);
    }
    g.add(arc);
  },
  helmet(g) {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, transmission: 0.55, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, side: THREE.DoubleSide }));
    glass.position.y = -0.25;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 32), std({ color: 0xd6dde8, metalness: 0.7, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.8;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), std({ color: 0x8a93a8 }));
    ant.position.y = 0.45;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std({ color: 0xff3348, emissive: 0xff3348, emissiveIntensity: 1.5 }));
    tip.position.y = 0.62;
    g.add(glass, ring, ant, tip);
  },
};

export class Costume {
  constructor(player) {
    this.player = player;
    this.head = null;
    this.hat = null;
    this.hatId = 'none';
    this.cape = null;
    this.capeId = 'none';
    this.capeAngle = 0.25;
    this.flutter = 0;
    player.model.traverse((o) => {
      if (o.isBone && o.name === 'Head') this.head = o;
    });
    if (this.head) {
      this.head.updateWorldMatrix(true, false);
      this.head.getWorldScale(_s);
      this.headScale = 1 / (_s.x || 1);
      const end = this.head.children.find((c) => c.name === 'Head_end');
      this.headLen = end ? end.position.length() : 0.5 / this.headScale;
    }
  }

  setHat(id) {
    if (this.hat) {
      this.hat.parent.remove(this.hat);
      this.hat.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
      this.hat = null;
    }
    this.hatId = id;
    if (!HATS[id]) return;
    const g = new THREE.Group();
    HATS[id](g);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const holder = new THREE.Group();
    holder.add(g);
    if (this.head) {
      holder.scale.setScalar(this.headScale);
      holder.position.set(0, this.headLen * 0.92, 0);
      g.position.set(0, 0.08, 0);
      this.head.add(holder);
    } else {
      holder.position.set(0, 1.78, 0);
      this.player.inner.add(holder);
    }
    this.hat = holder;
  }

  setCape(item) {
    if (this.cape) {
      this.cape.parent.remove(this.cape);
      this.cape.geometry.dispose();
      this.cape.material.dispose();
      this.cape = null;
    }
    this.capeId = item ? item.id : 'none';
    if (!item || item.id === 'none') return;
    const geo = new THREE.PlaneGeometry(0.9, 1.15, 4, 8);
    geo.translate(0, -0.575, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * (1 + (-y / 1.15) * 0.45));
    }
    geo.computeVertexNormals();
    const mat = std({ color: item.color, side: THREE.DoubleSide, metalness: item.metal ? 0.8 : 0.05, roughness: item.metal ? 0.3 : 0.6, emissive: item.stars ? 0x14083a : 0x000000 });
    if (item.stars) mat.map = starTexture();
    const cape = new THREE.Mesh(geo, mat);
    cape.castShadow = true;
    cape.position.set(0, 1.42, -0.27);
    cape.userData.base = pos.array.slice();
    this.player.inner.add(cape);
    this.cape = cape;
  }

  update(dt, t) {
    if (!this.cape) return;
    const p = this.player;
    const sp = Math.hypot(p.vel.x, p.vel.z);
    const want = 0.22 + Math.min(1, sp / 9) * 0.7 + (p.grounded ? 0 : 0.5) + (p.vel.y > 2 ? 0.3 : 0);
    this.capeAngle += (want - this.capeAngle) * (1 - Math.exp(-6 * dt));
    this.cape.rotation.x = this.capeAngle;
    const g = this.cape.geometry;
    const pos = g.attributes.position;
    const base = this.cape.userData.base;
    const amp = 0.03 + Math.min(1, sp / 9) * 0.07;
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1];
      const k = -y / 1.15;
      pos.setZ(i, Math.sin(t * 9 + k * 6 + base[i * 3] * 3) * amp * k);
    }
    pos.needsUpdate = true;
  }
}

let starTex = null;
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1a5a';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#fff6c4';
  for (let i = 0; i < 26; i++) {
    const x = (i * 53) % 128;
    const y = (i * 37 + 11) % 128;
    const r = 1.5 + (i % 3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}
