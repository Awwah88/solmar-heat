// Solmar Heat — staged screenshots: when the page loads with ?shot=cover,
// ?shot=foot, ?shot=mission or ?shot=menu, pose the scene for the camera.
// FIX (learned the hard way): in shot mode the police stay clear of the
// player car and frozen, and toasts are suppressed — or a cruiser rams the
// player mid-shot and the cover is ruined.

import { makeCar } from './vehicles.js';
import { CONFIG } from './config.js';

/** Stage a shot scene. Returns a fixed camera pose, or null for normal play. */
export function stageShot(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;

  game.shotMode = true;
  game.hud.shotMode = true;
  game.police.frozen = true;
  game.hud.hideScreens();
  game.state = 'playing';

  if (shot === 'cover') {
    // Police chase at sunset by the pier: player car with three cruisers
    // ahead of it, the sea and the pier behind them. Cruisers are frozen
    // clear of the player car so nothing rams it mid-shot.
    game.money = 450;
    game.missions.jumpTo(1);
    const car = makeCar(game.scene, 0xc23b2e, 60, 172, 0, { player: true });
    game.enterCar(car);
    game.police.wanted = 3;
    const cruiserSpots = [[42, 182], [78, 182], [60, 188]];
    for (const [x, z] of cruiserSpots) {
      const cruiser = makeCar(game.scene, CONFIG.colors.police, x, z, Math.PI, { police: true });
      game.police.policeCars.push(cruiser);
    }
    return { camPos: [60, 5.5, 156], camLook: [60, 2, 196] };
  }

  if (shot === 'foot') {
    // Dana on foot at a busy intersection, pedestrians and traffic around.
    game.money = 120;
    game.missions.jumpTo(0);
    game.setPlayerPos(10, -10, Math.PI * 0.75);
    for (let i = 0; i < 4 && i < game.pedestrians.peds.length; i++) {
      const ped = game.pedestrians.peds[i];
      ped.group.position.set(14 + i * 2.5, 0, -16 - i * 1.5);
      ped.heading = Math.PI;
    }
    return { camPos: [2, 6, 2], camLook: [16, 1, -18] };
  }

  if (shot === 'mission') {
    // Mission 4 in full flight: the gold Marlin GT racing for the lighthouse
    // with the whole city on its tail.
    game.money = 750;
    game.combat.givePistol();
    game.missions.jumpTo(3);
    const gold = game.missions.goldCar;
    if (gold) {
      gold.group.position.set(150, 0, 162);
      gold.heading = 0;
      gold.group.rotation.y = 0;
      game.enterCar(gold);
      // The objective must match the staged moment: the car is already
      // stolen, so the tracker shows the delivery, not the theft.
      game.hud.setObjective('Deliver the Marlin GT to the Old Lighthouse');
    }
    game.police.wanted = 4;
    const cruiserSpots = [[136, 176], [164, 176], [150, 170]];
    for (const [x, z] of cruiserSpots) {
      const cruiser = makeCar(game.scene, CONFIG.colors.police, x, z, 0, { police: true });
      game.police.policeCars.push(cruiser);
    }
    return { camPos: [150, 6, 146], camLook: [150, 2, 190] };
  }

  if (shot === 'menu') {
    // Title screen over the whole sun-soaked city.
    game.state = 'menu';
    game.hud.showScreen('menu');
    return { camPos: [-40, 75, 150], camLook: [0, 0, -30] };
  }

  return null;
}
