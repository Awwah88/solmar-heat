// Solmar Heat — config.js
// One clear job: every constant, name and number the game shares, plus a
// deterministic random generator so the city looks the same every run.
export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An open-world crime story in Solmar Bay';

// City layout: a 9x9 road grid. Roads run every 40 units from -160 to 160.
// Blocks are the 32-unit squares between roads; the beach is south (z > 170).
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

// Deterministic RNG (mulberry32) so the city, traffic and pedestrians are
// identical on every load — screenshots stay reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
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

// Story and mission definitions. All names, places and people are original.
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
