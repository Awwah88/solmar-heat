// Solmar Heat — shots.js
// Screenshot staging: ?shot=cover|foot|mission|menu (with an optional
// &seed=) puts the live game into a scene that shows off a different
// system in each shot. These are real renders of the running game —
// the staging only moves the player and the state, it never fakes a pixel.

import { CONFIG, LANDMARKS } from './config.js';

export function applyShot(world, params) {
  const shot = params.get('shot');
  if (!shot) return;
  const seed = Number(params.get('seed') || 1);
  // Deterministic-ish placement per seed, so retakes look the same.
  const jitter = (seed % 5) * 2;

  if (shot === 'menu') {
    world.state = 'menu';
    world.hud.showMenu('title');
    return;
  }

  // Every other shot is live gameplay with the HUD on.
  world.hud.hideMenu();
  world.state = 'playing';
  world.audio.ensure();

  if (shot === 'foot') {
    // Mission 1, on foot on a city street, traffic rolling past.
    world.missions.index = 0;
    world.missions.done = [false, false, false];
    world.missions.refreshObjective();
    world.money = 0;
    world.police.setWanted(0);
    world.player.pos.x = 80;
    world.player.pos.z = -100 + jitter;
    world.player.heading = 0;
    world.player.mesh.position.set(80, 0, -100 + jitter);
    world.player.mesh.rotation.y = 0;
    world.cameraYaw = Math.PI;
    world.snapCamera();
    return;
  }

  if (shot === 'mission') {
    // Mission 2 courier run: in the red car, racing for the Pier with
    // the timer on and a package marker ahead.
    world.missions.index = 1;
    world.missions.done = [true, false, false];
    world.missions.packageIndex = 0;
    world.missions.timer = 187;
    world.missions.refreshObjective();
    world.money = 150;
    world.combat.givePistol();
    world._resetPlayerToStart();
    const car = world.redCar;
    world.enterCar(car);
    // Set the wanted level AFTER entering the car: stealing adds a star.
    world.police.setWanted(1);
    car.pos.x = 80;
    car.pos.z = 40 + jitter;
    car.setHeading(0);
    car.speed = 18;
    world.player.pos.x = car.pos.x;
    world.player.pos.z = car.pos.z;
    world.cameraYaw = Math.PI;
    world.snapCamera();
    return;
  }

  if (shot === 'cover') {
    // The money shot: a three-star police chase down a palm-lined road,
    // in the red Comet, mission 2 live, beacons ahead.
    world.missions.index = 1;
    world.missions.done = [true, false, false];
    world.missions.packageIndex = 1;
    world.missions.timer = 142;
    world.missions.refreshObjective();
    world.money = 175;
    world.combat.givePistol();
    world._resetPlayerToStart();
    const car = world.redCar;
    world.enterCar(car);
    // Set the wanted level AFTER entering the car: stealing adds a star.
    world.police.setWanted(3);
    car.pos.x = 80;
    car.pos.z = 60 + jitter;
    car.setHeading(0);
    car.speed = 24;
    world.player.pos.x = car.pos.x;
    world.player.pos.z = car.pos.z;
    // Pull the police in close for the chase.
    world.police.update(0.1, world.player.pos, car, 24, false);
    world.cameraYaw = Math.PI;
    world.snapCamera();
    return;
  }

  // Unknown ?shot= value: leave the game on the title screen.
  world.state = 'menu';
  world.hud.showMenu('title');
}

export function shotList() {
  return [
    { name: '1-cover.jpg', query: '?shot=cover&seed=1' },
    { name: '2-foot.jpg', query: '?shot=foot&seed=1' },
    { name: '3-mission.jpg', query: '?shot=mission&seed=1' },
    { name: '4-menu.jpg', query: '?shot=menu&seed=1' },
  ];
}
