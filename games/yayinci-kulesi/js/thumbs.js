import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Creator } from './chars.js';

export class Thumbs {
  constructor() {
    this.cache = new Map();
    this.r = null;
  }

  init() {
    if (this.r) return;
    const canvas = document.createElement('canvas');
    this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.r.setSize(192, 192, false);
    this.r.setPixelRatio(1);
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    this.scene.add(new THREE.HemisphereLight('#dfefff', '#6a5a8a', 1.4));
    const key = new THREE.DirectionalLight('#fff0dd', 2.6);
    key.position.set(2, 3, 4);
    this.scene.add(key);
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  }

  get(def) {
    if (this.cache.has(def.id)) return this.cache.get(def.id);
    this.init();
    const c = new Creator(def);
    c.shadow.visible = false;
    c.update(0, 0.3);
    this.scene.add(c.root);
    this.cam.position.set(0.55, 1.55, 3.1);
    this.cam.lookAt(0, 1.05, 0);
    c.root.rotation.y = 0.25;
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    const url = this.r.domElement.toDataURL('image/png');
    this.scene.remove(c.root);
    this.cache.set(def.id, url);
    return url;
  }
}
