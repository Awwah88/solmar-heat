// Solmar Heat — Round 16 tuning, world layout and story data.
// Every number here is the single source of truth for the other modules:
// roads, blocks, landmarks, mission targets, fares and collectibles.
export const ROADS = [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162];
export const BLOCKS = [-144, -108, -72, -36, 0, 36, 72, 108, 144];
export const WORLD_HALF = 198;
export const SPAWN = { x: 90, z: -144 };
export const MARINA_RESPAWN = { x: 150, z: -126 };
export const LANDMARKS = {
  garage: { x: 162, z: -126, name: 'Marina Garage', marker: { x: 140, z: -118 } },
  hotel: { x: 54, z: -18, name: 'Hotel Solmar', marker: { x: 20, z: 4 } },
  lighthouse: { x: -162, z: 126, name: 'Old Lighthouse', marker: { x: -140, z: 162 } },
  spray: { x: -162, z: 54, name: 'Spray Shop', marker: { x: -140, z: 42 } },
  safehouse: { x: -162, z: 90, name: 'Safehouse', marker: { x: -140, z: 118 } },
  pier: { x: 162, z: 126, name: 'The Pier', marker: { x: 150, z: 126 } },
  casino: { x: 126, z: -54, name: 'Casino Solmar', marker: { x: 126, z: -54 }, building: { x: 144, z: -36 } },
  boardwalk: { x: 126, z: 126, name: 'Solmar Boardwalk', marker: { x: 126, z: 126 } },
};
export const PARKED = {
  redSedan: { x: 154, z: -126, color: 0xd92626, kind: 'sedan', label: 'red sedan' },
  goldGt: { x: 46, z: -18, color: 0xd9a514, kind: 'gt', label: 'gold Marlin GT' },
  limo: { x: 118, z: -54, color: 0x14141c, kind: 'limo', label: 'black Marlin limo' },
  extras: [
    { x: -40, z: 120, color: 0x2f7fd9, kind: 'sedan' },
    { x: 90, z: 54, color: 0xe8e8e8, kind: 'hatch' },
    { x: -90, z: -126, color: 0x22a06b, kind: 'sedan' },
  ],
};
export const M2_PACKAGES = [
  { x: 54, z: 90 },
  { x: -54, z: 162 },
  { x: 126, z: 18 },
];
export const MISSIONS = [
  { id: 1, title: 'Hot Wheels', reward: 150, brief: 'Steal the red sedan at the Marina Garage.' },
  { id: 2, title: 'Sunset Courier', reward: 250, brief: 'Deliver 3 packages before the timer runs out.', timeLimit: 240 },
  { id: 3, title: 'The Heat', reward: 400, brief: 'Lose your wanted level, then reach the Safehouse.' },
  { id: 4, title: "Marlin's Debt", reward: 300, brief: 'Steal the gold Marlin GT, show it at the Lighthouse, then vanish at the Safehouse.' },
  { id: 5, title: "The Marlin's Last Hand", reward: 500, brief: 'Steal the Marlin limo, outrun a 4-star chase to the Boardwalk, deliver it to the Pier.' },
];
export const M5 = {
  limo: { x: 118, z: -54 },
  casino: { x: 126, z: -54 },
  boardwalk: { x: 126, z: 126 },
  pier: { x: 162, z: 126 },
  chaseStars: 4,
  deliveryTime: 120,
  arriveRadius: 10,
};
export const FARE_POINTS = [
  { x: 90, z: -126 }, { x: -90, z: 54 }, { x: 54, z: 126 }, { x: -126, z: -90 },
  { x: 126, z: 54 }, { x: -54, z: -126 }, { x: 18, z: 90 }, { x: 90, z: 18 },
  { x: -126, z: 126 }, { x: 126, z: -126 }, { x: -18, z: 162 }, { x: 162, z: 18 },
];
export const FARE = { base: 40, tipPerStreak: 5, pickupRadius: 5, dropRadius: 6, timeLimit: 90, respawnDelay: 4 };
export const DOUBLOONS = [
  { x: 90, z: -144, hint: 'spawn corner' },
  { x: 140, z: -118, hint: 'Marina Garage' },
  { x: 20, z: 4, hint: 'Hotel Solmar' },
  { x: -140, z: 162, hint: 'Old Lighthouse' },
  { x: -140, z: 42, hint: 'Spray Shop' },
  { x: -140, z: 118, hint: 'Safehouse' },
  { x: 150, z: 126, hint: 'The Pier' },
  { x: 118, z: -54, hint: 'Casino Solmar' },
  { x: 126, z: 118, hint: 'Solmar Boardwalk' },
  { x: 0, z: 0, hint: 'Plaza' },
  { x: -90, z: -90, hint: 'north-west blocks' },
  { x: 54, z: 126, hint: 'south promenade' },
];
export const DOUBLOON_BONUS = 200;
export const DOUBLOON_VALUE = 10;
export const CASH_PICKUPS = [
  { x: 18, z: -90, value: 25 }, { x: -54, z: 18, value: 25 }, { x: 126, z: -90, value: 25 },
  { x: -126, z: -18, value: 25 }, { x: 90, z: 126, value: 25 }, { x: -18, z: -54, value: 25 },
];
export const CAR_COLORS = {
  red: 0xd92626, gold: 0xd9a514, black: 0x14141c, blue: 0x2f7fd9, white: 0xe8e8e8,
  yellow: 0xf2c230, green: 0x22a06b, orange: 0xe86a1c, teal: 0x14b8a6, magenta: 0xd946ef,
  purple: 0x7c3aed, silver: 0x9aa3ad,
};
export const TUNING = {
  walkSpeed: 6.5, sprintSpeed: 10.5, carAccel: 16, carTopSpeed: 27, carBrake: 30,
  carTurn: 1.9, trafficSpeed: 10, policeTopSpeed: 24, wantedDecayDelay: 6,
  sprayCost: 75, respawnFine: 75, downSeconds: 2.6, respawnHealth: 60,
  punchDamage: 34, pistolDamage: 50, pistolRange: 26, policeRamDamage: 4,
};
export const SAVE_KEY = 'solmar-heat-r16-save';
