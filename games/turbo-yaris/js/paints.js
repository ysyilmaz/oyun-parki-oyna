import * as THREE from 'three';

export const PAINTS = [
  { id: 'red', name: 'Kırmızı', color: 0xd30f1f, price: 0 },
  { id: 'blue', name: 'Mavi', color: 0x0f5fe8, price: 0 },
  { id: 'yellow', name: 'Sarı', color: 0xffbf00, price: 0 },
  { id: 'green', name: 'Yeşil', color: 0x12b83a, price: 50 },
  { id: 'orange', name: 'Turuncu', color: 0xff6400, price: 80 },
  { id: 'white', name: 'Beyaz', color: 0xf4f4f4, price: 100 },
  { id: 'purple', name: 'Mor', color: 0x7b2ff0, price: 120 },
  { id: 'pink', name: 'Pembe', color: 0xff3fa0, price: 150 },
  { id: 'black', name: 'Siyah', color: 0x0d0d10, price: 200 },
  { id: 'chrome', name: 'Krom', color: 0xffffff, price: 300, special: 'chrome' },
  { id: 'gold', name: 'Altın', color: 0xffb42a, price: 400, special: 'gold' },
  { id: 'rainbow', name: 'Gökkuşağı', color: 0xff2255, price: 500, special: 'rainbow' }
];

const WHITE = new THREE.Color(1, 1, 1);

export function rimLit(m, color) {
  m.userData.rim = { value: color };
  m.onBeforeCompile = sh => {
    sh.uniforms.uRim = m.userData.rim;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);');
  };
  m.customProgramCacheKey = () => 'rim';
  return m;
}

export function paintById(id) {
  return PAINTS.find(p => p.id === id) || PAINTS[0];
}

export function makePaintMaterial(paint) {
  const m = rimLit(new THREE.MeshPhysicalMaterial({
    color: paint.color,
    metalness: 0.15,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.03
  }), new THREE.Color());
  applyPaint(m, paint);
  return m;
}

export function applyPaint(m, paint) {
  m.color.setHex(paint.color);
  m.metalness = 0.15;
  m.roughness = 0.3;
  if (m.userData.rim) m.userData.rim.value.setHex(paint.color).lerp(WHITE, 0.3).multiplyScalar(0.3);
  m.iridescence = 0;
  m.userData.rainbow = false;
  if (paint.special === 'chrome') {
    m.metalness = 1;
    m.roughness = 0.04;
    m.color.setHex(0xf2f4f8);
  } else if (paint.special === 'gold') {
    m.metalness = 1;
    m.roughness = 0.16;
  } else if (paint.special === 'rainbow') {
    m.metalness = 0.7;
    m.roughness = 0.2;
    m.iridescence = 1;
    m.iridescenceIOR = 1.6;
    m.userData.rainbow = true;
  }
  m.needsUpdate = true;
}

export function tickRainbow(m, time) {
  if (m.userData.rainbow) m.color.setHSL((time * 0.15) % 1, 0.9, 0.5);
}

export function cssColor(paint) {
  if (paint.special === 'rainbow') return 'conic-gradient(#ff3b3b,#ffb52e,#fff23a,#3bff6a,#3bb8ff,#8a3bff,#ff3b3b)';
  if (paint.special === 'chrome') return 'linear-gradient(135deg,#ffffff,#9aa3b0 45%,#ffffff 60%,#6d7684)';
  if (paint.special === 'gold') return 'linear-gradient(135deg,#fff3b0,#ffb42a 45%,#fff0a0 60%,#b87a10)';
  return '#' + paint.color.toString(16).padStart(6, '0');
}
