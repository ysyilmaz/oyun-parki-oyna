export const H = 6;
export const ROOM = { x0: -17, x1: 17, z0: -10, z1: 10 };
export const WALL_T = 0.4;
export const FRONT_DOOR = { x0: -5, x1: 5 };
export const ELEV = { cx: -19.3, cz: 2.5, hx: 1.95, hz: 1.65, door0: 1.0, door1: 4.0 };
export const SHOP = { x: 31, z: -8, w: 12, d: 7, rx: 31, rz: 0.8, ring: 1.6, pedestals: [[25.6, -2.4], [27.8, -2.4], [34.2, -2.4], [36.4, -2.4]], waitX: 12, waitZ: 15.5 };
export const SPAWN = { x: 24, z: 7, yaw: Math.PI * 0.75 };
export const WORLD = { x0: -70, x1: 70, z0: -55, z1: 60 };

const side = Math.PI / 2 - 0.45;
export const STATIONS = [
  { x: -10.5, z: -7.2, yaw: 0 },
  { x: -3.5, z: -7.2, yaw: 0 },
  { x: 3.5, z: -7.2, yaw: 0 },
  { x: 10.5, z: -7.2, yaw: 0 },
  { x: -13.2, z: -1.4, yaw: side },
  { x: 13.2, z: -1.4, yaw: -side },
  { x: -13.2, z: 6.6, yaw: side },
  { x: 13.2, z: 6.6, yaw: -side },
];

export const PAD_OFF = 2.65;
export const ST_BOX = { x0: -1.95, x1: 1.95, z0: -1.9, z1: 1.3 };

export function stationLocal(st, lx, lz) {
  const s = Math.sin(st.yaw);
  const c = Math.cos(st.yaw);
  return { x: st.x + lx * c + lz * s, z: st.z - lx * s + lz * c };
}

export function padPos(st) {
  return stationLocal(st, 0, PAD_OFF);
}

export function insideRoom(x, z, m = 0) {
  return x > ROOM.x0 + m && x < ROOM.x1 - m && z > ROOM.z0 + m && z < ROOM.z1 - m;
}

export function insideCabin(x, z, m = 0) {
  return Math.abs(x - ELEV.cx) < ELEV.hx - m && Math.abs(z - ELEV.cz) < ELEV.hz - m;
}

export function inTower(x, z) {
  return insideRoom(x, z) || insideCabin(x, z, -0.3);
}

export function wallBoxes(f) {
  const t = WALL_T / 2;
  const b = [];
  b.push([ROOM.x0 - t, ROOM.x1 + t, ROOM.z0 - t, ROOM.z0 + t]);
  b.push([ROOM.x1 - t, ROOM.x1 + t, ROOM.z0, ROOM.z1]);
  b.push([ROOM.x0 - t, ROOM.x0 + t, ROOM.z0, ELEV.door0]);
  b.push([ROOM.x0 - t, ROOM.x0 + t, ELEV.door1, ROOM.z1]);
  if (f === 0) {
    b.push([ROOM.x0 - t, FRONT_DOOR.x0, ROOM.z1 - t, ROOM.z1 + t]);
    b.push([FRONT_DOOR.x1, ROOM.x1 + t, ROOM.z1 - t, ROOM.z1 + t]);
  } else b.push([ROOM.x0 - t, ROOM.x1 + t, ROOM.z1 - t, ROOM.z1 + t]);
  const ex0 = ELEV.cx - ELEV.hx;
  const ez0 = ELEV.cz - ELEV.hz;
  const ez1 = ELEV.cz + ELEV.hz;
  b.push([ex0 - 0.3, ex0, ez0 - 0.3, ez1 + 0.3]);
  b.push([ex0 - 0.3, ROOM.x0, ez0 - 0.3, ez0]);
  b.push([ex0 - 0.3, ROOM.x0, ez1, ez1 + 0.3]);
  return b;
}

export const OUTDOOR_BOXES = [
  [SHOP.x - SHOP.w / 2 - 0.3, SHOP.x + SHOP.w / 2 + 0.3, SHOP.z - SHOP.d / 2 - 0.3, SHOP.z + SHOP.d / 2 + 0.5],
  [SHOP.pedestals[0][0] - 0.9, SHOP.pedestals[1][0] + 0.9, SHOP.z + SHOP.d / 2, SHOP.pedestals[0][1] + 0.9],
  [SHOP.pedestals[2][0] - 0.9, SHOP.pedestals[3][0] + 0.9, SHOP.z + SHOP.d / 2, SHOP.pedestals[2][1] + 0.9],
  [-6.0, -5.2, 12.6, 13.4],
  [5.2, 6.0, 12.6, 13.4],
];
