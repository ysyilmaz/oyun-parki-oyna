export class Input {
  constructor(canvas, joyEl) {
    this.canvas = canvas;
    this.keys = new Set();
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.joyEl = joyEl;
    this.knob = joyEl.querySelector('.joy-knob');
    this.drag = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.taps = [];
    this.pointers = new Map();
    this.pinchDist = 0;
    this.jump = false;
    this.enabled = true;
    this.touchMode = false;
    this.actionCodes = new Set();
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      this.touchMode = true;
      document.body.classList.add('touch');
    }
    this.onAction = null;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const isE = e.code === 'KeyE' || e.key === 'e' || e.key === 'E';
      if (isE && this.actionCodes.has(e.code)) return;
      if (isE && !e.repeat && this.onAction && this.onAction()) {
        this.actionCodes.add(e.code);
        this.keys.delete(e.code);
        e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'Space') {
        this.jump = true;
        e.preventDefault();
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.actionCodes.delete(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY) * 1.6;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'touch' && !this.touchMode) {
      this.touchMode = true;
      document.body.classList.add('touch');
    }
    const w = window.innerWidth;
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), kind: 'cam', moved: 0 };
    if (e.pointerType === 'touch' && e.clientX < w * 0.42 && this.joy.id === null) {
      p.kind = 'joy';
      this.joy.id = e.pointerId;
      this.joy.cx = e.clientX;
      this.joy.cy = e.clientY;
      this.joyEl.style.left = e.clientX + 'px';
      this.joyEl.style.top = e.clientY + 'px';
      this.joyEl.classList.add('on');
    }
    this.pointers.set(e.pointerId, p);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      this.pointers.get(e.pointerId).noCapture = true;
    }
    if (this.camPointers().length === 2) this.pinchDist = this.pinch();
  }

  camPointers() {
    return [...this.pointers.values()].filter((p) => p.kind === 'cam');
  }

  pinch() {
    const c = this.camPointers();
    return Math.hypot(c[0].x - c[1].x, c[0].y - c[1].y);
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    p.moved = Math.max(p.moved, Math.hypot(p.x - p.sx, p.y - p.sy));
    if (p.kind === 'joy') {
      const r = 56;
      let jx = p.x - this.joy.cx;
      let jy = p.y - this.joy.cy;
      const l = Math.hypot(jx, jy);
      if (l > r) {
        jx = (jx / l) * r;
        jy = (jy / l) * r;
      }
      this.joy.x = jx / r;
      this.joy.y = jy / r;
      this.knob.style.transform = `translate(${jx}px, ${jy}px)`;
      return;
    }
    const cams = this.camPointers();
    if (cams.length === 2) {
      const d = this.pinch();
      this.zoom -= (d - this.pinchDist) * 0.05;
      this.pinchDist = d;
      return;
    }
    if (p.moved > 6) {
      this.drag.dx += dx;
      this.drag.dy += dy;
    }
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.kind === 'joy') {
      this.joy.id = null;
      this.joy.x = this.joy.y = 0;
      this.knob.style.transform = '';
      this.joyEl.classList.remove('on');
      return;
    }
    if (p.moved < 10 && performance.now() - p.t < 450) this.taps.push({ x: e.clientX, y: e.clientY });
  }

  axis() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.joy.x;
    y += this.joy.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  consume() {
    const d = { dx: this.drag.dx, dy: this.drag.dy, zoom: this.zoom, taps: this.taps, jump: this.jump };
    this.drag.dx = this.drag.dy = 0;
    this.zoom = 0;
    this.taps = [];
    this.jump = false;
    return d;
  }
}
