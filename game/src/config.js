// Solmar Heat — shared constants and helpers.
// Everything the modules agree on lives here: the city grid, the palette,
// the story text, the mission table, and a few small math helpers plus a
// seeded random generator so every run builds the same city.

export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An open-world crime story in Solmar Bay';

// --- Small math helpers -------------------------------------------------
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate between two headings along the shorter arc.
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Seeded PRNG (mulberry32). Same seed, same city — traffic, pedestrians
// and buildings land identically on every load, which keeps screenshots
// reproducible.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- City geometry ------------------------------------------------------
// Roads form a 9x9 grid, one every 40 units from -160 to 160. The blocks
// between roads are 30-unit squares; the beach starts south of z = 172.
export const CITY = {
  half: 180,
  roadStep: 40,
  roadHalfWidth: 5,
  blockSize: 30,
  beachZ: 172,
  waterZ: 196,
};

export const COLORS = {
  skyTop: 0x7ec8f7,
  skyBottom: 0xffe3b3,
  sun: 0xfff2cc,
  groundSand: 0xd9b380,
  groundGrass: 0x7fae62,
  road: 0x33363d,
  roadLine: 0xf5e9c8,
  sidewalk: 0xb8b2a4,
  buildingPalette: [0xf2e3c6, 0xf7b6a0, 0x8fd0c9, 0xf6d98a, 0xe8a2b4, 0xa8c6e8, 0xffffff, 0xffc98a],
  palmTrunk: 0x8a6b46,
  palmLeaf: 0x3f9e4d,
  water: 0x2e9fc4,
  police: 0x1c2733,
  policeLightR: 0xff2a2a,
  policeLightB: 0x2a6bff,
};

// --- Story --------------------------------------------------------------
// All names, places and people are invented for this game.
export const STORY = {
  hero: 'Dana "Dash" Reyes',
  heroLine: 'A courier with a fast car, a faster temper, and a debt to pay.',
  intro:
    'Solmar Bay is sun, salt and stolen chrome. Dana Reyes owes the Marlin Club $400 by Sunday. ' +
    'Three jobs stand between Dana and freedom: steal a ride, run the sunset courier route, and lose the heat. ' +
    'Finish all three and the city is yours.',
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'MISSION 1 — HOT WHEELS',
    brief: 'Steal a car. Any car. Then drive it to the Marina Garage marker.',
    reward: 150,
    steps: [
      'Get in a car (walk up to one and press E)',
      'Drive to the yellow marker at the Marina Garage',
    ],
  },
  {
    id: 'sunset-courier',
    title: 'MISSION 2 — SUNSET COURIER',
    brief: 'Three packages, three drop-offs, 4 minutes on the clock. The clients pay in cash.',
    reward: 250,
    timeLimit: 240,
    steps: [
      'Deliver package 1 to the Pier',
      'Deliver package 2 to the Hotel Solmar',
      'Deliver package 3 to the Old Lighthouse',
    ],
  },
  {
    id: 'the-heat',
    title: 'MISSION 3 — THE HEAT',
    brief: 'The cops are onto you: 3 stars. Lose them, then reach the Safehouse.',
    reward: 400,
    steps: ['Lose your wanted level (Spray Shop clears it for $75)', 'Reach the blue Safehouse marker'],
  },
];

export const SIDE_JOBS = {
  taxiFare: 60,
  cashPickup: 25,
  sprayCost: 75,
  bustedFine: 100,
  wastedFine: 150,
};

export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse drag', 'Look around'],
  ['Shift', 'Sprint'],
  ['E', 'Enter / exit car, deliver, pick up'],
  ['Space', 'Handbrake (in car)'],
  ['F', 'Punch'],
  ['Click', 'Shoot (after Mission 2)'],
  ['T', 'Start a taxi fare'],
  ['M', 'Music on / off'],
  ['P / Esc', 'Pause'],
  ['R', 'Restart from last save'],
];
