// Solmar Heat — shared constants, coordinates and small helpers.
// The city is a 9x9 grid of blocks. Roads run on the CENTRES lines (every
// 36 units); block centres sit halfway between them. All gameplay positions
// are roadside markers so missions never ask the player to drive into a wall.

export const WORLD_HALF = 180;
export const ROAD_CENTRES = [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162];
export const BLOCK_CENTRES = [-144, -108, -72, -36, 0, 36, 72, 108, 144];
export const ROAD_WIDTH = 14;

export const SPAWN = { x: 90, z: -144, heading: 0 };

export const COLORS = {
  sky: 0x8ec3e8,
  fog: 0x9fc4de,
  ground: 0x77894f,
  sand: 0xdcc78f,
  sea: 0x1e6fb0,
  road: 0x2c2c31,
  roadLine: 0xd8c25a,
  sidewalk: 0x9aa0a8,
  building: [0xb5654a, 0x4a7a9e, 0x9e8a4a, 0x6a5a8e, 0xa85a6e, 0x5a8e6a, 0x8e6a3a, 0x3a6a8e],
  roof: 0x3a3f46,
  palmTrunk: 0x7a5a34,
  palmTop: 0x3f8e4a,
  lamp: 0x2a2e33,
};

export const LANDMARKS = [
  { id: "garage", name: "Marina Garage", x: 162, z: -126, block: [144, -144], tint: 0xd86a2a },
  { id: "hotel", name: "Hotel Solmar", x: 54, z: -18, block: [36, 0], tint: 0x2a9ed8 },
  { id: "lighthouse", name: "Old Lighthouse", x: -162, z: 126, block: [-144, 144], tint: 0xf2e6c8 },
  { id: "spray", name: "Spray Shop", x: -162, z: 54, block: [-144, 36], tint: 0x37d67a },
  { id: "safehouse", name: "Safehouse", x: -162, z: 90, block: [-144, 108], tint: 0x8e6ad8 },
  { id: "pier", name: "The Pier", x: 162, z: 126, block: [144, 144], tint: 0xd8a52a },
];

export const RED_SEDAN = { x: 154, z: -126 };
export const GOLD_GT = { x: 46, z: -18 };
export const PACKAGES = [
  { x: 54, z: 90 },
  { x: -54, z: 162 },
  { x: 126, z: 18 },
];
export const CASH_PICKUPS = [
  { x: 90, z: 18 },
  { x: -90, z: -54 },
  { x: 18, z: -90 },
];
export const PARKED_CARS = [
  { x: 154, z: -126, color: 0xc22a1e, sedan: true },
  { x: -18, z: 126, color: 0x3a6ad8, sedan: false },
  { x: 126, z: -54, color: 0xd8d8d8, sedan: false },
  { x: -126, z: 18, color: 0x2ad8a5, sedan: false },
  { x: 54, z: 126, color: 0xd8a52a, sedan: false },
];
export const TAXI_STAND = { x: 18, z: 54 };

export const MISSION_DEFS = [
  { id: "m1", title: "Hot Wheels", reward: 150, blurb: "Steal the red sedan parked at Marina Garage." },
  { id: "m2", title: "Sunset Courier", reward: 250, blurb: "Deliver 3 packages around Solmar Bay in 240 seconds." },
  { id: "m3", title: "The Heat", reward: 400, blurb: "Lose the 3-star manhunt, then slip to the Safehouse." },
  { id: "m4", title: "Marlin's Debt", reward: 300, blurb: "Steal the gold Marlin GT, drop it at the Old Lighthouse under 4 stars, then vanish." },
];
export const DEBT = 400;
export const WIN_BONUS = 25;
export const SPRAY_COST = 75;
export const TAXI_FARE = 30;
export const CASH_VALUE = 25;
export const MISSION_TIME = 240;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Forward vector for a heading: heading 0 faces +z, increasing turns left.
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

// On-foot right vector for a heading.
export function rightOf(heading) {
  return { x: -Math.cos(heading), z: Math.sin(heading) };
}

// Deterministic PRNG so a ?seed= renders the same city every time.
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
