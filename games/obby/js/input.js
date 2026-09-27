export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.zoom = 0;
    this.jumpQueued = false;
    this.jumpHeld = false;
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.camTouch = null;
    this.touchMode = false;
    this.enabled = true;
    this.handlers = {};
    this.canvas = canvas;
    this.drag = null;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.jumpHeld = false;
    });
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom += Math.sign(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const jb = document.getElementById('jumpBtn');
    jb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.jumpQueued = true;
      this.jumpHeld = true;
      jb.classList.add('down');
      this.emit('gesture');
    });
    const up = () => {
      this.jumpHeld = false;
      jb.classList.remove('down');
    };
    jb.addEventListener('pointerup', up);
    jb.addEventListener('pointercancel', up);
    jb.addEventListener('pointerleave', up);
    this.joyEl = document.getElementById('joy');
    this.knob = document.getElementById('joyKnob');
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  emit(name, ...a) {
    if (this.handlers[name]) this.handlers[name](...a);
  }

  onKey(e, down) {
    const k = e.code;
    if (down && !e.repeat) {
      this.emit('gesture');
      this.emit('key', k);
    }
    if (k === 'Tab' || k === 'Backspace') e.preventDefault();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (down) {
      if (!e.repeat) {
        if (k === 'Space') {
          this.jumpQueued = true;
        }
        if (k === 'Escape' || k === 'KeyP') this.emit('pause');
        if (k === 'Digit1') this.emit('emote', 'Wave');
        if (k === 'Digit2') this.emit('emote', 'Dance');
        if (k === 'Digit3') this.emit('emote', 'ThumbsUp');
        if (k === 'KeyM') this.emit('mute');
      }
      this.keys.add(k);
      if (k === 'Space') this.jumpHeld = true;
    } else {
      this.keys.delete(k);
      if (k === 'Space') this.jumpHeld = false;
    }
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
    this.emit('touchmode', on);
  }

  onDown(e) {
    this.emit('gesture');
    if (e.pointerType === 'touch') {
      this.setTouchMode(true);
      const w = window.innerWidth;
      if (e.clientX < w * 0.42 && this.joy.id === null) {
        this.joy.id = e.pointerId;
        this.joy.cx = e.clientX;
        this.joy.cy = e.clientY;
        this.joy.x = 0;
        this.joy.y = 0;
        this.joyEl.style.left = e.clientX - 90 + 'px';
        this.joyEl.style.top = e.clientY - 90 + 'px';
        this.joyEl.style.bottom = 'auto';
        this.joyEl.classList.add('active');
      } else if (this.camTouch === null) {
        this.camTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      return;
    }
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      this.drag.noCapture = true;
    }
  }

  onMove(e) {
    if (e.pointerType === 'touch') {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.cx;
        let dy = e.clientY - this.joy.cy;
        const l = Math.hypot(dx, dy);
        const max = 70;
        if (l > max) {
          dx = (dx / l) * max;
          dy = (dy / l) * max;
        }
        this.joy.x = dx / max;
        this.joy.y = -dy / max;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (this.camTouch && e.pointerId === this.camTouch.id) {
        this.lookX += (e.clientX - this.camTouch.x) * 1.4;
        this.lookY += (e.clientY - this.camTouch.y) * 1.4;
        this.camTouch.x = e.clientX;
        this.camTouch.y = e.clientY;
      }
      return;
    }
    if (this.drag && e.pointerId === this.drag.id) {
      this.lookX += e.clientX - this.drag.x;
      this.lookY += e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    }
  }

  onUp(e) {
    if (e.pointerId === this.joy.id) {
      this.joy.id = null;
      this.joy.x = 0;
      this.joy.y = 0;
      this.knob.style.transform = '';
      this.joyEl.style.left = '';
      this.joyEl.style.top = '';
      this.joyEl.style.bottom = '';
      this.joyEl.classList.remove('active');
    }
    if (this.camTouch && e.pointerId === this.camTouch.id) this.camTouch = null;
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  }

  move() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
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

  takeLook() {
    const r = { x: this.lookX, y: this.lookY, zoom: this.zoom };
    this.lookX = 0;
    this.lookY = 0;
    this.zoom = 0;
    return r;
  }

  takeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  reset() {
    this.keys.clear();
    this.jumpQueued = false;
    this.jumpHeld = false;
    this.lookX = 0;
    this.lookY = 0;
  }
}
