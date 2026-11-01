export const GAMES = [
  { id: 'lavaRun', name: 'Lav Parkuru', short: 'Lav', color: 0xff6a1a, css: '#ff6a1a', unlock: null, stages: 3, load: () => import('./minigames/lava-run/index.js') },
  { id: 'turboRace', name: 'Turbo Yarış', short: 'Yarış', color: 0x36a2ff, css: '#36a2ff', unlock: { level: 3 }, stages: 0, load: null },
  { id: 'puzzle', name: 'Zeka Kulesi', short: 'Zeka', color: 0xb86bff, css: '#b86bff', unlock: { coins: 150 }, stages: 0, load: null },
  { id: 'survive', name: 'Hayatta Kal', short: 'Hayat', color: 0x3ddc5a, css: '#3ddc5a', unlock: { level: 5 }, stages: 0, load: null },
  { id: 'starHunt', name: 'Yıldız Avı', short: 'Yıldız', color: 0xffc21a, css: '#ffc21a', unlock: { coins: 300 }, stages: 0, load: null },
];

export function gameById(id) {
  return GAMES.find((g) => g.id === id) || null;
}
