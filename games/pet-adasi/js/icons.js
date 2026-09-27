const O = '#1d1b3a';

export const ICONS = {
  coin: `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="26" fill="#e08a00" stroke="${O}" stroke-width="4"/><circle cx="32" cy="30" r="26" fill="#ffc21a" stroke="${O}" stroke-width="4"/><circle cx="32" cy="30" r="17" fill="none" stroke="#e08a00" stroke-width="4"/><path d="M32 19l3.2 6.6 7.2 1-5.2 5 1.3 7.2L32 35.4l-6.5 3.4 1.3-7.2-5.2-5 7.2-1z" fill="#fff3a8"/><ellipse cx="20" cy="17" rx="6" ry="3.5" fill="#fff" opacity=".8" transform="rotate(-35 20 17)"/></svg>`,
  gem: `<svg viewBox="0 0 64 64"><path d="M32 58L6 24l10-14h32l10 14z" fill="#2aa8ff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M6 24h52M16 10l8 14 8-14 8 14 8-14M24 24l8 34 8-34" fill="none" stroke="${O}" stroke-width="2.5" stroke-linejoin="round" opacity=".55"/><path d="M16 10h16l-8 14H6z" fill="#b9f6ff"/><path d="M32 10h16l-8 14z" fill="#7ee8ff"/></svg>`,
  paw: `<svg viewBox="0 0 64 64"><g fill="#fff" stroke="${O}" stroke-width="4"><ellipse cx="32" cy="42" rx="15" ry="13"/><ellipse cx="14" cy="27" rx="7" ry="8.5"/><ellipse cx="25" cy="16" rx="7" ry="8.5"/><ellipse cx="39" cy="16" rx="7" ry="8.5"/><ellipse cx="50" cy="27" rx="7" ry="8.5"/></g><ellipse cx="32" cy="44" rx="8" ry="6" fill="#ffb3c8"/></svg>`,
  cart: `<svg viewBox="0 0 64 64"><path d="M14 22h40l-5 22H19z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M4 12h8l7 32" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="53" r="5" fill="#ffd23a" stroke="${O}" stroke-width="4"/><circle cx="46" cy="53" r="5" fill="#ffd23a" stroke="${O}" stroke-width="4"/><circle cx="34" cy="33" r="7" fill="#ffc21a" stroke="${O}" stroke-width="3"/></svg>`,
  book: `<svg viewBox="0 0 64 64"><path d="M10 12c8-3 16-3 22 3 6-6 14-6 22-3v40c-8-3-16-3-22 3-6-6-14-6-22-3z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M32 15v40" stroke="${O}" stroke-width="4"/><path d="M21 38c-5-4-6-8-3-10 2-1 3 0 3 1 0-1 1-2 3-1 3 2 2 6-3 10z" fill="#ff4f7a"/><path d="M43 26l2 4 4.5.6-3.3 3 .8 4.4-4-2.2-4 2.2.8-4.4-3.3-3 4.5-.6z" fill="#ffc21a"/></svg>`,
  gear: `<svg viewBox="0 0 64 64"><path d="M28 4h8l2 8 6 3 7-4 6 6-4 7 3 6 8 2v8l-8 2-3 6 4 7-6 6-7-4-6 3-2 8h-8l-2-8-6-3-7 4-6-6 4-7-3-6-8-2v-8l8-2 3-6-4-7 6-6 7 4 6-3z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="#aab2d9" stroke="${O}" stroke-width="4"/></svg>`,
  bolt: `<svg viewBox="0 0 64 64"><path d="M36 4L10 36h18l-6 24 28-34H32z" fill="#ffd23a" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M32 12L18 31" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`,
  star: `<svg viewBox="0 0 64 64"><path d="M32 5l8 17 18 2-13 13 3 19-16-9-16 9 3-19L6 24l18-2z" fill="#ffd23a" stroke="${O}" stroke-width="4" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 64 64"><path d="M14 18h36l-4 40H18z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M8 16h48M24 16V8h16v8M26 26v24M38 26v24" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/></svg>`,
  x: `<svg viewBox="0 0 64 64"><path d="M14 14l36 36M50 14L14 50" stroke="${O}" stroke-width="14" stroke-linecap="round"/><path d="M14 14l36 36M50 14L14 50" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>`,
  lock: `<svg viewBox="0 0 64 64"><path d="M20 28V20a12 12 0 0124 0v8" fill="none" stroke="${O}" stroke-width="7"/><rect x="10" y="27" width="44" height="32" rx="8" fill="#ffc21a" stroke="${O}" stroke-width="4"/><circle cx="32" cy="41" r="5" fill="${O}"/></svg>`,
  music: `<svg viewBox="0 0 64 64"><path d="M24 46V12l30-6v34" fill="none" stroke="${O}" stroke-width="5" stroke-linejoin="round"/><ellipse cx="17" cy="47" rx="9" ry="7" fill="#ff6fb5" stroke="${O}" stroke-width="4"/><ellipse cx="47" cy="41" rx="9" ry="7" fill="#ff6fb5" stroke="${O}" stroke-width="4"/></svg>`,
  sound: `<svg viewBox="0 0 64 64"><path d="M8 24h12l14-12v40L20 40H8z" fill="#3a8bff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M42 22c4 5 4 15 0 20M49 15c8 9 8 25 0 34" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/></svg>`,
  boot: `<svg viewBox="0 0 64 64"><path d="M16 8h18v24l18 8c4 2 6 5 6 9v5H10V30z" fill="#ff5f5f" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M10 48h48" stroke="${O}" stroke-width="4"/><path d="M4 18h10M2 28h10M6 38h6" stroke="#3a8bff" stroke-width="4" stroke-linecap="round"/></svg>`,
  magnet: `<svg viewBox="0 0 64 64"><path d="M12 10h14v24a6 6 0 0012 0V10h14v24a20 20 0 01-40 0z" fill="#ff4f5a" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M12 10h14v9H12zM38 10h14v9H38z" fill="#dfe3f0" stroke="${O}" stroke-width="4" stroke-linejoin="round"/></svg>`,
  up: `<svg viewBox="0 0 64 64"><path d="M32 8L8 34h14v20h20V34h14z" fill="#fff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/></svg>`,
  egg: `<svg viewBox="0 0 64 64"><path d="M32 4C19 4 10 24 10 38a22 22 0 0044 0C54 24 45 4 32 4z" fill="#fff6c9" stroke="${O}" stroke-width="4"/><path d="M11 36l7-5 7 5 7-5 7 5 7-5 7 5" fill="none" stroke="#8fe06a" stroke-width="5" stroke-linejoin="round"/><circle cx="24" cy="20" r="4" fill="#8fe06a"/><circle cx="38" cy="16" r="3" fill="#8fe06a"/></svg>`,
  check: `<svg viewBox="0 0 64 64"><path d="M12 34l14 14 26-30" fill="none" stroke="${O}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 34l14 14 26-30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  merge: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#ffc21a" stroke="${O}" stroke-width="4"/><path d="M32 14l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#fff"/></svg>`,
  gate: `<svg viewBox="0 0 64 64"><path d="M8 58V22a24 18 0 0148 0v36" fill="#dfe3f0" stroke="${O}" stroke-width="4"/><path d="M18 58V26a14 12 0 0128 0v32" fill="#8fe06a" stroke="${O}" stroke-width="4"/><rect x="24" y="30" width="16" height="14" rx="4" fill="#ffc21a" stroke="${O}" stroke-width="3"/></svg>`,
  pause: `<svg viewBox="0 0 64 64"><rect x="14" y="10" width="13" height="44" rx="4" fill="#fff" stroke="${O}" stroke-width="4"/><rect x="37" y="10" width="13" height="44" rx="4" fill="#fff" stroke="${O}" stroke-width="4"/></svg>`,
  play: `<svg viewBox="0 0 64 64"><path d="M18 8l38 24-38 24z" fill="#fff" stroke="${O}" stroke-width="5" stroke-linejoin="round"/></svg>`,
  mute: `<svg viewBox="0 0 64 64"><path d="M8 24h12l14-12v40L20 40H8z" fill="#aab2d9" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M42 24l16 16M58 24L42 40" stroke="#ff4f5a" stroke-width="6" stroke-linecap="round"/></svg>`,
  mouse: `<svg viewBox="0 0 64 64"><rect x="14" y="6" width="36" height="52" rx="18" fill="#fff" stroke="${O}" stroke-width="4"/><path d="M32 6v20M14 26h36" stroke="${O}" stroke-width="4"/><path d="M16 24V22a16 16 0 0114-14v16z" fill="#ffd23a"/></svg>`,
  rebirth: `<svg viewBox="0 0 64 64"><path d="M32 8a24 24 0 1 1-22 14" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M32 8a24 24 0 1 1-22 14" fill="none" stroke="#b45cff" stroke-width="5" stroke-linecap="round"/><path d="M4 14l8 12 12-7" fill="#b45cff" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><path d="M32 22l3.5 7 7.5 1-5.5 5 1.5 7.5L32 39l-6.5 3.5L27 35l-5.5-5 7.5-1z" fill="#ffd23a" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  rotate: `<svg viewBox="0 0 64 64"><path d="M12 32a20 12 0 1 0 20-12" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M12 32a20 12 0 1 0 20-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M28 10l10 10-10 8z" fill="#fff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`,
  level: `<svg viewBox="0 0 64 64"><path d="M32 6l24 22H42v26H22V28H8z" fill="#4fe36a" stroke="${O}" stroke-width="4" stroke-linejoin="round"/></svg>`,
};

export function svgUrl(name) {
  return 'data:image/svg+xml,' + encodeURIComponent(ICONS[name].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
}

export function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const n = el.getAttribute('data-icon');
    if (ICONS[n] && !el.firstChild) el.innerHTML = ICONS[n];
  });
}

export function injectIconStyles() {
  const st = document.createElement('style');
  st.textContent = `.ic-coin{background-image:url("${svgUrl('coin')}")}.ic-gem{background-image:url("${svgUrl('gem')}")}.ic-bolt{background-image:url("${svgUrl('bolt')}")}.ic-lock{background-image:url("${svgUrl('lock')}")}`;
  document.head.appendChild(st);
}

export function icon(name, cls = 'cur-ic') {
  return `<span class="${cls}" data-icon="${name}">${ICONS[name]}</span>`;
}
