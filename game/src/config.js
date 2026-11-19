// Solmar Heat — world constants, story, landmarks and mission data.
// The city is a 9x9 grid: roads run every 36 units, blocks sit between them.
export const GRID = {
  roads: [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162],
  blocks: [-144, -108, -72, -36, 0, 36, 72, 108, 144],
  half: 180,
  roadHalf: 6,
};

export const STORY = {
  title: 'Solmar Heat',
  hero: 'Dana "Dash" Reyes',
  debt: 400,
  intro: 'Dana "Dash" Reyes owes the Marlin Club $400. Four jobs stand between her and freedom.',
};

export const SPAWN = { x: 90, z: -144, heading: Math.PI };

// Landmarks live on a block; their marker sits on the nearest road so the
// player can always reach it by car or on foot.
export const LANDMARKS = [
  { id: 'garage', name: 'Marina Garage', block: [144, -144], marker: [162, -126], color: 0xff5a3c, note: 'Chop shop by the marina. Hot cars, hotter tempers.' },
  { id: 'hotel', name: 'Hotel Solmar', block: [36, -36], marker: [54, -18], color: 0xffd166, note: 'Five stars, zero questions asked.' },
  { id: 'lighthouse', name: 'Old Lighthouse', block: [-144, 144], marker: [-162, 126], color: 0x7dd3fc, note: 'Nobody watches the north point after dark.' },
  { id: 'spray', name: 'Spray Shop', block: [-144, 36], marker: [-162, 54], color: 0x4ade80, note: 'New paint, new plates, clean slate. $75.' },
  { id: 'safehouse', name: 'Safehouse', block: [-144, 108], marker: [-162, 90], color: 0xc084fc, note: 'Dash keeps a room above the laundromat.' },
  { id: 'pier', name: 'The Pier', block: [144, 144], marker: [162, 126], color: 0xf472b6, note: 'Arcades, gulls and one very long drop-off.' },
];

export const MISSIONS = [
  {
    id: 'm1', title: 'Hot Wheels', reward: 150,
    brief: 'Steal the red sedan parked at Marina Garage and bring it back into play.',
    target: 'garage',
  },
  {
    id: 'm2', title: 'Sunset Courier', reward: 250, bonus: 'pistol',
    brief: 'Three packages, 240 seconds, one very impatient client. Deliver them all.',
    target: 'pier',
    packages: [[54, 90], [-54, 162], [126, 18]],
    timeLimit: 240,
  },
  {
    id: 'm3', title: 'The Heat', reward: 400,
    brief: 'You are at 3 stars. Lose the cops completely, then slip to the Safehouse.',
    target: 'safehouse',
  },
  {
    id: 'm4', title: "Marlin's Debt", reward: 300, bonusCash: 25,
    brief: 'Steal the gold Marlin GT from Hotel Solmar, drop it at the Old Lighthouse with fewer than 4 stars, then vanish to the Safehouse.',
    target: 'lighthouse',
  },
];

export const TAXI = { fareMin: 30, fareMax: 60 };

export const TUNING = {
  walkSpeed: 6,
  sprintSpeed: 9.5,
  turnSpeed: 2.2,
  carAccel: 16,
  carMaxSpeed: 27,
  carReverseMax: 9,
  carBrake: 32,
  carTurn: 2.0,
  trafficCount: 14,
  pedCount: 24,
  maxPolice: 3,
  sprayCost: 75,
  cashPickup: 25,
  bustedFine: 100,
  wastedFine: 150,
  playerRadius: 1,
  carRadius: 2,
};

// Deterministic RNG so staged screenshots repeat.
export function makeRng(seed) {
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
