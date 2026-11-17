// Solmar Heat — config.js
// Every tunable number, story beat and landmark for the game lives here,
// so the other modules can stay small and single-purpose. All names,
// places and story details are original inventions for this game.

export const CONFIG = {
  // World geometry. Roads run on lines that are multiples of ROAD_STEP;
  // city blocks sit halfway between them so no building ever blocks a road.
  ROAD_STEP: 40,
  ROAD_HALF: 5,
  CITY_MIN: -160,
  CITY_MAX: 160,
  BLOCK_SIZE: 28,
  SEA_START: 184,
  BEACH_END: 200,
  SEA_END: 260,

  // Player.
  PLAYER_WALK_SPEED: 9,
  PLAYER_RUN_SPEED: 14,
  PLAYER_RADIUS: 0.9,
  PLAYER_START: { x: 80, z: -140 },
  START_HEALTH: 100,
  START_MONEY: 0,

  // Driving.
  CAR_TOP_SPEED: 34,
  CAR_ACCEL: 22,
  CAR_BRAKE: 34,
  CAR_REVERSE_SPEED: 12,
  CAR_TURN: 1.9,
  CAR_RADIUS: 1.9,

  // Wanted / police.
  MAX_WANTED: 5,
  SPRAY_COST: 75,
  STEAL_WANTED: 1,
  PED_HIT_WANTED: 2,
  SHOOT_WANTED: 1,

  // Money.
  MISSION_REWARDS: [150, 250, 400],
  CASH_PICKUP_VALUE: 25,
  SHELL_VALUE: 15,
  TAXI_FARE: 40,
  STUNT_BONUS: 10,
  BUSTED_FINE: 50,

  // Missions.
  MISSION2_TIME_LIMIT: 240,
  MISSION3_WANTED: 3,

  // Day / night. dayTime 0..1: 0 = midnight, 0.25 = sunrise, 0.5 = noon,
  // 0.75 = sunset. The game starts mid-morning so the city reads
  // sun-soaked from the first frame.
  DAY_LENGTH_SECONDS: 300,
  DAY_START: 0.32,

  // Traffic and crowds.
  TRAFFIC_COUNT: 14,
  PEDESTRIAN_COUNT: 24,
  MAX_POLICE: 5,

  // Collectibles.
  SHELL_COUNT: 10,
};

// The story, in the game's own words. Dana "Dash" Reyes borrowed money
// from the Marlin Club and has one hot afternoon to pay it back.
export const STORY = {
  hero: 'Dana "Dash" Reyes',
  debt: 400,
  creditor: 'Marlin Club',
  title: 'Solmar Heat',
  tagline: 'One hot afternoon. Four hundred dollars. No way out but through.',
  intro:
    'Solmar Bay is all sun, salt and bad decisions. Dash owes the Marlin Club $400 ' +
    'and the sun is already going down on the deadline. Steal a car, run the ' +
    'courier jobs, lose the heat — and pay up before the Club comes collecting.',
};

// Landmarks. Each one has a building spot (the visual, inside a block) and
// a marker spot (the gameplay trigger, on a road next to it) — the marker is
// what missions drive to, never the building centre.
export const LANDMARKS = {
  garage: {
    name: 'Marina Garage',
    building: { x: 160, z: -140 },
    marker: { x: 140, z: -118 },
    color: 0x2e7d6b,
  },
  hotel: {
    name: 'Hotel Solmar',
    building: { x: 40, z: -20 },
    marker: { x: 20, z: 4 },
    color: 0xd9a441,
  },
  lighthouse: {
    name: 'Old Lighthouse',
    building: { x: -160, z: 180 },
    marker: { x: -140, z: 162 },
    color: 0xe8e4d8,
  },
  spray: {
    name: 'Spray Shop',
    building: { x: -160, z: 60 },
    marker: { x: -140, z: 42 },
    color: 0x4a7fb5,
  },
  safehouse: {
    name: 'Safehouse',
    building: { x: -160, z: 100 },
    marker: { x: -140, z: 118 },
    color: 0x7a5fb5,
  },
  pier: {
    name: 'The Pier',
    building: { x: 60, z: 210 },
    marker: { x: 60, z: 200 },
    color: 0x8a6a4a,
  },
};

// The three story missions, in order.
export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief:
      'The Club wants a car. Any car. Steal the red Comet parked up the road ' +
      'and bring it to the Marina Garage.',
    objective: 'Steal a car and drive it to the Marina Garage',
    reward: 150,
  },
  {
    id: 'sunset-courier',
    title: 'Sunset Courier',
    brief:
      'Three packages, three drops, one sunset. The Pier, the Hotel Solmar, ' +
      'then the Old Lighthouse — 240 seconds on the clock.',
    objective: 'Deliver 3 packages before the timer runs out',
    reward: 250,
    timeLimit: 240,
  },
  {
    id: 'the-heat',
    title: 'The Heat',
    brief:
      'The courier run lit up the whole city. Lose the three stars — the Spray ' +
      'Shop can wash the car clean — then get to the Safehouse and pay the Club.',
    objective: 'Lose 3 wanted stars, then reach the Safehouse',
    reward: 400,
  },
];

// Cash bundles left lying around the city (green markers, $25 each).
// Two of them sit on the story route on purpose; the rest reward exploring.
export const CASH_PICKUPS = [
  { x: 120, z: -120 },
  { x: 120, z: 160 },
  { x: 0, z: 120 },
  { x: -40, z: -80 },
  { x: 160, z: 40 },
  { x: -120, z: -160 },
  { x: 40, z: 200 },
];

// Golden shells hidden around Solmar Bay — a collectible hunt for free roam.
export const SHELLS = [
  { x: 44, z: 196 },
  { x: -100, z: 196 },
  { x: 140, z: 188 },
  { x: -160, z: 188 },
  { x: 20, z: 196 },
  { x: -60, z: -160 },
  { x: 100, z: 120 },
  { x: -100, z: 80 },
  { x: 160, z: -40 },
  { x: 0, z: -120 },
];

// Stunt ramps: drive over one fast enough and the car goes airborne.
export const RAMPS = [
  { x: 40, z: 176, angle: 0 },
  { x: -40, z: 176, angle: 0 },
];

// Parked cars. The first is the red Comet the first mission needs; the
// rest are ordinary cars the player can steal. Every one sits on a road.
export const PARKED_CARS = [
  { x: 80, z: -120, color: 0xd23b2e, model: 'comet', red: true },
  { x: -40, z: 120, color: 0x3b6fd2, model: 'sedan', red: false },
  { x: 40, z: 40, color: 0xe8e4d8, model: 'sedan', red: false },
  { x: -80, z: -40, color: 0x2e8a4a, model: 'coupe', red: false },
  { x: 120, z: 80, color: 0xd9a441, model: 'sedan', red: false },
  { x: 0, z: -40, color: 0xe8c832, model: 'taxi', red: false, taxi: true },
];

// Palette for the sun-soaked coast: sand, sea, white walls, terracotta.
export const PALETTE = {
  road: 0x3a3f46,
  roadLine: 0xe8e4d8,
  sidewalk: 0x9a938a,
  sand: 0xe0c98f,
  sea: 0x2e7fa8,
  seaDeep: 0x1d5f86,
  grass: 0x6fae5e,
  buildingWall: 0xf2ead8,
  buildingRoof: 0xc96a4a,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f9e4d,
  lampPost: 0x2c2f36,
};

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
