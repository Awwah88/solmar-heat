// Solmar Heat — world constants, story data and tuning (Round 17).
// Everything the other modules need lives here so the layout stays in one place.

export const ROADS = [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162];
export const BLOCKS = [-144, -108, -72, -36, 0, 36, 72, 108, 144];
export const CITY_HALF = 180;
export const ROAD_HALF_WIDTH = 6;

export const SPAWN = { x: 90, z: -144 };

// Landmarks: marker = gameplay point on/near a road, block = building block centre.
export const LANDMARKS = {
  garage: { label: 'Marina Garage', marker: { x: 162, z: -126 }, block: { x: 144, z: -108 }, kind: 'garage' },
  hotel: { label: 'Hotel Solmar', marker: { x: 54, z: -18 }, block: { x: 36, z: 0 }, kind: 'hotel' },
  lighthouse: { label: 'Old Lighthouse', marker: { x: -162, z: 126 }, block: { x: -144, z: 144 }, kind: 'lighthouse' },
  spray: { label: 'Spray Shop', marker: { x: -162, z: 54 }, block: { x: -144, z: 36 }, kind: 'spray' },
  safehouse: { label: 'Safehouse', marker: { x: -162, z: 90 }, block: { x: -144, z: 108 }, kind: 'safehouse' },
  pier: { label: 'The Pier', marker: { x: 162, z: 126 }, block: { x: 144, z: 126 }, kind: 'pier' },
  casino: { label: 'Casino Solmar', marker: { x: 126, z: -54 }, block: { x: 108, z: -72 }, kind: 'casino' },
  boardwalk: { label: 'Solmar Boardwalk', marker: { x: 126, z: 126 }, block: { x: 108, z: 126 }, kind: 'boardwalk' },
  bank: { label: 'Solmar Bank', marker: { x: 54, z: 140 }, block: { x: 36, z: 144 }, kind: 'bank' },
  airport: { label: 'Solmar Airport', marker: { x: 150, z: -168 }, block: { x: 144, z: -144 }, kind: 'airport' },
};

// Parked story cars (positions are on roads, next to their landmark).
export const PARKED = {
  red: { x: 154, z: -126, kind: 'sedan', color: 0xc22424, label: 'Red Sedan' },
  gold: { x: 46, z: -18, kind: 'sport', color: 0xd8a400, label: 'Marlin GT' },
  limo: { x: 118, z: -54, kind: 'limo', color: 0x14141c, label: 'Marlin Limo' },
  van: { x: 54, z: 126, kind: 'van', color: 0x2e4a68, label: 'Armored Van' },
};

export const PACKAGES = [
  { x: 54, z: 90 },
  { x: -54, z: 162 },
  { x: 126, z: 18 },
];

export const DOUBLOONS = [
  { x: 18, z: 18 }, { x: -18, z: -90 }, { x: 90, z: 54 }, { x: -90, z: -18 },
  { x: 126, z: -126 }, { x: -126, z: 90 }, { x: 54, z: -126 }, { x: -54, z: 54 },
  { x: 162, z: -18 }, { x: -162, z: -90 }, { x: 18, z: 126 }, { x: -126, z: -162 },
];

export const RACES = [
  {
    id: 0, name: 'Pier Sprint', start: { x: 162, z: 126 }, reward: 100, bonus: 50,
    checkpoints: [{ x: 162, z: -18 }, { x: 18, z: -18 }, { x: 18, z: 126 }],
  },
  {
    id: 1, name: 'Casino Loop', start: { x: 126, z: -54 }, reward: 100, bonus: 50,
    checkpoints: [{ x: -18, z: -54 }, { x: -18, z: 90 }, { x: 126, z: 90 }],
  },
  {
    id: 2, name: 'Runway Dash', start: { x: 150, z: -168 }, reward: 100, bonus: 50,
    checkpoints: [{ x: -126, z: -162 }, { x: -126, z: 18 }, { x: 126, z: 18 }],
  },
];

export const MISSIONS = [
  { id: 1, title: 'Hot Wheels', reward: 150, brief: 'Steal the red sedan at the Marina Garage.' },
  { id: 2, title: 'Sunset Courier', reward: 250, brief: 'Deliver 3 packages before the timer runs out.' },
  { id: 3, title: 'The Heat', reward: 400, brief: 'Lose the cops, then reach the Safehouse.' },
  { id: 4, title: "Marlin's Debt", reward: 325, brief: 'Steal the gold Marlin GT, drop it at the Lighthouse, escape to the Safehouse.' },
  { id: 5, title: "The Marlin's Last Hand", reward: 500, brief: 'Steal the black limo at the Casino, outrun the chase to the Boardwalk, deliver it to the Pier.' },
  { id: 6, title: 'The Solmar Bank Job', reward: 750, brief: 'Steal the armored van, crack the vault at the Bank, escape the 5-star chase to the Airport runway.' },
];

export const TUNING = {
  walkSpeed: 7,
  sprintSpeed: 11,
  carAccel: 16,
  carBrake: 30,
  carMaxSpeed: 30,
  carReverseMax: 10,
  carTurn: 1.9,
  vanMaxSpeed: 24,
  vanAccel: 12,
  limoMaxSpeed: 33,
  policeMaxSpeed: 31,
  policeRamDamage: 9,
  sprayCost: 75,
  sprayRadius: 7,
  respawnFine: 75,
  downTime: 2.6,
  wantedDecaySeconds: 14,
  m2TimeLimit: 240,
  m5TimeLimit: 120,
  m6TimeLimit: 120,
  m6VaultSeconds: 8,
  m6ChaseStars: 5,
  taxiFare: 40,
  doubloonBonus: 200,
  cashPickup: 25,
};

export const COLORS = {
  asphalt: 0x2b2f38,
  roadLine: 0xd8c95a,
  sidewalk: 0x8d8578,
  sand: 0xd9c184,
  sea: 0x1a4a6e,
  grass: 0x4a7a3f,
  buildingA: 0xb98a5e,
  buildingB: 0x7e93a8,
  buildingC: 0xc7b299,
  buildingD: 0x8a6f5c,
  neonPink: 0xff2e88,
  neonCyan: 0x19e3ff,
  neonGold: 0xffc233,
  lampGlow: 0xffd9a0,
};

// Deterministic RNG so the city layout is identical on every load.
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

export function dist2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function nearestRoad(v) {
  let best = ROADS[0];
  let bd = Infinity;
  for (const r of ROADS) {
    const d = Math.abs(r - v);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}
