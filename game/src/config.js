// Solmar Heat — world constants, story data and tuning (fresh for Round 15).
// The city is a 36u grid: roads run on centrelines, blocks sit between them.

export const PITCH = 36;
export const ROAD_HALF = 5;
export const ROADS = [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162];
export const BLOCKS = [-144, -108, -72, -36, 0, 36, 72, 108, 144];
export const CITY_HALF = 180;
export const MAX_BUILD_OFFSET = 10; // building collider edge stays within 10u of its block centre

export const STORY = {
  hero: 'Dana "Dash" Reyes',
  debt: 400,
  creditor: 'Marlin Club',
  city: 'Solmar Bay',
};

export const SPAWN = { x: 90, z: -144, heading: Math.PI };

// Landmarks: the building sits in a block; the marker is the roadside point
// missions and the playthrough navigate to.
export const LANDMARKS = [
  { id: 'garage', name: 'Marina Garage', block: [144, -144], marker: [162, -126], color: 0x2e6f8e, tall: 10 },
  { id: 'hotel', name: 'Hotel Solmar', block: [36, -36], marker: [54, -18], color: 0xc9a227, tall: 34 },
  { id: 'lighthouse', name: 'Old Lighthouse', block: [-144, 144], marker: [-162, 126], color: 0xe8e0cc, tall: 26 },
  { id: 'spray', name: 'Spray Shop', block: [-144, 36], marker: [-162, 54], color: 0x7a4fd0, tall: 8 },
  { id: 'safehouse', name: 'Safehouse', block: [-144, 72], marker: [-162, 90], color: 0x3f7d4e, tall: 9 },
  { id: 'pier', name: 'The Pier', block: [144, 108], marker: [162, 126], color: 0x8a6b46, tall: 6 },
];

export const PARKED = {
  redSedan: { x: 154, z: -126, heading: Math.PI / 2, color: 0xc22a2a, name: 'Red Sedan' },
  goldGt: { x: 46, z: -18, heading: -Math.PI / 2, color: 0xd8a928, name: 'Marlin GT' },
};

export const PACKAGES = [
  [54, 90],
  [-54, 162],
  [126, 18],
];

export const CASH_SPOTS = [
  [18, -90], [-90, 18], [90, 126], [-126, -54],
  [54, -90], [-18, 90], [126, -54], [-90, -126],
];

export const HEALTH_SPOTS = [
  [-18, -54], [90, 54], [-126, 126], [18, 126],
];

export const TAXI_RANKS = [
  [54, -90],
  [-90, 54],
  [126, 90],
];

export const MISSIONS = [
  { id: 1, title: 'Hot Wheels', reward: 150, brief: 'Steal the red sedan parked by the Marina Garage.' },
  { id: 2, title: 'Sunset Courier', reward: 250, brief: 'Deliver 3 packages around Solmar Bay before the timer runs out.', time: 240 },
  { id: 3, title: 'The Heat', reward: 400, brief: 'You are at 3 stars. Lose the heat, then reach the Safehouse.' },
  { id: 4, title: "Marlin's Debt", reward: 300, brief: 'Steal the gold Marlin GT at Hotel Solmar, drop it at the Old Lighthouse under 4 stars, then escape to the Safehouse.' },
];

export const TUNING = {
  walkSpeed: 7,
  runSpeed: 10,
  carAccel: 16,
  carBrake: 26,
  carMaxSpeed: 26,
  carReverseMax: 9,
  carTurn: 1.9,
  carGrip: 0.92,
  playerRadius: 0.9,
  carRadius: 2.1,
  sprayCost: 75,
  sprayRadius: 7,
  bustedFine: 75,
  wastedFine: 75,
  cashPickup: 25,
  healthPickup: 30,
  taxiBase: 50,
  maxHealth: 100,
  maxWanted: 5,
  policeTopSpeed: 17,
  trafficSpeed: 10,
  punchDamage: 34,
  pistolDamage: 55,
  punchRange: 2.6,
  shootRange: 70,
};

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

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
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
  return dx * dx + dz * dz;
}
