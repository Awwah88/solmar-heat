// Solmar Heat — shared tuning, layout and story constants.
// Every number the game uses lives here, so a single file describes the
// city, the economy and the three story missions.

export const CITY = {
  // Roads run on lines that are multiples of 40, from -160 to 160.
  roadMin: -160,
  roadMax: 160,
  roadStep: 40,
  roadWidth: 10,
  // Blocks sit between the roads, centred on the +/-20 lines.
  blockHalf: 20,
  // South of the last road is open beach, then the sea.
  beachStart: 160,
  beachEnd: 222,
  seaStart: 222,
  // Nothing may drive or walk past this.
  bound: 262,
};

export const ECONOMY = {
  startMoney: 25,
  missionReward: [150, 250, 400],
  sprayCost: 75,
  pickupValue: 25,
  shellValue: 15,
  taxiFare: 40,
  pistolPrice: 0,
};

export const TUNING = {
  walkSpeed: 6,
  runSpeed: 9,
  carAccel: 15,
  carBrake: 34,
  carReverseAccel: 10,
  carMaxSpeed: 27,
  carMaxReverse: 9,
  carDrag: 0.55,
  carTurnRate: 2.1,
  trafficSpeed: 10,
  policeSpeed: 25,
  policeRamDamage: 3,
  policeRamCooldown: 0.8,
  wantedDecaySeconds: 45,
  bustHoldSeconds: 2.5,
  mission2Seconds: 240,
  markerRadius: 10,
  packageRadius: 9,
  pickupRadius: 4.5,
  healthRegenDelay: 10,
  healthRegenRate: 1.5,
  maxWanted: 5,
  trafficCount: 14,
  pedestrianCount: 24,
};

export const COLORS = {
  sky: 0x8ec9e8,
  fog: 0xa8d0e6,
  ground: 0x9aa08a,
  sidewalk: 0xb9b3a4,
  road: 0x3a3d42,
  roadLine: 0xd8d23a,
  sand: 0xe2cf9e,
  sea: 0x1e6f9e,
  seaDeep: 0x155a80,
  palmTrunk: 0x7a5230,
  palmLeaf: 0x2e8b57,
  lampPole: 0x2c2f33,
  lampGlow: 0xffe9a8,
};

// Six landmarks. `at` is the building, `marker` the roadside objective point.
export const LANDMARKS = [
  { id: 'garage', name: 'Marina Garage', at: [140, -100], marker: [140, -118], color: 0xe2725b, height: 14 },
  { id: 'hotel', name: 'Hotel Solmar', at: [20, 20], marker: [20, 4], color: 0xf2c14e, height: 34 },
  { id: 'lighthouse', name: 'Old Lighthouse', at: [-140, 192], marker: [-140, 162], color: 0xf5f0e6, height: 40 },
  { id: 'spray', name: 'Spray Shop', at: [-140, 60], marker: [-140, 42], color: 0x4ecdc4, height: 12 },
  { id: 'safehouse', name: 'Safehouse', at: [-140, 100], marker: [-140, 120], color: 0x95a5a6, height: 11 },
  { id: 'pier', name: 'The Pier', at: [60, 206], marker: [60, 200], color: 0x8b6f47, height: 6 },
];

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Mission 1 — Hot Wheels',
    brief: 'Dana owes the Marlin Club $400. Steal a car and take it to the Marina Garage.',
    objective: 'Steal a car, then drive to the Marina Garage',
    reward: 150,
    marker: [140, -118],
  },
  {
    id: 'sunset-courier',
    title: 'Mission 2 — Sunset Courier',
    brief: 'Three packages, one sunset. Deliver them all before the clock runs out.',
    objective: 'Deliver the packages to the Pier, the Hotel and the Lighthouse',
    reward: 250,
    seconds: 240,
    packages: [
      { name: 'The Pier', at: [60, 200] },
      { name: 'Hotel Solmar', at: [20, 4] },
      { name: 'Old Lighthouse', at: [-140, 162] },
    ],
  },
  {
    id: 'the-heat',
    title: 'Mission 3 — The Heat',
    brief: 'Three stars and the whole bay is looking for you. Lose the heat, then vanish.',
    objective: 'Lose your wanted level, then reach the Safehouse',
    reward: 400,
    marker: [-140, 120],
  },
];

export const PLAYER_SPAWN = { x: 80, z: -140, heading: Math.PI };
export const RED_CAR = { x: 83, z: -120, heading: Math.PI / 2, color: 0xd21f2b, name: 'Comet' };

// Parked cars besides the red one: [x, z, heading, color, name].
export const PARKED_CARS = [
  { x: -40, z: 116.5, heading: 0, color: 0x2e6fb7, name: 'Breeze' },
  { x: 116.5, z: 40, heading: Math.PI / 2, color: 0xe8e8e8, name: 'Comet' },
  { x: -116.5, z: -40, heading: -Math.PI / 2, color: 0x3fa34d, name: 'Vagabond' },
  { x: 40, z: 163.5, heading: Math.PI, color: 0xf2a541, name: 'Sunrise' },
  { x: -80, z: -116.5, heading: Math.PI, color: 0x8e44ad, name: 'Comet' },
];

// Cash pickups: [x, z]. The one on road x=120 sits on the courier route.
export const CASH_PICKUPS = [
  [120, 40],
  [-160, 200],
  [0, 200],
  [160, -160],
  [-40, -160],
  [160, 80],
];

// Golden shells on the beach, kept well off the driving lines (x=60, x=80).
export const SHELLS = [
  [44, 196],
  [-100, 198],
  [110, 210],
];

// Taxi stand: the cab waits here until the player drives it.
export const TAXI = { x: 3.5, z: -40, heading: 0, color: 0xf7c948 };

// Small deterministic random generator, used when ?seed= is given so a
// staged scene always places the same traffic and pedestrians.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
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

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Forward direction for a heading: heading 0 faces +z (south), PI/2 faces +x.
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}
