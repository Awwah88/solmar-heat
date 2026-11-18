// Solmar Heat — shared tuning, world layout and story data.
// Every other module reads its numbers from here so the city, the cars,
// the police and the missions all agree on the same world.

export const CONFIG = {
  world: {
    size: 420,
    roadWidth: 12,
    roads: [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162],
    beachZ0: 170,
    beachZ1: 200,
    seaZ0: 200,
    bounds: 205,
  },

  // Sunset palette: warm low sun, teal sea, sand beach, asphalt roads.
  colors: {
    sky: 0xff9e5e,
    fog: 0xf2a35e,
    sun: 0xffd9a0,
    ground: 0x3d7a4a,
    road: 0x2e2e33,
    sidewalk: 0x8a8a80,
    sand: 0xe8d29a,
    sea: 0x1f7a8c,
    building: [0xd8b48f, 0xb98a68, 0x9fb4c0, 0xc9a06a, 0x8fa3b8, 0xd0c0a0],
    roof: [0x7a4a3a, 0x4a5a6a, 0x6a5a4a],
    car: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0x7a4ac2, 0xd8d8d8, 0x222831, 0xe87a2e],
    gold: 0xd4af37,
    police: 0x1a2a4a,
    taxi: 0xf2c200,
  },

  landmarks: {
    marina: { x: -144, z: -144, name: 'Marina Garage' },
    hotel: { x: 144, z: -144, name: 'Hotel Solmar' },
    lighthouse: { x: 150, z: 185, name: 'Old Lighthouse' },
    spray: { x: -54, z: 54, name: 'Spray Shop' },
    safehouse: { x: 54, z: -54, name: 'Safehouse' },
    pier: { x: 60, z: 196, name: 'The Pier' },
  },

  player: {
    walkSpeed: 6,
    runSpeed: 10.5,
    health: 100,
    radius: 0.7,
  },

  car: {
    accel: 15,
    brake: 34,
    reverseAccel: 10,
    maxSpeed: 42,
    maxReverse: 12,
    turn: 2.0,
    drag: 0.35,
    length: 4.4,
    width: 2.0,
  },

  traffic: {
    count: 14,
    speed: 11,
    maxSpeed: 14,
  },

  pedestrians: {
    count: 24,
    speed: 1.6,
  },

  police: {
    maxCruisers: 3,
    chaseSpeed: 46,
    ramDamage: 6,
    ramCooldown: 1.0,
    ramBackoff: 1.5,
    bustedHold: 2.5,
    bustedRange: 4,
    decaySeconds: 25,
    decayRange: 50,
  },

  economy: {
    mission1: 150,
    mission2: 250,
    mission3: 350,
    mission4: 325,
    packageBonus: 50,
    taxiFare: 40,
    vigilanteBonus: 100,
    shellValue: 10,
    sprayCost: 75,
    winTotal: 1075,
  },

  missions: {
    courierTime: 240,
    courierDrops: [
      { x: 144, z: -144, name: 'Hotel Solmar' },
      { x: 60, z: 196, name: 'The Pier' },
      { x: 54, z: -54, name: 'Safehouse' },
    ],
  },

  shells: [
    { x: -120, z: 178 }, { x: -40, z: 182 }, { x: 20, z: 176 },
    { x: 90, z: 184 }, { x: 140, z: 178 }, { x: -160, z: 186 },
    { x: -18, z: 120 }, { x: 126, z: 18 }, { x: -90, z: -126 },
    { x: 162, z: 90 },
  ],
};

/** Clamp a number into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 2D distance on the ground plane. */
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Small deterministic RNG (mulberry32) for staged shots. */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a road centreline nearest to a value. */
export function nearestRoad(v) {
  const roads = CONFIG.world.roads;
  let best = roads[0];
  for (const r of roads) {
    if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  }
  return best;
}
