const keys = new Set();
const pressed = new Set();
const touch = { left: false, right: false, gas: false, brake: false, drift: false, item: false };
let itemTapped = false;

const MAP = {
  KeyW: 'gas', ArrowUp: 'gas',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'item', KeyE: 'item',
  ShiftLeft: 'drift', ShiftRight: 'drift',
  KeyR: 'respawn',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute'
};

window.addEventListener('keydown', e => {
  const a = MAP[e.code];
  if (!a) return;
  if (['gas', 'brake', 'left', 'right', 'drift', 'item'].includes(a)) e.preventDefault();
  if (!keys.has(a)) pressed.add(a);
  keys.add(a);
});

window.addEventListener('keyup', e => {
  const a = MAP[e.code];
  if (a) keys.delete(a);
});

window.addEventListener('blur', () => keys.clear());

export const input = {
  autoGas: false,
  touchAutoGas: false,
  get steer() {
    let s = 0;
    if (keys.has('left') || touch.left) s -= 1;
    if (keys.has('right') || touch.right) s += 1;
    return s;
  },
  get gas() { return keys.has('gas') || touch.gas || this.autoGas || this.touchAutoGas; },
  get gasPressedManually() { return keys.has('gas') || touch.gas; },
  get brake() { return keys.has('brake') || touch.brake; },
  get drift() { return keys.has('drift') || touch.drift; },
  consume(a) {
    if (a === 'item' && itemTapped) { itemTapped = false; return true; }
    if (pressed.has(a)) { pressed.delete(a); return true; }
    return false;
  },
  clearPressed() { pressed.clear(); itemTapped = false; },
  touch,
  tapItem() { itemTapped = true; },
  pressGas() { pressed.add('gas'); }
};

export function bindTouch(root) {
  root.querySelectorAll('[data-touch]').forEach(el => {
    const k = el.dataset.touch;
    const down = e => {
      e.preventDefault();
      if (k === 'item') { input.tapItem(); el.classList.add('on'); return; }
      if (k === 'gastoggle') { input.touchAutoGas = !input.touchAutoGas; el.classList.toggle('on', input.touchAutoGas); if (input.touchAutoGas) input.pressGas(); return; }
      if (k === 'gas') input.pressGas();
      touch[k] = true;
      el.classList.add('on');
    };
    const up = e => {
      e.preventDefault();
      if (k === 'gastoggle') return;
      if (k !== 'item') touch[k] = false;
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  });
}
