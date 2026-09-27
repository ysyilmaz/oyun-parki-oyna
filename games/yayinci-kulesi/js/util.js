export function clamp(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return a + (b - a) * (1 - Math.exp(-lambda * dt));
}

export function angleDamp(a, b, lambda, dt) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hsl(h, s, l) {
  return `hsl(${h},${s}%,${l}%)`;
}
