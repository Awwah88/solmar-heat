// Solmar Heat — entry point.
// Builds the world, restores a save when there is one (unless a
// screenshot is being staged), and exposes the game handle the
// automated playthrough and the dev tools read.

import { World } from './world.js';

const canvas = document.getElementById('game-canvas');
const world = new World(canvas);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  world.stageShot(shot);
} else {
  world.loadSave();
}

// The public handle: state, money, and health are plain values
// (getters, not functions), and health is settable.
window.__solmarHeat = {
  get state() { return world.state; },
  get money() { return world.money; },
  get health() { return world.health; },
  set health(v) { world.health = Math.max(0, Math.min(100, v)); },
  get time() { return world.time; },
  playerPos: () => ({ x: world.player.x, z: world.player.z }),
  playerHeading: () => world.player.heading,
  get player() { return world.player; },
  get traffic() { return world.traffic; },
  get parkedCars() { return world.parkedCars; },
  get police() { return world.police; },
  get missions() { return world.missions; },
  get hud() { return world.hud; },
  get renderer() { return world.renderer; },
  get scene() { return world.scene; },
  get city() { return world.city; },
};
