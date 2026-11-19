// Solmar Heat — shared constants, story data and the seeded RNG.
// Everything the other modules need to agree on lives here: the road
// grid, the landmarks, the mission script and the prices.

export const CITY = {
  HALF: 180, // city asphalt runs -180..180 on both axes
  BLOCK: 36, // city blocks are 36u squares
  ROAD_HALF: 5, // asphalt half-width of a road
};

// Road centrelines (18 + 36k) and block centres (36k).
export const ROADS = [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162];
export const BLOCKS = [-144, -108, -72, -36, 0, 36, 72, 108, 144];

// The six landmarks. Garage, hotel, spray shop and safehouse sit on
// block centres; the lighthouse and the pier sit on the south beach.
export const LANDMARKS = {
  garage: { x: -144, z: -144, w: 26, d: 20, name: 'Marina Garage' },
  hotel: { x: 144, z: -144, w: 16, d: 16, name: 'Hotel Solmar', tall: true },
  lighthouse: { x: 150, z: 185, w: 12, d: 12, name: 'Old Lighthouse' },
  spray: { x: -54, z: 54, w: 12, d: 12, name: 'Spray Shop' },
  safehouse: { x: 54, z: -54, w: 12, d: 12, name: 'Safehouse' },
  pier: { x: 60, z: 196, w: 10, d: 26, name: 'The Pier', noCollider: true },
};

// Mission trigger points (all on roads or on the beach, never inside
// a building) and their trigger radii.
export const MARKERS = {
  garage: { x: -144, z: -148, r: 10 },
  hotel: { x: 144, z: -144, r: 10 },
  pier: { x: 60, z: 190, r: 10 },
  lighthouse: { x: 150, z: 176, r: 10 },
  safehouse: { x: 54, z: -54, r: 12 },
  spray: { x: -54, z: 54, r: 12 },
  goldCar: { x: 126, z: -144 },
};

// The story. Dana "Dash" Reyes owes the Marlin Club $400.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'Hot Wheels',
    reward: 150,
    objective: 'Steal a car and take it to the Marina Garage',
  },
  {
    id: 'm2',
    title: 'Sunset Courier',
    reward: 100,
    packageReward: 50,
    timeLimit: 240,
    objective: 'Deliver 3 packages before sunset — Hotel, Pier, Safehouse',
  },
  {
    id: 'm3',
    title: 'The Heat',
    reward: 400,
    objective: 'Lose the heat at the Spray Shop, then reach the Safehouse',
  },
  {
    id: 'm4',
    title: "Marlin's Debt",
    reward: 300,
    objective: 'Steal the gold Marlin GT, drop it at the Old Lighthouse, escape home',
  },
];

export const PRICES = {
  spray: 75,
  taxi: 40,
  pickup: 25,
  bustedFine: 50,
};

export const SPAWN = { x: 80, z: -126, heading: Math.PI / 2 };

// Parked cars, all sitting on road lines so they can be stolen.
export const PARKED_CARS = [
  { x: -54, z: 120, color: 0xd23c2a },
  { x: 54, z: -126, color: 0x2a6fd2 },
  { x: 126, z: 54, color: 0xe8c832 },
  { x: -126, z: -18, color: 0x37b24d },
  { x: 18, z: -54, color: 0x8b5cf6 },
];

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 24;
export const DEBT = 400;

// Warm Solmar Bay palette: sun-bleached stucco, terracotta, sand,
// turquoise sea.
export const PALETTE = {
  sky: 0x8ecfeb,
  asphalt: 0x3a3f46,
  roadLine: 0xd8d3c0,
  sidewalk: 0x9aa0a3,
  sand: 0xe6cf9e,
  sea: 0x1e8fa8,
  grass: 0x7fae62,
  building: [0xf2e3c6, 0xe8b48a, 0xf6d9a0, 0xd98a6c, 0xcfe0d8, 0xe9c46a, 0xf4a261],
  roof: [0xb5533c, 0x8a5a44, 0x5d6b7a, 0x7a4a3a],
  car: [0xd23c2a, 0x2a6fd2, 0xe8c832, 0x37b24d, 0x8b5cf6, 0xe8e8e8, 0x222831, 0xef8354],
};

// Deterministic RNG so the city is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

// Cash pickups: fixed sidewalk spots, kept clear of every mission
// walk segment and of the playtest's driving routes, so a pickup can
// never complete a mission leg by accident. Collected on foot only.
export const PICKUP_SPOTS = [
  { x: 25, z: 90 }, { x: -83, z: 25 }, { x: 97, z: -83 }, { x: -11, z: -119 },
  { x: 133, z: 97 }, { x: -119, z: -11 }, { x: 61, z: 133 }, { x: -47, z: -119 },
];
