// Solmar Heat — shared tuning, layout and story constants.
// Everything the other modules need to agree on lives here: the road
// grid, the landmark positions, the economy and the physics numbers.
export const CFG = {
  // Road centrelines. The city is a 9x9 block grid; roads run between
  // the blocks, 10 units wide, so a block centre sits 18 units from the
  // nearest road centreline on each side.
  roads: [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162],
  blockStep: 36,
  blockCentres: [-144, -108, -72, -36, 0, 36, 72, 108, 144],
  roadHalfWidth: 5,
  cityEdge: 180,
  beachZ: 162,
  seaZ: 182,

  // The player car collides as a circle of radius 2. Buildings must keep
  // their edges at least ~4 units from any road centreline; we clamp them
  // much tighter (10 units from their block centre = 8 from the road).
  carRadius: 2.0,
  playerRadius: 0.6,
  buildingMaxEdge: 10,

  spawn: { x: 80, z: -126, heading: 0 },

  physics: {
    accel: 14, brake: 26, reverseAccel: 11,
    maxSpeed: 30, maxReverse: 9,
    turnRate: 2.1, grip: 6.5,
    walkSpeed: 4.4, runSpeed: 7.4,
    wallCut: 0.6, wallCutCooldown: 0.5,
  },

  economy: {
    m1: 150, m2: [50, 100, 100], m3: 400, m4: 275,
    spray: 75, cash: 25, shell: 10, taxi: 40,
  },

  // Landmarks: centre + half extents of the collider box, the mission
  // marker that sits by it, and the trigger radius around the marker.
  landmarks: {
    garage:    { x: -144, z: -144, hw: 9,   hd: 7,   marker: { x: -144, z: -148 }, radius: 12 },
    hotel:     { x: 144,  z: -144, hw: 8,   hd: 6,   marker: { x: 144,  z: -144 }, radius: 10 },
    lighthouse:{ x: 150,  z: 185,  hw: 8,   hd: 8,   marker: { x: 150,  z: 176 },  radius: 11 },
    spray:     { x: -54,  z: 54,   hw: 6,   hd: 6,   marker: { x: -54,  z: 54 },   radius: 11 },
    safehouse: { x: 54,   z: -54,  hw: 5.5, hd: 5.5, marker: { x: 54,   z: -54 },  radius: 10 },
    pier:      { x: 60,   z: 202,  hw: 16,  hd: 14,  marker: { x: 60,   z: 190 },  radius: 10 },
  },
  goldCar: { x: 126, z: -144 },
  taxiStand: { x: 100, z: 170 },

  missions: [
    { title: 'Hot Wheels',      text: 'Steal a car and deliver it to the Marina Garage' },
    { title: 'Sunset Courier',  text: 'Deliver 3 packages before the timer runs out' },
    { title: 'The Heat',        text: 'Lose the cops, then reach the Safehouse' },
    { title: "Marlin's Debt",   text: "Steal the gold Marlin GT, deliver it to the Old Lighthouse, then escape home" },
  ],
  courierSeconds: 240,

  colors: {
    sky: 0xff9a56, fog: 0xf7a56b, sun: 0xffd27a,
    sea: 0x1d6f8e, sand: 0xd9b380, asphalt: 0x2b2b31,
    sidewalk: 0x8a8a86, grass: 0x5d7a4a,
    building: [0xc96f4a, 0x4a7a9e, 0x9e8a5a, 0x7a5a8a, 0x5a8a6a, 0xb0a090, 0x8a6a4a, 0x6a7a8a],
    car: [0xc0392b, 0x2471a3, 0xf1c40f, 0x7d3c98, 0x16a085, 0xe67e22, 0x2c3e50, 0xbdc3c7],
    gold: 0xd4af37,
  },
};

// Deterministic PRNG (mulberry32) so the city layout is identical on
// every load — screenshots, smoke tests and playthroughs all see the
// same streets.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
