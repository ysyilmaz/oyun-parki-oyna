const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function isActionKey(e) {
  return e.code === 'KeyE' || e.key === 'e' || e.key === 'E';
}

export class Input {
  constructor(canvas, joyEl, log) {
    this.canvas = canvas;
    this.log = log;
    this.keys = new Set();
    this.actionCodes = new Set();
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.joyEl = joyEl;
    this.knob = joyEl.querySelector('.joy-knob');
    this.drag = 0;
    this.taps = [];
    this.pointers = new Map();
    this.jump = false;
    this.enabled = true;
    this.touchMode = false;
    this.listeners = { action: [], actionUp: [], key: [] };
    this.actionHeld = false;
    this.actionDownAt = 0;
    window.addEventListener('keydown', (e) => this.keydown(e), { capture: true });
    window.addEventListener('keyup', (e) => this.keyup(e), { capture: true });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  on(type, fn) {
    this.listeners[type].push(fn);
  }

  emit(type, ...a) {
    for (const fn of this.listeners[type]) fn(...a);
  }

  clear() {
    this.keys.clear();
    this.actionCodes.clear();
    if (this.actionHeld) {
      this.actionHeld = false;
      this.emit('actionUp', 'blur');
    }
  }

  keydown(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab' || e.code === 'Backspace') e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isActionKey(e)) {
      this.actionCodes.add(e.code);
      if (e.repeat) return;
      this.actionHeld = true;
      this.actionDownAt = performance.now();
      this.log('input', { key: 'E' });
      this.emit('action', 'key');
      return;
    }
    if (MOVE.has(e.code)) {
      if (!e.repeat) this.log('input', { key: e.code });
      this.keys.add(e.code);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space') {
      if (this.spaceAction && this.spaceAction()) {
        this.log('input', { key: 'Space', action: true });
        this.emit('action', 'key');
        return;
      }
      this.jump = true;
      this.log('input', { key: 'Space' });
      return;
    }
    this.log('input', { key: e.code });
    this.emit('key', e);
  }

  keyup(e) {
    if (this.actionCodes.has(e.code) || isActionKey(e)) {
      this.actionCodes.delete(e.code);
      this.keys.delete(e.code);
      if (this.actionHeld && this.actionCodes.size === 0) {
        this.actionHeld = false;
        this.emit('actionUp', 'key');
      }
      return;
    }
    this.keys.delete(e.code);
  }

  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'touch') this.touchMode = true;
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
      p.noCapture = true;
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
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
      const dead = l < 8 ? 0 : 1;
      this.joy.x = (jx / r) * dead;
      this.joy.y = (jy / r) * dead;
      this.knob.style.transform = `translate(${jx}px, ${jy}px)`;
      return;
    }
    if (p.moved > 10) this.drag += dx;
  }

  up(e, cancel) {
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
    if (!cancel && p.moved <= 10 && performance.now() - p.t < 700) this.taps.push({ x: e.clientX, y: e.clientY });
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
    const d = { drag: this.drag, taps: this.taps, jump: this.jump };
    this.drag = 0;
    this.taps = [];
    this.jump = false;
    return d;
  }
}
